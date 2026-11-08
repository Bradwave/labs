// Pendulum Lab · state.js
// Parameters (P), visibility switches (LY), simulation state (S) and the two pendulums (PEN).
// ---------- parameters, layers, state ----------
export const P={model:'rod',g:9.81,m:1,L:1,k:150,c:0,b:0,beta:0,fill:.5,zeta:.12,arrow:1,liquid:'simple',
  LB:1,mB:1,d:.8,kap:6,coupled:true,dDir:'h',dA:.05,dF:.5};
export const LY={vel:true,speed:false,acc:false,accComp:false,trail:false,
  W:true,R:true,D:true,S:true,net:false,decomp:false,polygon:false,values:true,
  ropeEnds:false,support:false,earth:false,pairs:true,
  app:true,appComp:false,frameAcc:true,geff:false,rotate:false,
  phone:false,phoneG:true,
  fluid:true,readout:true,energy:true,ropeColor:true,grid:true,
  two:false,drive:false};
export const S={t:0,tOff:0,Ed:0,Wd:0,playing:true,speed:1,view:'lab',vt:0,rotK:0,
  psi:-Math.PI/2,psid:0,rip:0,held:-1,flash:[0,0],rel:null,Escale:1,samp:0};
export const mkP=i=>({i,polar:true,th:0,om:0,x:0,y:-1,vx:0,vy:0,cross:[],amp:0,lastPhi:0,trail:[]});
export const PEN=[mkP(0),mkP(1)];
export const Lp=i=>i?P.LB:P.L,Mp=i=>i?P.mB:P.m;
export const act=()=>LY.two?PEN:[PEN[0]];
export const coupled=()=>LY.two&&P.coupled;
