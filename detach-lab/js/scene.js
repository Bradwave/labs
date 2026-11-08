/* Apparatus scene (laboratory / ion frame) */
'use strict';

/* ---------- space scene ---------- */
const HITS={};   // clickable marks per canvas, rebuilt at every draw
const isPick=(m,thx,j)=>!!P.pick&&P.pick.m===m&&P.pick.j===j&&Math.abs(P.pick.thx-thx)<1e-9;
function drawSpace(cv,frame){
  const pp=prep(cv);if(!pp)return;const {ctx,w,h}=pp;
  const hits=HITS[cv.id]=[];
  const ms=activeModels(),m0=ms[0],real=P.setup==='real',single=ms.length===1;
  const L=P.L,v=P.v,up=P.up,T=clockT(frame);
  const xmin=frame==='lab'?(real?-0.32:-0.22)*L:(P.flow?FLOW_XMIN*L:-0.5*L),xmax=1.12*L,pad=12;
  const sX=(w-2*pad)/(xmax-xmin);
  let rmaxAll=0;
  for(const m of ms){const tm=thmax(m);if(tm!=null)rmaxAll=Math.max(rmaxAll,L*Math.tan(tm));}
  let yr=Math.max(rmaxAll*1.25,P.R*1.2,0.5);
  if(v<=up)yr=L*0.8;
  yr=Math.min(yr,L);
  const half=h/2-24;
  let sY=sX;
  if(P.exag)sY=Math.min(Math.max(half/yr,sX),sX*12);
  const px=x=>pad+(x-xmin)*sX,py=y=>h/2-y*sY;
  const X=(xo,m=m0)=>frame==='lab'?xo:xo/(m==='rel'?gamma():1)-v*T;
  const yTop=(h/2-8)/sY,yw=yTop*(real?0.80:0.93);
  const keepF=[_('rivelatore','detector'),'MCP + '+_('anodo','anode'),'laser',_('coppa di Faraday','Faraday cup')];
  const lbl=(s,x,y,col=C.muted,al='left',sz=10.5)=>{if(P.flow&&(frame==='ion'||!keepF.includes(s)))return;text(ctx,s,x,y,col,sz,al);};

  // deflector geometry and anion trajectory
  const x1=0.1*L,x2=0.3*L;
  const gPl=v>up?Math.max(1.15*x2*Math.tan(Math.max(...ms.map(m=>thmax(m)||0))),0.8):x2*0.6;
  const Y2=Math.min(0.8*gPl,0.9*Math.pow(10/v,2)/gamOf(m0));
  const slope=2*Y2/(x2-x1),floorY=0.88*yw;
  const anionY=xl=>xl<=x1?0:(xl<=x2?-Y2*Math.pow((xl-x1)/(x2-x1),2):-Y2-slope*(xl-x2));
  const xCup=Math.min(x2+(floorY-Y2)/slope,0.9*L);
  // electron
  const EU=50,el=compose(m0,0,EU),yd=real?0.5*yw:0.9*yTop,xe=el[0]*yd/el[1];

  ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
  // chamber, pipe and accelerator (realistic setup)
  if(real){
    const xa=X(-0.14*L),xb=X(1.06*L);
    ctx.globalAlpha=0.35;ctx.fillStyle=C.grid;ctx.fillRect(px(xa),py(yw),px(xb)-px(xa),py(-yw)-py(yw));ctx.globalAlpha=1;
    ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.setLineDash([]);ctx.strokeRect(px(xa),py(yw),px(xb)-px(xa),py(-yw)-py(yw));
    const pr=Math.max(0.16*yw,6/sY);
    line(ctx,px(X(-4*L)),py(pr),px(xa),py(pr),C.ink,2);
    line(ctx,px(X(-4*L)),py(-pr),px(xa),py(-pr),C.ink,2);
    for(let k=0;k<3;k++){
      const xc=X(-0.31*L+k*0.06*L),wpx=0.04*L*sX,hh=Math.max(1.7*pr*sY,10);
      ctx.fillStyle=C.accent;ctx.globalAlpha=0.85;ctx.fillRect(px(xc),py(0)-hh,wpx,2*hh);ctx.globalAlpha=1;
      ctx.strokeStyle=C.ink;ctx.lineWidth=1.5;ctx.strokeRect(px(xc),py(0)-hh,wpx,2*hh);
    }
    lbl('LINAC',px(X(-0.31*L)),py(0)-Math.max(1.7*pr*sY,10)-8,C.ink,'left',11);
    lbl(_('camera di interazione','interaction chamber'),px(xa)+6,py(yw)+12);
  }
  line(ctx,0,py(0),w,py(0),C.grid,1,[4,4]);
  // laser
  const xl=px(X(0));
  const yL=real?yTop*0.97:yTop;
  ctx.strokeStyle=C.muted;ctx.lineWidth=1.4;ctx.beginPath();
  const yEnd=real?py(-yL):py(0)-8;
  for(let yy=py(yL);yy<=yEnd;yy+=2){const xx=xl+3*Math.sin(yy*0.55);if(yy===py(yL))ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}
  ctx.stroke();
  arrow(ctx,xl,py(0)-14,xl,py(0)-5,C.muted,1.4,6);
  lbl('laser',xl+8,py(yL)+12,C.muted,'left',11);
  if(real){
    const ww=0.035*L*sX;
    line(ctx,xl-ww,py(yw),xl+ww,py(yw),C.accent,5);line(ctx,xl-ww,py(-yw),xl+ww,py(-yw),C.accent,5);
    ctx.fillStyle=C.ink;ctx.fillRect(xl-9,py(-yw)+6,18,9);
    lbl(_('dump','dump'),xl+13,py(-yw)+11,C.muted,'left',10);
    // electron detector
    const exb=px(X(xe)),ew=0.07*L*sX;
    ctx.fillStyle=C.ink;ctx.fillRect(exb-ew,py(yd+0.07*yw),2*ew,py(yd)-py(yd+0.07*yw));
    lbl(_('elettroni','electrons'),exb+ew+4,py(yd+0.035*yw),C.muted,'left',10);
  }
  // deflector, anion path, cup
  const th=real?6:2.5;
  line(ctx,px(X(x1)),py(gPl),px(X(x2)),py(gPl),C.ink,th);
  line(ctx,px(X(x1)),py(-gPl),px(X(x2)),py(-gPl),C.ink,th);
  const xm=(px(X(x1))+px(X(x2)))/2;
  lbl(real?'−HV':'−',xm-4,py(gPl)-10,C.muted,'right',12);
  lbl(real?'+HV':'+',xm,py(-gPl)+12,C.muted,'center',12);
  lbl(_('deflettore','deflector'),xm+34,py(gPl)-10,C.muted,'left',11);
  ctx.strokeStyle=C.muted;ctx.lineWidth=1.2;ctx.setLineDash([5,3]);ctx.beginPath();
  for(let i=0;i<=40;i++){const xx=x1+(xCup-x1)*i/40,yy=anionY(xx);if(i===0)ctx.moveTo(px(X(xx)),py(yy));else ctx.lineTo(px(X(xx)),py(yy));}
  ctx.stroke();ctx.setLineDash([]);
  if(real){
    const cw=0.05*L*sX,xc=px(X(xCup));
    ctx.fillStyle=C.ink;ctx.beginPath();ctx.moveTo(xc-cw,py(-yw));ctx.lineTo(xc+cw,py(-yw));ctx.lineTo(xc+cw*0.6,py(-yw)-14);ctx.lineTo(xc-cw*0.6,py(-yw)-14);ctx.closePath();ctx.fill();
    lbl(_('coppa di Faraday','Faraday cup'),xc,py(-yw)+13,C.muted,'center',10);
  }else lbl(_('anioni deviati','deflected anions'),px(X(x2))+6,py(anionY(x2))+14,C.muted,'left',10.5);
  // neutral detector
  ms.forEach((m,i)=>{
    const xr=px(X(L,m)),col=single?C.ink:mcol(m);
    line(ctx,xr,py(yTop*0.95),xr,py(-yTop*0.95),C.line,1,[3,3]);
    if(real){
      const xa2=px(X(L*1.03,m));
      line(ctx,xa2,py(1.25*P.R),xa2,py(-1.25*P.R),C.muted,4);
      line(ctx,xr,py(P.R),xr,py(-P.R),col,i?5:7);
      if(i===0)lbl('MCP + '+_('anodo','anode'),xr,py(-P.R)+14,C.muted,'center',10.5);
    }else{
      line(ctx,xr,py(P.R),xr,py(-P.R),col,i?5:7);
      if(i===0)lbl(_('rivelatore','detector'),xr,py(-P.R)+14,C.muted,'center',10.5);
    }
  });
  // hypothetical emission rays
  for(const m of ms){
    if(!P.fan||P.flow)break;
    for(let a=-170;a<=170;a+=10){
      const f=frag(m,a*DEG),col=single?stc(f.st):mcol(m);
      if(f.arr){
        ctx.globalAlpha=single?0.4:0.28;
        if(frame==='lab')line(ctx,px(0),py(0),px(L),py(f.y),col,1);
        else line(ctx,px(0),py(0),px(up*Math.cos(a*DEG)*f.tion),py(f.y),col,1);
        ctx.globalAlpha=1;
        const tarr=frame==='lab'?f.t:f.tion;
        if(T>=tarr){
          dot(ctx,px(X(L,m)),py(f.y),single?3:2.6,col,null);
          hits.push({x:px(X(L,m)),y:py(f.y),m,thx:a*DEG,j:null});
          if(isPick(m,a*DEG,null))dot(ctx,px(X(L,m)),py(f.y),8,null,C.ink,2);
        }
      }else{
        const dx=frame==='lab'?f.ux:up*Math.cos(a*DEG),dy=frame==='lab'?f.uy:up*Math.sin(a*DEG),n=Math.hypot(dx,dy)||1;
        ctx.globalAlpha=0.25;line(ctx,px(0),py(0),px(0.14*L*dx/n),py(0.14*L*dy/n),C.muted,1);ctx.globalAlpha=1;
      }
    }
  }
  // anion beam: bunches crossing the laser
  if(P.anions){
    const g=frame==='ion'?gamOf(m0):1;
    const jc=Math.floor(T*v/(DB*L)),j0=P.flow?(frame==='lab'?jc-34:-7):-9,j1=P.flow?(frame==='lab'?jc+6:12):9;
    for(let j=j0;j<=j1;j++){
      if(j===0&&!P.flow)continue;
      const old=P.flow&&frame==='lab'&&j<jc-13;   // far-away bunches: only the marks on the detector remain
      const tj=j*DB*L/v,tau=T-g*tj,xl2=frame==='lab'?v*tau:g*v*tau,xdraw=frame==='lab'?xl2:-g*v*tj;
      if(!detached(j)||tau<0){
        if(old||xl2>=xCup)continue;
        const sx=px(xdraw),sy=py(xl2>0?anionY(xl2):0);
        if(sx<-8||sx>w+8)continue;
        ctx.globalAlpha=0.65;dot(ctx,sx,sy,3.4,C.ink,null);ctx.globalAlpha=1;
      }else{
        const sx=px(xdraw);
        if(sx>-8&&sx<w+8){line(ctx,sx-4,py(0),sx+4,py(0),C.muted,1.2);line(ctx,sx,py(0)-4,sx,py(0)+4,C.muted,1.2);}
        const thj=(hash(j,1)*2-1)*Math.PI;
        if(P.flow&&!old){
          // photodetachment electron of this bunch
          const tE=yd/el[1];let ex,ey;
          if(frame==='lab'){const tt=Math.min(tau,tE);ex=el[0]*tt;ey=el[1]*tt;}
          else if(tau>=yd/EU){ex=X(xe);ey=yd;}else{ex=xdraw;ey=EU*tau;}
          if(real||tau<tE){ctx.globalAlpha=0.7;dot(ctx,px(ex),py(ey),2.2,C.accent,null);ctx.globalAlpha=1;}
        }
        for(const m of ms)for(const thx of [thj,thj+Math.PI]){
          const f=frag(m,thx);let x,y,xt,yt;
          const hit=P.flow?(f.arr&&(f.st==='ok'||f.st==='weak')):f.arr;
          if(old&&!hit)continue;
          if(frame==='lab'){const tt=hit?Math.min(tau,f.t):tau;x=f.ux*tt;y=f.uy*tt;xt=x;yt=y;}
          else if(hit&&tau>=f.tion){x=X(L,m);y=f.y;xt=xdraw+up*Math.cos(thx)*f.tion;yt=f.y;}   // the mark stays on the detector, the path ends at the impact point
          else{x=xdraw+up*Math.cos(thx)*tau;y=up*Math.sin(thx)*tau;xt=x;yt=y;}
          let al=0.55;
          if(P.flow){const age=frame==='lab'?(f.arr?tau-f.t:0):(f.arr?tau-f.tion:0);if(hit&&age>0)al=0.55*Math.max(0.3,1-age/(30*DB*L/v));}
          if(P.flow&&!old){ctx.globalAlpha=al*0.3;line(ctx,px(frame==='lab'?0:xdraw),py(0),px(xt),py(yt),single?C.ink:mcol(m),1);}
          ctx.globalAlpha=al;
          if(P.flow&&hit&&(frame==='lab'?tau>=f.t:tau>=f.tion)){ctx.globalAlpha=Math.min(1,al*1.9);dot(ctx,px(x),py(y),4.6,stc(f.st),C.canvas,1.5);
            hits.push({x:px(x),y:py(y),m,thx,j});
            if(isPick(m,thx,j)){ctx.globalAlpha=1;dot(ctx,px(x),py(y),9,null,C.ink,2);}
          }   // clearly visible impact mark on the detector
          else dot(ctx,px(x),py(y),P.flow?3.2:3,single?C.ink:mcol(m),null);
          ctx.globalAlpha=1;
        }
      }
    }
  }
  // selected ion before dissociation, and centre of mass
  if(P.flow){/* flow: no reference fragment */}
  else if(T<0){
    const xi=frame==='lab'?v*T:0;
    line(ctx,0,py(0),px(xi),py(0),C.muted,1.2);
    dot(ctx,px(xi)-5,py(0),5,C.ink,null);dot(ctx,px(xi)+5,py(0),5,C.ink,null);
    lbl('I₂⁻',px(xi),py(0)-14,C.ink,'center',11);
  }else{
    const xc=frame==='lab'?v*T:0;
    line(ctx,px(xc)-5,py(0),px(xc)+5,py(0),C.muted,1.2);line(ctx,px(xc),py(0)-5,px(xc),py(0)+5,C.muted,1.2);
    // electron
    let ex,ey,stuck;
    if(frame==='lab'){const tE=yd/el[1],tt=Math.min(T,tE);ex=el[0]*tt;ey=el[1]*tt;stuck=T>=tE;}
    else if(T>=yd/EU){ex=X(xe);ey=yd;stuck=true;}
    else{ex=0;ey=EU*T;stuck=false;}
    if(!(stuck&&!real)){
      dot(ctx,px(ex),py(ey),2.8,C.accent,C.canvas,1);
      if(!stuck)lbl('e⁻',px(ex)+6,py(ey),C.accent,'left',11);
    }
  }
  // selected fragment and partner
  if(T>=0&&!P.flow){
    for(const m of ms){
      const col=mcol(m);
      (P.partner?[[P.th,1],[P.th+Math.PI,0]]:[[P.th,1]]).forEach(([thx,main])=>{
        const f=frag(m,thx);let x,y,xt,yt,stuck=false;
        if(frame==='lab'){const tt=f.arr?Math.min(T,f.t):T;x=f.ux*tt;y=f.uy*tt;xt=x;yt=y;stuck=f.arr&&T>=f.t;}
        else if(f.arr&&T>=f.tion){x=X(L,m);y=f.y;xt=up*Math.cos(thx)*f.tion;yt=f.y;stuck=true;}
        else{x=up*Math.cos(thx)*T;y=up*Math.sin(thx)*T;xt=x;yt=y;}
        ctx.globalAlpha=main?1:0.5;
        line(ctx,px(0),py(0),px(xt),py(yt),col,main?2:1.2);
        dot(ctx,px(x),py(y),main?6:4.5,col,C.canvas,1.5);
        if(stuck&&main){
          dot(ctx,px(x),py(y),10,null,stc(f.st),2);
          hits.push({x:px(x),y:py(y),m,thx,j:null});
          if(isPick(m,thx,null))dot(ctx,px(x),py(y),14,null,C.ink,2);
        }
        ctx.globalAlpha=1;
      });
    }
  }
  ctx.restore();
  // labels
  text(ctx,frame==='lab'?_('Sistema del laboratorio','Laboratory frame'):_('Sistema dello ione','Ion frame'),10,14,C.ink,12,'left');
  text(ctx,clockStr(frame),w-10,14,C.ink,12,'right');
  const bar=sX*5>36?5:10;
  line(ctx,10,h-14,10+bar*sX,h-14,C.ink,2);
  text(ctx,bar+' cm',10+bar*sX+6,h-14,C.muted,10.5);
  if(P.exag&&sY/sX>1.05){
    line(ctx,w-16,h-14,w-16,h-14-2*sY,C.ink,2);
    text(ctx,'2 cm (y ×'+nf(sY/sX,1)+')',w-24,h-14-sY,C.muted,10.5,'right');
  }
}
