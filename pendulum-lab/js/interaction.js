// Pendulum Lab · interaction.js
// Dragging and throwing the balls, releasing, resetting.
import { clearData, sample } from './data.js';
import { FL } from './fluid.js';
import { G } from './panels.js';
import { cur, pivot, syncCart } from './physics.js';
import { LY, Lp, P, PEN, S } from './state.js';
import { setPlaying } from './ui.js';
import { DEG, nf } from './util.js';
import { t, toast } from '../../kit/kit.js';
import { cv, s2w, w2s } from './view.js';

// ---------- interaction ----------
export let drag=null;
export function placeAt(p,w){
  const pv=pivot(p.i,S.t),L=Lp(p.i);let wx=w[0]-pv[0],wy=w[1]-pv[1];const r=Math.hypot(wx,wy);
  if(P.model==='rod'||(P.model==='string'&&r>=L)){p.polar=true;p.th=Math.atan2(wx,-wy);p.om=0;syncCart(p);}
  else{const lim=P.model==='elastic'?3*L:L;if(r>lim){wx*=lim/r;wy*=lim/r;}p.polar=false;p.x=wx;p.y=wy;p.vx=0;p.vy=0;p.th=Math.atan2(wx,-wy);p.om=0;}
}
export const endDrag=()=>{
  if(!drag)return;const now=performance.now(),pts=drag.pts.filter(p=>now-p.t<110),i=drag.i;drag=null;cv.classList.remove('held');
  let vx=0,vy=0;
  if(pts.length>=2){const a=pts[0],b=pts[pts.length-1],dt=(b.t-a.t)/1000;if(dt>.012&&now-b.t<70){vx=(b.w[0]-a.w[0])/dt;vy=(b.w[1]-a.w[1])/dt;}}
  const vmax=Math.max(3,4*Math.sqrt(Math.max(P.g,1)*Lp(i))),sp=Math.hypot(vx,vy);if(sp>vmax){vx*=vmax/sp;vy*=vmax/sp;}
  if(Math.hypot(vx,vy)<.08){vx=0;vy=0;}
  release(i,vx,vy);
};
export function release(i,vx,vy){
  S.held=-1;
  for(const p of PEN){
    const [ux,uy]=p===PEN[i]?[vx,vy]:[0,0];
    if(p.polar){const L=Lp(p.i),tx=Math.cos(p.th),ty=Math.sin(p.th),vt=ux*tx+uy*ty;
      if(P.model==='string'){const vr=ux*Math.sin(p.th)-uy*Math.cos(p.th);if(vr<-1e-3){p.polar=false;p.vx=ux;p.vy=uy;continue;}}
      p.om=vt/L;syncCart(p);}
    else{p.vx=ux;p.vy=uy;}
  }
  S.tOff+=S.t;S.t=0;S.Ed=0;S.Wd=0;clearData();G.phR={a:1,b:1};
  S.rel={tOff:S.tOff,pens:PEN.map(p=>({polar:p.polar,th:p.th,om:p.om,x:p.x,y:p.y,vx:p.vx,vy:p.vy}))};
  const A=cur();rescaleE(A);for(const o of A)o.p.lastPhi=o.th;
  setPlaying(true);sample(A);
  const sp=Math.hypot(vx,vy);toast(sp>0?t('t.launched',{v:nf(sp,2,'m/s')}):t('t.rest'));
}
export function resetToRelease(){
  if(!S.rel)return;S.tOff=S.rel.tOff;
  S.rel.pens.forEach((q,n)=>{Object.assign(PEN[n],q);if(q.polar)syncCart(PEN[n]);});
  S.t=0;S.Ed=0;S.Wd=0;S.flash=[0,0];clearData();G.phR={a:1,b:1};
  const A=cur();rescaleE(A);for(const o of A)o.p.lastPhi=o.th;
  S.psi=Math.atan2(A[0].geff[1],A[0].geff[0]);S.psid=0;FL.ok=false;sample(A);
}
export function setAngle(p,th,v0){
  const L=Lp(p.i);
  if(P.model==='elastic'){p.polar=false;p.x=L*Math.sin(th);p.y=-L*Math.cos(th);p.vx=v0*Math.cos(th);p.vy=v0*Math.sin(th);p.th=th;}
  else{p.polar=true;p.th=th;p.om=v0/L;syncCart(p);}
}
export function releaseAngle(thA,v0,thB){
  S.held=-1;setAngle(PEN[0],thA/DEG,0);setAngle(PEN[1],(thB||0)/DEG,0);
  const th=thA/DEG;release(0,v0*Math.cos(th),v0*Math.sin(th));
}
export function rescaleE(A){A=A||cur();S.Escale=Math.max(A.E,A.K,A.U,A.Ue,S.Ed,Math.abs(S.Wd),1e-6)*1.15;}

export function initInteraction(){
cv.addEventListener('pointerdown',e=>{
  if(S.view!=='lab'){toast(t('t.switchLab'));return;}
  const r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,w=s2w(sx,sy);
  let pick=0;if(LY.two){const A=cur(),d=A.map(o=>{const b=w2s(o.x,o.y);return Math.hypot(b[0]-sx,b[1]-sy);});pick=d[1]<d[0]?1:0;}
  drag={pts:[{t:performance.now(),w}],i:pick};S.held=pick;cv.classList.add('held');placeAt(PEN[pick],w);for(const p of PEN)p.trail.length=0;
  cv.setPointerCapture(e.pointerId);e.preventDefault();
});
cv.addEventListener('pointermove',e=>{
  if(!drag)return;const r=cv.getBoundingClientRect(),w=s2w(e.clientX-r.left,e.clientY-r.top),now=performance.now();
  drag.pts.push({t:now,w});while(drag.pts.length>2&&now-drag.pts[0].t>120)drag.pts.shift();placeAt(PEN[drag.i],w);
});
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
// set the velocity of ball i (relative to its support), stop the others, restart the clock
}
