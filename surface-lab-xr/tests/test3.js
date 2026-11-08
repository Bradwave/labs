const THREE = require('three');
const Core = require('../core.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const num = s => Core.evalNumber(s);

// ---- parser esteso
const ev = (eq, x, y, z) => Core.compile(eq).fn(x, y, z);
ok(near(ev('atan2(y,x)', 0, 1, 0), Math.PI / 2, 1e-12), 'atan2(y,x)');
ok(near(ev('max(x,y)+min(x,y)', 2, 5, 0), 7, 1e-12), 'min e max');
ok(near(ev('abs(x)^(2/3)', -8, 0, 0), 4, 1e-9), 'abs(x)^(2/3) con x negativo');
ok(near(num('2*pi'), 2 * Math.PI, 1e-12) && near(num('-3pi/2'), -1.5 * Math.PI, 1e-12), 'evalNumber: 2*pi, -3pi/2');
let thr = 0; for (const b of ['x', 'sin(1)+u', 'atan2(1)', 'min(1,)', '1,2']) { try { Core.evalNumber(b); } catch (e) { thr++; } }
ok(thr === 5, 'evalNumber: rifiuta variabili e sintassi errata');
let t2 = 0; for (const b of [['u*v', 'x', '1'], ['u', 'v', 'z'], ['u=1', 'v', '0']]) { try { Core.compileParam(...b); } catch (e) { t2++; } }
ok(t2 === 3, 'compileParam: rifiuta x,y,z e «=»');
const cp = Core.compileParam('u*v', 'u+v', '2*u'); ok(JSON.stringify(cp.fn(2, 3)) === '[6,5,4]', 'compileParam valuta [x,y,z]');
let evil = false; try { Core.compileParam('process.exit()', '0', '0'); } catch (e) { evil = true; } ok(evil, 'param: iniezione rifiutata');

// ---- aree note con la mesh parametrica
function area(m) { const P = m.positions; let A = 0; for (let t = 0; t < m.triangles; t++) { const a = 9 * t; const u = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]], v = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]]; A += 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); } return A; }
function meshOf(p, N) { const c = Core.compileParam(p.fx, p.fy, p.fz, Core.defaultParams(p)); return Core.polygonizeParam(c.fn, num(p.u0), num(p.u1), num(p.v0), num(p.v1), N || p.N, N || p.N); }
let m = meshOf(Core.presetById('catenoide'), 96);
const b = 1.4, Acat = 2 * Math.PI * (b + Math.sinh(b) * Math.cosh(b));
ok(near(m.triangles > 0 ? area(m) / Acat : 0, 1, 0.005), 'catenoide: area ' + area(m).toFixed(3) + ' ≈ ' + Acat.toFixed(3));
// verso delle normali: sulla catenoide il lato fronte coerente (stessa orientazione ovunque)
{ let pos = 0, neg = 0; for (let v = 0; v < m.positions.length / 3; v++) { const x = m.positions[3 * v], y = m.positions[3 * v + 1]; const d = (x * m.normals[3 * v] + y * m.normals[3 * v + 1]); if (d > 0) pos++; else neg++; } ok(pos === 0 || neg === 0, 'catenoide: normali coerenti (' + pos + '/' + neg + ')'); }
m = meshOf(Core.presetById('elicoide'), 96);
const Ahel = (() => { // area dell’elicoide x=v cos u, y=v sin u, z=c u: ∫∫ sqrt(c²+v²) dv du
  const c = 0.25; let s = 0, n = 20000, a = -1.5, bb = 1.5, h = (bb - a) / n; for (let i = 0; i < n; i++) { const v = a + (i + 0.5) * h; s += Math.sqrt(c * c + v * v) * h; } return s * 4 * Math.PI; })();
ok(near(area(m) / Ahel, 1, 0.005), 'elicoide: area ' + area(m).toFixed(3) + ' ≈ ' + Ahel.toFixed(3));
// toro implicito: area 4π² R r
m = Core.polygonize(Core.compile(Core.presetById('toro').eq).fn, { R: 2, N: 72 });
ok(near(area(m) / (4 * Math.PI * Math.PI * 1.2 * 0.5), 1, 0.03), 'toro implicito: area ' + area(m).toFixed(2) + ' ≈ ' + (4 * Math.PI * Math.PI * 0.6).toFixed(2));

