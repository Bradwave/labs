// Pendulum Lab · fluid.js
// Liquid inside ball A: a damped surface model and a 2D particle model (double-density relaxation).
import { LY, P, S } from './state.js';
import { RB, clamp, wrap } from './util.js';

// ---------- liquid: simple surface ----------
export function fluidStep(h,geff){
  const gx=geff[0],gy=geff[1],gm=Math.hypot(gx,gy),w0=Math.sqrt(1.6*Math.min(gm,400)/RB);
  if(gm>0.04*Math.max(P.g,1)){const e=wrap(S.psi-Math.atan2(gy,gx));S.psid+=(-w0*w0*e-2*P.zeta*w0*S.psid)*h;}
  else S.psid*=Math.exp(-h*.3);
  S.psi+=S.psid*h;S.rip+=(w0*1.7+3)*h;
}
// ---------- liquid: 2D particles (double-density relaxation, ball radius = 1) ----------
export const FL={n:0,x:null,y:null,vx:null,vy:null,px:null,py:null,h:.2,k:.03,kn:.08,rho0:1,ok:false};
export function flInit(geff){
  const s=.085,pts=[];for(let j=-14;j<=14;j++)for(let i=-14;i<=14;i++){const x=(i+(j&1)*.5)*s,y=j*s*.866;if(Math.hypot(x,y)<.92)pts.push([x,y]);}
  let gx=geff[0],gy=geff[1],gm=Math.hypot(gx,gy);if(gm<1e-6){gx=0;gy=-1;gm=1;}
  pts.sort((a,b)=>(b[0]*gx+b[1]*gy)-(a[0]*gx+a[1]*gy));
  const n=Math.max(8,Math.round(P.fill*pts.length)),sel=pts.slice(0,n);
  FL.n=n;FL.x=new Float64Array(sel.map(p=>p[0]));FL.y=new Float64Array(sel.map(p=>p[1]));
  FL.vx=new Float64Array(n);FL.vy=new Float64Array(n);FL.px=new Float64Array(n);FL.py=new Float64Array(n);
  let mx=0;for(let i=0;i<n;i++){let r=0;for(let j=0;j<n;j++){if(j===i)continue;const d=Math.hypot(FL.x[j]-FL.x[i],FL.y[j]-FL.y[i]);if(d<FL.h){const q=1-d/FL.h;r+=q*q;}}mx=Math.max(mx,r);}
  FL.rho0=mx*.95;FL.ok=true;
}
export function flStep(dts,geff){ // dts seconds; velocities kept in ball radii per second
  const n=FL.n,h=FL.h,x=FL.x,y=FL.y,vx=FL.vx,vy=FL.vy,px=FL.px,py=FL.py;
  const gx=geff[0]/RB*dts*dts,gy=geff[1]/RB*dts*dts;
  for(let i=0;i<n;i++){const sx=vx[i]*dts+gx,sy=vy[i]*dts+gy;px[i]=x[i];py[i]=y[i];x[i]+=sx;y[i]+=sy;}
  const nb=[];
  for(let i=0;i<n;i++){let r=0,rn=0;nb.length=0;
    for(let j=0;j<n;j++){if(j===i)continue;const dx=x[j]-x[i],dy=y[j]-y[i];if(dx>h||dx<-h||dy>h||dy<-h)continue;const d=Math.sqrt(dx*dx+dy*dy);
      if(d<h&&d>1e-9){const q=1-d/h;r+=q*q;rn+=q*q*q;nb.push(j,d,dx,dy);}}
    const Pr=FL.k*(r-FL.rho0),Pn=FL.kn*rn;let ddx=0,ddy=0;
    for(let m=0;m<nb.length;m+=4){const j=nb[m],d=nb[m+1],q=1-d/h,D=(Pr*q+Pn*q*q)*.5,ux=nb[m+2]/d,uy=nb[m+3]/d;x[j]+=D*ux;y[j]+=D*uy;ddx-=D*ux;ddy-=D*uy;}
    x[i]+=ddx;y[i]+=ddy;}
  const damp=1-P.zeta*.02;
  for(let i=0;i<n;i++){const r=Math.hypot(x[i],y[i]),R=.95;if(r>R){x[i]*=R/r;y[i]*=R/r;}vx[i]=(x[i]-px[i])/dts*damp;vy[i]=(y[i]-py[i])/dts*damp;}
}
export function liquidAdvance(dt,geff){
  if(!LY.fluid)return;
  if(P.liquid==='simple'){const n=Math.max(1,Math.ceil(dt/.0005)),h=dt/n;for(let i=0;i<n;i++)fluidStep(h,geff);return;}
  if(!FL.ok)flInit(geff);
  let g=geff,gm=Math.hypot(g[0],g[1]);const cap=40*9.81;if(gm>cap){g=[g[0]*cap/gm,g[1]*cap/gm];gm=cap;}
  const dts=clamp(Math.sqrt(.0035*RB/Math.max(gm,1e-6)),1/2000,1/120),n=Math.min(30,Math.ceil(dt/dts));
  if(dt<=0)return;const hh=dt/n;
  if(hh>dts*1.3){const n2=30;for(let i=0;i<n2;i++)flStep(dts,g);return;} // too much to catch up: run what we can
  for(let i=0;i<n;i++)flStep(hh,g);
}
