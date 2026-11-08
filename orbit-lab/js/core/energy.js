// Orbit Lab · core/energy.js
// Energy and launch states.
export const energy=(x,y,vx,vy)=>{const K=.5*(vx*vx+vy*vy),U=-1/Math.hypot(x,y);return{K,U,E:K+U};};
export const launchState=(h,v,angDeg)=>{const a=angDeg*Math.PI/180;return{t:0,x:0,y:1+h,vx:v*Math.cos(a),vy:v*Math.sin(a),W:0,dv:0,pad:false};};
export const padState=h=>({t:0,x:0,y:1+h,vx:0,vy:0,W:0,dv:0,pad:true});
