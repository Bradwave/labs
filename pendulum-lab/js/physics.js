// Pendulum Lab · physics.js
// Equations of motion: forces, rope tension, driven support, RK4 step, string slack/snap.
import { LY, Lp, Mp, P, S, act, coupled } from './state.js';
import { TAU, wrap } from './util.js';

// ---------- physics ----------
// support position, velocity and acceleration of pendulum i at time t
export function pivot(i,t){
  if(i===1)return[P.d,0,0,0,0,0];
  if(!LY.drive||P.dA<=0)return[0,0,0,0,0,0];
  const w=TAU*P.dF,tt=t+S.tOff,s=Math.sin(w*tt),c=Math.cos(w*tt),A=P.dA,ex=P.dDir==='h'?1:0,ey=1-ex;
  return[ex*A*s,ey*A*s,ex*A*w*c,ey*A*w*c,-ex*A*w*w*s,-ey*A*w*w*s];
}
export function syncCart(p){const L=Lp(p.i),s=Math.sin(p.th),c=Math.cos(p.th);p.x=L*s;p.y=-L*c;p.vx=L*p.om*c;p.vy=L*p.om*s;}
export function kinOf(p,y,k){
  if(p.polar){const L=Lp(p.i),th=y[k],om=y[k+1],s=Math.sin(th),c=Math.cos(th);return{om,rx:L*s,ry:-L*c,rvx:L*om*c,rvy:L*om*s};}
  return{rx:y[k],ry:y[k+1],rvx:y[k+2],rvy:y[k+3]};
}
export function pack(){const y=[];for(const p of act())p.polar?y.push(p.th,p.om):y.push(p.x,p.y,p.vx,p.vy);return y;}
export function kins(y){const K=[];let k=0;for(const p of act()){K.push(kinOf(p,y,k));k+=p.polar?2:4;}return K;}
// every force and derived quantity, for each active pendulum
export function analyze(t,K){
  const ps=act(),out=[];
  ps.forEach((p,n)=>{const q=K[n],pv=pivot(p.i,t);out.push({p,q,pv,x:pv[0]+q.rx,y:pv[1]+q.ry,vx:pv[2]+q.rvx,vy:pv[3]+q.rvy,Fs:[0,0]});});
  out.Us=0;
  if(coupled()){const A=out[0],B=out[1],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||1e-9,f=P.kap*(d-P.d);
    A.Fs=[f*dx/d,f*dy/d];B.Fs=[-f*dx/d,-f*dy/d];out.Us=.5*P.kap*(d-P.d)*(d-P.d);out.sd=d;}
  for(const o of out){
    const{p,q,pv}=o,L=Lp(p.i),m=Mp(p.i);o.L=L;o.m=m;
    const r=Math.hypot(q.rx,q.ry)||1e-9,ux=q.rx/r,uy=q.ry/r,px=-uy,py=ux;Object.assign(o,{r,ux,uy,px,py});
    const sp=Math.hypot(o.vx,o.vy);o.sp=sp;
    o.W=[0,-m*P.g];o.D=[-P.b*o.vx-P.c*sp*o.vx,-P.b*o.vy-P.c*sp*o.vy];
    const Fo=[o.W[0]+o.D[0]+o.Fs[0],o.W[1]+o.D[1]+o.Fs[1]];
    let T=0,Fpf=0;
    if(p.polar){
      T=Fo[0]*ux+Fo[1]*uy+m*L*q.om*q.om-m*(pv[4]*ux+pv[5]*uy);
      if(P.model==='rod'&&P.beta>0)Fpf=-P.beta*q.om/L;
      o.dom=((Fo[0]*px+Fo[1]*py+Fpf)/m-(pv[4]*px+pv[5]*py))/L;
    }else if(P.model==='elastic'&&r>L)T=P.k*(r-L);
    o.T=T;o.Fpf=Fpf;o.R=[-T*ux+Fpf*px,-T*uy+Fpf*py];
    o.N=[Fo[0]+o.R[0],Fo[1]+o.R[1]];o.a=[o.N[0]/m,o.N[1]/m];o.arel=[o.a[0]-pv[4],o.a[1]-pv[5]];
    o.at=o.a[0]*px+o.a[1]*py;o.ac=-(o.a[0]*ux+o.a[1]*uy);o.vt=o.vx*px+o.vy*py;
    o.om=p.polar?q.om:(q.rx*q.rvy-q.ry*q.rvx)/(r*r);o.th=Math.atan2(q.rx,-q.ry);
    o.K=.5*m*sp*sp;o.U=m*P.g*(o.y+L);o.Ue=P.model==='elastic'&&r>L?.5*P.k*(r-L)*(r-L):0;
    o.diss=P.b*sp*sp+P.c*sp*sp*sp+(Fpf?P.beta*q.om*q.om:0);
    o.geff=[-o.a[0],-P.g-o.a[1]];
    o.slack=(P.model==='string'&&!p.polar)||(P.model==='elastic'&&r<=L);
  }
  const A=out[0];out.drivePow=LY.drive?A.R[0]*A.pv[2]+A.R[1]*A.pv[3]:0;
  out.K=0;out.U=0;out.Ue=0;out.diss=0;for(const o of out){out.K+=o.K;out.U+=o.U;out.Ue+=o.Ue;out.diss+=o.diss;}
  out.E=out.K+out.U+out.Ue+out.Us+S.Ed;
  return out;
}
export function deriv(t,y){const A=analyze(t,kins(y)),d=[];for(const o of A){if(o.p.polar)d.push(o.q.om,o.dom);else d.push(o.q.rvx,o.q.rvy,o.arel[0],o.arel[1]);}return d;}
export function unpack(y){let k=0;for(const p of act()){if(p.polar){p.th=y[k];p.om=y[k+1];syncCart(p);k+=2;}
  else{p.x=y[k];p.y=y[k+1];p.vx=y[k+2];p.vy=y[k+3];k+=4;const r=Math.hypot(p.x,p.y);if(r>1e-9){p.th+=wrap(Math.atan2(p.x,-p.y)-p.th);p.om=(p.x*p.vy-p.y*p.vx)/(r*r);}}}}