// ---- sezioni di superfici parametriche
const I4 = new THREE.Matrix4().elements;
function secMesh(preset, nrm, d, M) {
  const g = meshOf(preset).grid, n = new THREE.Vector3(...nrm).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const E1 = new THREE.Vector3(1, 0, 0).applyQuaternion(q).toArray(), E2 = new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray();
  return Core.sectionSegmentsMesh(g, (M || new THREE.Matrix4()).elements, n.clone().multiplyScalar(d).toArray(), E1, E2, n.toArray(), d);
}
const len = s => { let L = 0; for (let i = 0; i < s.length; i += 4) L += Math.hypot(s[i + 2] - s[i], s[i + 3] - s[i + 1]); return L; };
let sg = secMesh(Core.presetById('catenoide'), [0, 0, 1], 0);
ok(near(len(sg), 2 * Math.PI, 0.03), 'catenoide z=0: circonferenza di raggio 1, lunghezza ' + len(sg).toFixed(3));
sg = secMesh(Core.presetById('elicoide'), [0, 0, 1], 0);
ok(near(len(sg), 3, 0.05), 'elicoide z=0: segmento di lunghezza 3 (' + len(sg).toFixed(3) + ')');
let ymax = 0; for (let i = 0; i < sg.length; i += 2) ymax = Math.max(ymax, Math.abs(sg[i + 1])); ok(ymax < 0.01, 'elicoide z=0: la retta è sull’asse u');
// con una traslazione la curva si sposta
sg = secMesh(Core.presetById('catenoide'), [0, 0, 1], 0, new THREE.Matrix4().makeTranslation(1, 0, 0));
let cx = 0, k = 0; for (let i = 0; i < sg.length; i += 2) { cx += sg[i]; k++; } ok(near(cx / k, 1, 0.02), 'catenoide traslata: centro della curva in x=1 (' + (cx / k).toFixed(3) + ')');
sg = secMesh(Core.presetById('catenoide'), [0, 0, 1], 5); ok(sg.length === 0, 'piano lontano: nessun segmento');
sg = secMesh(Core.presetById('mobius'), [0, 0, 1], 0); ok(sg.length > 0, 'Möbius z=0: ha segmenti (' + sg.length / 4 + ')');

// ---- tutte le preset
console.log('\n   preset: nome | tipo | triangoli | ms | estensione max');
for (const p of Core.PRESETS) {
  const t0 = Date.now(); let r, ext;
  if (p.kind === 'implicit') { r = Core.polygonize(Core.compile(p.eq, Core.defaultParams(p)).fn, { R: p.R, N: p.N }); const P = r.positions; ext = 0; for (let i = 0; i < P.length; i++) ext = Math.max(ext, Math.abs(P[i])); }
  else { r = meshOf(p); ext = Math.max(...r.bbox.map(Math.abs)); }
  const ms = Date.now() - t0;
  const fin = r.positions.every(Number.isFinite) && r.normals.every(Number.isFinite);
  const zero = (() => { let z = 0; const P = r.positions; for (let t = 0; t < r.triangles; t++) { const a = 9 * t; const u = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]], v = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]]; const ar = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); if (ar < 1e-12) continue; for (let q = 0; q < 3; q++) if (Math.hypot(r.normals[a + 3 * q], r.normals[a + 3 * q + 1], r.normals[a + 3 * q + 2]) < 0.5) z++; } return z; })();
  console.log('   ' + p.name.padEnd(46) + p.kind.padEnd(9) + String(r.triangles).padStart(7) + String(ms).padStart(6) + ' ms  ±' + ext.toFixed(2) + (zero ? '  normali nulle: ' + zero : ''));
  ok(r.triangles > 50 && fin, p.name + ': mesh valida');
  ok(ext < 4.2, p.name + ': entra nel campo di vista (±' + ext.toFixed(2) + ')');
  ok(zero === 0, p.name + ': normali valide nei triangoli con area');
}
ok(Core.PRESETS.length >= 40, 'libreria con ' + Core.PRESETS.length + ' superfici');
ok(new Set(Core.PRESETS.map(p => p.id)).size === Core.PRESETS.length, 'id unici');
ok(Core.PRESETS.every(p => Core.GROUPS.includes(p.group)), 'gruppi validi');
console.log(fails ? '\n' + fails + ' TEST FALLITI' : '\nTUTTI I TEST OK');
process.exit(fails ? 1 : 0);
