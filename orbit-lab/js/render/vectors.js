// Orbit Lab · render/vectors.js
// Velocity, gravity, thrust and net-acceleration arrows, forward/backward thrust label.

import { clamp } from '../core/constants.js';
import { CORE } from '../core/index.js';
import { C, Hh, W, ctx, cv, w2s } from './canvas-view.js';
import { S, feat } from '../state.js';
import { fmt } from '../util.js';
export function arrow(x0,y0,dx,dy,color,w=2.5,label){
  const L=Math.hypot(dx,dy);if(L<2)return;
  const ux=dx/L,uy=dy/L,hl=Math.min(9,L*.5);
  ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+dx-ux*hl*.6,y0+dy-uy*hl*.6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x0+dx,y0+dy);ctx.lineTo(x0+dx-ux*hl-uy*hl*.5,y0+dy-uy*hl+ux*hl*.5);ctx.lineTo(x0+dx-ux*hl+uy*hl*.5,y0+dy-uy*hl-ux*hl*.5);ctx.closePath();ctx.fill();
  if(label){ctx.font='700 11px "Space Mono",monospace';ctx.fillStyle=color;ctx.fillText(label,x0+dx+(dx>=0?6:-6-ctx.measureText(label).width),y0+dy+(dy>=0?12:-4));}
}
export const vecLen=m=>{const k=S.scale==='sqrt'?Math.sqrt(m):m;return Math.min(170,72*k);};
// Is the thrust pushing along the velocity (forward), against it (backward), or sideways?
export function thrustDir(q,th){
  const tm=Math.hypot(th[0],th[1]);if(tm<1e-9)return null;
  const v=Math.hypot(q.vx,q.vy),r=Math.hypot(q.x,q.y);
  const cv=v>1e-6?(th[0]*q.vx+th[1]*q.vy)/(tm*v):0, cr=(th[0]*q.x+th[1]*q.y)/(tm*r);
  if(v<=1e-6)return{text:'\u25B2 up',kind:'up'};
  if(cv>0.5)return{text:'\u25B6 forward · speeds up',kind:'fwd'};
  if(cv<-0.5)return{text:'\u25C0 backward · slows down',kind:'back'};
  return{text:cr>0?'\u25B2 outward · sideways':'\u25BC inward · sideways',kind:'side'};
}
export function drawVectors(q,cmd){
  const [x,y]=w2s(q.x,q.y), r=Math.hypot(q.x,q.y), g=1/(r*r), lab=S.show.labels&&feat('numbers');
  const gx=-q.x/r*g, gy=-q.y/r*g, th=CORE.thrustAcc(q.x,q.y,q.vx,q.vy,cmd&&cmd.k?cmd:null);
  if(S.show.vel&&!q.pad){const v=Math.hypot(q.vx,q.vy);if(v>1e-9){const L=vecLen(v)/v;arrow(x,y,q.vx*L,-q.vy*L,C.vel,3,lab?'v='+fmt(v,2):null);}}
  if(S.show.grav){const L=vecLen(g)/g;arrow(x,y,gx*L,-gy*L,C.grav,3,lab?'g='+fmt(g,2):null);}
  const tm=Math.hypot(th[0],th[1]);
  if(S.show.thr&&tm>1e-9){const L=Math.max(vecLen(tm),34)/tm;arrow(x,y,th[0]*L,-th[1]*L,C.thr,3.5,lab?'a='+fmt(tm,2):null);
    const td=thrustDir(q,th);if(td){const tx=x+th[0]*L*.5,ty=y-th[1]*L*.5;ctx.save();ctx.font='700 11px "Space Mono",monospace';const tw=ctx.measureText(td.text).width;
      const bx=clamp(tx+(th[0]>=0?10:-10-tw-12),4,W-tw-16),by=clamp(ty-10,16,Hh-8);
      ctx.fillStyle=C.surface;ctx.strokeStyle=C.thr;ctx.lineWidth=2;ctx.fillRect(bx,by-13,tw+12,19);ctx.strokeRect(bx,by-13,tw+12,19);ctx.fillStyle=C.thr;ctx.fillText(td.text,bx+6,by+1);ctx.restore();}}
  if(S.show.net){let nx=gx+th[0],ny=gy+th[1];if(q.pad&&Math.hypot(nx,ny)>0){const rx=q.x/r,ry=q.y/r,rad=th[0]*rx+th[1]*ry;if(rad<=g){nx=0;ny=0;}}
    const nm=Math.hypot(nx,ny);if(nm>1e-9){const L=vecLen(nm)/nm;ctx.setLineDash([5,3]);arrow(x,y,nx*L,-ny*L,C.net,3.5,lab?'Σa='+fmt(nm,2):null);ctx.setLineDash([]);}}
}
