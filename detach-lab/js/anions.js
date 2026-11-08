/* Animation clock, anion bunches and deflection */
'use strict';
/* ---------- animation times ---------- */
function frameTimes(frame){
  const useRel=frame==='ion'&&activeModels().includes('rel');
  const g=useRel?gamma():1;
  const end=1.2*(P.L/g)/Math.max(P.v-P.up,0.25*P.v);
  return {pre:0.12*end,end};
}
const FLOW_XMIN=-2.2;
function flowLoop(){return (1.06*P.L/gamOf(activeModels()[0])+(-FLOW_XMIN)*P.L)/P.v;}
function clockT(frame){
  if(P.flow)return frame==='ion'?P.tf%flowLoop():P.tf;
  const ft=frameTimes(frame);return -ft.pre+P.s*(ft.end+ft.pre);}
function clockStr(frame){const T=clockT(frame);return (frame==='ion'?'t′ = ':'t = ')+(T<0?'−':' ')+nfix(T,2)+' µs';}

/* ---------- anions: bunches, deflection ---------- */
const PDET=0.35,DB=0.17;               // detachment probability, bunch spacing in units of L
const hash=(j,k=0)=>{const s=Math.sin(j*12.9898+k*78.233+1.234)*43758.5453;return Math.abs(s-Math.floor(s));};
const detached=j=>P.flow?hash(j)<0.42:(j===0||hash(j)<PDET);
