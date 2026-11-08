/* Physics: Galilean and relativistic composition, detector model */
'use strict';
/* ---------- physics ---------- */
const cEff=()=>P.creal?CREAL:P.v/P.beta;
const gamma=()=>{const b=P.v/cEff();return 1/Math.sqrt(1-b*b);};
const umin=()=>Math.sqrt(P.Eth/KEV);
const activeModels=()=>P.model==='both'?['gal','rel']:[P.model];
const gamOf=m=>m==='rel'?gamma():1;

function frag(m,th){
  const v=P.v,up=P.up,L=P.L,ca=Math.cos(th),sa=Math.sin(th);
  let ux,uy,g=1;
  if(m==='gal'){ux=v+up*ca;uy=up*sa;}
  else{const c=cEff();g=gamma();const D=1+v*up*ca/(c*c);ux=(v+up*ca)/D;uy=up*sa/(g*D);}
  const u=Math.hypot(ux,uy),arr=ux>1e-9;
  const t=arr?L/ux:Infinity,y=arr?L*uy/ux:NaN,r=Math.abs(y);
  const tion=arr?(L/g)/(v+up*ca):Infinity;
  let st;
  if(!arr)st='back';else if(r>P.R+1e-12)st='miss';else if(u<umin())st='weak';else st='ok';
  return {ux,uy,u,arr,t,y,r,tion,ang:Math.atan2(uy,ux),st,E:KEV*u*u,g,th};
}
// lab velocity of a particle with velocity (ux1,uy1) in the ion frame
function compose(m,ux1,uy1){
  if(m==='gal')return[P.v+ux1,uy1];
  const c=cEff(),g=gamma(),D=1+P.v*ux1/(c*c);
  return[(P.v+ux1)/D,uy1/(g*D)];
}
function thmax(m){
  if(P.v<=P.up)return null;
  if(m==='gal')return Math.asin(P.up/P.v);
  return Math.atan(P.up/(gamma()*Math.sqrt(P.v*P.v-P.up*P.up)));
}
function summary(m){
  const N=2400;let tmin=Infinity,tmax=0,rmax=0,acc=0,tot=0,back=false;
  for(let i=0;i<N;i++){
    const th=(i+0.5)/N*Math.PI,w=Math.sin(th),f=frag(m,th);tot+=w;
    if(f.arr){tmin=Math.min(tmin,f.t);tmax=Math.max(tmax,f.t);rmax=Math.max(rmax,f.r);if(f.st==='ok')acc+=w;}
    else back=true;
  }
  return {thmax:thmax(m),rmax:back?Infinity:rmax,tmin,tmax:back?Infinity:tmax,frac:acc/tot,back};
}
function solveR(m,rt){
  const out=[],N=4000;let prev=null;
  for(let i=0;i<=N;i++){
    const th=i/N*Math.PI,f=frag(m,th);
    const val=f.arr?f.r-rt:null;
    if(prev&&val!==null&&prev.val!==null&&prev.val*val<0){
      let a=prev.th,b=th;
      for(let k=0;k<60;k++){const mid=(a+b)/2,fm=frag(m,mid);if((frag(m,a).r-rt)*(fm.r-rt)<=0)b=mid;else a=mid;}
      out.push(frag(m,(a+b)/2));
    }
    prev={th,val};
  }
  return out;
}
const stText=s=>({ok:_('rivelato','detected'),weak:_('sotto soglia','below threshold'),miss:_('fuori dal rivelatore','off the detector'),back:_('non arriva (x ≤ 0)','never arrives (x ≤ 0)')}[s]);
