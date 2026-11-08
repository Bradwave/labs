// Orbit Lab · render/canvas-view.js
// Main canvas: camera, planet, tower, predicted orbit, trails, target and ship.

import { targetAt } from '../chase.js';
import { H } from '../core/history.js';
import { CORE } from '../core/index.js';
import { conic, info } from '../core/orbit.js';
import { drawVectors } from './vectors.js';
import { S, atEnd, feat, viewState } from '../state.js';
import { $ } from '../util.js';
/* ============================== RENDER: main canvas ============================== */
export const cv=$('#cv'),ctx=cv.getContext('2d'),eb=$('#ebars'),ectx=eb.getContext('2d'),camcv=$('#camcv'),cctx=camcv.getContext('2d');
export let dpr=1,W=300,Hh=300;
export const C={};
export function readColors(){const cs=getComputedStyle(document.documentElement);
  for(const k of['surface','ink','muted','accent','onaccent','gridline','kin','pot','tot','vel','grav','thr','net','planet','planet2','space','ship','bg','tile2',
    'c-circle','c-ellipse','c-parab','c-hyper','c-crash'])C[k]=cs.getPropertyValue('--'+k).trim();}
export function resize(){
  dpr=window.devicePixelRatio||1;
  W=Math.max(60,cv.clientWidth);Hh=Math.max(60,cv.clientHeight);cv.width=Math.round(W*dpr);cv.height=Math.round(Hh*dpr);
  eb.width=Math.round(eb.clientWidth*dpr);eb.height=Math.round(eb.clientHeight*dpr);
  camcv.width=Math.round(camcv.clientWidth*dpr);camcv.height=Math.round(camcv.clientHeight*dpr);
  for(const id of['gR','gV','gE','gVeff','pcA','pcT']){const c=$('#'+id);if(c){c.width=Math.round(c.clientWidth*dpr);c.height=Math.round(c.clientHeight*dpr);}}
}
export const V=S.view;
export const w2s=(x,y)=>[W/2+(x-V.cx)*V.s,Hh/2-(y-V.cy)*V.s];
export const s2w=(sx,sy)=>[V.cx+(sx-W/2)/V.s,V.cy-(sy-Hh/2)/V.s];
export const orbitColor=I=>I.crash?C['c-crash']:I.type==='circle'?C['c-circle']:I.type==='ellipse'?C['c-ellipse']:I.type==='parabola'?C['c-parab']:I.type==='hyperbola'?C['c-hyper']:C['c-crash'];
export function fitView(info,conic){
  let x0=-1.2,x1=1.2,y0=-1.2,y1=1.2;
  const add=(x,y)=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);};
  add(0,1+S.h+0.25);
  if(S.chase.on){const t=targetAt(viewState().t);add(t.x,t.y);add(-t.r*Math.sin(0),t.r);}
  if(info&&conic) for(const p of conic.pts){if(Math.hypot(p[0],p[1])<=6)add(p[0],p[1]);}
  if(info) add(info.x,info.y);
  if(S.preview) for(const p of S.preview.pts)add(p[0],p[1]);
  const m=1.12,cw=(x1-x0)*m,ch=(y1-y0)*m;
  V.cx=(x0+x1)/2;V.cy=(y0+y1)/2;V.s=Math.min(W/cw,Hh/ch);
}
// Path through world points, skipping stretches that lie far outside the canvas (avoids dash shimmer and precision loss at high zoom)
export function tracePath(pts){
  const m=200;let prev=null,prevOut=true,pen=false;
  for(const p of pts){
    const [x,y]=w2s(p[0],p[1]),out=x<-m||x>W+m||y<-m||y>Hh+m;
    if(prev){
      if(out&&prevOut)pen=false;
      else{if(!pen)ctx.moveTo(prev[0],prev[1]);ctx.lineTo(x,y);pen=true;}
    }
    prev=[x,y];prevOut=out;
  }
}
export function drawPlanet(){
  const [px,py]=w2s(0,0),rp=V.s;
  ctx.save();
  ctx.fillStyle=C.planet;ctx.strokeStyle=C.ink;ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(px,py,rp,0,Math.PI*2);ctx.fill();
  // landmarks: patches and ticks so that position is legible
  ctx.save();ctx.beginPath();ctx.arc(px,py,rp,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=C.planet2;
  for(const [a,w] of [[20,22],[150,30],[215,18],[300,26]]){ctx.beginPath();ctx.arc(px,py,rp*1.0,-(a+w)*Math.PI/180,-(a-w)*Math.PI/180);ctx.arc(px,py,rp*.78,-(a-w)*Math.PI/180,-(a+w)*Math.PI/180,true);ctx.closePath();ctx.fill();}
  ctx.strokeStyle=C.ink;ctx.globalAlpha=.5;ctx.lineWidth=1.5;
  for(let a=0;a<360;a+=15){const c=Math.cos(a*Math.PI/180),s=-Math.sin(a*Math.PI/180),l=a%90===0?.2:.08;ctx.beginPath();ctx.moveTo(px+c*rp,py+s*rp);ctx.lineTo(px+c*rp*(1-l),py+s*rp*(1-l));ctx.stroke();}
  ctx.restore();
  ctx.beginPath();ctx.arc(px,py,rp,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
export function drawTower(){
  const hh=S.h,[bx,by]=w2s(0,1),[tx,ty]=w2s(0,1+hh),half=Math.max(3,0.03*V.s);
  ctx.save();ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.fillStyle=C.surface;
  if(hh>0.001){
    ctx.beginPath();ctx.moveTo(bx-half,by);ctx.lineTo(tx-half,ty);ctx.moveTo(bx+half,by);ctx.lineTo(tx+half,ty);ctx.stroke();
    const n=Math.max(2,Math.round(Math.abs(by-ty)/(half*3)));
    ctx.lineWidth=1.2;ctx.beginPath();
    for(let i=0;i<n;i++){const y0=by+(ty-by)*i/n,y1=by+(ty-by)*(i+1)/n;ctx.moveTo(bx-half,y0);ctx.lineTo(tx+half,y1);ctx.moveTo(bx+half,y0);ctx.lineTo(tx-half,y1);}
    ctx.stroke();
  }
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(tx-half*2.2,ty);ctx.lineTo(tx+half*2.2,ty);ctx.stroke();
  ctx.restore();
}
export function drawConic(I,K){
  if(!S.show.orbit||!K||K.pts.length<2)return;
  ctx.save();ctx.strokeStyle=orbitColor(I);ctx.lineWidth=2.2;ctx.setLineDash([7,5]);ctx.beginPath();
  tracePath(K.pts);ctx.stroke();ctx.setLineDash([]);
  const dot=(p,fill)=>{if(!p)return;const [x,y]=w2s(p[0],p[1]);ctx.beginPath();ctx.arc(x,y,5.5,0,Math.PI*2);ctx.fillStyle=fill?C.ink:C.surface;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=C.ink;ctx.stroke();};
  dot(K.peri,true);dot(K.apo,false);
  if(K.impact){const [x,y]=w2s(K.impact[0],K.impact[1]);ctx.strokeStyle=C['c-crash'];ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(x-7,y-7);ctx.lineTo(x+7,y+7);ctx.moveTo(x+7,y-7);ctx.lineTo(x-7,y+7);ctx.stroke();}
  ctx.restore();
}
export function trailPts(maxN=2500){
  const n=S.cur+1,stride=Math.max(1,Math.floor(n/maxN)),pts=[];
  for(let i=0;i<n;i+=stride){const q=H.get(i);pts.push([q.x,q.y,q.t]);}
  const q=H.get(S.cur);pts.push([q.x,q.y,q.t]);return pts;
}
export function drawTrail(pts){
  if(!S.show.trail||pts.length<2)return;
  ctx.save();ctx.strokeStyle=C.ink;ctx.globalAlpha=.75;ctx.lineWidth=2;ctx.beginPath();
  tracePath(pts);ctx.stroke();ctx.restore();
}
export function drawKepler(pts,q){
  if(!feat('kepler')||(!S.show.strobe&&!S.show.wedge)||pts.length<2)return;
  const dt=S.kep, t1=q.t;
  const at=t=>{ // position at time t from history by bisection on index (t is non-decreasing)
    let lo=0,hi=S.cur;while(lo<hi){const m=(lo+hi)>>1;if(H.get(m).t<t)lo=m+1;else hi=m;}const a=H.get(lo);return[a.x,a.y];};
  ctx.save();
  const [px,py]=w2s(0,0);
  for(let k=0;k*dt<=t1+1e-9;k++){
    const t=k*dt, p=at(t);
    if(S.show.wedge&&t+dt<=t1+1e-9){
      const a=Math.atan2(p[1],p[0]);const q2=at(t+dt),b=Math.atan2(q2[1],q2[0]);
      ctx.beginPath();ctx.moveTo(px,py);
      // polygon along the path between t and t+dt
      let lo=0,hi=S.cur;while(lo<hi){const m=(lo+hi)>>1;if(H.get(m).t<t)lo=m+1;else hi=m;}
      let hi2=lo;while(hi2<S.cur&&H.get(hi2).t<t+dt)hi2++;
      const step=Math.max(1,Math.floor((hi2-lo)/30));
      for(let i=lo;i<=hi2;i+=step){const g=H.get(i),[x,y]=w2s(g.x,g.y);ctx.lineTo(x,y);}
      ctx.closePath();ctx.globalAlpha=.22;ctx.fillStyle=k%2?C.kin:C.pot;ctx.fill();ctx.globalAlpha=.7;ctx.strokeStyle=C.ink;ctx.lineWidth=1;ctx.stroke();
      void a;void b;
    }
    if(S.show.strobe){const [x,y]=w2s(p[0],p[1]);ctx.globalAlpha=1;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=C.ship;ctx.fill();ctx.strokeStyle=C.ink;ctx.lineWidth=1.5;ctx.stroke();}
  }
  ctx.restore();
}
export function drawTarget(q){
  const t=targetAt(q.t),[px,py]=w2s(0,0),[x,y]=w2s(t.x,t.y),[sx,sy]=w2s(q.x,q.y);
  ctx.save();
  if(t.r*V.s<2500){ctx.strokeStyle=C.muted;ctx.globalAlpha=.55;ctx.lineWidth=1.5;ctx.setLineDash([2,6]);ctx.beginPath();ctx.arc(px,py,t.r*V.s,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
  ctx.strokeStyle=C.muted;ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
  const ang=Math.atan2(-t.vy,t.vx);ctx.translate(x,y);ctx.rotate(ang);
  ctx.fillStyle=C.surface;ctx.strokeStyle=C.ink;ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-7,-7);ctx.lineTo(-4,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.rotate(-ang);ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=C.ink;ctx.font='700 11px "Space Mono",monospace';ctx.fillText('target',18,-12);
  ctx.restore();
}
export function drawShip(q,I,cmd){
  const [x,y]=w2s(q.x,q.y);
  let ang;
  if(q.pad||Math.hypot(q.vx,q.vy)<1e-9)ang=Math.atan2(-(q.y),q.x)+Math.PI; // pointing away from the planet
  else ang=Math.atan2(-q.vy,q.vx);
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  const th=cmd&&cmd.k&&cmd.a>0;
  if(th){ // flame opposite to the thrust direction
    const t=CORE.thrustAcc(q.x,q.y,q.vx,q.vy,cmd), fa=Math.atan2(-t[1],t[0])-ang+Math.PI;
    ctx.save();ctx.rotate(fa);ctx.fillStyle=C.accent;ctx.strokeStyle=C.ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,-4);ctx.lineTo(-5-8-Math.min(20,cmd.a*40),0);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  ctx.fillStyle=C.ship;ctx.strokeStyle=C.ink;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-7,-7);ctx.lineTo(-4,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.restore();
}
export function drawGrid(){
  ctx.save();ctx.strokeStyle=C.gridline;ctx.lineWidth=1;ctx.beginPath();
  const [a,b]=s2w(0,Hh),[c,d]=s2w(W,0);
  for(let x=Math.ceil(a);x<=c;x++){const [sx]=w2s(x,0);ctx.moveTo(sx,0);ctx.lineTo(sx,Hh);}
  for(let y=Math.ceil(b);y<=d;y++){const [,sy]=w2s(0,y);ctx.moveTo(0,sy);ctx.lineTo(W,sy);}
  ctx.stroke();ctx.restore();
}
export function drawMain(F){
  const {q,I,K,cmd}=F;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,Hh);
  ctx.fillStyle=C.space;ctx.fillRect(0,0,W,Hh);
  if(S.show.grid)drawGrid();
  drawPlanet();drawTower();
  if(S.show.ghosts)for(const g of S.ghosts){ctx.save();ctx.strokeStyle=C.muted;ctx.globalAlpha=.45;ctx.lineWidth=1.5;ctx.beginPath();tracePath(g);ctx.stroke();ctx.restore();}
  if(S.preview&&S.phase==='prep'){ctx.save();ctx.strokeStyle=C.thr;ctx.lineWidth=2.5;ctx.setLineDash([2,4]);ctx.beginPath();S.preview.pts.forEach((p,i)=>{const [x,y]=w2s(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.restore();}
  drawConic(I,K);
  if(S.chase.on)drawTarget(q);
  const pts=trailPts();drawTrail(pts);drawKepler(pts,q);
  if(S.show.nog&&S.v0vec&&S.launchMode!=='program'&&S.phase==='flying'){
    const h0=H.get(0),gx=h0.x+S.v0vec[0]*q.t,gy=h0.y+S.v0vec[1]*q.t,[a,b]=w2s(gx,gy),[c,d]=w2s(q.x,q.y);
    ctx.save();ctx.strokeStyle=C.muted;ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(...w2s(h0.x,h0.y));ctx.lineTo(a,b);ctx.stroke();
    ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.lineWidth=2.5;ctx.strokeStyle=C.grav;ctx.stroke();
    ctx.beginPath();ctx.arc(a,b,6,0,Math.PI*2);ctx.fillStyle=C.surface;ctx.fill();ctx.strokeStyle=C.muted;ctx.setLineDash([3,3]);ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  if(S.crashed&&atEnd()){const [x,y]=w2s(S.crashed.x,S.crashed.y);ctx.save();ctx.strokeStyle=C['c-crash'];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-9,y-9);ctx.lineTo(x+9,y+9);ctx.moveTo(x+9,y-9);ctx.lineTo(x-9,y+9);ctx.stroke();ctx.restore();}
  drawVectors(q,cmd);drawShip(q,I,cmd);
}
