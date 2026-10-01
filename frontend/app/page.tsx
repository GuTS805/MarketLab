'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowRight,Eye,EyeOff,LineChart,LockKeyhole,NotebookPen,Play,Search} from 'lucide-react';
import {API} from '../lib/api';

const journey=[
  {number:'01',label:'Research',Icon:Search},
  {number:'02',label:'Make a call',Icon:NotebookPen},
  {number:'03',label:'Replay',Icon:Play},
  {number:'04',label:'Learn',Icon:LineChart},
] as const;

export default function Home(){
  const router=useRouter();
  const [register,setRegister]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      const response=register
        ?await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
        :await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:email,password})});
      const result=await response.json();
      if(!response.ok){setError(typeof result.detail==='string'?result.detail:'Please check your details and try again.');return}
      localStorage.setItem('token',result.access_token);
      router.push('/dashboard');
    }catch{setError('Cannot connect to the API. Check the URL printed by npm run dev.')}finally{setBusy(false)}
  }

  return <main className="flex min-h-screen flex-col bg-[#f5f4ef] lg:grid lg:grid-cols-[minmax(0,1.06fr)_minmax(440px,.94fr)]">
    <section className="market-grid relative order-2 flex min-h-[520px] flex-col justify-between overflow-hidden bg-[#171d30] px-6 py-7 text-white sm:px-10 sm:py-9 lg:order-1 lg:min-h-screen lg:px-[clamp(2.5rem,5vw,6rem)] lg:py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#8b6b4d] bg-[#242f4e] text-[#e1bc99]"><LineChart size={21} strokeWidth={2.5}/></span><span className="text-xl font-semibold tracking-[-.055em]">Market<span className="text-[#daab80]">Lab</span></span></div>
        <span className="hidden rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#c3b5a8] sm:inline-flex">Decision laboratory</span>
      </div>

      <div className="relative my-12 max-w-[710px] lg:my-8">
        <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#daab80]"><span className="h-1.5 w-1.5 rounded-full bg-[#daab80]"/> Historical Indian markets · 2019–2021 / EST. FOR LEARNING</p>
        <h1 style={{fontFamily:"Georgia, serif"}} className="max-w-[650px] text-[clamp(3rem,5.1vw,5.8rem)] font-normal leading-[1.08] tracking-[-.04em]">Make a call.<br/><span className="text-[#ddb28a]">Let history answer.</span></h1>
        <p className="mt-6 max-w-[510px] text-[clamp(.95rem,1.2vw,1.1rem)] leading-7 text-[#d2c7bd]">Research a stock, record your reasoning, then replay real market days. Find out what worked, what didn&apos;t, and whether the model actually helped.</p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#9e7c5c]/40 bg-[#1d263f] px-4 py-2 text-xs font-bold text-[#e7d6c7]"><LockKeyhole size={14}/> ₹1,00,000 virtual cash · No real trades</div>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-xl border border-white/10 bg-[#1b2333] p-5"><div className="flex items-center justify-between text-[10px] uppercase tracking-[.14em]"><span className="text-[#d7b68f]">History, in perspective</span><span className="text-[#7d879b]">Replay preview</span></div><svg viewBox="0 0 620 125" className="mt-4 w-full" role="img" aria-label="Illustrative market replay chart"><defs><linearGradient id="login-chart-wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b96d7" stopOpacity=".24"/><stop offset="1" stopColor="#6b96d7" stopOpacity="0"/></linearGradient></defs>{[25,60,95].map(y=><line key={y} x1="0" x2="620" y1={y} y2={y} stroke="#ffffff0b" strokeDasharray="3 5"/>)}<path d="M0 82 L35 69 L64 77 L95 56 L130 63 L163 45 L195 52 L227 87 L255 106 L278 92 L307 98 L340 75 L370 81 L405 53 L438 63 L470 38 L505 46 L538 22 L575 31 L610 12 L610 125 L0 125 Z" fill="url(#login-chart-wash)"/><path d="M0 82 L35 69 L64 77 L95 56 L130 63 L163 45 L195 52 L227 87 L255 106 L278 92 L307 98 L340 75 L370 81 L405 53 L438 63 L470 38 L505 46 L538 22 L575 31 L610 12" fill="none" stroke="#8dace0" strokeWidth="2.4" strokeLinejoin="round"/><circle cx="610" cy="12" r="4" fill="#d7b68f"/></svg><div className="mt-1 flex justify-between text-[9px] text-[#7d879b]"><span>Observe the past</span><span>Decide in the present</span><span>Reveal what follows</span></div></div>
      <div className="relative rounded-xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#cda580]">The 20-day challenge</p><p className="mt-1 text-sm font-semibold text-[#f5eee7]">One decision. A measurable outcome.</p></div><ArrowRight size={19} className="text-[#cda580]"/></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{journey.map(({number,label,Icon})=><div key={number} className="rounded-xl border border-white/[.08] bg-white/[.045] p-3"><span className="text-[10px] font-bold text-[#bf9d7d]">{number}</span><Icon className="mt-3 text-[#dfb791]" size={18}/><p className="mt-2 text-xs font-semibold text-white">{label}</p></div>)}</div>
      </div>
    </section>

    <section className="order-1 flex min-h-[620px] items-center justify-center bg-[#f5f4ef] px-5 py-12 sm:px-8 lg:order-2 lg:min-h-screen lg:px-12">
      <div className="w-full max-w-[470px]">
        <div className="mb-5 flex items-center justify-between text-xs"><span className="font-bold uppercase tracking-[.18em] text-[#81776d]">Your workspace</span><span className="rounded-full bg-[#f3ece5] px-3 py-1.5 font-semibold text-[#303d65]">Free to explore</span></div>
        <div className="rounded-2xl border border-[#e5e0dc] bg-white p-6 shadow-[0_24px_70px_rgba(25,49,42,.08)] sm:p-10">
          <div className="flex rounded-xl bg-[#f4f1ef] p-1" aria-label="Account action"><button type="button" aria-pressed={!register} onClick={()=>{setRegister(false);setError('')}} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${!register?'bg-white text-[#181f34] shadow-sm':'text-slate-500 hover:text-slate-800'}`}>Log in</button><button type="button" aria-pressed={register} onClick={()=>{setRegister(true);setError('')}} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${register?'bg-white text-[#181f34] shadow-sm':'text-slate-500 hover:text-slate-800'}`}>Create account</button></div>
          <div className="mt-8"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#303d66]">{register?'Start your experiment':'Pick up where you left off'}</p><h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.25rem)] font-semibold tracking-[-.05em] text-[#181e32]">{register?'Welcome to MarketLab':'Welcome back'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{register?'Create an account to save your decisions and replay progress.':'Log in to continue your market experiment.'}</p></div>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block"><span className="label">Email address</span><input className="input mt-1.5 !py-3" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <label className="block"><span className="label">Password</span><span className="relative mt-1.5 block"><input className="input !py-3 !pr-12" type={showPassword?'text':'password'} autoComplete={register?'new-password':'current-password'} placeholder="At least 8 characters" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
            {error&&<p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className="btn mt-2 w-full !py-3.5" disabled={busy}>{busy?'Please wait…':register?'Create account':'Continue to workspace'}<ArrowRight size={16}/></button>
          </form>
          <p className="mt-6 border-t border-[#edeae8] pt-5 text-center text-xs leading-5 text-slate-500">Educational simulation only. No broker connection, no real money.</p>
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">Learn the process. Test the evidence. Own the decision.</p>
      </div>
    </section>
  </main>;
}
