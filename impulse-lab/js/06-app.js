// Impulse Lab · 06-app.js
// Start-up: scenes, tabs, toolbar, shareable state, image export, keyboard.
// Classic script: shares one global scope with the other js/0*.js files, loaded in order after js/boot.js.
'use strict';
/* ================= avvio ================= */
for(const b of $$('[data-ic]')) b.prepend(icn(b.dataset.ic));
let AS=1;
function mkSeg(id,opts,val,cb){
  const ph=$('#'+id), par=ph.parentNode, s=seg(par,opts,val,cb), cls=ph.className, al=ph.getAttribute('aria-label');
  s.el.className='seg '+cls; par.replaceChild(s.el,ph); s.el.id=id; if(al) s.el.setAttribute('aria-label',al); return s;
}
function applyLang(){
  LANG=KIT.getLang(); document.documentElement.lang=LANG;
  $$('[data-i18n]').forEach(e=>{ if(e.dataset.i18n) e.textContent=T(e.dataset.i18n); });
  $$('[data-i18n-title]').forEach(e=>{ const t=T(e.dataset.i18nTitle); e.title=t; e.setAttribute('aria-label',t); });
  sliders.forEach(s=>s.refresh());
  if(active){ $('#hint').textContent=active.hintKey?T(active.hintKey):''; }
  for(const k in modes) if(modes[k].relabel) modes[k].relabel();
  const hd=$('#gchips'); hd.dataset.h='\u0000'; markDirty();
}
M1.init(); M2.init(); M3.init(); M4.init();
/* language and theme live in the kit's settings menu */
KIT.onLang(()=>applyLang());
KIT.onTheme(()=>invalidate());
mkSeg('sceneSeg',[{v:'impact',icon:'impact',key:'sc_impact',cls:'t'},{v:'draw',icon:'pencil',key:'sc_draw',cls:'t'},{v:'rain',icon:'drop',key:'sc_rain',cls:'t'},{v:'ball',icon:'ball',key:'sc_ball',cls:'t'}],'impact',v=>setMode(v));
mkSeg('speedSeg',[{v:0.05,text:'1/20×'},{v:0.25,text:'¼×'},{v:1,text:'1×'},{v:2,text:'2×'}],1,v=>{ S.speed=+v; });
const insSeg=mkSeg('insetSeg',[{v:'p',key:'in_p'},{v:'e',key:'in_e'},{v:'off',key:'in_off'}],S.inset,v=>{ S.inset=v; markDirty(); });
let ctSeg;
{ const sp=$('#pane-show'); sp.append(h('h3',{class:'grp','data-i18n':'g_ctime'}));
  ctSeg=seg(sp,[{v:'slow',key:'ct_slow'},{v:'real',key:'ct_real'}],'slow',v=>{ S.rt=v==='real'; if(active===M1||active===M4) active.reset(); markDirty(); }); }
