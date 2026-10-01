export type Insight={level:'good'|'warn'|'info';title:string;text:string};
type Holding={symbol:string;sector?:string|null;value:number|string};

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const effective=(weights:number[])=>weights.length?1/weights.reduce((a,w)=>a+w*w,0):0;

/** Diversification score (0-100) and plain-language feedback for a set of holdings. */
export function analysePortfolio(holdings:Holding[],cash:number){
  const values=holdings.map(h=>Number(h.value)),invested=values.reduce((a,v)=>a+v,0),total=invested+cash;
  if(!holdings.length||invested<=0||total<=0)return {score:null as number|null,insights:[] as Insight[]};
  const bySector:Record<string,number>={};
  holdings.forEach(h=>{const k=h.sector||'Other';bySector[k]=(bySector[k]||0)+Number(h.value)});
  const stockW=values.map(v=>v/invested),sectorW=Object.values(bySector).map(v=>v/invested),cashW=cash/total;
  const score=Math.round(clamp((effective(stockW)-1)/4)*60+clamp((effective(sectorW)-1)/3)*30+(cashW>=0.05&&cashW<=0.4?10:0));
  const insights:Insight[]=[];
  const top=holdings.map((h,i)=>({h,w:Number(h.value)/total})).sort((a,b)=>b.w-a.w)[0];
  if(top.w>0.3)insights.push({level:'warn',title:`${top.h.symbol} is ${(top.w*100).toFixed(0)}% of your portfolio`,text:'One stock falling could dominate your results. Many investors cap single positions at 20–25%.'});
  const [topSector,topSectorValue]=Object.entries(bySector).sort((a,b)=>b[1]-a[1])[0];
  if(sectorW.length>1||holdings.length>2){if(topSectorValue/invested>0.5)insights.push({level:'warn',title:`${(topSectorValue/invested*100).toFixed(0)}% of your stocks are in ${topSector}`,text:'Stocks in the same sector tend to fall together. Spread across sectors to reduce that risk.'})}
  if(holdings.length<3)insights.push({level:'warn',title:`Only ${holdings.length} stock${holdings.length===1?'':'s'}`,text:'Holding 5–8 stocks across different sectors is a common way to reduce single-company risk.'});
  if(cashW>0.6)insights.push({level:'info',title:`${(cashW*100).toFixed(0)}% of your money is idle cash`,text:'Cash is safe but earns nothing here. That is fine if you are waiting for an opportunity.'});
  else if(cashW<0.05)insights.push({level:'info',title:'Almost no cash buffer',text:'You are fully invested, so you cannot buy a dip without selling something first.'});
  if(!insights.length)insights.push({level:'good',title:'Well diversified',text:`${holdings.length} stocks across ${sectorW.length} sectors with no dominant position.`});
  return {score,insights};
}
