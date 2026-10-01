import {AlertTriangle,CheckCircle2,Info} from 'lucide-react';
import {analysePortfolio} from '../lib/insights';

const icon={good:<CheckCircle2 size={18} className="text-teal"/>,warn:<AlertTriangle size={18} className="text-amber-500"/>,info:<Info size={18} className="text-slate-400"/>};
export default function Insights({holdings,cash}:{holdings:any[];cash:number}){
  const {score,insights}=analysePortfolio(holdings,cash);
  const label=score==null?'':score>=75?'Strong':score>=50?'Fair':'Concentrated',bar=score==null?'':score>=75?'bg-teal':score>=50?'bg-amber-400':'bg-red-500';
  return <div className="card"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Diversification check</h2><p className="text-xs text-slate-400">How spread out your risk is</p></div>
    {score!=null&&<div className="text-right"><p className="num text-2xl font-extrabold">{score}<span className="text-sm font-semibold text-slate-400">/100</span></p><p className="text-xs font-semibold text-slate-500">{label}</p></div>}</div>
    {score!=null&&<div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar}`} style={{width:`${score}%`}}/></div>}
    {insights.length?<ul className="space-y-3">{insights.map(i=><li key={i.title} className="flex gap-3"><span className="mt-0.5 shrink-0">{icon[i.level]}</span><div><p className="text-sm font-semibold">{i.title}</p><p className="text-xs text-slate-500">{i.text}</p></div></li>)}</ul>
      :<p className="py-4 text-sm text-slate-400">Buy some stocks and advance a day to get feedback.</p>}</div>;
}
