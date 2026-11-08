// Orbit Lab · ui/controls.js
// Launch, time, thruster, display and chase controls; canvas pan and zoom.

import { clamp } from '../core/constants.js';
import { H } from '../core/history.js';
import { CORE } from '../core/index.js';
import { V, cv, fitView, resize, s2w } from '../render/canvas-view.js';
import { PGS, pgX, pgY } from '../render/plots.js';
import { S, atEnd, burnImpulse, feat, launch, planetInfo, resetFlight, setCursor, stepSim, viewState } from '../state.js';
import { STR } from '../strings.js';
import { persist } from './persist.js';
import { $, $$ } from '../util.js';
/* ============================== UI: controls ============================== */
export let toastT=0;
export function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2000);}
export function segBind(id,fn){$$(id+' button').forEach(b=>b.onclick=()=>{fn(b.dataset.v,b);});}
export function segSet(id,v){$$(id+' button').forEach(x=>x.classList.toggle('on',x.dataset.v===String(v)));}
/* ---- launch controls ---- */
export function hText(){
  const p=planetInfo(),b=S.h.toFixed(2)+' R';
  return p.R?b+' ≈ '+Math.round(S.h*p.R).toLocaleString('en')+' km':b;
}
export function syncLaunchUI(){
  const set=(id,v)=>{const e=$('#'+id);if(document.activeElement!==e)e.value=v;};
  set('hR',S.h);set('hN',S.h.toFixed(2));set('vR',S.v);set('vN',S.v.toFixed(2));set('aR',S.ang);set('aN',Math.round(S.ang));set('bR',S.prog.burn);
  $('#hL').textContent=hText();
  const num=feat('numbers'),p=planetInfo();
  $('#vL').textContent=num?S.v.toFixed(2)+(feat('realUnits')&&p.R?' ≈ '+(S.v*p.v0).toFixed(2)+' km/s':''):'';
  $('#aL').textContent=num?Math.round(S.ang)+'°':'';
  $('#bL').textContent=S.prog.burn.toFixed(1);
  segSet('#modeSeg',S.mode);
  $('#cannonBox').hidden=S.mode!=='cannon';$('#progBox').hidden=S.mode!=='program';
  $('#hNote').textContent=STR.tower;
  $('#launchLbl').textContent=S.phase==='prep'?'Launch':'Relaunch';
  buildMarks();
  $('#hNote').textContent=S.h<=0.0001?'At h = 0 any launch above the horizontal falls back to the ground.':STR.tower;
}
export function buildMarks(){
  const box=$('#vMarks');box.innerHTML='';
  const items=[['v꜀(h)',CORE.vc(S.h)],['v_esc(h)',CORE.vesc(S.h)]];
  for(const [name,v] of items){
    const pos=(v/1.6)*100;
    const i=document.createElement('i');i.style.left=pos+'%';box.appendChild(i);
    const em=document.createElement('em');em.className='snap';em.style.left=pos+'%';em.textContent=name+(feat('numbers')?' '+v.toFixed(2):'');
    em.title='Click to set the speed to '+name;em.onclick=()=>{S.v=Math.round(v*100)/100;if(Math.abs(S.v-v)<0.005)S.v=v;launchChanged();};
    em.style.pointerEvents='auto';box.appendChild(em);
  }
  // keep the two labels from overlapping
  const ems=$$('em',box);if(ems.length===2){const a=CORE.vc(S.h)/1.6,b=CORE.vesc(S.h)/1.6;ems[0].style.transform=(b-a<.3)?'translateX(-100%)':'translateX(-50%)';}
}
export function launchChanged(){
  S.h=clamp(+S.h||0,S.chase.on?0.1:0,1.5);S.v=clamp(+S.v||0,0,1.6);S.ang=clamp(+S.ang||0,-10,90);
  if(S.chase.on){S.v=CORE.vc(S.h);S.ang=0;S.mode='cannon';}
  resetFlight(S.phase==='flying');syncLaunchUI();if(S.phase==='prep'&&!V.userView)autoFit();persist();
}
export function autoFit(){const q=viewState(),I=CORE.info(q.x,q.y,q.vx,q.vy,q.pad),src=(S.preview&&S.mode==='program')?S.preview.end:q;
  const I2=CORE.info(src.x,src.y,src.vx,src.vy,src.pad);fitView(I2,CORE.conic(I2,8));}
