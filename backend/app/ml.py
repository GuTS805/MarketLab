"""Point-in-time next-day direction model for the historical simulator.

Only raw OHLCV rows dated on or before the session date enter this module.
Rows adjacent to a split are omitted because raw close-to-close returns are
not comparable across a split. No adjusted prices or future adjustment factors
are used. This is an educational classifier, not a trading signal.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Sequence
import numpy as np

VERSION="direction-logit-v2"
FEATURES=("1-day return","5-day return","10-day return","10-day volatility","day range","volume vs 20-day avg")
MIN_SAMPLES=160
EPOCHS=360
LEARNING_RATE=.08
L2=.025

@dataclass(frozen=True)
class Example:
    date: date
    features: tuple[float,...]
    label: int|None

def examples(prices:Sequence) -> list[Example]:
    """Features at t use rows <=t; a label needs the observed row at t+1."""
    result=[]
    for i in range(20,len(prices)):
        window=prices[i-20:i+1]
        if any(float(p.stock_splits or 0)!=0 for p in window): continue
        closes=np.asarray([float(p.close) for p in window],dtype=float)
        volumes=np.asarray([float(p.volume or 0) for p in window],dtype=float)
        if not np.all(np.isfinite(closes)) or np.any(closes<=0): continue
        daily=np.diff(closes)/closes[:-1]
        p=prices[i]
        feature=(
            float(closes[-1]/closes[-2]-1),
            float(closes[-1]/closes[-6]-1),
            float(closes[-1]/closes[-11]-1),
            float(np.std(daily[-10:])),
            float((float(p.high)-float(p.low))/float(p.close)),
            float(volumes[-1]/max(float(np.mean(volumes[:-1])),1)-1),
        )
        if not all(np.isfinite(feature)): continue
        next_row=prices[i+1] if i+1<len(prices) else None
        if next_row is not None and float(next_row.stock_splits or 0)!=0: continue
        label=int(float(next_row.close)>float(p.close)) if next_row is not None else None
        result.append(Example(p.date,feature,label))
    return result

def _sigmoid(z:np.ndarray)->np.ndarray:
    return 1/(1+np.exp(-np.clip(z,-30,30)))

def _fit(x:np.ndarray,y:np.ndarray)->tuple[dict,list[dict]]:
    mean=x.mean(axis=0);std=x.std(axis=0);std=np.where(std<1e-9,1,std)
    scaled=(x-mean)/std
    design=np.column_stack((np.ones(len(x)),scaled))
    weights=np.zeros(design.shape[1],dtype=float)
    curve=[]
    for epoch in range(EPOCHS):
        p=_sigmoid(design@weights)
        gradient=(design.T@(p-y))/len(y)
        gradient[1:]+=L2*weights[1:]
        weights-=LEARNING_RATE*gradient
        if epoch==0 or (epoch+1)%20==0:
            loss=-np.mean(y*np.log(np.clip(p,1e-9,1))+(1-y)*np.log(np.clip(1-p,1e-9,1)))+L2/2*np.sum(weights[1:]**2)
            curve.append({"epoch":epoch+1,"loss":round(float(loss),5)})
    return {"mean":mean.tolist(),"std":std.tolist(),"weights":weights.tolist(),"features":list(FEATURES),"version":VERSION},curve

def predict(artifact:dict,features:Sequence[float])->float:
    x=np.asarray(features,dtype=float)
    mean=np.asarray(artifact["mean"],dtype=float);std=np.asarray(artifact["std"],dtype=float)
    weights=np.asarray(artifact["weights"],dtype=float)
    if len(x)!=len(FEATURES) or not np.all(np.isfinite(x)) or len(weights)!=len(FEATURES)+1:
        raise ValueError("Model features or artifact are invalid")
    return float(_sigmoid(np.asarray([weights[0]+np.dot((x-mean)/std,weights[1:])]))[0])

def train(prices:Sequence)->dict:
    rows=examples(prices)
    labeled=[row for row in rows if row.label is not None]
    if len(labeled)<MIN_SAMPLES or not rows or rows[-1].date!=prices[-1].date:
        raise ValueError(f"At least {MIN_SAMPLES+21} trading days of valid history are needed before training")
    cutoff=int(len(labeled)*.8)
    x=np.asarray([row.features for row in labeled],dtype=float)
    y=np.asarray([row.label for row in labeled],dtype=float)
    evaluation_model,curve=_fit(x[:cutoff],y[:cutoff])
    probabilities=np.asarray([predict(evaluation_model,row.features) for row in labeled[cutoff:]])
    actual=y[cutoff:].astype(int);predicted=(probabilities>=.5).astype(int)
    majority=int(np.mean(y[:cutoff])>=.5)
    tp=int(np.sum((predicted==1)&(actual==1)));tn=int(np.sum((predicted==0)&(actual==0)))
    fp=int(np.sum((predicted==1)&(actual==0)));fn=int(np.sum((predicted==0)&(actual==1)))
    accuracy=float(np.mean(predicted==actual));baseline=float(np.mean(actual==majority))
    metrics={"accuracy":accuracy,"baseline_accuracy":baseline,"precision":tp/(tp+fp) if tp+fp else None,"recall":tp/(tp+fn) if tp+fn else None,"brier_score":float(np.mean((probabilities-actual)**2)),"confusion":{"true_up":tp,"true_down":tn,"false_up":fp,"false_down":fn},"test_start":labeled[cutoff].date.isoformat(),"test_end":labeled[-1].date.isoformat(),"learning_curve":curve}
    # Earlier expanding-window checks are independent of the final 20% holdout.
    # Every fold fits only on rows preceding its test window.
    boundaries=[int(cutoff*f) for f in (.625,.75,.875,1.0)]
    folds=[]
    for start,end in zip(boundaries,boundaries[1:]):
        if end<=start: continue
        fold_model,_=_fit(x[:start],y[:start])
        fold_prob=np.asarray([predict(fold_model,row.features) for row in labeled[start:end]])
        truth=y[start:end].astype(int)
        guesses=(fold_prob>=.5).astype(int)
        fold_majority=int(np.mean(y[:start])>=.5)
        folds.append({"train_end":labeled[start-1].date.isoformat(),"test_start":labeled[start].date.isoformat(),"test_end":labeled[end-1].date.isoformat(),"train_samples":start,"samples":end-start,"accuracy":float(np.mean(guesses==truth)),"baseline_accuracy":float(np.mean(truth==fold_majority)),"brier_score":float(np.mean((fold_prob-truth)**2))})
    metrics["walk_forward"]=folds
    metrics["walk_forward_summary"]={"folds":len(folds),"samples":sum(f["samples"] for f in folds),"accuracy":sum(f["accuracy"]*f["samples"] for f in folds)/sum(f["samples"] for f in folds),"baseline_accuracy":sum(f["baseline_accuracy"]*f["samples"] for f in folds)/sum(f["samples"] for f in folds)}
    holdout=[{"date":row.date.isoformat(),"probability":round(float(prob),4),"actual":int(truth),"correct":bool(guess==truth)} for row,prob,truth,guess in zip(labeled[cutoff:],probabilities,actual,predicted)]
    final_artifact,_=_fit(x,y)
    final_artifact.update({"trained_through":prices[-1].date.isoformat(),"labeled_through":labeled[-1].date.isoformat(),"rows":len(labeled)})
    return {"artifact":final_artifact,"metrics":metrics,"holdout":holdout,"sample_count":len(labeled),"train_count":cutoff,"test_count":len(labeled)-cutoff,"probability":predict(final_artifact,rows[-1].features)}
