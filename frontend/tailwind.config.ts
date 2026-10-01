import type {Config} from 'tailwindcss';
export default {
  content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme:{extend:{colors:{
    navy:{DEFAULT:'#0f1f33',light:'#17304d'},
    teal:{DEFAULT:'#0a8a84',50:'#e8f6f5',100:'#c8ebe8',200:'#96d8d3',300:'#5fc1ba',400:'#2fa8a0',500:'#0a8a84',600:'#08706b',700:'#075a56'},
    canvas:'#f3f5f7'
  }}},
  plugins:[]
} satisfies Config;