export function bindLaunch(){
  const rng=(id,key,cb)=>{$(id).oninput=()=>{S[key]=+$(id).value;cb&&cb();launchChanged();};};
  rng('#hR','h');rng('#vR','v');rng('#aR','ang');
  const num=(id,key)=>{$(id).onchange=$(id).oninput=()=>{const v=parseFloat($(id).value);if(isFinite(v)){S[key]=v;launchChanged();}};};
  num('#hN','h');num('#vN','v');num('#aN','ang');
  segBind('#hPre',v=>{S.h=+v;launchChanged();});segBind('#aPre',v=>{S.ang=+v;launchChanged();});
  $$('#vFine button').forEach(b=>b.onclick=()=>{S.v=Math.round((S.v+ +b.dataset.d)*1000)/1000;launchChanged();});
  segBind('#modeSeg',v=>{S.mode=v;launchChanged();});
  $('#bR').oninput=()=>{S.prog.burn=+$('#bR').value;launchChanged();};
  $('#launchBtn').onclick=()=>{launch();syncPlay();syncLaunchUI();setTab('launch',true);};
  $('#resetBtn2').onclick=doReset;
}
export function doReset(){resetFlight(true);syncPlay();syncLaunchUI();if(!V.userView)autoFit();}
/* ---- program editors ---- */
export function bindProg(){
  for(const k in PGS){
    const p=PGS[k],cvs=$('#'+p.id);let drag=-1;
    const pos=e=>{const r=cvs.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    const valAt=y=>clamp(p.hi-(y-8)/(cvs.clientHeight-24)*(p.hi-p.lo),p.lo+(k==='a'?5:0),p.hi);
    const find=(x,y)=>{const pts=S.prog[p.key];let best=-1,bd=18;pts.forEach((q,i)=>{const d=Math.hypot(pgX(cvs,q[0])-x,pgY(cvs,p,q[1])-y);if(d<bd){bd=d;best=i;}});return best;};
    cvs.onpointerdown=e=>{const [x,y]=pos(e);drag=find(x,y);if(drag>=0){cvs.setPointerCapture(e.pointerId);e.preventDefault();}};
    cvs.onpointermove=e=>{if(drag<0)return;const [x,y]=pos(e),pts=S.prog[p.key];
      let v=clamp(p.hi-(y-8)/(cvs.clientHeight-24)*(p.hi-p.lo),p.lo,p.hi);if(k==='a')v=Math.max(0,v);else v=clamp(v,0,90);
      pts[drag][1]=Math.round(v*(k==='a'?20:1))/(k==='a'?20:1);
      if(drag>0&&drag<pts.length-1){const u=clamp((x-14)/(cvs.clientWidth-26),pts[drag-1][0]+.02,pts[drag+1][0]-.02);pts[drag][0]=u;}
      S.preview&&0;launchChanged();};
    cvs.onpointerup=cvs.onpointercancel=e=>{if(drag<0)return;const [x,y]=pos(e),pts=S.prog[p.key];
      if(pts.length>2&&drag>0&&drag<pts.length-1&&(y<-14||y>cvs.clientHeight+14)){pts.splice(drag,1);launchChanged();}
      drag=-1;persist();};
    cvs.ondblclick=e=>{const [x,y]=pos(e),pts=S.prog[p.key],u=clamp((x-14)/(cvs.clientWidth-26),.03,.97);
      if(find(x,y)>=0)return;pts.push([u,k==='a'?Math.round(valAt(y)*20)/20:Math.round(valAt(y))]);pts.sort((a,b)=>a[0]-b[0]);launchChanged();};
  }
}
/* ---- tabs, play, time ---- */
export function setTab(t){
  $$('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $$('.tabpane').forEach(p=>p.hidden=p.id!=='pane-'+t);resize();
}
export function syncPlay(){
  const p=S.playing;$('#playIcon').textContent=p?'pause':'play_arrow';$('#playLbl').textContent=p?'Pause':'Play';$('#playBtn').setAttribute('aria-label',p?'Pause':'Play');
}
export function togglePlay(){
  if(S.phase==='prep'){launch();syncPlay();syncLaunchUI();return;}
  if(S.crashed&&atEnd()){toast('The ship has landed. Reset, or drag the scrubber back.');return;}
  S.playing=!S.playing;S.acc=0;syncPlay();
}
export function bindTime(){
  $('#playBtn').onclick=togglePlay;
  $('#resetBtn').onclick=doReset;
  $('#stepBtn').onclick=()=>{
    if(S.phase==='prep'){toast('Press Launch first.');return;}
    S.playing=false;syncPlay();
    if(S.cur<H.n-1)S.cur=Math.min(H.n-1,S.cur+10);else stepSim(0.1+1e-9);
  };
  segBind('#speedSeg',v=>{S.speed=+v;segSet('#speedSeg',v);persist();});
  $('#scrub').oninput=()=>{setCursor(+$('#scrub').value);syncPlay();};
  $('#fitBtn').onclick=()=>{V.userView=false;V.follow=false;syncFollow();autoFit();};
  $('#followBtn').onclick=()=>{V.follow=!V.follow;if(V.follow)V.userView=true;syncFollow();};
  segBind('#viewSeg',v=>{V.main=v;segSet('#viewSeg',v);$('#wrap').classList.toggle('shipmain',v==='ship');updateCamVisibility();resize();});
}
export function syncFollow(){$('#followBtn').setAttribute('aria-pressed',V.follow);$('#followBtn').classList.toggle('on',V.follow);}
export function updateCamVisibility(){
  const show=feat('shipcam')&&(S.show.cam||V.main==='ship');
  $('#camwrap').hidden=!show;$('#camwrap').classList.toggle('big',V.main==='ship');
  if(!feat('shipcam')&&V.main==='ship'){V.main='planet';$('#wrap').classList.remove('shipmain');segSet('#viewSeg','planet');}
  resize();
}
/* ---- thrusters (hold = burn, click = fixed step) ---- */
export const KEYS={pro:1,retro:2,out:3,in:4};
export const thr={timers:{},down:{},burning:{}};
export function thrStart(k){
  if(thr.down[k])return;
  if(S.phase!=='flying'){toast('Launch first, then use the thrusters.');return;}
  if(S.crashed&&atEnd())return;
  thr.down[k]=true;thr.burning[k]=false;
  thr.timers[k]=setTimeout(()=>{if(thr.down[k]){thr.burning[k]=true;if(S.cur<H.n-1)H.trunc(S.cur+1);S.hold=KEYS[k];S.playing=true;S.acc=0;syncPlay();}},230);
  $(`[data-k="${k}"]`).classList.add('held');
}
export function thrEnd(k){
  if(!thr.down[k])return;
  clearTimeout(thr.timers[k]);thr.down[k]=false;$(`[data-k="${k}"]`).classList.remove('held');
  if(thr.burning[k]){if(S.hold===KEYS[k])S.hold=0;thr.burning[k]=false;}
  else if(!burnImpulse(KEYS[k]))toast('No Δv available here.');
}
export function bindThrust(){
  $$('#thrGrid .btn').forEach(b=>{const k=b.dataset.k;
    b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);thrStart(k);};
    b.onpointerup=b.onpointercancel=()=>thrEnd(k);
    b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)thrStart(k);}};
    b.onkeyup=e=>{if(e.key==='Enter'||e.key===' ')thrEnd(k);};});
  $('#tlR').oninput=()=>{S.level_tl=+$('#tlR').value;$('#tlL').textContent=S.level_tl.toFixed(2);};
  segBind('#dvSeg',v=>{S.dvStep=+v;segSet('#dvSeg',v);});
  $('#bgR').oninput=()=>{S.budget=+$('#bgR').value;$('#bgL').textContent=S.budget>=2?'∞':S.budget.toFixed(2);};
  $('#tlL').textContent=S.level_tl.toFixed(2);$('#bgL').textContent='∞';
  const keymap={w:'pro',s:'retro',d:'out',a:'in'};
  addEventListener('keydown',e=>{
    if(e.target.matches&&e.target.matches('input[type=number],textarea,select'))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const key=e.key.toLowerCase();
    if(keymap[key]){if(!e.repeat&&(key!=='d'&&key!=='a'||feat('radial'))){e.preventDefault();thrStart(keymap[key]);}}
    else if(e.key===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();togglePlay();}
    else if(key==='r'){doReset();}
    else if(key==='f'){$('#fitBtn').click();}
  });
  addEventListener('keyup',e=>{const k=keymap[e.key.toLowerCase()];if(k)thrEnd(k);});
  addEventListener('blur',()=>{for(const k in KEYS)thrEnd(k);});
}
/* ---- show toggles ---- */
export const SHOWS=[
  ['Representations',[['vel','Velocity','vel','Green arrow, tangent to the path'],['grav','Gravity acceleration','grav','Blue arrow, always toward the centre'],['thr','Thrust','thr','Magenta arrow while a thruster burns'],['net','Net acceleration','net','Dashed arrow, gravity plus thrust'],['labels','Numbers on arrows','net','Needs the numeric level','numbers'],['bars','Energy bars','kin','K, U and E']]],
  ['Picture',[['orbit','Predicted orbit','c-ellipse','Dashed conic from the current state'],['trail','Trail','muted'],['ghosts','Ghost trails of earlier attempts','muted'],['nog','No-gravity ghost','muted','Where the ship would be without gravity: the gap is the fall'],['grid','Grid in units of R','muted'],['cam','Ship cam','vel','Inset with the view from the ship']]],
  ['Kepler tools',[['strobe','Strobe copies','kin','Ship at equal time steps','kepler'],['wedge','Equal-area wedges','pot','Regions swept in equal times','kepler']]]
];
export const QUICK=[['vel','Velocity','vel'],['grav','Gravity','grav'],['thr','Thrust','thr'],['net','Net','net'],['orbit','Orbit','c-ellipse'],['nog','No gravity','muted'],['cam','Ship cam','vel']];
export function bindShow(){
  const list=$('#showList');list.innerHTML='';
  for(const [grp,items] of SHOWS){
    const h=document.createElement('h3');h.className='grp';h.textContent=grp;list.appendChild(h);
    for(const [k,label,col,sub,ft] of items){
      const b=document.createElement('button');b.className='tg';b.dataset.show=k;if(ft)b.dataset.feat=ft;
      b.innerHTML='<span class="sw'+(['trail','ghosts','grid','cam','orbit','bars','nog','strobe','wedge'].includes(k)?' dot':'')+'" style="color:var(--'+col+');background:'+(['trail','ghosts','grid','cam','orbit','bars','nog','strobe','wedge'].includes(k)?'var(--'+col+')':'none')+'"></span><span class="txt">'+label+(sub?'<small>'+sub+'</small>':'')+'</span><span class="box"></span>';
      b.onclick=()=>{S.show[k]=!S.show[k];syncShow();if(k==='cam')updateCamVisibility();persist();};
      list.appendChild(b);
    }
  }
  const q=$('#quick');q.innerHTML='';
  for(const [k,label,col] of QUICK){
    const b=document.createElement('button');b.className='lg';b.dataset.show=k;b.innerHTML=(['vel','grav','thr','net'].includes(k)?'<span class="vs" style="color:var(--'+col+')"></span>':'')+label;
    if(k==='cam')b.dataset.feat='shipcam';
    b.onclick=()=>{S.show[k]=!S.show[k];syncShow();if(k==='cam')updateCamVisibility();persist();};q.appendChild(b);
  }
  segBind('#sclSeg',v=>{S.scale=v;segSet('#sclSeg',v);persist();});
  $('#kepR').oninput=()=>{S.kep=+$('#kepR').value;$('#kepL').textContent=S.kep.toFixed(1);};$('#kepL').textContent=S.kep.toFixed(1);
  $('#clearGhost').onclick=()=>{S.ghosts=[];toast('Ghost trails cleared');};
}
export function syncShow(){
  $$('[data-show]').forEach(b=>{const on=!!S.show[b.dataset.show];b.setAttribute('aria-pressed',on);b.classList.toggle('on',on);});
  $('#ebars').hidden=!S.show.bars;segSet('#sclSeg',S.scale);
}
/* ---- rendezvous panel ---- */
export function startChase(){
  S.chase.on=true;S.mode='cannon';S.h=clamp(S.h,0.1,1.5);S.v=CORE.vc(S.h);S.ang=0;
  resetFlight(S.phase==='flying');syncLaunchUI();V.userView=false;autoFit();launch();syncPlay();syncLaunchUI();
}
export function syncChaseUI(){
  $('#leadR').value=Math.abs(S.chase.lead);
  $('#leadL').textContent=feat('numbers')?Math.abs(S.chase.lead)+'°':'';
  segSet('#sideSeg',S.chase.lead>=0?1:-1);
}
export function bindChase(){
  $('#leadR').oninput=()=>{const sg=S.chase.lead>=0?1:-1;S.chase.lead=sg*(+$('#leadR').value);syncChaseUI();if(S.chase.on){resetFlight(S.phase==='flying');if(!V.userView)autoFit();}persist();};
  segBind('#sideSeg',v=>{S.chase.lead=(+v)*Math.abs(S.chase.lead);syncChaseUI();if(S.chase.on){resetFlight(S.phase==='flying');if(!V.userView)autoFit();}persist();});
  $('#chaseStart').onclick=startChase;
  $('#chaseExit').onclick=()=>{S.chase.on=false;S.chase.res=null;resetFlight(true);syncLaunchUI();syncPlay();};
  $('#chHintBtn').onclick=()=>{const h=$('#chHint');h.hidden=!h.hidden;};
  $('#chHint').textContent=STR.chase.hint;
  syncChaseUI();
}
/* ============================== MAIN LOOP & INTERACTION ============================== */
export function bindCanvas(){
  const ptrs=new Map();let lastD=0;
  const zoomAt=(sx,sy,f)=>{const b=s2w(sx,sy);V.s=clamp(V.s*clamp(f,.5,2),8,1500);const a=s2w(sx,sy);V.cx+=b[0]-a[0];V.cy+=b[1]-a[1];V.userView=true;};
  cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.offsetX,e.offsetY]);cv.classList.add('held');lastD=0;};
  cv.onpointermove=e=>{
    if(!ptrs.has(e.pointerId))return;const prev=ptrs.get(e.pointerId),cur=[e.offsetX,e.offsetY];ptrs.set(e.pointerId,cur);
    if(ptrs.size===1){V.cx-=(cur[0]-prev[0])/V.s;V.cy+=(cur[1]-prev[1])/V.s;V.userView=true;if(V.follow){V.follow=false;syncFollow();}}
    else if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastD>0)zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,d/lastD);lastD=d;}
  };
  cv.onpointerup=cv.onpointercancel=e=>{ptrs.delete(e.pointerId);if(!ptrs.size)cv.classList.remove('held');lastD=0;};
  cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.offsetX,e.offsetY,Math.exp(-(e.deltaMode===1?e.deltaY*33:e.deltaY)*.0015));},{passive:false});
}
