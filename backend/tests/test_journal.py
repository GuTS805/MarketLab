from datetime import date, timedelta
from decimal import Decimal
from math import sin

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app, db
from app.models import DailyPrice, Instrument


def test_journal_snapshots_and_reveals_only_after_horizon():
    engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions=sessionmaker(engine,expire_on_commit=False)
    previous=app.dependency_overrides.get(db)
    def override():
        with sessions() as session: yield session
    app.dependency_overrides[db]=override
    try:
        first=date(2020,1,1)
        with sessions() as session:
            stock=Instrument(symbol="JOURNAL",name="Journal Test",sector="Test")
            session.add(stock);session.flush()
            for day in range(230):
                close=Decimal(str(100+day*.12+3*sin(day/5)))
                session.add(DailyPrice(instrument_id=stock.id,date=first+timedelta(days=day),open=close,high=close+1,low=close-1,close=close,volume=10000+day*37,dividends=0,stock_splits=0))
            session.commit()
        client=TestClient(app)
        alice=client.post("/auth/register",json={"email":"journal-a@example.com","password":"password1"}).json()["access_token"]
        bob=client.post("/auth/register",json={"email":"journal-b@example.com","password":"password1"}).json()["access_token"]
        auth={"Authorization":f"Bearer {alice}"}
        other={"Authorization":f"Bearer {bob}"}
        sid=client.post("/sessions",headers=auth,json={"start_date":(first+timedelta(days=215)).isoformat()}).json()["id"]
        model=client.post(f"/sessions/{sid}/models/JOURNAL/train",headers=auth)
        assert model.status_code==200,model.text
        body={"symbol":"JOURNAL","reason":"Recent trend may continue","predicted_direction":"Up","horizon_days":5}
        created=client.post(f"/sessions/{sid}/journal",headers=auth,json=body)
        assert created.status_code==201,created.text
        entry=created.json()
        assert entry["status"]=="pending" and entry["target_date"] is None
        assert entry["actual_close"] is None and entry["user_correct"] is None
        assert entry["model_snapshot"] is None and entry["baseline_direction"] is None
        next_day=client.post(f"/sessions/{sid}/journal",headers=auth,json={**body,"horizon_days":1}).json()
        assert next_day["model_snapshot"]["run_id"]==model.json()["run_id"]
        assert next_day["baseline_direction"] in ("Up","Down")
        long_horizon=client.post(f"/sessions/{sid}/journal",headers=auth,json={**body,"horizon_days":20}).json()
        assert long_horizon["model_snapshot"] is None and long_horizon["baseline_direction"] is None
        assert client.get(f"/sessions/{sid}/journal",headers=other).status_code==404
        assert client.post(f"/sessions/{sid}/journal",headers=other,json=body).status_code==404
        assert client.post(f"/sessions/{sid}/journal",headers=auth,json={**body,"horizon_days":3}).status_code==422
        assert client.post(f"/sessions/{sid}/journal",headers=auth,json={**body,"reason":"  no  "}).status_code==422
        assert client.post(f"/sessions/{sid}/journal",headers=auth,json={**body,"order_id":999}).status_code==422
        client.post(f"/sessions/{sid}/advance?days=4",headers=auth)
        pending=next(row for row in client.get(f"/sessions/{sid}/journal",headers=auth).json() if row["id"]==entry["id"])
        assert pending["status"]=="pending" and pending["actual_direction"] is None
        client.post(f"/sessions/{sid}/advance?days=1",headers=auth)
        entries=client.get(f"/sessions/{sid}/journal",headers=auth).json()
        resolved=next(row for row in entries if row["id"]==entry["id"])
        assert resolved["status"]=="resolved"
        assert resolved["target_date"]==(first+timedelta(days=220)).isoformat()
        assert resolved["actual_direction"] in ("Up","Down")
        assert resolved["user_correct"]==(resolved["predicted_direction"]==resolved["actual_direction"])
        assert resolved["model_snapshot"] is None and resolved["baseline_correct"] is None
        scored=next(row for row in entries if row["id"]==next_day["id"])
        assert scored["status"]=="resolved"
        assert scored["model_snapshot"]["probability_up"]==next_day["model_snapshot"]["probability_up"]
        assert scored["model_snapshot"]["correct"]==(scored["model_snapshot"]["predicted_direction"]==scored["actual_direction"])
        profile=client.get(f"/sessions/{sid}/models/JOURNAL",headers=auth).json()["decision_profile"]
        assert profile["resolved"]==1
        assert profile["correct"]==int(scored["user_correct"])
        assert profile["up_calls"]==1
    finally:
        if previous is None: app.dependency_overrides.pop(db,None)
        else: app.dependency_overrides[db]=previous
