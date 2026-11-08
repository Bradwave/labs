// Pendulum Lab · view.js
// Canvas setup, theme colours, camera (lab and ball frames) and coordinate transforms.
import { LY, Mp, P, S } from './state.js';
import { $, clamp, ease, lerp, wrap } from './util.js';

// ---------- canvas setup ----------
export const cv=$('#cv'),ctx=cv.getContext('2d'),wrapEl=$('#wrap'),eb=$('#ebars'),ectx=eb.getContext('2d'),gcv=$('#gcv'),gctx=gcv.getContext('2d');
export let dpr=1,W=300,H=300;
export const C={};
export function readColors(){const cs=getComputedStyle(document.documentElement);
  for(const k of['surface','ink','muted','accent','onaccent','gridline','wt','ten','drag','vel','acc','app','liquid','liquid2','glass','ball','ball2','spr','bg'])C[k]=cs.getPropertyValue('--'+k).trim();}
export function resize(){dpr=window.devicePixelRatio||1;W=Math.max(60,cv.clientWidth);H=Math.max(60,cv.clientHeight);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  eb.width=Math.round(eb.clientWidth*dpr);eb.height=Math.round(eb.clientHeight*dpr);
  gcv.width=Math.round(gcv.clientWidth*dpr);gcv.height=Math.round(gcv.clientHeight*dpr);}

export const cam={cx:0,cy:0,s:100,rot:0,labS:null,labX:null};
export function rbLab(i){return clamp(9+7*Math.cbrt(Mp(i)),11,26);}
export function rbBall(){return Math.min(W,H)*.16;}
export function updateCam(A){
  const e=ease(S.vt),o=A[0];
  let Lv=LY.two?Math.max(P.L,P.LB):P.L;
  if(P.model==='elastic')Lv=Math.max(Lv*1.25,...A.map(q=>q.r*1.05));
  const dh=LY.drive&&P.dDir==='h'?P.dA:0,dv=LY.drive&&P.dDir==='v'?P.dA:0;
  const halfW=(LY.two?P.d/2:0)+Lv+dh,sT=Math.min(.44*W/halfW,.40*H/(Lv+dv)),xT=LY.two?P.d/2:0;
  cam.labS=cam.labS==null?sT:cam.labS+(sT-cam.labS)*.08;cam.labX=cam.labX==null?xT:cam.labX+(xT-cam.labX)*.08;
  const sL=cam.labS,cyL=-.08*H/sL,sB=Math.max(sL*2.2,Math.min(W,H)*1.0/P.L);
  cam.cx=lerp(cam.labX,o.x,e);cam.cy=lerp(cyL,o.y,e);cam.s=Math.exp(lerp(Math.log(sL),Math.log(sB),e));
  cam.rot=-S.rotK*wrap(o.th);
}
export const oy=()=>H/2+ease(S.vt)*H*.1;
export function w2s(wx,wy){const dx=(wx-cam.cx)*cam.s,dy=(wy-cam.cy)*cam.s,c=Math.cos(cam.rot),s=Math.sin(cam.rot);return[W/2+dx*c-dy*s,oy()-(dx*s+dy*c)];}
export function v2s(vx,vy){const c=Math.cos(cam.rot),s=Math.sin(cam.rot);return[vx*c-vy*s,-(vx*s+vy*c)];}
export function s2w(sx,sy){const rx=sx-W/2,ry=-(sy-oy()),c=Math.cos(cam.rot),s=Math.sin(cam.rot);return[cam.cx+(rx*c+ry*s)/cam.s,cam.cy+(-rx*s+ry*c)/cam.s];}

export function initView(){
for(const el of[wrapEl,gcv,eb])new ResizeObserver(resize).observe(el);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',readColors);
new MutationObserver(readColors).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
// camera
}
