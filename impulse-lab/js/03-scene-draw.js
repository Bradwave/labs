// Impulse Lab · 03-scene-draw.js
// Scene 2: draw F(t) and watch the motion it produces.
// Classic script: shares one global scope with the other js/0*.js files, loaded in order after js/boot.js.
'use strict';

/* ================= scena 2: disegna la forza ================= */
const M2={
  id:'draw', playing:false, clk:0, twoGraphs:true, pen:true, hintKey:'hint_draw',
  p:{m:2,v0:0,T:4,N:8,Fa:10}, bars:[], run:null, ch:null, drawing:false, last:null,
  view(){ return AREA.view==='int'?'int':'rect'; },
  init(){
    const self=this, p=this.p;
    this.su=hostFor('#setupHost','draw'); this.sh=hostFor('#showHost','draw'); this.qk=hostFor('#quick','draw'); this.qk.className='quickset'; this.tb=hostFor('#tables','draw');
    this.PF=new Plot(cv,{l:48,r:12,t:26,b:26}); this.PP=new Plot(g1,{l:58});
    layers(this,[
      {k:'vel',col:'vel',quick:true},{k:'force',col:'force',quick:true},{k:'area',col:'imp',kind:'dot',quick:true},{k:'mean',col:'accent',kind:'dot',quick:true,sub:true},
      {k:'pair',col:'force',quick:true,sub:true},{k:'values',kind:'dot'},{k:'strobe',col:'mom',kind:'dot'}
    ]);
    group(this.su,'g_shape');
    seg(this.su,[{v:'rect',key:'sh_rect'},{v:'tri',key:'sh_tri'},{v:'sin',key:'sh_sin'},{v:'spike',key:'sh_spike'},{v:'push',key:'sh_push'},{v:'zero',key:'sh_zero'}],'',v=>self.shape(v),'wrap');
    group(this.su,'g_par');
    this.sl={
      m:slider(this.su,{id:'d-m',key:'d_m',min:0.5,max:5,step:0.1,val:p.m,fmt:v=>num(v)+' kg',onInput:v=>{p.m=v;self.edited();}}),
      v0:slider(this.su,{id:'d-v',key:'d_v0',min:-3,max:3,step:0.1,val:p.v0,fmt:v=>num(v)+' m/s',onInput:v=>{p.v0=v;self.edited();}}),
      T:slider(this.su,{id:'d-T',key:'d_T',min:1,max:10,step:0.5,val:p.T,fmt:v=>num(v)+' s',onInput:v=>{p.T=v;self.edited();}}),
      N:slider(this.su,{id:'d-N',key:'d_N',min:4,max:40,step:1,val:p.N,fmt:v=>String(Math.round(v)),onInput:v=>{
        v=Math.round(v); const old=self.bars, no=old.length; self.bars=Array.from({length:v},(_,j)=>old[Math.min(no-1,Math.floor((j+0.5)/v*no))]); p.N=v; self.edited(); }})
    };
    const fb=h('div',{class:'ctl'}); fb.append(h('label',{},h('span',{'data-i18n':'d_Fa'}))); this.sgFa=seg(fb,[{v:5,text:'±5 N'},{v:10,text:'±10 N'},{v:20,text:'±20 N'},{v:50,text:'±50 N'}],p.Fa,v=>{ p.Fa=v; self.bars=self.bars.map(b=>clamp(b,-v,v)); self.edited(); },'wrap'); this.su.append(fb);
    this.areaUI=areaGroup(this.su,{draw:true});
    group(this.su,'g_pred');
    const pr=h('div',{class:'row'}); pr.append(h('label',{class:'num',for:'d-pred'},h('span',{'data-i18n':'pred_v'}),this.inp=h('input',{id:'d-pred',type:'text',inputmode:'decimal',autocomplete:'off'})),this.chk=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'check'})));
    this.su.append(pr); this.predOut=note(this.su,'','pm'); this.predOut.removeAttribute('data-i18n');
    this.chk.addEventListener('click',()=>self.check()); this.inp.addEventListener('keydown',e=>{ if(e.key==='Enter') self.check(); });
    group(this.su,'g_chal');
    this.chText=note(this.su,'ch_idle');
    const cb=h('div',{class:'row'}); this.su.append(cb);
    const b1=h('button',{class:'btn primary',type:'button'},h('span',{'data-i18n':'ch_new'})); this.bEnd=h('button',{class:'btn',type:'button',hidden:''},h('span',{'data-i18n':'ch_end'}));
    cb.append(b1,this.bEnd); b1.addEventListener('click',()=>self.newChallenge()); this.bEnd.addEventListener('click',()=>{ self.ch=null; self.bEnd.hidden=true; self.renderCh(); markDirty(); });
    tableFor(this,[
      {k:'t',key:'r2_t'},{k:'F',key:'r2_F',cls:'k-force'},{k:'J',key:'r_Jrect',dyn:true,cls:'k-imp'},'sep',{k:'p',key:'r2_p',cls:'k-mom'},{k:'v',key:'r2_v',cls:'k-vel'},{k:'x',key:'r2_x'},{k:'Fmax',key:'r2_Fmax',cls:'k-force'}
    ]);
    this.shape('tri'); this.clk=p.T; this.playing=false;
    cv.addEventListener('pointerdown',e=>{ if(active!==self) return; const r=cv.getBoundingClientRect(); if(e.clientY-r.top>self.Ht) return; try{cv.setPointerCapture(e.pointerId);}catch(_){} self.drawing=true; self.last=null; self.paint(e); e.preventDefault(); });
    cv.addEventListener('pointermove',e=>{ if(active===self&&self.drawing) self.paint(e); });
    const stop=()=>{ self.drawing=false; self.last=null; };
    cv.addEventListener('pointerup',stop); cv.addEventListener('pointercancel',stop);
  },
  enter(){ if(AREA.view==='log'){ AREA.view='rect'; areaChanged(); } this.areaUI.sync(); this.compute(); },
  shape(v){
    const p=this.p, N=p.N, A=0.6*p.Fa, q=p.Fa/20;
    this.bars=Array.from({length:N},(_,i)=>{
      const u=(i+0.5)/N; let f=0;
      if(v==='rect') f=A; else if(v==='tri') f=A*1.3*(1-Math.abs(2*u-1)); else if(v==='sin') f=A*1.3*Math.sin(Math.PI*u);
      else if(v==='spike') f=(i===Math.min(N-1,Math.round(N*0.2)))?0.95*p.Fa:0; else if(v==='push') f=u<0.5?A:-A;
      return Math.round(clamp(f,-p.Fa,p.Fa)/q)*q;
    });
    this.edited();
  },
  paint(e){
    const P=this.PF, r=cv.getBoundingClientRect(), p=this.p, N=p.N;
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const col=clamp(Math.floor(P.invX(x)/(p.T/N)),0,N-1), q=p.Fa/20;
    const F=Math.round(clamp(P.invY(y),-p.Fa,p.Fa)/q)*q;
    if(this.last&&this.last.col!==col){
      const a=this.last, n=Math.abs(col-a.col), d=col>a.col?1:-1;
      for(let i=1;i<=n;i++) this.bars[a.col+d*i]=Math.round((a.F+(F-a.F)*i/n)/q)*q;
    } else this.bars[col]=F;
    this.last={col,F}; this.edited(true);
  },
  edited(keep){ this.compute(); this.clk=0; this.playing=false; if(!keep) this.predOut.textContent=''; markDirty(); },
  areaChanged(){ if(this.run){ this.compute(); markDirty(); } },
  compute(){
    const p=this.p, N=p.N, T=p.T, D=T/N, per=Math.ceil(1600/N), K=N*per, hh=T/K, bars=this.bars, view=this.view();
    const Fat=t=>{
      if(view==='rect') return bars[Math.min(N-1,Math.max(0,Math.floor(t/D+1e-9)))];
      const u=t/D-0.5; if(u<=0) return bars[0]; if(u>=N-1) return bars[N-1]; const i=Math.floor(u), fr=u-i; return bars[i]*(1-fr)+bars[i+1]*fr;
    };
    const v=new Float64Array(K+1), x=new Float64Array(K+1), J=new Float64Array(K+1);
    v[0]=p.v0;
    for(let j=0;j<K;j++){ const f=Fat((j+0.5)*hh); v[j+1]=v[j]+f/p.m*hh; x[j+1]=x[j]+0.5*(v[j]+v[j+1])*hh; J[j+1]=J[j]+f*hh; }
    let mn=0,mx=0,vm=0.5; for(let j=0;j<=K;j++){ mn=Math.min(mn,x[j]); mx=Math.max(mx,x[j]); vm=Math.max(vm,Math.abs(v[j])); }
    this.run={K,hh,v,x,J,Fat,mn,mx,vm};
  },
  at(arr,tau){ const r=this.run, f=clamp(tau/r.hh,0,r.K), i=Math.min(Math.floor(f),r.K-1), fr=f-i; return arr[i]*(1-fr)+arr[i+1]*fr; },
  reset(){ this.clk=0; this.playing=true; markDirty(); },
  toggle(){ if(this.clk>=this.p.T-1e-9) this.reset(); else this.playing=!this.playing; markDirty(); },
  stepOnce(){ this.playing=false; this.clk=Math.min(this.p.T,this.clk+this.p.T/60); markDirty(); },
  tick(dt){ this.clk+=dt; if(this.clk>=this.p.T){ this.clk=this.p.T; this.playing=false; } },
  newChallenge(){
    const p=this.p, pick=a=>a[Math.floor(Math.random()*a.length)];
    const m=pick([1,2,3]), v0=pick([0,1,-1,2]), d=pick([2,3,4,5])*pick([-1,1]), Lm=8;
    p.m=m; p.v0=v0; p.T=4; p.Fa=10; AREA.view='rect'; areaChanged();
    this.sl.m.set(m); this.sl.v0.set(v0); this.sl.T.set(4); this.sgFa.set(10);
    this.ch={m,v0,target:v0+d,L:Lm,tol:0.15}; this.bars=this.bars.map(()=>0); this.bEnd.hidden=false; this.renderCh(); this.edited();
  },
  renderCh(){
    if(!this.ch){ this.chText.setAttribute('data-i18n','ch_idle'); this.chText.textContent=T('ch_idle'); return; }
    this.chText.removeAttribute('data-i18n'); const c=this.ch;
    this.chText.textContent=T('ch_text',num(c.m),num(c.v0),num(c.target),num(c.L),num(c.tol));
  },
  relabel(){ if(this.ch) this.renderCh(); },
  drawMain(){
    const f=fit(cv), ctx=f.ctx, W=f.w, H=f.h, c=C(), p=this.p, r=this.run, L=this.L, tau=this.clk, N=p.N, D=p.T/N, bars=this.bars;
    ctx.clearRect(0,0,W,H); ctx.fillStyle=c.surface; ctx.fillRect(0,0,W,H);
    const Ht=Math.round(H*(W<H?0.5:0.56)); this.Ht=Ht;
    // --- area di disegno F(t)
    const P=this.PF; P.attach(ctx,W,H,{x:0,y:0,w:W,h:Ht}); P.range(0,p.T,-p.Fa,p.Fa);
    P.grid({xl:'t (s)',yl:'F (N)'});
    P.clipOn();
    ctx.strokeStyle=c.gridline; ctx.lineWidth=1; ctx.setLineDash([2,3]); ctx.beginPath();
    for(let i=1;i<N;i++){ const x=Math.round(P.X(i*D))+.5; ctx.moveTo(x,P.y1); ctx.lineTo(x,P.y0); } ctx.stroke(); ctx.setLineDash([]);
    const view=this.view();
    if(L.mean){ let fm=r.J[r.K]/p.T; if(Math.abs(fm)<1e-9) fm=0; ctx.save(); ctx.strokeStyle=c.accent; ctx.lineWidth=2.5; ctx.setLineDash([7,4]); ctx.strokeRect(P.X(0),P.Y(fm),P.X(p.T)-P.X(0),P.Y(0)-P.Y(fm)); ctx.restore(); label(ctx,'F̄ = '+num(fm,3)+' N',P.x1-6,P.Y(fm)-5,c.accent,'right',10.5); }
    if(view==='rect'){
      for(let i=0;i<N;i++){
        const xa=P.X(i*D), xb=P.X((i+1)*D), y0=P.Y(0), y1=P.Y(bars[i]), done=L.area&&(i+1)*D<=tau+1e-9;
        ctx.globalAlpha=done?0.5:0.2; ctx.fillStyle=done?c.imp:c.force; ctx.fillRect(xa,Math.min(y0,y1),xb-xa,Math.abs(y1-y0));
        ctx.globalAlpha=1; ctx.strokeStyle=c.ink; ctx.lineWidth=2; ctx.strokeRect(xa+.5,Math.min(y0,y1)+.5,xb-xa-1,Math.max(0,Math.abs(y1-y0)-1));
      }
    } else {
      const poly=upTo=>{ ctx.beginPath(); ctx.moveTo(P.X(0),P.Y(0)); const n=400; for(let j=0;j<=n;j++){ const t=j/n*p.T; if(t>upTo) break; ctx.lineTo(P.X(t),P.Y(r.Fat(Math.min(t,p.T-1e-9)))); }
        ctx.lineTo(P.X(upTo),P.Y(r.Fat(Math.min(upTo,p.T-1e-9)))); ctx.lineTo(P.X(upTo),P.Y(0)); ctx.closePath(); ctx.fill(); };
      ctx.globalAlpha=.2; ctx.fillStyle=c.force; poly(p.T); if(L.area){ ctx.globalAlpha=.5; ctx.fillStyle=c.imp; poly(Math.max(0,tau)); } ctx.globalAlpha=1;
      ctx.strokeStyle=c.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(P.X(0),P.Y(bars[0])); bars.forEach((b,i)=>ctx.lineTo(P.X((i+0.5)*D),P.Y(b))); ctx.lineTo(P.X(p.T),P.Y(bars[N-1])); ctx.stroke();
    }
    const colW=(P.x1-P.x0)/N;
    for(let i=0;i<N;i++){
      const x=P.X((i+0.5)*D), y=P.Y(bars[i]);
      ctx.fillStyle=c.force; ctx.strokeStyle=c.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,4,0,7); ctx.fill(); ctx.stroke();
      if(L.values&&colW>=34) label(ctx,num(bars[i],2),x,bars[i]>=0?y-8:y+16,c.muted,'center',10);
    }
    if(tau>0&&tau<p.T){ ctx.strokeStyle=c.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(P.X(tau),P.y1); ctx.lineTo(P.X(tau),P.y0); ctx.stroke(); }
    P.clipOff();
    if(bars.every(b=>b===0)) label(ctx,T('draw_hint'),(P.x0+P.x1)/2,(P.y0+P.y1)/2-14,c.muted,'center',12);
    // --- scena del carrello
    ctx.fillStyle=c.ink; ctx.fillRect(0,Ht,W,3);
    const gy=Ht+(H-Ht)*0.6, pad=48, span=Math.max(r.mx-r.mn,1), mapX=m=>pad+(m-r.mn)/span*(W-2*pad);
    ctx.save(); ctx.strokeStyle=c.ground; ctx.lineWidth=1.5; ctx.beginPath(); for(let x=-40;x<W;x+=12){ ctx.moveTo(x,gy+22); ctx.lineTo(x+10,gy+2); } ctx.stroke(); ctx.restore();
    ctx.fillStyle=c.ink; ctx.fillRect(0,gy-1.5,W,3);
    ctx.lineWidth=1.5; ctx.strokeStyle=c.ink;
    for(const t of niceTicks(r.mn,r.mx,Math.max(3,Math.floor(W/90)))){ const x=mapX(t); ctx.beginPath(); ctx.moveTo(x,gy+2); ctx.lineTo(x,gy+9); ctx.stroke(); label(ctx,num(t,3)+' m',x,gy+23,c.muted,'center',10.5); }
    if(L.strobe) for(let k=0;k<=16;k++){ const tk=k*p.T/16; if(tk<=tau+1e-9){ ctx.fillStyle=c.mom; ctx.strokeStyle=c.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(mapX(this.at(r.x,tk)),gy+36,3.4,0,7); ctx.fill(); ctx.stroke(); } }
    const xc=mapX(this.at(r.x,tau)), vNow=this.at(r.v,tau), Fnow=r.Fat(Math.min(tau,p.T-1e-9)), cw=84, chh=34, ym=gy-chh/2-12, sg=Fnow>0?1:-1, act=Math.abs(Fnow)>1e-9, mag=Math.min(1,Math.abs(Fnow)/p.Fa);
    // gas espulso dal propulsore attivo (opposto alla forza sul carrello)
    if(act&&L.pair){
      const xn=xc-sg*(cw/2+9), n=7, ph=(tau*2.5)%1, len=22+58*mag;
      for(let k=0;k<n;k++){ const f=(k+ph)/n, x=xn-sg*f*len, r0=3+f*9*(0.5+mag), al=0.55*(1-f);
        ctx.fillStyle=c.mom; ctx.globalAlpha=al; ctx.beginPath(); ctx.arc(x,ym+Math.sin(k*2.3)*f*7,r0,0,7); ctx.fill(); }
      ctx.globalAlpha=1;
    }
    // carrello con due propulsori alle estremita'
    ctx.fillStyle=c.accent; ctx.strokeStyle=c.ink; ctx.lineWidth=2.5; ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(xc-cw/2,gy-chh-12,cw,chh,5); else ctx.rect(xc-cw/2,gy-chh-12,cw,chh);
    ctx.fill(); ctx.stroke(); ctx.fillStyle=c.ink; for(const dx of [-19,19]){ ctx.beginPath(); ctx.arc(xc+dx,gy-7,7,0,7); ctx.fill(); }
    for(const side of [-1,1]){
      const on=act&&side===-sg, xb=xc+side*cw/2;
      ctx.fillStyle=on?c.force:c.pad; ctx.strokeStyle=c.ink; ctx.lineWidth=2.2; ctx.beginPath();
      ctx.moveTo(xb,ym-6); ctx.lineTo(xb+side*9,ym-10); ctx.lineTo(xb+side*9,ym+10); ctx.lineTo(xb,ym+6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if((L.force||L.pair)&&act){
      // forza sul carrello e reazione sul gas, entrambe dall'ugello attivo, su due file separate
      const Lf=Math.max(18,Math.min(80,Math.abs(Fnow)/p.Fa*70)), xk=xc-sg*(cw/2), yo=7, fl=L.values?'F '+num(Math.abs(Fnow),3)+' N':'F';
      if(L.force) arrow(ctx,xk,ym-yo-8,sg*Lf,0,c.force,{w:4,halo:true,label:fl,badge:L.pair?'1':null});
      if(L.pair){ const xg=xc-sg*(cw/2+9+0.28*(22+58*mag)); arrow(ctx,xg,ym,-sg*Lf,0,c.force,{w:4,halo:true,hollow:true,label:fl,badge:'1'}); ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(xg,ym,3,0,7); ctx.fill(); }
      ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(xk,ym-yo-8,3,0,7); ctx.fill();
    }
    if(L.vel){ const ay=gy-chh-56, ln=vNow/r.vm*70, ax=clamp(xc,12+Math.max(0,-ln),W-14-Math.max(0,ln)); arrow(ctx,ax,ay,ln,0,c.vel,{w:4}); label(ctx,L.values?'v '+num(vNow,3)+' m/s':'v',ax+ln/2,ay-9,c.vel,'center',10.5); }
    label(ctx,'t = '+num(tau,3)+' s',10,Ht+18,c.muted,'left',11);
  },
  drawGraphs(){
    const P=this.PP, p=this.p, r=this.run, c=C(), tau=this.clk; P.begin();
    let lo=Math.min(0,p.m*p.v0), hi=Math.max(0,p.m*p.v0);
    for(let j=0;j<=r.K;j+=8){ lo=Math.min(lo,p.m*r.v[j]); hi=Math.max(hi,p.m*r.v[j]); }
    lo=Math.min(lo,p.m*r.v[r.K]); hi=Math.max(hi,p.m*r.v[r.K]);
    if(this.ch){ lo=Math.min(lo,p.m*this.ch.target); hi=Math.max(hi,p.m*this.ch.target); }
    const sp=Math.max(hi-lo,1)*0.12; P.range(0,p.T,lo-sp,hi+sp); P.grid({xl:'t (s)',yl:'p (kg·m/s)'});
    P.clipOn();
    if(this.ch) P.hline(p.m*this.ch.target,c.accent,[6,4],T('target'),'right');
    const xs=[],ys=[],n=240; for(let j=0;j<=n;j++){ const t=j/n*p.T; if(t>tau) break; xs.push(t); ys.push(p.m*this.at(r.v,t)); }
    if(tau>0){ xs.push(tau); ys.push(p.m*this.at(r.v,tau)); } else { xs.push(0); ys.push(p.m*p.v0); }
    P.line(xs,ys,c.mom,3); if(tau<p.T) P.dot(tau,p.m*this.at(r.v,tau),c.mom,5);
    P.clipOff();
    // barre p iniziale + J = p
    const pi=p.m*p.v0, Jf=r.J[r.K], pf=pi+Jf; let blo=Math.min(0,pi,pf), bhi=Math.max(0,pi,pf); const bs=Math.max(bhi-blo,1)*0.2; blo-=bs; bhi+=bs;
    drawBarsGen(g2,{bars:[{a:0,b:pi,col:c.mom,name:T('b_pi')},{a:pi,b:pi+this.at(r.J,tau),col:c.imp,name:T('b_J'),plus:true},{a:0,b:p.m*this.at(r.v,tau),col:c.mom,alpha:.6,name:tau>=p.T-1e-9?T('b_pf'):T('b_pn')}],lo:blo,hi:bhi,unit:'kg·m/s',lines:[{y:pi,col:c.muted}]});
  },
  drawInset:null,
  updateText(){
    const p=this.p, r=this.run, R=this.cells, tau=this.clk, done=tau>=p.T-1e-9;
    R.t.textContent=num(tau,3)+' s'; R.F.textContent=num(r.Fat(Math.min(tau,p.T-1e-9)),3)+' N';
    R.J_dt.textContent=T(this.view()==='int'?'r_Jint':'r_Jrect'); R.J.textContent=num(this.at(r.J,tau),3)+' N·s';
    R.p.textContent=num(p.m*this.at(r.v,tau),3)+' kg·m/s'; R.v.textContent=num(this.at(r.v,tau),3)+' m/s'; R.x.textContent=num(this.at(r.x,tau),3)+' m';
    R.Fmax.textContent=num(Math.max(...this.bars.map(Math.abs)),3)+' N';
    let html='';
    if(this.ch&&done){
      const c=this.ch, vf=r.v[r.K], maxF=Math.max(...this.bars.map(Math.abs));
      if(maxF>c.L+1e-9) html='<span class="chip bad">'+T('ch_over',num(maxF,3))+'</span>';
      else if(Math.abs(vf-c.target)<=c.tol) html='<span class="chip ok">'+T('ch_ok',num(vf,3))+'</span>';
      else html='<span class="chip bad">'+T('ch_no',num(vf,3))+'</span>';
    }
    const ch=$('#gchips'); if(ch.dataset.h!==html){ ch.innerHTML=html; ch.dataset.h=html; }
  },
  check(){
    const v=parseNum(this.inp.value), vf=this.run.v[this.run.K];
    this.predOut.textContent=isNaN(v)?T('pred_nan'):T('pred_res',num(v,3),num(vf,3),num(100*Math.abs(v-vf)/Math.max(Math.abs(vf),1e-9),2),'m/s');
  },
  csvText(){
    const p=this.p,r=this.run; let out='t_s\tF_N\tv_mps\tx_m\n'; const n=Math.min(200,r.K);
    for(let i=0;i<=n;i++){ const t=i/n*p.T; out+=[t,r.Fat(Math.min(t,p.T-1e-9)),this.at(r.v,t),this.at(r.x,t)].map(csvNum).join('\t')+'\n'; }
    return out;
  }
};
modes.draw=M2;
