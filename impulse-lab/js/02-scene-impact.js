// Impulse Lab · 02-scene-impact.js
// Scene 1: an object hits a force sensor (contact model, prediction, real data).
// Classic script: shares one global scope with the other js/0*.js files, loaded in order after js/boot.js.
'use strict';

/* ================= modello del contatto ================= */
/* Carico: F = f(x) (molla, molla che si irrigidisce, plateau). Scarico: lineare da (x_max, F_max) a x0,
   scelto in modo che v' = e·v. Il lavoro fatto in compressione vale ½ m v0². */
function simulateContact(m,v0,k,e,prof){
  const tau=Math.sqrt(m/k), dt=tau/1500, xs=v0*tau;
  let FL;
  if(prof==='stiff') FL=x=>k*x*(1+4*(x/xs)*(x/xs));
  else if(prof==='plat'){ const Fp=0.5*v0*Math.sqrt(k*m); FL=x=>Fp*Math.tanh(k*x/Fp); }
  else FL=x=>k*x;
  const X=[0],V=[v0],FA=[0];
  let x=0,v=v0,a=0,n=0;
  while(v>0&&n<90000){
    const xn=x+v*dt+0.5*a*dt*dt, an=-FL(xn)/m, vn=v+0.5*(a+an)*dt;
    x=xn; v=vn; a=an; n++; X.push(x); V.push(Math.max(v,0)); FA.push(FL(x));
  }
  const xmax=x, Fpk=FL(xmax), tpk=n*dt, WL=0.5*m*v0*v0;
  let x0=xmax-2*e*e*WL/Fpk; if(x0<0) x0=0;
  const dx=xmax-x0, hasUnl=(e>0&&dx>1e-9*xmax);
  const om=hasUnl?Math.sqrt(Fpk/dx/m):Infinity, tunl=hasUnl?Math.PI/(2*om):0;
  const T=tpk+tunl, vout=hasUnl?dx*om:0;
  const interp=(arr,t)=>{ const f=clamp(t/dt,0,n), i=Math.min(Math.floor(f),n-1), fr=f-i; return arr[i]*(1-fr)+arr[i+1]*fr; };
  const sim={m,v0,k,e,dt,tpk,T,xmax,Fpk,x0,vout,om,hasUnl,Fmax:Fpk,WL,
    F(t){ if(t<0||t>T) return 0; if(t<=tpk) return interp(FA,t); return hasUnl?Fpk*Math.cos(om*(t-tpk)):0; },
    v(t){ if(t<=0) return v0; if(t<=tpk) return interp(V,t); if(hasUnl&&t<T) return -dx*om*Math.sin(om*(t-tpk)); return hasUnl?-vout:0; },
    x(t){ if(t<=0) return 0; if(t<=tpk) return interp(X,t); if(hasUnl&&t<T) return x0+dx*Math.cos(om*(t-tpk)); return x0; }
  };
  sim.En=t=>{ const vv=sim.v(t), K=0.5*m*vv*vv; let U,Q;
    if(t<=tpk){ U=WL-K; Q=0; } else if(hasUnl&&t<T){ const xx=sim.x(t)-x0; U=0.5*(Fpk/dx)*xx*xx; Q=WL-K-U; } else { U=0; Q=WL-K; }
    return {K,U,Q}; };
  const G=600, Jg=new Float64Array(G+1);
  for(let i=1;i<=G;i++) Jg[i]=Jg[i-1]+0.5*(sim.F((i-1)/G*T)+sim.F(i/G*T))*T/G;
  sim.Jtot=Jg[G];
  sim.Jc=t=>{ const f=clamp(t/T,0,1)*G, i=Math.min(Math.floor(f),G-1), fr=f-i; return Jg[i]*(1-fr)+Jg[i+1]*fr; };
  sim.dp=m*v0*(1+e);
  return sim;
}
function sampleSim(sim,n){ const t=new Float64Array(n),F=new Float64Array(n); for(let i=0;i<n;i++){ t[i]=i/(n-1)*sim.T; F[i]=sim.F(t[i]); } return {t,F}; }

