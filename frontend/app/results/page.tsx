'use client';
import Link from 'next/link';
import {Activity,Award,Receipt,TrendingUp} from 'lucide-react';
import Shell from '../../components/Shell';
import News from '../../components/News';
import {EquityChart} from '../../components/MarketCharts';
import {Empty,ErrorBanner,PageHeader,PageSkeleton,SideBadge} from '../../components/ui';
import {api,dateLabel,inr,pct,tone} from '../../lib/api';
import {useSessionData} from '../../lib/hooks';

function Metric({icon,label,value,note,t}:{icon:React.ReactNode;label:string;value:string;note:string;t?:number|null}){
  return <div className="card"><div className="mb-4 inline-flex rounded-xl bg-accent/10 p-2 text-accent">{icon}</div><p className="label">{label}</p><p className={`num mt-1 text-3xl font-bold tracking-tight ${t!=null?tone(t):''}`}>{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></div>;
}
/** Judges a trade with hindsight: did the price move the way the trader needed? */
function verdict(t:any){
  const m=t.move_since;
  if(m==null||Math.abs(m)<0.005)return {text:'Flat since',cls:'text-slate-500'};
  const good=t.side==='buy'?m>0:m<0;
  if(t.side==='buy')return good?{text:'Working',cls:'positive'}:{text:'Underwater',cls:'negative'};
  return good?{text:'Good exit',cls:'positive'}:{text:'Sold too early',cls:'negative'};
}
export default function Results(){
  const {session,data,error,reload}=useSessionData(async s=>{
    const [result,events,challenge,journal]=await Promise.all([api(`/sessions/${s.id}/results`),api(`/sessions/${s.id}/events?since_start=true`),api(`/sessions/${s.id}/challenge`),api(`/sessions/${s.id}/journal`)]);
    return {result,events,challenge,journal:journal as any[]};
  });
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const {result:r,events,challenge}=data,ret=r.return*100,bench=r.benchmark_return==null?null:r.benchmark_return*100,beat=bench!=null&&ret>bench;
  const resolved=data.journal.filter(e=>e.status==='resolved'),comparable=resolved.filter(e=>e.horizon_days===1&&e.model_snapshot&&e.baseline_direction);
  const accuracy=(rows:any[],correct:(e:any)=>boolean)=>rows.length?`${rows.filter(correct).length}/${rows.length} correct (${Math.round(rows.filter(correct).length/rows.length*100)}%)`:'No resolved calls';
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Performance review" title="Simulation results" sub={`${dateLabel(r.start_date)} → ${dateLabel(r.end_date)}`}/>
    <ErrorBanner message={error}/>
    {!session.active&&<p className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Simulation completed on {dateLabel(r.end_date)}. Prices and results are saved at this date. <Link href="/setup" className="font-bold text-accent-700 hover:underline">Start a new scenario</Link> to try another approach.</p>}
    {(session.active||challenge.status!=='not_started')&&<Link href="/challenge" className="mb-5 flex items-center justify-between rounded-2xl border border-accent-100 bg-accent-50 px-5 py-4 text-sm font-semibold text-accent-900 hover:bg-accent-100"><span>{challenge.status==='complete'?'Your 20-day debrief is ready':challenge.status==='in_progress'?'Your 20-day challenge is in progress':'Try a guided 20-day challenge'}</span><span>{challenge.status==='complete'?'Read your debrief →':'Open challenge →'}</span></Link>}
    <Link href="/journal" className="mb-5 flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"><span>Compare your predictions with saved model calls and actual outcomes</span><span>Open Decision Journal →</span></Link>
    {bench!=null&&<div className={`mb-5 rounded-2xl px-5 py-4 text-sm font-semibold ${beat?'bg-accent-50 text-accent-800':'bg-slate-100 text-slate-700'}`}>{beat?`You beat the NIFTY 50 by ${(ret-bench).toFixed(2)} points.`:ret===bench?'You matched the NIFTY 50.':`The NIFTY 50 is ahead by ${(bench-ret).toFixed(2)} points. Compare your cash allocation and trade dates with the index before judging the result.`}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <Metric icon={<Award/>} label={session.active?"Current equity":"Final equity"} value={inr(r.final_value)} note={`${pct(ret)} total return on ${inr(r.initial_value)}${session.fees_enabled?` · ${inr(r.fees_paid)} paid in charges`:''}`} t={ret}/>
      <Metric icon={<TrendingUp/>} label="NIFTY 50" value={bench==null?'Unavailable':pct(bench)} note="Price-return benchmark over the same dates" t={bench}/>
      <Metric icon={<Activity/>} label="Max drawdown" value={`${(r.max_drawdown*100).toFixed(2)}%`} note={r.volatility==null?'Volatility needs more trading days':`${(r.volatility*100).toFixed(2)}% annualised volatility`}/>
    </div>
    <section className="card mt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Your predictions versus the outcome</h2><Link href="/journal" className="text-sm font-semibold text-indigo-700 hover:underline">Read your original reasons →</Link></div>{data.journal.length?<><div className="my-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="label">Your resolved calls</p><p className="mt-2 text-sm font-bold">{accuracy(resolved,e=>e.user_correct===true)}</p><p className="mt-1 text-xs text-slate-500">{data.journal.length-resolved.length} still awaiting their full time horizon.</p></div><div className="rounded-xl bg-indigo-50 p-3"><p className="label">Model · same one-day calls</p><p className="mt-2 text-sm font-bold">{accuracy(comparable,e=>e.model_snapshot.correct===true)}</p><p className="mt-1 text-xs text-slate-500">Your accuracy on these same calls: {accuracy(comparable,e=>e.user_correct===true)}.</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="label">Baseline · same one-day calls</p><p className="mt-2 text-sm font-bold">{accuracy(comparable,e=>e.baseline_correct===true)}</p><p className="mt-1 text-xs text-slate-500">Only calls with a saved model and baseline are compared.</p></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="th">Decision</th><th className="th">Your call</th><th className="th">Saved model</th><th className="th">Actual outcome</th></tr></thead><tbody>{data.journal.map(e=><tr key={e.id} className="border-t border-slate-100"><td className="py-3"><p className="font-bold">{e.symbol}</p><p className="text-xs text-slate-500">{dateLabel(e.decision_date)} · {e.horizon_days} trading day{e.horizon_days===1?'':'s'}</p></td><td className="py-3">{e.predicted_direction}{e.status==='resolved'&&<span className={`ml-2 text-xs font-semibold ${e.user_correct?'positive':'negative'}`}>{e.user_correct?'Correct':'Incorrect'}</span>}</td><td className="py-3">{e.model_snapshot?.predicted_direction||'No saved comparison'}</td><td className="py-3">{e.status==='resolved'?<><span className={`font-semibold ${tone(e.actual_return_pct)}`}>{e.actual_direction} · {pct(e.actual_return_pct)}</span><p className="text-xs text-slate-500">{dateLabel(e.target_date)}</p></>:<span className="text-xs text-slate-500">Horizon not reached by {dateLabel(r.end_date)}</span>}</td></tr>)}</tbody></table></div></>:<p className="mt-4 text-sm text-slate-500">No predictions were recorded before prices were revealed, so there are no saved calls to compare. {session.active?'Record a prediction in the journal before advancing the market.':'In your next simulation, record a prediction before advancing the market.'}</p>}</section>
    <div className="mt-5"><EquityChart data={r.snapshots} height={340}/></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
      <div className="card overflow-x-auto"><h2 className="text-lg font-bold">What happened after your trades</h2><p className="mb-4 text-xs text-slate-400">Each fill compared with the latest price on {dateLabel(r.end_date)}</p>
        {r.trades.length?<table className="w-full text-left text-sm"><thead><tr><th className="th">Date</th><th className="th">Trade</th><th className="th text-right">Filled at</th><th className="th text-right">Now</th><th className="th text-right">Since</th><th className="th text-right">Verdict</th></tr></thead>
          <tbody>{r.trades.map((t:any,i:number)=>{const v=verdict(t);return <tr key={i} className="border-t border-slate-100"><td className="py-3 text-xs text-slate-500">{dateLabel(t.date)}</td><td className="py-3"><SideBadge side={t.side}/> <span className="ml-1 font-bold">{t.quantity} {t.symbol}</span></td><td className="num py-3 text-right">{inr(t.price)}</td><td className="num py-3 text-right">{t.now_price?inr(t.now_price):'—'}</td><td className={`num py-3 text-right font-semibold ${tone(t.move_since)}`}>{t.move_since==null?'—':pct(t.move_since*100)}</td><td className={`py-3 text-right text-xs font-bold ${v.cls}`}>{v.text}</td></tr>})}</tbody></table>
          :<Empty icon={<Receipt/>} title="No completed trades" text={session.active?"Filled orders appear here with how they turned out.":"No orders were filled during this simulation."}><Link href={session.active?"/replay":"/setup"} className="btn">{session.active?"Place an order":"New simulation"}</Link></Empty>}</div>
      <News events={events} title="What was happening" sub="Events during your simulation window"/>
    </div>
  </Shell>;
}
