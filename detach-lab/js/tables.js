/* Readout table and summary */
'use strict';
/* ---------- tables ---------- */
const _cache={};
function setHTML(sel,h){if(_cache[sel]!==h){_cache[sel]=h;$(sel).innerHTML=h;}}
function renderReadout(){
  const ms=activeModels(),fs=ms.map(m=>frag(m,P.th)),both=ms.length===2;
  const rows=[
    ['u<sub>x</sub>',f=>nf(f.ux,3),'rel','ux'],
    ['u<sub>y</sub>',f=>nf(f.uy,3),'rel','uy'],
    ['|u|',f=>nf(f.u,3),'rel','u'],
    ['E (keV)',f=>nf(f.E,3),'rel','E'],
    [_('θ nel lab (°)','θ in lab (°)'),f=>nf(f.ang/DEG,3),'abs','ang'],
    [_('t lab (µs)','t lab (µs)'),f=>f.arr?nf(f.t,4):'∞','rel','t'],
    ['r (cm)',f=>f.arr?nf(f.r,3):'—','rel','r'],
    [_('t′ ione (µs)','t′ ion (µs)'),f=>f.arr?nf(f.tion,4):'∞','rel','tion'],
  ];
  let h='<table class="tbl"><thead><tr><th>θ′ = '+nf(P.th/DEG,1)+'°</th>';
  ms.forEach(m=>h+='<th class="'+(m==='gal'?'g':'r')+'">'+(m==='gal'?'Galileo':'Einstein')+'</th>');
  if(both)h+='<th>Δ '+_('rel.','rel.')+'</th>';
  h+='</tr></thead><tbody>';
  rows.forEach(rw=>{
    h+='<tr><td>'+rw[0]+'</td>';
    fs.forEach(f=>h+='<td>'+rw[1](f)+'</td>');
    if(both){
      const a=fs[0][rw[3]],b=fs[1][rw[3]];
      let d='—';
      if(isFinite(a)&&isFinite(b))d=rw[2]==='rel'?relD(a,b):smart((b-a)/DEG)+'°';
      h+='<td>'+d+'</td>';
    }
    h+='</tr>';
  });
  h+='<tr><td>'+_('Esito','Outcome')+'</td>';
  fs.forEach(f=>h+='<td class="st-'+f.st+'">'+stText(f.st)+'</td>');
  if(both)h+='<td></td>';
  h+='</tr></tbody></table>';
  setHTML('#readout',h);
}
function renderSummary(){
  const ms=activeModels(),ss=ms.map(summary),both=ms.length===2;
  const rows=[
    ['θmax (°)',s=>s.thmax==null?'—':nf(s.thmax/DEG,3),(a,b)=>a.thmax==null?'—':smart((b.thmax-a.thmax)/DEG)+'°'],
    [_('r massimo (cm)','max r (cm)'),s=>nf(s.rmax,3),(a,b)=>relD(a.rmax,b.rmax)],
    [_('t minimo (µs)','min t (µs)'),s=>nf(s.tmin,4),(a,b)=>relD(a.tmin,b.tmin)],
    [_('t massimo (µs)','max t (µs)'),s=>nf(s.tmax,4),(a,b)=>relD(a.tmax,b.tmax)],
    [_('Frammenti rivelati (%)','Fragments detected (%)'),s=>nf(s.frac*100,2),(a,b)=>relD(a.frac,b.frac)],
  ];
  let h='<table class="tbl"><thead><tr><th></th>';
  ms.forEach(m=>h+='<th class="'+(m==='gal'?'g':'r')+'">'+(m==='gal'?'Galileo':'Einstein')+'</th>');
  if(both)h+='<th>Δ '+_('rel.','rel.')+'</th>';
  h+='</tr></thead><tbody>';
  rows.forEach(rw=>{
    h+='<tr><td>'+rw[0]+'</td>';
    ss.forEach(s=>h+='<td>'+rw[1](s)+'</td>');
    if(both)h+='<td>'+rw[2](ss[0],ss[1])+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table>';
  setHTML('#summary',h);
}
