/* Canvas helpers */
'use strict';
/* ---------- canvas ---------- */
let C={};
function readColors(){
  const cs=getComputedStyle(document.documentElement);const g=n=>cs.getPropertyValue(n).trim();
  C={canvas:g('--surface'),grid:g('--gridline'),ink:g('--ink'),muted:g('--muted'),line:g('--gridline'),accent:g('--accent'),
     gal:g('--gal'),rel:g('--rel'),ok:g('--ok'),weak:g('--weak'),miss:g('--miss')};
}
const stc=s=>({ok:C.ok,weak:C.weak,miss:C.miss,back:C.muted}[s]);
const mcol=m=>m==='gal'?C.gal:C.rel;
function prep(cv){
  const dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;
  if(w<4||h<4)return null;
  const W=Math.round(w*dpr),H=Math.round(h*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=C.canvas;ctx.fillRect(0,0,w,h);
  return {ctx,w,h};
}
function arrow(ctx,x1,y1,x2,y2,col,lw=2,head=8){
  ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=lw;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  const a=Math.atan2(y2-y1,x2-x1);
  ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(a-0.4),y2-head*Math.sin(a-0.4));
  ctx.lineTo(x2-head*Math.cos(a+0.4),y2-head*Math.sin(a+0.4));ctx.closePath();ctx.fill();
}
function text(ctx,s,x,y,col,size=11,align='left',font=FM,base='middle'){
  ctx.fillStyle=col;ctx.font=size+'px '+font;ctx.textAlign=align;ctx.textBaseline=base;ctx.fillText(s,x,y);
}
function line(ctx,x1,y1,x2,y2,col,lw=1,dash=null){
  ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.setLineDash(dash||[]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
}
function dot(ctx,x,y,r,fill,stroke,lw=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}
}
function niceStep(unitPx,minPx){
  for(const s of [0.1,0.2,0.5,1,2,5,10,20,50,100]) if(s*unitPx>=minPx) return s;
  return 100;
}
