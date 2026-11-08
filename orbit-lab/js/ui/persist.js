// Orbit Lab · ui/persist.js
// Settings in localStorage and in the URL.

import { clamp } from '../core/constants.js';
import { LEVEL_FEATS } from '../data/levels.js';
import { PLANETS } from '../data/planets.js';
import { S } from '../state.js';
export let persistT=0;
export function persist(){
  clearTimeout(persistT);persistT=setTimeout(()=>{
    try{localStorage.setItem('orbitlab.v1',JSON.stringify({lead:S.chase.lead,level:S.level,ovr:S.ovr,h:S.h,mode:S.mode,v:S.v,ang:S.ang,planet:S.planet,show:S.show,scale:S.scale,speed:S.speed,prog:S.prog,done:[...DONE]}));}catch(e){}
    try{history.replaceState(null,'',shareURL(true));}catch(e){}
  },300);
}
export function shareURL(rel){
  const p=new URLSearchParams();p.set('level',S.level);p.set('h',S.h);if(S.mode==='cannon'){p.set('v',S.v);p.set('a',S.ang);}else p.set('mode','program');
  if(S.planet!=='none')p.set('planet',S.planet);
  if(Object.keys(S.ovr).length)p.set('feat',Object.entries(S.ovr).map(([k,v])=>(v?'+':'-')+k).join(','));
  const base=rel?location.pathname:location.origin+location.pathname;return base+'?'+p.toString();
}
export const DONE=new Set();
/* ---- init ---- */
export function loadSaved(){
  try{const j=JSON.parse(localStorage.getItem('orbitlab.v1')||'null');if(j){
    for(const k of['level','h','mode','v','ang','planet','scale','speed'])if(j[k]!==undefined)S[k]=j[k];
    if(typeof j.lead==='number')S.chase.lead=j.lead;
    if(j.ovr)S.ovr=j.ovr;if(j.show)Object.assign(S.show,j.show);if(j.prog&&j.prog.a&&j.prog.th)S.prog=j.prog;if(j.done)j.done.forEach(x=>DONE.add(x));}}catch(e){}
  try{const p=new URLSearchParams(location.search);
    if(p.has('level'))S.level=clamp(parseInt(p.get('level'))||1,1,3);
    if(p.has('h'))S.h=clamp(parseFloat(p.get('h'))||0,0,1.5);
    if(p.has('v'))S.v=clamp(parseFloat(p.get('v'))||0,0,1.6);
    if(p.has('a'))S.ang=clamp(parseFloat(p.get('a'))||0,-10,90);
    if(p.get('mode')==='program')S.mode='program';else if(p.has('v')||p.has('a'))S.mode='cannon';
    if(p.has('planet')&&PLANETS.some(x=>x.id===p.get('planet')))S.planet=p.get('planet');
    if(p.has('feat')){S.ovr={};p.get('feat').split(',').forEach(s=>{const k=s.slice(1);if(k in LEVEL_FEATS)S.ovr[k]=s[0]==='+';});}
  }catch(e){}
  S.level=clamp(S.level|0||1,1,3);
}
