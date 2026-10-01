import {api} from './api';
const PICKS=['RELIANCE','TCS','HDFCBANK','ITC','SUNPHARMA'];
/** Seeds a diversified starter portfolio and replays a month so every screen has data. */
export async function loadDemo(sid:number,budgetPerStock=15000,days=30){
  const market=await api(`/sessions/${sid}/market`);
  for(const symbol of PICKS){
    const m=market.find((x:any)=>x.symbol===symbol);
    const quantity=m?Math.floor(budgetPerStock/Number(m.close)):0;
    if(quantity>=1)await api(`/sessions/${sid}/orders`,{method:'POST',body:JSON.stringify({symbol,side:'buy',order_type:'market',quantity,limit_price:null})});
  }
  await api(`/sessions/${sid}/advance?days=${days}`,{method:'POST'});
}
