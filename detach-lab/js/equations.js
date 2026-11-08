/* Equations tab (cards, MathJax) */
'use strict';
/* ---------- equations ---------- */
function intervalsAccepted(){
  const v=P.v,u=P.up,L=P.L,Rr=P.R;
  const k=Rr/L,a=1+k*k,D=u*u*a-k*k*v*v;
  let segs=[[v-u,v+u]];
  let xm=null,xp=null;
  if(D>0){
    const sq=Math.sqrt(D);xm=(v-sq)/a;xp=(v+sq)/a;
    segs=[[v-u,Math.min(xm,v+u)],[Math.max(xp,v-u),v+u]].filter(s=>s[1]-s[0]>1e-9);
  }
  const xth=(umin()**2+v*v-u*u)/(2*v);
  segs=segs.map(s=>[Math.max(s[0],xth),s[1]]).filter(s=>s[1]-s[0]>1e-9);
  return {segs,xm,xp,xth,D,k,a};
}
function eqRender(){
  const v=P.v,u=P.up,L=P.L,Rr=P.R,rm=P.rm;
  const T=tx,N=nf,ok=v>u;
  let h='';
  const card=(t,b)=>'<div class="eqcard"><h3>'+t+'</h3>'+b+'</div>';
  h+=card(_('1 · Il luogo delle velocità','1 · The locus of velocities'),
   '<p>'+_(R`Nel laboratorio $\vec u=\vec v+\vec u'$, quindi $u'_x=x-v$ e $u'_y=y$. Imporre $|\vec u'|=u'$ dà la circonferenza`,
           R`In the lab $\vec u=\vec v+\vec u'$, so $u'_x=x-v$ and $u'_y=y$. Imposing $|\vec u'|=u'$ gives the circle`)+'</p>'+
   R`$$(x-v)^2+y^2=u'^2\;\Longrightarrow\;y=\sqrt{${T(u*u,3)}-(x-${T(v)})^2}.$$`+
   '<p>'+_(R`Il frammento esiste solo per $v-u'\le x\le v+u'$, cioè $${T(v-u)}\le x\le ${T(v+u)}$. L'estremo sinistro corrisponde all'emissione all'indietro lungo l'asse del fascio, quello destro all'emissione in avanti: in entrambi i casi $y=0$.`,
           R`The fragment exists only for $v-u'\le x\le v+u'$, that is $${T(v-u)}\le x\le ${T(v+u)}$. The left end is emission backwards along the beam axis, the right end is emission forwards: in both cases $y=0$.`)+'</p>');
  h+=card(_('2 · Tempo di volo e distanza dall\'asse','2 · Time of flight and distance from the axis'),
   '<p>'+_(R`Con $x$ in $10^4$ m/s e $L$ in cm il tempo esce in µs, perché $10^4$ m/s $=1$ cm/µs. Il frammento percorre $L$ lungo $x$ in`,
           R`With $x$ in $10^4$ m/s and $L$ in cm the time comes out in µs, because $10^4$ m/s $=1$ cm/µs. The fragment covers $L$ along $x$ in`)+'</p>'+
   R`$$t=\frac{L}{x},\qquad r=y\,t=\frac{L\,y}{x}.$$`+
   (ok?'<p>'+_(R`Il tempo minimo si ha per $x=v+u'$ e il massimo per $x=v-u'$:`,R`The minimum time is for $x=v+u'$ and the maximum for $x=v-u'$:`)+'</p>'+
     R`$$t_{\min}=\frac{${T(L,0)}}{${T(v+u)}}=${T(L/(v+u),3)}\ \mu s,\qquad t_{\max}=\frac{${T(L,0)}}{${T(v-u)}}=${T(L/(v-u),3)}\ \mu s.$$`
   :'<p>'+_(R`Qui $v\le u'$: esistono frammenti con $x\le0$ che non raggiungono mai il rivelatore, quindi non c'è un tempo massimo.`,
            R`Here $v\le u'$: some fragments have $x\le0$ and never reach the detector, so there is no maximum time.`)+'</p>'));
  {
    const k=rm/L,a=1+k*k,D=u*u*a-k*k*v*v;
    let b='<p>'+_(R`Un frammento colpisce il rivelatore a distanza $r=${T(rm,1)}$ cm dall'asse. Da $r=Ly/x$ segue $y=kx$ con $k=r/L=${T(k,4)}$. Sostituendo nella circonferenza:`,
                  R`A fragment hits the detector at distance $r=${T(rm,1)}$ cm from the axis. From $r=Ly/x$ we get $y=kx$ with $k=r/L=${T(k,4)}$. Substituting into the circle:`)+'</p>'+
     R`$$(x-v)^2+k^2x^2=u'^2\;\Longrightarrow\;(1+k^2)x^2-2vx+v^2-u'^2=0.$$`+
     R`$$${T(a,4)}\,x^2-${T(2*v)}\,x+${T(v*v-u*u,3)}=0\;\Longrightarrow\;x=\frac{v\pm\sqrt{u'^2(1+k^2)-k^2v^2}}{1+k^2}.$$`;
    if(D<0){
      b+='<p>'+_(R`Il discriminante è negativo: nessun frammento arriva a $r=${T(rm,1)}$ cm. La distanza massima possibile è $r_{\max}=Lu'/\sqrt{v^2-u'^2}$`,
                 R`The discriminant is negative: no fragment reaches $r=${T(rm,1)}$ cm. The largest possible distance is $r_{\max}=Lu'/\sqrt{v^2-u'^2}$`)+(ok?R`$=${T(L*u/Math.sqrt(v*v-u*u),3)}$ cm`:'')+'.</p>';
    }else{
      const sq=Math.sqrt(D),xs=D<1e-12?[v/a]:[(v+sq)/a,(v-sq)/a];
      b+='<p>'+_(R`Con i dati il radicando vale $${T(D,4)}$ e le soluzioni sono`,R`With these data the radicand is $${T(D,4)}$ and the solutions are`)+'</p><div class="tblwrap"><table><tr><th></th><th>x</th><th>y = kx</th><th>t = L/x (µs)</th><th>(x−v)² + y²</th></tr>';
      xs.forEach((x,i)=>{const y=k*x;b+='<tr><th>'+_('soluzione ','solution ')+(i+1)+'</th><td>'+N(x,3)+'</td><td>'+N(y,3)+'</td><td>'+N(L/x,3)+'</td><td>'+N((x-v)**2+y*y,3)+'</td></tr>';});
      b+='</table></div><p>'+_(R`L'ultima colonna vale $u'^2=${T(u*u,3)}$ per entrambe, quindi le soluzioni sono corrette. `,R`The last column equals $u'^2=${T(u*u,3)}$ for both, so the solutions are correct. `)+
         (xs.length>1?_('Sono due frammenti diversi, emessi in direzioni diverse, che arrivano sullo stesso anello a tempi diversi: il tempo di volo dice quale dei due è stato rivelato.','They are two different fragments, emitted in different directions, that land on the same ring at different times: the time of flight tells which of the two was detected.'):_('Le due soluzioni coincidono: è il frammento più lontano dall\'asse.','The two solutions coincide: this is the fragment farthest from the axis.'))+'</p>';
    }
    const rs=solveR('rel',rm);
    if(P.model!=='gal'||!P.creal){
      b+='<p>'+_(R`Con la composizione relativistica ($c=${sci(cEff()*1e4,2)}$ m/s) le soluzioni, trovate numericamente, sono `,R`With the relativistic composition ($c=${sci(cEff()*1e4,2)}$ m/s) the solutions, found numerically, are `)+
        (rs.length?rs.map(f=>'$x='+T(f.ux,4)+'$ ($t='+T(f.t,4)+'$ µs)').join(_(' e ',' and ')):_('assenti: con questa c la distanza massima dall\'asse scende a ','absent: with this c the largest distance from the axis drops to ')+N(summary('rel').rmax,2)+' cm')+'.</p>';
    }
    h+=card(_('3 · Dato r, quanto vale x?','3 · Given r, what is x?'),b);
  }
  {
    const um=umin(),xth=(um*um+v*v-u*u)/(2*v);
    let b='<p>'+_('Il modulo nel laboratorio, usando la circonferenza, è','The speed in the lab, using the circle, is')+'</p>'+
     R`$$u^2=x^2+y^2=2vx+u'^2-v^2=${T(2*v)}\,x${u*u-v*v>=0?'+':'-'}${T(Math.abs(u*u-v*v),3)}.$$`+
     '<p>'+_(R`Per iodio (127 u) $E=\tfrac12mu^2\approx0{,}0658\,u^2$ keV con $u$ in $10^4$ m/s. La soglia di ${N(P.Eth,1)} keV richiede $u\ge u_{\min}=${T(um,2)}$, cioè`,
             R`For iodine (127 u) $E=\tfrac12mu^2\approx0.0658\,u^2$ keV with $u$ in $10^4$ m/s. The ${N(P.Eth,1)} keV threshold requires $u\ge u_{\min}=${T(um,2)}$, that is`)+'</p>'+
     R`$$x\ge\frac{u_{\min}^2+v^2-u'^2}{2v}=${T(xth,3)}.$$`;
    if(xth<=v-u)b+='<p>'+_(R`Il limite è sotto $v-u'$: la soglia non esclude alcun frammento.`,R`The limit is below $v-u'$: the threshold excludes no fragment.`)+'</p>';
    else if(xth>v+u)b+='<p>'+_(R`Il limite è sopra $v+u'$: nessun frammento supera la soglia.`,R`The limit is above $v+u'$: no fragment passes the threshold.`)+'</p>';
    else b+='<p>'+_(R`Restano esclusi i frammenti con $${T(v-u)}\le x&lt;${T(xth,3)}$, cioè quelli emessi all'indietro o quasi.`,R`The fragments with $${T(v-u)}\le x&lt;${T(xth,3)}$ are excluded, that is those emitted backwards or nearly so.`)+'</p>';
    h+=card(_('4 · Soglia di energia d\'impatto','4 · Impact energy threshold'),b);
  }
  {
    let b;
    if(!ok)b='<p>'+_(R`Per $v\le u'$ la costruzione con una sola disuguaglianza non vale: ci sono frammenti che non arrivano mai.`,R`For $v\le u'$ the single-inequality construction does not hold: some fragments never arrive.`)+'</p>';
    else{
      const I=intervalsAccepted();
      b='<p>'+_(R`La condizione $r\le R$ con $R=${T(Rr,1)}$ cm vale, con $y\ge0$, $y\le\frac RLx$. Elevando al quadrato (entrambi i membri sono positivi) si ottiene la disequazione`,
                R`The condition $r\le R$ with $R=${T(Rr,1)}$ cm reads, with $y\ge0$, $y\le\frac RLx$. Squaring (both sides are positive) gives the inequality`)+'</p>'+
       R`$$(1+k^2)x^2-2vx+v^2-u'^2\ge0,\qquad k=\frac RL=${T(Rr/L,4)}.$$`;
      if(I.D<=0)b+='<p>'+_('Il discriminante è non positivo: la disequazione vale per ogni $x$, perché $R\\ge r_{\\max}$. Il rivelatore raccoglie tutti i frammenti (soglia a parte).','The discriminant is not positive: the inequality holds for every $x$, because $R\\ge r_{\\max}$. The detector collects all the fragments (threshold aside).')+'</p>';
      else b+='<p>'+_(R`Le radici sono $x_-=${T(I.xm,3)}$ e $x_+=${T(I.xp,3)}$; la disequazione è verificata per $x\le x_-$ oppure $x\ge x_+$. I frammenti con $x_-&lt;x&lt;x_+$ cadono fuori.`,
                      R`The roots are $x_-=${T(I.xm,3)}$ and $x_+=${T(I.xp,3)}$; the inequality holds for $x\le x_-$ or $x\ge x_+$. Fragments with $x_-&lt;x&lt;x_+$ fall outside.`)+'</p>';
      b+='<p>'+_('Insieme alla soglia: ','Together with the threshold: ')+(I.segs.length?_('rivelati per ','detected for ')+I.segs.map(s=>'$'+T(s[0],3)+'\\le x\\le'+T(s[1],3)+'$').join(_(' e ',' and ')):_('nessun frammento è rivelato','no fragment is detected'))+'.</p>';
    }
    h+=card(_('5 · Il rivelatore ha raggio R','5 · The detector has radius R'),b);
  }
  {
    let b;
    if(!ok)b='<p>'+_(R`Per $v\le u'$ non c'è un frammento più lontano: ci sono frammenti che non arrivano mai.`,R`For $v\le u'$ there is no farthest fragment: some fragments never arrive.`)+'</p>';
    else{
      const q=Math.sqrt(v*v-u*u),Rm=L*u/q,xs=(v*v-u*u)/v,ys=u*q/v;
      b='<p>'+_(R`L'equazione $r=R$ è di secondo grado in $x$, con discriminante $\Delta/4=u'^2(1+k^2)-k^2v^2$. Ha soluzione se $\Delta\ge0$, cioè`,
                R`The equation $r=R$ is quadratic in $x$, with discriminant $\Delta/4=u'^2(1+k^2)-k^2v^2$. It has a solution if $\Delta\ge0$, that is`)+'</p>'+
       R`$$R\le R_{\min}=\frac{L\,u'}{\sqrt{v^2-u'^2}}=${T(Rm,3)}\ \text{cm}.$$`+
       '<p>'+_(R`Per $R=R_{\min}$ la soluzione è unica: è il frammento più lontano dall'asse, con`,R`For $R=R_{\min}$ the solution is unique: it is the fragment farthest from the axis, with`)+'</p>'+
       R`$$x^*=\frac{v^2-u'^2}{v}=${T(xs,3)},\quad y^*=\frac{u'\sqrt{v^2-u'^2}}{v}=${T(ys,3)},\quad t^*=\frac{L}{x^*}=${T(L/xs,3)}\ \mu s.$$`+
       '<p>'+_(R`Nel sistema dello ione le componenti sono $u'_x=x^*-v=${T(xs-v,3)}$ e $u'_y=y^*=${T(ys,3)}$; il modulo $\sqrt{(x^*-v)^2+y^{*2}}=${T(Math.hypot(xs-v,ys),3)}$ è proprio $u'$. Il vettore $\vec u$ è tangente alla circonferenza: è la tangente dall'origine del punto 4 della scheda di fisica.`,
               R`In the ion frame the components are $u'_x=x^*-v=${T(xs-v,3)}$ and $u'_y=y^*=${T(ys,3)}$; the magnitude $\sqrt{(x^*-v)^2+y^{*2}}=${T(Math.hypot(xs-v,ys),3)}$ is exactly $u'$. The vector $\vec u$ is tangent to the circle: it is the tangent from the origin used for $\theta_{\max}$.`)+'</p>';
    }
    h+=card(_('6 · Il frammento più lontano','6 · The farthest fragment'),b);
  }
  $('#eq-body').innerHTML=h;
  typeset($('#eq-body'));
}
let tsBusy=false,tsAgain=false;
function typeset(el){
  if(!(window.MathJax&&window.MathJax.typesetPromise))return;
  if(tsBusy){tsAgain=true;return;}
  tsBusy=true;
  try{window.MathJax.typesetClear([el]);}catch(e){}
  window.MathJax.typesetPromise([el]).catch(()=>{}).then(()=>{tsBusy=false;if(tsAgain){tsAgain=false;typeset(el);}});
}
window.__mj=function(){if(P.tab==='eq')typeset($('#eq-body'));};
