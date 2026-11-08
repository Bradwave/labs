/* Test del nucleo: node tests/core.test.js */
const assert = require('assert');
require('../js/metrics.js'); require('../js/field.js'); require('../js/paths.js'); require('../js/loci.js'); require('../js/axioms.js');
const DL = globalThis.DL, { metric, field, paths, loci } = DL;
const rand = paths.rng(7);
const rp = () => ({ x: Math.round((rand() - 0.5) * 40) / 4, y: Math.round((rand() - 0.5) * 40) / 4 });
const near = (a, b, e, msg) => assert.ok(Math.abs(a - b) <= (e || 1e-9), `${msg || ''} ${a} vs ${b}`);
let n = 0; const ok = name => { n++; console.log('ok', name); };

// 1. assiomi su terne casuali (tutte le metriche tranne Lp con p<1)
for (const id of ['l1', 'l2', 'linf', 'lp', 'disc']) {
  const m = metric(id, 3);
  for (let i = 0; i < 20000; i++) {
    const a = rp(), b = rp(), c = rp();
    const ab = m.dist(a.x, a.y, b.x, b.y), ba = m.dist(b.x, b.y, a.x, a.y), bc = m.dist(b.x, b.y, c.x, c.y), ac = m.dist(a.x, a.y, c.x, c.y);
    assert.ok(ab >= 0 && near(ab, ba) === undefined);
    assert.ok(ac <= ab + bc + 1e-9, `triangolare ${id}`);
    assert.strictEqual(m.dist(a.x, a.y, a.x, a.y), 0);
  }
  ok('assiomi ' + id);
}
// 2. catena d_inf <= d_2 <= d_1 <= sqrt2 d_2 <= 2 d_inf
for (let i = 0; i < 20000; i++) {
  const a = rp(), b = rp();
  const di = metric('linf').dist(a.x, a.y, b.x, b.y), d2 = metric('l2').dist(a.x, a.y, b.x, b.y), d1 = metric('l1').dist(a.x, a.y, b.x, b.y);
  assert.ok(di <= d2 + 1e-12 && d2 <= d1 + 1e-12 && d1 <= Math.SQRT2 * d2 + 1e-9 && Math.SQRT2 * d2 <= 2 * di + 1e-9);
}
ok('catena di disuguaglianze');
// 3. distanza punto-retta: confronto con ricerca a forza bruta
for (const id of ['l1', 'l2', 'linf', 'lp']) {
  const m = metric(id, 3);
  for (let i = 0; i < 120; i++) {
    const p = rp(), q = rp(), r = rp(), len = Math.hypot(r.x - q.x, r.y - q.y);
    if (len < 0.5) continue;
    const L = { x0: q.x, y0: q.y, vx: r.x - q.x, vy: r.y - q.y };
    const ux = L.vx / len, uy = L.vy / len;
    let best = Infinity;
    for (let t = -40; t <= 40; t += 0.002) best = Math.min(best, m.dist(p.x, p.y, q.x + t * ux, q.y + t * uy));
    const got = m.toLine(p.x, p.y, L);
    assert.ok(got <= best + 1e-9 && best - got < 5e-3, `toLine ${id} ${got} vs ${best}`);
  }
  ok('distanza punto-retta ' + id);
}
// 4. percorsi casuali, estremi e scaletta hanno lunghezza uguale alla distanza
for (const id of ['l1', 'l2', 'linf', 'lp']) {
  const m = metric(id, 3);
  for (let i = 0; i < 400; i++) {
    const A = rp(), B = rp(), D = m.dist(A.x, A.y, B.x, B.y);
    for (let k = 1; k <= 6; k++) near(paths.length(m, paths.randomPath(m, A, B, k, i * 31 + k)), D, 1e-7, 'random ' + id);
    for (const e of paths.extremes(m, A, B)) near(paths.length(m, e), D, 1e-7, 'estremo ' + id);
  }
  ok('percorsi minimi ' + id);
}
{
  for (const id of ['l1', 'linf']) {
    const m = metric(id);
    for (let i = 0; i < 400; i++) {
      const A = rp(), B = rp(), D = m.dist(A.x, A.y, B.x, B.y), pts = paths.randomPath(m, A, B, 4, i + 1), r = paths.route(m, pts, i);
      near(paths.length(m, r), D, 1e-7, 'route ' + id);
      for (let k = 1; k < r.length; k++) { const dx = Math.abs(r[k].x - r[k - 1].x), dy = Math.abs(r[k].y - r[k - 1].y); assert.ok(id === 'l1' ? (dx < 1e-9 || dy < 1e-9) : (dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-9), 'tratto ' + id); }
    }
  }
  ok('cammini nello stile della metrica');
}
{
  const m = metric('l1');
  for (let n2 = 1; n2 <= 40; n2++) near(paths.length(m, paths.staircase({ x: 0, y: 0 }, { x: 5, y: 3 }, n2)), 8, 1e-9, 'scaletta');
  ok('scaletta: lunghezza L1 costante');
}
// 5. conteggio sul reticolo
assert.strictEqual(paths.latticeCount('l1', 2, 2), 6n);
assert.strictEqual(paths.latticeCount('l1', 5, 3), 56n);
assert.strictEqual(paths.latticeCount('linf', 1, 1), 1n);
assert.strictEqual(paths.latticeCount('linf', 2, 1), 2n);
assert.strictEqual(paths.latticeCount('linf', 2, 0), 3n);
assert.strictEqual(paths.latticeCount('linf', 3, 0), 7n);
ok('conteggio cammini sul reticolo');
// 6. campo: circonferenza L2 di raggio 5 vista sul canvas
{
  const view = { cx: 200, cy: 200, s: 20 }, A = { x: 0, y: 0 }, m = metric('l2');
  const g = field.sample((x, y) => m.dist(x, y, A.x, A.y) - 5, view, 400, 400, 3);
  const seg = field.contours(g, 0);
  assert.ok(seg.length > 100);
  for (let i = 0; i < seg.length; i += 2) near(Math.hypot((seg[i] - 200) / 20, (200 - seg[i + 1]) / 20), 5, 0.03, 'raggio');
  assert.ok(!field.hasRegion(g));
  ok('contorno circonferenza L2 e assenza di regione');
}
// 7. regioni: asse di A(0,0), B(1,1) in L1 ha interno; in L2 no
{
  const view = { cx: 200, cy: 200, s: 20 }, A = { x: 0, y: 0 }, B = { x: 1, y: 1 };
  const gl1 = field.sample(loci.fields('axis', { m: metric('l1'), A, B }).fields[0], view, 400, 400, 3);
  const gl2 = field.sample(loci.fields('axis', { m: metric('l2'), A, B }).fields[0], view, 400, 400, 3);
  assert.ok(field.hasRegion(gl1), 'L1 deve avere regione');
  assert.ok(!field.hasRegion(gl2), 'L2 non deve avere regione');
  ok('asse L1 con interno, asse L2 senza');
}
// 8. intervallo metrico: L1 e' un rettangolo, L-inf ha interno se |dx| != |dy|, L2 no
{
  const view = { cx: 200, cy: 200, s: 20 }, A = { x: 0, y: 0 }, B = { x: 4, y: 1 };
  for (const [id, exp] of [['l1', true], ['linf', true], ['l2', false]]) {
    const g = field.sample(paths.excessField(metric(id), A, B), view, 400, 400, 2);
    assert.strictEqual(field.hasRegion(g), exp, 'intervallo ' + id);
  }
  ok('regione dei percorsi minimi per metrica');
}
// 9. costruzione: per l'ellisse L2 i punti di intersezione stanno sul luogo
{
  const view = { cx: 200, cy: 200, s: 20 }, c = { m: metric('l2'), A: { x: -3, y: 0 }, B: { x: 3, y: 0 }, dAB: 6, e: 4, f: 0.5 };
  const [G1, G2] = loci.construction('ellipse', c, 5)[0];
  const s1 = field.contours(field.sample(G1, view, 400, 400, 3), 0), s2 = field.contours(field.sample(G2, view, 400, 400, 3), 0);
  const pts = field.intersections(s1, s2, 4);
  assert.strictEqual(pts.length, 4, 'due cerchi di raggio 5 con centri a distanza 6 si tagliano in 2 punti');
  const F = loci.fields('ellipse', c).fields[0];
  for (let i = 0; i < pts.length; i += 2) near(F((pts[i] - 200) / 20, (200 - pts[i + 1]) / 20), 0, 0.08, 'sul luogo');
  ok('costruzione con le palle: ellisse L2');
}
{
  const m = metric('l1'); let distinct = new Set();
  for (let i = 0; i < 300; i++) {
    const A = rp(), B = rp(), w = paths.l1Walk(A, B, i % 7, i + 1);
    near(paths.length(m, w), m.dist(A.x, A.y, B.x, B.y), 1e-9, 'walk');
    for (let k = 1; k < w.length; k++) assert.ok(Math.abs(w[k].x - w[k - 1].x) < 1e-9 || Math.abs(w[k].y - w[k - 1].y) < 1e-9, 'assiale');
    if (i < 40) distinct.add(paths.l1Walk({ x: 0, y: 0 }, { x: 8, y: 6 }, 0, i + 1).map(q => q.x.toFixed(2) + ',' + q.y.toFixed(2)).join(';'));
  }
  assert.ok(distinct.size > 30, 'varieta ' + distinct.size);
  ok('cammini L1 a gradini variati');
}
// 10. metriche sncf e poligonale, verifica degli assiomi
{
  const H = { x: 1, y: 2 };
  for (const [id, o] of [['sncf', { H }], ['poly', { n: 4 }], ['poly', { n: 6 }], ['poly', { n: 12 }]]) {
    const m = metric(id, 3, o);
    for (let i = 0; i < 20000; i++) {
      const a = rp(), b = rp(), c = rp();
      assert.ok(m.dist(a.x, a.y, c.x, c.y) <= m.dist(a.x, a.y, b.x, b.y) + m.dist(b.x, b.y, c.x, c.y) + 1e-9, 'triangolare ' + id);
      near(m.dist(a.x, a.y, b.x, b.y), m.dist(b.x, b.y, a.x, a.y), 1e-9, 'simmetria ' + id);
    }
  }
  near(metric('poly', 3, { n: 4 }).dist(0, 0, 3, 2), 3, 1e-12, 'poly4 = Linf');
  near(metric('sncf', 3, { H: { x: 0, y: 0 } }).dist(1, 1, -1, 1), 2 * Math.SQRT2, 1e-12, 'sncf via hub');
  near(metric('sncf', 3, { H: { x: 0, y: 0 } }).dist(1, 1, 2, 2), Math.SQRT2, 1e-12, 'sncf allineati');
  const mm = metric('sncf', 3, { H });
  for (let i = 0; i < 60; i++) {
    const p = rp(), q = rp(), r = rp(), len = Math.hypot(r.x - q.x, r.y - q.y); if (len < 0.5) continue;
    const L = { x0: q.x, y0: q.y, vx: r.x - q.x, vy: r.y - q.y }; let best = Infinity;
    for (let t = -40; t <= 40; t += 0.01) best = Math.min(best, mm.dist(p.x, p.y, q.x + t * L.vx / len, q.y + t * L.vy / len));
    const got = mm.toLine(p.x, p.y, L);
    assert.ok(got <= best + 1e-6, 'toLine sncf ' + got + ' ' + best);   // la ricerca a forza bruta puo' mancare il minimo puntuale sulla retta PH
  }
  for (const id of ['l1', 'l2', 'linf']) {
    const r = DL.axioms.check(metric(id).dist, 3);
    assert.ok(r.nonneg.ok && r.ident.ok && r.sym.ok && r.tri.ok, 'assiomi ' + id);
  }
  const bad = { sq: 'tri', lphalf: 'tri', asym: 'sym', xonly: 'ident' };
  for (const k in bad) { const r = DL.axioms.check(DL.axioms.BROKEN[k], 3); assert.ok(!r[bad[k]].ok && r[bad[k]].ex, 'controesempio ' + k); }
  ok('sncf, poligonale e verifica degli assiomi');
}
console.log(`\n${n} gruppi di test superati`);
