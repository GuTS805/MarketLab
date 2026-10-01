export const API=process.env.NEXT_PUBLIC_API_URL||'http://localhost:8000';
export async function api(path:string,options:RequestInit={}){
  const token=typeof window!=='undefined'?localStorage.getItem('token'):null;
  const r=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...options.headers}});
  if(!r.ok){
    let x:any;try{x=await r.json()}catch{}
    const d=x?.detail;
    throw new Error(typeof d==='string'?d:Array.isArray(d)?d.map((e:any)=>e.msg).join(', '):`Request failed (${r.status})`);
  }
  return r.json();
}
export const inr=(v:number|string=0)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(v));
export const inrShort=(v:number)=>{const a=Math.abs(v);return a>=1e7?`₹${(v/1e7).toFixed(2)}Cr`:a>=1e5?`₹${(v/1e5).toFixed(2)}L`:a>=1e3?`₹${(v/1e3).toFixed(1)}k`:`₹${Math.round(v)}`};
export const pct=(v:number|null|undefined,d=2)=>v==null||isNaN(v)?'—':`${v>0?'+':''}${v.toFixed(d)}%`;
export const signedInr=(v:number|string)=>`${Number(v)>0?'+':''}${inr(v)}`;
export const tone=(v:number|null|undefined)=>v==null||v===0?'text-slate-500':v>0?'positive':'negative';
export const dateLabel=(d:string)=>new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
