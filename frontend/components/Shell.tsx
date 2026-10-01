'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {LayoutDashboard,Search,BriefcaseBusiness,RotateCcw,LogOut,Menu,X,Star,ChartNoAxesCombined,Trophy,ArrowUpRight,Activity,BrainCircuit,NotebookPen,BookOpen,Flag} from 'lucide-react';
import {useState} from 'react';
import {dateLabel} from '../lib/api';
const links=[['/dashboard','Overview',LayoutDashboard],['/challenge','20-day Challenge',Flag],['/learn','Learn',BookOpen],['/explore','Research stocks',Search],['/model-lab','Model Lab',BrainCircuit],['/journal','Decision Journal',NotebookPen],['/portfolio','Portfolio',BriefcaseBusiness],['/watchlist','Watchlist',Star],['/replay','BlindMarket Replay',RotateCcw],['/results','Results',ChartNoAxesCombined],['/leaderboard','Leaderboard',Trophy]] as const;
export default function Shell({children,date,session}:{children:React.ReactNode;date?:string;session?:any}){
  const p=usePathname(),r=useRouter(),[open,setOpen]=useState(false);
  return <div className="workspace min-h-screen md:flex">
    <aside className={`${open?'flex':'hidden'} fixed inset-0 z-30 flex-col overflow-y-auto bg-[#112532] px-4 py-7 text-white md:sticky md:top-0 md:flex md:h-screen md:w-[248px] md:shrink-0`}>
      <div className="mb-10 flex items-start justify-between px-3"><Link href="/dashboard" onClick={()=>setOpen(false)} className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1b4e4c] text-[#78dfc6]"><Activity size={23} strokeWidth={2.5}/></div><div><div className="text-[19px] font-black tracking-[-.04em]">Market<span className="text-[#67d9be]">Lab</span></div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7e9ca0]">Decision laboratory</p></div></Link><button className="md:hidden" aria-label="Close menu" onClick={()=>setOpen(false)}><X/></button></div>
      <p className="mb-3 px-4 text-[10px] font-bold uppercase tracking-[.18em] text-[#728f94]">Workspace</p>
      <nav className="space-y-1">{links.map(([href,label,Icon])=>{const active=p===href||p.startsWith(href+'/');return <Link key={href} href={href} onClick={()=>setOpen(false)} className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${active?'bg-[#1f4e4a] text-[#a2f1d8] shadow-[inset_3px_0_0_#46d5ae]':'text-[#9cb2b8] hover:translate-x-1 hover:bg-white/[.055] hover:text-white'}`}><Icon size={17} strokeWidth={active?2.4:1.8}/><span>{label}</span>{active&&<ArrowUpRight className="ml-auto opacity-60" size={14}/>}</Link>})}</nav>
      <div className="mt-auto space-y-3">
        {session&&<div className="rounded-2xl border border-white/10 bg-white/[.045] p-4 text-xs"><div className="mb-3 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${session.active?'live-dot bg-[#40d7ad]':'bg-slate-400'}`}/><span className="font-bold uppercase tracking-widest text-[#8fafb0]">{session.active?'Live session':'Completed'}</span></div><p className="text-sm font-bold text-white">{session.name}</p><p className="mt-1 text-[#85a2a8]">Started {dateLabel(session.start_date)}</p></div>}
        <Link href="/setup" onClick={()=>setOpen(false)} className="block rounded-xl border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-[#c4d6d8] transition hover:border-[#5cbdac] hover:bg-white/5">+ New simulation</Link>
        <button className="flex items-center gap-2 px-2 pt-2 text-sm text-[#85a2a8] transition hover:text-white" onClick={()=>{localStorage.clear();r.push('/')}}><LogOut size={16}/> Log out</button>
      </div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e4e8e2] bg-[#fbfcf9]/90 px-5 backdrop-blur-xl md:px-8">
        <button className="md:hidden" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu/></button>
        <div className="flex items-center gap-3"><span className="hidden h-2.5 w-2.5 rounded-full bg-[#14ae96] md:block"/><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Historical simulation</p><p className="num text-sm font-bold text-[#203749]">{date?dateLabel(date):'Choose a start date'}</p></div></div>
        <div className="rounded-full border border-[#dce9e4] bg-[#f0f8f3] px-3 py-1.5 text-[11px] font-bold text-[#376559]">₹ Virtual funds <span className="hidden sm:inline">· No real money</span></div>
      </header>
      <div className="mx-auto max-w-[1440px] p-5 pb-24 md:p-8 md:pb-10">{children}</div>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#dbe5dd] bg-[#fbfcf9]/95 px-2 py-2 backdrop-blur md:hidden" aria-label="Quick navigation">{links.filter(([href])=>['/dashboard','/explore','/journal','/portfolio','/replay'].includes(href)).map(([href,label,Icon])=><Link href={href} key={href} className={`flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] font-semibold ${p===href?'text-[#087b73]':'text-slate-500'}`}><Icon size={19}/>{href==='/replay'?'Replay':href==='/explore'?'Research':href==='/journal'?'Journal':label}</Link>)}</nav>
  </div>;
}
