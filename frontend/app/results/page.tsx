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
  return <div className="card"><div className="mb-4 inline-flex rounded-xl bg-teal/10 p-2 text-teal">{icon}</div><p className="label">{label}</p><p className={`num mt-1 text-3xl font-extrabold tracking-tight ${t!=null?tone(t):''}`}>{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></div>;
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
    const [result,events,challenge]=await Promise.all([api(`/sessions/${s.id}/results`),api(`/sessions/${s.id}/events?since_start=true`),api(`/sessions/${s.id}/challenge`)]);
    return {result,events,challenge};
  });
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const {result:r,events,challenge}=data,ret=r.return*100,bench=r.benchmark_return==null?null:r.benchmark_return*100,beat=bench!=null&&ret>bench;
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Performance review" title="Simulation results" sub={`${dateLabel(r.start_date)} → ${dateLabel(r.end_date)}`}/>
    <ErrorBanner message={error}/>
    <Link href="/challenge" className="mb-5 flex items-center justify-between rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-900 hover:bg-teal-100"><span>{challenge.status==='complete'?'Your 20-day debrief is ready':challenge.status==='in_progress'?'Your 20-day challenge is in progress':'Try a guided 20-day challenge'}</span><span>{challenge.status==='complete'?'Read your debrief →':'Open challenge →'}</span></Link>
    <Link href="/journal" className="mb-5 flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"><span>Compare your predictions with saved model calls and actual outcomes</span><span>Open Decision Journal →</span></Link>
    {bench!=null&&<div className={`mb-5 rounded-2xl px-5 py-4 text-sm font-semibold ${beat?'bg-teal-50 text-teal-800':'bg-slate-100 text-slate-700'}`}>{beat?`You beat the NIFTY 50 by ${(ret-bench).toFixed(2)} points.`:ret===bench?'You matched the NIFTY 50.':`The NIFTY 50 is ahead by ${(bench-ret).toFixed(2)} points. Diversify, time entries, and try again.`}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <Metric icon={<Award/>} label="Final value" value={inr(r.final_value)} note={`${pct(ret)} total return on ${inr(r.initial_value)}${session.fees_enabled?` · ${inr(r.fees_paid)} paid in charges`:''}`} t={ret}/>
      <Metric icon={<TrendingUp/>} label="NIFTY 50" value={bench==null?'Unavailable':pct(bench)} note="Price-return benchmark over the same dates" t={bench}/>
      <Metric icon={<Activity/>} label="Max drawdown" value={`${(r.max_drawdown*100).toFixed(2)}%`} note={r.volatility==null?'Volatility needs more trading days':`${(r.volatility*100).toFixed(2)}% annualised volatility`}/>
    </div>
    <div className="mt-5"><EquityChart data={r.snapshots} height={340}/></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
      <div className="card overflow-x-auto"><h2 className="text-lg font-bold">What happened after your trades</h2><p className="mb-4 text-xs text-slate-400">Each fill compared with the latest price on {dateLabel(r.end_date)}</p>
        {r.trades.length?<table className="w-full text-left text-sm"><thead><tr><th className="th">Date</th><th className="th">Trade</th><th className="th text-right">Filled at</th><th className="th text-right">Now</th><th className="th text-right">Since</th><th className="th text-right">Verdict</th></tr></thead>
          <tbody>{r.trades.map((t:any,i:number)=>{const v=verdict(t);return <tr key={i} className="border-t border-slate-100"><td className="py-3 text-xs text-slate-500">{dateLabel(t.date)}</td><td className="py-3"><SideBadge side={t.side}/> <span className="ml-1 font-bold">{t.quantity} {t.symbol}</span></td><td className="num py-3 text-right">{inr(t.price)}</td><td className="num py-3 text-right">{t.now_price?inr(t.now_price):'—'}</td><td className={`num py-3 text-right font-semibold ${tone(t.move_since)}`}>{t.move_since==null?'—':pct(t.move_since*100)}</td><td className={`py-3 text-right text-xs font-bold ${v.cls}`}>{v.text}</td></tr>})}</tbody></table>
          :<Empty icon={<Receipt/>} title="No completed trades" text="Filled orders appear here with how they turned out."><Link href="/replay" className="btn">Place an order</Link></Empty>}</div>
      <News events={events} title="What was happening" sub="Events during your simulation window"/>
    </div>
  </Shell>;
}
