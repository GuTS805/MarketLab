import os, math, json, hashlib
from pathlib import Path
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func, and_, inspect, text
from sqlalchemy.orm import Session
from .database import Base, engine, SessionLocal
from .models import *
from .events import events_between
from . import ml
from .schema import initialize_schema

initialize_schema(engine, Base.metadata)
def build_id():
    digest=hashlib.sha256()
    for name in ("main.py","ml.py","models.py","database.py"):
        digest.update((Path(__file__).parent/name).read_bytes())
    return digest.hexdigest()[:16]

BUILD_ID=build_id()
app=FastAPI(title="MarketLab API",version="2.0")
app.add_middleware(CORSMiddleware,allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS","").split(",") if o.strip()],allow_origin_regex=r"http://(?:localhost|127\.0\.0\.1):30\d\d",allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
pwd=CryptContext(schemes=["bcrypt"],deprecated="auto"); oauth=OAuth2PasswordBearer(tokenUrl="/auth/login"); SECRET=os.getenv("JWT_SECRET","dev-only-change-me")
if os.getenv("RENDER") and SECRET=="dev-only-change-me": raise RuntimeError("JWT_SECRET must be set in production")
def db():
    s=SessionLocal()
    try: yield s
    finally: s.close()
def token(uid): return jwt.encode({"sub":str(uid)},SECRET,algorithm="HS256")
def user(t=Depends(oauth),s:Session=Depends(db)):
    try: uid=int(jwt.decode(t,SECRET,algorithms=["HS256"])["sub"])
    except (JWTError,KeyError,ValueError): raise HTTPException(401,"Invalid authentication")
    u=s.get(User,uid)
    if not u: raise HTTPException(401,"User not found")
    return u
def sim_owned(s:Session,sid:int,u:User):
    x=s.get(Simulation,sid)
    if not x or x.user_id!=u.id: raise HTTPException(404,"Session not found")
    return x
def money(v): return Decimal(v).quantize(Decimal("0.01"),rounding=ROUND_HALF_UP)
def fee(z,side,value):
    """Indian delivery-equity charges: STT 0.1% both sides, NSE txn 0.00345%, SEBI 0.0001%, GST 18% on those two, stamp duty 0.015% on buys, DP charge Rs13 + GST on sells. Zero brokerage (discount broker)."""
    if not z.fees_enabled: return Decimal(0)
    v=Decimal(value); exch=v*Decimal("0.0000345"); sebi=v*Decimal("0.000001")
    total=v*Decimal("0.001")+exch+sebi+(exch+sebi)*Decimal("0.18")
    if side=="buy": total+=v*Decimal("0.00015")
    else: total+=Decimal("15.34")
    return money(total)
class Register(BaseModel): email:EmailStr; password:str=Field(min_length=8,max_length=72)
class SimIn(BaseModel): name:str="Sandbox"; start_date:date; initial_cash:Decimal=Field(default=Decimal("100000"),gt=0); fees:bool=False
class OrderIn(BaseModel): symbol:str; side:str; order_type:str; quantity:int=Field(gt=0); limit_price:Decimal|None=None
@app.get("/health")
def health(s:Session=Depends(db)): return {"status":"ok","build_id":BUILD_ID,"instruments":s.scalar(select(func.count(Instrument.id)))}
@app.post("/auth/register")
def register(x:Register,s:Session=Depends(db)):
    if s.scalar(select(User).where(User.email==x.email.lower())): raise HTTPException(409,"Email already registered")
    u=User(email=x.email.lower(),password_hash=pwd.hash(x.password)); s.add(u); s.commit(); return {"access_token":token(u.id),"token_type":"bearer"}
@app.post("/auth/login")
def login(f:OAuth2PasswordRequestForm=Depends(),s:Session=Depends(db)):
    u=s.scalar(select(User).where(User.email==f.username.lower()))
    if not u or not pwd.verify(f.password,u.password_hash): raise HTTPException(401,"Incorrect email or password")
    return {"access_token":token(u.id),"token_type":"bearer"}
@app.get("/sessions")
def sessions(u:User=Depends(user),s:Session=Depends(db)): return s.scalars(select(Simulation).where(Simulation.user_id==u.id).order_by(Simulation.id.desc())).all()
@app.post("/sessions")
def create_session(x:SimIn,u:User=Depends(user),s:Session=Depends(db)):
    first=s.scalar(select(func.min(DailyPrice.date)).where(DailyPrice.date>=x.start_date))
    last=s.scalar(select(func.max(DailyPrice.date)))
    if not first or first==last: raise HTTPException(422,"Start date must be before the last imported trading day")
    x.start_date=first
    z=Simulation(user_id=u.id,name=x.name,start_date=x.start_date,current_date=x.start_date,cash=money(x.initial_cash),initial_cash=money(x.initial_cash),fees_enabled=x.fees); s.add(z); s.flush(); s.add_all([CashLedger(simulation_id=z.id,date=z.start_date,amount=z.cash,kind="initial_deposit"),Snapshot(simulation_id=z.id,date=z.start_date,cash=z.cash,equity=z.cash)]); s.commit(); return z
def latest_prices(s,d):
    sub=select(DailyPrice.instrument_id,func.max(DailyPrice.date).label("d")).where(DailyPrice.date<=d).group_by(DailyPrice.instrument_id).subquery()
    return select(Instrument,DailyPrice).join(DailyPrice,DailyPrice.instrument_id==Instrument.id).join(sub,and_(sub.c.instrument_id==DailyPrice.instrument_id,sub.c.d==DailyPrice.date))
def spark_of(s,iid,d):
    return [float(c) for c in reversed(s.scalars(select(DailyPrice.close).where(DailyPrice.instrument_id==iid,DailyPrice.date<=d).order_by(DailyPrice.date.desc()).limit(40)).all())]
@app.get("/sessions/{sid}/market")
def market(sid:int,q:str="",u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); rows=s.execute(latest_prices(s,z.current_date).where(Instrument.symbol.ilike(f"%{q}%"))).all(); out=[]
    watched=set(s.scalars(select(Watchlist.instrument_id).where(Watchlist.user_id==u.id)))
    for i,p in rows:
        if i.is_benchmark: continue
        previous=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==i.id,DailyPrice.date<p.date).order_by(DailyPrice.date.desc()))
        change=((Decimal(p.close)/Decimal(previous)-1)*100) if previous else None
        out.append({"symbol":i.symbol,"name":i.name,"sector":i.sector,"date":p.date,"close":p.close,"change_pct":change,"spark":spark_of(s,i.id,z.current_date),"watched":i.id in watched})
    return sorted(out,key=lambda r:r["symbol"])
