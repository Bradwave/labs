// Orbit Lab · core/integrator.js
// RK4 with a step proportional to r^(3/2), exact impact point, impulses, program preview.

import { TOL } from './constants.js';
import { padState } from './energy.js';
import { progCmd, thrustAcc } from './thrust.js';
export function deriv(s,cmd){
  const x=s[0],y=s[1],vx=s[2],vy=s[3],r2=x*x+y*y,r3=r2*Math.sqrt(r2);
  const t=thrustAcc(x,y,vx,vy,cmd);
  return [vx,vy,-x/r3+t[0],-y/r3+t[1],t[0]*vx+t[1]*vy,Math.hypot(t[0],t[1])];
}
export function rk4(s,h,cmd){
  const k1=deriv(s,cmd);
  const k2=deriv(s.map((v,i)=>v+.5*h*k1[i]),cmd);
  const k3=deriv(s.map((v,i)=>v+.5*h*k2[i]),cmd);
  const k4=deriv(s.map((v,i)=>v+h*k3[i]),cmd);
  return s.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}
// state: {t,x,y,vx,vy,W,dv,pad}; advances by dt (fixed sequence of sub-steps, deterministic). Returns {crash:{x,y,t}|null}
export function advance(st,dt,cmd){
  let rem=dt;
  if(st.pad){
    const th=thrustAcc(st.x,st.y,0,0,cmd||{k:5,a:0,ang:0}), r=Math.hypot(st.x,st.y);
    const rad=(th[0]*st.x+th[1]*st.y)/r, g=1/(r*r);
    if(rad<=g+1e-12){st.t+=dt;st.dv+=Math.hypot(th[0],th[1])*dt;return{crash:null};}
    st.pad=false;
  }
  let s=[st.x,st.y,st.vx,st.vy,st.W,st.dv];
  while(rem>1e-14){
    const r=Math.hypot(s[0],s[1]);
    const h=Math.min(rem,TOL.K*Math.pow(r,1.5));
    const n=rk4(s,h,cmd), r2=Math.hypot(n[0],n[1]);
    if(r2<1-TOL.crash){ // bisection for the exact impact time within this sub-step
      let lo=0,hi=h;
      for(let i=0;i<60;i++){const m=.5*(lo+hi),q=rk4(s,m,cmd);if(Math.hypot(q[0],q[1])<1)hi=m;else lo=m;}
      const q=rk4(s,hi,cmd), nr=Math.hypot(q[0],q[1]);
      q[0]/=nr;q[1]/=nr; // put it exactly on the surface
      st.t+=(dt-rem)+hi;st.x=q[0];st.y=q[1];st.vx=q[2];st.vy=q[3];st.W=q[4];st.dv=q[5];
      return{crash:{x:q[0],y:q[1],t:st.t}};
    }
    s=n;rem-=h;
  }
  st.t+=dt;st.x=s[0];st.y=s[1];st.vx=s[2];st.vy=s[3];st.W=s[4];st.dv=s[5];
  return{crash:null};
}
// instantaneous velocity change along a direction kind (1 pro,2 retro,3 out,4 in)
export function impulse(st,k,dv){
  const t=thrustAcc(st.x,st.y,st.vx,st.vy,{k,a:1,ang:0});
  const w=dv*(st.vx*t[0]+st.vy*t[1])+.5*dv*dv; // work of an impulse: v.dv + dv^2/2
  st.vx+=dv*t[0];st.vy+=dv*t[1];st.W+=w;st.dv+=dv;
}
// forward simulation of a program, for the live preview
export function simProgram(h,prog,tick){
  const st=padState(h), pts=[[st.x,st.y]];
  let crash=null;
  while(st.t<prog.burn-1e-12){
    const c=progCmd(prog,st.t), r=advance(st,Math.min(tick,prog.burn-st.t),c);
    pts.push([st.x,st.y]);
    if(r.crash){crash=r.crash;break;}
  }
  return{pts,end:st,crash};
}
