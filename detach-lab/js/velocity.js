/* Velocity plane */
'use strict';
/* ---------- velocity plane ---------- */
let VG=null;
function drawVel(cv){
  const pp=prep(cv);if(!pp)return;const {ctx,w,h}=pp;
  const ms=activeModels(),lab=P.frame==='lab',v=P.v,up=P.up;
  let xlo,xhi,yhi;
  if(lab&&P.zoom){xlo=v-1.5*up;xhi=v+1.5*up;yhi=1.5*up;}
  else if(lab){const s=v+up;xlo=Math.min(0,v-up)-0.04*s-0.3;xhi=s+0.04*s+0.3;yhi=Math.max(up*1.25,0.5);}
  else{xlo=-Math.min(v,3.2*up)-0.4*up;xhi=up*1.3;yhi=up*1.3;}
  const pad=26;
  const s=Math.min((w-2*pad)/(xhi-xlo),(h-2*pad)/(2*yhi));
  const ox=pad+(w-2*pad-s*(xhi-xlo))/2-xlo*s,oy=h/2;
  const px=x=>ox+x*s,py=y=>oy-y*s;
  VG={s,ox,oy};
  // grid
  const st=niceStep(s,38);
  for(let x=Math.ceil(xlo/st)*st;x<=xhi+1e-9;x+=st){
    line(ctx,px(x),py(-yhi),px(x),py(yhi),C.grid,1);
    if(Math.abs(x)>1e-9)text(ctx,nf(x,1),px(x),py(0)+11,C.muted,10,'center');
  }
  for(let y=Math.ceil(-yhi/st)*st;y<=yhi+1e-9;y+=st){
    line(ctx,px(xlo),py(y),px(xhi),py(y),C.grid,1);
    if(Math.abs(y)>1e-9)text(ctx,nf(y,1),px(0)-4,py(y),C.muted,10,'right');
  }
  line(ctx,px(xlo),py(0),px(xhi),py(0),C.muted,1.3);
  line(ctx,px(0),py(-yhi),px(0),py(yhi),C.muted,1.3);
  text(ctx,lab?'uₓ':'u′ₓ',px(xhi)-4,py(0)-10,C.muted,11,'right');
  text(ctx,lab?'u_y':'u′_y',px(0)+6,py(yhi)+4,C.muted,11,'left');

  const thSel=P.th;
  if(lab){
    for(const m of ms){
      const col=mcol(m),f=frag(m,thSel);
      // curve
      ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.beginPath();
      for(let a=-180;a<=180;a+=2){const q=frag(m,a*DEG);if(a===-180)ctx.moveTo(px(q.ux),py(q.uy));else ctx.lineTo(px(q.ux),py(q.uy));}
      ctx.stroke();
      for(let a=-180;a<180;a+=3){const q=frag(m,a*DEG);dot(ctx,px(q.ux),py(q.uy),2.4,stc(q.st),ms.length>1?col:null,0.8);}
      // cone
      const tm=thmax(m);
      if(tm!=null){
        const len=xhi/Math.cos(tm);
        line(ctx,px(0),py(0),px(len*Math.cos(tm)),py(len*Math.sin(tm)),col,1,[6,4]);
        line(ctx,px(0),py(0),px(len*Math.cos(tm)),py(-len*Math.sin(tm)),col,1,[6,4]);
        const idx=ms.indexOf(m);
        text(ctx,'θmax = '+nf(tm/DEG,m==='rel'&&!P.creal?2:2)+'°',px(xhi)-4,py(xhi*Math.tan(tm))-10-idx*16,col,11,'right');
      }
      // vectors
      if(m==='gal'){arrow(ctx,px(v),py(0),px(f.ux),py(f.uy),C.ink,1.4,7);}
      arrow(ctx,px(0),py(0),px(f.ux),py(f.uy),col,2.2,9);
      dot(ctx,px(f.ux),py(f.uy),6,null,C.ink,1.8);
    }
    arrow(ctx,px(0),py(0),px(v),py(0),C.ink,2.2,9);
    text(ctx,'v',px(v/2),py(0)+18,C.ink,12,'center',FU);
    dot(ctx,px(0),py(0),4,C.ink,null);
    text(ctx,'O',px(0)-6,py(0)-10,C.ink,11,'right');
    text(ctx,'u′',px(v+(frag('gal',thSel).ux-v)/2)+8,py(frag('gal',thSel).uy/2),C.muted,11,'left',FU);
  }else{
    // ion frame: circle of radius u'
    const lab0=-v;
    ms.forEach((m,i)=>{
      const col=mcol(m),rr=(ms.length>1&&i===1)?up*0.9:up;
      ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(px(0),py(0),rr*s,0,Math.PI*2);ctx.stroke();
      for(let a=-180;a<180;a+=3){const q=frag(m,a*DEG);dot(ctx,px(rr*Math.cos(a*DEG)),py(rr*Math.sin(a*DEG)),2.4,stc(q.st),ms.length>1?col:null,0.8);}
    });
    const xs=up*Math.cos(thSel),ys=up*Math.sin(thSel);
    if(v>up&&(ms.includes('gal'))){
      const ct=-up/v,sa=Math.sqrt(1-ct*ct),tx_=up*ct,ty_=up*sa;
      line(ctx,px(lab0),py(0),px(tx_),py(ty_),C.gal,1,[6,4]);
      line(ctx,px(lab0),py(0),px(tx_),py(-ty_),C.gal,1,[6,4]);
      dot(ctx,px(tx_),py(ty_),3.5,C.gal,null);dot(ctx,px(tx_),py(-ty_),3.5,C.gal,null);
      text(ctx,'θ′ = '+nf(Math.acos(ct)/DEG,1)+'°',px(tx_)-6,py(ty_)-10,C.gal,11,'right');
    }
    arrow(ctx,px(0),py(0),px(xs),py(ys),C.ink,2.4,9);
    dot(ctx,px(xs),py(ys),6,null,C.ink,1.8);
    text(ctx,'u′',px(xs/2)-4,py(ys/2)-9,C.ink,12,'right',FU);
    dot(ctx,px(0),py(0),4,C.ink,null);
    text(ctx,_('ione','ion'),px(0)-6,py(0)+13,C.ink,11,'right',FU);
    const edge=px(xlo)+2;
    if(lab0*s+ox>=pad-1){
      arrow(ctx,px(0),py(0),px(lab0),py(0),C.accent,2,8);
      dot(ctx,px(lab0),py(0),4,C.accent,null);
      text(ctx,'O (lab)',px(lab0),py(0)-12,C.accent,11,'center',FU);
    }else{
      arrow(ctx,px(0),py(0),edge,py(0),C.accent,2,8);
      text(ctx,'−v = '+nf(-v,1)+_(' (laboratorio)',' (laboratory)'),edge+4,py(0)-12,C.accent,11,'left',FU);
    }
    if(ms.length>1)text(ctx,_('cerchio interno: Einstein','inner circle: Einstein'),px(0),py(-yhi)-6,C.rel,10.5,'center',FU);
  }
  // model legend
  if(ms.length>1){text(ctx,'Galileo',10,12,C.gal,11,'left',FU);text(ctx,'Einstein',64,12,C.rel,11,'left',FU);}
}
function velPointer(e,cv){
  if(!VG)return;
  const r=cv.getBoundingClientRect();
  const x=(e.clientX-r.left-VG.ox)/VG.s,y=-(e.clientY-r.top-VG.oy)/VG.s;
  let best=null;
  if(P.frame==='ion'){best=Math.atan2(y,x);}
  else{
    const m=activeModels()[0];let bd=1e18;
    for(let a=-180;a<=180;a+=0.5){const q=frag(m,a*DEG),d=(q.ux-x)**2+(q.uy-y)**2;if(d<bd){bd=d;best=a*DEG;}}
  }
  setTh(best);
}
