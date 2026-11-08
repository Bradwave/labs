// Orbit Lab · core/history.js
// Flight history in typed arrays, for scrubbing and replay.

import { MAXTICKS, clamp } from './constants.js';
// History: Float64Array rows [t,x,y,vx,vy,W,dv,k,a,ang,pad]
export const HS=11;
export const H={
  buf:new Float64Array(HS*4096), n:0,
  clear(){this.n=0;},
  push(st,cmd){
    if(this.n>=MAXTICKS)return false;
    if((this.n+1)*HS>this.buf.length){const b=new Float64Array(this.buf.length*2);b.set(this.buf);this.buf=b;}
    const o=this.n*HS,b=this.buf;
    b[o]=st.t;b[o+1]=st.x;b[o+2]=st.y;b[o+3]=st.vx;b[o+4]=st.vy;b[o+5]=st.W;b[o+6]=st.dv;
    b[o+7]=cmd?cmd.k:0;b[o+8]=cmd?cmd.a:0;b[o+9]=cmd?(cmd.ang||0):0;b[o+10]=st.pad?1:0;
    this.n++;return true;
  },
  get(i){const o=clamp(i,0,this.n-1)*HS,b=this.buf;return{t:b[o],x:b[o+1],y:b[o+2],vx:b[o+3],vy:b[o+4],W:b[o+5],dv:b[o+6],cmd:{k:b[o+7],a:b[o+8],ang:b[o+9]},pad:b[o+10]===1};},
  trunc(n){this.n=Math.max(1,n);}
};