@app.get("/sessions/{sid}/market/{symbol}")
def stock(sid:int,symbol:str,from_date:date|None=None,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); i=s.scalar(select(Instrument).where(Instrument.symbol==symbol.upper()))
    if not i: raise HTTPException(404,"Symbol not found")
    start=max(from_date or z.start_date-timedelta(days=365),date(1900,1,1)); ps=s.scalars(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date>=start,DailyPrice.date<=z.current_date).order_by(DailyPrice.date)).all(); return {"instrument":i,"simulation_date":z.current_date,"prices":ps,"watched":bool(s.scalar(select(Watchlist.id).where(Watchlist.user_id==u.id,Watchlist.instrument_id==i.id)))}
def reserved(s,z,instrument_id=None):
    pending=s.scalars(select(Order).where(Order.simulation_id==z.id,Order.status=="pending")).all(); cash=Decimal(0)
    for o in pending:
        if o.side!="buy": continue
        px=o.limit_price
        if o.order_type=="market": px=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==o.instrument_id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date.desc())) or 0
        v=money(px)*o.quantity; cash+=v+fee(z,"buy",v)
    shares=sum(o.quantity for o in pending if o.side=="sell" and (instrument_id is None or o.instrument_id==instrument_id)); return money(cash),shares
@app.post("/sessions/{sid}/orders")
def order(sid:int,x:OrderIn,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    if not z.active: raise HTTPException(409,"Session has ended")
    if x.side not in ("buy","sell") or x.order_type not in ("market","limit") or (x.order_type=="limit" and (x.limit_price is None or x.limit_price<=0)): raise HTTPException(422,"Invalid order")
    i=s.scalar(select(Instrument).where(Instrument.symbol==x.symbol.upper(),Instrument.is_benchmark==False))
    if not i: raise HTTPException(404,"Symbol not found")
    p=s.scalar(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date.desc()))
    if not p: raise HTTPException(422,"No observable price")
    rc,rs=reserved(s,z,i.id)
    estimate=money((x.limit_price if x.order_type=="limit" else p.close)*x.quantity)
    if x.side=="buy" and z.cash-rc<estimate+fee(z,"buy",estimate): raise HTTPException(409,"Insufficient available cash")
    h=s.scalar(select(Holding).where(Holding.simulation_id==z.id,Holding.instrument_id==i.id)); qty=h.quantity if h else 0
    if x.side=="sell" and qty-rs<x.quantity: raise HTTPException(409,"Insufficient available shares")
    o=Order(simulation_id=z.id,instrument_id=i.id,side=x.side,order_type=x.order_type,quantity=x.quantity,limit_price=money(x.limit_price) if x.limit_price else None,submitted_date=z.current_date); s.add(o); s.commit(); return o
@app.delete("/sessions/{sid}/orders/{oid}")
def cancel(sid:int,oid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); o=s.get(Order,oid)
    if not o or o.simulation_id!=z.id: raise HTTPException(404,"Order not found")
    if o.status!="pending": raise HTTPException(409,"Only pending orders can be cancelled")
    o.status="cancelled"; s.commit(); return {"status":"cancelled"}
def equity(s,z):
    total=Decimal(z.cash)
    for h in s.scalars(select(Holding).where(Holding.simulation_id==z.id,Holding.quantity>0)):
        p=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==h.instrument_id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date.desc())); total+=Decimal(p or 0)*h.quantity
    return money(total)
