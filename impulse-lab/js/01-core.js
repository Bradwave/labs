// Impulse Lab · 01-core.js
// Helpers, number formatting, colours, canvas, arrows, plots, controls, shared area tools, main loop.
// Classic script: shares one global scope with the other js/0*.js files, loaded in order after js/boot.js.
'use strict';
/* ================= utilità ================= */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const FONT='700 11px "Space Mono",ui-monospace,Menlo,monospace';
const GR=9.81;
function h(tag,props,...kids){
  const e=document.createElement(tag);
  if(props) for(const k in props){ if(k==='class') e.className=props[k]; else if(k==='text') e.textContent=props[k]; else e.setAttribute(k,props[k]); }
  for(const c of kids) if(c!=null) e.append(c);
  return e;
}
/* language and strings come from the lab kit (js/boot.js): T(name, a, b) fills {0}, {1} */
let LANG=KIT.getLang();
function T(k,...a){ return KIT.t(k,a.length?a.map(x=>String(x)):undefined); }
const PFX=['p','n','µ','m','','k','M','G','T'];
function num(v,sd){
  sd=sd||3; if(!isFinite(v)) return '–'; if(v===0) return '0';
  const a=Math.abs(v);
  if(a>=1e7||a<1e-4) return v.toExponential(sd-1).replace('.',LANG==='it'?',':'.');
  return Number(v.toPrecision(sd)).toLocaleString(LANG==='it'?'it-IT':'en-GB',{maximumFractionDigits:10,useGrouping:false});
}
function scaleFor(max){ if(!(max>0)) return {div:1,pfx:''}; let p=Math.floor(Math.log10(max)/3+1e-9); p=clamp(p,-4,4); return {div:Math.pow(10,3*p),pfx:PFX[p+4]}; }
const scaleTime=max=>max>=0.2?{div:1,pfx:''}:scaleFor(max);
function si(v,u,sd){
  if(!isFinite(v)) return '–'; if(v===0) return '0 '+u;
  let p=clamp(Math.floor(Math.log10(Math.abs(v))/3+1e-9),-3,3);
  if(Math.abs(Number((v/Math.pow(10,3*p)).toPrecision(sd||3)))>=1000&&p<3) p++;
  return num(v/Math.pow(10,3*p),sd)+' '+PFX[p+4]+u;
}
const fmtMass=m=>m<1?num(m*1000)+' g':num(m)+' kg';
function niceTicks(a,b,n){
  const range=b-a; if(!(range>0)) return [a];
  const raw=range/n, p=Math.pow(10,Math.floor(Math.log10(raw))), f=raw/p, s=(f<1.5?1:f<3?2:f<7?5:10)*p, out=[];
  for(let v=Math.ceil(a/s-1e-9)*s; v<=b+s*1e-9; v+=s) out.push(Math.abs(v)<s*1e-9?0:v);
  return out;
}
const parseNum=s=>KIT.parseNum(s);
/* CSV cells: 6 significant digits, decimal comma in Italian */
const csvNum=v=>{ const s=String(Number(v.toPrecision(6))); return LANG==='it'?s.replace('.',','):s; };
/* kit icon (inline SVG) as a DOM node */
function icn(name){ const t=document.createElement('template'); t.innerHTML=KIT.icon(name); return t.content.firstChild; }

/* ================= colori, canvas, ciclo ================= */
let _C=null;
function C(){
  if(_C) return _C;
  const s=getComputedStyle(document.documentElement), g=n=>s.getPropertyValue('--'+n).trim();
  _C={}; for(const k of['bg','surface','ink','muted','accent','onaccent','gridline','force','mom','imp','vel','q','ground','obj','pad','tile2']) _C[k]=g(k);
  _C.c=[g('c1'),g('c2'),g('c3')]; return _C;
}
let dirty=true; const markDirty=()=>{dirty=true;};
const invalidate=()=>{_C=null;markDirty();};
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',invalidate); }catch(e){}
new MutationObserver(invalidate).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
function fit(cv){
  const w=Math.max(40,cv.clientWidth), hh=Math.max(40,cv.clientHeight), d=Math.min(window.devicePixelRatio||1,2.5);
  if(cv.width!==Math.round(w*d)||cv.height!==Math.round(hh*d)){ cv.width=Math.round(w*d); cv.height=Math.round(hh*d); }
  const ctx=cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0); return {ctx,w,h:hh};
}
const cv=$('#cv'), eb=$('#ebars'), g1=$('#g1'), g2=$('#g2');

