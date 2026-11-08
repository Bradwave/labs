// Orbit Lab · ui/missions-ui.js
// Missions panel: predict, run, explain, goal checks.

import { chaseNow, chasePar } from '../chase.js';
import { CORE } from '../core/index.js';
import { MISSIONS } from '../data/missions.js';
import { V } from '../render/canvas-view.js';
import { S, launch, resetFlight, viewState } from '../state.js';
import { autoFit, segSet, setTab, startChase, syncChaseUI, syncLaunchUI, syncPlay, syncShow, toast, updateCamVisibility } from './controls.js';
import { setLevel } from './levels.js';
import { DONE, persist } from './persist.js';
import { $ } from '../util.js';
// What the missions' checks see
export function missionCtx(){
  const q=viewState();
  const inf=CORE.info(q.x,q.y,q.vx,q.vy,q.pad);
  return{chase:{on:S.chase.on,res:S.chase.res,now:S.chase.on?chaseNow(q):null,par:S.chase.on?chasePar():null},runs:S.runs,info:inf,vc:CORE.vc(S.h),sim:{t:q.t,dv:q.dv,h:S.h,vFirstBurn:S.vFirstBurn,crashed:S.crashed,launchH:S.launchH,mode:S.launchMode||S.mode}};
}
/* ---- missions: predict, observe, explain ---- */
export let M={id:0,choice:-1,stage:'predict'};
export function applySetup(m){
  const su=m.setup;
  if(m.level>S.level){setLevel(m.level);toast('Switched to level '+m.level+' for this mission');}
  S.chase.on=false;S.chase.res=null;
  if(su.chase){S.chase.lead=su.lead;syncChaseUI();S.h=su.h;startChase();if(su.tab)setTab(su.tab);return;}
  S.mode=su.mode;S.h=su.h;S.v=su.v==='vc'?Math.round(CORE.vc(su.h)*100)/100:su.v;S.ang=su.ang||0;
  if(su.v==='vc')S.v=Math.min(1.6,CORE.vc(su.h));
  S.runs=[];S.ghosts=[];
  if(su.cam){S.show.cam=true;syncShow();updateCamVisibility();}
  resetFlight(false);syncLaunchUI();V.userView=false;autoFit();
  if(su.launch){launch();S.speed=1;segSet('#speedSeg',1);}
  syncPlay();if(su.tab)setTab(su.tab);
}
export function renderMissions(){
  const box=$('#misList');box.innerHTML='';
  MISSIONS.forEach(m=>{
    const open=M.id===m.id,d=document.createElement('div');d.className='mis'+(DONE.has(m.id)?' done':'');
    d.innerHTML=`<header tabindex="0" role="button" aria-expanded="${open}"><span class="n">${DONE.has(m.id)?'✓':m.id}</span><span>${m.title}</span><span class="lv">L${m.level}</span></header>`;
    const hd=d.firstChild;hd.onclick=()=>{M=open?{id:0,choice:-1,stage:'predict'}:{id:m.id,choice:-1,stage:'predict'};renderMissions();};
    hd.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hd.click();}};
    if(open){
      const b=document.createElement('div');b.className='body';
      if(M.stage==='predict'){
        b.innerHTML=`<p><b>Predict.</b> ${m.q}</p>`;
        m.opts.forEach((o,i)=>{const bt=document.createElement('button');bt.className='opt';bt.textContent=o;bt.onclick=()=>{M.choice=i;M.stage='run';applySetup(m);renderMissions();};b.appendChild(bt);});
      }else{
        const ok=M.choice===m.correct;
        b.innerHTML=`<p class="note">Your prediction: ${m.opts[M.choice]}</p><div class="goal ${M.stage==='explain'?'ok':''}">${M.stage==='explain'?'Goal reached. ':'Goal: '}${m.goal}</div>`;
        if(M.stage==='run'){
          b.insertAdjacentHTML('beforeend',`<p class="note">Hint: ${m.hint}</p>`);
          const r=document.createElement('div');r.className='row';
          r.innerHTML='<button class="btn" id="mSet"><span class="ms">restart_alt</span>Set up again</button><button class="btn" id="mShow"><span class="ms">visibility</span>Show explanation</button>';b.appendChild(r);
          r.firstChild.onclick=()=>applySetup(m);r.lastChild.onclick=()=>{M.stage='explain';renderMissions();};
        }else{
          b.insertAdjacentHTML('beforeend',`<p><b>${ok?'Your prediction was right.':'Not quite.'}</b> The answer is: ${m.opts[m.correct]}.</p><div class="expl"><b>Explain.</b> ${m.explain}</div><p class="note">In your own words: why does the orbit behave like this? Compare with what you predicted.</p>`);
          const bt=document.createElement('button');bt.className='btn';bt.innerHTML='<span class="ms">replay</span>Try again';bt.onclick=()=>{M.stage='run';applySetup(m);renderMissions();};b.appendChild(bt);
        }
      }
      d.appendChild(b);
    }
    box.appendChild(d);
  });
}
export function checkMission(){
  if(M.stage!=='run'||!M.id)return;
  const m=MISSIONS.find(x=>x.id===M.id);if(!m)return;
  let ok=false;try{ok=m.check(missionCtx());}catch(e){}
  if(ok&&S.phase==='flying'||ok&&m.id>=4&&S.runs.length){ // goal needs a launch (or its preview)
    if(S.phase!=='flying')return;
    M.stage='explain';DONE.add(m.id);renderMissions();persist();toast('Goal reached: '+m.title);
  }
}
