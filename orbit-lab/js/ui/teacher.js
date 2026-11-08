// Orbit Lab · ui/teacher.js
// Teacher panel: switch single features on or off.

import { FEAT_NAMES, LEVEL_FEATS } from '../data/levels.js';
import { S, feat } from '../state.js';
import { applyFeatures } from './levels.js';
import { persist } from './persist.js';
import { $ } from '../util.js';
export function buildTeacher(){
  const box=$('#teachList');box.innerHTML='';
  for(const k of Object.keys(FEAT_NAMES)){
    const b=document.createElement('button');b.className='tg';b.setAttribute('aria-pressed',feat(k));
    b.innerHTML='<span class="txt">'+FEAT_NAMES[k]+'<small>from level '+LEVEL_FEATS[k]+'</small></span><span class="box"></span>';
    b.onclick=()=>{const on=!feat(k);const def=S.level>=LEVEL_FEATS[k];if(on===def)delete S.ovr[k];else S.ovr[k]=on;applyFeatures();persist();};
    box.appendChild(b);
  }
}