def step(s,z):
    nxt=s.scalar(select(func.min(DailyPrice.date)).where(DailyPrice.date>z.current_date))
    if not nxt: return None
    # A single transaction plus unique fill/snapshot keys makes retries idempotent.
    for h in s.scalars(select(Holding).where(Holding.simulation_id==z.id,Holding.quantity>0).with_for_update()).all():
        action=s.scalar(select(DailyPrice).where(DailyPrice.instrument_id==h.instrument_id,DailyPrice.date==nxt))
        if not action: continue
        if action.stock_splits and action.stock_splits!=0:
            ratio=Decimal(action.stock_splits); h.quantity=int(Decimal(h.quantity)*ratio); h.avg_cost=Decimal(h.avg_cost)/ratio
            s.add(CashLedger(simulation_id=z.id,date=nxt,amount=0,kind="stock_split",reference=f"{h.instrument_id}:{ratio}"))
        if action.dividends and action.dividends!=0:
            credit=money(Decimal(action.dividends)*h.quantity); z.cash+=credit; s.add(CashLedger(simulation_id=z.id,date=nxt,amount=credit,kind="dividend",reference=str(h.instrument_id)))
    for o in s.scalars(select(Order).where(Order.simulation_id==z.id,Order.status=="pending",Order.submitted_date<nxt).with_for_update()).all():
        p=s.scalar(select(DailyPrice).where(DailyPrice.instrument_id==o.instrument_id,DailyPrice.date==nxt))
        if not p: continue
        fill=None
        if o.order_type=="market": fill=p.open
        elif o.side=="buy" and p.open<=o.limit_price: fill=p.open
        elif o.side=="buy" and p.low<=o.limit_price: fill=o.limit_price
        elif o.side=="sell" and p.open>=o.limit_price: fill=p.open
        elif o.side=="sell" and p.high>=o.limit_price: fill=o.limit_price
        if fill is None: continue
        fill=money(fill); h=s.scalar(select(Holding).where(Holding.simulation_id==z.id,Holding.instrument_id==o.instrument_id).with_for_update())
        if not h: h=Holding(simulation_id=z.id,instrument_id=o.instrument_id,quantity=0,avg_cost=0,realized_pnl=0); s.add(h); s.flush()
        value=money(fill*o.quantity); f=fee(z,o.side,value)
        if o.side=="buy":
            if z.cash<value+f: o.status="rejected"; continue
            h.avg_cost=((Decimal(h.avg_cost)*h.quantity)+value)/(h.quantity+o.quantity); h.quantity+=o.quantity; z.cash-=value+f
        else:
            if h.quantity<o.quantity: o.status="rejected"; continue
            h.realized_pnl=money(h.realized_pnl+(fill-h.avg_cost)*o.quantity); h.quantity-=o.quantity; z.cash+=value-f
        o.status="filled"; f and s.add(CashLedger(simulation_id=z.id,date=nxt,amount=-f,kind="fees",reference=str(o.id))); s.add(Fill(order_id=o.id,date=nxt,quantity=o.quantity,price=fill)); s.add(CashLedger(simulation_id=z.id,date=nxt,amount=value if o.side=="sell" else -value,kind=f"trade_{o.side}",reference=str(o.id)))
    z.current_date=nxt; z.version+=1; s.flush(); s.merge(Snapshot(simulation_id=z.id,date=nxt,cash=z.cash,equity=equity(s,z)))
    challenge=s.scalar(select(Challenge).where(Challenge.simulation_id==z.id))
    if challenge and challenge.completed_at is None:
        elapsed=s.scalar(select(func.count(func.distinct(DailyPrice.date))).where(DailyPrice.date>challenge.start_date,DailyPrice.date<=nxt)) or 0
        if elapsed>=challenge.duration_days: challenge.completed_at=datetime.utcnow()
    s.commit(); return nxt
@app.post("/sessions/{sid}/advance")
def advance(sid:int,days:int=Query(1,ge=1,le=60),u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    if not z.active: raise HTTPException(409,"Session has ended")
    moved=0
    while moved<days and step(s,z): moved+=1
    if not moved: raise HTTPException(409,"No later trading day available")
    return {"date":z.current_date,"equity":equity(s,z),"days":moved}
def bench_close(s,bid,d): return s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==bid,DailyPrice.date<=d).order_by(DailyPrice.date.desc()))
@app.get("/sessions/{sid}/portfolio")
def portfolio(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); out=[]; realized=Decimal(0)
    for h in s.scalars(select(Holding).where(Holding.simulation_id==z.id)).all():
        realized+=Decimal(h.realized_pnl)
        if h.quantity<=0: continue
        i=s.get(Instrument,h.instrument_id); p=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date.desc())) or 0; out.append({"symbol":i.symbol,"name":i.name,"sector":i.sector,"quantity":h.quantity,"avg_cost":h.avg_cost,"price":p,"value":money(p*h.quantity),"unrealized_pnl":money((p-h.avg_cost)*h.quantity),"unrealized_pct":float(Decimal(p)/Decimal(h.avg_cost)-1) if h.avg_cost else 0,"realized_pnl":h.realized_pnl})
    snaps=s.scalars(select(Snapshot).where(Snapshot.simulation_id==z.id).order_by(Snapshot.date)).all(); vals=[float(x.equity) for x in snaps]; peak=vals[0] if vals else 0; dd=0
    for v in vals: peak=max(peak,v); dd=min(dd,(v/peak-1) if peak else 0)
    returns=[vals[i]/vals[i-1]-1 for i in range(1,len(vals)) if vals[i-1]]; vol=(sum((r-sum(returns)/len(returns))**2 for r in returns)/(len(returns)-1))**.5*math.sqrt(252) if len(returns)>1 else None
    bench=s.scalar(select(Instrument).where(Instrument.is_benchmark==True)); base=bench_close(s,bench.id,z.start_date) if bench else None; curve=[]
    for x in snaps:
        b=bench_close(s,bench.id,x.date) if base else None
        curve.append({"date":x.date,"cash":x.cash,"equity":x.equity,"benchmark":float(Decimal(b)/Decimal(base)*Decimal(z.initial_cash)) if b and base else None})
    unrealized=sum((Decimal(h["unrealized_pnl"]) for h in out),Decimal(0))
    return {"session":z,"cash":z.cash,"equity":equity(s,z),"holdings":out,"snapshots":curve,"max_drawdown":dd,"volatility":vol,"volatility_window":len(returns),"realized_pnl":money(realized),"unrealized_pnl":money(unrealized),"fees_paid":money(-(s.scalar(select(func.coalesce(func.sum(CashLedger.amount),0)).where(CashLedger.simulation_id==z.id,CashLedger.kind=="fees")) or 0))}