export const cur=()=>analyze(S.t,kins(pack()));
export const addv=(y,k,h)=>y.map((v,i)=>v+h*k[i]);
// a slack string snaps tight: the outward radial velocity is lost
export function snap(p){
  const L=Lp(p.i),m=Mp(p.i),pv=pivot(p.i,S.t),r=Math.hypot(p.x,p.y)||1e-9,ux=p.x/r,uy=p.y/r,vr=p.vx*ux+p.vy*uy;
  let th=p.th+wrap(Math.atan2(p.x,-p.y)-p.th);const vt=p.vx*Math.cos(th)+p.vy*Math.sin(th);
  p.polar=true;p.th=th;p.om=vt/L;syncCart(p);
  if(vr>0){S.Ed+=.5*m*vr*vr;if(p.i===0&&LY.drive)S.Wd+=-m*vr*(ux*pv[2]+uy*pv[3]);if(vr>.05)S.flash[p.i]=1;}
}
export function enterPolar(p){if(!p.polar&&Math.hypot(p.x,p.y)>1e-9)snap(p);}
export function step(h){
  const y=pack(),t=S.t,A0=analyze(t,kins(y));
  const k1=deriv(t,y),k2=deriv(t+h/2,addv(y,k1,h/2)),k3=deriv(t+h/2,addv(y,k2,h/2)),k4=deriv(t+h,addv(y,k3,h));
  unpack(y.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i])));S.t+=h;
  const A1=cur();
  S.Ed+=(A0.diss+A1.diss)/2*h;S.Wd+=(A0.drivePow+A1.drivePow)/2*h;
  if(P.model==='string')for(const o of A1){const p=o.p;if(p.polar&&o.T<0)p.polar=false;else if(!p.polar&&o.r>=Lp(p.i))snap(p);}
  return A1;
}
