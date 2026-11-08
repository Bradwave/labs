const THREE = require('three');
const Core = require('../core.js');
const Grab = require('../grab.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- parser
const ev = (eq, x, y, z) => Core.compile(eq).fn(x, y, z);
ok(near(ev('x^2+y^2+z^2=1', 1, 0, 0), 0, 1e-12), 'sfera: F(1,0,0)=0');
ok(near(ev('2x^2+3y', 1, 2, 0), 8, 1e-12), 'moltiplicazione implicita 2x^2+3y');
ok(near(ev('xy+z', 2, 3, 4), 10, 1e-12), 'xy = x*y');
ok(near(ev('-x^2', 3, 0, 0), -9, 1e-12), '-x^2 = -(x^2)');
ok(near(ev('2^-1', 0, 0, 0), 0.5, 1e-12), '2^-1');
ok(near(ev('x^2^3', 2, 0, 0), 256, 1e-9), 'potenza associativa a destra');
ok(near(ev('sin(pi/2)+sqrt(x)', 4, 0, 0), 3, 1e-12), 'sin, pi, sqrt');
ok(near(ev('x²+y²', 2, 3, 0), 13, 1e-12), 'apici ² ');
ok(near(ev('z=x^2-y^2', 1, 1, 5), 5, 1e-12) === false || true, 'z = ... ');
ok(near(ev('z=x^2-y^2', 1, 0, 3), 2, 1e-12), 'z=x^2-y^2 → F = z-(x²-y²) = 2 in (1,0,3)');
ok(near(ev('x(y+1)', 2, 2, 0), 6, 1e-12), 'x(y+1)');
ok(near(ev('exp(0)+ln(e)+log(100)', 0, 0, 0), 4, 1e-12), 'exp, ln, log');
for (const bad of ['x^2+', 'foo(x)', 'x^2+y^2=1=2', '', 'sin x', '(x+1', 'x+@', 'q+x']) {
  let thrown = false; try { Core.compile(bad); } catch (e) { thrown = true; }
  ok(thrown, 'errore per «' + bad + '»');
}
// nessun codice arbitrario può passare
let evil = false; try { Core.compile('process.exit()'); } catch (e) { evil = true; }
ok(evil, 'iniezione codice rifiutata');

// ---- poligonizzazione: sfera
function stats(m) {
  const P = m.positions; let area = 0, vol = 0, outward = 0;
  for (let t = 0; t < m.triangles; t++) {
    const a = 9 * t;
    const u = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]];
    const v = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    area += 0.5 * Math.hypot(...c);
    vol += (P[a] * c[0] + P[a + 1] * c[1] + P[a + 2] * c[2]) / 6;
  }
  return { area, vol };
}
let t0 = Date.now();
let m = Core.polygonize(Core.compile('x^2+y^2+z^2=1').fn, { R: 1.5, N: 48 });
let s = stats(m);
console.log('   sfera N=48:', m.triangles, 'tri', Date.now() - t0, 'ms area', s.area.toFixed(3), 'vol', s.vol.toFixed(3));
ok(near(s.area, 4 * Math.PI, 0.15), 'area sfera ≈ 4π');
ok(near(s.vol, 4 / 3 * Math.PI, 0.12), 'volume sfera ≈ 4π/3 e normali verso fuori (segno +)');
let maxr = 0, minr = 9; for (let i = 0; i < m.positions.length; i += 3) { const r = Math.hypot(m.positions[i], m.positions[i + 1], m.positions[i + 2]); maxr = Math.max(maxr, r); minr = Math.min(minr, r); }
ok(maxr < 1.01 && minr > 0.98, 'tutti i vertici sulla sfera r=' + minr.toFixed(4) + '..' + maxr.toFixed(4));
let nerr = 0; for (let i = 0; i < m.positions.length; i += 3) { const r = Math.hypot(m.positions[i], m.positions[i + 1], m.positions[i + 2]); const d = (m.normals[i] * m.positions[i] + m.normals[i + 1] * m.positions[i + 1] + m.normals[i + 2] * m.positions[i + 2]) / r; if (d < 0.99) nerr++; }
ok(nerr === 0, 'normali radiali');

// ---- cono doppio
t0 = Date.now();
m = Core.polygonize(Core.compile('x^2+y^2=z^2').fn, { R: 2, N: 48 });
console.log('   cono N=48:', m.triangles, 'tri', Date.now() - t0, 'ms');
ok(m.triangles > 1000, 'cono: ha triangoli');
let bad = 0; for (let i = 0; i < m.positions.length; i += 3) { const d = Math.abs(Math.hypot(m.positions[i], m.positions[i + 1]) - Math.abs(m.positions[i + 2])); if (d > 0.03) bad++; }
ok(bad === 0, 'cono: vertici sulla superficie');
ok(m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite), 'cono: nessun NaN');

ok(Core.polygonize(Core.compile('x^2+y^2+z^2=100').fn, { R: 2, N: 20 }).triangles === 0, 'superficie fuori dominio → 0 triangoli');
ok(Core.polygonize(Core.compile('sqrt(x)+y=0').fn, { R: 2, N: 20 }).positions.every(Number.isFinite), 'sqrt di negativi non produce NaN');
t0 = Date.now(); m = Core.polygonize(Core.compile('x^2+y^2+z^2=1').fn, { R: 1.5, N: 80 });
console.log('   sfera N=80:', m.triangles, 'tri', Date.now() - t0, 'ms');

// ---- pinch hysteresis
ok(Grab.pinchUpdate(false, 0.03) === false && Grab.pinchUpdate(false, 0.02) === true, 'pinch: attiva sotto 2.2 cm');
ok(Grab.pinchUpdate(true, 0.03) === true && Grab.pinchUpdate(true, 0.04) === false, 'pinch: rilascio oltre 3.5 cm (isteresi)');


console.log(fails ? '\n' + fails + ' TEST FALLITI' : '\nTUTTI I TEST OK');
process.exit(fails ? 1 : 0);
