/* Shareable setups: the state lives in the URL hash */
'use strict';
const HKEYS={v:'n',up:'n',L:'n',R:'n',Eth:'n',beta:'n',rm:'n',creal:'b',split:'b',anions:'b',fan:'b',partner:'b',exag:'b',flow:'b',model:'s',frame:'s',setup:'s',tab:'s'};
const HENUM={model:['gal','rel','both'],frame:['lab','ion'],setup:['real','simple'],tab:['vel','setup','eq','stats']};
function stateToHash(){
  const q=[];
  for(const k in HKEYS){const t=HKEYS[k];q.push(k+'='+(t==='b'?(P[k]?1:0):(t==='n'?+(+P[k]).toFixed(4):P[k])));}
  q.push('th='+(+(P.th/DEG).toFixed(2)));q.push('lang='+LANG);
  return q.join('&');
}
function loadHash(){
  const h=(location.hash||'').replace(/^#/,'');if(!h)return;
  const lim={v:[1,40],up:[0.2,30],L:[5,100],R:[0.5,20],Eth:[0,30],beta:[0.01,0.95],rm:[0.5,15]};
  h.split('&').forEach(kv=>{
    const [k,val]=kv.split('=');
    if(k==='lang'){if(val==='en'||val==='it')LANG=val;return;}
    if(k==='th'){const x=parseFloat(val);if(isFinite(x))P.th=x*DEG;return;}
    const t=HKEYS[k];if(!t)return;
    if(t==='b')P[k]=val==='1';
    else if(t==='n'){const x=parseFloat(val);if(isFinite(x))P[k]=Math.min(lim[k][1],Math.max(lim[k][0],x));}
    else if(HENUM[k].includes(val))P[k]=val;
  });
}
let _hT=0;
function saveHash(){
  clearTimeout(_hT);
  _hT=setTimeout(()=>{try{history.replaceState(null,'','#'+stateToHash());}catch(e){}},250);
}
function copyLink(btn){
  const url=location.href.split('#')[0]+'#'+stateToHash();
  const ok=()=>{const ic=btn.querySelector('.ms');if(ic){const o='link';ic.textContent='check';setTimeout(()=>{ic.textContent=o;},1500);}};
  const fallback=()=>{const t=document.createElement('textarea');t.value=url;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();try{document.execCommand('copy');ok();}catch(e){}t.remove();};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(ok,fallback);else fallback();
}
