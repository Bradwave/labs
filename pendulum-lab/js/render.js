// Pendulum Lab · render.js
// Drawing: supports, ropes, spring, balls, liquid, force arrows, third-law pairs, polygon, energy bars.
import { phone } from './data.js';
import { FL } from './fluid.js';
import { LY, P, S, coupled } from './state.js';
import { TAU, clamp, ease, fmt, lerp, mag } from './util.js';
import { t } from '../../kit/kit.js';
import { C, H, W, cam, ctx, dpr, eb, ectx, rbBall, rbLab, s2w, updateCam, v2s, w2s } from './view.js';

// ---------- drawing helpers ----------
export const FONT='700 11px "Space Mono",ui-monospace,monospace';
export function arrow(x0,y0,dx,dy,col,o={}){
  let L=Math.hypot(dx,dy);if(L<1.5)return null;
  const maxL=o.max||Math.min(W,H)*.46;let cut=false;if(L>maxL){dx*=maxL/L;dy*=maxL/L;L=maxL;cut=true;}
  const w=o.w||3,hl=Math.min(10+w,L*.6),ux=dx/L,uy=dy/L,x1=x0+dx,y1=y0+dy,bx=x1-ux*hl,by=y1-uy*hl,hw=hl*.55;
  ctx.save();ctx.globalAlpha=o.alpha||1;ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=w;
  if(o.dash)ctx.setLineDash(o.dash);
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(bx,by);ctx.stroke();ctx.setLineDash([]);
  if(cut){ctx.lineWidth=2;ctx.strokeStyle=C.surface;const mx=x0+dx*.55,my=y0+dy*.55;ctx.beginPath();ctx.moveTo(mx-uy*7-ux*3,my+ux*7-uy*3);ctx.lineTo(mx+uy*7-ux*3,my-ux*7-uy*3);ctx.moveTo(mx-uy*7+ux*3,my+ux*7+uy*3);ctx.lineTo(mx+uy*7+ux*3,my-ux*7+uy*3);ctx.stroke();ctx.strokeStyle=col;}
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(bx-uy*hw,by+ux*hw);ctx.lineTo(bx+uy*hw,by-ux*hw);ctx.closePath();
  if(o.hollow){ctx.fillStyle=C.surface;ctx.fill();ctx.lineWidth=2;ctx.stroke();}else ctx.fill();
  ctx.restore();
  if(o.label)tag(x1+ux*10,y1+uy*10,o.label,col,o.badge,ux,uy);
  return[x1,y1];
}
export const placed=[];
export function tag(x,y,text,col,badge,ux=0,uy=0){
  ctx.save();ctx.font=FONT;const tw=ctx.measureText(text).width,bw=badge?16:0,w=tw+bw,h=14;
  let lx=x-(ux<-.3?w:ux>.3?0:w/2),ly=y+(uy>.3?h*.8:uy<-.3?0:h*.35);
  for(let k=0;k<6;k++){const hit=placed.find(p=>lx<p[0]+p[2]&&lx+w>p[0]&&ly-h<p[1]&&ly>p[1]-p[3]);if(!hit)break;ly+=(uy<0?-1:1)*(h+1);}
  placed.push([lx,ly,w,h]);
  ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle=C.surface;ctx.strokeText(text,lx+bw,ly);ctx.fillStyle=col;ctx.fillText(text,lx+bw,ly);
  if(badge){ctx.fillStyle=col;ctx.fillRect(lx,ly-11,13,13);ctx.fillStyle=C.surface;ctx.font='700 10px "Space Mono",monospace';ctx.fillText(badge,lx+3.5,ly-1);}
  ctx.restore();
}
export const lbl=(name,mag,unit)=>LY.values?`${name} ${fmt(mag)} ${unit}`:name;

