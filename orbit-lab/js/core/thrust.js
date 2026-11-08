// Orbit Lab · core/thrust.js
// Thrust direction and thrust programs (piecewise linear a(t), theta(t)).
// ---- dynamics ----
// cmd: {k:0 none,1 prograde,2 retro,3 out,4 in,5 angle from vertical (toward the clockwise tangent), a: magnitude, ang: radians}
export function thrustAcc(x,y,vx,vy,cmd){
  if(!cmd||!cmd.k||!cmd.a) return [0,0];
  const r=Math.hypot(x,y)||1e-12, rx=x/r, ry=y/r, hx=ry, hy=-rx;
  let ux,uy;
  switch(cmd.k){
    case 1:case 2:{const v=Math.hypot(vx,vy);if(v>1e-9){ux=vx/v;uy=vy/v;}else{ux=hx;uy=hy;} if(cmd.k===2){ux=-ux;uy=-uy;} break;}
    case 3:ux=rx;uy=ry;break;
    case 4:ux=-rx;uy=-ry;break;
    default:{const c=Math.cos(cmd.ang),s=Math.sin(cmd.ang);ux=c*rx+s*hx;uy=c*ry+s*hy;}
  }
  return [cmd.a*ux,cmd.a*uy];
}
// Thrust program: piecewise-linear a(u), theta(u), u = t / burn in [0,1]. Pts: [[u,val],...]
export function interp(pts,u){
  if(u<=pts[0][0])return pts[0][1]; const n=pts.length;
  if(u>=pts[n-1][0])return pts[n-1][1];
  for(let i=1;i<n;i++)if(u<=pts[i][0]){const a=pts[i-1],b=pts[i],f=(u-a[0])/((b[0]-a[0])||1);return a[1]+f*(b[1]-a[1]);}
  return pts[n-1][1];
}
export function progCmd(prog,t){
  if(t>=prog.burn)return null;
  const u=t/prog.burn;
  return{k:5,a:Math.max(0,interp(prog.a,u)),ang:interp(prog.th,u)*Math.PI/180};
}
