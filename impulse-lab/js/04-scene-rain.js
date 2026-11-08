// Impulse Lab · 04-scene-rain.js
// Scene 3: a rain of impulses and the average force.
// Classic script: shares one global scope with the other js/0*.js files, loaded in order after js/boot.js.
'use strict';

/* ================= scena 3: pioggia d'impulsi ================= */
const HN=1500, DH=0.002;
const M3={
  id:'rain', playing:true, clk:0, twoGraphs:false, pen:false, hintKey:null,
  p:{m:10,h:1.5,R:20,e:0.3,d:40,avgw:0.5,rand:'rnd'},
  ts:0, acc:0, grains:[], q:[], pulses:[], hist:new Float32Array(HN), hi:0, hc:0, ymax:1,
  presets:{hail:{m:15,h:3,R:6,e:0.5,d:30},sand:{m:0.5,h:1,R:250,e:0,d:20},bouncy:{m:20,h:1.5,R:20,e:0.9,d:40},water:{m:2,h:2.5,R:120,e:0.1,d:25}},
  init(){
    const self=this, p=this.p;
    this.su=hostFor('#setupHost','rain'); this.sh=hostFor('#showHost','rain'); this.qk=hostFor('#quick','rain'); this.qk.className='quickset'; this.tb=hostFor('#tables','rain');
    this.PF=new Plot(g1,{l:58});
    layers(this,[{k:'pair',col:'force',quick:true,sub:true},{k:'th',col:'accent',quick:true},{k:'e0',col:'muted',kind:'dot',quick:true},{k:'ms',col:'imp',kind:'dot',quick:true},{k:'avg',col:'mom',quick:true}]);
    readoutFor(this,[['F','F'],['n','n']]);
    group(this.su,'g_scen');
    this.sgPre=seg(this.su,[{v:'hail',key:'pr_hail'},{v:'sand',key:'pr_sand'},{v:'bouncy',key:'pr_bouncy'},{v:'water',key:'pr_water'}],'',v=>self.preset(v),'wrap');
    group(this.su,'g_par');
    this.sl={
      m:slider(this.su,{id:'r-m',key:'g_m',min:0.1,max:200,log:true,val:p.m,fmt:v=>num(v)+' g',onInput:v=>{p.m=v;self.sgPre.set('');}}),
      h:slider(this.su,{id:'r-h',key:'g_h',min:0.2,max:5,step:0.1,val:p.h,fmt:v=>num(v)+' m',onInput:v=>{p.h=v;self.sgPre.set('');}}),
      R:slider(this.su,{id:'r-R',key:'g_R',min:1,max:300,log:true,val:p.R,fmt:v=>num(v)+' /s',onInput:v=>{p.R=v;self.sgPre.set('');}}),
      e:slider(this.su,{id:'r-e',key:'g_e',min:0,max:1,step:0.01,val:p.e,fmt:v=>num(v,2),onInput:v=>{p.e=v;self.sgPre.set('');}}),
      d:slider(this.su,{id:'r-d',key:'g_d',min:5,max:100,step:1,val:p.d,fmt:v=>num(v)+' ms',onInput:v=>{p.d=v;}}),
      a:slider(this.su,{id:'r-a',key:'g_avgw',min:0.05,max:2.5,log:true,val:p.avgw,fmt:v=>num(v)+' s',onInput:v=>{p.avgw=v;markDirty();}})
    };
    const ar=h('div',{class:'ctl'}); ar.append(h('label',{},h('span',{'data-i18n':'g_arr'}))); seg(ar,[{v:'reg',key:'reg'},{v:'rnd',key:'rnd'}],p.rand,v=>{p.rand=v;}); this.su.append(ar);
    note(this.su,'i3b');
    tableFor(this,[{k:'v',key:'r3_v',cls:'k-mom'},{k:'J1',key:'r3_J1',cls:'k-imp'},{k:'Fp',key:'r3_Fp',cls:'k-force'},'sep',{k:'th',key:'r3_th',cls:'k-imp'},{k:'ms',key:'r3_ms',cls:'k-force'},{k:'w',key:'r3_w'}]);
    this.reset(true);
  },
  enter(){},
  preset(id){ const q=this.presets[id], p=this.p; Object.assign(p,q); for(const k of['m','h','R','e','d']) this.sl[k].set(p[k]); this.sgPre.set(id); this.reset(true); },
  reset(silent){
    this.ts=0; this.acc=0; this.grains=[]; this.q=[]; this.pulses=[]; this.hist.fill(0); this.hi=0; this.hc=0; this.ymax=1; this.acc2=0;
    for(let i=0;i<2500;i++) this.step(); if(!silent) this.playing=true; markDirty();
  },
  toggle(){ this.playing=!this.playing; markDirty(); },
  stepOnce(){ this.playing=false; for(let i=0;i<25;i++) this.step(); this.prune(); markDirty(); },
  step(){
    const p=this.p, tf=Math.sqrt(2*p.h/GR), v=GR*tf, dh=DH;
    let n=0;
    if(p.rand==='rnd'){ const Lm=Math.exp(-p.R*dh); let k=0, pr=1; do{ k++; pr*=Math.random(); }while(pr>Lm&&k<50); n=k-1; }
    else { this.acc+=p.R*dh; while(this.acc>=1){ this.acc-=1; n++; } }
    for(let i=0;i<n;i++){ const g={t0:this.ts,tI:this.ts+tf,tf,v,h:p.h,e:p.e,x:Math.random()*2-1,vx:(Math.random()<0.5?-1:1)*(40+Math.random()*80),hit:false}; this.grains.push(g); this.q.push(g); }
    while(this.q.length&&this.q[0].tI<=this.ts+1e-12){ const g=this.q.shift(); g.hit=true; this.pulses.push({tI:g.tI,J:p.m/1000*g.v*(1+g.e)}); }
    const d=p.d/1000; let F=0;
    for(let i=this.pulses.length-1;i>=0;i--){ const u=(this.ts-this.pulses[i].tI)/d; if(u>1){ this.pulses.splice(i,1); continue; } F+=2*this.pulses[i].J/d*(1-Math.abs(2*u-1)); }
    this.hist[this.hi]=F; this.hi=(this.hi+1)%HN; this.hc=Math.min(this.hc+1,HN); this.ts+=dh;
  },
  prune(){ const ts=this.ts; this.grains=this.grains.filter(g=>!g.hit||(ts-g.tI)<=(g.e>0.005?2*g.e*g.v/GR:0.1)); },
  tick(dt){
    this.acc2=(this.acc2||0)+dt; let n=0;
    while(this.acc2>=DH&&n<300){ this.acc2-=DH; this.step(); n++; } if(n>=300) this.acc2=0;
    this.prune();
  },
  last(k){ let s=0; const n=Math.min(k,this.hc); for(let i=1;i<=n;i++) s+=this.hist[(this.hi-i+HN)%HN]; return n?s/n:0; },
  theory(){ const p=this.p, v=Math.sqrt(2*GR*p.h), J1=p.m/1000*v*(1+p.e); return {v,J1,Fth:p.R*J1,F0:p.R*p.m/1000*v}; },
  drawMain(){
    const f=fit(cv), ctx=f.ctx, W=f.w, H=f.h, c=C(), p=this.p, L=this.L;
    ctx.clearRect(0,0,W,H); ctx.fillStyle=c.surface; ctx.fillRect(0,0,W,H);
    const u=clamp(Math.min(W/560,H/380),0.65,1.4), cx=W/2, panY=H-92*u, panW=Math.min(170*u,W*0.5), top=36*u, fall=panY-top-6;
    // distributore
    ctx.fillStyle=c.accent; ctx.strokeStyle=c.ink; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(cx-44*u,8); ctx.lineTo(cx+44*u,8); ctx.lineTo(cx+9*u,top-4); ctx.lineTo(cx-9*u,top-4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // granelli
    const ts=this.ts, rg=Math.max(3,Math.min(8,2.5+Math.cbrt(p.m)*1.2))*u;
    for(const g of this.grains){
      let x=cx+g.x*Math.min(44*u,panW*0.32), y, al=1;
      if(ts<g.tI){ const fr=Math.pow((ts-g.t0)/g.tf,2); y=top+fall*fr; }
      else { const uu=ts-g.tI, ve=g.e*g.v, hr=ve*uu-0.5*GR*uu*uu; y=panY-rg-(hr/g.h)*fall; x+=g.vx*uu; if(g.e<0.005) al=Math.max(0,1-uu/0.1); }
      ctx.globalAlpha=al; ctx.fillStyle=c.tile2; ctx.strokeStyle=c.ink; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,rg,0,7); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha=1;
    // piatto e bilancia
    ctx.fillStyle=c.ink; ctx.fillRect(cx-panW/2,panY,panW,8*u);
    ctx.fillStyle=c.surface; ctx.strokeStyle=c.ink; ctx.lineWidth=2.5; const bh=H-panY-8*u-6; ctx.fillRect(cx-panW/2-10*u,panY+8*u,panW+20*u,bh); ctx.strokeRect(cx-panW/2-10*u,panY+8*u,panW+20*u,bh);
    const Fr=this.last(250);
    label(ctx,si(Fr,'N',3),cx,panY+8*u+bh*0.46,c.force,'center',Math.max(12,16*u));
    label(ctx,'≈ '+(Fr/GR<1?num(Fr/GR*1000)+' g':num(Fr/GR)+' kg'),cx,panY+8*u+bh*0.82,c.muted,'center',11);
    if(L.pair){
      const xk=cx-panW/2-8*u, x0=xk-22*u, ln=clamp(Fr/Math.max(this.theory().Fth,1e-9),0.35,1.6)*34*u, fl='F̄';
      ctx.save(); ctx.strokeStyle=c.muted; ctx.lineWidth=1.3; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(cx-panW/2,panY+3); ctx.lineTo(x0,panY+3); ctx.stroke(); ctx.restore();
      ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(cx-panW/2,panY+3,3,0,7); ctx.fill();
      arrow(ctx,x0,panY+3,0,ln,c.force,{w:4,label:fl,badge:'1'});
      arrow(ctx,x0,panY+3,0,-ln,c.force,{w:4,hollow:true,label:fl,badge:'1'});
    }
    if(L.th){ const th=this.theory(); label(ctx,T('th_lab')+' '+si(th.Fth,'N',3),W-12,H-10,c.accent,'right',10.5); }
  },
  drawGraphs(){
    const P=this.PF, p=this.p, c=C(), L=this.L; P.begin();
    const th=this.theory();
    let peak=0; for(let i=0;i<this.hc;i++) peak=Math.max(peak,this.hist[i]);
    const tgt=Math.max(1.15*peak,1.5*th.Fth,1e-6); this.ymax=tgt>this.ymax?tgt:Math.max(tgt,this.ymax*0.98);
    P.range(-3,0,0,this.ymax); const fs=scaleFor(this.ymax);
    P.grid({ydiv:fs.div,xl:'t (s)',yl:'F ('+fs.pfx+'N)'});
    P.clipOn();
    const xs=[],ys=[], i0=(this.hi-this.hc+HN)%HN;
    for(let j=0;j<this.hc;j++){ xs.push(-(this.hc-1-j)*DH); ys.push(this.hist[(i0+j)%HN]); }
    P.line(xs,ys,c.force,2);
    if(L.avg&&this.hc>2){ const n=this.hc, w=Math.max(1,Math.round(p.avgw/DH)), pre=new Float64Array(n+1); for(let j=0;j<n;j++) pre[j+1]=pre[j]+ys[j];
      const ax=[],ay=[]; for(let j=0;j<n;j+=3){ const a=Math.max(0,j-w+1); ax.push(xs[j]); ay.push((pre[j+1]-pre[a])/(j+1-a)); } P.line(ax,ay,c.mom,2.8); }
    if(L.e0&&p.e>0.01) P.hline(th.F0,c.muted,[3,4],T('e0_lab'),'left');
    if(L.th) P.hline(th.Fth,c.accent,[8,4],T('th_lab'),'right');
    if(L.ms) P.hline(this.last(HN),c.imp,[3,3]);
    P.clipOff();
  },
  updateText(){
    const th=this.theory(), p=this.p, R=this.cells, Fm=this.last(HN);
    this.rv.F.textContent=si(this.last(250),'N'); this.rv.n.textContent=num(p.R)+' /s';
    R.v.textContent=num(th.v,3)+' m/s'; R.J1.textContent=num(th.J1,3)+' N·s'; R.Fp.textContent=si(2*th.J1/(p.d/1000),'N');
    R.th.textContent=si(th.Fth,'N'); R.ms.textContent=si(Fm,'N'); const mm=th.Fth/GR; R.w.textContent=mm<1?num(mm*1000)+' g':num(mm)+' kg';
    const ch=$('#gchips'); if(ch.dataset.h!==''){ ch.innerHTML=''; ch.dataset.h=''; }
  },
  csvText(){ let out='t_s\tF_N\n'; const i0=(this.hi-this.hc+HN)%HN; for(let j=0;j<this.hc;j+=5) out+=[-(this.hc-1-j)*DH,this.hist[(i0+j)%HN]].map(csvNum).join('\t')+'\n'; return out; }
};
modes.rain=M3;
