/* Equations tab: r(x) and t(x) plots */
'use strict';
function drawEq(cv){
  const pp=prep(cv);if(!pp)return;const {ctx,w,h}=pp;
  const v=P.v,up=P.up,L=P.L;
  const xa=Math.max(v-up,0.03*(v+up)),xb=v+up;
  const padL=46,padR=16,padT=16,padB=64;
  const rOf=x=>{const y2=up*up-(x-v)*(x-v);return y2>0?L*Math.sqrt(y2)/x:0;};
  let rmx=0;for(let i=0;i<=400;i++)rmx=Math.max(rmx,rOf(xa+(xb-xa)*i/400));
  if(v<=up)rmx=Math.min(rmx,3*P.R);
  const ymax=Math.max(rmx*1.25,P.R*1.2,P.rm*1.15,1);
  const gx=x=>padL+(x-xa)/(xb-xa)*(w-padL-padR),gy=r=>h-padB-r/ymax*(h-padT-padB);
  const sx=niceStep((w-padL-padR)/(xb-xa),52),sy=niceStep((h-padT-padB)/ymax,34);
  for(let x=Math.ceil(xa/sx)*sx;x<=xb+1e-9;x+=sx){line(ctx,gx(x),gy(0),gx(x),gy(ymax),C.grid,1);text(ctx,nf(x,1),gx(x),gy(0)+10,C.muted,10,'center');}
  for(let r=0;r<=ymax+1e-9;r+=sy){line(ctx,gx(xa),gy(r),gx(xb),gy(r),C.grid,1);text(ctx,nf(r,1),gx(xa)-6,gy(r),C.muted,10,'right');}
  line(ctx,gx(xa),gy(0),gx(xb),gy(0),C.muted,1.3);line(ctx,gx(xa),gy(0),gx(xa),gy(ymax),C.muted,1.3);
  text(ctx,'x = uₓ (10⁴ m/s)',w-padR,gy(0)+24,C.muted,11,'right');
  text(ctx,'r (cm)',padL-6,padT-6,C.muted,11,'left');
  ctx.save();ctx.beginPath();ctx.rect(padL,padT-2,w-padL-padR+2,h-padT-padB+4);ctx.clip();
  // R and measured r
  line(ctx,gx(xa),gy(P.R),gx(xb),gy(P.R),C.miss,1.4,[6,4]);
  text(ctx,'R',gx(xb)-4,gy(P.R)-8,C.miss,11,'right');
  line(ctx,gx(xa),gy(P.rm),gx(xb),gy(P.rm),C.accent,1.4);
  text(ctx,_('r misurato','measured r'),gx(xa)+6,gy(P.rm)-8,C.accent,11,'left',FU);
  // threshold
  const xth=(umin()**2+v*v-up*up)/(2*v);
  if(xth>xa&&xth<xb){line(ctx,gx(xth),gy(0),gx(xth),gy(ymax),C.weak,1.4,[6,4]);text(ctx,_('soglia','threshold'),gx(xth)+4,gy(ymax)+10,C.weak,11,'left',FU);}
  // curves
  ctx.strokeStyle=C.gal;ctx.lineWidth=2.2;ctx.beginPath();
  for(let i=0;i<=300;i++){const x=xa+(xb-xa)*i/300,r=rOf(x);if(i===0)ctx.moveTo(gx(x),gy(r));else ctx.lineTo(gx(x),gy(r));}
  ctx.stroke();
  if(P.model!=='gal'){
    ctx.strokeStyle=C.rel;ctx.lineWidth=1.8;ctx.setLineDash([6,3]);ctx.beginPath();let first=true;
    for(let a=0;a<=180;a+=0.5){const q=frag('rel',a*DEG);if(!q.arr)continue;if(first){ctx.moveTo(gx(q.ux),gy(q.r));first=false;}else ctx.lineTo(gx(q.ux),gy(q.r));}
    ctx.stroke();ctx.setLineDash([]);
  }
  // solutions
  const k=P.rm/L,a=1+k*k,D=up*up*a-k*k*v*v;
  if(D>=0){
    const sq=Math.sqrt(D);
    [(v+sq)/a,(v-sq)/a].forEach((x,i)=>{
      if(x<xa||x>xb)return;
      line(ctx,gx(x),gy(P.rm),gx(x),gy(0),C.accent,1,[3,3]);
      dot(ctx,gx(x),gy(P.rm),5,C.accent,C.canvas,1.5);
      const rt=gx(x)>w*0.55;text(ctx,'x'+(i?'₂':'₁')+' = '+nf(x,2),gx(x)+(rt?-8:8),gy(P.rm)-14,C.accent,11,rt?'right':'left');
    });
  }
  ctx.restore();
  // outcome strip
  const y0=gy(0)+34,hh=12;
  for(let px_=padL;px_<=w-padR;px_+=2){
    const x=xa+(px_-padL)/(w-padL-padR)*(xb-xa);
    const r=rOf(x),u2=2*v*x+up*up-v*v;
    const col=x<=0?C.muted:(r>P.R?C.miss:(u2<umin()**2?C.weak:C.ok));
    ctx.fillStyle=col;ctx.fillRect(px_,y0,2,hh);
  }
  text(ctx,_('esito per ogni x','outcome for each x'),padL,y0+hh+11,C.muted,10.5,'left',FU);
  const lg=[[C.ok,_('rivelato','detected')],[C.weak,_('sotto soglia','below threshold')],[C.miss,_('fuori dal rivelatore','off the detector')]];
  let lx=w-padR;
  for(let i=lg.length-1;i>=0;i--){const tw=ctx.measureText(lg[i][1]).width+22;lx-=tw;ctx.fillStyle=lg[i][0];ctx.fillRect(lx,y0+hh+5,9,9);text(ctx,lg[i][1],lx+13,y0+hh+10.5,C.muted,10.5,'left',FU);}
}

