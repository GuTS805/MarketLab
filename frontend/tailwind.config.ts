import type {Config} from 'tailwindcss';
export default {
  content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme:{extend:{colors:{
    navy:{DEFAULT:'#0f1f33',light:'#17304d'},
    accent:{DEFAULT:'#b07845',50:'#faf5ef',100:'#f0e3d3',200:'#ddc2a3',300:'#caa47b',400:'#b9895a',500:'#b07845',600:'#956137',700:'#784b2c'},
    canvas:'#f3f5f7'
  }}},
  plugins:[]
} satisfies Config;
