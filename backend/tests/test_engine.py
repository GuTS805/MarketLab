from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.main import app, db
from app.models import Instrument, DailyPrice

eng=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=__import__("sqlalchemy").pool.StaticPool); TestSession=sessionmaker(eng,expire_on_commit=False); Base.metadata.create_all(eng)
def override():
    with TestSession() as s: yield s
app.dependency_overrides[db]=override; c=TestClient(app)
def setup_module(_):
    with TestSession() as s:
        i=Instrument(symbol="TEST",name="Test",sector="Tech"); s.add(i); s.flush()
        for d,o,h,l,cl in [(date(2020,1,1),100,105,95,101),(date(2020,1,2),110,115,90,100),(date(2020,1,3),120,125,115,122)]: s.add(DailyPrice(instrument_id=i.id,date=d,open=o,high=h,low=l,close=cl,adj_close=cl,volume=10,dividends=0,stock_splits=0))
        s.commit()
def auth(email="a@b.com"):
    r=c.post("/auth/register",json={"email":email,"password":"password1"}); return {"Authorization":"Bearer "+r.json()["access_token"]}
def test_next_day_market_average_cost_and_partial_sale():
    h=auth(); sid=c.post("/sessions",headers=h,json={"start_date":"2020-01-01"}).json()["id"]
    assert c.post(f"/sessions/{sid}/orders",headers=h,json={"symbol":"TEST","side":"buy","order_type":"market","quantity":10}).status_code==200
    c.post(f"/sessions/{sid}/advance",headers=h); p=c.get(f"/sessions/{sid}/portfolio",headers=h).json(); assert p["holdings"][0]["avg_cost"]==110
    c.post(f"/sessions/{sid}/orders",headers=h,json={"symbol":"TEST","side":"sell","order_type":"limit","quantity":4,"limit_price":120}); c.post(f"/sessions/{sid}/advance",headers=h)
    p=c.get(f"/sessions/{sid}/portfolio",headers=h).json(); assert p["holdings"][0]["quantity"]==6 and p["holdings"][0]["realized_pnl"]==40
def test_reservations_limits_isolation_and_future_leak():
    h=auth("c@d.com"); sid=c.post("/sessions",headers=h,json={"start_date":"2020-01-01","initial_cash":1000}).json()["id"]
    assert c.post(f"/sessions/{sid}/orders",headers=h,json={"symbol":"TEST","side":"buy","order_type":"limit","quantity":10,"limit_price":100}).status_code==200
    assert c.post(f"/sessions/{sid}/orders",headers=h,json={"symbol":"TEST","side":"buy","order_type":"limit","quantity":1,"limit_price":100}).status_code==409
    candles=c.get(f"/sessions/{sid}/market/TEST",headers=h).json()["prices"]; assert len(candles)==1
    other=auth("e@f.com"); assert c.get(f"/sessions/{sid}/portfolio",headers=other).status_code==404

def test_fees_reduce_cash_and_are_reported():
    h=auth("fee@x.com"); sid=c.post("/sessions",headers=h,json={"start_date":"2020-01-01","initial_cash":100000,"fees":True}).json()["id"]
    c.post(f"/sessions/{sid}/orders",headers=h,json={"symbol":"TEST","side":"buy","order_type":"market","quantity":10}); c.post(f"/sessions/{sid}/advance",headers=h)
    p=c.get(f"/sessions/{sid}/portfolio",headers=h).json()
    assert p["fees_paid"]>0 and Decimal(str(p["cash"]))==Decimal("100000")-Decimal("1100")-Decimal(str(p["fees_paid"]))
def test_no_fees_by_default():
    h=auth("nofee@x.com"); sid=c.post("/sessions",headers=h,json={"start_date":"2020-01-01"}).json()["id"]
    c.post(f"/sessions/{sid}/orders",headers=h,json={"symbol":"TEST","side":"buy","order_type":"market","quantity":10}); c.post(f"/sessions/{sid}/advance",headers=h)
    assert c.get(f"/sessions/{sid}/portfolio",headers=h).json()["fees_paid"]==0
def test_events_never_leak_future_and_leaderboard_masks_email():
    h=auth("lead@x.com"); sid=c.post("/sessions",headers=h,json={"start_date":"2020-01-01"}).json()["id"]
    assert all(e["date"]<="2020-01-01" for e in c.get(f"/sessions/{sid}/events",headers=h).json())
    c.post(f"/sessions/{sid}/advance",headers=h); lb=c.get("/leaderboard",headers=h).json()
    names=[e["player"] for g in lb for e in g["entries"]]; assert names and all("@" not in n and n.endswith("***") for n in names)
