import {pct,tone} from '../lib/api';

export function Sparkline({data,w=96,h=34}:{data:number[];w?:number;h?:number}){
  if(!data||data.length<2)return <div style={{width:w,height:h}}/>;
  const min=Math.min(...data),max=Math.max(...data),span=max-min||1,up=data[data.length-1]>=data[0];
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-2-((v-min)/span)*(h-4)}`).join(' ');
  const color=up?'#0a8a84':'#d13d4b';
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/></svg>;
}
export function Delta({v,className=''}:{v:number|null|undefined;className?:string}){
  return <span className={`num font-semibold ${tone(v)} ${className}`}>{v==null?'—':`${v>0?'▲':v<0?'▼':''} ${pct(Math.abs(v)).replace('+','')}`}</span>;
}
export function PageHeader({eyebrow,title,sub,children}:{eyebrow?:string;title:string;sub?:string;children?:React.ReactNode}){
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow&&<p className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#098777]"><span className="h-px w-5 bg-[#10a18d]"/>{eyebrow}</p>}<h1 className="text-[2.1rem] font-black leading-tight tracking-[-.045em] text-[#152939] sm:text-[2.6rem]">{title}</h1>{sub&&<p className="mt-2 text-sm text-slate-500">{sub}</p>}</div>{children&&<div className="flex flex-wrap gap-2">{children}</div>}</div>;
}
export function Stat({label,value,sub,subTone}:{label:string;value:string;sub?:React.ReactNode;subTone?:number|null}){
  return <div className="card stat-card relative overflow-hidden !p-5"><span className="absolute right-5 top-5 h-2 w-2 rounded-full bg-[#b1d9d0]"/><p className="label relative">{label}</p><p className="num relative mt-4 whitespace-nowrap text-[clamp(1.35rem,2vw,1.85rem)] font-black tracking-[-.04em]">{value}</p>{sub!=null&&<p className={`num relative mt-2 text-xs font-bold ${subTone!==undefined?tone(subTone):'text-slate-400'}`}>{sub}</p>}</div>;
}
export function Empty({icon,title,text,children}:{icon?:React.ReactNode;title:string;text?:string;children?:React.ReactNode}){
  return <div className="flex flex-col items-center px-4 py-10 text-center">{icon&&<div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-400">{icon}</div>}<h3 className="font-bold">{title}</h3>{text&&<p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}{children&&<div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}</div>;
}
export function PageSkeleton({error='',retry}:{error?:string;retry?:()=>unknown}){
  if(error)return <div role="alert" className="card max-w-2xl border-red-200"><h2 className="text-lg font-extrabold text-red-800">This page could not load</h2><p className="mt-2 text-sm text-red-700">{error}</p><p className="mt-2 text-sm text-slate-600">If you just updated MarketLab, stop any old development terminals and run <code className="rounded bg-slate-100 px-1">npm run dev</code> again.</p>{retry&&<button className="btn mt-4" onClick={()=>void retry()}>Try again</button>}</div>;
  return <div role="status" aria-label="Loading page" className="space-y-5"><div className="skeleton h-10 w-64"/><div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map(i=><div key={i} className="skeleton h-28"/>)}</div><div className="skeleton h-72"/></div>;
}
export function ErrorBanner({message}:{message:string}){
  return message?<div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>:null;
}
export function StatusBadge({status}:{status:string}){
  const c:Record<string,string>={filled:'bg-teal-50 text-teal-700',pending:'bg-amber-50 text-amber-700',cancelled:'bg-slate-100 text-slate-500',rejected:'bg-red-50 text-red-700'};
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${c[status]||c.cancelled}`}>{status}</span>;
}
export function SideBadge({side}:{side:string}){
  return <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase ${side==='buy'?'bg-teal-50 text-teal-700':'bg-red-50 text-red-700'}`}>{side}</span>;
}
