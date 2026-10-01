'use client';
import Link from 'next/link';
import {Star} from 'lucide-react';
import Shell from '../../components/Shell';
import {Delta,ErrorBanner,PageHeader,PageSkeleton,Sparkline} from '../../components/ui';
import {api,inr} from '../../lib/api';
import {useSessionData} from '../../lib/hooks';

export default function Watchlist(){
  const {session,data,error,setError,reload}=useSessionData(s=>api(`/sessions/${s.id}/watchlist`) as Promise<any[]>);
  async function remove(symbol:string){try{await api(`/watchlist/${symbol}`,{method:'POST'});await reload()}catch(e:any){setError(e.message)}}
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Your shortlist" title="Watchlist" sub="Stocks you are keeping an eye on"/>
    <ErrorBanner message={error}/>
    {data.length?<div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">{data.map(x=><div key={x.symbol} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-100 px-5 py-4 last:border-0">
      <div className="min-w-[140px] flex-1"><p className="font-bold">{x.symbol}</p><p className="text-xs text-slate-500">{x.name} · {x.sector}</p></div>
      <Sparkline data={x.spark} w={90} h={32}/>
      <div className="w-28 text-right"><p className="num font-bold">{inr(x.close)}</p><Delta v={x.change_pct} className="text-xs"/></div>
      <div className="flex gap-2"><Link href={`/stock/${x.symbol}#trade`} className="btn !px-3 !py-1.5">Trade</Link><Link href={`/stock/${x.symbol}`} className="btn-ghost !px-3 !py-1.5">Chart</Link><button onClick={()=>remove(x.symbol)} aria-label={`Remove ${x.symbol}`} className="rounded-lg p-2 text-amber-500 hover:bg-amber-50"><Star size={18} fill="currentColor"/></button></div></div>)}</div>
      :<div className="card flex flex-col items-center py-16 text-center"><Star className="text-slate-300" size={36}/><h2 className="mt-4 text-xl font-bold">Your watchlist is empty</h2><p className="mt-2 text-slate-500">Tap the star on any stock in Explore to pin it here.</p><Link className="btn mt-6" href="/explore">Explore stocks</Link></div>}
  </Shell>;
}
