// Pendulum Lab · ui.js
// Buttons, tabs, sliders and toggles wiring; every label comes from strings.js through the kit's t().
import { DATA, VARS, gSel, sample, vAv, vl } from './data.js';
import { FL, fluidStep, liquidAdvance } from './fluid.js';
import { releaseAngle, rescaleE, resetToRelease, setAngle } from './interaction.js';
import { G, csv, updateReadout } from './panels.js';
import { cur, enterPolar, step, syncCart } from './physics.js';
import { LY, Lp, P, PEN, S } from './state.js';
import { $, $$, TAU, clamp, nf } from './util.js';
import { t, toast, icon, parseNum } from '../../kit/kit.js';
import { cam, cv, resize } from './view.js';

// ---------- UI wiring ----------
export { toast };
export function setPlaying(p){S.playing=p;$('#playIcon').innerHTML=icon(p?'pause':'play');$('#playLbl').textContent=t(p?'pause':'play');$('#playBtn').setAttribute('aria-label',t(p?'pause':'play'));}
export function segBind(id,fn){$$(id+' button').forEach(b=>b.onclick=()=>{$$(id+' button').forEach(x=>x.classList.toggle('on',x===b));fn(b.dataset.v,b);});}
export function segSet(id,v){$$(id+' button').forEach(x=>x.classList.toggle('on',x.dataset.v===String(v)));}
export function setView(v){S.view=v;segSet('#viewSeg',v);cv.classList.toggle('locked',v!=='lab');updateHint();syncLayers();}
export function updateHint(){$('#hint').textContent=t(S.view==='lab'?'hint.lab':'hint.ball');}

// groups of switches: [group key, [[layer, colour token], ...]]; labels "ly.<layer>", hints "ly.<layer>.s" when present
export const SHOW=[
  ['sh.motion',[['vel','vel'],['speed','vel'],['acc','acc'],['accComp','acc'],['trail','muted']]],
  ['sh.forces',[['W','wt'],['R','ten'],['D','drag'],['S','spr'],['net','ink'],['decomp','ink'],['polygon','ink'],['values','ink']]],
  ['sh.third',[['ropeEnds','ten'],['support','ten'],['earth','wt'],['pairs','ink']]],
  ['sh.ball',[['app','app'],['appComp','app'],['frameAcc','acc'],['geff','liquid'],['rotate','ink']]],
  ['sh.sensors',[['phone','acc'],['phoneG','acc']]],
  ['sh.display',[['fluid','liquid'],['readout','ink'],['energy','vel'],['ropeColor','ten'],['grid','muted']]]
];
export const DOT=new Set(['trail','values','pairs','rotate','fluid','readout','energy','ropeColor','grid','speed','polygon','phone','phoneG']);
export const QUICK=[['vel','q.vel','vel'],['acc','q.acc','acc'],['W,R,D,S','q.forces','ten'],['decomp','q.decomp','ink'],['polygon','q.polygon','ink'],['ropeEnds,support,earth','q.third','wt'],['app','q.app','app'],['fluid','q.fluid','liquid'],['phone','q.phone','acc'],['energy','q.energy','vel'],['trail','q.trail','muted']];
const hasKey=k=>t(k)!==k;
// lists rebuilt on start and on every language change
export function buildLists(){
  $('#showList').innerHTML=SHOW.map(([g,items])=>`<h3 class="grp">${t(g)}</h3>`+items.map(([k,c])=>
    `<button class="tg" type="button" data-ly="${k}"><span class="sw${DOT.has(k)?' dot':''}" style="${DOT.has(k)?`background:var(--${c})`:`color:var(--${c})`}"></span><span class="txt">${t('ly.'+k)}${hasKey('ly.'+k+'.s')?`<small>${t('ly.'+k+'.s')}</small>`:''}</span><span class="box"></span></button>`).join('')).join('');
  $('#quick').innerHTML=QUICK.map(([k,l,c])=>`<button class="lg" type="button" data-ly="${k}" style="color:var(--${c})"><span class="vs"></span><span style="color:var(--ink)">${t(l)}</span></button>`).join('');
  $('#gchips').innerHTML=VARS.map(v=>`<button class="lg" type="button" data-g="${v.k}"><i style="background:var(--${v.c})"></i>${vl(v)}</button>`).join('');
  $$('[data-g]').forEach(b=>b.onclick=()=>{const k=b.dataset.g;if(gSel.has(k))gSel.delete(k);else{const n=VARS.filter(v=>gSel.has(v.k)&&vAv(v)).length;if(n>=5){toast(t('t.max5'));return;}gSel.add(k);}syncG();});
}
export function afterLayer(k,on){
  if(k==='two'){if(on){const p=PEN[1];setAngle(p,0,0);p.trail.length=0;p.cross=[];}cam.labS=null;rescaleE();syncSetup();}
  if(k==='drive'){if(on){S.tOff=-S.t;}rescaleE();syncSetup();}
  if(k==='fluid'&&on)FL.ok=false;
  if(k==='phone'||k==='two'||k==='drive')syncG();
}
export function syncLayers(){
  $$('[data-ly]').forEach(b=>{const on=b.dataset.ly.split(',').every(k=>LY[k]);b.setAttribute('aria-pressed',on);b.classList.toggle('on',on);});
  $('#ebars').hidden=!LY.energy;updateReadout(cur());
}