/* ================= scena 1: urto contro un sensore ================= */
const M1={
  id:'impact', playing:false, clk:0, twoGraphs:true, pen:false, hintKey:null, pins:[], real:null, realM:null, sk:{on:false,show:false,bins:null,N:90,res:null},
  p:{m:0.5,v:6,k:2e4,e:0.7,prof:'lin',obj:'ball',pad:null,limit:0,g2:'p'},
  timing(){ return {A:1.2,D:S.rt&&this.sim?this.sim.T:3.4,B:1.4}; },
  total(){ const t=this.timing(); return t.A+t.D+t.B; },
  done(){ return this.clk>=this.total()-1e-9; },
  presets:{
    ball:{m:0.5,v:6,k:2e4,e:0.7,prof:'lin',obj:'ball'},
    clay:{m:0.5,v:6,k:2e4,e:0,prof:'lin',obj:'clay'},
    egg:{m:0.06,v:4.4,k:6e4,e:0.1,prof:'lin',obj:'egg',limit:30},
    car:{m:1200,v:13.9,k:3e6,e:0.05,prof:'plat',obj:'car',limitG:30},
    tennis:{m:0.057,v:30,k:2e5,e:0.6,prof:'stiff',obj:'tennis'},
    wheel:{m:75,v:14,k:2e6,e:0.1,prof:'lin',obj:'dummy',pad:'solid',limitG:60},
    airbag:{m:75,v:14,k:1e5,e:0,prof:'plat',obj:'dummy',pad:'bag',limitG:60}
  },
  init(){
    const self=this, p=this.p;
    this.su=hostFor('#setupHost','impact'); this.sh=hostFor('#showHost','impact'); this.qk=hostFor('#quick','impact'); this.qk.className='quickset'; this.tb=hostFor('#tables','impact');
    this.PF=new Plot(g1,{l:58}); this.PP=new Plot(g2,{l:58});
    layers(this,[
      {k:'vel',col:'vel',quick:true},{k:'force',col:'force',quick:true},{k:'pair',col:'force',quick:true,sub:true},
      {k:'area',col:'imp',kind:'dot',quick:true},{k:'mean',col:'accent',kind:'dot',quick:true,sub:true},
      {k:'tang',col:'mom',sub:true,on:false},{k:'values',kind:'dot',on:true},{k:'stress',col:'force',kind:'dot'}
    ]);
    readoutFor(this,[['t','t'],['F','F'],['v','v'],['p','p']]);
    // setup
    group(this.su,'g_scen');
    this.sgPre=seg(this.su,[{v:'ball',key:'pr_ball'},{v:'clay',key:'pr_clay'},{v:'egg',key:'pr_egg'},{v:'car',key:'pr_car'},{v:'tennis',key:'pr_tennis'},{v:'wheel',key:'pr_wheel'},{v:'airbag',key:'pr_airbag'}],'ball',v=>self.preset(v),'wrap');
    group(this.su,'g_par');
    this.sl={
      m:slider(this.su,{id:'i-m',key:'p_m',min:0.01,max:3000,log:true,val:p.m,fmt:fmtMass,onInput:v=>{p.m=v;self.changed();}}),
      v:slider(this.su,{id:'i-v',key:'p_v',min:0.5,max:40,step:0.1,val:p.v,fmt:v=>num(v)+' m/s',onInput:v=>{p.v=v;self.changed();}}),
      k:slider(this.su,{id:'i-k',key:'p_k',min:10,max:1e8,log:true,val:p.k,fmt:v=>si(v,'N/m'),onInput:v=>{p.k=v;self.changed();}}),
      e:slider(this.su,{id:'i-e',key:'p_e',min:0,max:1,step:0.01,val:p.e,fmt:v=>num(v,2),onInput:v=>{p.e=v;self.changed();}})
    };
    note(this.su,'e_hint');
    const pf=h('div',{class:'ctl'}); pf.append(h('label',{},h('span',{'data-i18n':'prof'}))); this.sgProf=seg(pf,[{v:'lin',key:'prof_lin',svg:'M3 18 L27 3'},{v:'stiff',key:'prof_stiff',svg:'M3 18 C14 17 21 14 27 2'},{v:'plat',key:'prof_plat',svg:'M3 18 C8 7 12 5 27 5'}],p.prof,v=>{p.prof=v;self.changed();},'wrap'); this.su.append(pf);
    group(this.su,'g_g2'); this.sgG2=seg(this.su,[{v:'p',key:'g2_p'},{v:'x',key:'g2_x'}],p.g2,v=>{p.g2=v;markDirty();});
    this.areaUI=areaGroup(this.su);
    group(this.su,'g_pred');
    const pr=h('div',{class:'row'}); pr.append(h('label',{class:'num',for:'i-pred'},h('span',{'data-i18n':'pred_J'}),this.inp=h('input',{id:'i-pred',type:'text',inputmode:'decimal',autocomplete:'off'})),this.chk=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'check'})));
    this.su.append(pr); this.predOut=note(this.su,'','pm'); this.predOut.removeAttribute('data-i18n');
    this.chk.addEventListener('click',()=>self.check()); this.inp.addEventListener('keydown',e=>{ if(e.key==='Enter') self.check(); });
    group(this.su,'g_cmp');
    const br=h('div',{class:'row'}); this.su.append(br);
    const b1=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'pin'})), b2=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'unpin'}));
    br.append(b1,b2); b1.addEventListener('click',()=>self.pin()); b2.addEventListener('click',()=>{self.pins=[];self.renderPins();markDirty();});
    this.pinBox=h('div',{class:'gchips'}); this.su.append(this.pinBox);
    group(this.su,'g_real');
    this.taReal=h('textarea',{class:'ta',rows:4,placeholder:'t\tF\n0.000\t0\n0.001\t12.5\n…',spellcheck:'false',autocomplete:'off'}); this.su.append(this.taReal);
    const ru=h('div',{class:'ctl'}); ru.append(h('label',{},h('span',{'data-i18n':'real_units'}))); const rr=h('div',{class:'row'}); ru.append(rr);
    this.sgTU=seg(rr,[{v:1,text:'t: s'},{v:1e-3,text:'t: ms'}],1,()=>{}); this.sgFU=seg(rr,[{v:1,text:'F: N'},{v:1e3,text:'F: kN'}],1,()=>{}); this.su.append(ru);
    this.sgAl=seg(this.su,[{v:'auto',key:'al_auto'},{v:'raw',key:'al_raw'}],'auto',()=>{});
    const rb=h('div',{class:'row'}); this.su.append(rb);
    const bL=h('button',{class:'btn primary',type:'button'},h('span',{'data-i18n':'real_load'})), bE=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'real_example'})), bC=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'real_clear'}));
    rb.append(bL,bE,bC); bL.addEventListener('click',()=>self.loadReal()); bE.addEventListener('click',()=>self.exampleReal()); bC.addEventListener('click',()=>{ self.real=null; self.realM=null; self.taReal.value=''; self.realOut.textContent=''; markDirty(); });
    this.realOut=note(this.su,'','pm'); this.realOut.removeAttribute('data-i18n');
    // previsione disegnata sul grafico
    this.gh=hostFor('#gtop','impact'); this.gh.style.cssText='display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;width:100%';
    this.bStart=h('button',{class:'btn',type:'button'},icn('pencil'),h('span',{'data-i18n':'sk_start'})); this.bCmp=h('button',{class:'btn primary',type:'button'},h('span',{'data-i18n':'sk_cmp'})); this.bClr=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'sk_clr'}));
    this.skMsg=h('span',{class:'note',style:'margin:0;flex:1 1 100%'}); this.gh.append(this.bStart,this.bCmp,this.bClr,this.skMsg);
    this.bStart.addEventListener('click',()=>self.skStart()); this.bCmp.addEventListener('click',()=>self.skCompare()); this.bClr.addEventListener('click',()=>self.skClear());
    g1.addEventListener('pointerdown',e=>self.skDown(e)); g1.addEventListener('pointermove',e=>self.skMove(e)); const up=()=>{ self.skDrag=false; }; g1.addEventListener('pointerup',up); g1.addEventListener('pointercancel',up);
    this.syncSk();
    tableFor(this,[
      {k:'T',key:'r_T',cls:'k-imp'},{k:'Fmax',key:'r_Fmax',cls:'k-force'},{k:'Fm',key:'r_Fm'},{k:'amax',key:'r_amax'},'sep',
      {k:'J',key:'r_Jrect',dyn:true,cls:'k-imp'},{k:'dp',key:'r_dp',cls:'k-mom'},{k:'diff',key:'r_diff'},'sep',
      {k:'pi',key:'r_pi',cls:'k-mom'},{k:'pf',key:'r_pf',cls:'k-mom'},{k:'Q',key:'r_Q',cls:'k-q'},'sep',
      {k:'Jr',key:'r_Jreal',cls:'k-imp'},{k:'Fr',key:'r_Freal',cls:'k-force'}
    ]);
    this.preset('ball',false);
  },
  enter(){ this.areaUI.sync(); this.buildRects(); this.syncSk(); },
  preset(id,auto){
    const q=this.presets[id], p=this.p;
    Object.assign(p,{m:q.m,v:q.v,k:q.k,e:q.e,prof:q.prof,obj:q.obj,pad:q.pad||null,limit:q.limit||(q.limitG?q.m*q.limitG*9.81:0)});
    this.sl.m.set(p.m); this.sl.v.set(p.v); this.sl.k.set(p.k); this.sl.e.set(p.e); this.sgProf.set(p.prof); this.sgPre.set(id);
    this.predOut.textContent=''; this.inp.value='';
    this.recalc(auto!==false);
  },
  changed(){ this.sgPre.set(''); this.recalc(true); },
  recalc(auto){
    const p=this.p, s=this.sim=simulateContact(p.m,p.v,p.k,p.e,p.prof), G=300;
    this.gt=new Float64Array(G); this.gF=new Float64Array(G); this.gp=new Float64Array(G);
    for(let i=0;i<G;i++){ const t=i/(G-1)*s.T; this.gt[i]=t; this.gF[i]=s.F(t); this.gp[i]=p.m*s.v(t); }
    this.buildRects(); this.clk=auto?0:this.total(); this.playing=!!auto&&!this.sk.on; markDirty();
  },
  buildRects(){ if(this.sim) this.rects=buildRects(t=>this.sim.F(t),this.sim.T); },
  areaChanged(){ this.buildRects(); this.calcReal(); },
  reset(){ AREA.phi=Math.random(); this.buildRects(); this.clk=0; this.playing=true; markDirty(); },
  toggle(){ if(this.sk.on) return; if(this.done()){ this.reset(); } else this.playing=!this.playing; markDirty(); },
  stepOnce(){ if(this.sk.on) return; this.playing=false; this.clk=Math.min(this.total(),this.clk+0.05); markDirty(); },
  tick(dt){ if(this.sk.on) return; this.clk+=dt; if(this.clk>=this.total()){ this.clk=this.total(); this.playing=false; } },
  state(){
    const t=this.timing(), s=this.sim; let phase,tau;
    if(this.clk<t.A){ phase=0; tau=0; } else if(this.clk<t.A+t.D){ phase=1; tau=(this.clk-t.A)/t.D*s.T; } else { phase=2; tau=s.T; }
    return {phase,tau,t};
  },
  Jlive(tau){ return AREA.view==='int'?this.sim.Jc(tau):rectSumUpTo(this.rects,tau); },
  limitState(tau){ const p=this.p,s=this.sim; if(!p.limit) return null; const peak=tau<s.tpk?s.F(tau):s.Fpk; return {bad:peak>p.limit}; },
  draw(){},
  drawMain(){
    const st=this.state(), f=fit(cv), ctx=f.ctx, W=f.w, H=f.h, c=C(), p=this.p, s=this.sim, t=st.t, L=this.L;
    const u=clamp(Math.min(W/600,H/320),0.62,1.5), gy=H*0.78;
    ctx.clearRect(0,0,W,H); ctx.fillStyle=c.surface; ctx.fillRect(0,0,W,H);
    // terreno a tratteggio
    ctx.save(); ctx.strokeStyle=c.ground; ctx.lineWidth=1.5; ctx.beginPath();
    for(let x=-H;x<W;x+=14){ ctx.moveTo(x,H); ctx.lineTo(x+(H-gy),gy); } ctx.stroke(); ctx.restore();
    ctx.fillStyle=c.ink; ctx.fillRect(0,gy-1.5,W,3);
    const geo={ball:{w:46,h:46},clay:{w:46,h:46},tennis:{w:38,h:38},dummy:{w:36,h:66},egg:{w:34,h:44},car:{w:104,h:44}}[p.obj], gw=geo.w*u, gh=geo.h*u;
    const sx=W-72*u, sw=32*u, sh=124*u, t0=58*u, pf=sx-t0;
    // muro e sensore
    ctx.fillStyle=c.ground; ctx.fillRect(sx+sw,gy-sh-4*u,W-sx-sw,sh+4*u); ctx.strokeStyle=c.ink; ctx.lineWidth=2; ctx.strokeRect(sx+sw+1,gy-sh-4*u+1,W-sx-sw,sh+4*u);
    ctx.fillStyle=c.surface; ctx.fillRect(sx,gy-sh,sw,sh); ctx.strokeRect(sx+1,gy-sh+1,sw-2,sh-2);
    // posizione dell'oggetto
    const cx0=26*u+gw/2, cxT=pf-gw/2, vA=(cxT-cx0)/t.A, sc=0.8*t0/Math.max(s.xmax,1e-12);
    let bf,padDef,tau=st.tau;
    if(st.phase===0){ const cx=cx0+(cxT-cx0)*(this.clk/t.A); bf=cx+gw/2; padDef=0; }
    else if(st.phase===1){ padDef=s.x(tau)*sc; bf=pf+padDef; }
    else { const tt=this.clk-(t.A+t.D); padDef=s.x0*sc; bf=pf+padDef-p.e*vA*tt; }
    const cx=bf-gw/2, cy=gy-gh/2;
    const F=st.phase===1?s.F(tau):0, vNow=st.phase===0?s.v0:(st.phase===1?s.v(tau):-s.vout);
    // elemento deformabile: molla, molla progressiva o struttura che si accartoccia
    const px0=pf+padDef, ph=64*u, comp=clamp(padDef/(0.8*t0),0,1.2);
    this.drawPad(ctx,p.prof,px0,sx,gy,ph,u,c,comp,L.stress?clamp(F/s.Fpk,0,1):0);
    // oggetto
    const ls=this.limitState(tau), bad=!!(ls&&ls.bad);
    let sq=0; if(p.obj==='ball'||p.obj==='tennis'||p.obj==='dummy') sq=0.3*(st.phase===1?clamp(F/s.Fpk,0,1):0); else if(p.obj==='clay') sq=0.4*(st.phase===0?0:st.phase===1?clamp(s.x(tau)/s.xmax,0,1):1);
    ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle=c.ink;
    if(p.obj==='ball'||p.obj==='clay'||p.obj==='tennis'||p.obj==='dummy'){
      ctx.translate(bf,cy); ctx.scale(1-sq,1+sq*0.55); ctx.translate(-gw/2,0); const r=gw/2;
      if(p.obj==='dummy'){ const w=gw, hh=gh;
        ctx.fillStyle=c.mom; ctx.fillRect(-w*.42,hh*.16,w*.84,hh*.32); ctx.strokeRect(-w*.42,hh*.16,w*.84,hh*.32);
        ctx.fillStyle=c.accent; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(-w*.42,-hh*.3,w*.84,hh*.5,5); else ctx.rect(-w*.42,-hh*.3,w*.84,hh*.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#F2C9A0'; ctx.beginPath(); ctx.arc(w*.08,-hh*.4,hh*.12,0,7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle=c.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-w*.3,-hh*.28); ctx.lineTo(w*.3,hh*.1); ctx.stroke(); }
      else if(p.obj==='ball'){ ctx.fillStyle=c.mom; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill(); ctx.stroke(); ctx.fillStyle=c.surface; ctx.globalAlpha=.55; ctx.beginPath(); ctx.arc(-r*.3,-r*.34,r*.26,0,7); ctx.fill(); ctx.globalAlpha=1; }
      else if(p.obj==='tennis'){ ctx.fillStyle='#D5EC3B'; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill(); ctx.stroke(); ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=2.6; ctx.beginPath(); ctx.arc(-r*1.15,0,r*.95,-0.95,0.95); ctx.stroke(); ctx.beginPath(); ctx.arc(r*1.15,0,r*.95,Math.PI-0.95,Math.PI+0.95); ctx.stroke(); }
      else { ctx.fillStyle='#B8693D'; ctx.beginPath(); ctx.moveTo(-r,0.1*r); ctx.bezierCurveTo(-r,-r*1.05,-r*.1,-r*1.1,r*.45,-r*.9); ctx.bezierCurveTo(r*1.05,-r*.7,r*1.1,r*.6,r*.5,r*.95); ctx.bezierCurveTo(-r*.1,r*1.1,-r,r*1.0,-r,0.1*r); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#8A4A27'; for(const q of [[-.35,-.3],[.2,.25],[.35,-.35],[-.2,.45],[0,-.05]]){ ctx.beginPath(); ctx.arc(q[0]*r,q[1]*r,r*.1,0,7); ctx.fill(); } }
    } else if(p.obj==='egg'){
      ctx.fillStyle='#F6EAD2'; ctx.beginPath(); ctx.ellipse(cx,cy,gw/2,gh/2,0,0,7); ctx.fill(); ctx.stroke();
      if(bad){ ctx.strokeStyle=c.force; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx+4*u,cy-18*u); ctx.lineTo(cx-3*u,cy-6*u); ctx.lineTo(cx+5*u,cy); ctx.lineTo(cx-3*u,cy+9*u); ctx.lineTo(cx+2*u,cy+18*u); ctx.stroke(); }
    } else {
      ctx.fillStyle=bad?c.force:c.accent; ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(cx-gw/2,cy-gh/2,gw,gh-10*u,6*u); else ctx.rect(cx-gw/2,cy-gh/2,gw,gh-10*u);
      ctx.fill(); ctx.stroke(); ctx.fillStyle=c.surface; ctx.fillRect(cx-gw*.1,cy-gh/2+5*u,gw*.34,12*u); ctx.strokeRect(cx-gw*.1,cy-gh/2+5*u,gw*.34,12*u);
      ctx.fillStyle=c.ink; for(const dx of [-gw*.28,gw*.28]){ ctx.beginPath(); ctx.arc(cx+dx,gy-9*u,9*u,0,7); ctx.fill(); }
    }
    ctx.restore();
    // frecce
    const ay=cy-gh/2-20*u, vk=56*u*u/u;
    const showV=L.vel&&Math.abs(vNow)>0.015*s.v0;
    if(showV){ const ln=vNow/s.v0*vk*1.3; arrow(ctx,cx,ay,ln,0,c.vel,{w:4}); label(ctx,L.values?'v '+num(Math.abs(vNow),3)+' m/s':'v',clamp(cx+ln/2,40,W-40),ay-9,c.vel,'center',10.5); }
    if(F>0){
      // coppia: la forza sull'oggetto e la reazione sulla pastiglia partono dal punto di contatto, su due file separate
      const Lf=Math.max(24*u,F/s.Fpk*66*u), yo=8*u, fl=L.values?'F '+si(F,'N',3):'F';
      if(L.force) arrow(ctx,bf,cy-yo,-Lf,0,c.force,{w:4,halo:true,label:fl,badge:L.pair?'1':null});
      if(L.pair) arrow(ctx,bf,cy+yo,Lf,0,c.force,{w:4,halo:true,hollow:true,label:fl,badge:'1'});
      ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(bf,cy,3.2,0,7); ctx.fill();
    }
    // display del sensore
    const lcdW=92*u, lcdH=26*u, lx=Math.min(W-lcdW-6,sx+sw/2-lcdW/2);
    ctx.fillStyle=c.surface; ctx.strokeStyle=c.ink; ctx.lineWidth=2; ctx.fillRect(lx,gy-sh-lcdH-14*u,lcdW,lcdH); ctx.strokeRect(lx+1,gy-sh-lcdH-14*u+1,lcdW-2,lcdH-2);
    label(ctx,si(F,'N',3),lx+lcdW/2,gy-sh-lcdH-14*u+lcdH*.7,F>0?c.force:c.muted,'center',Math.max(11,13*u));
    label(ctx,st.phase>0?'t = '+si(tau,'s',3):'t = 0',12,H-10,c.muted,'left',11);
    label(ctx,T('prof_'+p.prof),W-10,H-10,c.muted,'right',10.5);
    timeStrip(ctx,W,H,{A:t.A,D:t.D,B:t.B},this.clk,st.phase,S.rt,t.D/s.T);
  },
  drawPad(ctx,prof,x0,x1,gy,ph,u,c,comp,stress){
    const yc=gy-ph/2, wire=prof==='stiff'?2+comp*3.5:2.5, padk=this.p.pad;
    ctx.save(); ctx.strokeStyle=c.ink; ctx.lineWidth=wire; ctx.lineJoin='round';
    if(padk==='solid'){
      ctx.fillStyle=c.ink; ctx.fillRect(x0,gy-ph,Math.max(6*u,x1-x0),ph); ctx.fillStyle=c.surface; ctx.globalAlpha=.5; for(let k=1;k<4;k++) ctx.fillRect(x0+2,gy-ph+k*ph/4-1,Math.max(2,x1-x0-4),2); ctx.globalAlpha=1;
    } else if(padk==='bag'){
      const w=Math.max(8,x1-x0); ctx.fillStyle=c.tile2; ctx.globalAlpha=.85; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x0,gy-ph*1.05,w,ph*1.05,Math.min(22*u,w/2)); else ctx.rect(x0,gy-ph*1.05,w,ph*1.05); ctx.fill(); ctx.globalAlpha=1; ctx.lineWidth=2.5; ctx.stroke();
      ctx.lineWidth=1.8; ctx.beginPath(); for(let k=1;k<3;k++){ const y=gy-ph*1.05+k*ph*1.05/3; ctx.moveTo(x0+4,y); ctx.quadraticCurveTo(x0+w/2,y+(k===1?7:-7)*u,x0+w-4,y); } ctx.stroke();
    } else if(prof==='plat'){
      // struttura che si accartoccia: pieghe a fisarmonica, sempre piu' fitte
      ctx.fillStyle=c.pad; ctx.fillRect(x0,gy-ph,x1-x0,ph); ctx.strokeRect(x0+1,gy-ph+1,x1-x0-2,ph-2);
      const n=7, amp=(2+comp*5)*u; ctx.lineWidth=2;
      for(let i=1;i<n;i++){ const x=x0+(x1-x0)*i/n; ctx.beginPath(); for(let y=gy-ph;y<=gy;y+=ph/8){ const k=Math.round((y-(gy-ph))/(ph/8)); ctx.lineTo(x+(k%2?amp:-amp),y); } ctx.stroke(); }
    } else {
      const N=8, pts=[[x0,yc]]; const L0=x1-x0, ax=ph*0.34;
      let xs=[]; for(let i=0;i<=N;i++){ const f=i/N; xs.push(prof==='stiff'?Math.pow(f,1.0+1.1*(1-comp*0.6)):f); }
      const xl=Math.min(x0+4*u,x1-4*u), xr=Math.max(xl, x1-4*u);
      ctx.beginPath(); ctx.moveTo(x0,yc); ctx.lineTo(xl,yc);
      for(let i=1;i<N;i++){ const x=xl+(xr-xl)*xs[i]; ctx.lineTo(x,yc+(i%2?-ax:ax)); }
      ctx.lineTo(xr,yc); ctx.lineTo(x1,yc); ctx.stroke();
      ctx.fillStyle=c.ink; ctx.fillRect(x0-3*u,gy-ph,6*u,ph);
    }
    if(stress>0){ ctx.fillStyle=c.force; ctx.globalAlpha=.7*stress; ctx.fillRect(x0,gy-ph,Math.max(6*u,x1-x0),ph); ctx.globalAlpha=1; }
    ctx.restore();
  },
  pBounds(){ const p=this.p, pi=p.m*p.v; return {pi, lo:-Math.max(p.e,0.12)*pi*1.35, hi:pi*1.2}; },
  drawInset(){
    const st=this.state(), s=this.sim, p=this.p, tau=st.tau, Jl=this.Jlive(tau);
    if(S.inset==='e'){
      const E=s.En(tau), WL=s.WL;
      drawBarsGen(eb,{bars:[{a:0,b:E.K,col:C().vel,name:'K'},{a:0,b:E.U,col:C().mom,name:'U'},{a:0,b:E.Q,col:C().q,name:'Q'}],lo:0,hi:WL*1.18,unit:'J',cap:'K+U+Q=E₀',lines:[{y:WL,col:C().ink}]});
    } else {
      const b=this.pBounds(); let lo=b.lo; const Jf=AREA.view==='int'?s.Jtot:rectSumUpTo(this.rects,s.T+1); if(b.pi-Jf<lo*.95) lo=(b.pi-Jf)*1.1;
      drawBarsGen(eb,{bars:[{a:0,b:b.pi,col:C().mom,name:T('b_pi')},{a:b.pi,b:b.pi-Jl,col:C().imp,name:T('b_J')},{a:0,b:p.m*s.v(tau),col:C().mom,alpha:.6,name:tau>=s.T?T('b_pf'):T('b_pn')}],lo,hi:Math.max(b.hi,b.pi*1.05),unit:'kg·m/s',cap:'pᵢ+J=p',lines:[{y:b.pi,col:C().muted},{y:b.pi-Jl,col:C().imp}]});
    }
  },
  drawGraphs(){
    const st=this.state(), s=this.sim, p=this.p, c=C(), L=this.L, tau=st.tau;
    drawForcePlot(this.PF,{sim:s,tau,gt:this.gt,gF:this.gF,rects:this.rects,pins:this.pins,limit:p.limit,live:st.phase===1,real:this.real,hide:this.sk.on},L);
    const sk=this.sk;
    if(sk.bins){ const P=this.PF, ctx=P.ctx; P.clipOn(); ctx.save(); ctx.strokeStyle=c.accent; ctx.lineWidth=3; ctx.lineJoin='round'; if(sk.show) ctx.setLineDash([8,5]); ctx.beginPath(); let pen=false;
      for(let i=0;i<sk.N;i++){ const b=sk.bins[i]; if(isNaN(b)){ pen=false; continue; } const x=P.X((i+0.5)/sk.N*P.xb), y=P.Y(b); if(pen) ctx.lineTo(x,y); else ctx.moveTo(x,y); pen=true; }
      ctx.stroke(); ctx.restore(); P.clipOff(); }
    this.ts=scaleTime(Math.max(s.T*1.1,...this.pins.map(q=>q.T*1.1)));
    if(p.g2==='x'){ this.drawFx(tau,st); return; }
    const P=this.PP, b=this.pBounds(); P.begin(); P.range(0,s.T*1.1,b.lo,b.hi);
    const ts=scaleTime(s.T*1.1); P.grid({xdiv:ts.div,xl:'t ('+ts.pfx+'s)',yl:'p (kg·m/s)'});
    P.clipOn(); P.hline(b.pi,c.muted,[4,4]); P.hline(-p.e*b.pi,c.muted,[4,4]);
    const xs=[],ys=[]; for(let i=0;i<this.gt.length&&this.gt[i]<=tau;i++){ xs.push(this.gt[i]); ys.push(this.gp[i]); }
    if(tau>0){ xs.push(tau); ys.push(p.m*s.v(tau)); } else { xs.push(0); ys.push(b.pi); }
    P.line(xs,ys,c.mom,3); if(st.phase===1) P.dot(tau,p.m*s.v(tau),c.mom,5);
    if(L.tang&&st.phase===1){ const pv=p.m*s.v(tau), sl=-s.F(tau), dxs=s.T*0.28; P.line([tau-dxs,tau+dxs],[pv-sl*dxs,pv+sl*dxs],c.force,2.2,[6,3]); label(P.ctx,'F = −dp/dt',P.X(tau)+8,P.Y(pv)-10,c.force,'left',10.5); }
    P.clipOff();
    if(tau>=s.T){ const x=P.x1-14; arrow(P.ctx,x,P.Y(b.pi),0,P.Y(-p.e*b.pi)-P.Y(b.pi),c.imp,{w:2.5}); label(P.ctx,'Δp',x-6,P.Y((b.pi-p.e*b.pi)/2)+4,c.imp,'right',11); }
  },
  drawFx(tau,st){
    const P=this.PP, s=this.sim, c=C(), L=this.L; P.begin(); const xm=s.xmax*1.08, fs=scaleFor(s.Fpk*1.14), xs_=scaleFor(xm);
    P.range(0,xm,0,s.Fpk*1.14); P.grid({xdiv:xs_.div,ydiv:fs.div,xl:'x ('+xs_.pfx+'m)',yl:'F ('+fs.pfx+'N)'});
    P.clipOn(); const ctx=P.ctx, N=240, X=[],Y=[];
    for(let i=0;i<=N;i++){ const t=i/N*s.T; if(t>tau) break; X.push(s.x(t)); Y.push(s.F(t)); }
    if(tau>0){ X.push(s.x(tau)); Y.push(s.F(tau)); }
    if(X.length>1){ ctx.save(); ctx.fillStyle=c.mom; ctx.globalAlpha=.25; ctx.beginPath(); ctx.moveTo(P.X(0),P.Y(0)); for(let i=0;i<X.length;i++) ctx.lineTo(P.X(X[i]),P.Y(Y[i])); ctx.lineTo(P.X(X[X.length-1]),P.Y(0)); ctx.closePath(); ctx.fill(); ctx.restore(); }
    P.line(X,Y,c.force,3); if(st.phase===1) P.dot(s.x(tau),s.F(tau),c.force,5);
    P.clipOff(); label(ctx,T('fx_note'),P.x0+8,P.y1+14,c.muted,'left',10.5);
  },
  updateText(){
    const st=this.state(), s=this.sim, p=this.p, tau=st.tau, R=this.cells, Jl=this.Jlive(tau), done=tau>=s.T;
    const v=st.phase===0?s.v0:(st.phase===1?s.v(tau):-s.vout), F=st.phase===1?s.F(tau):0;
    this.rv.t.textContent=st.phase===0?'—':si(tau,'s'); this.rv.F.textContent=si(F,'N'); this.rv.v.textContent=num(v,3)+' m/s'; this.rv.p.textContent=num(p.m*v,3)+' kg·m/s';
    R.T.textContent=si(s.T,'s'); R.Fmax.textContent=si(s.Fpk,'N'); R.Fm.textContent=si(s.dp/s.T,'N'); R.amax.textContent=num(s.Fpk/p.m/GR,3)+' g';
    R.J_dt.textContent=T(AREA.view==='int'?'r_Jint':AREA.view==='log'?'r_Jlog':'r_Jrect');
    R.J.textContent=num(Jl,3)+' N·s'; R.dp.textContent=num(s.dp,3)+' kg·m/s';
    R.diff.textContent=done?num(100*(Jl-s.dp)/s.dp,2)+' %':'—';
    R.pi.textContent=num(p.m*p.v,3)+' kg·m/s'; R.pf.textContent=num(-p.m*p.v*p.e,3)+' kg·m/s'; R.Q.textContent=num(100*(1-p.e*p.e),3)+' %';
    const dtv=AREA.view==='log'?1/AREA.rate:s.T/AREA.N; areaUIs.forEach(a=>{ if(a.nt) a.nt.textContent=AREA.view==='int'?'':T('dt_note',si(dtv,'s')); });
    // etichette
    R.Jr.textContent=this.realM?num(this.realM.J,3)+' N·s':'—'; R.Fr.textContent=this.realM?si(this.realM.Fmax,'N'):'—'; this.tb.style.display=this.sk.on?'none':'';
    let html=''; const ls=this.limitState(tau);
    if(ls){ const k=p.obj==='egg'?(ls.bad?'ko_egg':'ok_egg'):p.obj==='dummy'?(ls.bad?'ko_dummy':'ok_dummy'):(ls.bad?'ko_car':'ok_car'); html+='<span class="chip '+(ls.bad?'bad':(done?'ok':''))+'">'+T(k)+'</span><span class="chip">'+T('limit')+': '+si(p.limit,'N',3)+'</span>'; }
    if(AREA.view==='log'&&this.rects.length<3) html+='<span class="chip bad">'+T('log_miss')+'</span>';
    if(this.realM) html+='<span class="chip" style="border-color:var(--c2);color:var(--c2)">'+T('real_chip',num(this.realM.J,3),num(100*(this.realM.J-s.dp)/s.dp,2))+'</span>';
    if(this.sk.res&&this.sk.show) html+='<span class="chip" style="border-color:var(--accent);color:var(--accent)">'+this.sk.res+'</span>';
    if(this.sk.on) html='';
    const ch=$('#gchips'); if(ch.dataset.h!==html){ ch.innerHTML=html; ch.dataset.h=html; }
  },
  /* ---- dati reali ---- */
  loadReal(){
    const tu=this.sgTU.val, fu=this.sgFU.val; let rows=[];
    for(const ln of this.taReal.value.split(/\r?\n/)){
      const s=ln.trim(); if(!s) continue; let tok;
      if(s.includes('\t')) tok=s.split('\t'); else if(s.includes(';')) tok=s.split(';');
      else if(/\s/.test(s)){ tok=s.split(/\s+/); if(tok.length!==2||tok[0].endsWith(',')) tok=s.split(/\s*,\s*/); } else tok=s.split(',');
      if(tok.length<2) continue; const t=parseNum(tok[0]), f=parseNum(tok[1]); if(isFinite(t)&&isFinite(f)) rows.push([t*tu,f*fu]);
    }
    if(rows.length<5){ this.real=null; this.realM=null; this.realOut.textContent=T('real_err'); markDirty(); return; }
    rows.sort((a,b)=>a[0]-b[0]);
    if(this.sgAl.val==='auto'){
      const nb=Math.max(3,Math.floor(rows.length*0.05)); let b0=0; for(let i=0;i<nb;i++) b0+=rows[i][1]; b0/=nb; rows=rows.map(r=>[r[0],r[1]-b0]);
      const fm=Math.max(...rows.map(r=>Math.abs(r[1]))); let i0=rows.findIndex(r=>r[1]>0.05*fm); i0=Math.max(0,i0-1);
      let i1=rows.length-1; while(i1>i0+3&&Math.abs(rows[i1][1])<0.02*fm) i1--; i1=Math.min(rows.length-1,i1+2);
      const t0=rows[Math.min(rows.length-1,i0+1)][0]; rows=rows.slice(i0,i1+1).map(r=>[r[0]-t0,r[1]]);
    }
    const n=rows.length, t=new Float64Array(n), F=new Float64Array(n); rows.forEach((r,i)=>{ t[i]=r[0]; F[i]=r[1]; });
    this.real={t,F,n,T:t[n-1],Fmax:Math.max(...F)}; this.calcReal(); this.realOut.textContent=T('real_ok',n,si(this.real.T,'s',3)); markDirty();
  },
  calcReal(){
    const R=this.real; if(!R){ this.realM=null; return; }
    const {t,F,n,T:TT}=R; let J=0;
    const Fd=x=>{ if(x<=t[0]) return F[0]; if(x>=t[n-1]) return F[n-1]; let lo=0,hi=n-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(t[m]<=x) lo=m; else hi=m; } return F[lo]+(F[hi]-F[lo])*(x-t[lo])/(t[hi]-t[lo]||1); };
    if(AREA.view==='int'){ for(let i=1;i<n;i++) J+=0.5*(F[i]+F[i-1])*(t[i]-t[i-1]); }
    else if(AREA.view==='log'){ const d=[]; for(let i=1;i<n;i++) d.push(t[i]-t[i-1]); d.sort((a,b)=>a-b); const dt=d[d.length>>1]||0; for(let i=0;i<n;i++) J+=F[i]*dt; }
    else { const N=AREA.N, D=TT/N; for(let i=0;i<N;i++){ const x=i*D+(AREA.hm==='left'?0:AREA.hm==='mid'?D/2:D); J+=Fd(Math.min(x,TT))*D; } }
    this.realM={J,Fmax:R.Fmax};
  },
  exampleReal(){
    const s=this.sim, n=70, T0=0.37, lines=['t\tF'], g=()=>Math.sqrt(-2*Math.log(Math.random()||1e-9))*Math.cos(2*Math.PI*Math.random());
    for(let i=0;i<n;i++){ const t=-0.12*s.T+i/(n-1)*1.4*s.T, f=s.F(t)+0.03*s.Fpk*g()+0.02*s.Fpk; lines.push((t+T0).toPrecision(6)+'\t'+f.toPrecision(5)); }
    this.taReal.value=lines.join('\n'); this.sgTU.set(1); this.sgFU.set(1); this.loadReal();
  },
  /* ---- previsione disegnata ---- */
  syncSk(){ const k=this.sk; this.bStart.hidden=k.on; this.bCmp.hidden=!k.on; this.bClr.hidden=!(k.on||k.bins); g1.classList.toggle('sketching',k.on&&active===this); this.skMsg.textContent=k.on?T('sk_hint'):''; },
  skStart(){ const k=this.sk; k.on=true; k.show=false; k.res=null; k.bins=new Float32Array(k.N).fill(NaN); this.clk=0; this.playing=false; setTab('graphs'); this.syncSk(); markDirty(); },
  skClear(){ const k=this.sk; k.on=false; k.show=false; k.bins=null; k.res=null; this.syncSk(); markDirty(); },
  skCompare(){
    const k=this.sk, P=this.PF, N=k.N, b=Array.from(k.bins); const idx=b.map((v,i)=>isNaN(v)?-1:i).filter(i=>i>=0);
    if(idx.length<2){ this.skClear(); return; }
    const f=new Float64Array(N); for(let i=0;i<N;i++){ if(!isNaN(b[i])){ f[i]=b[i]; continue; } let l=-1,r=-1; for(let j=i-1;j>=0;j--) if(!isNaN(b[j])){ l=j; break; } for(let j=i+1;j<N;j++) if(!isNaN(b[j])){ r=j; break; } f[i]=(l>=0&&r>=0)?b[l]+(b[r]-b[l])*(i-l)/(r-l):0; }
    const dx=P.xb/N; let J=0, pk=0; for(let i=0;i<N;i++){ J+=f[i]*dx; pk=Math.max(pk,f[i]); }
    const s=this.sim; k.res=T('sk_res',num(J,3),num(s.dp,3),num(100*Math.abs(J-s.dp)/s.dp,2),si(pk,'N',3),si(s.Fpk,'N',3));
    k.on=false; k.show=true; this.syncSk(); this.reset();
  },
  skPt(e){ const r=g1.getBoundingClientRect(), P=this.PF, k=this.sk, t=P.invX(e.clientX-r.left), F=clamp(P.invY(e.clientY-r.top),0,P.yb); if(t<0||t>P.xb) return null; return {i:clamp(Math.floor(t/P.xb*k.N),0,k.N-1),F}; },
  skDown(e){ if(!this.sk.on||active!==this) return; e.preventDefault(); try{ g1.setPointerCapture(e.pointerId); }catch(x){} this.skDrag=true; this.skLast=null; this.skMove(e); },
  skMove(e){ if(!this.skDrag||!this.sk.on||active!==this) return; const p=this.skPt(e); if(!p) return; const b=this.sk.bins, l=this.skLast;
    if(l){ const a=Math.min(l.i,p.i), z=Math.max(l.i,p.i); for(let i=a;i<=z;i++){ const u=z===a?1:(i-l.i)/(p.i-l.i||1); b[i]=l.F+(p.F-l.F)*clamp(u,0,1); } } else b[p.i]=p.F;
    this.skLast=p; markDirty(); },
  check(){
    const v=parseNum(this.inp.value), dp=this.sim.dp;
    this.predOut.textContent=isNaN(v)?T('pred_nan'):T('pred_res',num(v,3),num(dp,3),num(100*Math.abs(v-dp)/dp,2),'N·s');
  },
  pin(){
    const s=this.sim,p=this.p,sm=sampleSim(s,200);
    const used=this.pins.map(q=>q.ci); let ci=[0,1,2].find(i=>!used.includes(i));
    if(ci===undefined){ ci=this.pins[0].ci; this.pins.shift(); }
    this.pins.push({t:sm.t,F:sm.F,T:s.T,Fmax:s.Fpk,ci,txt:fmtMass(p.m)+' · k='+si(p.k,'N/m',2)+' · e='+num(p.e,2)+' → '+si(s.Fpk,'N',2)+', '+si(s.T,'s',2)});
    this.renderPins(); markDirty();
  },
  renderPins(){ this.pinBox.innerHTML=''; this.pins.forEach(q=>{ const c=h('span',{class:'chip',text:q.txt}); c.style.borderColor='var(--c'+(q.ci+1)+')'; c.style.color='var(--c'+(q.ci+1)+')'; this.pinBox.append(c); }); },
  csvText(){
    const s=this.sim,p=this.p,n=200; let out='t_s\tF_N\tv_mps\tp_kgmps\n';
    for(let i=0;i<n;i++){ const t=i/(n-1)*s.T; out+=[t,s.F(t),s.v(t),p.m*s.v(t)].map(csvNum).join('\t')+'\n'; }
    return out;
  }
};
modes.impact=M1;
