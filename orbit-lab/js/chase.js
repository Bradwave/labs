// Orbit Lab · chase.js
// Rendezvous mode: target ship on a circular orbit, docking test and the two-burn reference.

import { CORE } from './core/index.js';
import { S } from './state.js';
/* ---- rendezvous (chase) ---- */
export const CHASE_TOL={d:0.06,v:0.05};
export function targetAt(t){ // lead > 0: the target is ahead along the (clockwise) motion
  const r=1+S.h,w=Math.pow(r,-1.5),th=Math.PI/2-S.chase.lead*Math.PI/180-w*t;
  return{x:r*Math.cos(th),y:r*Math.sin(th),vx:r*w*Math.sin(th),vy:-r*w*Math.cos(th),th,r,w};
}
export function chaseNow(q){
  const t=targetAt(q.t),I=CORE.info(q.x,q.y,q.vx,q.vy,q.pad);
  const dist=Math.hypot(q.x-t.x,q.y-t.y),rel=Math.hypot(q.vx-t.vx,q.vy-t.vy);
  const lead=CORE.wrapPi(Math.atan2(q.y,q.x)-t.th)*180/Math.PI;
  const Tt=2*Math.PI/t.w,Tc=I.T;
  let verdict='same';
  if(isFinite(Tc)&&Math.abs(Tc-Tt)/Tt>0.01&&Math.abs(lead)>1) verdict=lead*(Tt-Tc)>0?'gaining':'losing';
  return{dist,rel,lead,Tt,Tc,verdict,docked:dist<CHASE_TOL.d&&rel<CHASE_TOL.v&&!I.crash};
}
// Efficient two-burn phasing rendezvous: Δv and number of laps to wait
export function chasePar(){
  const L=Math.abs(S.chase.lead)*Math.PI/180,r=1+S.h,vcr=CORE.vc(S.h),ahead=S.chase.lead>=0;
  for(let k=1;k<=12;k++){
    const f=ahead?1-L/(2*Math.PI*k):1+L/(2*Math.PI*k),a=r*Math.pow(f,2/3);
    if(ahead&&2*a-r<1.02)continue;
    const vb=Math.sqrt(Math.max(0,2/r-1/a));return{dv:2*Math.abs(vcr-vb),laps:k};
  }
  return null;
}
