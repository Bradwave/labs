// Orbit Lab · util.js
// DOM helpers and number formatting.
export const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const fmt=(v,d=3)=>!isFinite(v)?'∞':(Math.abs(v)<5e-4&&d>=3?'0':v.toFixed(d));
