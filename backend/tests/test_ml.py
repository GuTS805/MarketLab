from datetime import date, timedelta
from decimal import Decimal
from math import sin
from types import SimpleNamespace
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app, db, model_quality
from app.ml import MIN_SAMPLES, examples, train
from app.models import DailyPrice, Instrument, ModelRun


def history(count=240):
    start=date(2019,1,1)
    rows=[]
    for day in range(count):
        close=100+day*.12+3*sin(day/5)
        rows.append(SimpleNamespace(date=start+timedelta(days=day),open=close-.3,high=close+1.2,low=close-1.5,close=close,volume=10000+day*37+(day%9)*100,stock_splits=0))
    return rows


def test_features_and_labels_use_only_observed_rows():
    rows=history()
    before=examples(rows[:210])
    after=examples(rows)
    assert before[-1].date==rows[209].date and before[-1].label is None
    assert before[-2].label==int(rows[209].close>rows[208].close)
    assert before[-1].features==after[189].features
    assert len([x for x in before if x.label is not None])>=MIN_SAMPLES
    rows[100].stock_splits=2
    assert all(x.date!=rows[100].date for x in examples(rows))


def test_training_uses_chronological_holdout_and_is_repeatable():
    rows=history()
    first=train(rows)
    second=train(rows)
    assert first["metrics"]==second["metrics"]
    assert first["artifact"]==second["artifact"]
    assert first["train_count"]+first["test_count"]==first["sample_count"]
    assert first["train_count"]>first["test_count"]
    assert first["metrics"]["test_end"]==rows[-2].date.isoformat()
    assert first["artifact"]["labeled_through"]==rows[-2].date.isoformat()
    assert 0<=first["probability"]<=1
    assert sum(first["metrics"]["confusion"].values())==first["test_count"]
    folds=first["metrics"]["walk_forward"]
    assert len(folds)>=2
    for fold in folds:
        assert fold["train_end"]<fold["test_start"]<=fold["test_end"]
        assert fold["test_end"]<first["metrics"]["test_start"]
        assert fold["samples"]>0
        assert 0<=fold["accuracy"]<=1
        assert 0<=fold["baseline_accuracy"]<=1
    with pytest.raises(ValueError,match="trading days"):
        train(rows[:80])


def test_quality_requires_earlier_walk_forward_edge_too():
    run=SimpleNamespace(test_samples=40)
    metrics={"accuracy":.60,"baseline_accuracy":.50,"walk_forward_summary":{"accuracy":.49,"baseline_accuracy":.51}}
    assert model_quality(run,metrics)=="experimental"
    metrics["walk_forward_summary"]["accuracy"]=.56
    assert model_quality(run,metrics)=="above_baseline"
    del metrics["walk_forward_summary"]
    assert model_quality(run,metrics)=="experimental"


def test_api_training_is_idempotent_owned_and_cut_off():
    engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions=sessionmaker(engine,expire_on_commit=False)
    previous=app.dependency_overrides.get(db)
    def override():
        with sessions() as session: yield session
    app.dependency_overrides[db]=override
    try:
        rows=history()
        with sessions() as session:
            stock=Instrument(symbol="MODELTEST",name="Model Test",sector="Test")
            session.add(stock);session.flush()
            for row in rows:
                session.add(DailyPrice(instrument_id=stock.id,date=row.date,open=Decimal(str(row.open)),high=Decimal(str(row.high)),low=Decimal(str(row.low)),close=Decimal(str(row.close)),adj_close=None,volume=row.volume,dividends=0,stock_splits=0))
            session.commit()
        client=TestClient(app)
        token=client.post('/auth/register',json={'email':'model@college.edu','password':'password1'}).json()['access_token']
        header={'Authorization':f'Bearer {token}'}
        cutoff=rows[215].date
        sid=client.post('/sessions',headers=header,json={'start_date':cutoff.isoformat()}).json()['id']
        path=f'/sessions/{sid}/models/MODELTEST'
        discovered=client.get(f'/sessions/{sid}/models/signals',headers=header)
        assert discovered.status_code==200,discovered.text
        assert discovered.json()[0]['symbol']=='MODELTEST'
        automatic=client.get(path,headers=header)
        assert automatic.status_code==200,automatic.text
        assert automatic.json()['status']=='trained'
        assert automatic.json()['trained_through']==cutoff.isoformat()
        assert automatic.json()['decision_profile']=={'resolved':0,'correct':0,'accuracy':None,'up_calls':0,'up_correct':0,'down_calls':0,'down_correct':0,'status':'gathering_history'}
        response=client.post(path+'/train',headers=header)
        assert response.status_code==200,response.text
        trained=response.json()
        assert trained['trained_through']==cutoff.isoformat()
        assert trained['metrics']['test_end']<cutoff.isoformat()
        assert trained['sample_count']==len([x for x in examples(rows[:216]) if x.label is not None])
        assert client.post(path+'/train',headers=header).json()['run_id']==trained['run_id']
        history_response=client.get(path+'/runs',headers=header)
        assert history_response.status_code==200,history_response.text
        assert len(history_response.json())==1
        assert history_response.json()[0]['run_id']==trained['run_id']
        assert history_response.json()[0]['metrics']['walk_forward']
        signals=client.get(f'/sessions/{sid}/models/signals',headers=header)
        assert signals.status_code==200,signals.text
        assert len(signals.json())==1
        assert signals.json()[0]['symbol']=='MODELTEST'
        assert signals.json()[0]['probability_up']==trained['probability_up']
        assert signals.json()[0]['quality']==trained['quality']
        with sessions() as session:
            saved=session.scalars(select(ModelRun)).all()
            assert len(saved)==1
            assert json.loads(saved[0].artifact_json)['labeled_through']<cutoff.isoformat()
        other=client.post('/auth/register',json={'email':'other-model@college.edu','password':'password1'}).json()['access_token']
        assert client.get(path,headers={'Authorization':f'Bearer {other}'}).status_code==404
        assert client.get(path+'/runs',headers={'Authorization':f'Bearer {other}'}).status_code==404
        assert client.get(f'/sessions/{sid}/models/signals',headers={'Authorization':f'Bearer {other}'}).status_code==404
    finally:
        if previous is None: app.dependency_overrides.pop(db,None)
        else: app.dependency_overrides[db]=previous