@app.get("/sessions/{sid}/orders")
def orders(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); rows=s.execute(select(Order,Instrument.symbol,Fill.price,Fill.date).join(Instrument,Order.instrument_id==Instrument.id).outerjoin(Fill,Fill.order_id==Order.id).where(Order.simulation_id==z.id).order_by(Order.id.desc())).all()
    return [{"id":o.id,"symbol":sym,"side":o.side,"order_type":o.order_type,"quantity":o.quantity,"limit_price":o.limit_price,"status":o.status,"submitted_date":o.submitted_date,"fill_price":fp,"fill_date":fd} for o,sym,fp,fd in rows]
@app.post("/sessions/{sid}/end")
def end(sid:int,u:User=Depends(user),s:Session=Depends(db)): z=sim_owned(s,sid,u); z.active=False; s.commit(); return {"status":"ended"}
@app.post("/watchlist/{symbol}")
def watch(symbol:str,u:User=Depends(user),s:Session=Depends(db)):
    i=s.scalar(select(Instrument).where(Instrument.symbol==symbol.upper()));
    if not i: raise HTTPException(404,"Symbol not found")
    w=s.scalar(select(Watchlist).where(Watchlist.user_id==u.id,Watchlist.instrument_id==i.id))
    if w: s.delete(w); added=False
    else: s.add(Watchlist(user_id=u.id,instrument_id=i.id)); added=True
    s.commit(); return {"added":added}

@app.get("/sessions/{sid}/watchlist")
def get_watchlist(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); ids=select(Watchlist.instrument_id).where(Watchlist.user_id==u.id)
    rows=s.execute(latest_prices(s,z.current_date).where(Instrument.id.in_(ids))).all(); out=[]
    for i,p in rows:
        prev=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==i.id,DailyPrice.date<p.date).order_by(DailyPrice.date.desc()))
        out.append({"symbol":i.symbol,"name":i.name,"sector":i.sector,"close":p.close,"date":p.date,"change_pct":float(Decimal(p.close)/Decimal(prev)-1)*100 if prev else None,"spark":spark_of(s,i.id,z.current_date)})
    return sorted(out,key=lambda r:r["symbol"])

@app.get("/sessions/{sid}/results")
def results(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); data=portfolio(sid,u,s); benchmark=s.scalar(select(Instrument).where(Instrument.is_benchmark==True))
    bench_return=None
    if benchmark:
        first=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==benchmark.id,DailyPrice.date>=z.start_date,DailyPrice.date<=z.current_date).order_by(DailyPrice.date))
        last=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==benchmark.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date.desc()))
        if first and last: bench_return=float(Decimal(last)/Decimal(first)-1)
    fills=s.execute(select(Fill,Order,Instrument).join(Order,Fill.order_id==Order.id).join(Instrument,Order.instrument_id==Instrument.id).where(Order.simulation_id==z.id).order_by(Fill.date)).all()
    def moved(f,i):
        now=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date.desc()))
        return (now,float(Decimal(now)/Decimal(f.price)-1)) if now else (None,None)
    return {"fees_paid":data["fees_paid"],"start_date":z.start_date,"end_date":z.current_date,"initial_value":z.initial_cash,"final_value":data["equity"],"return":float(Decimal(data["equity"])/Decimal(z.initial_cash)-1),"benchmark_return":bench_return,"max_drawdown":data["max_drawdown"],"volatility":data["volatility"],"snapshots":data["snapshots"],"trades":[{"date":f.date,"symbol":i.symbol,"side":o.side,"quantity":f.quantity,"price":f.price,"now_price":moved(f,i)[0],"move_since":moved(f,i)[1]} for f,o,i in fills]}

