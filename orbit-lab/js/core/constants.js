// Orbit Lab · core/constants.js
// Constants and small pure helpers. Units: mu = GM = 1, planet radius R = 1.
export const TAU=Math.PI*2, R=1;
export const TOL={circ:1e-4,parab:2e-3,radial:1e-7,crash:1e-7,K:0.004};
export const vc=h=>1/Math.sqrt(1+h), vesc=h=>Math.SQRT2*vc(h);
export const wrapPi=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;};
/* ============================== SIM (state, history, stepping) ============================== */
export const TICK=0.01, MAXTICKS=600000;
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
