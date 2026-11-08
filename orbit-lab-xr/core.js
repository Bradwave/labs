/* core.js — fisica pura di Orbit Lab (nessun DOM, nessun THREE): stessa matematica dell'app 2D (`../orbit-lab`),
   copiata alla lettera, più le funzioni geometriche che servono alla vista 3D (sistema di riferimento della nave, polilinee tratteggiate).
   Unità: mu = GM = 1, raggio del pianeta R = 1. Velocità circolare in superficie = 1, di fuga = sqrt(2), T0 = 2*pi. Il piano dell'orbita è (x, y). */
(function (root) {
  'use strict';
const CORE = (() => {
  const TAU=Math.PI*2, R=1;
  const TOL={circ:1e-4,parab:2e-3,radial:1e-7,crash:1e-7,K:0.004};
  const vc=h=>1/Math.sqrt(1+h), vesc=h=>Math.SQRT2*vc(h);
  const wrapPi=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;};

  function info(x,y,vx,vy,stay){
    const r=Math.hypot(x,y)||1e-12, v2=vx*vx+vy*vy, v=Math.sqrt(v2);
    const eps=.5*v2-1/r, hz=x*vy-y*vx, rv=x*vx+y*vy, vr=rv/r;
    const ex=(v2-1/r)*x-rv*vx, ey=(v2-1/r)*y-rv*vy, e=Math.hypot(ex,ey), p=hz*hz;
    const radial=Math.abs(hz)<TOL.radial;
    const bound=eps<-1e-12;
    let type;
    if(stay) type='stay'; else if(radial) type='radial'; else if(e<TOL.circ) type='circle';
    else if(Math.abs(e-1)<TOL.parab) type='parabola'; else if(e<1) type='ellipse'; else type='hyperbola';
    const a=bound?-1/(2*eps):Infinity;
    let rp,ra;
    if(radial){rp=0;ra=bound?-1/eps:Infinity;}
    else{rp=p/(1+e);ra=(e<1-1e-12)?p/(1-e):Infinity;}
    const T=bound?TAU*Math.pow(a,1.5):Infinity;
    const omega=e>1e-9?Math.atan2(ey,ex):Math.atan2(y,x);
    const s=hz>=0?1:-1;
    const nu0=wrapPi(s*(Math.atan2(y,x)-omega));
    const crash=!stay&&((radial?(bound||vr<0):(rp<1-1e-9&&(bound||vr<0))));
    return {x,y,vx,vy,r,v,eps,hz,ex,ey,e,p,a,rp,ra,T,vr,vinf:eps>0?Math.sqrt(2*eps):0,omega,s,nu0,type,bound,radial,crash,
      visviva:v2-(2/r-(bound?1/a:0))};
  }

  // Predicted conic from the current state, forward in time, ending at the ground or at rmax.
  function conic(I,rmax){
    rmax=rmax||40;
    const out={pts:[],peri:null,apo:null,impact:null};
    const rr=Math.hypot(I.x,I.y), ux=I.x/rr, uy=I.y/rr;
    if(I.type==='stay') return out;
    if(I.radial){
      let rEnd;
      if(I.vr>=0){rEnd=I.bound?Math.min(I.ra,rmax):rmax; if(I.bound)out.apo=[ux*I.ra,uy*I.ra];}
      else rEnd=1;
      out.pts.push([I.x,I.y]);
      if(I.vr>=0&&I.bound){out.pts.push([ux*rEnd,uy*rEnd]);out.pts.push([ux,uy]);out.impact=[ux,uy];}
      else if(I.vr<0){out.pts.push([ux,uy]);out.impact=[ux,uy];}
      else out.pts.push([ux*rEnd,uy*rEnd]);
      return out;
    }
    const e=I.e,p=I.p,s=I.s,om=I.omega;
    const rAt=nu=>p/(1+e*Math.cos(nu));
    const P=nu=>{const r=rAt(nu),a=om+s*nu;return[r*Math.cos(a),r*Math.sin(a)];};
    const nuMax=e>=1-1e-9?Math.PI*0.995:Math.acos(-1/e)*0.999;
    const nuEnd=(e<1-1e-9)?I.nu0+TAU:nuMax;
    let nu=I.nu0, prev=[I.x,I.y], rprev=rr;
    out.pts.push(prev);
    const dn=0.01;
    while(nu<nuEnd){
      const nn=Math.min(nu+dn,nuEnd); const r=rAt(nn);
      if(!(r>0)||r>rmax)break;
      const pt=P(nn);
      if(r<1){ // interpolate to r = 1
        const f=(rprev-1)/(rprev-r); const ix=prev[0]+(pt[0]-prev[0])*f, iy=prev[1]+(pt[1]-prev[1])*f, n=Math.hypot(ix,iy);
        const q=[ix/n,iy/n]; out.pts.push(q); out.impact=q; break;
      }
      out.pts.push(pt); prev=pt; rprev=r; nu=nn;
    }
    const nuReach=nu;
    for(let k=-1;k<=2;k++){
      const pn=TAU*k; if(pn>I.nu0&&pn<=nuReach+1e-9&&!out.peri) out.peri=P(pn);
      const an=Math.PI+TAU*k; if(I.bound&&an>I.nu0&&an<=nuReach+1e-9&&!out.apo) out.apo=P(an);
    }
    if(!out.impact&&I.rp>=1&&e>1e-6) {if(!out.peri) out.periFull=P(0);}
    return out;
  }

  // ---- dynamics ----
  // cmd: {k:0 none,1 prograde,2 retro,3 out,4 in,5 angle from vertical (toward the clockwise tangent), a: magnitude, ang: radians}
  function thrustAcc(x,y,vx,vy,cmd){
    if(!cmd||!cmd.k||!cmd.a) return [0,0];
    const r=Math.hypot(x,y)||1e-12, rx=x/r, ry=y/r, hx=ry, hy=-rx;
    let ux,uy;
    switch(cmd.k){
      case 1:case 2:{const v=Math.hypot(vx,vy);if(v>1e-9){ux=vx/v;uy=vy/v;}else{ux=hx;uy=hy;} if(cmd.k===2){ux=-ux;uy=-uy;} break;}
      case 3:ux=rx;uy=ry;break;
      case 4:ux=-rx;uy=-ry;break;
      default:{const c=Math.cos(cmd.ang),s=Math.sin(cmd.ang);ux=c*rx+s*hx;uy=c*ry+s*hy;}
    }
    return [cmd.a*ux,cmd.a*uy];
  }
  function deriv(s,cmd){
    const x=s[0],y=s[1],vx=s[2],vy=s[3],r2=x*x+y*y,r3=r2*Math.sqrt(r2);
    const t=thrustAcc(x,y,vx,vy,cmd);
    return [vx,vy,-x/r3+t[0],-y/r3+t[1],t[0]*vx+t[1]*vy,Math.hypot(t[0],t[1])];
  }
  function rk4(s,h,cmd){
    const k1=deriv(s,cmd);
    const k2=deriv(s.map((v,i)=>v+.5*h*k1[i]),cmd);
    const k3=deriv(s.map((v,i)=>v+.5*h*k2[i]),cmd);
    const k4=deriv(s.map((v,i)=>v+h*k3[i]),cmd);
    return s.map((v,i)=>v+h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
  }
  // state: {t,x,y,vx,vy,W,dv,pad}; advances by dt (fixed sequence of sub-steps, deterministic). Returns {crash:{x,y,t}|null}
  function advance(st,dt,cmd){
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
  function impulse(st,k,dv){
    const t=thrustAcc(st.x,st.y,st.vx,st.vy,{k,a:1,ang:0});
    const w=dv*(st.vx*t[0]+st.vy*t[1])+.5*dv*dv; // work of an impulse: v.dv + dv^2/2
    st.vx+=dv*t[0];st.vy+=dv*t[1];st.W+=w;st.dv+=dv;
  }
  const energy=(x,y,vx,vy)=>{const K=.5*(vx*vx+vy*vy),U=-1/Math.hypot(x,y);return{K,U,E:K+U};};
  const launchState=(h,v,angDeg)=>{const a=angDeg*Math.PI/180;return{t:0,x:0,y:1+h,vx:v*Math.cos(a),vy:v*Math.sin(a),W:0,dv:0,pad:false};};
  const padState=h=>({t:0,x:0,y:1+h,vx:0,vy:0,W:0,dv:0,pad:true});

  // Thrust program: piecewise-linear a(u), theta(u), u = t / burn in [0,1]. Pts: [[u,val],...]
  function interp(pts,u){
    if(u<=pts[0][0])return pts[0][1]; const n=pts.length;
    if(u>=pts[n-1][0])return pts[n-1][1];
    for(let i=1;i<n;i++)if(u<=pts[i][0]){const a=pts[i-1],b=pts[i],f=(u-a[0])/((b[0]-a[0])||1);return a[1]+f*(b[1]-a[1]);}
    return pts[n-1][1];
  }
  function progCmd(prog,t){
    if(t>=prog.burn)return null;
    const u=t/prog.burn;
    return{k:5,a:Math.max(0,interp(prog.a,u)),ang:interp(prog.th,u)*Math.PI/180};
  }
  // forward simulation of a program, for the live preview
  function simProgram(h,prog,tick){
    const st=padState(h), pts=[[st.x,st.y]];
    let crash=null;
    while(st.t<prog.burn-1e-12){
      const c=progCmd(prog,st.t), r=advance(st,Math.min(tick,prog.burn-st.t),c);
      pts.push([st.x,st.y]);
      if(r.crash){crash=r.crash;break;}
    }
    return{pts,end:st,crash};
  }
  return{R,TOL,vc,vesc,info,conic,advance,impulse,energy,launchState,padState,thrustAcc,progCmd,simProgram,interp,wrapPi,rk4,deriv};
})();

  // ---------- geometria per la vista 3D ----------
  // Sistema di riferimento della nave (LVLH): su = direzione radiale uscente, avanti = tangente nel verso del moto.
  // Restituisce i vettori nel piano (x, y) e `det` = +1/-1 (verso dell'asse normale rispetto a "destra").
  function shipFrame(x, y, hz) {
    const r = Math.hypot(x, y) || 1e-12, ux = x / r, uy = y / r;
    const s = hz > 0 ? 1 : -1;               // hz>0: moto antiorario. Sul lancio iniziale (0,1+h) con vx>0 è orario (hz<0).
    const fx = -s * uy, fy = s * ux;         // tangente nel verso del moto
    return { ux: ux, uy: uy, fx: fx, fy: fy, s: s, det: fx * uy - fy * ux };
  }
  // Punto (px, py, pz) in coordinate matematiche -> coordinate THREE della cabina: X destra, Y su, -Z avanti.
  function toShipLocal(F, px, py, pz) {
    return [F.det * pz, px * F.ux + py * F.uy, -(px * F.fx + py * F.fy)];
  }
  // Direzione (vx, vy, 0) -> THREE della cabina
  function dirToShipLocal(F, vx, vy) { return toShipLocal(F, vx, vy, 0); }

  // Polilinea [[x,y],...] -> segmenti tratteggiati [[[x,y],[x,y]],...] (dash/gap in unità di lunghezza d'arco).
  function dashPolyline(pts, dash, gap) {
    const out = [];
    if (pts.length < 2) return out;
    let on = true, left = dash, cur = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      let a = pts[i - 1], b = pts[i];
      let dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-12) continue;
      let t = 0;
      while (len - t > left) {
        t += left;
        const p = [a[0] + dx * t / len, a[1] + dy * t / len];
        if (on) { cur.push(p); out.push(cur); cur = []; } else { cur = [p]; }
        on = !on; left = on ? dash : gap;
      }
      left -= len - t;
      if (on) cur.push(b);
    }
    if (on && cur.length > 1) out.push(cur);
    return out;
  }

  const api = { CORE: CORE, shipFrame: shipFrame, toShipLocal: toShipLocal, dirToShipLocal: dirToShipLocal, dashPolyline: dashPolyline };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OrbitCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