@app.get("/sessions/{sid}/events")
def events(sid:int,since_start:bool=False,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u); return events_between(z.start_date if since_start else None,z.current_date)
@app.get("/leaderboard")
def leaderboard(u:User=Depends(user),s:Session=Depends(db)):
    best={}
    for z in s.scalars(select(Simulation).order_by(Simulation.id)).all(): best[(z.user_id,z.start_date)]=z
    groups={}; names={}
    for (uid,sd),z in best.items():
        if z.current_date==z.start_date: continue
        if uid not in names: e=s.get(User,uid).email.split("@")[0]; names[uid]=e[:2]+"***"
        eq=equity(s,z); groups.setdefault(sd,[]).append({"player":names[uid],"is_me":uid==u.id,"equity":eq,"return":float(eq/Decimal(z.initial_cash)-1),"reached":z.current_date,"fees":z.fees_enabled})
    out=[]
    for sd,rows in groups.items():
        rows.sort(key=lambda r:r["return"],reverse=True)
        for n,r in enumerate(rows,1): r["rank"]=n
        out.append({"start_date":sd,"players":len(rows),"entries":rows[:20]})
    return sorted(out,key=lambda g:(-g["players"],g["start_date"]))

def model_context(s:Session,sid:int,symbol:str,u:User):
    z=sim_owned(s,sid,u)
    i=s.scalar(select(Instrument).where(Instrument.symbol==symbol.upper(),Instrument.is_benchmark==False))
    if not i: raise HTTPException(404,"Stock not found")
    prices=s.scalars(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date)).all()
    if not prices or prices[-1].date!=z.current_date: raise HTTPException(422,"This stock has no closing price on the simulation date")
    return z,i,prices

def model_quality(run:ModelRun,metrics:dict):
    final_ok=run.test_samples>=30 and metrics["accuracy"]>=.53 and metrics["accuracy"]>=metrics["baseline_accuracy"]+.02
    earlier=metrics.get("walk_forward_summary")
    earlier_ok=earlier is not None and earlier["accuracy"]>=earlier["baseline_accuracy"]+.02
    return "above_baseline" if final_ok and earlier_ok else "experimental"

def ensure_model(s:Session,z:Simulation,i:Instrument,prices:list[DailyPrice]):
    existing=s.scalar(select(ModelRun.id).where(ModelRun.simulation_id==z.id,ModelRun.instrument_id==i.id,ModelRun.version==ml.VERSION,ModelRun.trained_through==z.current_date))
    if existing or len(prices)<ml.MIN_SAMPLES+21: return
    try: result=ml.train(prices)
    except ValueError: return
    result["artifact"]["dataset_revision"]=s.scalar(select(ImportRun.revision).order_by(ImportRun.id.desc()))
    s.add(ModelRun(simulation_id=z.id,instrument_id=i.id,version=ml.VERSION,trained_through=z.current_date,samples=result["sample_count"],train_samples=result["train_count"],test_samples=result["test_count"],metrics_json=json.dumps(result["metrics"]),artifact_json=json.dumps(result["artifact"]),holdout_json=json.dumps(result["holdout"])))
    s.commit()

def decision_profile(s:Session,z:Simulation,i:Instrument):
    rows=s.scalars(select(JournalEntry).where(JournalEntry.simulation_id==z.id,JournalEntry.instrument_id==i.id,JournalEntry.decision_date<z.current_date,JournalEntry.horizon_days==1).order_by(JournalEntry.decision_date)).all()
    resolved=[]
    for entry in rows:
        next_close=s.scalar(select(DailyPrice.close).where(DailyPrice.instrument_id==i.id,DailyPrice.date>entry.decision_date,DailyPrice.date<=z.current_date).order_by(DailyPrice.date).limit(1))
        if next_close is not None:
            actual="Up" if next_close>entry.decision_close else "Down"
            resolved.append((entry.predicted_direction,actual))
    correct=sum(call==actual for call,actual in resolved)
    up_calls=sum(call=="Up" for call,_ in resolved)
    down_calls=len(resolved)-up_calls
    return {"resolved":len(resolved),"correct":correct,"accuracy":correct/len(resolved) if resolved else None,"up_calls":up_calls,"up_correct":sum(call==actual for call,actual in resolved if call=="Up"),"down_calls":down_calls,"down_correct":sum(call==actual for call,actual in resolved if call=="Down"),"status":"pattern_available" if len(resolved)>=5 else "gathering_history"}

def model_response(s:Session,z:Simulation,i:Instrument,prices:list[DailyPrice]):
    samples=ml.examples(prices)
    latest=s.scalar(select(ModelRun).where(ModelRun.simulation_id==z.id,ModelRun.instrument_id==i.id,ModelRun.version==ml.VERSION).order_by(ModelRun.trained_through.desc(),ModelRun.id.desc()))
    base={"symbol":i.symbol,"simulation_date":z.current_date,"model_version":ml.VERSION,"minimum_samples":ml.MIN_SAMPLES,"available_samples":sum(x.label is not None for x in samples),"decision_profile":decision_profile(s,z,i)}
    if not latest: return {**base,"status":"untrained"}
    artifact=json.loads(latest.artifact_json)
    probability=ml.predict(artifact,samples[-1].features) if samples and samples[-1].date==z.current_date else None
    metrics=json.loads(latest.metrics_json)
    quality=model_quality(latest,metrics)
    return {**base,"status":"trained","run_id":latest.id,"trained_through":latest.trained_through,"created_at":latest.created_at,"dataset_revision":artifact.get("dataset_revision"),"sample_count":latest.samples,"train_count":latest.train_samples,"test_count":latest.test_samples,"probability_up":probability,"predicted_direction":"Up" if probability is not None and probability>=.5 else "Down" if probability is not None else None,"quality":quality,"metrics":metrics,"holdout":json.loads(latest.holdout_json),"feature_weights":[{"name":name,"weight":round(weight,4)} for name,weight in zip(ml.FEATURES,artifact["weights"][1:])],"stale":latest.trained_through<z.current_date}

