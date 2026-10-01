'use client';
import {useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Star} from 'lucide-react';
import Shell from '../../../components/Shell';
import OrderTicket from '../../../components/OrderTicket';
import {PriceChart} from '../../../components/MarketCharts';
import {Delta,ErrorBanner,PageSkeleton} from '../../../components/ui';
import {api,inr} from '../../../lib/api';
import {useSessionData} from '../../../lib/hooks';

const ranges=[[30,'1M'],[90,'3M'],[180,'6M'],[365,'1Y']] as const;
export default function Stock(){
  const {symbol}=useParams<{symbol:string}>(),router=useRouter(),[range,setRange]=useState(180);
  const {session,data,error,setError,reload}=useSessionData(async s=>{
    const from=new Date(s.current_date);from.setDate(from.getDate()-range);
    const [stock,market,portfolio,model]=await Promise.all([api(`/sessions/${s.id}/market/${symbol}?from_date=${from.toISOString().slice(0,10)}`),api(`/sessions/${s.id}/market`),api(`/sessions/${s.id}/portfolio`),api(`/sessions/${s.id}/models/${symbol}`).catch(()=>null)]);
    return {stock,market,portfolio,model};
  },[symbol,range]);
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const {stock,market,portfolio,model}=data,prices=stock.prices;
  if(!prices.length)return <Shell date={session.current_date} session={session}><p className="card">No price history is available for {symbol} on this date yet.</p></Shell>;
  const last=prices[prices.length-1],first=prices[0],prev=prices[prices.length-2],change=(Number(last.close)/Number(first.close)-1)*100,day=prev?(Number(last.close)/Number(prev.close)-1)*100:null;
  const held=Object.fromEntries(portfolio.holdings.map((h:any)=>[h.symbol,h.quantity])),pos=portfolio.holdings.find((h:any)=>h.symbol===stock.instrument.symbol);
  const hi=Math.max(...prices.map((p:any)=>Number(p.high))),lo=Math.min(...prices.map((p:any)=>Number(p.low)));
  const toggle=async()=>{try{await api(`/watchlist/${symbol}`,{method:'POST'});await reload()}catch(e:any){setError(e.message)}};
  return <Shell date={session.current_date} session={session}>
    <button onClick={()=>router.back()} className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-navy"><ArrowLeft size={16}/> Back</button>
    <ErrorBanner message={error}/>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">{stock.instrument.sector||'NSE equity'}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{stock.instrument.symbol} <span className="text-lg font-medium text-slate-400">{stock.instrument.name}</span></h1>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3"><span className="num text-3xl font-bold">{inr(last.close)}</span><Delta v={day}/><span className="text-xs text-slate-400">today</span><span className="text-xs text-slate-300">|</span><Delta v={change}/><span className="text-xs text-slate-400">over range</span></div></div>
      <div className="flex flex-wrap gap-2"><Link href={`/model-lab?symbol=${stock.instrument.symbol}`} className="btn-ghost">View model insights</Link><button className={`btn-ghost ${stock.watched?'!border-amber-300 !bg-amber-50 !text-amber-700':''}`} onClick={toggle}><Star size={16} fill={stock.watched?'currentColor':'none'}/> {stock.watched?'Watching':'Watch'}</button></div></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div><div className="mb-3 flex items-center justify-between gap-3"><div className="flex flex-wrap gap-1 rounded-xl border border-[#e5e0db] bg-white p-1">{ranges.map(([days,label])=><button key={days} onClick={()=>setRange(days)} aria-pressed={range===days} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${range===days?'bg-[#1d263f] text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}>{label}</button>)}</div><span className="hidden text-xs text-slate-500 sm:inline">Prices shown through {session.current_date}</span></div>
          <PriceChart data={prices}/>
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-[#e7e7e2] bg-white px-5 py-4 text-sm sm:grid-cols-3 xl:grid-cols-6">{[['Open',inr(last.open)],['High',inr(last.high)],['Low',inr(last.low)],['Close',inr(last.close)],['Range high',inr(hi)],['Range low',inr(lo)]].map(([k,v])=><div key={k}><p className="label">{k}</p><p className="num mt-0.5 font-semibold">{v}</p></div>)}</div></div>
        {pos&&<div className="card"><h2 className="mb-3 text-lg font-bold">Your position</h2><div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">{[['Shares',String(pos.quantity)],['Avg cost',inr(pos.avg_cost)],['Value',inr(pos.value)],['Unrealised',inr(pos.unrealized_pnl)]].map(([k,v])=><div key={k}><p className="label">{k}</p><p className="num mt-0.5 font-semibold">{v}</p></div>)}</div></div>}
      </div>
      <div id="trade" className="space-y-5">{model?.status==='trained'&&<div className="chart-stage market-grid p-5"><p className="chart-kicker">Trained model · next day</p><div className="mt-3 flex items-end justify-between gap-4"><div><p className="num text-3xl font-semibold">{((model.probability_up>=.5?model.probability_up:1-model.probability_up)*100).toFixed(1)}%</p><p className="mt-1 text-sm font-bold text-[#dab99b]">{model.probability_up>=.5?'Up':'Down'} score</p></div><Link href={`/model-lab?symbol=${stock.instrument.symbol}`} className="text-xs font-bold text-[#dbad82]">View test results →</Link></div><p className="mt-4 border-t border-white/10 pt-3 text-xs text-[#c3b5a8]">{model.stale?'Trained on an earlier day. The model updates when this date is viewed.':'Uses only information available through today.'} This score is not a guarantee.</p></div>}<OrderTicket session={session} market={market} cash={portfolio.cash} held={held} symbol={stock.instrument.symbol} onDone={reload}/></div>
    </div>
  </Shell>;
}
