// Orbit Lab · render/plots.js
// Time plots, effective potential and the thrust-program editors.

import { clamp } from '../core/constants.js';
import { H } from '../core/history.js';
import { CORE } from '../core/index.js';
import { C, cv, dpr } from './canvas-view.js';
import { S, feat, viewState } from '../state.js';
import { $, fmt } from '../util.js';
// ---- generic time plots ----
export function plotSeries(id,defs,opt={}){
  const cvs=$('#'+id);if(!cvs||cvs.offsetParent===null)return;
  const g=cvs.getContext('2d'),w=cvs.clientWidth,h=cvs.clientHeight;
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.fillStyle=C.surface;g.fillRect(0,0,w,h);
  const n=H.n,stride=Math.max(1,Math.floor(n/500)),idx=[];
  for(let i=0;i<n;i+=stride)idx.push(i);if(idx[idx.length-1]!==n-1)idx.push(n-1);
  const ts=idx.map(i=>H.get(i).t),tMax=Math.max(ts[ts.length-1],1e-6);
  const data=defs.map(d=>idx.map(i=>d.f(H.get(i))));
  let lo=Infinity,hi=-Infinity;for(const a of data)for(const v of a){if(v<lo)lo=v;if(v>hi)hi=v;}
  if(opt.zero){lo=Math.min(lo,0);hi=Math.max(hi,0);} if(!(hi-lo>1e-9)){lo-=.5;hi+=.5;} const m=(hi-lo)*.08;lo-=m;hi+=m;
  const L=36,T=8,Rr=6,B=16,X=t=>L+(t/tMax)*(w-L-Rr),Yy=v=>T+(hi-v)/(hi-lo)*(h-T-B);
  g.strokeStyle=C.gridline;g.lineWidth=1;g.fillStyle=C.muted;g.font='10px "Space Mono",monospace';
  if(lo<0&&hi>0){g.beginPath();g.moveTo(L,Yy(0));g.lineTo(w-Rr,Yy(0));g.stroke();}
  g.fillText(fmt(hi,2),2,T+8);g.fillText(fmt(lo,2),2,h-B);g.fillText('t='+tMax.toFixed(1),w-60,h-3);
  defs.forEach((d,k)=>{g.strokeStyle=d.color;g.lineWidth=d.w||2;g.setLineDash(d.dash||[]);g.beginPath();
    data[k].forEach((v,i)=>{const x=X(ts[i]),y=Yy(v);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.setLineDash([]);});
  const tc=H.get(S.cur).t;g.strokeStyle=C.ink;g.lineWidth=1.5;g.beginPath();g.moveTo(X(tc),T);g.lineTo(X(tc),h-B);g.stroke();
  let lx=L+4;defs.forEach(d=>{g.fillStyle=d.color;g.fillText(d.name,lx,h-3);lx+=g.measureText(d.name).width+10;});
}
export function drawPlots(){
  plotSeries('gR',[{f:s=>Math.hypot(s.x,s.y),color:C.ink,name:'r'}]);
  plotSeries('gV',[{f:s=>Math.hypot(s.vx,s.vy),color:C.vel,name:'v'}],{zero:true});
  const Eu=.5;
  plotSeries('gE',[{f:s=>.5*(s.vx*s.vx+s.vy*s.vy)/Eu,color:C.kin,name:'K'},{f:s=>-1/Math.hypot(s.x,s.y)/Eu,color:C.pot,dash:[6,3],name:'U'},{f:s=>CORE.energy(s.x,s.y,s.vx,s.vy).E/Eu,color:C.tot,dash:[2,3],w:2.5,name:'E'}],{zero:true});
  if(feat('veff'))drawVeff();
}
export function drawVeff(){
  const cvs=$('#gVeff');if(!cvs||cvs.offsetParent===null)return;
  const g=cvs.getContext('2d'),w=cvs.clientWidth,h=cvs.clientHeight,q=viewState(),I=CORE.info(q.x,q.y,q.vx,q.vy,q.pad);
  g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=C.surface;g.fillRect(0,0,w,h);
  const rmax=Math.max(4,Math.min(12,I.r*1.5)),lo=-1.2,hi=0.8,L=34,B=14,T=6,X=r=>L+(r-1)/(rmax-1)*(w-L-6),Y=v=>T+(hi-clamp(v,lo,hi))/(hi-lo)*(h-T-B);
  g.strokeStyle=C.gridline;g.beginPath();g.moveTo(L,Y(0));g.lineTo(w,Y(0));g.stroke();
  g.fillStyle=C.muted;g.font='10px "Space Mono",monospace';g.fillText('0',L-12,Y(0)+3);g.fillText('r →',w-28,h-2);
  g.strokeStyle=C.ink;g.lineWidth=2;g.beginPath();
  for(let i=0;i<=200;i++){const r=1+i/200*(rmax-1),v=I.hz*I.hz/(2*r*r)-1/r;const x=X(r),y=Y(v);i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
  g.strokeStyle=C.tot;g.setLineDash([2,3]);g.lineWidth=2.5;g.beginPath();g.moveTo(L,Y(I.eps));g.lineTo(w,Y(I.eps));g.stroke();g.setLineDash([]);
  g.fillStyle=C.ship;g.strokeStyle=C.ink;g.beginPath();g.arc(X(Math.min(I.r,rmax)),Y(I.eps),6,0,Math.PI*2);g.fill();g.stroke();
}
// ---- thrust-program editors ----
export const PGS={a:{id:'pcA',key:'a',lo:0,hi:3.2},t:{id:'pcT',key:'th',lo:-5,hi:95}};
export const pgX=(cv,u)=>14+u*(cv.clientWidth-26), pgY=(cv,p,v)=>8+(p.hi-v)/(p.hi-p.lo)*(cv.clientHeight-24);
export function drawProg(){
  for(const k in PGS){
    const p=PGS[k],cvs=$('#'+p.id);if(!cvs||cvs.offsetParent===null)continue;
    const g=cvs.getContext('2d'),w=cvs.clientWidth,h=cvs.clientHeight;
    g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=C.surface;g.fillRect(0,0,w,h);
    g.font='10px "Space Mono",monospace';g.fillStyle=C.muted;g.strokeStyle=C.gridline;g.lineWidth=1;
    const ticks=k==='a'?[0,1,2,3]:[0,30,60,90];
    for(const tv of ticks){const y=pgY(cvs,p,tv);g.beginPath();g.moveTo(14,y);g.lineTo(w-12,y);g.stroke();g.fillText(String(tv),0,y+3);}
    if(k==='a'){const gr=1/((1+S.h)*(1+S.h)),y=pgY(cvs,p,gr);g.strokeStyle=C['c-crash'];g.setLineDash([5,4]);g.lineWidth=1.5;g.beginPath();g.moveTo(14,y);g.lineTo(w-12,y);g.stroke();g.setLineDash([]);g.fillStyle=C['c-crash'];g.fillText('gravity here',w-92,y-3);}
    g.fillStyle=C.muted;g.fillText('0',14,h-3);g.fillText(S.prog.burn.toFixed(1),w-30,h-3);
    const pts=S.prog[p.key];g.strokeStyle=C.thr;g.lineWidth=2.5;g.beginPath();
    pts.forEach((q,i)=>{const x=pgX(cvs,q[0]),y=pgY(cvs,p,q[1]);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
    pts.forEach(q=>{const x=pgX(cvs,q[0]),y=pgY(cvs,p,q[1]);g.fillStyle=C.surface;g.strokeStyle=C.ink;g.lineWidth=2;g.fillRect(x-6,y-6,12,12);g.strokeRect(x-6,y-6,12,12);});
  }
}