@app.get("/sessions/{sid}/models/signals")
def model_signals(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    for i in s.scalars(select(Instrument).where(Instrument.is_benchmark==False)).all():
        prices=s.scalars(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date)).all()
        if prices and prices[-1].date==z.current_date:
            ensure_model(s,z,i,prices)
    runs=s.scalars(select(ModelRun).where(ModelRun.simulation_id==z.id,ModelRun.version==ml.VERSION,ModelRun.trained_through<=z.current_date).order_by(ModelRun.trained_through.desc(),ModelRun.id.desc())).all()
    signals=[]; seen=set()
    for run in runs:
        if run.instrument_id in seen: continue
        seen.add(run.instrument_id)
        i=s.get(Instrument,run.instrument_id)
        prices=s.scalars(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date)).all()
        if not prices or prices[-1].date!=z.current_date: continue
        response=model_response(s,z,i,prices)
        signals.append({key:response[key] for key in ("symbol","simulation_date","run_id","trained_through","sample_count","test_count","probability_up","predicted_direction","quality","stale","metrics")})
    return signals

@app.get("/sessions/{sid}/models/{symbol}/runs")
def model_runs(sid:int,symbol:str,u:User=Depends(user),s:Session=Depends(db)):
    z,i,_=model_context(s,sid,symbol,u)
    runs=s.scalars(select(ModelRun).where(ModelRun.simulation_id==z.id,ModelRun.instrument_id==i.id,ModelRun.trained_through<=z.current_date).order_by(ModelRun.trained_through.desc(),ModelRun.id.desc())).all()
    return [{"run_id":run.id,"symbol":i.symbol,"trained_through":run.trained_through,"created_at":run.created_at,"sample_count":run.samples,"train_count":run.train_samples,"test_count":run.test_samples,"model_version":run.version,"dataset_revision":json.loads(run.artifact_json).get("dataset_revision"),"metrics":json.loads(run.metrics_json),"stale":run.trained_through<z.current_date} for run in runs]

@app.get("/sessions/{sid}/models/{symbol}")
def get_model(sid:int,symbol:str,u:User=Depends(user),s:Session=Depends(db)):
    z,i,prices=model_context(s,sid,symbol,u)
    ensure_model(s,z,i,prices)
    return model_response(s,z,i,prices)

@app.post("/sessions/{sid}/models/{symbol}/train")
def train_model(sid:int,symbol:str,u:User=Depends(user),s:Session=Depends(db)):
    z,i,prices=model_context(s,sid,symbol,u)
    ensure_model(s,z,i,prices)
    response=model_response(s,z,i,prices)
    if response["status"]=="untrained": raise HTTPException(422,f"At least {ml.MIN_SAMPLES+21} trading days of valid history are needed before training")
    return response

class JournalIn(BaseModel):
    symbol:str=Field(min_length=1,max_length=40)
    reason:str=Field(min_length=8,max_length=2000)
    predicted_direction:Literal["Up","Down"]
    horizon_days:Literal[1,5,20]
    order_id:int|None=Field(default=None,gt=0)

def journal_view(s:Session,z:Simulation,entry:JournalEntry,i:Instrument,as_of:date|None=None):
    # Only prices already revealed by this simulation may resolve a decision.
    future=s.scalars(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date>entry.decision_date,DailyPrice.date<=(as_of or z.current_date)).order_by(DailyPrice.date).limit(entry.horizon_days)).all()
    resolved=len(future)==entry.horizon_days
    final=future[-1] if resolved else None
    actual_direction=("Up" if final.close>entry.decision_close else "Down") if final else None
    model=json.loads(entry.model_snapshot_json) if entry.model_snapshot_json else None
    if model is not None:
        model["correct"]=model["predicted_direction"]==actual_direction if resolved else None
    return {"id":entry.id,"symbol":i.symbol,"reason":entry.reason,"predicted_direction":entry.predicted_direction,"horizon_days":entry.horizon_days,"decision_date":entry.decision_date,"decision_close":entry.decision_close,"target_date":final.date if final else None,"status":"resolved" if resolved else "pending","actual_close":final.close if final else None,"actual_return_pct":float((final.close/entry.decision_close-1)*100) if final else None,"actual_direction":actual_direction,"user_correct":entry.predicted_direction==actual_direction if resolved else None,"model_snapshot":model,"baseline_direction":entry.baseline_direction,"baseline_correct":entry.baseline_direction==actual_direction if resolved and entry.baseline_direction else None,"order_id":entry.order_id,"created_at":entry.created_at}

