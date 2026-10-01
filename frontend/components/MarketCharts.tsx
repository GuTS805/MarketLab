'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Area,AreaChart,CartesianGrid,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis,Line,Legend} from 'recharts';
import {ColorType,CrosshairMode,createChart,type Time} from 'lightweight-charts';
import {dateLabel,inr,inrShort} from '../lib/api';

const PALETTE=['#16ad9a','#e8b562','#659cbd','#db817d','#a4b39a','#8d92c8','#d0a584','#8dc9be'];
const formatDay=(d:string)=>dateLabel(d).replace(/ \d{4}$/,'');

export function EquityChart({data,height=300}:{data:any[];height?:number}){
  const [window,setWindow]=useState<'1M'|'3M'|'ALL'>('ALL');
  const rows=useMemo(()=>{
    const selected=window==='1M'?data.slice(-22):window==='3M'?data.slice(-66):data;
    return selected.map(d=>({...d,equity:Number(d.equity),benchmark:d.benchmark==null?null:Number(d.benchmark)}));
  },[data,window]);
  const hasBench=rows.some(d=>d.benchmark!=null);
  const values=rows.flatMap(d=>[d.equity,...(d.benchmark==null?[]:[d.benchmark])]);
  const low=Math.min(...values),high=Math.max(...values),pad=(high-low)*.22||high*.018||1000;
  const start=rows[0]?.equity||0,end=rows.at(-1)?.equity||0,move=start?(end/start-1)*100:0;
  return <div className="chart-stage market-grid p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><p className="chart-kicker">Portfolio trajectory</p><div className="mt-2 flex flex-wrap items-baseline gap-3"><strong className="num text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{inr(end)}</strong><span className={`num rounded-full px-2 py-1 text-xs font-bold ${move>=0?'bg-[#174c48] text-[#62dfc0]':'bg-[#573b42] text-[#ffa49d]'}`}>{move>=0?'↑':'↓'} {Math.abs(move).toFixed(2)}%</span></div></div>
      <div className="flex gap-1" aria-label="Chart period">{(['1M','3M','ALL'] as const).map(w=><button className={`chart-pill ${window===w?'active':''}`} onClick={()=>setWindow(w)} key={w} aria-pressed={window===w}>{w}</button>)}</div>
    </div>
    {rows.length<2?<div className="grid place-items-center text-center text-sm text-slate-300" style={{height}}>Advance the market to draw your equity curve.</div>
    :<ResponsiveContainer width="100%" height={height}><AreaChart data={rows} margin={{top:18,right:8,bottom:4,left:0}}>
      <defs><linearGradient id="equityWash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#25c7aa" stopOpacity={.38}/><stop offset="1" stopColor="#25c7aa" stopOpacity={.015}/></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="rgba(197,225,221,.11)" strokeDasharray="3 6"/>
      <XAxis dataKey="date" tick={{fontSize:11,fill:'#89a9ab'}} tickLine={false} axisLine={false} minTickGap={34} tickFormatter={formatDay}/>
      <YAxis domain={[low-pad,high+pad]} width={63} tick={{fontSize:11,fill:'#89a9ab'}} tickLine={false} axisLine={false} tickFormatter={inrShort}/>
      <Tooltip cursor={{stroke:'rgba(255,255,255,.3)',strokeDasharray:'3 4'}} contentStyle={{border:'1px solid #31535c',borderRadius:12,background:'#173644',color:'#f1f8f5',fontSize:12,boxShadow:'0 16px 30px #081b2588'}} labelStyle={{color:'#98b8b6',marginBottom:6}} labelFormatter={dateLabel} formatter={(value:any,name:any)=>[inr(value),name==='equity'?'Your portfolio':'NIFTY 50']}/>
      {hasBench&&<Line name="benchmark" dataKey="benchmark" type="monotone" stroke="#e8b562" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{r:4}} isAnimationActive animationDuration={850}/>}
      <Area name="equity" dataKey="equity" type="monotone" stroke="#30d3b3" strokeWidth={3} fill="url(#equityWash)" dot={false} activeDot={{r:5,strokeWidth:3,stroke:'#183f40'}} isAnimationActive animationDuration={900}/>
    </AreaChart></ResponsiveContainer>}
    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-[#9cb9bb]"><div className="flex flex-wrap items-center gap-4"><span><i className="mr-2 inline-block h-0.5 w-4 align-middle" style={{background:'#30d3b3'}}/>Your portfolio</span>{hasBench&&<span><i className="mr-2 inline-block h-0.5 w-4 align-middle" style={{background:'#e8b562'}}/>NIFTY 50</span>}</div><span className="hidden sm:inline">Hover to inspect values</span></div>
  </div>;
}

