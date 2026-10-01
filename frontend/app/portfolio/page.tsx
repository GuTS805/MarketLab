'use client';
import Link from 'next/link';
import {BriefcaseBusiness} from 'lucide-react';
import Shell from '../../components/Shell';
import Insights from '../../components/Insights';
import {AllocationChart} from '../../components/MarketCharts';
import {Empty,ErrorBanner,PageHeader,PageSkeleton,Stat} from '../../components/ui';
import {api,dateLabel,inr,pct,signedInr,tone} from '../../lib/api';
import {useSessionData} from '../../lib/hooks';
import {ModelSignal,signalPct,signalCaution} from '../../lib/model';

export default function Portfolio(){
  const {session,data,error,reload}=useSessionData(async s=>{const [portfolio,signals,orders]=await Promise.all([api(`/sessions/${s.id}/portfolio`),api(`/sessions/${s.id}/models/signals`),api(`/sessions/${s.id}/orders`)]);return {portfolio,signals:signals as ModelSignal[],orders:orders as any[]}});
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const p=data.portfolio,bySymbol=Object.fromEntries(data.signals.map(s=>[s.symbol,s])) as Record<string,ModelSignal>;
  const filled=data.orders.filter(o=>o.status==='filled'),sales=filled.filter(o=>o.side==='sell'),closed=!p.holdings.length&&filled.length>0;
  const covered=p.holdings.filter((h:any)=>!!bySymbol[h.symbol]).length;
  const downValue=p.holdings.reduce((sum:number,h:any)=>{const signal=bySymbol[h.symbol];return sum+(signal&&!signal.stale&&signal.quality==='above_baseline'&&signal.predicted_direction==='Down'?Number(h.value):0)},0);
  const invested=p.holdings.reduce((a:number,h:any)=>a+Number(h.avg_cost)*h.quantity,0),value=p.holdings.reduce((a:number,h:any)=>a+Number(h.value),0);
  const sectors=Object.entries(p.holdings.reduce((m:Record<string,number>,h:any)=>({...m,[h.sector||'Other']:(m[h.sector||'Other']||0)+Number(h.value)}),{})).map(([name,v])=>({name,value:v as number}));
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Positions" title="Portfolio" sub="Average-cost accounting, marked to the latest close"/>
    <ErrorBanner message={error}/>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#171d30] p-5 text-white"><div><p className="text-xs font-semibold text-[#baaa9b]">{session.active?'Available cash':'Final cash balance'}</p><p className="num mt-1 text-3xl font-bold">{inr(p.cash)}</p><p className="mt-2 text-xs text-[#cec3b9]">{closed?'All positions are closed. Your proceeds are held as cash.':!session.active?'This simulation has ended. These balances are saved at the final date.':'Cash and open positions together make up your total equity.'}</p></div><Link href={session.active?'/replay':'/results'} className="btn">{session.active?'Open replay':'Review final results'}</Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Invested" value={inr(invested)} sub={`${p.holdings.length} position${p.holdings.length===1?'':'s'}`}/>
      <Stat label="Market value" value={inr(value)} sub={invested?pct((value/invested-1)*100):undefined} subTone={value-invested}/>
      <Stat label="Unrealised P&L" value={signedInr(p.unrealized_pnl)} subTone={Number(p.unrealized_pnl)} sub="Open positions"/>
      <Stat label="Realised P&L" value={signedInr(p.realized_pnl)} subTone={Number(p.realized_pnl)} sub={session.fees_enabled?`Booked from sales · ${inr(p.fees_paid)} fees paid`:"Booked from sales"}/>
    </div>
    {p.holdings.length>0&&<div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Model lens on your holdings</h2><Link href="/model-lab" className="font-semibold text-indigo-700 hover:underline">Review model insights</Link></div><p className="mt-1">{covered} of {p.holdings.length} holdings have a trained signal. {inr(downValue)} of current holdings show a fresh down signal that beat its holdout baseline. This is exposure, not a loss forecast.</p></div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
      <div className="card overflow-x-auto"><h2 className="mb-4 text-lg font-bold">Positions</h2>
        {p.holdings.length?<table className="w-full text-left text-sm"><thead><tr><th className="th">Stock</th><th className="th text-right">Qty</th><th className="th text-right">Avg cost</th><th className="th text-right">Price</th><th className="th text-right">Value</th><th className="th text-right">Unrealised</th><th className="th">Model view</th></tr></thead>
          <tbody>{p.holdings.map((h:any)=><tr key={h.symbol} className="border-t border-slate-100"><td className="py-3"><Link href={`/stock/${h.symbol}`} className="font-bold hover:text-accent">{h.symbol}</Link><p className="text-xs text-slate-400">{h.sector}</p></td><td className="num py-3 text-right">{h.quantity}</td><td className="num py-3 text-right">{inr(h.avg_cost)}</td><td className="num py-3 text-right font-semibold">{inr(h.price)}</td><td className="num py-3 text-right font-semibold">{inr(h.value)}</td><td className={`num py-3 text-right font-semibold ${tone(Number(h.unrealized_pnl))}`}>{signedInr(h.unrealized_pnl)}<span className="block text-xs">{pct(h.unrealized_pct*100)}</span></td><td className="py-3 pl-3 text-xs">{bySymbol[h.symbol]?<><span className="font-bold text-indigo-900">{bySymbol[h.symbol].predicted_direction} · {signalPct(bySymbol[h.symbol])} up</span><span className="block text-slate-500">{signalCaution(bySymbol[h.symbol])}</span></>:<Link href={`/model-lab?symbol=${h.symbol}`} className="font-semibold text-indigo-700 hover:underline">View insights</Link>}</td></tr>)}</tbody></table>
          :<Empty icon={<BriefcaseBusiness/>} title={closed?"All positions closed":session.active?"No positions yet":"Finished with no open positions"} text={closed?`You have completed ${sales.length} sale${sales.length===1?"":"s"}. Your cash balance is ${inr(p.cash)}.`:session.active?"Place a buy order, then advance to the next trading day for it to fill.":"This simulation has ended. Review your results or start a new scenario."}><Link href={session.active?"/replay":"/setup"} className="btn">{session.active?"Open order ticket":"New simulation"}</Link></Empty>}
      </div>
      <div className="space-y-5">
        {p.holdings.length>0?<Insights holdings={p.holdings} cash={Number(p.cash)}/>:<div className="card"><h2 className="text-lg font-bold">Allocation</h2><p className="mt-3 text-sm text-slate-500">100% cash · {inr(p.cash)}. There is no open stock exposure to assess.</p></div>}
        <div className="card"><h2 className="mb-2 text-lg font-bold">By sector</h2>{sectors.length?<AllocationChart data={sectors}/>:<p className="py-6 text-center text-sm text-slate-400">No open stock positions. Current allocation is entirely cash.</p>}</div>
        <div className="card text-sm"><h2 className="mb-3 text-lg font-bold">Risk</h2><dl className="space-y-2"><div className="flex justify-between"><dt className="text-slate-500">Max drawdown</dt><dd className="num font-semibold">{(p.max_drawdown*100).toFixed(2)}%</dd></div><div className="flex justify-between"><dt className="text-slate-500">Volatility (annualised)</dt><dd className="num font-semibold">{p.volatility==null?'Needs more days':`${(p.volatility*100).toFixed(2)}%`}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Return observations</dt><dd className="num font-semibold">{p.volatility_window}</dd></div></dl></div>
      </div>
    </div>
    {sales.length>0&&<div className="card mt-5 overflow-x-auto"><h2 className="text-lg font-bold">Sale history</h2><p className="mb-4 mt-1 text-xs text-slate-500">Completed sales remain here after your positions close. Proceeds below are before trading charges.</p><table className="w-full text-left text-sm"><thead><tr><th className="th">Date</th><th className="th">Stock</th><th className="th text-right">Shares sold</th><th className="th text-right">Fill price</th><th className="th text-right">Gross proceeds</th></tr></thead><tbody>{sales.map(o=><tr key={o.id} className="border-t border-slate-100"><td className="py-3 text-xs text-slate-500">{dateLabel(o.fill_date)}</td><td className="py-3 font-bold">{o.symbol}</td><td className="num py-3 text-right">{o.quantity}</td><td className="num py-3 text-right">{inr(o.fill_price)}</td><td className="num py-3 text-right font-semibold">{inr(Number(o.fill_price)*o.quantity)}</td></tr>)}</tbody></table></div>}
  </Shell>;
}
