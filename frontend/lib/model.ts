export type ModelSignal={symbol:string;probability_up:number;predicted_direction:'Up'|'Down';quality:'above_baseline'|'experimental';stale:boolean;trained_through:string;test_count:number;metrics:{accuracy:number;baseline_accuracy:number}};
export const signalPct=(s:ModelSignal)=>`${Math.round(s.probability_up*100)}%`;
export const signalCaution=(s:ModelSignal)=>s.stale?'Needs retraining for this date':s.quality==='experimental'?'Did not clearly beat baseline':'Beat holdout baseline';