export function syncG(){$$('[data-g]').forEach(b=>{const v=VARS.find(q=>q.k===b.dataset.g);b.hidden=!vAv(v);b.classList.toggle('on',gSel.has(b.dataset.g));});$('#gchips').classList.toggle('dim',G.mode==='phase');}

export const kFromR=v=>5*Math.pow(400,v/100),rFromK=k=>100*Math.log(k/5)/Math.log(400);
export const fFromR=v=>.05*Math.pow(800,v/100),rFromF=f=>100*Math.log(f/.05)/Math.log(800);
export const binds=[];
export function bindR(id,lab,get,set,show){const r=$(id);const upd=()=>{$(lab).textContent=show();};const pull=()=>{r.value=get();upd();};r.oninput=()=>{set(+r.value);upd();};pull();binds.push(pull);}
export const syncBinds=()=>binds.forEach(f=>f());
export function setModel(m){
  P.model=m;segSet('#modelSeg',m);
  for(const p of PEN){const r=Math.hypot(p.x,p.y);
    if(m==='rod')enterPolar(p);else if(m==='string'){if(!p.polar&&r>=Lp(p.i))enterPolar(p);}else p.polar=false;}
  cam.labS=null;rescaleE();syncSetup();syncG();
}
export function syncSetup(){
  $('#modelNote').textContent=t('note.'+P.model);$('#kCtl').hidden=P.model!=='elastic';
  $('#betaCtl').classList.toggle('dim',P.model!=='rod');
  $('#driveBox').classList.toggle('dim',!LY.drive);
  $('#twoBox').classList.toggle('dim',!LY.two);$('#kapCtl').hidden=!P.coupled;$('#thBWrap').hidden=!LY.two;
  const z=$('#zName');z.dataset.i18n=P.liquid==='simple'?'p.zeta':'p.visc';z.textContent=t(z.dataset.i18n);
}
export const f0=()=>P.g>0?Math.sqrt(P.g/P.L)/TAU:.5;

