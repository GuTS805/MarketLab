'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Sparkles} from 'lucide-react';
import Shell from '../../components/Shell';
import {ErrorBanner,PageHeader} from '../../components/ui';
import {api,inr} from '../../lib/api';
import {loadDemo} from '../../lib/demo';

const scenarios=[
  {name:'Crash & Recovery',date:'2020-02-03',tag:'Feb 2020',text:'Start just before COVID hits. Can you survive a 35% drawdown and catch the rebound?'},
  {name:'Calm Before the Storm',date:'2019-06-03',tag:'Jun 2019',text:'A quiet, range-bound market. Build a portfolio, then see how it holds up when volatility arrives.'},
  {name:'Buying the Bottom',date:'2020-03-23',tag:'Mar 2020',text:'Start on the day of the crash low. Hindsight is easy here, so pick your winners carefully.'},
  {name:'Bull Run',date:'2021-01-04',tag:'Jan 2021',text:'Ride the post-pandemic rally. Diversify well and try to beat the NIFTY 50.'}
];
export default function Setup(){
  const r=useRouter(),[pick,setPick]=useState(0),[custom,setCustom]=useState(''),[cash,setCash]=useState(100000),[demo,setDemo]=useState(true),[fees,setFees]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const chosen=scenarios[pick],date=custom||chosen.date;
  async function go(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      const s=await api('/sessions',{method:'POST',body:JSON.stringify({name:custom?'Custom scenario':chosen.name,start_date:date,initial_cash:cash,fees})});
      if(demo)await loadDemo(s.id,Math.max(1000,Math.floor(cash*.15)));
      r.push('/dashboard');
    }catch(x:any){setError(x.message);setBusy(false)}
  }
  return <Shell>
    <PageHeader eyebrow="New simulation" title="Choose your starting point" sub="Data covers January 2019 to December 2021. You will only ever see prices up to your simulated date."/>
    <ErrorBanner message={error}/>
    <form onSubmit={go} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-4 sm:grid-cols-2">{scenarios.map((s,i)=><button type="button" key={s.name} onClick={()=>{setPick(i);setCustom('')}} className={`card flex flex-col items-start justify-start text-left transition hover:border-accent/50 ${pick===i&&!custom?'!border-accent ring-2 ring-accent/20':''}`}>
        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700">{s.tag}</span><h3 className="mt-3 text-lg font-bold">{s.name}</h3><p className="mt-1 text-sm text-slate-500">{s.text}</p></button>)}</div>
      <div className="card h-fit space-y-5">
        <label className="block"><span className="label">Or pick any date</span><input type="date" className="input mt-1" min="2019-01-01" max="2021-12-01" value={custom} onChange={e=>setCustom(e.target.value)}/><span className="mt-1 block text-xs text-slate-400">Weekends and holidays snap to the next trading day.</span></label>
        <label className="block"><span className="label">Starting cash</span><input type="number" className="input mt-1" min="1000" step="1000" value={cash} onChange={e=>setCash(Math.max(1000,+e.target.value||1000))}/><span className="mt-1 block text-xs text-slate-400">{inr(cash)} of virtual money</span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-accent-50 p-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={demo} onChange={e=>setDemo(e.target.checked)}/><span className="text-sm"><span className="flex items-center gap-1.5 font-bold text-accent-700"><Sparkles size={14}/> Start with a demo portfolio</span><span className="text-slate-600">Buys five large caps and fast-forwards a month so every chart has data. Uncheck to start from cash.</span></span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={fees} onChange={e=>setFees(e.target.checked)}/><span className="text-sm"><span className="font-bold">Realistic trading costs</span><br/><span className="text-slate-600">Charges STT, stamp duty, exchange fees and GST like an Indian discount broker. Small trades add up.</span></span></label>
        <button className="btn w-full py-3" disabled={busy}>{busy?'Setting up your market…':'Start simulation'}</button>
        <p className="text-center text-xs text-slate-400">Starting on {date}</p>
      </div>
    </form>
  </Shell>;
}
