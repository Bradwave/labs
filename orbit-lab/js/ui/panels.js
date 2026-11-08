// Orbit Lab · ui/panels.js
// Readouts, chase panel, CSV export and the setup tab.

import { chaseNow, chasePar } from '../chase.js';
import { H } from '../core/history.js';
import { CORE } from '../core/index.js';
import { PLANETS } from '../data/planets.js';
import { C, orbitColor } from '../render/canvas-view.js';
import { thrustDir } from '../render/vectors.js';
import { S, feat, planetInfo } from '../state.js';
import { STR } from '../strings.js';
import { segBind, segSet, syncLaunchUI, toast } from './controls.js';
import { applyFeatures, setLevel } from './levels.js';
import { persist, shareURL } from './persist.js';
import { $, fmt } from '../util.js';
export function typeLabel(I){
  if(I.type==='stay')return STR.types.stay;
  const base=STR.types[I.type]||I.type;
  return I.crash?base+' → '+STR.types.crash:base;
}
/* ============================== UI: readouts, setup, missions ============================== */
export function readoutHTML(F){
  const {q,I,Io}=F,p=planetInfo(),real=feat('realUnits')&&p.R,col=orbitColor(Io);
  const row=(k,v,w)=>`<span${w?' class="wide"':''}>${k}</span><b${w?' class="wide"':''}>${v}</b>`;
  const out=[`<b class="full" style="color:${col}">${typeLabel(Io)}</b>`];
  if(S.chase.on){const c=chaseNow(q);out.push(`<b class="full" style="color:${C['c-parab']}">Target: ${S.chase.res?'docked':c.verdict==='gaining'?'you are gaining':c.verdict==='losing'?'you are falling behind':'same pace'}</b>`);}
  if(q.cmd&&q.cmd.k&&q.cmd.a>0){const td=thrustDir(q,CORE.thrustAcc(q.x,q.y,q.vx,q.vy,q.cmd));if(td)out.push(`<b class="full" style="color:${C.thr}">Thrust: ${td.text}</b>`);}
  if(!feat('readFull')){
    out.push(row('Closest',Io.crash?'the ground':fmt(Io.rp-1,2)+' R above'));
    out.push(row('Farthest',Io.ra===Infinity?'escapes':fmt(Io.ra-1,2)+' R above'));
    return out.join('');
  }
  const alt=I.r-1;
  out.push(row('Altitude',fmt(alt,3)+' R'+(real?' · '+Math.round(alt*p.R).toLocaleString('en')+' km':'')));
  out.push(row('r',fmt(I.r,3)+' R',true));
  out.push(row('Speed',fmt(I.v,3)+(real?' · '+(I.v*p.v0).toFixed(2)+' km/s':'')));
  out.push(row('e',fmt(Io.e,3)));
  out.push(row('a',Io.a===Infinity?'∞':fmt(Io.a,3)+' R',true));
  out.push(row('r_p',Io.crash?fmt(Io.rp,3)+' (below ground)':fmt(Io.rp,3)+' R',true));
  out.push(row('r_a',Io.ra===Infinity?'∞':fmt(Io.ra,3)+' R',true));
  out.push(row('T',Io.T===Infinity?'∞':fmt(Io.T,2)+(real?' · '+(Io.T*p.tau/60).toFixed(1)+' min':''),true));
  out.push(row('Δv used',fmt(q.dv,3)));
  return out.join('');
}
export function ptableHTML(F){
  const {I,q}=F,Eu=.5,en=CORE.energy(q.x,q.y,q.vx,q.vy);
  const r=(k,v)=>`<tr><td>${k}</td><td>${v}</td></tr>`;
  return r('L = x·v_y − y·v_x',fmt(I.hz,4))+r('eccentricity vector e',`(${fmt(I.ex,3)}, ${fmt(I.ey,3)})`)+
    r('vis-viva  v² − (2/r − 1/a)',I.bound||I.type==='parabola'||I.type==='hyperbola'?(I.eps<-1e-12?I.visviva.toExponential(1):'(a = ∞)'):'—')+
    r('Work by thrust W_T / E_u',fmt(q.W/Eu,3))+r('E − E₀ − W_T',(en.E-(F.E0)-q.W).toExponential(1));
}
export let lastRo='',lastPt='';
export function updateReadout(F){
  const a=readoutHTML(F);if(a!==lastRo){$('#readout').innerHTML=a;lastRo=a;}
  if(feat('advread')&&$('#pane-plots').offsetParent){const b=ptableHTML(F);if(b!==lastPt){$('#ptable').innerHTML=b;lastPt=b;}}
  const q=F.q,p=planetInfo();
  $('#tLabel').textContent='t = '+q.t.toFixed(2)+(feat('realUnits')&&p.R?' · '+(q.t*p.tau/60).toFixed(1)+' min':'');
  const st=$('#status');
  if(S.chase.res){st.hidden=false;st.textContent='Docked at t = '+S.chase.res.t.toFixed(2)+' · Δv = '+S.chase.res.dv.toFixed(3);}
  else if(S.crashed&&F.atEnd){st.hidden=false;st.textContent='Landed at t = '+S.crashed.t.toFixed(2);}
  else if(q.pad&&S.phase==='flying'){st.hidden=false;st.textContent='Waiting on the pad: thrust < gravity';}
  else st.hidden=true;
  $('#hint').textContent=S.phase==='prep'?STR.hints.prep:STR.hints.fly;
  const sc=$('#scrub');if(document.activeElement!==sc){sc.max=Math.max(0,H.n-1);sc.value=S.cur;}
  $('#dvUsed').textContent='Δv used: '+fmt(q.dv,3)+(S.budget<2&&feat('budget')?' of '+S.budget.toFixed(2):'');
}
/* ---- chase panel ---- */
export let lastCh='';
export function updateChasePane(q){
  const c=chaseNow(q),num=feat('numbers'),r=(k,v)=>`<tr><td>${k}</td><td>${v}</td></tr>`,side=c.lead>=0?'ahead':'behind';
  let h=r('Target',num?Math.abs(c.lead).toFixed(0)+'° '+side:'is '+side);
  if(num){h+=r('Distance',fmt(c.dist,3)+' R')+r('Relative speed',fmt(c.rel,3));}
  h+=r('Your period',num?(isFinite(c.Tc)?c.Tc.toFixed(2):'∞'):(!isFinite(c.Tc)?'no closed orbit':c.Tc<c.Tt*0.99?'shorter':c.Tc>c.Tt*1.01?'longer':'equal'));
  if(num)h+=r('Target period',c.Tt.toFixed(2));
  h+=r('Verdict',`<b>${c.verdict==='gaining'?STR.chase.gaining:c.verdict==='losing'?STR.chase.losing:STR.chase.same}</b>`);
  if(h!==lastCh){$('#chTable').innerHTML=h;lastCh=h;}
  const res=S.chase.res,par=chasePar();
  $('#chRes').innerHTML=res?`<p class="goal ok" style="font-weight:700;color:var(--vel)">Docked at t = ${res.t.toFixed(2)} with Δv = ${res.dv.toFixed(3)}.</p>`+(par?`<p class="note">An efficient two-burn phasing rendezvous needs Δv ≈ ${par.dv.toFixed(3)}, waiting ${par.laps} lap${par.laps>1?'s':''}.</p>`:''):'';
}
/* ---- setup panel ---- */
export function buildCSV(){
  const rows=['t,x,y,vx,vy,r,v,K,U,E,L'],n=H.n,stride=Math.max(1,Math.ceil(n/8000));
  const add=i=>{const s=H.get(i),r=Math.hypot(s.x,s.y),v=Math.hypot(s.vx,s.vy),e=CORE.energy(s.x,s.y,s.vx,s.vy);
    rows.push([s.t,s.x,s.y,s.vx,s.vy,r,v,e.K,e.U,e.E,s.x*s.vy-s.y*s.vx].map(x=>(+x).toPrecision(8)).join(','));};
  for(let i=0;i<n;i+=stride)add(i);if((n-1)%stride)add(n-1);
  return rows.join('\n');
}
export function bindSetup(){
  segBind('#lvSeg',v=>setLevel(+v));
  const pl=$('#plSeg');PLANETS.forEach(p=>{const b=document.createElement('button');b.dataset.v=p.id;b.textContent=p.name;pl.appendChild(b);});
  segBind('#plSeg',v=>{S.planet=v;segSet('#plSeg',v);$('#plNote').textContent=v==='none'?'':'Display only: h, speed and times are also shown in km, km/s and minutes.';syncLaunchUI();persist();});
  $('#csvBtn').onclick=async()=>{const t=buildCSV(),o=$('#csvOut');o.value=t;o.hidden=false;
    try{await navigator.clipboard.writeText(t);toast('CSV copied');}catch(e){o.select();toast('Select and copy the text below');}};
  $('#csvDl').onclick=()=>{try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buildCSV()],{type:'text/csv'}));a.download='orbit-lab.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}catch(e){toast('Download is not available here');}};
  $('#teachReset').onclick=()=>{S.ovr={};applyFeatures();persist();};
  $('#linkBtn').onclick=async()=>{const u=shareURL(false);try{await navigator.clipboard.writeText(u);toast('Link copied');}catch(e){toast(u);}};
  segSet('#plSeg',S.planet);
}