/* frecce ed etichette (stile Pendulum Lab: la reazione ha la punta vuota e lo stesso numero) */
let placed=[];
function arrow(ctx,x0,y0,dx,dy,col,o){
  o=o||{}; if(!o.fixed){ dx*=AS; dy*=AS; } let L=Math.hypot(dx,dy); if(L<1.5) return null;
  const maxL=o.max||1e9; if(L>maxL){ dx*=maxL/L; dy*=maxL/L; L=maxL; }
  const w=o.w||3, hl=Math.min(10+w,L*.6), ux=dx/L, uy=dy/L, x1=x0+dx, y1=y0+dy, bx=x1-ux*hl, by=y1-uy*hl, hw=hl*.55;
  if(o.halo){ ctx.save(); const sf=C().surface; ctx.strokeStyle=sf; ctx.fillStyle=sf; ctx.lineWidth=w+4; ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(bx,by); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(bx-uy*hw,by+ux*hw); ctx.lineTo(bx+uy*hw,by-ux*hw); ctx.closePath(); ctx.lineWidth=4; ctx.lineJoin='round'; ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.save(); ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=w; ctx.lineCap='butt';
  if(o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(bx-uy*hw,by+ux*hw); ctx.lineTo(bx+uy*hw,by-ux*hw); ctx.closePath();
  if(o.hollow){ ctx.fillStyle=C().surface; ctx.fill(); ctx.lineWidth=2; ctx.stroke(); } else ctx.fill();
  ctx.restore();
  if(o.label) tag(ctx,x1+ux*9,y1+uy*9,o.label,col,o.badge,ux,uy);
  return [x1,y1];
}
function tag(ctx,x,y,text,col,badge,ux,uy){
  ux=ux||0; uy=uy||0;
  ctx.save(); ctx.font=FONT; const tw=ctx.measureText(text).width, bw=badge?16:0, w=tw+bw, hh=14;
  let lx=x-(ux<-.3?w:ux>.3?0:w/2), ly=y+(uy>.3?hh*.8:uy<-.3?0:hh*.35);
  const CW=ctx.canvas.clientWidth; if(CW) lx=Math.max(4,Math.min(lx,CW-w-4));
  for(let k=0;k<6;k++){ const hit=placed.find(p=>lx<p[0]+p[2]&&lx+w>p[0]&&ly-hh<p[1]&&ly>p[1]-p[3]); if(!hit) break; ly+=(uy<0?-1:1)*(hh+1); }
  placed.push([lx,ly,w,hh]);
  ctx.lineJoin='round'; ctx.lineWidth=4; ctx.strokeStyle=C().surface; ctx.strokeText(text,lx+bw,ly); ctx.fillStyle=col; ctx.fillText(text,lx+bw,ly);
  if(badge){ ctx.fillStyle=col; ctx.fillRect(lx,ly-11,13,13); ctx.fillStyle=C().surface; ctx.font='700 10px "Space Mono",monospace'; ctx.fillText(badge,lx+3.5,ly-1); }
  ctx.restore();
}
function label(ctx,txt,x,y,color,align,size){ ctx.save(); ctx.font='700 '+(size||11)+'px "Space Mono",ui-monospace,monospace'; ctx.fillStyle=color; ctx.textAlign=align||'left'; ctx.fillText(txt,x,y); ctx.restore(); }

/* grafico cartesiano */
class Plot{
  constructor(cv,m){ this.cv=cv; this.m=Object.assign({l:52,r:12,t:22,b:30},m||{}); }
  begin(){
    const f=fit(this.cv); this.ctx=f.ctx; this.w=f.w; this.h=f.h; this.reg={x:0,y:0,w:f.w,h:f.h};
    this.x0=this.m.l; this.x1=this.w-this.m.r; this.y0=this.h-this.m.b; this.y1=this.m.t; this.ctx.clearRect(0,0,this.w,this.h); return this.ctx;
  }
  attach(ctx,W,H,reg){
    this.ctx=ctx; this.w=W; this.h=H; this.reg=reg;
    this.x0=reg.x+this.m.l; this.x1=reg.x+reg.w-this.m.r; this.y1=reg.y+this.m.t; this.y0=reg.y+reg.h-this.m.b; return ctx;
  }
  range(xa,xb,ya,yb){ this.xa=xa; this.xb=xb; this.ya=ya; this.yb=yb; }
  X(v){ return this.x0+(v-this.xa)/(this.xb-this.xa)*(this.x1-this.x0); }
  Y(v){ return this.y0+(v-this.ya)/(this.yb-this.ya)*(this.y1-this.y0); }
  invX(px){ return this.xa+(px-this.x0)/(this.x1-this.x0)*(this.xb-this.xa); }
  invY(py){ return this.ya+(py-this.y0)/(this.y1-this.y0)*(this.yb-this.ya); }
  grid(o){
    const c=this.ctx, col=C(), xd=o.xdiv||1, yd=o.ydiv||1;
    c.save(); c.fillStyle=col.surface; c.fillRect(this.reg.x,this.reg.y,this.reg.w,this.reg.h);
    const xt=niceTicks(this.xa/xd,this.xb/xd,Math.max(3,Math.floor((this.x1-this.x0)/64)));
    const yt=niceTicks(this.ya/yd,this.yb/yd,Math.max(2,Math.floor((this.y0-this.y1)/36)));
    c.lineWidth=1; c.strokeStyle=col.gridline; c.beginPath();
    for(const v of xt){ const x=Math.round(this.X(v*xd))+.5; c.moveTo(x,this.y1); c.lineTo(x,this.y0); }
    for(const v of yt){ const y=Math.round(this.Y(v*yd))+.5; c.moveTo(this.x0,y); c.lineTo(this.x1,y); }
    c.stroke();
    c.strokeStyle=col.ink; c.lineWidth=2; c.beginPath();
    if(this.ya<0&&this.yb>0){ const y=Math.round(this.Y(0))+.5; c.moveTo(this.x0,y); c.lineTo(this.x1,y); }
    c.moveTo(this.x0+.5,this.y1); c.lineTo(this.x0+.5,this.y0+.5); c.lineTo(this.x1,this.y0+.5); c.stroke();
    c.font='10.5px "Space Mono",ui-monospace,monospace'; c.fillStyle=col.muted; c.textAlign='center'; c.textBaseline='top';
    for(const v of xt){ const x=this.X(v*xd); if(x>this.x0-2&&x<this.x1+2) c.fillText(num(v,3),x,this.y0+5); }
    c.textAlign='right'; c.textBaseline='middle';
    for(const v of yt) c.fillText(num(v,3),this.x0-6,this.Y(v*yd));
    c.textBaseline='alphabetic'; c.font='700 10.5px "Space Mono",ui-monospace,monospace';
    if(o.xl){ c.textAlign='right'; c.fillText(o.xl,this.x1,this.reg.y+this.reg.h-3); }
    if(o.yl){ c.textAlign='left'; c.fillText(o.yl,this.reg.x+6,this.reg.y+13); }
    c.restore();
  }
  clipOn(){ const c=this.ctx; c.save(); c.beginPath(); c.rect(this.x0,this.y1-3,this.x1-this.x0+3,this.y0-this.y1+6); c.clip(); }
  clipOff(){ this.ctx.restore(); }
  line(xs,ys,color,lw,dash,n){
    const c=this.ctx; n=n==null?xs.length:n; if(n<2) return;
    c.save(); c.strokeStyle=color; c.lineWidth=lw||2; c.lineJoin='round'; if(dash) c.setLineDash(dash);
    c.beginPath(); for(let i=0;i<n;i++){ const x=this.X(xs[i]), y=this.Y(ys[i]); if(i) c.lineTo(x,y); else c.moveTo(x,y); } c.stroke(); c.restore();
  }
  hline(v,color,dash,txt,align){
    const c=this.ctx, y=this.Y(v);
    c.save(); c.strokeStyle=color; c.lineWidth=1.6; c.setLineDash(dash||[5,4]); c.beginPath(); c.moveTo(this.x0,y); c.lineTo(this.x1,y); c.stroke(); c.restore();
    if(txt) label(c,txt,align==='left'?this.x0+5:this.x1-5,y-5,color,align==='left'?'left':'right',10.5);
  }
  dot(x,y,color,r){ const c=this.ctx; c.save(); c.fillStyle=color; c.strokeStyle=C().ink; c.lineWidth=1.5; c.beginPath(); c.arc(this.X(x),this.Y(y),r||4.5,0,7); c.fill(); c.stroke(); c.restore(); }
}

/* barre generiche: {bars:[{a,b,col,name,alpha}], lo,hi, unit, lines:[{y,col}]} */
function drawBarsGen(cv,o){
  const f=fit(cv), c=f.ctx, W=f.w, H=f.h, col=C(), n=o.bars.length;
  c.clearRect(0,0,W,H); c.fillStyle=col.surface; c.fillRect(0,0,W,H);
  const top=(o.cap||o.unit)?36:24, bot=H-22, Y=v=>bot+(v-o.lo)/(o.hi-o.lo)*(top-bot);
  const slot=(W-12)/n, bw=Math.min(46,slot*.66);
  c.strokeStyle=col.ink; c.lineWidth=1.5; c.beginPath(); c.moveTo(6,Math.round(Y(0))+.5); c.lineTo(W-6,Math.round(Y(0))+.5); c.stroke();
  (o.lines||[]).forEach(l=>{ c.save(); c.strokeStyle=l.col||col.muted; c.lineWidth=1.5; c.setLineDash([4,3]); c.beginPath(); c.moveTo(6,Y(l.y)); c.lineTo(W-6,Y(l.y)); c.stroke(); c.restore(); });
  o.bars.forEach((b,i)=>{
    const x=6+slot*i+(slot-bw)/2, y1=Y(b.a), y2=Y(b.b), yt=Math.min(y1,y2), hh=Math.max(1,Math.abs(y2-y1));
    c.globalAlpha=b.alpha||1; c.fillStyle=b.col; c.fillRect(x,yt,bw,hh); c.globalAlpha=1;
    c.strokeStyle=col.ink; c.lineWidth=1.5; c.strokeRect(x+.5,yt+.5,bw-1,hh-1);
    const val=b.v!=null?b.v:(b.b-b.a);
    label(c,b.hide?'?':(b.plus&&val>0?'+':'')+num(val,3),x+bw/2,Math.max(12,yt-5),col.ink,'center',10);
    label(c,b.name,x+bw/2,H-7,col.muted,'center',10);
  });
  if(o.unit) label(c,o.unit,6,12,col.muted,'left',10);
  if(o.cap) label(c,o.cap,W-6,12,col.ink,'right',10);
}

/* indicatore del tempo: striscia con le fasi (tempo reale / rallentato) e cornice tratteggiata durante l'urto */
function timeStrip(ctx,W,H,tm,clk,phase,rt,k){
  const c=C(), x0=12, x1=W-12, y=H-36, hh=14, tot=tm.A+tm.D+tm.B, full=x1-x0;
  let wD=Math.max(rt?4:36,full*tm.D/tot), rest=full-wD, wA=rest*tm.A/(tm.A+tm.B), wB=rest-wA;
  const xD=x0+wA, xB=xD+wD, slow=!rt;
  ctx.save(); ctx.lineWidth=2; ctx.strokeStyle=c.ink;
  ctx.fillStyle=c.surface; ctx.fillRect(x0,y,wA,hh); ctx.fillRect(xB,y,wB,hh);
  ctx.fillStyle=c.q; ctx.globalAlpha=phase===1?1:.55; ctx.fillRect(xD,y,wD,hh); ctx.globalAlpha=1;
  if(slow){ ctx.save(); ctx.beginPath(); ctx.rect(xD,y,wD,hh); ctx.clip(); ctx.strokeStyle=c.surface; ctx.globalAlpha=.55; ctx.lineWidth=2; ctx.beginPath(); for(let x=xD-hh;x<xD+wD;x+=7){ ctx.moveTo(x,y+hh); ctx.lineTo(x+hh,y); } ctx.stroke(); ctx.restore(); }
  ctx.strokeRect(x0+1,y+1,full-2,hh-2); ctx.beginPath(); ctx.moveTo(xD,y); ctx.lineTo(xD,y+hh); ctx.moveTo(xB,y); ctx.lineTo(xB,y+hh); ctx.stroke();
  const tl=T('tm_real'), tw=tl.length*5.9+10; if(wA>tw) label(ctx,tl,x0+wA/2,y+hh-3.5,c.muted,'center',9.5); if(wB>tw) label(ctx,tl,xB+wB/2,y+hh-3.5,c.muted,'center',9.5);
  let xc; if(clk<tm.A) xc=x0+wA*clk/tm.A; else if(clk<tm.A+tm.D) xc=xD+wD*(clk-tm.A)/tm.D; else xc=xB+wB*Math.min(1,(clk-tm.A-tm.D)/tm.B);
  ctx.fillStyle=c.ink; ctx.beginPath(); ctx.moveTo(xc,y-1); ctx.lineTo(xc-5,y-8); ctx.lineTo(xc+5,y-8); ctx.closePath(); ctx.fill();
  if(slow){ const tx=T('slowmo',num(k,2)); label(ctx,'⏱ '+tx.toUpperCase(),xD+wD/2,y-12,phase===1?c.q:c.muted,'center',phase===1?11.5:10); }
  else label(ctx,'Δt = '+si(tm.D,'s',3)+' · '+T('realtime'),xD+wD/2,y-12,c.muted,'center',10);
  if(phase===1&&slow){ ctx.fillStyle=c.q; ctx.globalAlpha=.07; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1; ctx.strokeStyle=c.q; ctx.lineWidth=4; ctx.setLineDash([10,6]); ctx.strokeRect(2,2,W-4,H-4); }
  ctx.restore();
}

/* ================= controlli ================= */
const sliders=[];
function slider(host,o){
  const lab=h('label',{for:o.id}), nm=h('span',{'data-i18n':o.key}), out=h('b');
  lab.append(nm,out);
  const inp=h('input',{type:'range',id:o.id,min:0,max:1000,step:1,value:0});
  const wrapEl=h('div',{class:'ctl'}); wrapEl.append(lab,inp); host.append(wrapEl);
  const toR=v=>o.log?1000*Math.log(v/o.min)/Math.log(o.max/o.min):1000*(v-o.min)/(o.max-o.min);
  const S={val:o.val,el:wrapEl,inp,
    refresh(){ out.textContent=o.fmt(S.val); },
    set(v){ S.val=v; inp.value=toR(v); S.refresh(); },
    disable(d){ inp.disabled=d; wrapEl.classList.toggle('dim',d); }};
  inp.addEventListener('input',()=>{
    const r=+inp.value; let v=o.log?o.min*Math.pow(o.max/o.min,r/1000):o.min+(o.max-o.min)*r/1000;
    v=o.log?Number(v.toPrecision(3)):(o.step?Math.round(v/o.step)*o.step:v);
    S.val=clamp(v,o.min,o.max); S.refresh(); if(o.onInput) o.onInput(S.val);
  });
  sliders.push(S); S.set(o.val); return S;
}
function seg(host,opts,val,cb,cls){
  const g=h('div',{class:'seg'+(cls?' '+cls:''),role:'group'});
  const bs=opts.map(o=>{
    const b=h('button',{type:'button','data-v':String(o.v)});
    if(o.icon) b.append(icn(o.icon));
    if(o.svg){ const mi=h('span',{class:'mini'}); mi.innerHTML='<svg viewBox="0 0 30 20"><path d="'+o.svg+'"/></svg>'; b.append(mi); }
    const sp=h('span',o.key?{'data-i18n':o.key,class:o.cls||''}:{class:o.cls||'',text:o.text}); b.append(sp);
    b.addEventListener('click',()=>{ S.set(o.v); cb(o.v); }); g.append(b); return b;
  });
  const S={val,el:g,set(v){ S.val=v; bs.forEach(b=>b.classList.toggle('on',b.dataset.v===String(v))); }};
  S.set(val); host.append(g); return S;
}
function group(host,key){ const e=h('h3',{class:'grp','data-i18n':key}); host.append(e); return e; }
function note(host,key,cls){ const e=h('p',{class:'note'+(cls?' '+cls:''),'data-i18n':key}); host.append(e); return e; }
function hostFor(parent,id){ const d=h('div'); d.dataset.m=id; d.hidden=true; $(parent).append(d); return d; }

/* livelli: stato condiviso fra la barra rapida e la scheda Show */
function layers(mode,defs){
  mode.L={};
  defs.forEach(d=>{
    mode.L[d.k]=d.on!==false;
    const tg=h('button',{class:'tg','aria-pressed':String(mode.L[d.k]),type:'button'});
    tg.append(h('span',{class:'sw'+(d.kind==='dot'?' dot':''),style:'color:'+(d.col?'var(--'+d.col+')':'var(--ink)')}));
    const tx=h('span',{class:'txt'}); tx.append(h('span',{'data-i18n':'ly_'+d.k})); if(d.sub) tx.append(h('small',{'data-i18n':'ly_'+d.k+'_s'}));
    tg.append(tx,h('span',{class:'box'})); mode.sh.append(tg);
    let lg=null;
    if(d.quick){
      lg=h('button',{class:'lg'+(mode.L[d.k]?' on':''),type:'button',style:'color:var(--'+(d.col||'ink')+')'});
      lg.append(h('span',{class:d.kind==='dot'?'':'vs'}));
      if(d.kind==='dot'){ lg.firstChild.remove(); lg.append(h('i',{style:'background:var(--'+(d.col||'ink')+')'})); }
      lg.append(h('span',{'data-i18n':'ly_'+d.k,style:'color:var(--ink)'})); mode.qk.append(lg);
    }
    const flip=()=>{ mode.L[d.k]=!mode.L[d.k]; tg.setAttribute('aria-pressed',String(mode.L[d.k])); if(lg) lg.classList.toggle('on',mode.L[d.k]); if(d.onChange) d.onChange(mode.L[d.k]); markDirty(); };
    tg.addEventListener('click',flip); if(lg) lg.addEventListener('click',flip);
  });
}
function tableFor(mode,rows){
  const tb=h('table',{class:'ptable'}); mode.tb.append(tb); mode.cells={};
  rows.forEach(r=>{
    if(r==='sep'){ tb.append(h('tr',{class:'sep'},h('td',{colspan:2}))); return; }
    const tr=h('tr',{class:r.cls||''}), td1=h('td'), td2=h('td');
    td1.append(h('span',{'data-i18n':r.key})); if(r.sub) td1.append(h('small',{'data-i18n':r.sub,style:'display:block;color:var(--muted);font-size:10.5px;font-weight:400'}));
    tr.append(td1,td2); tb.append(tr); mode.cells[r.k]=td2; if(r.dyn) mode.cells[r.k+'_dt']=td1.firstChild;
  });
}
function readoutFor(mode,rows){
  mode.ro=hostFor('#wrap',mode.id); mode.ro.className='readout'; mode.rv={};
  rows.forEach(r=>{ const a=h('span',{text:r[1]}), b=h('b'); mode.ro.append(a,b); mode.rv[r[0]]=b; });
}
const toast=msg=>KIT.toast(msg,2600);
function copyText(text,btn){
  const ta=$('#csvOut'); const done=()=>{ if(btn){ const sp=btn.querySelector('span:last-child'); const old=sp.textContent; sp.textContent=T('copied'); setTimeout(()=>{sp.textContent=T('csv');},1400); } };
  const manual=()=>{ ta.hidden=false; ta.value=text; ta.focus(); ta.select(); };
  try{ navigator.clipboard.writeText(text).then(done,manual); }catch(e){ manual(); }
}

/* ================= area: rettangoli, integrale, datalogger (condivisi) ================= */
const AREA={view:'rect',N:10,hm:'left',rate:2000,phi:0};
const areaUIs=[];
function areaGroup(host,opt){
  opt=opt||{};
  group(host,'g_area');
  const ui={}, vs=opt.draw?[{v:'rect',key:'m_rect'},{v:'int',key:'m_int'}]:[{v:'rect',key:'m_rect'},{v:'int',key:'m_int'},{v:'log',key:'m_log'}];
  ui.view=seg(host,vs,AREA.view,v=>{ AREA.view=v; areaChanged(); },'wrap');
  if(!opt.draw){
    ui.N=slider(host,{id:'ar-n-'+Math.random().toString(36).slice(2,6),key:'n_rect',min:1,max:60,step:1,val:AREA.N,fmt:v=>String(Math.round(v)),onInput:v=>{AREA.N=Math.round(v);areaChanged();}});
    ui.hmBox=h('div',{class:'ctl'}); ui.hmBox.append(h('label',{},h('span',{'data-i18n':'h_mode'}))); ui.hm=seg(ui.hmBox,[{v:'left',key:'h_left'},{v:'mid',key:'h_mid'},{v:'right',key:'h_right'}],AREA.hm,v=>{AREA.hm=v;areaChanged();}); host.append(ui.hmBox);
    ui.rate=slider(host,{id:'ar-r-'+Math.random().toString(36).slice(2,6),key:'rate',min:10,max:1e5,log:true,val:AREA.rate,fmt:v=>si(v,'Hz'),onInput:v=>{AREA.rate=v;areaChanged();}});
    ui.nt=note(host,'dt_note'); ui.nt.removeAttribute('data-i18n');
    ui.nt.textContent='';
  }
  ui.sync=()=>{
    ui.view.set(AREA.view);
    if(!opt.draw){ ui.N.set(AREA.N); ui.hm.set(AREA.hm); ui.rate.set(AREA.rate);
      ui.N.el.hidden=AREA.view!=='rect'; ui.hmBox.hidden=AREA.view!=='rect'; ui.rate.el.hidden=AREA.view!=='log'; }
  };
  areaUIs.push(ui); ui.sync(); return ui;
}
function areaChanged(){ areaUIs.forEach(u=>u.sync()); for(const k in modes) if(modes[k].areaChanged) modes[k].areaChanged(); markDirty(); }
/* rettangoli per una forza F(t) su [0,T] */
function buildRects(Ff,Ttot){
  const R=[];
  if(AREA.view==='rect'){
    const N=AREA.N, D=Ttot/N;
    for(let i=0;i<N;i++){ const t=i*D+(AREA.hm==='left'?0:AREA.hm==='mid'?D/2:D); R.push({a:i*D,b:(i+1)*D,hh:Ff(clamp(t,0,Ttot)),w:D,ts:t}); }
  } else if(AREA.view==='log'){
    const dt=1/AREA.rate;
    for(let t=AREA.phi*dt; t<=Ttot+1e-12&&R.length<20000; t+=dt) R.push({a:t-dt/2,b:t+dt/2,hh:Ff(t),w:dt,ts:t});
  }
  return R;
}
const rectSumUpTo=(R,tau)=>{ let s=0; for(const r of R){ if(AREA.view==='log'?r.ts<=tau+1e-12:r.b<=tau+1e-12) s+=r.hh*r.w; } return s; };

/* grafico F(t) con area, forza media, curve fissate, limite: usato da Urto e Balistico */
function drawForcePlot(P,o,L){
  const c=C(), s=o.sim; P.begin();
  let xb=s.T*1.1, yb=s.Fmax*1.14;
  for(const q of o.pins||[]){ xb=Math.max(xb,q.T*1.1); yb=Math.max(yb,q.Fmax*1.14); }
  if(o.limit) yb=Math.max(yb,o.limit*1.2);
  if(o.real){ xb=Math.max(xb,o.real.T*1.06); yb=Math.max(yb,o.real.Fmax*1.12); }
  P.range(0,xb,0,yb);
  const ts=scaleTime(xb), fs=scaleFor(yb);
  P.grid({xdiv:ts.div,ydiv:fs.div,xl:'t ('+ts.pfx+'s)',yl:'F ('+fs.pfx+'N)'});
  if(o.hide){ P.clipOn(); P.clipOff(); return; }
  P.clipOn(); const ctx=P.ctx, tau=o.tau;
  if(o.limit) P.hline(o.limit,c.force,[6,4],T('limit'),'right');
  (o.pins||[]).forEach(q=>P.line(q.t,q.F,c.c[q.ci],2,[5,4]));
  if(L.mean&&tau>=s.T){ const fm=s.Jtot/s.T; ctx.save(); ctx.strokeStyle=c.accent; ctx.lineWidth=2.5; ctx.setLineDash([7,4]); ctx.strokeRect(P.X(0),P.Y(fm),P.X(s.T)-P.X(0),P.Y(0)-P.Y(fm)); ctx.restore(); label(ctx,'F̄',P.X(s.T/2),P.Y(fm)-5,c.accent,'center',11); }
  ctx.fillStyle=c.imp; ctx.strokeStyle=c.ink;
  if(L.area){
    if(AREA.view==='int'){
      if(tau>0){ ctx.globalAlpha=.4; ctx.beginPath(); ctx.moveTo(P.X(0),P.Y(0));
        for(let i=0;i<o.gt.length&&o.gt[i]<=tau;i++) ctx.lineTo(P.X(o.gt[i]),P.Y(o.gF[i]));
        ctx.lineTo(P.X(tau),P.Y(s.F(tau))); ctx.lineTo(P.X(tau),P.Y(0)); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; }
    } else {
      const step=Math.max(1,Math.floor(o.rects.length/400));
      o.rects.forEach((r,i)=>{
        if(i%step) return;
        const xa=P.X(Math.max(0,r.a)), xb2=P.X(Math.min(s.T*(AREA.view==='log'?1.2:1),r.b)), ya=P.Y(0), yb2=P.Y(r.hh);
        const done=AREA.view==='log'?r.ts<=tau+1e-12:r.b<=tau+1e-12;
        if(done){ ctx.globalAlpha=.4; ctx.fillRect(xa,yb2,xb2-xa,ya-yb2); ctx.globalAlpha=1; ctx.lineWidth=1.5; ctx.strokeRect(xa+.5,yb2+.5,Math.max(0,xb2-xa-1),Math.max(0,ya-yb2-1)); }
        else if(AREA.view==='rect'&&r.a<=tau){ ctx.globalAlpha=.8; ctx.lineWidth=1.5; ctx.setLineDash([3,3]); ctx.strokeRect(xa+.5,yb2+.5,xb2-xa-1,ya-yb2-1); ctx.setLineDash([]); ctx.globalAlpha=1; }
        if(AREA.view==='log'&&done){ ctx.fillStyle=c.ink; ctx.beginPath(); ctx.arc(P.X(r.ts),yb2,2.6,0,7); ctx.fill(); ctx.fillStyle=c.imp; }
      });
    }
  }
  const xs=[],ys=[]; for(let i=0;i<o.gt.length&&o.gt[i]<=tau;i++){ xs.push(o.gt[i]); ys.push(o.gF[i]); }
  if(tau>0){ xs.push(tau); ys.push(s.F(tau)); }
  P.line(xs,ys,c.force,3);
  if(o.live) P.dot(tau,s.F(tau),c.force,5);
  if(o.real){ const R=o.real; P.line(R.t,R.F,c.c[1],2); if(R.n<=120) for(let i=0;i<R.n;i++) P.dot(R.t[i],R.F[i],c.c[1],2.6); }
  P.clipOff();
}

/* ================= ciclo principale ================= */
const S={speed:1,tab:'graphs',inset:'p',rt:false};
const modes={}; let active=null, last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(active){
    const was=active.playing; if(active.playing&&active.tick) active.tick(dt*S.speed); if(was&&!active.playing) dirty=true;
    if(dirty||active.playing){ dirty=false; render(); }
  }
  requestAnimationFrame(frame);
}
const insetOn=()=>S.inset!=='off'&&cv.clientHeight>=230;
function render(){
  placed=[];
  active.drawMain();
  if(active.drawInset&&insetOn()){ eb.hidden=false; active.drawInset(); } else eb.hidden=true;
  if(!$('#pane-graphs').hidden) active.drawGraphs();
  active.updateText();
  const pl=$('#playLbl'), pi=$('#playIcon'), lab=active.playing?T('pause'):T('play');
  if(pl.textContent!==lab) pl.textContent=lab; const ic=active.playing?'pause':'play'; if(pi.dataset.ic!==ic){ pi.dataset.ic=ic; pi.innerHTML=KIT.icon(ic); }
}
function setMode(id){
  if(!modes[id]) id='impact';
  active=modes[id]; g1.classList.remove('sketching');
  $$('#sceneSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===id));
  $$('[data-m]').forEach(e=>{ e.hidden=e.dataset.m!==id; });
  eb.classList.toggle('big',id==='ball'); g2.hidden=!active.twoGraphs; cv.classList.toggle('pen',!!active.pen);
  $('#hint').textContent=active.hintKey?T(active.hintKey):''; $('#hint').hidden=!active.hintKey;
  if(active.enter) active.enter();
  markDirty(); try{ history.replaceState(null,'','#'+id); }catch(e){}
}
function setTab(t){
  S.tab=t; $$('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  ['graphs','show','setup'].forEach(k=>{ $('#pane-'+k).hidden=k!==t; }); markDirty();
}
