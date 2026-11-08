// Pendulum Lab · panels.js
// Readout box, graphs (versus time and phase plot), period table, CSV export.
import { DATA, VARS, gSel, phone, vAv, vl } from './data.js';
import { LY, P, PEN, S, coupled } from './state.js';
import { $, DEG, TAU, fmt, mag, nf } from './util.js';
import { t, getLang } from '../../kit/kit.js';
import { C, dpr, gctx, gcv } from './view.js';

// ---------- readouts ----------
export function updateReadout(A){
  const el=$('#readout');el.hidden=!LY.readout;if(!LY.readout)return;
  const o=A[0],ball=S.view==='ball';
  const tStr=o.slack&&o.T===0?`<b>${t('ro.slack')}</b>`:o.T<0?`<b>${t('ro.push',{v:fmt(-o.T)+' N'})}</b>`:`<b>${fmt(o.T)} N</b>`;
  let h=`<span>t</span><b>${nf(S.t,2,'s')}</b><span>θ</span><b>${nf(o.th*DEG,1)}°</b>`;
  if(!ball)h+=`<span>|v|</span><b>${nf(o.sp,2,'m/s')}</b>`;
  h+=`<span>${ball?t('ro.frame'):'|a|'}</span><b>${nf(mag(o.a),2,'m/s²')}</b><span>T</span>${tStr}`;
  if(ball){const ge=mag(o.geff);h+=`<span class="wide">g − a</span><b class="wide">${nf(ge,2,'m/s²')}</b><span>${t('ro.felt')}</span><b>${P.g>0?nf(ge/P.g,2,'g'):'—'}</b>`;}
  if(P.model==='elastic')h+=`<span>r</span><b>${nf(o.r,3,'m')}</b>`;
  if(LY.phone){const f=phone(o);h+=`<span>${t('ro.phone')}</span><b>x ${nf(f[0],2)} y ${nf(f[1],2)}</b>`;}
  if(A[1])h+=`<span>θ B</span><b>${nf(A[1].th*DEG,1)}°</b>`;
  if(ball)h+=`<span class="full">W+T+D${coupled()?'+Fs':''}−ma = 0</span>`;
  if(S.held>=0)h+=`<span class="full">${t('ro.held')}</span>`;
  else if(!S.playing)h+=`<span class="full">${t('ro.paused')}</span>`;
  el.innerHTML=h;
}

