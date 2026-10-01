'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {LayoutDashboard,Search,BriefcaseBusiness,RotateCcw,LogOut,Menu,X,Star,ChartNoAxesCombined,Trophy,ArrowUpRight,Activity,BrainCircuit,NotebookPen,BookOpen,Flag,Plus,ChevronRight} from 'lucide-react';
import {useState} from 'react';
import {dateLabel} from '../lib/api';
const links=[['/dashboard','Overview',LayoutDashboard],['/challenge','20-day Challenge',Flag],['/learn','Learning library',BookOpen],['/explore','Research stocks',Search],['/model-lab','Model insights',BrainCircuit],['/journal','Decision journal',NotebookPen],['/portfolio','Portfolio',BriefcaseBusiness],['/watchlist','Watchlist',Star],['/replay','Market replay',RotateCcw],['/results','Performance',ChartNoAxesCombined],['/leaderboard','Leaderboard',Trophy]] as const;
export default function Shell({children,date,session}:{children:React.ReactNode;date?:string;session?:any}){
  const p=usePathname(),r=useRouter(),[open,setOpen]=useState(false);
  const current=links.find(([href])=>p===href||p.startsWith(href+'/'))?.[1]||'Workspace';
  return <div className="workspace min-h-screen md:flex">
    <aside className={`workspace-nav ${open?'flex':'hidden'} fixed inset-0 z-30 flex-col overflow-y-auto bg-[#171e2c] px-4 py-6 text-white md:sticky md:top-0 md:flex md:h-screen md:w-[236px] md:shrink-0`}>
      <div className="mb-10 flex items-center justify-between px-3"><Link href="/dashboard" onClick={()=>setOpen(false)} className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg border border-[#c19c6a]/30 bg-[#c19c6a]/10 text-[#d7b68f]"><Activity size={21}/></div><div><div className="text-lg font-semibold tracking-[-.04em]">MarketLab<span className="ml-1 text-[#d7b68f]">.</span></div><p className="mt-0.5 text-[8px] uppercase tracking-[.26em] text-[#7e879b]">The decision studio</p></div></Link><button className="md:hidden" aria-label="Close navigation" onClick={()=>setOpen(false)}><X/></button></div>
      <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[.2em] text-[#657085]">Workspace</p>
      <nav className="space-y-1">{links.map(([href,label,Icon])=>{const active=p===href||p.startsWith(href+'/');return <Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={active?'page':undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium transition duration-200 ${active?'bg-[#d7b68f]/10 text-[#ead5b9] ring-1 ring-[#d7b68f]/20':'text-[#929caf] hover:bg-white/[.04] hover:text-white'}`}><Icon size={16} strokeWidth={active?2:1.6}/><span>{label}</span>{active&&<ChevronRight className="ml-auto opacity-70" size={13}/>}</Link>})}</nav>
      <div className="mt-auto space-y-3 pt-8">
        {session&&<div className="rounded-xl border border-[#ffffff0d] bg-white/[.025] p-3.5"><div className="mb-2 flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${session.active?'live-dot bg-[#d7b68f]':'bg-[#7c879b]'}`}/><span className="text-[9px] font-semibold uppercase tracking-[.17em] text-[#8994a8]">{session.active?'Simulation in progress':'Session completed'}</span></div><p className="text-xs font-semibold text-[#dbe0e8]">{session.name}</p><p className="mt-1 text-[10px] text-[#758096]">{dateLabel(session.start_date)}</p></div>}
        <Link href="/setup" onClick={()=>setOpen(false)} className="flex items-center justify-center gap-2 rounded-lg border border-[#ffffff18] py-2.5 text-xs font-medium text-[#d0d6e1] transition hover:border-[#c19c6a]/50 hover:bg-white/5"><Plus size={14}/> New simulation</Link>
        <div className="flex items-center justify-between border-t border-white/[.06] px-1 pt-4"><div className="flex items-center gap-2.5"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#2b3447] text-[10px] font-semibold text-[#d7b68f]">ML</div><div><p className="text-[11px] font-medium text-[#b2bbcc]">Personal workspace</p><p className="text-[9px] text-[#657085]">Historical markets</p></div></div><button aria-label="Log out" title="Log out" className="rounded-lg p-2 text-[#758096] hover:bg-white/5 hover:text-white" onClick={()=>{localStorage.clear();r.push('/')}}><LogOut size={15}/></button></div>
      </div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between gap-3 border-b border-[#e8e6e1] bg-[#faf9f6]/95 px-5 backdrop-blur-xl md:px-9">
        <div className="flex min-w-0 items-center gap-3"><button className="md:hidden" aria-label="Open navigation" onClick={()=>setOpen(true)}><Menu size={20}/></button><span className="hidden text-[11px] text-[#9a9da5] sm:inline">Workspace</span><ChevronRight size={12} className="hidden text-[#b2b4bc] sm:block"/><span className="truncate text-xs font-semibold text-[#515967]">{current}</span></div>
        <div className="flex items-center gap-4"><span className="num hidden border-r border-[#e0ded9] pr-4 text-[11px] text-[#6f7685] sm:inline">{date?dateLabel(date):'Choose a start date'}</span><span className="flex items-center gap-2 rounded-full border border-[#e4d9ca] bg-[#f6efe5] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.08em] text-[#8c6944]"><span className="h-1 w-1 rounded-full bg-[#b07845]"/>Virtual capital</span></div>
      </header>
      <div className="mx-auto max-w-[1480px] p-5 pb-24 md:p-9 md:pb-12">{children}</div>
      <footer className="mx-9 mb-6 hidden items-center justify-between border-t border-[#e8e6e1] pt-4 text-[9px] text-[#999ca5] md:flex"><span>MARKETLAB / DECISION STUDIO</span><span>Historical data. Virtual capital. Real learning.</span></footer>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#e8e6e1] bg-[#faf9f6]/95 px-2 py-2 backdrop-blur md:hidden" aria-label="Quick navigation">{links.filter(([href])=>['/dashboard','/explore','/journal','/portfolio','/replay'].includes(href)).map(([href,label,Icon])=><Link href={href} key={href} className={`flex flex-col items-center gap-1 rounded-lg py-1 text-[9px] font-semibold ${p===href?'text-[#956137]':'text-slate-500'}`}><Icon size={18}/>{href==='/replay'?'Replay':href==='/explore'?'Research':href==='/journal'?'Journal':label}</Link>)}</nav>
  </div>;
}
