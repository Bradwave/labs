// Orbit Lab · ui/levels.js
// Level selection and feature switches.

import { S, feat } from '../state.js';
import { STR } from '../strings.js';
import { segSet, syncLaunchUI, updateCamVisibility } from './controls.js';
import { persist } from './persist.js';
import { buildTeacher } from './teacher.js';
import { $, $$ } from '../util.js';
/* ---- features / level ---- */
export function applyFeatures(){
  $$('[data-feat]').forEach(el=>{el.hidden=!feat(el.dataset.feat);});
  for(const id of['gPlanet','plSeg','plNote'])$('#'+id).hidden=!feat('realUnits');
  if(S.mode==='program'&&!feat('program')){S.mode='cannon';}
  segSet('#lvSeg',S.level);$('#lvNote').textContent=STR.lv[S.level-1];
  syncLaunchUI();buildTeacher();updateCamVisibility();
}
export function setLevel(l){S.level=l;S.ovr={};applyFeatures();persist();}
