// Impulse Lab · 05-scene-ballistic.js
// Scene 4: ballistic pendulum.
// Classic script: shares one global scope with the other js/0*.js files, loaded in order after js/boot.js.
'use strict';

/* ================= scena 4: pendolo balistico ================= */
const SWT=24, SWD=0.004;
const M4={
  id:'ball', playing:false, clk:0, twoGraphs:true, pen:false, hintKey:null,
  p:{m:10,M:2,L:1.2,v0:350,k:5e5,e:0,g:9.81,mode:'known',g2:'p'},
  hid:300, revealed:false,
  presets:{rifle:{m:10,M:2,L:1.2,v0:350,e:0},pellet:{m:0.8,M:0.1,L:0.8,v0:150,e:0},clay:{m:50,M:0.5,L:1,v0:12,e:0},loop:{m:20,M:0.3,L:0.5,v0:120,e:0},rubber:{m:30,M:1,L:1,v0:60,e:0.8}},
  timing(){ return {A:1.0,D:S.rt&&this.sim?this.sim.T:3.0}; },
  total(){ const t=this.timing(); return t.A+t.D+SWT; },
  done(){ return this.clk>=this.total()-1e-9; },
  hidden(){ return this.p.mode==='myst'&&!this.revealed; },
  v0(){ return this.p.mode==='myst'?this.hid:this.p.v0; },
  emb(){ return this.p.e<0.005; },
  v0FromV(V){ const p=this.p, m=p.m/1000, M=p.M, mu=m*M/(m+M); return M*V/(mu*(1+(this.emb()?0:p.e))); },
  init(){
    const self=this, p=this.p;
    this.su=hostFor('#setupHost','ball'); this.sh=hostFor('#showHost','ball'); this.qk=hostFor('#quick','ball'); this.qk.className='quickset'; this.tb=hostFor('#tables','ball');
    this.PF=new Plot(g1,{l:58}); this.PP=new Plot(g2,{l:58});
    layers(this,[
      {k:'vel',col:'vel',quick:true},{k:'force',col:'force',quick:true},{k:'area',col:'imp',kind:'dot',quick:true},
      {k:'mean',col:'accent',kind:'dot',quick:true,sub:true},{k:'hmax',col:'imp',quick:true},{k:'arc',col:'mom',on:true},{k:'ghost',kind:'dot',on:false}
    ]);
    readoutFor(this,[['t','t'],['F','F'],['v','v'],['th','θ']]);
    group(this.su,'g_scen');
    this.sgPre=seg(this.su,[{v:'rifle',key:'pr_b_rifle'},{v:'pellet',key:'pr_b_pellet'},{v:'clay',key:'pr_b_clay'},{v:'loop',key:'pr_b_loop'},{v:'rubber',key:'pr_b_rubber'}],'rifle',v=>self.preset(v),'wrap');
    group(this.su,'g_par');
    this.sl={
      m:slider(this.su,{id:'b-m',key:'b_m',min:0.2,max:200,log:true,val:p.m,fmt:v=>num(v)+' g',onInput:v=>{p.m=v;self.changed();}}),
      M:slider(this.su,{id:'b-M',key:'b_M',min:0.05,max:20,log:true,val:p.M,fmt:v=>num(v)+' kg',onInput:v=>{p.M=v;self.changed();}}),
      L:slider(this.su,{id:'b-L',key:'b_L',min:0.3,max:3,step:0.05,val:p.L,fmt:v=>num(v)+' m',onInput:v=>{p.L=v;self.changed();}}),
      v0:slider(this.su,{id:'b-v',key:'b_v',min:5,max:1000,log:true,val:p.v0,fmt:v=>num(v)+' m/s',onInput:v=>{p.v0=v;self.changed();}}),
      e:slider(this.su,{id:'b-e',key:'b_e',min:0,max:1,step:0.01,val:p.e,fmt:v=>v<0.005?T('b_embed'):num(v,2),onInput:v=>{p.e=v;self.changed();}}),
      k:slider(this.su,{id:'b-k',key:'b_k',min:1e4,max:1e8,log:true,val:p.k,fmt:v=>si(v,'N/m'),onInput:v=>{p.k=v;self.changed();}})
    };
    const gb=h('div',{class:'ctl'}); gb.append(h('label',{},h('span',{'data-i18n':'b_g'})));
    this.sgG=seg(gb,[{v:9.81,key:'gr_earth'},{v:3.71,key:'gr_mars'},{v:1.62,key:'gr_moon'},{v:24.8,key:'gr_jup'}],p.g,v=>{p.g=v;self.changed();},'wrap'); this.su.append(gb);
    note(this.su,'b_rod');
    this.areaUI=areaGroup(this.su);
    group(this.su,'g_bmode');
    this.sgMode=seg(this.su,[{v:'known',key:'bm_known'},{v:'myst',key:'bm_myst'}],p.mode,v=>self.setModeB(v));
    this.mBox=h('div'); this.su.append(this.mBox);
    note(this.mBox,'myst_note');
    const row=h('div',{class:'row'});
    this.inp=h('input',{id:'b-est',type:'text',inputmode:'decimal',autocomplete:'off'});
    row.append(h('label',{class:'num',for:'b-est'},h('span',{'data-i18n':'b_est'}),this.inp));
    this.chk=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'check'})); row.append(this.chk);
    this.nw=h('button',{class:'btn',type:'button'},h('span',{'data-i18n':'b_new'})); row.append(this.nw);
    this.mBox.append(row); this.mOut=note(this.mBox,'','pm'); this.mOut.removeAttribute('data-i18n');
    this.chk.addEventListener('click',()=>self.check()); this.inp.addEventListener('keydown',e=>{ if(e.key==='Enter') self.check(); });
    this.nw.addEventListener('click',()=>self.newMyst());
    group(this.su,'g_g2');
    this.sgG2=seg(this.su,[{v:'p',key:'b_g2p'},{v:'e',key:'b_g2e'}],p.g2,v=>{p.g2=v;markDirty();});
    tableFor(this,[
      {k:'T',key:'r_T',cls:'k-imp'},{k:'Fmax',key:'r_Fmax',cls:'k-force'},{k:'Fm',key:'r_Fm'},'sep',
      {k:'J',key:'r_Jrect',dyn:true,cls:'k-imp'},{k:'dp',key:'r4_dp',cls:'k-mom'},{k:'diff',key:'r_diff'},'sep',
      {k:'V',key:'r4_V',cls:'k-vel'},{k:'th',key:'r4_th'},{k:'h',key:'r4_h',cls:'k-imp'},'sep',
      {k:'v0e',key:'r4_v0e',cls:'k-mom'},{k:'v0',key:'r4_v0'},{k:'loss',key:'r4_loss',cls:'k-q'}
    ]);
    this.newMyst(true); this.setModeB('known',true);
    this.preset('rifle',true);
  },
  enter(){ this.areaUI.sync(); this.buildRects(); },
  setModeB(v,quiet){
    const p=this.p; p.mode=v; this.sgMode.set(v); this.mBox.hidden=v!=='myst'; this.sl.v0.el.hidden=v==='myst';
    this.revealed=false; this.mOut.textContent=''; this.inp.value=''; if(!quiet) this.recalc(true);
  },
  newMyst(quiet){
    const p=this.p, hh=p.L*(0.08+Math.random()*1.1);
    this.hid=Math.round(this.v0FromV(Math.sqrt(2*p.g*hh)));
    this.revealed=false; this.mOut.textContent=''; this.inp.value=''; if(!quiet) this.recalc(true);
  },
  preset(id,auto){
    const q=this.presets[id], p=this.p; Object.assign(p,q);
    for(const k of['m','M','L','v0','e']) this.sl[k].set(p[k]); this.sgPre.set(id);
    if(p.mode==='myst') this.newMyst(true);
    this.recalc(auto!==false);
  },
  changed(){ this.sgPre.set(''); this.recalc(true); },
  recalc(auto){
    const p=this.p, m=p.m/1000, M=p.M, v0=this.v0(), mu=m*M/(m+M), g=p.g, Lr=p.L;
    const ee=this.emb()?0:p.e, s=this.sim=simulateContact(mu,v0,p.k,ee,'lin'); s.mu=mu;
    this.V=mu*v0*(1+ee)/M; this.Ms=ee===0?m+M:M; this.vbf=v0-mu*v0*(1+ee)/m; const x=this.V*this.V/(2*g*Lr);
    this.loops=x>=2; this.hmax=Math.min(this.V*this.V/(2*g),2*Lr); this.tall=this.hmax>0.95*Lr;
    const G=300; this.gt=new Float64Array(G); this.gF=new Float64Array(G); this.gJ=new Float64Array(G);
    for(let i=0;i<G;i++){ const t=i/(G-1)*s.T; this.gt[i]=t; this.gF[i]=s.F(t); this.gJ[i]=mu*(v0-s.v(t)); }
    const n=Math.round(SWT/SWD); this.th=new Float32Array(n+1); this.om=new Float32Array(n+1); this.hr=new Float32Array(n+1);
    let a=0,w=this.V/Lr; this.th[0]=0; this.om[0]=w; this.hr[0]=0; const f=q=>-g/Lr*Math.sin(q), d=SWD;
    for(let i=1;i<=n;i++){
      const k1a=w,k1w=f(a), k2a=w+.5*d*k1w,k2w=f(a+.5*d*k1a), k3a=w+.5*d*k2w,k3w=f(a+.5*d*k2a), k4a=w+d*k3w,k4w=f(a+d*k3a);
      a+=d/6*(k1a+2*k2a+2*k3a+k4a); w+=d/6*(k1w+2*k2w+2*k3w+k4w);
      this.th[i]=a; this.om[i]=w; this.hr[i]=Math.max(this.hr[i-1],Lr*(1-Math.cos(a)));
    }
    this.buildRects(); this.clk=auto?0:this.total(); this.playing=!!auto; markDirty();
  },
  buildRects(){ if(this.sim) this.rects=buildRects(t=>this.sim.F(t),this.sim.T); },
  areaChanged(){ this.buildRects(); },
  reset(){ AREA.phi=Math.random(); this.buildRects(); this.clk=0; this.playing=true; markDirty(); },
  toggle(){ if(this.done()){ this.reset(); } else this.playing=!this.playing; markDirty(); },
  stepOnce(){ this.playing=false; const t=this.timing(); this.clk=Math.min(this.total(),this.clk+(this.clk<t.A+t.D?0.1:0.25)); markDirty(); },
  tick(dt){ this.clk+=dt; if(this.clk>=this.total()){ this.clk=this.total(); this.playing=false; } },
  state(){
    const t=this.timing(), s=this.sim; let phase,tau,ts=0;
    if(this.clk<t.A){ phase=0; tau=0; } else if(this.clk<t.A+t.D){ phase=1; tau=(this.clk-t.A)/t.D*s.T; } else { phase=2; tau=s.T; ts=Math.min(SWT,this.clk-t.A-t.D); }
    return {phase,tau,ts,t};
  },
  sw(ts){ const f=ts/SWD, n=this.th.length-1, i=Math.min(Math.floor(f),n-1), r=f-i; return {th:this.th[i]*(1-r)+this.th[i+1]*r, om:this.om[i]*(1-r)+this.om[i+1]*r, hr:this.hr[i]}; },
  Jc(tau){ const s=this.sim; return s.mu*(s.v0-s.v(tau)); },
  Jlive(tau){ return AREA.view==='int'?this.sim.Jc(tau):rectSumUpTo(this.rects,tau); },
  block(ctx,bx,by,th,bw,bh,al,d,bl,br,c){
    ctx.save(); ctx.translate(bx,by); ctx.rotate(-th); ctx.globalAlpha=al;
    ctx.fillStyle=c.obj; ctx.strokeStyle=c.ink; ctx.lineWidth=2.5; ctx.fillRect(-bw/2,-bh/2,bw,bh); ctx.strokeRect(-bw/2,-bh/2,bw,bh);
    if(d!=null){ ctx.fillStyle=c.tile2; ctx.lineWidth=2; const x1=-bw/2+d; ctx.beginPath(); ctx.moveTo(x1,0); ctx.lineTo(x1-br*1.6,-br); ctx.lineTo(x1-bl,-br); ctx.lineTo(x1-bl,br); ctx.lineTo(x1-br*1.6,br); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  },
  drawMain(){
    const st=this.state(), s=this.sim, p=this.p, f=fit(cv), ctx=f.ctx, W=f.w, H=f.h, c=C(), L=this.L, t=st.t;
    const u=clamp(Math.min(W/560,H/380),0.62,1.5), m=p.m/1000, M=p.M, hid=this.hidden();
    const bw=clamp(26+Math.cbrt(M)*14,28,66)*u, bh=bw*0.9;
    ctx.clearRect(0,0,W,H); ctx.fillStyle=c.surface; ctx.fillRect(0,0,W,H);
    const Hu=H-58, py=this.tall?Hu*0.5+8:26*u;
    const xl=(this.ro?this.ro.offsetWidth:150)+22, xr=W-(insetOn()?eb.clientWidth+22:12);
    const px=xr-xl>60?clamp(W/2,xl+30,xr-30):W/2;
    const Ldm=this.tall?Math.min(px-20,W-px-20,Hu*0.42):Math.min(W/2-34*u,Hu-py-bh/2-8);
    const Ld=Math.max(40,Ldm*clamp(0.75+0.25*(p.L-0.3)/2.7,0.75,1)), ppm=Ld/p.L, y0=py+Ld;
    // soffitto / perno
    if(!this.tall){ ctx.fillStyle=c.ink; ctx.fillRect(px-70*u,py-14*u,140*u,8*u); }
    // riferimento h = 0
    ctx.save(); ctx.strokeStyle=c.muted; ctx.lineWidth=1.2; ctx.setLineDash([3,5]); ctx.beginPath(); ctx.moveTo(10,y0); ctx.lineTo(W-10,y0); ctx.stroke(); ctx.restore();
    let th=0, om=0, hrun=0;
    if(st.phase===2){ const q=this.sw(st.ts); th=q.th; om=q.om; hrun=q.hr; }
    const bx=px+Ld*Math.sin(th), by=py+Ld*Math.cos(th);
    // fantasma al massimo
    if(L.ghost&&st.phase===2&&!this.loops){ const tm=Math.acos(1-this.hmax/p.L); this.block(ctx,px+Ld*Math.sin(tm),py+Ld*Math.cos(tm),tm,bw,bh,0.28,null,0,0,c); }
    // arco dell'angolo
    if(L.arc&&st.phase===2&&Math.abs(th)>0.02){
      const r=Math.min(Ld*0.3,60*u), a=Math.min(Math.abs(th),2*Math.PI);
      const sgn=th>=0?1:-1;
      ctx.save(); ctx.strokeStyle=c.mom; ctx.lineWidth=2.5; ctx.beginPath(); if(sgn>0) ctx.arc(px,py,r,Math.PI/2-a,Math.PI/2,false); else ctx.arc(px,py,r,Math.PI/2,Math.PI/2+a,false); ctx.stroke(); ctx.restore();
      const lx=px+sgn*(r+8)*Math.sin(Math.max(a/2,0.25)); let ly=py+(r+8)*Math.cos(Math.max(a/2,0.25))+6;
      if(insetOn()&&lx>W-eb.clientWidth-90) ly=Math.max(ly,eb.offsetTop+eb.offsetHeight+16);
      label(ctx,'θ = '+num(th*180/Math.PI,3)+'°',lx,ly,c.mom,sgn>0?'left':'right',11);
    }
    // asta e perno
    ctx.strokeStyle=c.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(bx,by); ctx.stroke();
    ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(px,py,5*u+1,0,7); ctx.fill();
    // proiettile
    const bl=clamp(14*u,10,24), br=clamp(4.2*u,3,7), face=px-bw/2, xs=24*u;
    let depth=null;
    if(st.phase===0){
      const xb=xs+(face-xs-8)*(this.clk/t.A); this.block(ctx,bx,by,0,bw,bh,1,null,0,0,c);
      ctx.save(); ctx.fillStyle=c.tile2; ctx.strokeStyle=c.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(xb,by); ctx.lineTo(xb-br*1.6,by-br); ctx.lineTo(xb-bl,by-br); ctx.lineTo(xb-bl,by+br); ctx.lineTo(xb-br*1.6,by+br); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      if(L.vel) arrow(ctx,xb-bl,by-br-14*u,54*u,0,c.vel,{w:3,label:hid?'v₀ = ?':'v₀ = '+num(p.mode==='myst'?this.hid:p.v0,3)+' m/s'});
      label(ctx,'m',xb-bl/2,by+br+14,c.muted,'center',10.5);
    } else {
      const bd=bw*0.38, emb=this.emb(); depth=st.phase===1?bd*s.x(st.tau)/s.xmax:bd;
      this.block(ctx,bx,by,th,bw,bh,1,(emb||st.phase===1)?depth:null,bl,br,c);
      if(!emb&&st.phase===2){
        const off=clamp(this.vbf/s.v0,-1,1)*Math.min(150*u,W/3)*(1-Math.exp(-st.ts*2.2)), xb=face-6*u+off;
        ctx.save(); ctx.globalAlpha=Math.max(0.25,1-st.ts/4); ctx.fillStyle=c.tile2; ctx.strokeStyle=c.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(xb,y0); ctx.lineTo(xb-br*1.6,y0-br); ctx.lineTo(xb-bl,y0-br); ctx.lineTo(xb-bl,y0+br); ctx.lineTo(xb-br*1.6,y0+br); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if(st.phase===1){
        const Fr=s.F(st.tau)/s.Fpk, vb=s.v0-this.Jc(st.tau)/m, vB=this.Jc(st.tau)/M;
        if(L.force&&Fr>0.02){
          const len=Math.max(10,58*u*Fr);
          const xc=face+depth, ya=by+bh/2+24*u, fl=L.values?'F '+si(s.F(st.tau),'N',3):'F';
          ctx.save(); ctx.strokeStyle=c.muted; ctx.lineWidth=1.3; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(xc,by); ctx.lineTo(xc,ya); ctx.stroke(); ctx.restore();
          ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(xc,by,3,0,7); ctx.fill();
          arrow(ctx,xc,ya,-len,0,c.force,{w:3.5,halo:true,label:fl,badge:'1'});
          arrow(ctx,xc,ya,len,0,c.force,{w:3.5,halo:true,hollow:true,label:fl,badge:'1'});
        }
        if(L.vel){
          arrow(ctx,face-bl-4,by-bh/2-16*u,Math.max(0,54*u*vb/s.v0),0,c.vel,{w:3,label:hid?'v = ?':'v = '+num(vb,3)});
          arrow(ctx,px,by-bh/2-34*u,Math.max(4,40*u*vB/this.V),0,c.vel,{w:3,label:hid?'V = ?':'V = '+num(vB,3)});
        }
        label(ctx,'t = '+si(st.tau,'s',3),12,H-10,c.muted,'left',11);
      } else {
        if(L.vel){
          const v=om*p.L, tx=Math.cos(th), ty=-Math.sin(th), sg=v>=0?1:-1, ln=clamp(40*u*Math.abs(v)/Math.max(this.V,1e-9),0,70*u);
          arrow(ctx,bx+Math.sin(th)*(bh/2+14*u),by+Math.cos(th)*(bh/2+14*u),sg*tx*ln,sg*ty*ln,c.vel,{w:3,label:hid?'v = ?':'v = '+num(Math.abs(v),3)});
        }
        label(ctx,'t = '+num(st.ts,2)+' s',12,H-10,c.muted,'left',11);
      }
    }
    // quota massima
    if(L.hmax&&st.phase===2){
      const yh=y0-hrun*ppm, xr=W-26*u;
      ctx.save(); ctx.strokeStyle=c.imp; ctx.lineWidth=1.6; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(10,yh); ctx.lineTo(W-10,yh); ctx.stroke(); ctx.restore();
      arrow(ctx,xr,y0,0,yh-y0,c.imp,{w:2.5});
      label(ctx,'h = '+num(hrun,3)+' m',xr-8,(y0+yh)/2,c.imp,'right',11);
    }
    // etichette di stato
    if(this.loops&&st.phase===2) label(ctx,T('loop_lab'),W/2,H-10,c.mom,'center',11);
    label(ctx,'g = '+num(p.g,3)+' m/s²',W-10,H-10,c.muted,'right',10.5);
    timeStrip(ctx,W,H,{A:t.A,D:t.D,B:6},Math.min(this.clk,t.A+t.D+6),st.phase,S.rt,t.D/s.T);
  },
  pr(){ const m=this.p.m/1000, v0=this.v0(); return {P0:m*v0,E0:0.5*m*v0*v0}; },
  drawInset(){
    const st=this.state(), s=this.sim, p=this.p, m=p.m/1000, M=p.M, hid=this.hidden(), Jl=this.Jc(st.tau), V=this.V, g=p.g;
    if(S.inset==='e'){
      const E0=this.pr().E0; let K,U,Q;
      let Kb=0; const bars=[];
      if(st.phase<2){ const en=s.En(st.tau); U=en.U; Q=en.Q; K=E0-U-Q; }
      else { const q=this.sw(st.ts), vv=q.om*p.L, Ms=this.Ms; K=0.5*Ms*vv*vv; U=Ms*g*p.L*(1-Math.cos(q.th)); Kb=this.emb()?0:0.5*m*this.vbf*this.vbf; Q=E0-0.5*Ms*V*V-Kb; }
      bars.push({a:0,b:K,col:C().vel,name:'K',hide:hid},{a:0,b:U,col:C().mom,name:'U',hide:hid});
      if(st.phase===2&&!this.emb()) bars.push({a:0,b:Kb,col:C().vel,alpha:.55,name:'Kb',hide:hid});
      bars.push({a:0,b:Q,col:C().q,name:'Q',hide:hid});
      drawBarsGen(eb,{bars,lo:0,hi:E0*1.12,unit:'J',cap:'ΣK+U+Q=E₀',lines:[{y:E0,col:C().ink}]});
    } else {
      const P0=this.pr().P0, pb=P0-Jl, pB=Jl;
      drawBarsGen(eb,{bars:[{a:0,b:pb,col:C().mom,name:T('b_bul'),hide:hid},{a:0,b:pB,col:C().imp,name:T('b_blk'),hide:hid},{a:0,b:pb+pB,col:C().mom,alpha:.6,name:T('b_tot'),hide:hid}],lo:-0.04*P0,hi:P0*1.15,unit:'kg·m/s',cap:'p₁+p₂=p',lines:[{y:P0,col:C().muted}]});
    }
  },
  drawGraphs(){
    const st=this.state(), s=this.sim, p=this.p, c=C(), L=this.L, tau=st.tau, hid=this.hidden(), m=p.m/1000, M=p.M;
    drawForcePlot(this.PF,{sim:s,tau,gt:this.gt,gF:this.gF,rects:this.rects,pins:[],limit:0,live:st.phase===1},L);
    const P=this.PP; P.begin();
    if(p.g2==='p'){
      const P0=this.pr().P0, k=hid?1/P0:1, ts=scaleTime(s.T*1.1);
      P.range(0,s.T*1.1,-0.05*P0*k,1.15*P0*k);
      P.grid({xdiv:ts.div,xl:'t ('+ts.pfx+'s)',yl:hid?'p / p_i':'p (kg·m/s)'});
      P.clipOn(); P.hline(P0*k,c.muted,[4,4]);
      const xs=[],y1=[],y2=[]; for(let i=0;i<this.gt.length&&this.gt[i]<=tau;i++){ xs.push(this.gt[i]); y1.push((P0-this.gJ[i])*k); y2.push(this.gJ[i]*k); }
      if(tau>0){ xs.push(tau); y1.push((P0-this.Jc(tau))*k); y2.push(this.Jc(tau)*k); }
      P.line(xs,y1,c.mom,3); P.line(xs,y2,c.imp,3);
      if(tau>0){ label(P.ctx,T('b_bul'),P.X(s.T*0.55),P.Y(P0*k*0.5)-8,c.mom,'left',10.5); label(P.ctx,T('b_blk'),P.X(s.T*0.55),P.Y(P0*k*0.5)+14,c.imp,'left',10.5); }
      P.clipOff();
    } else {
      const Ms=this.Ms, Ea=0.5*Ms*this.V*this.V, k=hid?1/Ea:1, Tsh=Math.min(SWT,Math.max(4,2.2*2*Math.PI*Math.sqrt(p.L/p.g)));
      P.range(0,Tsh,0,1.15*Ea*k);
      P.grid({xl:'t (s)',yl:hid?'E / E₁':'E (J)'});
      P.clipOn(); P.hline(Ea*k,c.muted,[4,4]);
      const xs=[],K=[],U=[]; const n=Math.min(Math.floor(st.ts/SWD),this.th.length-1), stp=Math.max(1,Math.floor(n/300));
      for(let i=0;i<=n;i+=stp){ const vv=this.om[i]*p.L; xs.push(i*SWD); K.push(0.5*Ms*vv*vv*k); U.push(Ms*p.g*p.L*(1-Math.cos(this.th[i]))*k); }
      if(st.phase===2){ P.line(xs,K,c.vel,3); P.line(xs,U,c.mom,3); const q=this.sw(st.ts); P.dot(st.ts,0.5*Ms*q.om*q.om*p.L*p.L*k,c.vel,4.5); P.dot(st.ts,Ms*p.g*p.L*(1-Math.cos(q.th))*k,c.mom,4.5); }
      label(P.ctx,'K',P.x0+8,P.y1+12,c.vel,'left',11); label(P.ctx,'U',P.x0+28,P.y1+12,c.mom,'left',11);
      P.clipOff();
    }
  },
  updateText(){
    const st=this.state(), s=this.sim, p=this.p, R=this.cells, tau=st.tau, Jl=this.Jlive(tau), done=tau>=s.T, hid=this.hidden(), m=p.m/1000, M=p.M, V=this.V;
    const q=st.phase===2?this.sw(st.ts):{th:0,om:0,hr:0};
    const F=st.phase===1?s.F(tau):0, vv=st.phase===0?this.v0():(st.phase===1?this.v0()-this.Jc(tau)/m:q.om*p.L);
    this.rv.t.textContent=st.phase===0?'—':(st.phase===1?si(tau,'s'):num(st.ts,3)+' s'); this.rv.F.textContent=si(F,'N');
    this.rv.v.textContent=hid?'?':num(vv,3)+' m/s'; this.rv.th.textContent=st.phase===2?num(q.th*180/Math.PI,3)+'°':'—';
    R.T.textContent=si(s.T,'s'); R.Fmax.textContent=si(s.Fpk,'N'); R.Fm.textContent=si(s.Jtot/s.T,'N');
    R.J_dt.textContent=T(AREA.view==='int'?'r_Jint':AREA.view==='log'?'r_Jlog':'r_Jrect');
    R.J.textContent=num(Jl,3)+' N·s'; R.dp.textContent=hid?'?':num(M*V,3)+' N·s';
    R.diff.textContent=(done&&!hid)?num(100*(Jl-M*V)/(M*V),2)+' %':'—';
    R.V.textContent=hid?'?':num(V,3)+' m/s';
    R.th.textContent=st.phase===2?(this.loops?'↻':num(Math.acos(clamp(1-q.hr/p.L,-1,1))*180/Math.PI,3)+'°'):'—';
    R.h.textContent=st.phase===2?num(q.hr,3)+' m':'—';
    R.v0e.textContent=st.phase===2&&q.hr>0?num(this.v0FromV(Math.sqrt(2*p.g*q.hr)),3)+' m/s':'—';
    R.v0.textContent=hid?'?':num(this.v0(),3)+' m/s'; R.loss.textContent=hid?'?':num(100*(1-(0.5*this.Ms*V*V+(this.emb()?0:0.5*m*this.vbf*this.vbf))/this.pr().E0),3)+' %';
    const dtv=AREA.view==='log'?1/AREA.rate:s.T/AREA.N; areaUIs.forEach(a=>{ if(a.nt) a.nt.textContent=AREA.view==='int'?'':T('dt_note',si(dtv,'s')); });
    let html='';
    if(AREA.view==='log'&&this.rects.length<3) html+='<span class="chip bad">'+T('log_miss')+'</span>';
    if(this.loops) html+='<span class="chip ok">'+T('loop_lab')+'</span>';
    const ch=$('#gchips'); if(ch.dataset.h!==html){ ch.innerHTML=html; ch.dataset.h=html; }
  },
  check(){
    const v=parseNum(this.inp.value);
    if(isNaN(v)){ this.mOut.textContent=T('pred_nan'); return; }
    const tv=this.hid; this.revealed=true;
    this.mOut.textContent=T('b_res',num(v,3),num(tv,3),num(100*Math.abs(v-tv)/tv,2)); markDirty();
  },
  csvText(){
    const s=this.sim,p=this.p,n=200,m=p.m/1000; let out='t_s\tF_N\tp_bullet\tp_block\n';
    for(let i=0;i<n;i++){ const t=i/(n-1)*s.T, J=s.mu*(s.v0-s.v(t)); out+=[t,s.F(t),m*s.v0-J,J].map(csvNum).join('\t')+'\n'; }
    return out;
  }
};
modes.ball=M4;
