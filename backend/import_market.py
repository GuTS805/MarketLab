"""Reproducible selective importer for the required Hugging Face dataset."""
import argparse, json
from datetime import datetime
from pathlib import Path
import pandas as pd
from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import Instrument, DailyPrice, ImportRun

REPO="vishnun0027/indian-market-historical-ohlcv"
REVISION="fe783082c7ec68847ecd0d0b4e1ca06364507e5f"
SYMBOLS={"RELIANCE":("Reliance Industries","Energy"),"TCS":("Tata Consultancy Services","IT"),"INFY":("Infosys","IT"),"HDFCBANK":("HDFC Bank","Financials"),"ICICIBANK":("ICICI Bank","Financials"),"SBIN":("State Bank of India","Financials"),"HINDUNILVR":("Hindustan Unilever","Consumer"),"ITC":("ITC","Consumer"),"MARUTI":("Maruti Suzuki","Automobile"),"SUNPHARMA":("Sun Pharma","Healthcare"),"TATASTEEL":("Tata Steel","Materials"),"BHARTIARTL":("Bharti Airtel","Telecom")}
BENCHMARK="NIFTY_50"
COLS=["date","open","high","low","close","adj_close","volume","dividends","stock_splits","symbol"]
def validate(df,name):
    missing=[c for c in COLS if c not in df.columns]; dup=int(df.duplicated("date").sum()) if "date" in df else 0
    nulls=int(df[COLS].isna().sum().sum()) if not missing else -1
    bad=int(( (df.high<df.low)|(df.open>df.high)|(df.open<df.low)|(df.close>df.high)|(df.close<df.low) ).sum()) if not missing else -1
    if missing or dup or nulls or bad: raise ValueError(f"{name}: missing={missing}, duplicates={dup}, nulls={nulls}, invalid_ohlc={bad}")
    return {"rows":len(df),"duplicates":dup,"missing":nulls,"invalid_ohlc":bad,"corporate_action_rows":int(((df.dividends!=0)|(df.stock_splits!=0)).sum())}
def read(path,kind,name,revision):
    if path: return pd.read_parquet(Path(path)/kind/f"{name}.parquet")
    return pd.read_parquet(f"https://huggingface.co/datasets/{REPO}/resolve/{revision}/{kind}/{name}.parquet")
def run(local=None,start="2019-01-01",end="2021-12-31",revision=REVISION):
    Base.metadata.create_all(engine); report={}; coverage=[]
    with SessionLocal() as s:
        for symbol,(name,sector) in {**SYMBOLS,BENCHMARK:("NIFTY 50","Benchmark")}.items():
            kind="indices" if symbol==BENCHMARK else "stocks"; df=read(local,kind,symbol,revision); df["date"]=pd.to_datetime(df.date).dt.date; df=df[(df.date>=pd.Timestamp(start).date())&(df.date<=pd.Timestamp(end).date())].copy(); report[symbol]=validate(df,symbol)
            if len(df)<500: raise ValueError(f"{symbol}: inadequate coverage ({len(df)} rows)")
            inst=s.scalar(select(Instrument).where(Instrument.symbol==symbol)) or Instrument(symbol=symbol,name=name,sector=sector,is_benchmark=symbol==BENCHMARK); s.add(inst); s.flush()
            for r in df.itertuples():
                old=s.scalar(select(DailyPrice).where(DailyPrice.instrument_id==inst.id,DailyPrice.date==r.date))
                values=dict(open=r.open,high=r.high,low=r.low,close=r.close,adj_close=r.adj_close,volume=int(r.volume),dividends=r.dividends,stock_splits=r.stock_splits)
                if old:
                    for k,v in values.items(): setattr(old,k,v)
                else: s.add(DailyPrice(instrument_id=inst.id,date=r.date,**values))
            coverage.extend(df.date.tolist())
        s.add(ImportRun(source_url=f"https://huggingface.co/datasets/{REPO}",revision=revision,symbols=",".join([*SYMBOLS,BENCHMARK]),coverage=f"{min(coverage)}..{max(coverage)}",validation_json=json.dumps(report))); s.commit()
    print(json.dumps({"revision":revision,"coverage":[str(min(coverage)),str(max(coverage))],"validation":report},indent=2))
if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("--local",help="dataset checkout containing stocks/ and indices/"); p.add_argument("--start",default="2019-01-01"); p.add_argument("--end",default="2021-12-31"); p.add_argument("--revision",default=REVISION); a=p.parse_args(); run(a.local,a.start,a.end,a.revision)
