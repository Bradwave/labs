/* Controls, language switch, animation loop, start-up */
'use strict';
/* ---------- interface ---------- */
const SL=[
  {k:'v',it:'Velocità del fascio v',en:'Beam speed v',min:1,max:40,step:0.5,unit:'10⁴ m/s',d:1},
  {k:'up',it:'Velocità del frammento u′',en:'Fragment speed u′',min:0.2,max:30,step:0.1,unit:'10⁴ m/s',d:1},
  {k:'L',it:'Distanza del rivelatore L',en:'Detector distance L',min:5,max:100,step:1,unit:'cm',d:0},
  {k:'R',it:'Raggio del rivelatore R',en:'Detector radius R',min:0.5,max:20,step:0.1,unit:'cm',d:1},
  {k:'Eth',it:'Soglia di rivelazione',en:'Detection threshold',min:0,max:30,step:0.1,unit:'keV',d:1},
];
function buildSliders(){
  $('#sliders').innerHTML=SL.map(s=>'<div class="ctl"><label for="sl-'+s.k+'"><span id="sl-l-'+s.k+'"></span><output id="o-'+s.k+'"></output></label><input type="range" id="sl-'+s.k+'" min="'+s.min+'" max="'+s.max+'" step="'+s.step+'" value="'+P[s.k]+'"></div>').join('');
  SL.forEach(s=>$('#sl-'+s.k).addEventListener('input',e=>{P[s.k]=+e.target.value;constrain();syncUI();dirty=true;eqDirty=true;}));
}
function betaFromSlider(q){const a=Math.log(0.01),b=Math.log(0.95);return Math.exp(a+(b-a)*q/1000);}
function sliderFromBeta(be){const a=Math.log(0.01),b=Math.log(0.95);return Math.round((Math.log(be)-a)/(b-a)*1000);}
function constrain(){if(!P.creal){const c=cEff();if(P.up>0.98*c)P.up=0.98*c;}}
function buildWord(el,txt){
  const pat=['k','','a','','b','','a','','b','','a','','b','','a'];
  el.innerHTML=txt.split('').map((ch,i)=>'<span class="'+(i===txt.length-1?'k fly':pat[i%pat.length])+'">'+ch+'</span>').join('');
}
function applyLang(){
  document.documentElement.lang=LANG;
  $$('[data-en]').forEach(el=>{if(el.dataset.it===undefined)el.dataset.it=el.innerHTML;el.innerHTML=LANG==='en'?el.dataset.en:el.dataset.it;});
  $$('[data-en-label]').forEach(el=>{if(el.dataset.itLabel===undefined)el.dataset.itLabel=el.getAttribute('aria-label')||'';const v=LANG==='en'?el.dataset.enLabel:el.dataset.itLabel;el.setAttribute('aria-label',v);el.title=v;});
  const wd='detach';
  buildWord($('#word'),wd);buildWord($('#dlg-word'),wd);$('#word').setAttribute('aria-label','Detach Lab');
  document.title='Detach Lab';
  SL.forEach(s=>{$('#sl-l-'+s.k).textContent=LANG==='en'?s.en:s.it;});
  $$('#seg-lang button').forEach(b=>b.classList.toggle('on',b.dataset.l===LANG));
  Object.keys(_cache).forEach(k=>delete _cache[k]);
  eqDirty=true;dirty=true;
}
function syncUI(){
  SL.forEach(s=>{$('#o-'+s.k).textContent=nf(P[s.k],s.d)+' '+s.unit;const el=$('#sl-'+s.k);if(+el.value!==P[s.k])el.value=P[s.k];});
  $('#umin-note').innerHTML=_('Soglia sulla velocità d\'impatto','Threshold on the impact speed')+': u<sub>min</sub> = '+nf(umin(),2)+' ×10⁴ m/s (E = ½mu², m = 127 u).';
  $('#creal').setAttribute('aria-pressed',P.creal);
  $('#beta').disabled=P.creal;$('#beta').value=sliderFromBeta(P.beta);
  const c=cEff(),b=P.v/c;
  $('#beta-o').textContent=P.creal?sci(b,1):nf(b,2);
  $('#c-note').innerHTML=P.creal?'γ − 1 = '+sci(gamma()-1,1)+_('. Con c reale i due modelli differiscono di meno di una parte su un milione.','. With the real c the two models differ by less than one part in a million.'):
    _('c ridotta = ','reduced c = ')+sci(c*1e4,2)+' m/s, γ = '+nf(gamma(),3)+_('. Valore didattico, non la vera velocità della luce.','. A teaching value, not the real speed of light.');
  $('#th').value=P.th/DEG;$('#th-o').textContent=nf(P.th/DEG,1)+'°';
  $('#th-tan').disabled=P.v<=P.up;
  $$('#seg-model button').forEach(b=>b.classList.toggle('on',b.dataset.m===P.model));
  $$('#seg-frame button').forEach(b=>b.classList.toggle('on',b.dataset.f===P.frame&&!P.split));
  $$('#seg-spd button').forEach(b=>b.classList.toggle('on',+b.dataset.v===P.speed));
  $$('#seg-setup button').forEach(b=>b.classList.toggle('on',b.dataset.s===P.setup));
  $$('#quick .lg').forEach(b=>b.classList.toggle('on',!!P[b.dataset.q]));
  $('#zoomv').classList.toggle('on',P.zoom);
  const hint=$('#hint');
  if(P.model!=='gal'&&P.creal)hint.innerHTML='<span class="chip">'+_('Con c reale i modelli coincidono','With the real c the models coincide')+' <button class="btn" id="hint-btn">'+_('Riduci c','Reduce c')+'</button></span>';
  else hint.innerHTML='';
  const hb=$('#hint-btn');if(hb)hb.addEventListener('click',()=>{P.creal=false;P.beta=0.5;constrain();syncUI();dirty=true;eqDirty=true;});
  $('#rm-o').textContent=nf(P.rm,1)+' cm';
  $('#vel-title').textContent=P.frame==='lab'?_('Velocità nel laboratorio: u = v + u′','Velocity in the lab: u = v + u′'):_('Velocità nello ione','Velocity in the ion frame');
  $('#cv-b').hidden=!P.split;
  $('#playIcon').textContent=P.playing?'pause':'play_arrow';$('#playLbl').textContent=P.playing?_('Pausa','Pause'):_('Avvia','Play');
  $('#play').setAttribute('aria-label',P.playing?_('Pausa','Pause'):_('Avvia','Play'));
  $('#tl').value=Math.round(P.s*1000);$('#tl').disabled=P.flow;
  saveHash();
}
function setTh(a){
  while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;
  P.th=a;$('#th').value=a/DEG;$('#th-o').textContent=nf(a/DEG,1)+'°';dirty=true;saveHash();
}
const PBASE={v:10,up:2,L:30,R:4,Eth:5,creal:true,beta:0.5,model:'gal',flow:false,fan:true,partner:true,exag:true,anions:true,split:false,frame:'lab'};
const PRESETS={
  cone:{},
  slow:{v:1,up:2,R:10,Eth:0},
  small:{R:1.5,Eth:0},
  thr:{v:10,up:3,R:6,Eth:25},
  rel:{v:10,up:5,R:6,Eth:0,creal:false,beta:0.6,model:'both'},
  stream:{v:10,up:4,R:6,Eth:0,flow:true,fan:false,partner:false,split:true},
};
let dirty=true,eqDirty=true,last=0,hold=0;
function draw(){
  readColors();
  if(P.split){drawSpace($('#cv-a'),'lab');drawSpace($('#cv-b'),'ion');}
  else drawSpace($('#cv-a'),P.frame);
  $('#clock').textContent=clockStr(P.split?'lab':P.frame);
  if(!P.flow){const sv=Math.round(P.s*1000);if(+$('#tl').value!==sv)$('#tl').value=sv;}
  if(P.tab==='vel'){drawVel($('#cv-v'));renderReadout();renderSummary();}
  else if(P.tab==='eq'){drawEq($('#cv-e'));drawEqT($('#cv-e2'));}
  else if(P.tab==='stats')drawStats();
  if(P.pick)renderPick();
}
function tick(ts){
  if(!last)last=ts;const dt=Math.min(0.1,(ts-last)/1000);last=ts;
  if(P.playing&&P.flow){P.tf+=dt*P.speed*0.18*frameTimes('lab').end;dirty=true;}
  else if(P.playing){
    if(hold>0){hold-=dt;if(hold<=0)P.s=0;}
    else{P.s+=dt*P.speed/9;if(P.s>=1){P.s=1;hold=1;}}
    dirty=true;
  }
  if(P.tab==='eq'&&eqDirty){eqRender();eqDirty=false;dirty=true;}
  if(dirty){dirty=false;draw();}
  requestAnimationFrame(tick);
}
function bind(){
  $$('#seg-model button').forEach(b=>b.addEventListener('click',()=>{P.model=b.dataset.m;syncUI();dirty=true;eqDirty=true;}));
  $$('#seg-frame button').forEach(b=>b.addEventListener('click',()=>{P.frame=b.dataset.f;P.split=false;syncUI();dirty=true;}));
  $$('#seg-spd button').forEach(b=>b.addEventListener('click',()=>{P.speed=+b.dataset.v;syncUI();}));
  $$('#seg-setup button').forEach(b=>b.addEventListener('click',()=>{P.setup=b.dataset.s;syncUI();dirty=true;}));
  $$('#quick .lg').forEach(b=>b.addEventListener('click',()=>{P[b.dataset.q]=!P[b.dataset.q];if(b.dataset.q==='flow'){P.pick=null;renderPick();}syncUI();dirty=true;}));
  $('#zoomv').addEventListener('click',()=>{P.zoom=!P.zoom;syncUI();dirty=true;});
  $('#creal').addEventListener('click',()=>{P.creal=!P.creal;constrain();syncUI();dirty=true;eqDirty=true;});
  $('#beta').addEventListener('input',e=>{P.beta=betaFromSlider(+e.target.value);constrain();syncUI();dirty=true;eqDirty=true;});
  $('#th').addEventListener('input',e=>setTh(+e.target.value*DEG));
  $$('[data-th]').forEach(b=>b.addEventListener('click',()=>{
    const d=b.dataset.th;
    if(d==='tan'){if(P.v>P.up)setTh(Math.acos(-P.up/P.v));}else setTh(+d*DEG);
  }));
  $('#play').addEventListener('click',()=>{P.playing=!P.playing;if(P.playing&&P.s>=1){P.s=0;hold=0;}syncUI();});
  $('#stepBtn').addEventListener('click',()=>{P.playing=false;hold=0;if(P.flow)P.tf+=0.25;else P.s=Math.min(1,P.s+0.02);syncUI();dirty=true;});
  $('#resetBtn').addEventListener('click',()=>{P.s=0;P.tf=0;hold=0;syncUI();dirty=true;});
  $('#tl').addEventListener('input',e=>{P.playing=false;hold=0;P.s=+e.target.value/1000;syncUI();dirty=true;});
  $('#rm').addEventListener('input',e=>{P.rm=+e.target.value;$('#rm-o').textContent=nf(P.rm,1)+' cm';eqDirty=true;});
  $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{Object.assign(P,PBASE,PRESETS[b.dataset.preset]);P.pick=null;renderPick();P.s=0;P.tf=0;hold=0;P.playing=true;constrain();syncUI();dirty=true;eqDirty=true;}));
  $$('.tab').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
  const dlg=$('#help');
  ['#helpBtn','#helpBtn2','#helpBtn3'].forEach(id=>$(id).addEventListener('click',()=>dlg.showModal()));
  $('#helpClose').addEventListener('click',()=>dlg.close());
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  $$('#seg-lang button').forEach(b=>b.addEventListener('click',()=>{
    LANG=b.dataset.l;try{localStorage.setItem('detach-lab.lang',LANG);}catch(e){}
    applyLang();syncUI();
  }));
  const cv=$('#cv-v');let drag=false;
  cv.addEventListener('pointerdown',e=>{drag=true;cv.setPointerCapture(e.pointerId);velPointer(e,cv);});
  cv.addEventListener('pointermove',e=>{if(drag)velPointer(e,cv);});
  cv.addEventListener('pointerup',()=>{drag=false;});
  cv.addEventListener('pointercancel',()=>{drag=false;});
  cv.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setTh(P.th-2*DEG);e.preventDefault();}
    if(e.key==='ArrowRight'||e.key==='ArrowUp'){setTh(P.th+2*DEG);e.preventDefault();}
  });
  document.addEventListener('keydown',e=>{
    if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||dlg.open)return;
    if(e.key===' '){e.preventDefault();$('#play').click();}
    else if(e.key==='r'||e.key==='R')$('#resetBtn').click();
  });
  window.addEventListener('resize',()=>{dirty=true;});
  if(window.ResizeObserver){const ro=new ResizeObserver(()=>{dirty=true;});$$('canvas').forEach(c=>ro.observe(c));}
  if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{dirty=true;});
  new MutationObserver(()=>{dirty=true;}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
}
function tab(t){
  P.tab=t;
  $('#pane-vel').hidden=t!=='vel';$('#pane-setup').hidden=t!=='setup';$('#pane-eq').hidden=t!=='eq';$('#pane-stats').hidden=t!=='stats';
  $$('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $('#layout').classList.toggle('wide',t==='eq');
  eqDirty=true;dirty=true;saveHash();
}
function renderPick(){
  const el=$('#pick');
  if(!P.pick){el.hidden=true;return;}
  const f=frag(P.pick.m,P.pick.thx),nm=P.model==='both'?(P.pick.m==='gal'?' · Galileo':' · Einstein'):'';
  el.hidden=false;
  const h='<span><b>θ′ = '+nf(P.pick.thx/DEG,1)+'°</b> · t = '+nf(f.t,2)+' µs · r = '+nf(f.r,2)+' cm · E = '+nf(f.E,1)+' keV · '+stText(f.st)+nm+'</span><button class="x" aria-label="'+_('Chiudi','Close')+'">×</button>';
  if(el._h!==h){el._h=h;el.innerHTML=h;el.querySelector('.x').addEventListener('click',()=>{P.pick=null;renderPick();dirty=true;});}
}
function bindPick(){
  ['cv-a','cv-b'].forEach(id=>{
    const c=document.getElementById(id);
    c.addEventListener('click',e=>{
      const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      let best=null,bd=16*16;
      (HITS[id]||[]).forEach(q=>{const d=(q.x-x)**2+(q.y-y)**2;if(d<bd){bd=d;best=q;}});
      P.pick=best?{m:best.m,thx:best.thx,j:best.j}:null;
      if(best&&best.j===null)setTh(best.thx);
      renderPick();dirty=true;
    });
  });
  $$('[data-share]').forEach(b=>b.addEventListener('click',()=>copyLink(b)));
}
loadHash();P.pick=null;
buildSliders();bind();bindPick();applyLang();tab(P.tab);syncUI();
requestAnimationFrame(tick);
