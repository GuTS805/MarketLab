'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,inr} from '../lib/api';
import {estimateFee} from '../lib/fees';
import {ModelSignal,signalPct,signalCaution} from '../lib/model';

type Props={session:any;market:{symbol:string;close:number|string}[];cash:number|string;held?:Record<string,number>;symbol:string;onSymbol?:(s:string)=>void;onDone:()=>void};
export default function OrderTicket({session,market,cash,held={},symbol,onSymbol,onDone}:Props){
  const [side,setSide]=useState<'buy'|'sell'>('buy'),[type,setType]=useState<'market'|'limit'>('market'),[qty,setQty]=useState(1),[limit,setLimit]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [record,setRecord]=useState(false),[reason,setReason]=useState(''),[horizon,setHorizon]=useState<1|5|20>(5),[direction,setDirection]=useState<'Up'|'Down'>('Up');
  const [model,setModel]=useState<ModelSignal|null>(null),[modelLoading,setModelLoading]=useState(false);
  useEffect(()=>{let live=true;setModel(null);if(!symbol)return;setModelLoading(true);api(`/sessions/${session.id}/models/${symbol}`).then((result:any)=>{if(live)setModel(result.status==='trained'?result:null)}).catch(()=>{if(live)setModel(null)}).finally(()=>{if(live)setModelLoading(false)});return()=>{live=false}},[session.id,session.current_date,symbol]);
  const px=Number(market.find(m=>m.symbol===symbol)?.close||0),unit=type==='limit'?Number(limit)||0:px,est=unit*qty,owned=held[symbol]||0;
  const fees=estimateFee(side,est,!!session.fees_enabled),short=side==='buy'?est+fees>Number(cash):qty>owned;
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const order=await api(`/sessions/${session.id}/orders`,{method:'POST',body:JSON.stringify({symbol,side,order_type:type,quantity:qty,limit_price:type==='limit'?Number(limit):null})});
      if(record){try{await api(`/sessions/${session.id}/journal`,{method:'POST',body:JSON.stringify({symbol,reason:reason.trim(),predicted_direction:direction,horizon_days:horizon,order_id:order.id})});setReason('');setNotice(`${side==='buy'?'Buy':'Sell'} ${qty} ${symbol} queued and decision saved.`)}catch(journalError:any){setNotice(`Order queued, but journal entry could not be saved: ${journalError.message}`)}}else setNotice(`${side==='buy'?'Buy':'Sell'} ${qty} ${symbol} queued. It fills on the next trading day.`);onDone();
    }catch(x:any){setError(x.message)}finally{setBusy(false)}
  }
  return <form className="card h-fit" onSubmit={submit}>
    <h2 className="text-lg font-bold">Order ticket</h2><p className="mb-4 text-xs text-slate-400">Executes on the next trading day, never the same day.</p>
    {onSymbol?<label className="block"><span className="label">Instrument</span><select className="input mt-1" value={symbol} onChange={e=>onSymbol(e.target.value)}>{market.map(m=><option key={m.symbol} value={m.symbol}>{m.symbol} · {inr(m.close)}</option>)}</select></label>
      :<div className="flex items-baseline justify-between"><span className="font-bold">{symbol}</span><span className="num text-sm text-slate-500">Last {inr(px)}</span></div>}
    <div className="my-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">{(['buy','sell'] as const).map(s=><button key={s} type="button" onClick={()=>setSide(s)} className={`rounded-lg py-2 text-sm font-bold capitalize transition ${side===s?(s==='buy'?'bg-accent text-white shadow':'bg-red-600 text-white shadow'):'text-slate-500'}`}>{s}</button>)}</div>
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-bold text-indigo-950">Historical signal</span><Link href={`/model-lab?symbol=${symbol}`} className="font-semibold text-indigo-700 hover:underline">View evidence</Link></div>{model?<><p className="mt-2 font-semibold text-indigo-950">{model.predicted_direction} · {signalPct(model)} probability of up</p><p className="mt-1 text-indigo-700">{signalCaution(model)}. Holdout accuracy {(model.metrics.accuracy*100).toFixed(0)}% vs baseline {(model.metrics.baseline_accuracy*100).toFixed(0)}%.</p>{!model.stale&&model.quality==='above_baseline'&&((side==='buy'&&model.predicted_direction==='Down')||(side==='sell'&&model.predicted_direction==='Up'))&&<p className="mt-2 font-bold text-amber-800">This signal conflicts with your {side} order. Review your reason before submitting.</p>}</>:<p className="mt-2 text-indigo-700">{modelLoading?'Preparing signal…':'Not enough historical data for a model yet.'}</p>}{model?.decision_profile&&<p className="mt-2 border-t border-indigo-100 pt-2 text-indigo-900">Your history: {side==='buy'?(model.decision_profile.up_calls?`${model.decision_profile.up_correct}/${model.decision_profile.up_calls} previous Up calls correct`:'No resolved Up calls yet'):(model.decision_profile.down_calls?`${model.decision_profile.down_correct}/${model.decision_profile.down_calls} previous Down calls correct`:'No resolved Down calls yet')}.</p>}</div>
    <label className="block"><span className="label">Order type</span><select className="input mt-1" value={type} onChange={e=>setType(e.target.value as 'market'|'limit')}><option value="market">Market · next open</option><option value="limit">Limit price</option></select></label>
    {type==='limit'&&<label className="mt-3 block"><span className="label">Limit price (₹)</span><input className="input mt-1" type="number" min="0.01" step="0.01" required value={limit} placeholder={px?px.toFixed(2):''} onChange={e=>setLimit(e.target.value)}/></label>}
    <label className="mt-3 block"><span className="label">Quantity</span><input className="input mt-1" type="number" min="1" step="1" required value={qty} onChange={e=>setQty(Math.max(1,Math.floor(+e.target.value||1)))}/></label>
    <dl className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex justify-between"><dt className="text-slate-500">Estimated value</dt><dd className="num font-bold">{inr(est)}</dd></div>
      {session.fees_enabled&&<div className="flex justify-between"><dt className="text-slate-500">Est. charges (STT, stamp, GST…)</dt><dd className="num font-semibold">{inr(fees)}</dd></div>}
      <div className="flex justify-between"><dt className="text-slate-500">Available cash</dt><dd className="num font-semibold">{inr(cash)}</dd></div>
      <div className="flex justify-between"><dt className="text-slate-500">You hold</dt><dd className="num font-semibold">{owned} sh</dd></div>
    </dl>
    <div className="mt-4 rounded-xl border border-accent-100 bg-accent-50 p-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-accent-900"><input type="checkbox" checked={record} onChange={e=>{setRecord(e.target.checked);if(e.target.checked)setDirection(side==='buy'?'Up':'Down')}}/> Record why I made this trade</label>{record&&<div className="mt-3 space-y-3"><label className="block text-xs font-semibold text-slate-600">My reason<textarea className="input mt-1 min-h-20" value={reason} onChange={e=>setReason(e.target.value)} required minLength={10} maxLength={1000} placeholder="What do I expect, and why?"/></label><div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-600">I expect<select className="input mt-1" value={direction} onChange={e=>setDirection(e.target.value as 'Up'|'Down')}><option value="Up">Price up</option><option value="Down">Price down</option></select></label><label className="text-xs font-semibold text-slate-600">Check after<select className="input mt-1" value={horizon} onChange={e=>setHorizon(Number(e.target.value) as 1|5|20)}><option value={1}>1 trading day</option><option value={5}>5 trading days</option><option value={20}>20 trading days</option></select></label></div><p className="text-xs text-accent-700">Your call and the model&apos;s current signal will be saved before the market advances.</p></div>}</div>
    {short&&<p className="mt-3 text-xs font-medium text-amber-700">{side==='buy'?'Estimate exceeds your available cash.':'You do not hold enough shares.'}</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {notice&&<p className="mt-3 text-sm font-medium text-accent-700">{notice}</p>}
    <button className={`btn mt-4 w-full ${side==='sell'?'!bg-red-600 hover:!bg-red-700':''}`} disabled={busy||!session.active||!symbol}>{session.active?(busy?'Submitting…':`Place ${side} order`):'Session ended'}</button>
  </form>;
}