export function PriceChart({data,height=390}:{data:any[];height?:number}){
  const container=useRef<HTMLDivElement>(null);
  const [hover,setHover]=useState<any>(null);
  const latest=data.at(-1),shown=hover||latest;
  useEffect(()=>{
    if(!container.current||!data.length)return;
    const host=container.current;
    const chart=createChart(host,{width:host.clientWidth,height,layout:{background:{type:ColorType.Solid,color:'#102b37'},textColor:'#9bb8b9',fontFamily:'Inter, system-ui, sans-serif',fontSize:11},grid:{vertLines:{color:'rgba(207,239,229,.06)'},horzLines:{color:'rgba(207,239,229,.08)'}},crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'#76bbae',width:1,style:2,labelBackgroundColor:'#0c8f82'},horzLine:{color:'#76bbae',width:1,style:2,labelBackgroundColor:'#0c8f82'}},rightPriceScale:{borderColor:'#31515a'},timeScale:{borderColor:'#31515a',rightOffset:3,barSpacing:8,minBarSpacing:3,fixLeftEdge:true},handleScale:{mouseWheel:true,pinch:true},handleScroll:{mouseWheel:true,pressedMouseMove:true}});
    const candle=chart.addCandlestickSeries({upColor:'#28c6a3',downColor:'#e77c73',borderUpColor:'#28c6a3',borderDownColor:'#e77c73',wickUpColor:'#7dd9c3',wickDownColor:'#f1a099',priceLineVisible:false,lastValueVisible:true});
    candle.setData(data.map(row=>({time:row.date as Time,open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close)})));
    const volume=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'',lastValueVisible:false,priceLineVisible:false});
    volume.priceScale().applyOptions({scaleMargins:{top:.78,bottom:0}});
    volume.setData(data.map(row=>({time:row.date as Time,value:Number(row.volume),color:Number(row.close)>=Number(row.open)?'rgba(40,198,163,.31)':'rgba(231,124,115,.31)'})));
    chart.timeScale().fitContent();
    const onMove=(param:any)=>{const value=param.seriesData.get(candle);setHover(value&&param.time?{...value,date:String(param.time)}:null)};
    chart.subscribeCrosshairMove(onMove);
    const observer=new ResizeObserver(()=>chart.applyOptions({width:host.clientWidth}));observer.observe(host);
    return()=>{observer.disconnect();chart.unsubscribeCrosshairMove(onMove);chart.remove()};
  },[data,height]);
  if(!data.length)return <div className="chart-stage grid h-80 place-items-center text-slate-300">No prices available for this period.</div>;
  return <div className="chart-stage p-3 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2"><div><p className="chart-kicker">Historical price action</p><p className="mt-1 text-xs text-[#a8bfc1]">Candles & volume · drag to pan · scroll to zoom</p></div><p className="num text-[11px] text-[#a8bfc1]">{shown?.date?dateLabel(shown.date):''}</p></div>
    <div ref={container} className="w-full" aria-label="Interactive candlestick chart with trading volume"/>
    <div className="grid grid-cols-2 gap-3 border-t border-white/10 px-2 pt-4 text-xs sm:grid-cols-4"><span className="text-[#a8bfc1]">O <b className="num ml-1 text-white">{inr(shown.open)}</b></span><span className="text-[#a8bfc1]">H <b className="num ml-1 text-white">{inr(shown.high)}</b></span><span className="text-[#a8bfc1]">L <b className="num ml-1 text-white">{inr(shown.low)}</b></span><span className="text-[#a8bfc1]">C <b className="num ml-1 text-white">{inr(shown.close)}</b></span></div>
  </div>;
}

export function AllocationChart({data,height=190}:{data:{name:string;value:number}[];height?:number}){
  const total=data.reduce((sum,row)=>sum+Number(row.value),0)||1;
  return <div className="relative"><ResponsiveContainer width="100%" height={height}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="91%" paddingAngle={3} stroke="none" isAnimationActive animationDuration={900}>{data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip contentStyle={{borderRadius:12,border:'1px solid #e7e7e2',boxShadow:'0 12px 35px #1b2b3b1c'}} formatter={(v:any)=>inr(v)}/></PieChart></ResponsiveContainer>
    <div className="pointer-events-none absolute left-1/2 top-[95px] -translate-x-1/2 -translate-y-1/2 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p><p className="num whitespace-nowrap text-sm font-extrabold text-navy">{inrShort(total)}</p></div>
    <ul className="mt-3 space-y-2 text-sm">{data.map((row,i)=><li key={row.name} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2.5"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:PALETTE[i%PALETTE.length]}}/><span className="truncate text-slate-600">{row.name}</span></span><span className="num font-semibold text-navy">{(Number(row.value)/total*100).toFixed(1)}%</span></li>)}</ul>
  </div>;
}
