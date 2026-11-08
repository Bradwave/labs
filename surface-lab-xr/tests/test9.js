const Core = require('../core.js'), PM = require('../probe.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const F = n => Core.compile(n).fn;

// ---------- sfera: gradiente = 2·(x,y,z), normale radiale
const sph = F('x^2+y^2+z^2=1');
let g = PM.gradient(sph, [0.6, 0, 0.8]);
ok(near(g[0], 1.2, 1e-5) && near(g[1], 0, 1e-5) && near(g[2], 1.6, 1e-5), 'gradiente numerico della sfera');
let r = PM.project(sph, [0.66, 0.02, 0.84]);
ok(r.ok && near(Math.hypot(...r.p), 1, 1e-6), 'punto fuori superficie riportato sulla sfera (|p| = ' + Math.hypot(...r.p).toFixed(8) + ')');
const n = PM.norm(r.g); ok(near(n[0], r.p[0], 1e-4) && near(n[2], r.p[2], 1e-4), 'la normale è radiale e punta fuori (F cresce)');
r = PM.project(sph, [0.3, 0.3, 0.3]); ok(r.ok && near(Math.hypot(...r.p), 1, 1e-6), 'anche da dentro');

// ---------- paraboloide, cono, sella
const par = F('x^2+y^2-z=0'); r = PM.project(par, [0.5, 0.3, 0.4]);
ok(r.ok && near(r.p[0] * r.p[0] + r.p[1] * r.p[1] - r.p[2], 0, 1e-6), 'punto sul paraboloide');
const nn = PM.norm(r.g); ok(nn[2] < 0, 'sul paraboloide il gradiente (F cresce) punta verso il basso');
const cone = F('x^2+y^2-z^2=0'); r = PM.project(cone, [0.5, 0.1, 0.55]); ok(r.ok && near(r.p[0] ** 2 + r.p[1] ** 2 - r.p[2] ** 2, 0, 1e-6), 'punto sul cono');
const sad = F('z=x*y'); r = PM.project(sad, [0.4, 0.5, 0.3]); ok(r.ok, 'punto sulla sella');

// ---------- punti singolari e valori non definiti
r = PM.project(cone, [0, 0, 0]); ok(!r.ok || near(r.F, 0, 1e-9), 'vertice del cono: gradiente nullo, nessun crash (' + r.ok + ')');
ok(PM.norm([0, 0, 0]) === null, 'norm di un vettore nullo = null');
const sq = F('sqrt(x)-y'); r = PM.project(sq, [-1, 0, 0]); ok(!r.ok, 'F non definita (sqrt di negativo): non ok');

// ---------- ogni preset implicito: un punto vicino alla superficie si proietta
let tested = 0, good = 0;
for (const p of Core.PRESETS.filter(q => q.kind === 'implicit')) {
  const fn = Core.compile(p.eq, Core.defaultParams(p)).fn, m = Core.polygonize(fn, { R: p.R, N: 22 }); if (!m.triangles) continue;
  const i = Math.floor(m.triangles / 2) * 9, pt = [m.positions[i] + 0.01, m.positions[i + 1] - 0.01, m.positions[i + 2] + 0.01];
  const res = PM.project(fn, pt, 6); tested++;
  if (res.ok || Math.abs(res.F) < 1e-4) good++; else console.log('   non converge:', p.id, res.F);
}
ok(good >= tested * 0.9, 'la proiezione converge sul ' + Math.round(100 * good / tested) + '% dei preset implicit (' + good + '/' + tested + ')');

// ---------- formattazione
ok(PM.fmtVec([0.5, -1.234, 0]) === '(0,50; −1,23; 0,00)', 'formato dei vettori: ' + PM.fmtVec([0.5, -1.234, 0]));
console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
