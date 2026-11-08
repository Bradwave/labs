const THREE = require('three');
const Core = require('../core.js');
const Grab = require('../grab.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;

// ---------- sezioni coniche
const I = new THREE.Matrix4().elements;            // identità: superficie non trasformata
function sec(eq, nrm, d, M) {                      // piano n·p = d, riferimento: base ortonormale (E1,E2)
  const n = new THREE.Vector3(...nrm).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const E1 = new THREE.Vector3(1, 0, 0).applyQuaternion(q).toArray(), E2 = new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray();
  const O = n.clone().multiplyScalar(d).toArray();
  const fn = Core.compile(eq).fn;
  const e = (M || new THREE.Matrix4()).clone().invert().elements;
  return { cls: Core.sectionConic(fn, e, O, E1, E2), segs: Core.sectionSegments(fn, e, O, E1, E2, null, 2.5, 80) };
}
const tilt = deg => [Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)];
let r = sec('x^2+y^2=z^2', [0, 0, 1], 0.5);
ok(r.cls.kind === 'circle' && near(r.cls.r, 0.5, 1e-6), 'cono, z=0.5 → circonferenza r=' + r.cls.r);
ok(r.segs.length > 100, 'cono z=0.5: segmenti marching squares (' + r.segs.length / 4 + ')');
// lunghezza della curva ≈ 2π·0.5
let L = 0; for (let i = 0; i < r.segs.length; i += 4) L += Math.hypot(r.segs[i + 2] - r.segs[i], r.segs[i + 3] - r.segs[i + 1]);
ok(near(L, Math.PI, 0.02), 'lunghezza curva ≈ π (' + L.toFixed(3) + ')');
r = sec('x^2+y^2=z^2', tilt(30), 0.5);  ok(r.cls.kind === 'ellipse', 'cono, normale a 30° dall’asse → ellisse e=' + (r.cls.e || 0).toFixed(3));
r = sec('x^2+y^2=z^2', tilt(45), 0.5);  ok(r.cls.kind === 'parabola', 'cono, 45° (parallelo alla generatrice) → parabola');
r = sec('x^2+y^2=z^2', tilt(60), 0.5);  ok(r.cls.kind === 'hyperbola', 'cono, 60° → iperbole e=' + (r.cls.e || 0).toFixed(3));
r = sec('x^2+y^2=z^2', tilt(90), 0.5);  ok(r.cls.kind === 'hyperbola', 'cono, piano parallelo all’asse → iperbole');
r = sec('x^2+y^2=z^2', [0, 0, 1], 0);   ok(r.cls.kind === 'point', 'cono, piano per il vertice ⟂ asse → punto');
r = sec('x^2+y^2=z^2', tilt(60), 0);    ok(r.cls.kind === 'lines2', 'cono, per il vertice a 60° → due rette incidenti');
r = sec('x^2+y^2=z^2', tilt(45), 0);    ok(r.cls.kind === 'line1', 'cono, per il vertice a 45° → retta');
r = sec('x^2+y^2+z^2=1', [0, 0, 1], 0.6); ok(r.cls.kind === 'circle' && near(r.cls.r, 0.8, 1e-6), 'sfera z=0.6 → circonferenza r=0.8');
r = sec('x^2+y^2+z^2=1', [1, 1, 1], 0.3); ok(r.cls.kind === 'circle' && near(r.cls.r, Math.sqrt(1 - 0.09), 1e-6), 'sfera, piano obliquo → circonferenza r=√(1−d²)');
r = sec('x^2+y^2+z^2=1', [0, 0, 1], 1.5); ok(r.cls.kind === 'empty', 'sfera, piano lontano → nessun punto reale');
r = sec('x^2/2+y^2+z^2/0.5=1', [0, 0, 1], 0); ok(r.cls.kind === 'ellipse' && near(r.cls.e, Math.sqrt(0.5), 1e-4), 'ellissoide z=0 → ellisse e=√½');
r = sec('z=x^2+y^2', [1, 0, 0], 0.3); ok(r.cls.kind === 'parabola', 'paraboloide, piano verticale → parabola');
r = sec('z=x^2+y^2', [0, 0, 1], 1); ok(r.cls.kind === 'circle' && near(r.cls.r, 1, 1e-6), 'paraboloide z=1 → circonferenza');
r = sec('z=x^2-y^2', [0, 0, 1], 0.5); ok(r.cls.kind === 'hyperbola', 'paraboloide iperbolico z=0.5 → iperbole');
r = sec('x^2+y^2-z^2=1', [0, 0, 1], 0.7); ok(r.cls.kind === 'circle', 'iperboloide a una falda z=0.7 → circonferenza');
r = sec('x^2+y^2+z^4=1', tilt(30), 0.5); ok(r.cls.kind === 'other', 'superficie non quadrica → curva non conica');
r = sec('x^2+y^2=1', [1, 0, 0], 0); ok(r.cls.kind === 'lines2' || r.cls.kind === 'line1', 'cilindro, piano per l’asse → rette (' + r.cls.kind + ')');

