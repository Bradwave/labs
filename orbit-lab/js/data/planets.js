// Orbit Lab · data/planets.js
// Real-planet presets (display only).
/* ============================== DATA ============================== */
export const PLANETS=[
  {id:'none',name:'None'},
  {id:'earth',name:'Earth',R:6371,GM:398600.4},
  {id:'moon',name:'Moon',R:1737.4,GM:4902.8},
  {id:'mars',name:'Mars',R:3389.5,GM:42828.4}
];

for(const p of PLANETS){ if(p.R){p.v0=Math.sqrt(p.GM/p.R);p.tau=p.R/p.v0;} };
