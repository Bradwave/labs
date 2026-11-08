// Orbit Lab · render/ship-cam.js
// View from the ship: horizon, planet limb, prograde markers, floating cabin objects.

import { clamp } from '../core/constants.js';
import { CORE } from '../core/index.js';
import { C, camcv, cctx, dpr } from './canvas-view.js';
import { fmt } from '../util.js';
// ---- ship cam ----
export const CAB=[{x:.2,y:.78,vx:0,vy:0,c:'#FF6A3D',s:9},{x:.5,y:.84,vx:0,vy:0,c:'#FFC23D',s:7},{x:.78,y:.8,vx:0,vy:0,c:'#6E3FE0',s:8},{x:.62,y:.7,vx:0,vy:0,c:'#0F9A63',s:6}];
export const STARS=Array.from({length:70},(_,i)=>{const a=Math.sin(i*127.1)*43758.5453,b=Math.sin(i*311.7)*43758.5453;return[a-Math.floor(a),b-Math.floor(b),.5+((i*37)%10)/10];});
export function drawCam(F,dtReal){
  const c=cctx,w=camcv.clientWidth,h=camcv.clientHeight;if(!w||!h)return;
  const {q,I,cmd}=F;
  c.setTransform(dpr,0,0,dpr,0,0);
  const rho=Math.asin(Math.min(1,1/Math.max(I.r,1))),dip=Math.PI/2-rho,beta=clamp(dip*.6,0,1.1);
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#030712');sky.addColorStop(1,'#0B1B3A');c.fillStyle=sky;c.fillRect(0,0,w,h);
  c.fillStyle='#fff';for(const s of STARS){c.globalAlpha=s[2]*.8;c.fillRect(s[0]*w,s[1]*h*.9,1.6,1.6);}c.globalAlpha=1;
  const Fp=(w/2)/Math.tan(50*Math.PI/180);
  const proj=(l,f,u)=>{const df=f*Math.cos(beta)-u*Math.sin(beta),du=f*Math.sin(beta)+u*Math.cos(beta);if(df<.02)return null;return[w/2+Fp*l/df,h/2-Fp*du/df];};
  // planet limb
  const pts=[];let all=true;
  for(let i=0;i<=240;i++){const th=i/240*Math.PI*2,p=proj(Math.sin(rho)*Math.cos(th),Math.sin(rho)*Math.sin(th),-Math.cos(rho));if(p)pts.push(p);else all=false;}
  c.fillStyle=C.planet;c.strokeStyle='#8FDDF3';c.lineWidth=3;
  if(pts.length>3){
    if(all){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fill();c.stroke();}
    else{pts.sort((a,b)=>a[0]-b[0]);c.beginPath();c.moveTo(pts[0][0]-w,h+20);pts.forEach(p=>c.lineTo(p[0],p[1]));c.lineTo(pts[pts.length-1][0]+w,h+20);c.closePath();c.fill();c.stroke();}
  }
  // prograde / retrograde markers
  const sgn=1, vt=Math.abs(I.hz)/I.r, vu=I.vr, vm=Math.hypot(vt,vu);
  if(vm>1e-6&&!q.pad){
    const mk=(sg)=>proj(0,sg*vt/vm,sg*vu/vm);
    const P1=mk(1),P2=mk(-1);
    if(P1){c.strokeStyle=C.vel;c.lineWidth=2.5;c.beginPath();c.arc(P1[0],P1[1],8,0,Math.PI*2);c.moveTo(P1[0],P1[1]-13);c.lineTo(P1[0],P1[1]-8);c.moveTo(P1[0]-13,P1[1]);c.lineTo(P1[0]-8,P1[1]);c.moveTo(P1[0]+13,P1[1]);c.lineTo(P1[0]+8,P1[1]);c.stroke();}
    if(P2){c.strokeStyle=C['c-crash'];c.lineWidth=2.5;c.beginPath();c.arc(P2[0],P2[1],8,0,Math.PI*2);c.moveTo(P2[0]-5,P2[1]-5);c.lineTo(P2[0]+5,P2[1]+5);c.moveTo(P2[0]+5,P2[1]-5);c.lineTo(P2[0]-5,P2[1]+5);c.stroke();}
  }void sgn;
  // cabin: objects float while coasting; thrust pushes them toward the back (bottom)
  const th=CORE.thrustAcc(q.x,q.y,q.vx,q.vy,cmd&&cmd.k?cmd:null),tm=Math.hypot(th[0],th[1]);
  for(const o of CAB){
    if(tm>1e-6)o.vy+=Math.min(2,tm*6)*dtReal;
    o.x+=o.vx*dtReal;o.y+=o.vy*dtReal;
    if(o.y>.93){o.y=.93;o.vy*=-.35;}if(o.y<.55){o.y=.55;o.vy*=-.5;}
    if(o.x<.05||o.x>.95){o.vx*=-1;o.x=clamp(o.x,.05,.95);}
    c.fillStyle=o.c;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.arc(o.x*w,o.y*h,o.s*(h>200?1.6:1),0,Math.PI*2);c.fill();c.stroke();
  }
  c.font='700 10px "Space Mono",monospace';c.fillStyle='#E8F1FF';c.fillText('SHIP CAM · alt '+fmt(I.r-1,2),6,13);
}
