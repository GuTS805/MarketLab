'use client';
import {useState} from 'react';
import {Trophy} from 'lucide-react';
import Shell from '../../components/Shell';
import {Empty,ErrorBanner,PageHeader,PageSkeleton} from '../../components/ui';
import {api,dateLabel,inr,pct,tone} from '../../lib/api';
import {useSessionData} from '../../lib/hooks';

const medal=['🥇','🥈','🥉'];
export default function Leaderboard(){
  const {session,data,error,reload}=useSessionData(()=>api('/leaderboard') as Promise<any[]>);
  const [pick,setPick]=useState(0);
  if(!data||!session)return <Shell><PageSkeleton error={error} retry={reload}/></Shell>;
  const g=data[Math.min(pick,data.length-1)];
  return <Shell date={session.current_date} session={session}>
    <PageHeader eyebrow="Compete" title="Leaderboard" sub="Players who started on the same date, ranked by return. Ideal for a class exercise: everyone picks the same start date."/>
    <ErrorBanner message={error}/>
    {!data.length?<div className="card"><Empty icon={<Trophy/>} title="No rankings yet" text="Advance your simulation at least one trading day to appear here."/></div>:<>
      <div className="mb-5 flex flex-wrap gap-2">{data.map((x:any,i:number)=><button key={x.start_date} onClick={()=>setPick(i)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${i===pick?'bg-navy text-white':'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>Start {dateLabel(x.start_date)} · {x.players} player{x.players===1?'':'s'}</button>)}</div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="th !pb-3 pl-5 pt-3">Rank</th><th className="th pt-3">Player</th><th className="th pt-3 text-right">Return</th><th className="th hidden pt-3 text-right sm:table-cell">Equity</th><th className="th hidden pt-3 text-right md:table-cell">Reached</th><th className="th pr-5 pt-3 text-right">Costs</th></tr></thead>
        <tbody>{g.entries.map((e:any)=><tr key={e.rank} className={`border-t border-slate-100 ${e.is_me?'bg-accent-50/60':''}`}><td className="num py-3.5 pl-5 font-bold">{medal[e.rank-1]||e.rank}</td><td className="py-3.5 font-semibold">{e.player}{e.is_me&&<span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">YOU</span>}</td><td className={`num py-3.5 text-right font-bold ${tone(e.return)}`}>{pct(e.return*100)}</td><td className="num hidden py-3.5 text-right sm:table-cell">{inr(e.equity)}</td><td className="hidden py-3.5 text-right text-slate-500 md:table-cell">{dateLabel(e.reached)}</td><td className="py-3.5 pr-5 text-right text-xs text-slate-500">{e.fees?'Included':'None'}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-slate-400">Players are shown by a masked username. Returns are as of each player's own simulated date, so compare "Reached" too.</p></>}
  </Shell>;
}
