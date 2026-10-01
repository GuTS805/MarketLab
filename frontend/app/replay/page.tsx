'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ChevronsRight,FastForward,Flag,Receipt} from 'lucide-react';
import Shell from '../../components/Shell';
import OrderTicket from '../../components/OrderTicket';
import {PriceChart} from '../../components/MarketCharts';
import {Empty,ErrorBanner,PageHeader,PageSkeleton,SideBadge,StatusBadge} from '../../components/ui';
import {api,dateLabel,inr} from '../../lib/api';
import {useSessionData} from '../../lib/hooks';

export default function Replay(){
  const {session,data,error,setError,reload}=useSessionData(async s=>{
    const [market,orders,portfolio]=await Promise.all([api(`/sessions/${s.id}/market`),api(`/sessions/${s.id}/orders`),api(`/sessions/${s.id}/portfolio`)]);
    return {market,orders,portfolio};
  });
  const [symbol,setSymbol]=useState(''),[busy,setBusy]=useState(false),[flash,setFlash]=useState(''),[chartPrices,setChartPrices]=useState<any[]>([]),[chartLoading,setChartLoading]=useState(false);
  const selected=symbol||data?.market?.[0]?.symbol||'';
  useEffect(()=>{
    if(!session||!selected)return;
    let cancelled=false;setChartLoading(true);
    const from=new Date(`${session.current_date}T12:00:00Z`);from.setUTCDate(from.getUTCDate()-120);
    api(`/sessions/${session.id}/market/${selected}?from_date=${from.toISOString().slice(0,10)}`).then(result=>{if(!cancelled)setChartPrices(result.prices||[])}).catch(()=>{if(!cancelled)setChartPrices([])}).finally(()=>{if(!cancelled)setChartLoading(false)});
    return()=>{cancelled=true};
  },[session?.id,session?.current_date,selected]);
  async function act(path:string,options:RequestInit={},message=''){setBusy(true);setError('');setFlash('');try{const r=await api(path,options);if(message)setFlash(typeof r?.days==='number'?`Advanced ${r.days} trading day${r.days>1?'s':''} to ${dateLabel(r.date)}.`:message);await reload()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const {market,orders,portfolio}=data,current=selected,held=Object.fromEntries(portfolio.holdings.map((h:any)=>[h.symbol,h.quantity]));
  const pending=orders.filter((o:any)=>o.status==='pending').length,adv=(n:number)=>act(`/sessions/${session.id}/advance?days=${n}`,{method:'POST'},'Advanced.');
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Trade & Replay" title="Advance the market" sub="Orders placed today become eligible on the next imported trading day. Daily OHLC cannot reproduce the exact intraday path."/>
    <ErrorBanner message={error}/>
    {flash&&<div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{flash}</div>}
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div className="card"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="label">Current date</p><p className="num mt-1 text-3xl font-extrabold">{dateLabel(session.current_date)}</p><p className="mt-1 text-xs text-slate-400">{pending} pending order{pending===1?'':'s'}</p></div>
          {session.active?<div className="flex flex-wrap gap-2"><button className="btn" disabled={busy} onClick={()=>adv(1)}><ChevronsRight size={16}/> Next day</button><button className="btn-ghost" disabled={busy} onClick={()=>adv(5)}><FastForward size={16}/> +5 days</button><button className="btn-ghost" disabled={busy} onClick={()=>adv(20)}><FastForward size={16}/> +20 days</button><button className="btn-ghost !text-red-600" disabled={busy} onClick={()=>{if(confirm('End this session? You will no longer be able to trade or advance.'))void act(`/sessions/${session.id}/end`,{method:'POST'},'Session ended.')}}><Flag size={16}/> End</button></div>
            :<Link href="/results" className="btn">See results →</Link>}</div></div>
        <div><div className="mb-3 flex items-center justify-between gap-3"><div><p className="label">Replay chart</p><h2 className="text-xl font-extrabold">{current||'Choose a stock'}</h2></div><Link href={`/stock/${current}`} className="text-xs font-bold text-teal">Full stock view →</Link></div>{chartLoading?<div className="chart-stage skeleton h-[360px]"/>:<PriceChart data={chartPrices} height={310}/>}</div>
        <div className="card"><h2 className="mb-4 text-lg font-bold">Order activity</h2>
          {orders.length?<div className="space-y-2">{orders.map((o:any)=><div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-semibold"><SideBadge side={o.side}/>{o.quantity} × {o.symbol}<StatusBadge status={o.status}/></p><p className="mt-1 text-xs text-slate-400">{o.order_type==='limit'?`Limit ${inr(o.limit_price)}`:'Market'} · placed {dateLabel(o.submitted_date)}{o.fill_price?` · filled ${inr(o.fill_price)} on ${dateLabel(o.fill_date)}`:''}</p></div>
            {o.status==='pending'&&<button className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50" onClick={()=>act(`/sessions/${session.id}/orders/${o.id}`,{method:'DELETE'},'Order cancelled.')}>Cancel</button>}</div>)}</div>
            :<Empty icon={<Receipt/>} title="No orders yet" text="Use the ticket to place a buy, then click Next day to see it fill at the next open."/>}</div>
      </div>
      <OrderTicket session={session} market={market} cash={portfolio.cash} held={held} symbol={current} onSymbol={setSymbol} onDone={reload}/>
    </div>
  </Shell>;
}
