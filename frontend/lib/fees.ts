/** Mirrors backend `fee()`: Indian delivery-equity charges with zero brokerage. Keep the two in sync. */
export function estimateFee(side:'buy'|'sell',value:number,enabled:boolean){
  if(!enabled||!(value>0))return 0;
  const exchange=value*0.0000345,sebi=value*0.000001;
  let total=value*0.001+exchange+sebi+(exchange+sebi)*0.18;
  total+=side==='buy'?value*0.00015:15.34;
  return Math.round(total*100)/100;
}
