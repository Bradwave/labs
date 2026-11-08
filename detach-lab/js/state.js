/* State, language, number formatting */
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const CREAL=29979.2458;            // c in units of 10^4 m/s
const KEV=0.06582;                 // keV per (10^4 m/s)^2, iodine atom 127 u
const DEG=Math.PI/180;
const FM="'Space Mono',ui-monospace,Menlo,monospace",FU=FM;

const P={flow:false,tf:0,tab:'vel',setup:'real',anions:true,fan:true,partner:true,model:'gal',frame:'lab',split:false,exag:true,
  v:10,up:2,L:30,R:4,Eth:5,creal:true,beta:0.5,th:60*DEG,rm:6,zoom:false,s:0,playing:true,speed:1};

/* ---------- language ---------- */
let LANG='it';
try{const sv=localStorage.getItem('detach-lab.lang');if(sv==='en'||sv==='it')LANG=sv;else if(/^en/i.test(navigator.language||'')&&!/^it/i.test(navigator.language))LANG='en';}catch(e){}
const _=(it,en)=>LANG==='en'?en:it;
const R=String.raw;

/* ---------- formatting ---------- */
const SUPM={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
const supr=e=>String(e).split('').map(c=>SUPM[c]||c).join('');
const dec=s=>LANG==='en'?s:s.replace('.',',');
function nf(x,d=2){
  if(x===Infinity)return '∞'; if(x===-Infinity)return '−∞'; if(!isFinite(x))return '—';
  return dec((+x.toFixed(d)).toString().replace('-','−'));
}
const nfix=(x,d=2)=>dec(Math.abs(x).toFixed(d));
const tx=(x,d=2)=>{const s=nf(x,d).replace('−','-');return LANG==='en'?s:s.replace(',','{,}');};
function sci(x,d=1){
  if(x===0)return '0';
  const e=Math.floor(Math.log10(Math.abs(x)));const m=x/Math.pow(10,e);
  return nf(m,d)+'·10'+supr(e);
}
function smart(x){
  if(!isFinite(x))return nf(x);
  const a=Math.abs(x);if(a===0)return '0';
  if(a<1e-3||a>=1e5)return sci(x,2);
  return nf(x,a<1?4:(a<100?3:1));
}
const relD=(a,b)=>Math.abs(a)<1e-12?'—':smart(b/a-1);
