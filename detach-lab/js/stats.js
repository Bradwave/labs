/* Statistics tab: histograms of an isotropic sample of emissions */
'use strict';
const GOLD=0.6180339887498949;   // low-discrepancy sequence: evenly spread emission angles
function sampleSize(){return P.flow?Math.min(6000,Math.floor(P.tf*200)):2000;}
function statsRange(ms){
  let t0=Infinity,t1=0,r1=0;
  for(const m of ms)for(let a=-180;a<=180;a+=0.5){
    const f=frag(m,a*DEG);
    if(f.st==='ok'){t0=Math.min(t0,f.t);t1=Math.max(t1,f.t);r1=Math.max(r1,f.r);}
  }
  if(!isFinite(t0)){t0=0;t1=1;r1=P.R;}
  const pad=0.04*(t1-t0||1);
  return {t0:Math.max(0,t0-pad),t1:t1+pad,r1:Math.max(r1*1.05,0.1)};
}
function drawHist(cv,series,lo,hi,xlabel,bins){
  const pp=prep(cv);if(!pp)return;const {ctx,w,h}=pp;
  const padL=36,padR=10,padT=12,padB=34;
  const counts=series.map(s=>{const c=new Array(bins).fill(0);for(const x of s.vals){const i=Math.min(bins-1,Math.max(0,Math.floor((x-lo)/(hi-lo)*bins)));c[i]++;}return c;});
  const ymax=Math.max(1,...counts.flat());
  const gx=x=>padL+(x-lo)/(hi-lo)*(w-padL-padR),gy=c=>h-padB-c/ymax*(h-padT-padB);
  const sy=niceStep((h-padT-padB)/ymax,26);
  for(let c=0;c<=ymax+1e-9;c+=sy){line(ctx,padL,gy(c),w-padR,gy(c),C.grid,1);text(ctx,nf(c,0),padL-5,gy(c),C.muted,10,'right');}
  const raw=(hi-lo)/Math.max(2,Math.floor((w-padL-padR)/60)),mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const sx=[1,2,5,10].map(k=>k*mag).find(s=>s>=raw),dd=Math.max(0,-Math.floor(Math.log10(sx)+1e-9));
  for(let x=Math.ceil(lo/sx-1e-9)*sx;x<=hi+1e-9;x+=sx)text(ctx,nf(x,dd),gx(x),h-padB+11,C.muted,10,'center');
  line(ctx,padL,gy(0),w-padR,gy(0),C.muted,1.3);
  text(ctx,xlabel,w-padR,h-8,C.muted,10.5,'right');
  const bw=(w-padL-padR)/bins;
  series.forEach((s,k)=>{
    counts[k].forEach((c,i)=>{
      if(!c)return;
      const x=padL+i*bw;
      if(k===0){ctx.globalAlpha=series.length>1?0.45:0.75;ctx.fillStyle=s.col;ctx.fillRect(x+1,gy(c),bw-2,gy(0)-gy(c));ctx.globalAlpha=1;}
      ctx.strokeStyle=s.col;ctx.lineWidth=k===0?1:1.8;if(k)ctx.setLineDash([5,3]);ctx.strokeRect(x+1,gy(c),bw-2,gy(0)-gy(c));ctx.setLineDash([]);
    });
  });
}
function drawStats(){
  const ms=activeModels(),n=sampleSize(),rg=statsRange(ms);
  const series=ms.map(m=>{
    const ts=[],rs=[];
    for(let i=0;i<n;i++){const f=frag(m,(((i*GOLD)%1)*2-1)*Math.PI);if(f.st==='ok'){ts.push(f.t);rs.push(f.r);}}
    return {m,ts,rs,col:ms.length===1?C.ok:mcol(m)};
  });
  drawHist($('#cv-h'),series.map(s=>({vals:s.ts,col:s.col})),rg.t0,rg.t1,'t (µs)',24);
  drawHist($('#cv-h2'),series.map(s=>({vals:s.rs,col:s.col})),0,rg.r1,'r (cm)',24);
  const nm=m=>m==='gal'?'Galileo':'Einstein';
  const parts=series.map(s=>(ms.length>1?nm(s.m)+': ':'')+s.ts.length+' / '+n+(n?' ('+nf(100*s.ts.length/n,0)+'%)':''));
  setHTML('#stats-note',(n?_('Rivelati / emessi','Detected / emitted')+': ':_('Il campione cresce con il tempo: avvia il flusso.','The sample grows with time: start the flow.'))+(n?parts.join(' · '):''));
}