// slider values shown with the decimal separator of the current language
const offOr=(v,s)=>v===0?t('off'):s;
export function initUI(){
for(const b of $$('[data-ic]'))b.insertAdjacentHTML('afterbegin',icon(b.dataset.ic));
$('#playBtn').onclick=()=>setPlaying(!S.playing);
$('#stepBtn').onclick=()=>{setPlaying(false);const n=40,h=.02/n;let A;for(let i=0;i<n;i++){A=step(h);if(P.liquid==='simple')fluidStep(h,A[0].geff);S.samp+=h;if(S.samp>=.01){S.samp=0;sample(A);}}if(P.liquid==='particles')liquidAdvance(.02,A[0].geff);};
$('#resetBtn').onclick=()=>{resetToRelease();toast(t('t.reset'));};
segBind('#speedSeg',v=>{S.speed=+v;});
segBind('#viewSeg',v=>setView(v));
// layers: show list, quick chips, graph chips
buildLists();
document.addEventListener('click',e=>{const b=e.target.closest('[data-ly]');if(!b)return;const ks=b.dataset.ly.split(','),on=!ks.every(k=>LY[k]);ks.forEach(k=>LY[k]=on);ks.forEach(k=>afterLayer(k,on));syncLayers();});
// tabs
$$('.tab').forEach(tb=>tb.onclick=()=>{$$('.tab').forEach(x=>{x.classList.toggle('on',x===tb);x.setAttribute('aria-selected',x===tb);});$$('.tabpane').forEach(p=>p.hidden=p.id!=='pane-'+tb.dataset.tab);resize();});
// graphs controls
segBind('#gMode',v=>{G.mode=v;syncG();});segBind('#gWin',v=>{G.win=+v;});
$('#csvBtn').onclick=async()=>{
  const txt=csv(),ta=$('#csvOut');
  try{await navigator.clipboard.writeText(txt);toast(t('t.copied',{n:DATA.t.length}));ta.hidden=true;}
  catch{ta.hidden=false;ta.value=txt;ta.focus();ta.select();toast(t('t.blocked'));}
};
// setup controls
bindR('#LR','#LL',()=>P.L,v=>{P.L=v;const p=PEN[0];if(p.polar)syncCart(p);else if(P.model==='string'&&Math.hypot(p.x,p.y)>=P.L)enterPolar(p);cam.labS=null;rescaleE();},()=>nf(P.L,2,'m'));
bindR('#mR','#mL',()=>P.m,v=>{P.m=v;rescaleE();},()=>nf(P.m,2,'kg'));
bindR('#gR','#gL',()=>P.g,v=>{P.g=v;syncPlanet();rescaleE();},()=>nf(P.g,2,'m/s²'));
bindR('#cR','#cL',()=>P.c,v=>{P.c=v;},()=>offOr(P.c,nf(P.c,3,'kg/m')));
bindR('#bR','#bL',()=>P.b,v=>{P.b=v;},()=>offOr(P.b,nf(P.b,2,'kg/s')));
bindR('#betaR','#betaL',()=>P.beta,v=>{P.beta=v;},()=>offOr(P.beta,nf(P.beta,3,'N·m·s')));
bindR('#kR','#kL',()=>rFromK(P.k),v=>{P.k=kFromR(v);rescaleE();},()=>nf(P.k,0,'N/m'));
bindR('#fillR','#fillL',()=>P.fill,v=>{P.fill=v;FL.ok=false;},()=>Math.round(P.fill*100)+'%');
bindR('#zR','#zL',()=>P.zeta,v=>{P.zeta=v;},()=>t(P.zeta<.1?'low':P.zeta<.35?'medium':'high'));
bindR('#arrowR','#arrowL',()=>P.arrow,v=>{P.arrow=v;},()=>nf(P.arrow,2)+'×');
bindR('#dAR','#dAL',()=>P.dA,v=>{P.dA=v;},()=>nf(P.dA*100,1,'cm'));
bindR('#dFR','#dFL',()=>rFromF(P.dF),v=>{P.dF=fFromR(v);},()=>{const f0=P.g>0?Math.sqrt(P.g/P.L)/TAU:0;return nf(P.dF,2,'Hz')+(f0?` (${nf(P.dF/f0,2)} f₀)`:'');});
bindR('#LBR','#LBL',()=>P.LB,v=>{P.LB=v;const p=PEN[1];if(p.polar)syncCart(p);cam.labS=null;rescaleE();},()=>nf(P.LB,2,'m'));
bindR('#mBR','#mBL',()=>P.mB,v=>{P.mB=v;rescaleE();},()=>nf(P.mB,2,'kg'));
bindR('#dR','#dL',()=>P.d,v=>{P.d=v;cam.labS=null;rescaleE();},()=>nf(P.d,2,'m'));
bindR('#kapR','#kapL',()=>P.kap,v=>{P.kap=v;rescaleE();},()=>nf(P.kap,1,'N/m'));
// planet presets: a select (5+ options, DESIGN.md §6) that follows the g slider
$('#gSel').onchange=e=>{const v=e.target.value;if(v==='')return;P.g=+v;syncBinds();rescaleE();};
syncPlanet();
segBind('#dSeg',v=>{P.dDir=v;cam.labS=null;syncG();});
segBind('#lqSeg',v=>{P.liquid=v;FL.ok=false;S.psid=0;syncSetup();if(!LY.fluid){LY.fluid=true;syncLayers();}});
segBind('#cpSeg',v=>{P.coupled=v==='spring';syncSetup();syncG();rescaleE();});
segBind('#modelSeg',v=>setModel(v));
const num=(id,d=0)=>{const v=parseNum($(id).value);return Number.isNaN(v)?d:v;};
$('#relBtn').onclick=()=>{const th=num('#th0'),v=num('#v0'),tb=num('#thB');if(S.view!=='lab')setView('lab');releaseAngle(clamp(th,-180,180),clamp(v,-30,30),clamp(tb,-180,180));};
$('#dMatch').onclick=()=>{P.dF=f0();syncBinds();toast(t('t.match',{f:nf(P.dF,3)}));};
$('#dRes').onclick=()=>{if(!LY.drive){LY.drive=true;afterLayer('drive',true);}P.dDir='h';segSet('#dSeg','h');P.dA=.01;P.dF=f0();P.c=0;P.b=0;P.beta=0;syncBinds();syncLayers();syncG();releaseAngle(0,0,0);toast(t('t.res'));};
$('#dKap').onclick=()=>{if(!LY.drive){LY.drive=true;afterLayer('drive',true);}setModel('rod');P.dDir='v';segSet('#dSeg','v');P.dA=.05;P.dF=30;P.beta=0;syncBinds();syncLayers();syncG();releaseAngle(165,0,0);toast(t('t.kap'));};
// keys (the info dialog and settings menu come from the kit)
const info=$('#info');
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||info.open||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Space'){if(e.target.closest('button'))return;e.preventDefault();setPlaying(!S.playing);}else if(e.key==='r'||e.key==='R')resetToRelease();else if(e.key==='v'||e.key==='V')setView(S.view==='lab'?'ball':'lab');});
}
export function syncPlanet(){const s=$('#gSel');const m=[...s.options].find(o=>o.value!==''&&Math.abs(+o.value-P.g)<1e-9);s.value=m?m.value:'';}
// called when the language changes: rebuild generated labels, refresh values
export function relabel(){buildLists();syncLayers();syncG();syncSetup();updateHint();syncBinds();setPlaying(S.playing);}
