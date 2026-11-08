// Orbit Lab · state.js
// Application state and the simulation stepping (deterministic fixed ticks).

import { MAXTICKS, TICK, clamp } from './core/constants.js';
import { H } from './core/history.js';
import { CORE } from './core/index.js';
import { LEVEL_FEATS } from './data/levels.js';
import { PLANETS } from './data/planets.js';
export const S={
  level:1, ovr:{}, h:0.5, mode:'cannon', v:0, ang:0, planet:'none',
  prog:{burn:4,a:[[0,1.3],[0.2,1.3],[0.3,0.4],[1,0.4]],th:[[0,0],[0.3,0],[1,90]]},
  phase:'prep', cur:0, playing:false, speed:1, acc:0,
  level_tl:0.2, dvStep:0.02, budget:2, hold:0,
  show:{vel:true,grav:true,thr:true,net:false,labels:false,trail:true,orbit:true,grid:false,ghosts:true,nog:false,bars:true,strobe:false,wedge:false},
  scale:'lin', kep:1,
  view:{cx:0,cy:0.4,s:100,follow:false,main:'planet',fitted:false},
  chase:{on:false,lead:40,res:null}, ghosts:[], crashed:null, runs:[], preview:null, vFirstBurn:0, launchH:null, launchMode:null, v0vec:null, mission:null
};
// Re-create the pre-launch state from the current launch settings
export function resetFlight(keepGhost=true){
  if(keepGhost&&S.phase==='flying'&&H.n>3) archiveTrail();
  S.phase='prep';S.playing=false;S.cur=0;S.acc=0;S.crashed=null;S.chase.res=null;S.vFirstBurn=0;S.hold=0;
  H.clear();
  const st=S.mode==='program'?CORE.padState(S.h):CORE.launchState(S.h,S.v,S.ang);
  H.push(st,null);
  S.v0vec=[st.vx,st.vy];
  updatePreview();
}
export function archiveTrail(){
  const pts=[],n=H.n,stride=Math.max(1,Math.floor(n/400));
  for(let i=0;i<n;i+=stride){const q=H.get(i);pts.push([q.x,q.y]);}
  const q=H.get(n-1);pts.push([q.x,q.y]);
  S.ghosts.push(pts);if(S.ghosts.length>8)S.ghosts.shift();
}
// Preview of the thrust program path (prep, program mode)
export function updatePreview(){
  if(S.phase!=='prep'){S.preview=null;return;}
  if(S.mode==='program'){
    const pr=CORE.simProgram(S.h,{burn:S.prog.burn,a:S.prog.a,th:S.prog.th},0.02);
    S.preview=pr;
  }else S.preview=null;
}
export function launchInfoNow(){
  if(S.mode==='program'&&S.preview){const e=S.preview.end;return CORE.info(e.x,e.y,e.vx,e.vy,e.pad);}
  const q=H.get(0);return CORE.info(q.x,q.y,q.vx,q.vy,false);
}
export function launch(){
  if(S.phase!=='prep'){resetFlight();}
  const li=launchInfoNow();
  S.runs.push({h:S.h,v:S.mode==='program'?-1:S.v,ang:S.mode==='program'?-1:S.ang,mode:S.mode,rp:li.rp,e:li.e,eps:li.eps,type:li.type,crash:li.crash});
  S.phase='flying';S.playing=true;S.launchH=S.h;S.launchMode=S.mode;S.acc=0;
  if(S.mode==='cannon'&&S.v<=0&&S.h<=0){/* at rest on the ground: nothing happens */}
}
export function viewState(){return H.get(S.cur);}
export function atEnd(){return S.cur>=H.n-1;}
export function activeCmd(st){
  let c=null;
  if(S.launchMode==='program'&&st.t<S.prog.burn-1e-12) c=CORE.progCmd({burn:S.prog.burn,a:S.prog.a,th:S.prog.th},st.t);
  if(!c&&S.hold){
    const budgetOn=S.budget<2&&feat('budget');
    if(!(budgetOn&&st.dv>=S.budget-1e-9)) c={k:S.hold,a:S.level_tl,ang:0};
  }
  return c;
}
export function tickOnce(){
  if(S.crashed||H.n>=MAXTICKS)return false;
  const st=H.get(H.n-1), cmd=activeCmd(st);
  if(cmd&&!S.vFirstBurn&&cmd.k&&cmd.k<5&&cmd.a>0&&!st.pad) S.vFirstBurn=Math.hypot(st.vx,st.vy);
  const res=CORE.advance(st,TICK,cmd);
  H.push(st,cmd);
  if(res.crash){S.crashed=res.crash;S.playing=false;}
  S.cur=H.n-1;
  return true;
}
export function stepSim(dt){ // advance by dt of simulated time
  if(S.phase!=='flying')return;
  if(S.crashed&&S.cur>=H.n-1)return;
  S.acc+=dt;let g=0;
  if(S.cur<H.n-1&&!S.hold){ // replay recorded states, no branching until the student acts
    const k=Math.floor(S.acc/TICK);S.acc-=k*TICK;S.cur=Math.min(H.n-1,S.cur+k);
    if(S.cur>=H.n-1&&S.crashed)S.playing=false;
    return;}
  if(S.cur<H.n-1){H.trunc(S.cur+1);}
  while(S.acc>=TICK&&g<800){S.acc-=TICK;g++;if(!tickOnce())break;}
  if(H.n>=MAXTICKS){S.playing=false;}
}
export function burnImpulse(k){
  if(S.phase!=='flying'||S.crashed)return false;
  if(S.cur<H.n-1)H.trunc(S.cur+1);
  const st=H.get(H.n-1);
  if(st.pad)return false;
  let d=S.dvStep;
  if(S.budget<2&&feat('budget')){d=Math.min(d,S.budget-st.dv);if(d<=1e-9)return false;}
  if(!S.vFirstBurn&&k<5)S.vFirstBurn=Math.hypot(st.vx,st.vy);
  CORE.impulse(st,k,d);
  H.push(st,null);S.cur=H.n-1;return true;
}
export function setCursor(i){S.cur=clamp(Math.round(i),0,H.n-1);S.playing=false;}
export function feat(k){
  if(k in S.ovr)return !!S.ovr[k];
  return S.level>=(LEVEL_FEATS[k]||1);
}
export function planetInfo(){return PLANETS.find(p=>p.id===S.planet)||PLANETS[0];}
