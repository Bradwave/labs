// Orbit Lab · render/bars.js
// Energy bars (K solid, U hatched, E dotted outline).

import { clamp } from '../core/constants.js';
import { CORE } from '../core/index.js';
import { C, dpr, eb, ectx } from './canvas-view.js';
import { feat } from '../state.js';
import { fmt } from '../util.js';
/* ============================== RENDER: bars, plots, program editors, ship cam ============================== */
export function hatch(c,x,y,w,h,color,gap=6){
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.strokeStyle=color;c.lineWidth=2;c.beginPath();
  for(let k=-h;k<w+h;k+=gap){c.moveTo(x+k,y+h);c.lineTo(x+k+h,y);}c.stroke();c.restore();
}
export function drawBars(q){
  const c=ectx,w=eb.clientWidth,h=eb.clientHeight;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle=C.surface;c.fillRect(0,0,w,h);
  const en=CORE.energy(q.x,q.y,q.vx,q.vy),Eu=0.5,K=en.K/Eu,U=en.U/Eu,E=en.E/Eu;
  const top=20,bot=h-18,lo=-2.6,hi=3.2,Y=v=>top+(hi-clamp(v,lo,hi))/(hi-lo)*(bot-top),y0=Y(0);
  c.font='700 10px "Space Mono",monospace';c.fillStyle=C.muted;c.textBaseline='alphabetic';
  c.fillText('E=0 escape',4,y0+11);
  const bw=Math.min(38,(w-24)/3.4),gx=(w-3*bw)/4,xs=[gx,2*gx+bw,3*gx+2*bw];
  // K: solid, U: hatched, E: dotted outline
  const bar=(i,v,kind)=>{
    const x=xs[i],yv=Y(v),ytop=Math.min(y0,yv),hh=Math.abs(yv-y0);
    if(kind==='K'){c.fillStyle=C.kin;c.fillRect(x,ytop,bw,hh);}
    else if(kind==='U'){c.fillStyle=C.surface;c.fillRect(x,ytop,bw,hh);hatch(c,x,ytop,bw,hh,C.pot,5);}
    else{c.fillStyle=C.tot;c.globalAlpha=.14;c.fillRect(x,ytop,bw,hh);c.globalAlpha=1;}
    c.strokeStyle=kind==='K'?C.kin:kind==='U'?C.pot:C.tot;c.lineWidth=2.5;if(kind==='E')c.setLineDash([3,3]);c.strokeRect(x,ytop,bw,hh);c.setLineDash([]);
    if(feat('barNumbers')){c.fillStyle=C.ink;c.textAlign='center';c.fillText(fmt(v,2),x+bw/2,v>=0?ytop-3:ytop+hh+10);c.textAlign='left';}
  };
  bar(0,K,'K');bar(1,U,'U');bar(2,E,'E');
  c.strokeStyle=C.ink;c.lineWidth=2;c.beginPath();c.moveTo(0,y0);c.lineTo(w,y0);c.stroke();
  c.fillStyle=C.ink;c.textAlign='center';['K','U','E'].forEach((s,i)=>c.fillText(s,xs[i]+bw/2,h-5));c.textAlign='left';
  if(feat('work')){c.fillStyle=C.thr;c.fillText('W_T='+fmt(q.W/Eu,2),4,12);}
}
