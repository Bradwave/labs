// Orbit Lab · core/orbit.js
// Orbit from a state: elements, classification and the predicted conic. Pure, never NaN.

import { TAU, TOL, wrapPi } from './constants.js';
export function info(x,y,vx,vy,stay){
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
export function conic(I,rmax){
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
