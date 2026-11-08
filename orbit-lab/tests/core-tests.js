// Orbit Lab · tests/core-tests.js
// Checks of the physics core. Open tests/index.html through a local server to run them in the browser.

import { CORE } from '../js/core/index.js';
import { TICK } from '../js/core/constants.js';

export function runTests(){
  const res=[],t=(name,ok,info='')=>res.push({name,ok:!!ok,info});
  const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;
  let I=CORE.info(0,1,1.2,0);
  t('h=0, v=1.2: e=0.44, a=1.786, rp=1, ra=2.571',near(I.e,.44,1e-9)&&near(I.a,1.7857,1e-3)&&near(I.rp,1,1e-9)&&near(I.ra,2.5714,1e-3));
  I=CORE.info(0,1.5,CORE.vc(.5),0);t('tower h=0.5, v=vc: e≈0, r=1.5',I.e<1e-9&&near(I.r,1.5));
  for(const h of[0,.3,1,1.5]){I=CORE.info(0,1+h,CORE.vesc(h),0);t('escape at h='+h+': eps≈0',Math.abs(I.eps)<1e-12);}
  let ok=true;for(const a of[0.5,5,30,60,90])for(const v of[0.2,.8,1,1.3,1.6]){const s=CORE.launchState(0,v,a),i=CORE.info(s.x,s.y,s.vx,s.vy);if(!(i.rp<1))ok=false;}
  t('h=0, any angle > 0: rp < 1',ok);
  ok=true;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let k=0;k<200;k++){const x=.8+rnd()*3,y=rnd()*2-1,vx=rnd()-.5,vy=rnd()*.9-.2,i=CORE.info(x,y,vx,vy);if(i.bound&&Math.abs(i.visviva)>1e-9)ok=false;}
  t('vis-viva at random states (1e-9)',ok);
  I=CORE.info(0,1,1.1,0);t('Kepler III: T²/a³ = 4π²',near(I.T*I.T/Math.pow(I.a,3),4*Math.PI*Math.PI,1e-6));
  // energy and L drift: e=0.9 with rp=1 (a=10)
  let r0=19,v=Math.sqrt(2*(-0.05+1/r0)),st={t:0,x:r0,y:0,vx:0,vy:v,W:0,dv:0,pad:false};
  const e0=CORE.energy(st.x,st.y,st.vx,st.vy).E,L0=st.x*st.vy,Tper=CORE.info(st.x,st.y,st.vx,st.vy).T;
  for(let i=0,n=Math.round(100*Tper/TICK);i<n;i++)CORE.advance(st,TICK,null);
  t('e=0.9, 100 orbits: energy drift < 1e-6 ('+Math.abs(CORE.energy(st.x,st.y,st.vx,st.vy).E-e0).toExponential(1)+')',Math.abs(CORE.energy(st.x,st.y,st.vx,st.vy).E-e0)<1e-6&&Math.abs(st.x*st.vy-st.y*st.vx-L0)<1e-6);
  st={t:0,x:1,y:0,vx:0,vy:1,W:0,dv:0,pad:false};for(let i=0,n=Math.round(100*2*Math.PI/TICK);i<n;i++)CORE.advance(st,TICK,null);
  t('circular orbit: r constant within 1e-9 over 100 orbits',near(Math.hypot(st.x,st.y),1,1e-9));
  st=CORE.launchState(.5,.8,0);const eA=CORE.energy(st.x,st.y,st.vx,st.vy).E;
  for(let i=0;i<500;i++)CORE.advance(st,TICK,{k:i<250?1:3,a:.3,ang:0});
  t('work–energy with thrust: |E−E0−W_T| < 1e-8',Math.abs(CORE.energy(st.x,st.y,st.vx,st.vy).E-eA-st.W)<1e-8);
  st=CORE.launchState(.5,.8,0);CORE.impulse(st,1,.1);I=CORE.info(st.x,st.y,st.vx,st.vy);const nu=I.s*(Math.atan2(st.y,st.x)-I.omega);
  t('burn-point lemma: new orbit passes through the burn point',near(I.p/(1+I.e*Math.cos(nu)),Math.hypot(st.x,st.y),1e-9));
  st=CORE.launchState(.5,.3,0);let rs;for(let i=0;i<2000;i++){rs=CORE.advance(st,TICK,null);if(rs.crash)break;}
  t('impact on the surface (r = 1)',rs.crash&&near(Math.hypot(rs.crash.x,rs.crash.y),1,1e-9));
  ok=true;for(const [x,y,vx,vy] of[[0,1,0,0],[0,1,0,1],[1,0,0,Math.SQRT2],[1,0,0,1],[0,1,1,0],[0,1.5,0,-1]]){const i=CORE.info(x,y,vx,vy),k=CORE.conic(i);
    for(const key of['e','a','rp','ra','T','omega','nu0','eps','hz'])if(Number.isNaN(i[key]))ok=false;for(const p of k.pts)if(!isFinite(p[0])||!isFinite(p[1]))ok=false;}
  t('degenerate inputs never give NaN',ok);
  // rewind determinism: replay from a recorded state gives the same states
  st=CORE.launchState(.5,.9,10);const rec=[];for(let i=0;i<300;i++){CORE.advance(st,TICK,{k:i>100&&i<200?1:0,a:.2,ang:0});rec.push([st.x,st.y]);}
  let st2=CORE.launchState(.5,.9,10),same=true;for(let i=0;i<300;i++){CORE.advance(st2,TICK,{k:i>100&&i<200?1:0,a:.2,ang:0});if(st2.x!==rec[i][0]||st2.y!==rec[i][1])same=false;}
  t('rewind / replay reproduces the same states',same);
  return res;
}