// superficie traslata e ruotata: sfera centrata in (1,0,0): il piano z=0.5 dà r=√(1−0.25)
let M = new THREE.Matrix4().makeTranslation(1, 0, 0);
r = sec('x^2+y^2+z^2=1', [0, 0, 1], 0.5, M);
ok(r.cls.kind === 'circle' && near(r.cls.r, Math.sqrt(0.75), 1e-6), 'sfera traslata: stessa circonferenza (r=' + r.cls.r.toFixed(4) + ')');
let cx = 0, n = 0; for (let i = 0; i < r.segs.length; i += 2) { cx += r.segs[i]; n++; }
ok(near(cx / n, 1, 0.02), 'centro della curva traslato in x=1 (' + (cx / n).toFixed(3) + ')');
// cono ruotato di 90° attorno a x: asse lungo -y ; piano z=0.5 (normale ⟂ asse) → iperbole
M = new THREE.Matrix4().makeRotationX(Math.PI / 2);
r = sec('x^2+y^2=z^2', [0, 0, 1], 0.5, M); ok(r.cls.kind === 'hyperbola', 'cono ruotato: piano orizzontale → iperbole (cambia con la trasformazione)');
// scala ×2: sfera raggio 2, piano z=1 → r=√3
M = new THREE.Matrix4().makeScale(2, 2, 2);
r = sec('x^2+y^2+z^2=1', [0, 0, 1], 1, M); ok(r.cls.kind === 'circle' && near(r.cls.r, Math.sqrt(3), 1e-6), 'sfera scalata ×2: r=√3');
// dominio: curva tagliata fuori dal dominio locale
{
  const fn = Core.compile('x^2+y^2=z^2').fn, e = new THREE.Matrix4().elements;
  const s = Core.sectionSegments(fn, e, [0, 0, 1.2], [1, 0, 0], [0, 1, 0], 1, 2.5, 80);
  ok(s.length === 0, 'fuori dal dominio locale (R=1, z=1.2): nessun segmento');
}
{ // selle: x*y=0.25... due rami, nessun filo spurio
  const fn = Core.compile('x*y=0.25').fn;
  const s = Core.sectionSegments(fn, new THREE.Matrix4().elements, [0, 0, 0], [1, 0, 0], [0, 1, 0], null, 2.5, 80);
  let bad = 0; for (let i = 0; i < s.length; i += 4) { const d = Math.abs(s[i] * s[i + 1] - 0.25); if (d > 0.01) bad++; }
  ok(s.length > 100 && bad === 0, 'iperbole xy=0.25: tutti i segmenti sulla curva');
}

