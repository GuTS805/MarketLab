from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app, db
from app.models import DailyPrice, Instrument, Challenge, JournalEntry


def test_challenge_is_owned_and_debrief_only_after_replay():
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
            stock=Instrument(symbol="CHALLENGE",name="Challenge Test",sector="Test")
            bench=Instrument(symbol="NIFTY50",name="Benchmark",sector="Index",is_benchmark=True)
            session.add_all([stock,bench]);session.flush()
            for day in range(35):
                d=first+timedelta(days=day)
                for instrument,close in ((stock,Decimal(100+day)),(bench,Decimal(100+day//2))):
                    session.add(DailyPrice(instrument_id=instrument.id,date=d,open=close,high=close+1,low=close-1,close=close,volume=10000,dividends=0,stock_splits=0))
            session.commit()
        client=TestClient(app)
        def auth(email):
            token=client.post("/auth/register",json={"email":email,"password":"password1"}).json()["access_token"]
            return {"Authorization":f"Bearer {token}"}
        alice=auth("challenge-a@example.com");bob=auth("challenge-b@example.com")
        sid=client.post("/sessions",headers=alice,json={"start_date":first.isoformat()}).json()["id"]
        path=f"/sessions/{sid}/challenge"
        assert client.get(path,headers=alice).json()["status"]=="not_started"
        assert client.get(path,headers=bob).status_code==404
        started=client.post(path,headers=alice,json={"goal":"protect_capital"})
        assert started.status_code==201,started.text
        assert started.json()["status"]=="in_progress"
        assert started.json()["starting_equity"]==100000
        assert started.json()["debrief"] is None
        assert client.post(path,headers=alice,json={"goal":"protect_capital"}).status_code==409
        assert client.post(path,headers=bob,json={"goal":"protect_capital"}).status_code==404
        late_sid=client.post("/sessions",headers=alice,json={"start_date":(first+timedelta(days=20)).isoformat()}).json()["id"]
        assert client.post(f"/sessions/{late_sid}/challenge",headers=alice,json={"goal":"protect_capital"}).status_code==422
        entry=client.post(f"/sessions/{sid}/journal",headers=alice,json={"symbol":"CHALLENGE","reason":"I expect an upward move","predicted_direction":"Up","horizon_days":1})
        assert entry.status_code==201,entry.text
        client.post(f"/sessions/{sid}/advance?days=19",headers=alice)
        pending=client.get(path,headers=alice).json()
        assert pending["elapsed_days"]==19 and pending["days_remaining"]==1
        assert pending["debrief"] is None
        assert pending["progress"]["predicted"] and pending["progress"]["replayed"]
        client.post(f"/sessions/{sid}/advance?days=1",headers=alice)
        done=client.get(path,headers=alice).json()
        assert done["status"]=="complete"
        assert done["days_remaining"]==0
        assert done["debrief"]["journal"]["resolved"]==1
        assert done["debrief"]["journal"]["correct"]==1
        assert done["debrief"]["portfolio_return"]==0
        assert done["debrief"]["benchmark_return"]>0
        assert done["debrief"]["lesson_recommendations"]
        frozen=done["debrief"]
        late=client.post(f"/sessions/{sid}/journal",headers=alice,json={"symbol":"CHALLENGE","reason":"This is after the challenge","predicted_direction":"Down","horizon_days":1})
        assert late.status_code==201,late.text
        with sessions() as session:
            completed=session.query(Challenge).filter_by(simulation_id=sid).one().completed_at
            created=session.query(JournalEntry).filter_by(id=late.json()["id"]).one().created_at
            assert completed is not None and created>completed,(completed,created)
        order=client.post(f"/sessions/{sid}/orders",headers=alice,json={"symbol":"CHALLENGE","side":"buy","order_type":"market","quantity":1})
        assert order.status_code==200,order.text
        client.post(f"/sessions/{sid}/advance?days=2",headers=alice)
        later=client.get(path,headers=alice).json()
        assert later["current_date"]!=done["current_date"]
        assert later["debrief"]==frozen
        pretrade_sid=client.post("/sessions",headers=alice,json={"start_date":first.isoformat()}).json()["id"]
        pretrade=client.post(f"/sessions/{pretrade_sid}/orders",headers=alice,json={"symbol":"CHALLENGE","side":"buy","order_type":"market","quantity":1})
        assert pretrade.status_code==200,pretrade.text
        client.post(f"/sessions/{pretrade_sid}/advance?days=1",headers=alice)
        assert client.post(f"/sessions/{pretrade_sid}/challenge",headers=alice,json={"goal":"protect_capital"}).status_code==201
        client.post(f"/sessions/{pretrade_sid}/advance?days=20",headers=alice)
        pretrade_debrief=client.get(f"/sessions/{pretrade_sid}/challenge",headers=alice).json()["debrief"]
        assert "diversification" not in [lesson["slug"] for lesson in pretrade_debrief["lesson_recommendations"]]
    finally:
        if previous is None: app.dependency_overrides.pop(db,None)
        else: app.dependency_overrides[db]=previous