// ---------- main draw ----------
export function draw(A){
  placed.length=0;updateCam(A);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=C.surface;ctx.fillRect(0,0,W,H);
  const ballView=S.view==='ball'&&S.vt>.5,e=ease(S.vt),mn=Math.min(W,H),gRef=Math.max(P.g,1);
  if(LY.grid)drawGrid();
  const two=A.length>1;
  const PS=A.map(o=>w2s(o.pv[0],o.pv[1])),BS=A.map(o=>w2s(o.x,o.y)),RBs=A.map((o,n)=>n===0?lerp(rbLab(0),rbBall(),e):rbLab(1)*lerp(1,Math.min(2,cam.s/(cam.labS||cam.s)),e));
  A.forEach((o,n)=>drawSupport(PS[n],o.p.i===0&&LY.drive));
  if(LY.earth&&S.vt<.5)drawEarth(A);
  if(LY.trail)for(const o of A){const tr=o.p.trail;if(tr.length<2)continue;ctx.save();ctx.lineWidth=2;ctx.lineCap='round';
    for(let i=1;i<tr.length;i++){const a=w2s(...tr[i-1]),b=w2s(...tr[i]);ctx.globalAlpha=i/tr.length*.7;ctx.strokeStyle=o.p.i?C.ball2:C.muted;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}ctx.restore();}
  A.forEach((o,n)=>drawRope(o,PS[n],BS[n],RBs[n]));
  if(coupled())drawSpring(A,BS,RBs);
  if(two)drawBall(A[1],BS[1],RBs[1],false);
  drawBall(A[0],BS[0],RBs[0],LY.fluid);
  if(two&&S.vt<.5){tag(BS[0][0],BS[0][1]-RBs[0]-8,'A',C.ink,null,0,-1);tag(BS[1][0],BS[1][1]-RBs[1]-8,'B',C.ink,null,0,-1);}
  const zf=lerp(1,Math.max(1,rbBall()*1.9/(mn*.13)),e);
  const kF=zf*P.arrow*mn*.13/(P.m*gRef),kV=P.arrow*mn*.11/Math.sqrt(gRef*P.L),kA=zf*P.arrow*mn*.13/gRef;
  const F=(v,k=kF)=>v2s(v[0]*k,v[1]*k);
  const pairs=LY.pairs;
  // pendulum B: its own forces (same switches), no decomposition
  if(two){const o=A[1],Bs=BS[1];
    if(LY.W){const v=F(o.W);arrow(Bs[0],Bs[1],v[0],v[1],C.wt,{label:lbl('W',mag(o.W),'N')});}
    if(LY.R&&Math.abs(o.T)>1e-6){const v=F(o.R);arrow(Bs[0],Bs[1],v[0],v[1],C.ten,{label:lbl('T',Math.abs(o.T),'N')});}
    if(LY.D&&mag(o.D)>1e-4*o.m*gRef){const v=F(o.D);arrow(Bs[0],Bs[1],v[0],v[1],C.drag,{label:lbl('D',mag(o.D),'N')});}
    if(LY.S&&coupled()&&mag(o.Fs)>1e-4){const v=F(o.Fs);arrow(Bs[0],Bs[1],v[0],v[1],C.spr,{hollow:true,label:lbl('spring→B',mag(o.Fs),'N'),badge:pairs?'4':null});}
    if(LY.vel&&!ballView){const v=v2s(o.vx*kV,o.vy*kV);arrow(Bs[0],Bs[1],v[0],v[1],C.vel,{w:4,label:lbl('v',o.sp,'m/s')});}
  }
  const o=A[0],Bs=BS[0],Ps=PS[0],rb=RBs[0];
  const u=v2s(o.ux,o.uy),p=v2s(o.px,o.py);
  if(LY.decomp&&(LY.W||LY.net||LY.app&&ballView)){
    ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle=C.muted;ctx.lineWidth=1.3;const ax=mn*.38;
    ctx.beginPath();ctx.moveTo(Bs[0]-u[0]*ax,Bs[1]-u[1]*ax);ctx.lineTo(Bs[0]+u[0]*ax,Bs[1]+u[1]*ax);ctx.moveTo(Bs[0]-p[0]*ax,Bs[1]-p[1]*ax);ctx.lineTo(Bs[0]+p[0]*ax,Bs[1]+p[1]*ax);ctx.stroke();ctx.restore();
    tag(Bs[0]+u[0]*(ax+4),Bs[1]+u[1]*(ax+4),'∥ rope',C.muted,null,u[0],u[1]);
    tag(Bs[0]+p[0]*(ax+4),Bs[1]+p[1]*(ax+4),'⊥ rope',C.muted,null,p[0],p[1]);
  }
  const comp=(vec,col,name,k)=>{
    const a=vec[0]*u[0]+vec[1]*u[1],b=vec[0]*p[0]+vec[1]*p[1];
    ctx.save();ctx.setLineDash([2,3]);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.globalAlpha=.7;
    ctx.beginPath();ctx.moveTo(Bs[0]+vec[0],Bs[1]+vec[1]);ctx.lineTo(Bs[0]+u[0]*a,Bs[1]+u[1]*a);ctx.moveTo(Bs[0]+vec[0],Bs[1]+vec[1]);ctx.lineTo(Bs[0]+p[0]*b,Bs[1]+p[1]*b);ctx.stroke();ctx.restore();
    arrow(Bs[0],Bs[1],u[0]*a,u[1]*a,col,{w:2,dash:[6,3],alpha:.9,label:LY.values?`${name}∥ ${fmt(Math.abs(a)/k)}`:name+'∥'});
    arrow(Bs[0],Bs[1],p[0]*b,p[1]*b,col,{w:2,dash:[6,3],alpha:.9,label:LY.values?`${name}⊥ ${fmt(Math.abs(b)/k)}`:name+'⊥'});
  };
  if(LY.W){const v=F(o.W);arrow(Bs[0],Bs[1],v[0],v[1],C.wt,{label:lbl('W',mag(o.W),'N'),badge:pairs&&LY.earth&&!ballView?'3':null});if(LY.decomp)comp(v,C.wt,'W',kF);}
  if(LY.R&&mag(o.R)>1e-6){const v=F(o.R);arrow(Bs[0],Bs[1],v[0],v[1],C.ten,{label:lbl(o.T<0?'T push':'T',mag(o.R),'N'),badge:pairs&&LY.ropeEnds?'1':null});}
  if(LY.D&&mag(o.D)>1e-4*P.m*gRef){const v=F(o.D);arrow(Bs[0],Bs[1],v[0],v[1],C.drag,{label:lbl('D',mag(o.D),'N')});}
  if(LY.S&&coupled()&&mag(o.Fs)>1e-4){const v=F(o.Fs);arrow(Bs[0],Bs[1],v[0],v[1],C.spr,{label:lbl('spring→A',mag(o.Fs),'N'),badge:pairs?'4':null});}
  if(!ballView){
    if(LY.net){const v=F(o.N);arrow(Bs[0],Bs[1],v[0],v[1],C.ink,{w:4,label:lbl('ΣF',mag(o.N),'N')});if(LY.decomp)comp(v,C.ink,'ΣF',kF);}
    if(LY.acc){const v=F(o.a,kA);arrow(Bs[0],Bs[1],v[0],v[1],C.acc,{w:3,dash:[9,4],label:lbl('a',mag(o.a),'m/s²')});}
    if(LY.accComp){const at=v2s(o.px*o.at*kA,o.py*o.at*kA),ac=v2s(-o.ux*o.ac*kA,-o.uy*o.ac*kA);
      arrow(Bs[0],Bs[1],at[0],at[1],C.acc,{w:2,dash:[4,3],label:lbl('aₜ',Math.abs(o.at),'m/s²')});
      arrow(Bs[0],Bs[1],ac[0],ac[1],C.acc,{w:2,dash:[4,3],label:lbl('a꜀',Math.abs(o.ac),'m/s²')});}
    if(LY.vel){const v=v2s(o.vx*kV,o.vy*kV);arrow(Bs[0],Bs[1],v[0],v[1],C.vel,{w:4,label:lbl('v',o.sp,'m/s')});}
  }else{
    const fa=[-P.m*o.a[0],-P.m*o.a[1]];
    if(LY.app){const v=F(fa);arrow(Bs[0],Bs[1],v[0],v[1],C.app,{w:4,dash:[10,5],label:lbl('−ma',mag(fa),'N')});if(LY.decomp)comp(v,C.app,'−ma',kF);}
    if(LY.appComp){const cf=v2s(o.ux*P.m*o.ac*kF,o.uy*P.m*o.ac*kF),tg=v2s(-o.px*P.m*o.at*kF,-o.py*P.m*o.at*kF);
      arrow(Bs[0],Bs[1],cf[0],cf[1],C.app,{w:2.5,dash:[4,3],label:lbl('F centrifugal',Math.abs(P.m*o.ac),'N')});
      arrow(Bs[0],Bs[1],tg[0],tg[1],C.app,{w:2.5,dash:[4,3],label:lbl('F tangential',Math.abs(P.m*o.at),'N')});}
    if(LY.frameAcc){const v=F(o.a,kA);arrow(Bs[0],Bs[1],v[0],v[1],C.acc,{w:3,dash:[2,4],label:lbl('a frame',mag(o.a),'m/s²')});}
    if(LY.geff){const v=F(o.geff,kA);arrow(Bs[0],Bs[1],v[0],v[1],C.liquid,{w:3,label:lbl('g−a',mag(o.geff),'m/s²')});}
  }
  if(LY.speed&&!ballView)tag(Bs[0]+rb+6,Bs[1]+rb+12,`|v| = ${o.sp.toFixed(2)} m/s`,C.vel,null,1,0);
  if(LY.phone)drawPhone(o,Bs,rb);
  // third law on the rope and the support
  if(mag(o.R)>1e-6&&(LY.ropeEnds||LY.support)){
    const Rv=F(o.R),off=10,Lr=Math.hypot(Bs[0]-Ps[0],Bs[1]-Ps[1])||1,ex=(Bs[0]-Ps[0])/Lr,ey=(Bs[1]-Ps[1])/Lr,nx=-ey,ny=ex;
    if(LY.ropeEnds){
      const ax=Bs[0]-ex*rb+nx*off,ay=Bs[1]-ey*rb+ny*off; // ball pulls the rope: −R, head at the rope's lower end
      arrow(ax+Rv[0],ay+Rv[1],-Rv[0],-Rv[1],C.ten,{w:2.5,hollow:true,label:lbl('ball→rope',mag(o.R),'N'),badge:pairs?'1':null});
      const tx=Ps[0]+nx*off,ty=Ps[1]+ny*off; // support pulls the rope: +R, head at the top
      arrow(tx-Rv[0],ty-Rv[1],Rv[0],Rv[1],C.ten,{w:2.5,label:lbl('support→rope',mag(o.R),'N'),badge:pairs&&LY.support?'2':null});
    }
    if(LY.support){const tx=Ps[0]-nx*off,ty=Ps[1]-ny*off;
      arrow(tx,ty,-Rv[0],-Rv[1],C.ten,{w:2.5,hollow:true,label:lbl('rope→support',mag(o.R),'N'),badge:pairs&&LY.ropeEnds?'2':null});}
  }
  if(LY.polygon)drawPolygon(o,ballView);
  drawEnergy(A);
}
export function drawGrid(){
  const sp=[.01,.02,.05,.1,.2,.5,1,2,5].find(d=>d*cam.s>=30)||5;
  const cs=[[0,0],[W,0],[0,H],[W,H]].map(p=>s2w(p[0],p[1]));
  const x0=Math.min(...cs.map(c=>c[0])),x1=Math.max(...cs.map(c=>c[0])),y0=Math.min(...cs.map(c=>c[1])),y1=Math.max(...cs.map(c=>c[1]));
  if((x1-x0)/sp>400||(y1-y0)/sp>400)return;
  ctx.beginPath();
  for(let i=Math.floor(x0/sp);i<=Math.ceil(x1/sp);i++){const a=w2s(i*sp,y0),b=w2s(i*sp,y1);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
  for(let j=Math.floor(y0/sp);j<=Math.ceil(y1/sp);j++){const a=w2s(x0,j*sp),b=w2s(x1,j*sp);ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
  ctx.strokeStyle=C.gridline;ctx.lineWidth=1;ctx.stroke();
  if(S.vt<.5&&H>200&&!LY.polygon){
    const L=[.05,.1,.2,.5,1,2].find(v=>v*cam.s>=50)||2,bx=12,by=H-14,bw=L*cam.s;
    ctx.strokeStyle=C.ink;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(bx,by-5);ctx.lineTo(bx,by);ctx.lineTo(bx+bw,by);ctx.lineTo(bx+bw,by-5);ctx.stroke();
    ctx.fillStyle=C.ink;ctx.font=FONT;ctx.fillText(L<1?Math.round(L*100)+' cm':fmt(L,0)+' m',bx+bw+6,by+1);
  }
}
export function drawSupport(Ps,driven){
  ctx.save();
  if(driven){const R=w2s(0,0);ctx.translate(R[0],R[1]);}else ctx.translate(Ps[0],Ps[1]);
  ctx.rotate(-cam.rot);
  const w=Math.max(70,Math.min(140,cam.s*.25));
  ctx.fillStyle=C.surface;ctx.fillRect(-w/2,-26,w,14);
  ctx.beginPath();for(let x=-w/2;x<w/2;x+=9){ctx.moveTo(x,-12);ctx.lineTo(x+9,-26);}ctx.strokeStyle=C.muted;ctx.lineWidth=1.3;ctx.stroke();
  ctx.strokeStyle=C.ink;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w/2,-12);ctx.lineTo(w/2,-12);ctx.stroke();
  if(driven){ // rail and moving cart
    const a=P.dA*cam.s+14;ctx.strokeStyle=C.muted;ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();
    if(P.dDir==='h'){ctx.moveTo(-a,0);ctx.lineTo(a,0);}else{ctx.moveTo(0,-a);ctx.lineTo(0,a);}ctx.stroke();ctx.setLineDash([]);
    ctx.restore();ctx.save();ctx.translate(Ps[0],Ps[1]);ctx.rotate(-cam.rot);
    ctx.fillStyle=C.accent;ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.fillRect(-13,-9,26,12);ctx.strokeRect(-13,-9,26,12);
  }else{ctx.fillStyle=C.ink;ctx.fillRect(-9,-12,18,8);}
  ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fillStyle=C.surface;ctx.fill();ctx.strokeStyle=C.ink;ctx.lineWidth=2.5;ctx.stroke();
  ctx.restore();
}
export function drawEarth(A){
  const y=H-6,gw=Math.min(W*.6,360),x0=W/2-gw/2,al=1-S.vt*2;
  ctx.save();ctx.globalAlpha=al*.18;ctx.fillStyle=C.wt;ctx.fillRect(x0,y-10,gw,16);ctx.globalAlpha=al;
  ctx.strokeStyle=C.wt;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x0,y-10);ctx.lineTo(x0+gw,y-10);ctx.stroke();
  ctx.fillStyle=C.wt;ctx.font=FONT;ctx.textAlign='right';ctx.fillText(t('r.earth'),x0+gw-6,y+2);ctx.restore();
  const len=P.arrow*Math.min(W,H)*.13*P.g/Math.max(P.g,1);
  if(len>2)arrow(W/2,y-10,0,-len,C.wt,{w:3,hollow:true,label:lbl('ball A→Earth',P.m*P.g,'N'),badge:LY.pairs?'3':null});
}
export function mixHex(a,b,t){const pa=hex(a),pb=hex(b);if(!pa||!pb)return b;return`rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(',')})`;}
export function hex(h){h=h.replace('#','');if(h.length!==6)return null;return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
export function ropeColor(o){
  if(!LY.ropeColor)return C.ink;if(o.T<0)return C.wt;
  const f=clamp(o.T/(3*o.m*Math.max(P.g,1)),0,1);return f<.04?C.ink:mixHex(C.ink,C.ten,Math.min(1,.25+f));
}
export function drawRope(o,Ps,Bs,rb){
  const dx=Bs[0]-Ps[0],dy=Bs[1]-Ps[1],d=Math.hypot(dx,dy)||1,ex=dx/d,ey=dy/d,end=[Bs[0]-ex*rb,Bs[1]-ey*rb],col=ropeColor(o),L=o.L;
  ctx.save();ctx.lineCap='round';
  const fl=S.flash[o.p.i];if(fl>0){ctx.globalAlpha=fl;ctx.strokeStyle=C.ten;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(Ps[0],Ps[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();ctx.globalAlpha=1;}
  if(P.model==='rod'){ctx.strokeStyle=col;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(Ps[0],Ps[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();
    ctx.strokeStyle=C.surface;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(Ps[0],Ps[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();}
  else if(o.slack&&o.r<L){
    const r=o.r,sag=Math.sqrt(Math.max(0,3*r*(L-r)/8));
    let nx=-o.uy,ny=o.ux;if(ny>0){nx=-nx;ny=-ny;}if(Math.abs(o.ux)<.02){nx=1;ny=0;}
    const ms=w2s(o.pv[0]+o.q.rx/2+nx*2*sag,o.pv[1]+o.q.ry/2+ny*2*sag);
    ctx.strokeStyle=C.muted;ctx.lineWidth=P.model==='elastic'?3.5:2.5;ctx.beginPath();ctx.moveTo(Ps[0],Ps[1]);ctx.quadraticCurveTo(ms[0],ms[1],end[0],end[1]);ctx.stroke();
  }else{
    const st=P.model==='elastic'?o.r/L:1;
    ctx.strokeStyle=col;ctx.lineWidth=P.model==='elastic'?clamp(4.5/Math.sqrt(st),1.6,4.5):2.5;
    ctx.beginPath();ctx.moveTo(Ps[0],Ps[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();
    if(P.model==='elastic'){const n=10,len=Math.hypot(end[0]-Ps[0],end[1]-Ps[1]);ctx.lineWidth=2;ctx.beginPath();
      for(let i=1;i<n;i++){const t=i/n*len,cx=Ps[0]+ex*t,cy=Ps[1]+ey*t;ctx.moveTo(cx-ey*5,cy+ex*5);ctx.lineTo(cx+ey*5,cy-ex*5);}ctx.stroke();}
  }
  ctx.restore();
}
export function drawSpring(A,BS,RBs){
  const a=BS[0],b=BS[1],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,ex=dx/d,ey=dy/d;
  const s=[a[0]+ex*RBs[0],a[1]+ey*RBs[0]],t=[b[0]-ex*RBs[1],b[1]-ey*RBs[1]],len=Math.hypot(t[0]-s[0],t[1]-s[1]);
  if(len<4)return;const n=14,amp=7,lead=Math.min(10,len*.15);
  ctx.save();ctx.strokeStyle=C.spr;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(s[0],s[1]);
  const p0=[s[0]+ex*lead,s[1]+ey*lead];ctx.lineTo(p0[0],p0[1]);const body=len-2*lead;
  for(let i=1;i<n;i++){const f=i/n,sd=(i%2?1:-1)*amp;ctx.lineTo(p0[0]+ex*body*f-ey*sd,p0[1]+ey*body*f+ex*sd);}
  ctx.lineTo(t[0]-ex*lead,t[1]-ey*lead);ctx.lineTo(t[0],t[1]);ctx.stroke();ctx.restore();
}
// circular segment area for a chord at signed distance d (unit circle), far side
export const segA=d=>Math.acos(d)-d*Math.sqrt(1-d*d);
export function fillD(f){let lo=-1,hi=1;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(segA(m)>f*Math.PI)lo=m;else hi=m;}return(lo+hi)/2;}
export function drawBall(o,Bs,rb,liquid){
  ctx.save();
  if(liquid){
    ctx.beginPath();ctx.arc(Bs[0],Bs[1],rb,0,TAU);ctx.fillStyle=C.surface;ctx.fill();ctx.fillStyle=C.glass;ctx.fill();
    ctx.save();ctx.clip();
    if(P.liquid==='particles'&&FL.ok){
      const c=Math.cos(cam.rot),s=Math.sin(cam.rot),pr=Math.max(1.5,rb*.08);ctx.fillStyle=C.liquid;ctx.beginPath();
      for(let i=0;i<FL.n;i++){const x=FL.x[i],y=FL.y[i],sx=Bs[0]+rb*(x*c-y*s),sy=Bs[1]-rb*(x*s+y*c);ctx.moveTo(sx+pr,sy);ctx.arc(sx,sy,pr,0,TAU);}
      ctx.fill();
      if(rb>30){ctx.fillStyle=C.liquid2;ctx.beginPath();const pr2=pr*.35;for(let i=0;i<FL.n;i+=3){const x=FL.x[i],y=FL.y[i],sx=Bs[0]+rb*(x*c-y*s),sy=Bs[1]-rb*(x*s+y*c);ctx.moveTo(sx+pr2,sy);ctx.arc(sx,sy,pr2,0,TAU);}ctx.fill();}
    }else{
      const n=v2s(Math.cos(S.psi),Math.sin(S.psi)),nl=Math.hypot(n[0],n[1]),nx=n[0]/nl,ny=n[1]/nl,tx=-ny,ty=nx;
      const d=fillD(P.fill),half=Math.sqrt(1-d*d),amp=clamp(Math.abs(S.psid)/18,0,1)*.16,ph=S.rip,pts=[];
      for(let i=0;i<=28;i++){const s=-1.15+2.3*i/28,dd=d+amp*Math.sin(Math.PI*s*1.5+ph)*Math.cos(ph*.7)+amp*.4*Math.sin(TAU*s-ph*1.3);
        pts.push([Bs[0]+rb*(dd*nx+s*half*tx),Bs[1]+rb*(dd*ny+s*half*ty)]);}
      ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(const q of pts)ctx.lineTo(q[0],q[1]);
      const far=2.5*rb;ctx.lineTo(Bs[0]+nx*far+tx*far,Bs[1]+ny*far+ty*far);ctx.lineTo(Bs[0]+nx*far-tx*far,Bs[1]+ny*far-ty*far);ctx.closePath();
      ctx.fillStyle=C.liquid;ctx.fill();
      ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(const q of pts)ctx.lineTo(q[0],q[1]);ctx.strokeStyle=C.liquid2;ctx.lineWidth=Math.max(1.5,rb*.06);ctx.stroke();
      if(rb>30){ctx.fillStyle=C.liquid2;for(let i=0;i<5;i++){const s=Math.sin(i*2.3+ph*.3)*.6,q=d+.2+((i*.37+ph*.05)%1)*(1-d)*.7;ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(Bs[0]+rb*(q*nx+s*tx),Bs[1]+rb*(q*ny+s*ty),rb*.03+i%2*rb*.015,0,TAU);ctx.fill();}ctx.globalAlpha=1;}
    }
    ctx.restore();
    ctx.beginPath();ctx.arc(Bs[0],Bs[1],rb*.72,Math.PI*1.08,Math.PI*1.38);ctx.strokeStyle=C.surface;ctx.globalAlpha=.75;ctx.lineWidth=Math.max(2,rb*.08);ctx.lineCap='round';ctx.stroke();ctx.globalAlpha=1;
  }else{ctx.beginPath();ctx.arc(Bs[0],Bs[1],rb,0,TAU);ctx.fillStyle=o.p.i?C.ball2:C.ball;ctx.fill();}
  ctx.beginPath();ctx.arc(Bs[0],Bs[1],rb,0,TAU);ctx.lineWidth=rb>30?3.5:2.5;ctx.strokeStyle=C.ink;ctx.stroke();
  ctx.beginPath();ctx.arc(Bs[0],Bs[1],2.5,0,TAU);ctx.fillStyle=C.ink;ctx.fill();
  ctx.restore();
}
// a phone strapped to ball A: y axis toward the support, x axis along the swing
export function drawPhone(o,Bs,rb){
  const up=v2s(-o.ux,-o.uy),ang=Math.atan2(up[1],up[0])+Math.PI/2,w=Math.max(12,rb*.7),h=w*1.8;
  ctx.save();ctx.translate(Bs[0],Bs[1]);ctx.rotate(ang);
  ctx.fillStyle=C.surface;ctx.globalAlpha=.3;ctx.fillRect(-w/2,-h/2,w,h);ctx.globalAlpha=1;
  ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.strokeRect(-w/2,-h/2,w,h);ctx.fillStyle=C.ink;ctx.fillRect(-w*.15,-h/2+3,w*.3,2);
  ctx.restore();
  const p=v2s(o.px,o.py),L=Math.max(28,rb*1.1),f=phone(o);
  arrow(Bs[0],Bs[1],up[0]*L,up[1]*L,C.acc,{w:2,label:`y ${f[1].toFixed(2)}`});
  arrow(Bs[0],Bs[1],p[0]*L,p[1]*L,C.acc,{w:2,label:`x ${f[0].toFixed(2)}`});
}
// forces of ball A tip to tail
export function drawPolygon(o,ballView){
  const list=[['W',o.W,C.wt],['T',o.R,C.ten]];
  if(mag(o.D)>1e-4)list.push(['D',o.D,C.drag]);
  if(coupled()&&mag(o.Fs)>1e-4)list.push(['Fs',o.Fs,C.spr]);
  if(ballView)list.push(['−ma',[-o.m*o.a[0],-o.m*o.a[1]],C.app]);
  const sz=Math.min(150,Math.min(W,H)*.36),bx=W-sz-10,by=H-sz-10;
  ctx.save();ctx.fillStyle=C.surface;ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.fillRect(bx,by,sz,sz);ctx.strokeRect(bx,by,sz,sz);
  ctx.fillStyle=C.muted;ctx.font='700 10px "Space Mono",monospace';ctx.fillText(ballView?t('r.forcesBall'):t('r.forcesTip'),bx+6,by+13);ctx.restore();
  const pts=[[0,0]];for(const f of list){const v=v2s(f[1][0],f[1][1]),l=pts[pts.length-1];pts.push([l[0]+v[0],l[1]+v[1]]);}
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const q of pts){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
  const span=Math.max(x1-x0,y1-y0,1e-9),k=(sz-66)/span,ox=bx+sz/2-(x0+x1)/2*k,oyy=by+sz/2+10-(y0+y1)/2*k;
  const saved=placed.length;
  list.forEach((f,i)=>{const a=pts[i],b=pts[i+1];arrow(ox+a[0]*k,oyy+a[1]*k,(b[0]-a[0])*k,(b[1]-a[1])*k,f[2],{w:2.5,max:sz,label:f[0]});});
  const e=pts[pts.length-1],closeL=Math.hypot(e[0],e[1])*k;
  if(!ballView&&closeL>3)arrow(ox,oyy,e[0]*k,e[1]*k,C.ink,{w:2,dash:[4,3],max:sz,label:'ΣF'});
  if(ballView){ctx.save();ctx.fillStyle=C.app;ctx.font='700 10px "Space Mono",monospace';ctx.fillText(closeL<3?t('r.closed'):'',bx+6,by+sz-6);ctx.restore();}
  placed.length=saved;
}

// ---------- energy bars ----------
export function drawEnergy(A){
  if(!LY.energy)return;
  const w=eb.clientWidth,h=eb.clientHeight;if(w<10)return;ectx.setTransform(dpr,0,0,dpr,0,0);ectx.fillStyle=C.surface;ectx.fillRect(0,0,w,h);
  const bars=[['K',A.K,C.vel],['Ug',A.U,C.wt]];
  if(P.model==='elastic')bars.push(['Uel',A.Ue,C.ten]);
  if(coupled())bars.push(['Us',A.Us,C.spr]);
  bars.push(['Q',S.Ed,C.drag]);
  if(LY.drive)bars.push(['W',S.Wd,C.accent],['Σ−W',A.E-S.Wd,C.ink]);else bars.push(['Σ',A.E,C.ink]);
  const vmax=Math.max(...bars.map(b=>b[1]),1e-9),vmin=Math.min(0,...bars.map(b=>b[1]));
  if(vmax>S.Escale)S.Escale=vmax*1.15;
  const top=20,bot=h-18,span=S.Escale-vmin,zero=top+(bot-top)*S.Escale/span,sc=(bot-top)/span;
  ectx.font='700 10px "Space Mono",monospace';ectx.fillStyle=C.muted;ectx.fillText(t('r.energy'),6,12);
  const n=bars.length,gap=5,bw=(w-12-gap*(n-1))/n;
  bars.forEach((b,i)=>{const x=6+i*(bw+gap),v=b[1],y=v>=0?zero-v*sc:zero,hh=Math.abs(v)*sc;
    ectx.fillStyle=b[2];ectx.globalAlpha=b[0][0]==='Σ'?.85:1;ectx.fillRect(x,y,bw,Math.max(hh,v?1:0));ectx.globalAlpha=1;
    ectx.strokeStyle=C.ink;ectx.lineWidth=1.5;if(hh>1)ectx.strokeRect(x+.75,y+.75,bw-1.5,hh-1.5);
    ectx.fillStyle=C.ink;ectx.textAlign='center';ectx.font=`700 ${n>6?8.5:10}px "Space Mono",monospace`;ectx.fillText(b[0],x+bw/2,h-5);
    ectx.font='8.5px "Space Mono",monospace';ectx.fillStyle=C.muted;const ty=v>=0?y-3:y+hh+9;ectx.fillText(fmt(v,Math.abs(v)<10?2:1),x+bw/2,Math.max(top-1,Math.min(bot-2,ty)));
  });
  ectx.textAlign='left';ectx.strokeStyle=C.ink;ectx.lineWidth=1.5;ectx.beginPath();ectx.moveTo(4,zero);ectx.lineTo(w-4,zero);ectx.stroke();
}
