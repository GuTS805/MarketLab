import {dateLabel} from '../lib/api';

const dot:Record<string,string>={covid:'bg-red-500',policy:'bg-accent',banking:'bg-amber-500',global:'bg-sky-500',politics:'bg-violet-500',markets:'bg-navy'};
export default function News({events,title='Market news',sub,limit}:{events:any[];title?:string;sub?:string;limit?:number}){
  const rows=limit?events.slice(0,limit):events;
  return <div className="card"><h2 className="text-lg font-bold">{title}</h2><p className="mb-4 text-xs text-slate-400">{sub||'Only events up to your simulated date are shown'}</p>
    {rows.length?<ol className="space-y-4">{rows.map(e=><li key={e.date+e.title} className="flex gap-3"><i className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[e.kind]||'bg-slate-400'}`}/><div><p className="text-xs text-slate-400">{dateLabel(e.date)}</p><p className="text-sm font-semibold">{e.title}</p><p className="text-xs text-slate-500">{e.detail}</p></div></li>)}</ol>
      :<p className="py-4 text-sm text-slate-400">No major events yet. Advance the clock.</p>}</div>;
}
