// Pendulum Lab · main.js
// Entry point: kit (language, theme, settings, info), animation loop and start-up.
import { initKit, onLang } from '../../kit/kit.js';
import STRINGS from './strings.js';
import { periodTrack, sample } from './data.js';
import { fluidStep, liquidAdvance } from './fluid.js';
import { initInteraction, releaseAngle } from './interaction.js';
import { drawGraph, updatePeriod, updateReadout } from './panels.js';
import { cur, step } from './physics.js';
import { draw } from './render.js';
import { LY, P, S } from './state.js';
import { initUI, relabel, setModel, syncG, syncLayers, syncSetup, updateHint } from './ui.js';
import { TAU, clamp } from './util.js';
import { initView, readColors, resize } from './view.js';

// ---------- main loop ----------
let last=performance.now(),uiAcc=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  let A;
  if(S.playing&&S.held<0){
    const simT=dt*S.speed,hmax=LY.drive?Math.min(.0005,.06/(TAU*P.dF)):.0005,n=Math.min(4000,Math.max(1,Math.ceil(simT/hmax))),h=simT/n;
    for(let i=0;i<n;i++){
      A=step(h);
      if(P.liquid==='simple'&&LY.fluid)fluidStep(h,A[0].geff);
      if(P.model!=='elastic')for(const o of A)periodTrack(o,h);
      S.samp+=h;if(S.samp>=.01){S.samp=0;sample(A);}
    }
    if(P.liquid==='particles')liquidAdvance(simT,A[0].geff);
    S.flash=S.flash.map(f=>Math.max(0,f-dt*3));
    if(LY.trail)for(const o of A){o.p.trail.push([o.x,o.y]);if(o.p.trail.length>240)o.p.trail.shift();}
  }else if(S.held>=0)liquidAdvance(dt,[0,-P.g]);
  A=cur();
  const vtT=S.view==='ball'?1:0;S.vt+=clamp(vtT-S.vt,-dt/.7,dt/.7);
  const rkT=S.view==='ball'&&LY.rotate?1:0;S.rotK+=clamp(rkT-S.rotK,-dt/.6,dt/.6);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){S.vt=vtT;S.rotK=rkT;}
  draw(A);
  uiAcc+=dt;if(uiAcc>.07){uiAcc=0;updateReadout(A);updatePeriod();}
  drawGraph();
  requestAnimationFrame(frame);
}

// ---------- start ----------
export const VERSION='2.0.0';
initKit({slug:'pendulum-lab',name:'Pendulum Lab',version:VERSION,strings:STRINGS});
onLang(()=>{relabel();updatePeriod();updateReadout(cur());});
initView();initInteraction();initUI();
readColors();resize();setModel('rod');syncLayers();syncG();syncSetup();updateHint();
document.fonts&&document.fonts.ready.then(()=>{resize();});
releaseAngle(40,0,0);
{const A=cur();S.psi=Math.atan2(A[0].geff[1],A[0].geff[0]);}
requestAnimationFrame(t=>{last=t;frame(t);});