@app.post("/sessions/{sid}/journal",status_code=201)
def create_journal(sid:int,x:JournalIn,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    if not z.active: raise HTTPException(409,"Session has ended")
    i=s.scalar(select(Instrument).where(Instrument.symbol==x.symbol.upper(),Instrument.is_benchmark==False))
    if not i: raise HTTPException(404,"Stock not found")
    prices=s.scalars(select(DailyPrice).where(DailyPrice.instrument_id==i.id,DailyPrice.date<=z.current_date).order_by(DailyPrice.date)).all()
    if not prices or prices[-1].date!=z.current_date: raise HTTPException(422,"This stock has no closing price on the simulation date")
    if x.order_id is not None:
        linked=s.get(Order,x.order_id)
        if not linked or linked.simulation_id!=z.id or linked.instrument_id!=i.id or linked.submitted_date!=z.current_date:
            raise HTTPException(422,"Order must belong to this session, stock, and simulation date")
        if s.scalar(select(JournalEntry.id).where(JournalEntry.order_id==x.order_id)):
            raise HTTPException(409,"This order already has a journal entry")
    examples=ml.examples(prices) if x.horizon_days==1 else []
    known=[row.label for row in examples if row.label is not None]
    baseline=("Up" if sum(known)*2>=len(known) else "Down") if known else None
    if x.horizon_days==1: ensure_model(s,z,i,prices)
    run=s.scalar(select(ModelRun).where(ModelRun.simulation_id==z.id,ModelRun.instrument_id==i.id,ModelRun.version==ml.VERSION,ModelRun.trained_through<=z.current_date).order_by(ModelRun.trained_through.desc(),ModelRun.id.desc())) if x.horizon_days==1 else None
    snapshot=None
    if run and examples and examples[-1].date==z.current_date:
        probability=ml.predict(json.loads(run.artifact_json),examples[-1].features)
        metrics=json.loads(run.metrics_json)
        quality=model_quality(run,metrics)
        snapshot={"run_id":run.id,"trained_through":run.trained_through.isoformat(),"probability_up":probability,"predicted_direction":"Up" if probability>=.5 else "Down","quality":quality,"test_accuracy":metrics["accuracy"],"baseline_accuracy":metrics["baseline_accuracy"],"stale":run.trained_through<z.current_date}
    entry=JournalEntry(simulation_id=z.id,instrument_id=i.id,order_id=x.order_id,decision_date=z.current_date,decision_close=prices[-1].close,reason=x.reason.strip(),predicted_direction=x.predicted_direction,horizon_days=x.horizon_days,baseline_direction=baseline,model_snapshot_json=json.dumps(snapshot) if snapshot else None)
    if len(entry.reason)<8: raise HTTPException(422,"Reason must contain at least eight non-space characters")
    s.add(entry);s.commit();s.refresh(entry)
    return journal_view(s,z,entry,i)

@app.get("/sessions/{sid}/journal")
def list_journal(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    rows=s.execute(select(JournalEntry,Instrument).join(Instrument,JournalEntry.instrument_id==Instrument.id).where(JournalEntry.simulation_id==z.id).order_by(JournalEntry.id.desc())).all()
    return [journal_view(s,z,entry,i) for entry,i in rows]

class ChallengeIn(BaseModel):
    goal:Literal["protect_capital"]="protect_capital"

def challenge_view(s:Session,z:Simulation,c:Challenge|None):
    if c is None:
        return {"status":"not_started","goal":None,"start_date":None,"current_date":z.current_date,"duration_days":20,"elapsed_days":0,"days_remaining":20,"starting_equity":None,"current_equity":equity(s,z),"progress":{"researched":False,"predicted":False,"trained":False,"traded":False,"replayed":False},"debrief":None}
    # Count only dates already revealed by the simulation. No future price is read.
    elapsed=s.scalar(select(func.count(func.distinct(DailyPrice.date))).where(DailyPrice.date>c.start_date,DailyPrice.date<=z.current_date)) or 0
    cutoff=s.scalar(select(DailyPrice.date).where(DailyPrice.date>c.start_date,DailyPrice.date<=z.current_date).distinct().order_by(DailyPrice.date).offset(c.duration_days-1).limit(1)) if elapsed>=c.duration_days else None
    as_of=cutoff or z.current_date
    journal_filter=[JournalEntry.simulation_id==z.id,JournalEntry.decision_date>=c.start_date,JournalEntry.decision_date<=as_of]
    if c.completed_at: journal_filter.append(JournalEntry.created_at<=c.completed_at)
    journal_rows=s.execute(select(JournalEntry,Instrument).join(Instrument,JournalEntry.instrument_id==Instrument.id).where(*journal_filter).order_by(JournalEntry.id)).all()
    entries=[journal_view(s,z,entry,i,as_of=as_of) for entry,i in journal_rows]
    model_filter=[ModelRun.simulation_id==z.id,ModelRun.trained_through>=c.start_date,ModelRun.trained_through<=as_of]
    order_filter=[Order.simulation_id==z.id,Order.submitted_date>=c.start_date,Order.submitted_date<=as_of]
    if c.completed_at:
        model_filter.append(ModelRun.created_at<=c.completed_at)
        order_filter.append(Order.created_at<=c.completed_at)
    trained=bool(s.scalar(select(ModelRun.id).where(*model_filter).limit(1)))
    traded=bool(s.scalar(select(Order.id).where(*order_filter).limit(1)))
    # A written journal reason is the only research-like action currently tracked.
    progress={"researched":bool(entries),"predicted":bool(entries),"trained":trained,"traded":traded,"replayed":elapsed>0}
    current=equity(s,z)
    response={"status":"complete" if elapsed>=c.duration_days else "in_progress","goal":c.goal,"start_date":c.start_date,"current_date":z.current_date,"duration_days":c.duration_days,"elapsed_days":min(elapsed,c.duration_days),"days_remaining":max(0,c.duration_days-elapsed),"starting_equity":c.starting_equity,"current_equity":current,"progress":progress,"debrief":None}
    if elapsed<c.duration_days: return response

    resolved=[entry for entry in entries if entry["status"]=="resolved"]
    user_correct=sum(entry["user_correct"] is True for entry in resolved)
    comparable=[entry for entry in resolved if entry["horizon_days"]==1 and entry["model_snapshot"] is not None and entry["baseline_direction"] is not None]
    model_correct=sum(entry["model_snapshot"]["correct"] is True for entry in comparable)
    baseline_correct=sum(entry["baseline_correct"] is True for entry in comparable)
    # A benchmark return is a comparison, not a counterfactual trading profit.
    final_equity=s.scalar(select(Snapshot.equity).where(Snapshot.simulation_id==z.id,Snapshot.date==as_of))
    if final_equity is None: raise HTTPException(500,"Challenge cutoff snapshot is missing")
    benchmark=s.scalar(select(Instrument).where(Instrument.is_benchmark==True))
    benchmark_return=None
    if benchmark:
        first=bench_close(s,benchmark.id,c.start_date);last=bench_close(s,benchmark.id,as_of)
        if first and last: benchmark_return=float(Decimal(last)/Decimal(first)-1)
    snapshots=s.scalars(select(Snapshot).where(Snapshot.simulation_id==z.id,Snapshot.date>=c.start_date,Snapshot.date<=as_of).order_by(Snapshot.date)).all()
    peak=float(c.starting_equity);drawdown=0.0
    for row in snapshots:
        value=float(row.equity);peak=max(peak,value)
        if peak: drawdown=min(drawdown,value/peak-1)
    lessons=[]
    if not entries:
        lessons.append({"slug":"journal","title":"Record the reasoning","reason":"No prediction was recorded before the outcome. Write one next time so you can test your thinking."})
    if comparable and model_correct<=baseline_correct:
        lessons.append({"slug":"baseline","title":"Compare with a simple baseline","reason":"On your comparable one-day calls, the model did not beat the simple baseline."})
    if resolved and user_correct<len(resolved):
        lessons.append({"slug":"prediction","title":"Separate a good process from a lucky result","reason":"At least one recorded prediction was incorrect. Review the original reason against the revealed outcome."})
    traded_stock_ids=set(s.scalars(select(Order.instrument_id).join(Fill,Fill.order_id==Order.id).where(Order.simulation_id==z.id,Order.submitted_date>=c.start_date,Fill.date>=c.start_date,Fill.date<=as_of)).all())
    if len(traded_stock_ids)==1:
        lessons.append({"slug":"diversification","title":"Check concentration risk","reason":"The challenge's filled trades involved only one company. Review whether that suited your risk goal."})
    if not lessons:
        lessons.append({"slug":"prediction","title":"Review the decisions, not just the return","reason":"Compare each original prediction and its outcome before trying another challenge."})
    response["debrief"]={"end_date":as_of,"portfolio_return":float(Decimal(final_equity)/Decimal(c.starting_equity)-1),"benchmark_return":benchmark_return,"max_drawdown":drawdown,"journal":{"total":len(entries),"resolved":len(resolved),"correct":user_correct,"accuracy":user_correct/len(resolved) if resolved else None},"model":{"comparable":len(comparable),"correct":model_correct,"accuracy":model_correct/len(comparable) if comparable else None,"baseline_correct":baseline_correct,"baseline_accuracy":baseline_correct/len(comparable) if comparable else None},"lesson_recommendations":lessons}
    return response

@app.get("/sessions/{sid}/challenge")
def get_challenge(sid:int,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    c=s.scalar(select(Challenge).where(Challenge.simulation_id==z.id))
    return challenge_view(s,z,c)

@app.post("/sessions/{sid}/challenge",status_code=201)
def start_challenge(sid:int,x:ChallengeIn,u:User=Depends(user),s:Session=Depends(db)):
    z=sim_owned(s,sid,u)
    if not z.active: raise HTTPException(409,"Session has ended")
    if s.scalar(select(Challenge.id).where(Challenge.simulation_id==z.id)):
        raise HTTPException(409,"A challenge is already running in this simulation")
    future_dates=s.scalar(select(func.count(func.distinct(DailyPrice.date))).where(DailyPrice.date>z.current_date)) or 0
    if future_dates<20: raise HTTPException(422,"At least 20 imported trading days must remain after the start date")
    c=Challenge(simulation_id=z.id,goal=x.goal,start_date=z.current_date,duration_days=20,starting_equity=equity(s,z))
    s.add(c);s.commit()
    return challenge_view(s,z,c)
