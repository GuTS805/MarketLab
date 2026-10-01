'use client';
import {useState} from 'react';
import Link from 'next/link';
import {BrainCircuit,ChevronsRight,FastForward,Sparkles,TrendingUp,NotebookPen,Search,Flag} from 'lucide-react';
import Shell from '../../components/Shell';
import Insights from '../../components/Insights';
import News from '../../components/News';
import {AllocationChart,EquityChart} from '../../components/MarketCharts';
import {Empty,ErrorBanner,PageHeader,PageSkeleton,SideBadge,Stat,StatusBadge} from '../../components/ui';
import {api,dateLabel,inr,pct,signedInr,tone} from '../../lib/api';
import {loadDemo} from '../../lib/demo';
import {useSessionData} from '../../lib/hooks';

export default function Dashboard(){
  const {session,data,error,setError,reload}=useSessionData(async s=>{
    const [portfolio,orders,events]=await Promise.all([api(`/sessions/${s.id}/portfolio`),api(`/sessions/${s.id}/orders`),api(`/sessions/${s.id}/events`)]);
    return {portfolio,orders,events};
  });
  const [busy,setBusy]=useState(false);
  async function run(fn:()=>Promise<unknown>){setBusy(true);setError('');try{await fn();await reload()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const {portfolio:p,orders,events}=data,equity=Number(p.equity),start=Number(session.initial_cash),ret=(equity/start-1)*100;
  const last=p.snapshots[p.snapshots.length-1],bench=last?.benchmark,benchRet=bench?(bench/start-1)*100:null,alpha=benchRet==null?null:ret-benchRet;
  const totalPnl=equity-start,fresh=!p.holdings.length&&!orders.length;
  const alloc=[...p.holdings.map((h:any)=>({name:h.symbol,value:Number(h.value)})),{name:'Cash',value:Number(p.cash)}].filter(x=>x.value>0);
  const advance=(days:number)=>run(()=>api(`/sessions/${session.id}/advance?days=${days}`,{method:'POST'}));
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow={session.name} title="Overview" sub={`Information available through ${dateLabel(session.current_date)}`}>
      {session.active?<><Link href="/challenge" className="btn"><Flag size={16}/> Guided Challenge</Link><Link href="/model-lab" className="btn-ghost"><BrainCircuit size={16}/> Train a model</Link><button className="btn-ghost" disabled={busy} onClick={()=>advance(1)}><ChevronsRight size={16}/> Next day</button><button className="btn-ghost" disabled={busy} onClick={()=>advance(5)}><FastForward size={16}/> +5 days</button></>:<Link href="/setup" className="btn">Start a new simulation</Link>}
    </PageHeader>
    <ErrorBanner message={error}/>
    <div className="mb-5 rounded-[24px] bg-[#102b37] p-5 text-white md:p-6"><p className="chart-kicker">Your decision loop</p><h2 className="mt-1 text-xl font-extrabold">Research it. Predict it. Test it. Learn from it.</h2><p className="mt-2 text-sm text-[#b9cdce]">New here? The guided 20-day Challenge takes you through the whole process and explains your results.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/challenge" className="rounded-xl bg-[#67d9be] px-3 py-2 text-xs font-bold text-[#102b37] hover:bg-[#8af0d5]"><Flag size={14} className="mr-1 inline"/>Start guided Challenge</Link><Link href="/explore" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><Search size={14} className="mr-1 inline"/>Research</Link><Link href="/model-lab" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><BrainCircuit size={14} className="mr-1 inline"/>Test a model</Link><Link href="/journal" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><NotebookPen size={14} className="mr-1 inline"/>Write your call</Link><Link href="/replay" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><FastForward size={14} className="mr-1 inline"/>Replay</Link></div></div>
    {fresh&&session.active&&<div className="market-grid mb-6 overflow-hidden rounded-[24px] bg-[#12303b] p-6 text-white shadow-[0_24px_50px_#10243128] md:p-8"><div className="flex flex-wrap items-center justify-between gap-6"><div className="max-w-xl"><p className="chart-kicker">Your trading journey begins</p><h2 className="mt-2 text-2xl font-extrabold">Your account is a blank slate: {inr(session.cash)} and no positions.</h2><p className="mt-2 text-slate-300">Buy a few stocks and advance the clock to see your equity curve, allocation and results fill in.</p></div>
      <div className="flex flex-wrap gap-3"><button className="btn !bg-white !text-navy hover:!bg-slate-100" disabled={busy} onClick={()=>run(()=>loadDemo(session.id,Math.floor(start*.15)))}><Sparkles size={16}/> {busy?'Loading…':'Load demo portfolio'}</button><Link href="/explore" className="btn-ghost !border-white/25 !bg-transparent !text-white hover:!bg-white/10">Explore stocks</Link></div></div></div>}
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Total equity" value={inr(equity)} sub={`${pct(ret)} since start`} subTone={ret}/>
      <Stat label="Available cash" value={inr(p.cash)} sub={`${(Number(p.cash)/equity*100).toFixed(0)}% of portfolio`}/>
      <Stat label="Profit & loss" value={signedInr(totalPnl)} sub={`${signedInr(p.unrealized_pnl)} open · ${session.fees_enabled?`${inr(p.fees_paid)} fees`:`${signedInr(p.realized_pnl)} booked`}`} subTone={totalPnl}/>
      <Stat label="vs NIFTY 50" value={alpha==null?'—':`${alpha>0?'+':''}${alpha.toFixed(2)} pts`} sub={benchRet==null?'Advance a day to compare':`Index ${pct(benchRet)} · max drawdown ${(p.max_drawdown*100).toFixed(2)}%`} subTone={alpha}/>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="min-w-0"><EquityChart data={p.snapshots} height={300}/><p className="mt-2 px-1 text-[11px] text-slate-500">NIFTY 50 is rebased to your starting cash over the same dates.</p></div>
      <div className="card"><h2 className="mb-2 text-lg font-bold">Allocation</h2>{alloc.length>1||p.holdings.length?<AllocationChart data={alloc}/>:<Empty icon={<TrendingUp/>} title="All cash" text="Buy your first stock to see how your money is spread."><Link href="/replay" className="btn">Place an order</Link></Empty>}</div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><Insights holdings={p.holdings} cash={Number(p.cash)}/><News events={events} limit={4}/></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <div className="card overflow-x-auto"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Holdings</h2><Link href="/portfolio" className="text-sm font-semibold text-teal">View all →</Link></div>
        {p.holdings.length?<table className="w-full text-left text-sm"><thead><tr><th className="th">Stock</th><th className="th text-right">Qty</th><th className="th text-right">Value</th><th className="th text-right">P&amp;L</th></tr></thead><tbody>{p.holdings.map((h:any)=><tr key={h.symbol} className="border-t border-slate-100"><td className="py-3"><Link href={`/stock/${h.symbol}`} className="font-bold hover:text-teal">{h.symbol}</Link></td><td className="num py-3 text-right">{h.quantity}</td><td className="num py-3 text-right">{inr(h.value)}</td><td className={`num py-3 text-right font-semibold ${tone(Number(h.unrealized_pnl))}`}>{signedInr(h.unrealized_pnl)}<span className="block text-xs">{pct(h.unrealized_pct*100)}</span></td></tr>)}</tbody></table>:<Empty title="No open positions" text="Filled buy orders show up here after the next trading day."/>}</div>
      <div className="card overflow-x-auto"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Recent orders</h2><Link href="/replay" className="text-sm font-semibold text-teal">Trade →</Link></div>
        {orders.length?<table className="w-full text-left text-sm"><thead><tr><th className="th">Order</th><th className="th text-right">Qty</th><th className="th text-right">Price</th><th className="th text-right">Status</th></tr></thead><tbody>{orders.slice(0,6).map((o:any)=><tr key={o.id} className="border-t border-slate-100"><td className="py-3"><SideBadge side={o.side}/> <span className="ml-1 font-bold">{o.symbol}</span></td><td className="num py-3 text-right">{o.quantity}</td><td className="num py-3 text-right">{o.fill_price?inr(o.fill_price):o.limit_price?inr(o.limit_price):'Market'}</td><td className="py-3 text-right"><StatusBadge status={o.status}/></td></tr>)}</tbody></table>:<Empty title="No orders yet" text="Orders you place will be listed here."/>}</div>
    </div>
  </Shell>;
}