// ---------- presa su oggetti figli di un gruppo trasformato
function scene() {
  const parent = new THREE.Group(); parent.position.set(0, 1.3, -0.7); parent.scale.setScalar(0.2);
  parent.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const child = new THREE.Object3D(); child.position.set(1, 0, 0); child.userData.grab = { scalable: true, min: 0.2, max: 5 };
  parent.add(child); parent.updateMatrixWorld(true);
  return { parent, child, g: new Grab.GrabController(THREE) };
}
const src = (id, x, y, z, pinching, q) => ({ id, active: true, pinching, pos: new THREE.Vector3(x, y, z), quat: q || new THREE.Quaternion() });
function run(g, frames, fn, pick) { for (let f = 0; f < frames; f++) g.update(fn(f), 1 / 72, pick); }
{
  const { parent, child, g } = scene();
  const wp = () => { parent.updateMatrixWorld(true); return child.getWorldPosition(new THREE.Vector3()); };
  const p0 = wp(); // (0.2, 1.3, -0.7)
  const pick = pos => (pos.distanceTo(wp()) < 0.1 ? child : null);
  run(g, 4, () => [src('a', p0.x, p0.y, p0.z, true)], pick);
  ok(g.target === child, 'pick: bersaglio = figlio');
  run(g, 80, f => [src('a', p0.x + 0.1 * Math.min(1, f / 30), p0.y, p0.z, true)], pick);
  const p1 = wp();
  ok(near(p1.x, p0.x + 0.1, 0.003), 'figlio segue la mano in coordinate mondiali (Δx=' + (p1.x - p0.x).toFixed(3) + ')');
  ok(near(parent.position.x, 0, 1e-9), 'il genitore (sistema di riferimento) NON si muove');
  ok(near(child.position.x, 1.5, 0.02) && near(child.scale.x, 1, 1e-6), 'posizione locale = +0.1/0.2 unità, scala invariata (' + child.position.x.toFixed(3) + ')');
  run(g, 3, () => [src('a', 0, 0, 0, false)], pick);
  // scala a due mani: ×2 con limiti locali [0.2, 5]
  const pk2 = pos => child;
  run(g, 4, () => [src('a', 0.0, 1.3, -0.7, true)], pk2);
  run(g, 3, () => [src('a', 0.0, 1.3, -0.7, true), src('b', 0.2, 1.3, -0.7, true)], pk2);
  run(g, 100, () => [src('a', -0.2, 1.3, -0.7, true), src('b', 0.4, 1.3, -0.7, true)], pk2); // distanza ×3
  ok(near(child.scale.x, 3, 0.02) && near(parent.scale.x, 0.2, 1e-9), 'scala locale ×3 (figlio), genitore invariato (' + child.scale.x.toFixed(3) + ')');
  run(g, 100, () => [src('a', -3, 1.3, -0.7, true), src('b', 3, 1.3, -0.7, true)], pk2);
  ok(near(child.scale.x, 5, 1e-6), 'limite massimo locale rispettato (5)');
}
{ // oggetto non scalabile (piano): due mani muovono/ruotano ma non scalano
  const { parent, child, g } = scene(); child.userData.grab = { scalable: false };
  const pk = () => child;
  run(g, 4, () => [src('a', 0.0, 1.3, -0.7, true)], pk);
  run(g, 3, () => [src('a', 0.0, 1.3, -0.7, true), src('b', 0.2, 1.3, -0.7, true)], pk);
  run(g, 100, () => [src('a', -0.2, 1.3, -0.7, true), src('b', 0.4, 1.3, -0.7, true)], pk);
  ok(near(child.scale.x, 1, 1e-9), 'oggetto non scalabile: scala invariata');
}
{ // pinch nel vuoto: nessuna presa; la seconda mano non afferra da sola
  const { child, g } = scene();
  run(g, 5, () => [src('a', 2, 2, 2, true), src('b', -2, 1, 0, true)], () => null);
  ok(g.target === null && g.holding.length === 0, 'pinch nel vuoto: nessuna presa');
}
{ // rilascio della prima mano con la seconda ancora attiva: continua con una mano senza salti
  const { child, g } = scene(); const pk = () => child;
  run(g, 4, () => [src('a', 0.2, 1.3, -0.7, true)], pk);
  run(g, 3, () => [src('a', 0.2, 1.3, -0.7, true), src('b', 0.4, 1.3, -0.7, true)], pk);
  run(g, 40, () => [src('a', 0.2, 1.3, -0.7, true), src('b', 0.4, 1.3, -0.7, true)], pk);
  const w0 = child.getWorldPosition(new THREE.Vector3());
  run(g, 1, () => [src('a', 0.2, 1.3, -0.7, false), src('b', 0.4, 1.3, -0.7, true)], pk);
  const w1 = child.getWorldPosition(new THREE.Vector3());
  ok(g.holding.length === 1 && w0.distanceTo(w1) < 0.01, 'rilascio di una mano: nessun salto');
}
console.log(fails ? '\n' + fails + ' TEST FALLITI' : '\nTUTTI I TEST OK');
process.exit(fails ? 1 : 0);