// ---------- graphs ----------
export const G={mode:'time',win:10,phR:{a:1,b:1}};
export function drawGraph(){
  if($('#pane-graphs').hidden)return;
  const w=gcv.clientWidth,h=gcv.clientHeight;if(w<20)return;
  const g=gctx;g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=C.surface;g.fillRect(0,0,w,h);g.font='10px "Space Mono",monospace';
  const T=DATA.t;
  if(!T.length){g.fillStyle=C.muted;g.textAlign='center';g.fillText(t('gr.empty'),w/2,h/2);g.textAlign='left';return;}
  const tEnd=T[T.length-1],tStart=Math.max(0,tEnd-G.win);
  let i0;{let lo=0,hi=T.length-1;while(lo<hi){const m=(lo+hi)>>1;if(T[m]<tStart)lo=m+1;else hi=m;}i0=lo;}
  if(G.mode==='phase'){drawPhase(g,w,h,i0);return;}
  const sel=VARS.filter(v=>gSel.has(v.k)&&vAv(v));
  if(!sel.length){g.fillStyle=C.muted;g.textAlign='center';g.fillText(t('gr.pick'),w/2,h/2);g.textAlign='left';return;}
  const padL=8,padR=44,axisH=16,sh=(h-axisH)/sel.length,t0=Math.max(0,tEnd-G.win),t1=tEnd<G.win?G.win:tEnd;
  const X=t=>padL+(t-t0)/(t1-t0)*(w-padL-padR);
  sel.forEach((v,si)=>{
    const arr=DATA[v.k],y0=si*sh,yb=y0+sh;
    let mn=Infinity,mx=-Infinity;for(let i=i0;i<arr.length;i++){if(arr[i]<mn)mn=arr[i];if(arr[i]>mx)mx=arr[i];}
    if(mn>0)mn=0;if(mx<0)mx=0;if(mx-mn<1e-6){mx+=1;}
    const pad=(mx-mn)*.12;mx+=pad;if(mn<0)mn-=pad;
    const Y=val=>yb-6-(val-mn)/(mx-mn)*(sh-20);
    g.strokeStyle=C.gridline;g.lineWidth=1;g.beginPath();g.moveTo(padL,Y(0)+.5);g.lineTo(w-padR,Y(0)+.5);g.stroke();
    if(si>0){g.strokeStyle=C.ink;g.beginPath();g.moveTo(0,y0+.5);g.lineTo(w,y0+.5);g.stroke();}
    const col=C[v.c]||C.ink;g.strokeStyle=col;g.lineWidth=2;g.beginPath();
    for(let i=i0;i<arr.length;i++){const x=X(T[i]),y=Y(arr[i]);i===i0?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();
    const last=arr[arr.length-1];g.fillStyle=col;g.beginPath();g.arc(X(T[T.length-1]),Y(last),3.5,0,TAU);g.fill();
    g.font='700 11px "Space Mono",monospace';g.fillText(`${vl(v)}  ${fmt(last)} ${v.u}`,padL+2,y0+13);
    g.font='9px "Space Mono",monospace';g.fillStyle=C.muted;g.fillText(fmt(mx-pad,1),w-padR+4,Y(mx-pad)+3);if(mn<0)g.fillText(fmt(mn+pad,1),w-padR+4,Y(mn+pad)+3);g.fillText('0',w-padR+4,Y(0)+3);
  });
  g.strokeStyle=C.ink;g.lineWidth=1.5;g.beginPath();g.moveTo(padL,h-axisH+.5);g.lineTo(w-padR,h-axisH+.5);g.stroke();
  g.fillStyle=C.muted;g.font='9px "Space Mono",monospace';g.textAlign='center';
  const stepT=G.win<=5?1:G.win<=10?2:5;for(let t=Math.ceil(t0/stepT)*stepT;t<=t1;t+=stepT){const x=X(t);g.fillRect(x,h-axisH,1,4);g.fillText(nf(t,0)+' s',x,h-3);}
  g.textAlign='left';
}
export function drawPhase(g,w,h,i0){
  const sets=[[DATA.th,DATA.om,C.acc]];if(LY.two)sets.push([DATA.thB,DATA.om,C.ball2]);
  const A=DATA.th,B=DATA.om;let ma=0,mb=0;for(let i=i0;i<A.length;i++){ma=Math.max(ma,Math.abs(A[i]));mb=Math.max(mb,Math.abs(B[i]));}
  G.phR.a=Math.max(G.phR.a*.995,ma*1.15,5);G.phR.b=Math.max(G.phR.b*.995,mb*1.15,.2);
  const cx=w/2,cy=h/2,X=v=>cx+v/G.phR.a*(w/2-14),Y=v=>cy-v/G.phR.b*(h/2-14);
  g.strokeStyle=C.gridline;g.lineWidth=1;g.beginPath();g.moveTo(8,cy);g.lineTo(w-8,cy);g.moveTo(cx,8);g.lineTo(cx,h-8);g.stroke();
  g.fillStyle=C.muted;g.font='10px "Space Mono",monospace';g.fillText(t('gr.phaseX'),w-62,cy-6);g.fillText(t('gr.phaseY'),cx+6,14);
  g.fillText(`±${fmt(G.phR.a,0)}°`,w-50,cy+14);g.fillText(`±${fmt(G.phR.b)}`,cx+6,h-8);
  g.lineWidth=2;
  for(let i=i0+1;i<A.length;i++){if(Math.abs(A[i]-A[i-1])>180)continue;g.globalAlpha=.25+.75*(i-i0)/(A.length-i0);g.strokeStyle=C.acc;g.beginPath();g.moveTo(X(A[i-1]),Y(B[i-1]));g.lineTo(X(A[i]),Y(B[i]));g.stroke();}
  g.globalAlpha=1;const n=A.length-1;g.fillStyle=C.ink;g.beginPath();g.arc(X(A[n]),Y(B[n]),4,0,TAU);g.fill();
}
export function agm(a,b){for(let i=0;i<30;i++){const an=(a+b)/2;b=Math.sqrt(a*b);a=an;}return a;}
export function updatePeriod(){
  const el=$('#ptable');let h='';
  const row=(name,small,val)=>`<tr><td>${name}${small?`<small>${small}</small>`:''}</td><td>${val}</td></tr>`;
  if(P.model==='elastic'){el.innerHTML=row(t('pt.elastic'),t('pt.elasticS'),'—');return;}
  const per=p=>p.cross.length>1?p.cross[p.cross.length-1].t-p.cross[p.cross.length-2].t:null;
  const pa=PEN[0],last=per(pa),amp=pa.cross.length?pa.cross[pa.cross.length-1].amp:0;
  const T0=P.g>0?TAU*Math.sqrt(P.L/P.g):Infinity,Tex=amp>0&&amp<Math.PI-.01?T0/agm(1,Math.cos(amp/2)):null;
  h+=row(t('pt.measured')+(LY.two?' A':''),t('pt.measuredS'),last?nf(last,3,'s'):'—')
    +row(t('pt.amp'),'',amp?nf(amp*DEG,1)+'°':'—')
    +row(t('pt.small'),'',isFinite(T0)?nf(T0,3,'s'):'—')
    +row(t('pt.exact'),t('pt.exactS'),Tex?nf(Tex,3,'s'):'—');
  if(LY.two){const lb=per(PEN[1]),T0B=P.g>0?TAU*Math.sqrt(P.LB/P.g):Infinity;
    h+=row(t('pt.measB'),'',lb?nf(lb,3,'s'):'—')+row(t('pt.smallB'),'',isFinite(T0B)?nf(T0B,3,'s'):'—');
    if(coupled()&&Math.abs(P.L-P.LB)<1e-9&&Math.abs(P.m-P.mB)<1e-9&&P.g>0){
      const w1=Math.sqrt(P.g/P.L),w2=Math.sqrt(P.g/P.L+2*P.kap/P.m);
      h+=row(t('pt.modes'),t('pt.modesS'),`${nf(TAU/w1,3,'s')} · ${nf(TAU/w2,3,'s')}`)
        +row(t('pt.beat'),t('pt.beatS'),w2>w1?nf(TAU/(w2-w1),2,'s'):'—');}
  }
  if(LY.drive){const f0=P.g>0?Math.sqrt(P.g/P.L)/TAU:0;h+=row(t('pt.drive'),t('pt.driveS',{f:nf(f0,3,'Hz')}),`${nf(P.dF,2,'Hz')} · ${f0?nf(P.dF/f0,2):'—'} f₀`);}
  el.innerHTML=h;
}
// CSV for spreadsheets: in Italian ';' as separator and decimal comma, so it opens directly in Excel (DESIGN.md §10)
export function csv(){
  const it=getLang()==='it',sep=it?';':',',num=x=>it?String(x).replace('.',','):String(x);
  const vs=VARS.filter(vAv),head=['t (s)',...vs.map(v=>`${vl(v)} (${v.u})`)].map(s=>`"${s}"`).join(sep);
  const rows=DATA.t.map((tt,i)=>[num(tt.toFixed(3)),...vs.map(v=>num(+DATA[v.k][i].toPrecision(6)))].join(sep));
  return head+'\n'+rows.join('\n');
}
