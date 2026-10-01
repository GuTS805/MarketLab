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
    <section className="market-grid relative order-2 flex min-h-[520px] flex-col justify-between overflow-hidden bg-[#102b37] px-6 py-7 text-white sm:px-10 sm:py-9 lg:order-1 lg:min-h-screen lg:px-[clamp(2.5rem,5vw,6rem)] lg:py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#4d8b83] bg-[#1d5552] text-[#8af0d5]"><LineChart size={21} strokeWidth={2.5}/></span><span className="text-xl font-black tracking-[-.055em]">Market<span className="text-[#7cdec5]">Lab</span></span></div>
        <span className="hidden rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#a8c3c1] sm:inline-flex">Decision laboratory</span>
      </div>

      <div className="relative my-12 max-w-[710px] lg:my-8">
        <p className="mb-5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#7cdec5]"><span className="h-1.5 w-1.5 rounded-full bg-[#7cdec5]"/> Historical Indian markets · 2019–2021</p>
        <h1 className="max-w-[650px] text-[clamp(3rem,5.1vw,5.8rem)] font-black leading-[1.01] tracking-[-.07em]">Make a call.<br/><span className="text-[#87e0cb]">Let history answer.</span></h1>
        <p className="mt-6 max-w-[510px] text-[clamp(.95rem,1.2vw,1.1rem)] leading-7 text-[#bdd2d2]">Research a stock, record your reasoning, then replay real market days. Find out what worked, what didn&apos;t, and whether the model actually helped.</p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#5c9e91]/40 bg-[#173d45] px-4 py-2 text-xs font-bold text-[#c7e7dd]"><LockKeyhole size={14}/> ₹1,00,000 virtual cash · No real trades</div>
      </div>

      <div className="relative rounded-[22px] border border-white/10 bg-[#183844]/80 p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#80cdbc]">The 20-day challenge</p><p className="mt-1 text-sm font-semibold text-[#e7f5ef]">One decision. A measurable outcome.</p></div><ArrowRight size={19} className="text-[#80cdbc]"/></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{journey.map(({number,label,Icon})=><div key={number} className="rounded-xl border border-white/[.08] bg-white/[.045] p-3"><span className="text-[10px] font-bold text-[#7dbfb1]">{number}</span><Icon className="mt-3 text-[#8de3ce]" size={18}/><p className="mt-2 text-xs font-semibold text-white">{label}</p></div>)}</div>
      </div>
    </section>

    <section className="order-1 flex min-h-[620px] items-center justify-center bg-[#f5f4ef] px-5 py-12 sm:px-8 lg:order-2 lg:min-h-screen lg:px-12">
      <div className="w-full max-w-[470px]">
        <div className="mb-5 flex items-center justify-between text-xs"><span className="font-extrabold uppercase tracking-[.18em] text-[#6d817a]">Your workspace</span><span className="rounded-full bg-[#e5f3ec] px-3 py-1.5 font-semibold text-[#266f5d]">Free to explore</span></div>
        <div className="rounded-[28px] border border-[#dce5de] bg-white p-6 shadow-[0_24px_70px_rgba(25,49,42,.08)] sm:p-9">
          <div className="flex rounded-xl bg-[#f1f4ef] p-1" aria-label="Account action"><button type="button" aria-pressed={!register} onClick={()=>{setRegister(false);setError('')}} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${!register?'bg-white text-[#15372f] shadow-sm':'text-slate-500 hover:text-slate-800'}`}>Log in</button><button type="button" aria-pressed={register} onClick={()=>{setRegister(true);setError('')}} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${register?'bg-white text-[#15372f] shadow-sm':'text-slate-500 hover:text-slate-800'}`}>Create account</button></div>
          <div className="mt-8"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0b8b79]">{register?'Start your experiment':'Pick up where you left off'}</p><h2 className="mt-2 text-[clamp(1.8rem,2.2vw,2.25rem)] font-black tracking-[-.05em] text-[#152d35]">{register?'Welcome to MarketLab':'Welcome back'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{register?'Create an account to save your decisions and replay progress.':'Log in to continue your market experiment.'}</p></div>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block"><span className="label">Email address</span><input className="input mt-1.5 !py-3" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <label className="block"><span className="label">Password</span><span className="relative mt-1.5 block"><input className="input !py-3 !pr-12" type={showPassword?'text':'password'} autoComplete={register?'new-password':'current-password'} placeholder="At least 8 characters" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
            {error&&<p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button className="btn mt-2 w-full !py-3.5" disabled={busy}>{busy?'Please wait…':register?'Create account':'Continue to workspace'}<ArrowRight size={16}/></button>
          </form>
          <p className="mt-6 border-t border-[#e9ede8] pt-5 text-center text-xs leading-5 text-slate-500">Educational simulation only. No broker connection, no real money.</p>
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">Learn the process. Test the evidence. Own the decision.</p>
      </div>
    </section>
  </main>;
}