/* t(x) = L/x plot */
function drawEqT(cv){
  const pp=prep(cv);if(!pp)return;const {ctx,w,h}=pp;
  const v=P.v,up=P.up,L=P.L;
  const xa=Math.max(v-up,0.03*(v+up)),xb=v+up;
  const padL=46,padR=16,padT=18,padB=34;
  const tOf=x=>L/x,tmin=tOf(xb);
  const t1=Math.min(tOf(xa)*1.12,8*tmin),t0=Math.max(0,tmin*0.75);
  const gx=x=>padL+(x-xa)/(xb-xa)*(w-padL-padR),gy=t=>h-padB-(t-t0)/(t1-t0)*(h-padT-padB);
  const sx=niceStep((w-padL-padR)/(xb-xa),52),st=niceStep((h-padT-padB)/(t1-t0),34);
  for(let x=Math.ceil(xa/sx)*sx;x<=xb+1e-9;x+=sx){line(ctx,gx(x),gy(t0),gx(x),gy(t1),C.grid,1);text(ctx,nf(x,1),gx(x),gy(t0)+10,C.muted,10,'center');}
  for(let t=Math.ceil(t0/st)*st;t<=t1+1e-9;t+=st){line(ctx,gx(xa),gy(t),gx(xb),gy(t),C.grid,1);text(ctx,nf(t,1),gx(xa)-6,gy(t),C.muted,10,'right');}
  line(ctx,gx(xa),gy(t0),gx(xb),gy(t0),C.muted,1.3);line(ctx,gx(xa),gy(t0),gx(xa),gy(t1),C.muted,1.3);
  text(ctx,'x = uₓ (10⁴ m/s)',w-padR,gy(t0)+24,C.muted,11,'right');
  text(ctx,'t (µs)',padL-6,padT-8,C.muted,11,'left');
  ctx.save();ctx.beginPath();ctx.rect(padL,padT-2,w-padL-padR+2,h-padT-padB+4);ctx.clip();
  const xth=(umin()**2+v*v-up*up)/(2*v);
  if(xth>xa&&xth<xb){line(ctx,gx(xth),gy(t0),gx(xth),gy(t1),C.weak,1.4,[6,4]);text(ctx,_('soglia','threshold'),gx(xth)+4,gy(t1)+10,C.weak,11,'left',FU);}
  ctx.strokeStyle=C.gal;ctx.lineWidth=2.2;ctx.beginPath();
  for(let i=0;i<=300;i++){const x=xa+(xb-xa)*i/300,t=tOf(x);if(i===0)ctx.moveTo(gx(x),gy(t));else ctx.lineTo(gx(x),gy(t));}
  ctx.stroke();
  if(P.model!=='gal'){
    ctx.strokeStyle=C.rel;ctx.lineWidth=1.8;ctx.setLineDash([6,3]);ctx.beginPath();let first=true;
    for(let a=0;a<=180;a+=0.5){const q=frag('rel',a*DEG);if(!q.arr)continue;if(first){ctx.moveTo(gx(q.ux),gy(q.t));first=false;}else ctx.lineTo(gx(q.ux),gy(q.t));}
    ctx.stroke();ctx.setLineDash([]);
  }
  const k=P.rm/L,a=1+k*k,D=up*up*a-k*k*v*v;
  if(D>=0){
    const sq=Math.sqrt(D);
    [(v+sq)/a,(v-sq)/a].forEach((x,i)=>{
      if(x<xa||x>xb)return;
      line(ctx,gx(x),gy(tOf(x)),gx(x),gy(t0),C.accent,1,[3,3]);line(ctx,gx(xa),gy(tOf(x)),gx(x),gy(tOf(x)),C.accent,1,[3,3]);
      dot(ctx,gx(x),gy(tOf(x)),5,C.accent,C.canvas,1.5);
      const rt=gx(x)>w*0.55;text(ctx,'t'+(i?'₂':'₁')+' = '+nf(tOf(x),2)+' µs',gx(x)+(rt?-8:8),gy(tOf(x))-14,C.accent,11,rt?'right':'left');
    });
  }
  ctx.restore();
}