eb.title='p ⇄ E'; eb.addEventListener('click',()=>{ S.inset=S.inset==='e'?'p':'e'; insSeg.set(S.inset); markDirty(); });
$('#playBtn').addEventListener('click',()=>{ active.toggle(); markDirty(); });
$('#stepBtn').addEventListener('click',()=>active.stepOnce());
$('#resetBtn').addEventListener('click',()=>active.reset());
$$('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
const dlg=$('#info'), openHelp=()=>{ if(!dlg.open) $('#infoBtn').click(); };
$('#csvBtn').addEventListener('click',()=>copyText(active.csvText(),$('#csvBtn')));
const ar=$('#arrowR'), arL=$('#arrowL'); arL.textContent='×1.0';
ar.addEventListener('input',()=>{ AS=+ar.value; arL.textContent='×'+AS.toFixed(2).replace(/0$/,''); markDirty(); });
/* ---- stato condivisibile ---- */
const SK={impact:['m','v','k','e','prof','obj','limit'],draw:['m','v0','T','N','Fa'],rain:['m','h','R','e','d','avgw','rand'],ball:['m','M','L','v0','e','k','g','mode']};
const STRK=['prof','obj','rand','mode'];
function getState(){
  const o=new URLSearchParams(), m=active; o.set('s',m.id); SK[m.id].forEach(k=>o.set(k,m.p[k]));
  if(m.id==='draw') o.set('bars',m.bars.join(','));
  if(m.id==='ball'&&m.p.mode==='myst') o.set('hid',m.hid);
  o.set('ar',[AREA.view,AREA.N,AREA.hm,AREA.rate].join(',')); o.set('l',LANG); if(S.rt) o.set('rt','1');
  return o.toString();
}
function applyState(str){
  let o; try{ o=new URLSearchParams(str); }catch(e){ return null; }
  const id=o.get('s'); if(!modes[id]) return null; const m=modes[id], p=m.p;
  SK[id].forEach(k=>{ const v=o.get(k); if(v==null) return; p[k]=STRK.includes(k)?v:(isFinite(parseFloat(v))?parseFloat(v):p[k]); });
  const ar=(o.get('ar')||'').split(','); if(ar.length===4){ AREA.view=['rect','int','log'].includes(ar[0])?ar[0]:'rect'; AREA.N=clamp(+ar[1]||10,1,60); AREA.hm=['left','mid','right'].includes(ar[2])?ar[2]:'left'; AREA.rate=clamp(+ar[3]||2000,10,1e5); }
  if(o.get('l')==='it'||o.get('l')==='en'){ LANG=o.get('l'); if(KIT.getLang()!==LANG) KIT.setLang(LANG); }
  S.rt=o.get('rt')==='1';
  const sets=(...ks)=>ks.forEach(k=>{ if(m.sl&&m.sl[k]) m.sl[k].set(p[k]); });
  if(id==='impact'){ sets('m','v','k','e'); m.sgProf.set(p.prof); m.sgPre.set(''); p.limit=p.limit||0; m.recalc(true); }
  else if(id==='draw'){ p.N=Math.round(clamp(p.N,4,40)); const b=(o.get('bars')||'').split(',').map(Number).filter(x=>isFinite(x)); m.bars=b.length===p.N?b:Array.from({length:p.N},()=>0); sets('m','v0','T','N'); m.sgFa.set(p.Fa); m.edited(); }
  else if(id==='rain'){ m.sl.a.set(p.avgw); sets('m','h','R','e','d'); m.sgPre.set(''); m.reset(true); }
  else { sets('m','M','L','v0','e','k'); m.sgG.set(p.g); m.sgPre.set(''); const hid=parseFloat(o.get('hid')); m.setModeB(p.mode,true); if(isFinite(hid)) m.hid=hid; m.recalc(true); }
  return id;
}
function stateLink(){ return location.href.split('#')[0]+'#'+getState(); }
/* ---- esporta immagine ---- */
const imgDlg=h('dialog',{id:'imgDlg'}); document.body.append(imgDlg);
function exportImage(btn){
  const prev=S.tab; setTab('graphs'); render();
  const d=Math.min(devicePixelRatio||1,2), c=C(), parts=[cv]; if(!g1.hidden) parts.push(g1); if(!g2.hidden) parts.push(g2);
  const W=Math.max(...parts.map(e=>e.clientWidth)), top=34, gap=8, Ht=top+parts.reduce((s,e)=>s+e.clientHeight+gap,0);
  const out=document.createElement('canvas'); out.width=Math.round(W*d); out.height=Math.round(Ht*d); const x=out.getContext('2d'); x.scale(d,d);
  x.fillStyle=c.bg; x.fillRect(0,0,W,Ht); x.font='700 14px "Space Mono",ui-monospace,monospace'; x.fillStyle=c.ink; x.textBaseline='middle';
  x.fillText('Impulse Lab · '+T('sc_'+active.id),10,top/2);
  let y=top; for(const e of parts){ x.drawImage(e,0,y,e.clientWidth,e.clientHeight); if(e===cv&&!eb.hidden) x.drawImage(eb,eb.offsetLeft,y+eb.offsetTop,eb.clientWidth,eb.clientHeight); y+=e.clientHeight+gap; }
  setTab(prev);
  const sp=btn&&btn.querySelector('span:last-child'), old=sp&&sp.textContent, fb=()=>{ imgDlg.innerHTML=''; imgDlg.append(h('h2',{text:T('img_t')}),h('img',{src:out.toDataURL('image/png'),style:'max-width:100%;border:2px solid var(--ink)'}),h('p',{class:'note',text:T('img_n')})); const cl=h('button',{class:'btn primary',type:'button',text:T('close')}); cl.addEventListener('click',()=>imgDlg.close()); imgDlg.append(cl); try{ imgDlg.showModal(); }catch(e){ imgDlg.setAttribute('open',''); } };
  const ok=()=>{ if(sp){ sp.textContent=T('copied'); setTimeout(()=>{ sp.textContent=T('sh_img'); },1400); } else toast(T('img_copied')); };
  try{ out.toBlob(b=>{ if(!b){ fb(); return; } try{ navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(ok,fb); }catch(e){ fb(); } },'image/png'); }catch(e){ fb(); }
}
/* share and export are items of the kit's settings menu (js/boot.js calls these) */
function copyLink(){
  const t=stateLink(), manual=()=>{ const ta=$('#csvOut'); ta.hidden=false; ta.value=t; ta.select(); setTab('graphs'); };
  try{ navigator.clipboard.writeText(t).then(()=>toast(T('sh_copied')),manual); }catch(e){ manual(); }
}
window.IMPULSE={copyLink,copyImage:()=>exportImage(null)};
{ const sp=$('#pane-show'); sp.append(h('p',{class:'note','data-i18n':'k_n'})); }
addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((e.target.tagName||''))||dlg.open||imgDlg.open) return;
  const k=e.key, isBtn=/BUTTON/.test(e.target.tagName||'');
  if(e.code==='Space'&&!isBtn){ e.preventDefault(); active.toggle(); markDirty(); }
  else if(k==='r'||k==='R') active.reset();
  else if(k==='s'||k==='S') active.stepOnce();
  else if(k>='1'&&k<='4') setMode(['impact','draw','rain','ball'][+k-1]);
  else if(k==='i'||k==='I'){ S.inset=S.inset==='e'?'p':'e'; insSeg.set(S.inset); markDirty(); }
  else if(k==='?'||k==='h'||k==='H') openHelp();
});
if(window.ResizeObserver){ const ro=new ResizeObserver(()=>markDirty()); [cv,g1,g2,$('#wrap')].forEach(e=>ro.observe(e)); }
addEventListener('resize',markDirty);
let hs=(location.hash||'').slice(1);
if(hs.includes('=')){ const id=applyState(hs); hs=id||'impact'; ctSeg.set(S.rt?'real':'slow'); }
setTab('graphs'); setMode(modes[hs]?hs:'impact'); applyLang(); KIT.enhanceNumbers(document);
requestAnimationFrame(frame);
