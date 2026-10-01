'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search,Star} from 'lucide-react';
import Shell from '../../components/Shell';
import {Delta,ErrorBanner,PageHeader,PageSkeleton,Sparkline} from '../../components/ui';
import {api,inr} from '../../lib/api';
import {useSessionData} from '../../lib/hooks';
import {ModelSignal,signalPct,signalCaution} from '../../lib/model';

export default function Explore(){
  const {session,data,error,setError,reload}=useSessionData(async s=>{const [market,signals]=await Promise.all([api(`/sessions/${s.id}/market`),api(`/sessions/${s.id}/models/signals`)]);return {market:market as any[],signals:signals as ModelSignal[]}});
  const [q,setQ]=useState(''),[sector,setSector]=useState('All'),[sort,setSort]=useState<'symbol'|'gain'|'loss'|'model'>('symbol');
  const sectors=useMemo(()=>['All',...Array.from(new Set((data?.market||[]).map(x=>x.sector).filter(Boolean)))] as string[],[data]);
  const bySymbol=useMemo(()=>Object.fromEntries((data?.signals||[]).map(s=>[s.symbol,s])) as Record<string,ModelSignal>,[data]);
  const rows=useMemo(()=>{
    const f=(data?.market||[]).filter(x=>(sector==='All'||x.sector===sector)&&`${x.symbol} ${x.name}`.toLowerCase().includes(q.toLowerCase()));
    return sort==='gain'?[...f].sort((a,b)=>(b.change_pct??-99)-(a.change_pct??-99)):sort==='loss'?[...f].sort((a,b)=>(a.change_pct??99)-(b.change_pct??99)):sort==='model'?[...f].sort((a,b)=>(bySymbol[b.symbol]?.probability_up??-1)-(bySymbol[a.symbol]?.probability_up??-1)):f;
  },[data,q,sector,sort,bySymbol]);
  async function watch(symbol:string){try{await api(`/watchlist/${symbol}`,{method:'POST'});await reload()}catch(e:any){setError(e.message)}}
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Market" title="Explore" sub={`${data.market.length} NSE stocks · prices as of ${session.current_date}`}/>
    <ErrorBanner message={error}/>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="input" style={{paddingLeft:36}} placeholder="Search symbol or company" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search stocks"/></div>
      <select className="input !w-auto" value={sort} onChange={e=>setSort(e.target.value as any)} aria-label="Sort"><option value="symbol">A–Z</option><option value="gain">Top gainers</option><option value="loss">Top losers</option><option value="model">Highest model up score</option></select>
    </div>
    <div className="mb-6 flex flex-wrap gap-2">{sectors.map(s=><button key={s} onClick={()=>setSector(s)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${sector===s?'bg-navy text-white':'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{s}</button>)}</div>
    {rows.length?<div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(x=><div className="card card-interactive" key={x.symbol}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-extrabold">{x.symbol}</h2><p className="truncate text-sm text-slate-500">{x.name}</p><span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{x.sector}</span></div>
        <button onClick={()=>watch(x.symbol)} aria-label={x.watched?'Remove from watchlist':'Add to watchlist'} className={`rounded-lg p-1.5 transition hover:bg-slate-100 ${x.watched?'text-amber-500':'text-slate-300'}`}><Star size={18} fill={x.watched?'currentColor':'none'}/></button></div>
      <div className="mt-4 flex items-end justify-between"><div><p className="num text-2xl font-extrabold">{inr(x.close)}</p><Delta v={x.change_pct}/><span className="ml-1 text-xs text-slate-400">1 day</span></div><Sparkline data={x.spark} w={110} h={40}/></div>
      {bySymbol[x.symbol]?<div className="mt-4 rounded-xl bg-indigo-50 px-3 py-2 text-xs"><div className="flex justify-between font-bold text-indigo-900"><span>Model: {bySymbol[x.symbol].predicted_direction}</span><span>{signalPct(bySymbol[x.symbol])} up</span></div><p className="mt-1 text-indigo-700">{signalCaution(bySymbol[x.symbol])} · test {(bySymbol[x.symbol].metrics.accuracy*100).toFixed(0)}% vs baseline {(bySymbol[x.symbol].metrics.baseline_accuracy*100).toFixed(0)}%</p></div>:<Link href={`/model-lab?symbol=${x.symbol}`} className="mt-4 block text-xs font-semibold text-indigo-700 hover:underline">No model trained · Train signal</Link>}
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4"><Link href={`/stock/${x.symbol}`} className="btn-ghost flex-1 !py-2">Chart</Link><Link href={`/stock/${x.symbol}#trade`} className="btn flex-1 !py-2">Trade</Link></div></div>)}</div>
      :<div className="card text-center text-slate-500">No stocks match your filters.</div>}
  </Shell>;
}
