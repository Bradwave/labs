// Orbit Lab · main.js
// Entry point: animation loop and start-up.

import { chaseNow, chasePar } from './chase.js';
import { H } from './core/history.js';
import { CORE } from './core/index.js';
import { drawBars } from './render/bars.js';
import { V, drawMain, readColors, resize } from './render/canvas-view.js';
import { drawPlots, drawProg } from './render/plots.js';
import { drawCam } from './render/ship-cam.js';
import { S, atEnd, burnImpulse, launch, resetFlight, stepSim, viewState } from './state.js';
import { STR } from './strings.js';
import { autoFit, bindCanvas, bindChase, bindLaunch, bindProg, bindShow, bindThrust, bindTime, segSet, setTab, syncFollow, syncPlay, syncShow, toast } from './ui/controls.js';
import { applyFeatures } from './ui/levels.js';
import { checkMission, renderMissions } from './ui/missions-ui.js';
import { bindSetup, updateChasePane, updateReadout } from './ui/panels.js';
import { loadSaved } from './ui/persist.js';
import { $, $$ } from './util.js';
export let frameN=0,lastT=performance.now();
export function loop(now){
  const dtReal=Math.min(0.1,(now-lastT)/1000);lastT=now;frameN++;
  if(S.playing){stepSim(dtReal*S.speed);if(!S.playing)syncPlay();}
  const q=viewState(),I=CORE.info(q.x,q.y,q.vx,q.vy,q.pad);
  let Io=I;
  if(S.phase==='prep'&&S.mode==='program'&&S.preview){const e=S.preview.end;Io=CORE.info(e.x,e.y,e.vx,e.vy,e.pad);}
  const K=CORE.conic(Io,(Io.type==='hyperbola'||Io.type==='parabola')?20:40);
  const E0=H.get(0),F={q,I,Io,K,cmd:q.cmd.k&&q.cmd.a>0?q.cmd:null,atEnd:atEnd()};
  F.E0=CORE.energy(E0.x,E0.y,E0.vx,E0.vy).E;
  if(V.follow){const dx=q.x-V.cx,dy=q.y-V.cy;
    if(Math.hypot(dx,dy)*V.s>60){const k=1-Math.exp(-dtReal*10);V.cx+=dx*k;V.cy+=dy*k;}else{V.cx=q.x;V.cy=q.y;}}
  drawMain(F);
  if(S.show.bars)drawBars(q);
  if(!$('#camwrap').hidden)drawCam(F,dtReal);
  updateReadout(F);
  if(S.chase.on){
    if(S.phase==='flying'&&!S.chase.res&&chaseNow(q).docked){S.chase.res={t:q.t,dv:q.dv};S.playing=false;syncPlay();toast('Docked!');}
    if($('#pane-chase').offsetParent)updateChasePane(q);
  }
  if(frameN%5===0){if($('#pane-plots').offsetParent)drawPlots();}
  if($('#pane-launch').offsetParent&&S.mode==='program'&&!$('#progBox').hidden)drawProg();
  if(frameN%8===0)checkMission();
  requestAnimationFrame(loop);
}
export function init(){
  for(const id in STR.ui){const e=$('#'+id);if(e)e.textContent=STR.ui[id];}
  $('#helpBody').innerHTML=STR.help;
  loadSaved();readColors();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',readColors);
  new MutationObserver(readColors).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  bindShow();bindChase();bindLaunch();bindProg();bindTime();bindThrust();bindSetup();bindCanvas();
  $$('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  for(const id of['helpBtn','helpBtn2'])$('#'+id).onclick=()=>$('#help').showModal();
  $('#helpClose').onclick=()=>$('#help').close();
  segSet('#speedSeg',S.speed);syncShow();syncFollow();
  resetFlight(false);applyFeatures();
  for(const el of[$('#wrap'),$('.panel')])new ResizeObserver(resize).observe(el);
  addEventListener('resize',resize);resize();autoFit();
  renderMissions();syncPlay();
  window.OrbitLab={S,H,CORE,launch,resetFlight,stepSim,burnImpulse,viewState,setTab,chaseNow,chasePar}; // handy for debugging in the console
  requestAnimationFrame(loop);
}

init();
