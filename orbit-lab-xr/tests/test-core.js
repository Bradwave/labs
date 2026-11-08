// Test della fisica (porta dei test in-page di orbit-lab.html) e della geometria 3D. Solo Node, nessuna installazione.
const { CORE, shipFrame, toShipLocal, dashPolyline } = require('../core.js');
let fail = 0;
const t = (name, ok, info) => { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const TICK = 0.01;

let I = CORE.info(0, 1, 1.2, 0);
t('h=0, v=1.2: e=0.44, a=1.786, rp=1, ra=2.571', near(I.e, .44) && near(I.a, 1.7857, 1e-3) && near(I.rp, 1) && near(I.ra, 2.5714, 1e-3));
I = CORE.info(0, 1.5, CORE.vc(.5), 0); t('tower h=0.5, v=vc: e≈0, r=1.5', I.e < 1e-9 && near(I.r, 1.5));
for (const h of [0, .3, 1, 1.5]) { I = CORE.info(0, 1 + h, CORE.vesc(h), 0); t('escape at h=' + h + ': eps≈0', Math.abs(I.eps) < 1e-12); }
let st = { t: 0, x: 1, y: 0, vx: 0, vy: 1, W: 0, dv: 0, pad: false };
for (let i = 0, n = Math.round(100 * 2 * Math.PI / TICK); i < n; i++) CORE.advance(st, TICK, null);
t('circular orbit: r constant within 1e-9 over 100 orbits', near(Math.hypot(st.x, st.y), 1, 1e-9));
st = CORE.launchState(.5, .8, 0); const eA = CORE.energy(st.x, st.y, st.vx, st.vy).E;
for (let i = 0; i < 500; i++) CORE.advance(st, TICK, { k: i < 250 ? 1 : 3, a: .3, ang: 0 });
t('work–energy with thrust: |E−E0−W_T| < 1e-8', Math.abs(CORE.energy(st.x, st.y, st.vx, st.vy).E - eA - st.W) < 1e-8);
st = CORE.launchState(.5, .3, 0); let rs; for (let i = 0; i < 2000; i++) { rs = CORE.advance(st, TICK, null); if (rs.crash) break; }
t('impact on the surface (r = 1)', rs.crash && near(Math.hypot(rs.crash.x, rs.crash.y), 1, 1e-9));

// ---- sistema di riferimento della nave ----
// Lancio iniziale: nave in (0,1.5), v=(0.8,0) -> orario (hz<0). Su = +y, avanti = +x.
st = CORE.launchState(.5, .8, 0); I = CORE.info(st.x, st.y, st.vx, st.vy);
let F = shipFrame(st.x, st.y, I.hz);
t('frame: up=(0,1), forward=(1,0) per un lancio orizzontale', near(F.ux, 0) && near(F.uy, 1) && near(F.fx, 1) && near(F.fy, 0));
const vl = toShipLocal(F, st.vx, st.vy, 0);
t('velocità = avanti: THREE (0,0,-v)', near(vl[0], 0) && near(vl[1], 0) && near(vl[2], -0.8));
const pl = toShipLocal(F, 0, 0, 0);
t('il centro del pianeta sta sotto la nave (rispetto a P_nave)', near(pl[1], 0));  // origine: va tolta la posizione della nave
const rel = toShipLocal(F, 0 - st.x, 0 - st.y, 0);
t('centro del pianeta relativo = (0,-1.5,0)', near(rel[0], 0) && near(rel[1], -1.5) && near(rel[2], 0));
// orientamento: la base (destra, su, indietro) deve essere destrorsa per entrambi i versi di moto
for (const [x, y, vx, vy] of [[0, 1.5, .8, 0], [0, 1.5, -.8, 0], [1.2, .4, .1, -.7], [-.5, -1, .6, -.3]]) {
  const I2 = CORE.info(x, y, vx, vy), G = shipFrame(x, y, I2.hz);
  const X = toShipLocal(G, 1, 0, 0), Y = toShipLocal(G, 0, 1, 0), Z = toShipLocal(G, 0, 0, 1);
  // matrice M con colonne immagini di ex,ey,ez: det deve valere +1 (rotazione propria)
  const det = X[0] * (Y[1] * Z[2] - Y[2] * Z[1]) - Y[0] * (X[1] * Z[2] - X[2] * Z[1]) + Z[0] * (X[1] * Y[2] - X[2] * Y[1]);
  const v = toShipLocal(G, vx, vy, 0);
  t('rotazione propria e velocità in avanti (' + x + ',' + y + ' v=' + vx + ',' + vy + ')', near(det, 1, 1e-9) && v[2] < 0 && near(v[0], 0, 1e-9));
}

// ---- tratteggio ----
const circle = Array.from({ length: 201 }, (_, i) => [Math.cos(i / 200 * 2 * Math.PI), Math.sin(i / 200 * 2 * Math.PI)]);
const segs = dashPolyline(circle, 0.2, 0.1);
let covered = 0; for (const s of segs) for (let i = 1; i < s.length; i++) covered += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
const total = 2 * Math.PI;
t('tratteggio: copre ~2/3 della circonferenza (' + (covered / total).toFixed(3) + ')', Math.abs(covered / total - 2 / 3) < 0.03 && segs.length >= 20);
t('tratteggio: polilinea corta e punti coincidenti non danno NaN', dashPolyline([[0, 0]], 1, 1).length === 0 && dashPolyline([[0, 0], [0, 0], [1, 0]], .3, .2).every(s => s.every(p => isFinite(p[0]))));
console.log(fail ? fail + ' FALLITI' : 'tutti i test di core superati');
process.exit(fail ? 1 : 0);
