// Parameter Lab XR · matematica pura (parser, curve, intersezioni, discussione)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const req = createRequire(import.meta.url);
const E = req("../js/expr.js"), G = req("../js/engine.js"), PR = req("../js/presets.js");
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m || ""} ${a} vs ${b}`);
const rel = (s) => E.parseRelation(s);

// 1. parser: valori, relazioni, prodotto implicito, errori
{
  const r = rel("y = x^2 + k");
  assert.equal(r.op, "="); near(r.F(2, 5, 1, 0), 5 - 5, 1e-12);
  near(rel("2x^2 - 3k x").F(2, 0, 1, 0), -2, 1e-12, "senza y: y = espressione");
  near(rel("-x^2").F(3, -9, 0, 0), 0, 1e-12, "−x² = −(x²)");
  near(rel("y >= 0,5x").F(2, 3, 0, 0), 2, 1e-12, "virgola decimale");
  assert.equal(rel("x^2+y^2 ≤ k").op, "<=");
  assert.equal(rel("y < x").strict, true);
  assert.equal(rel("y < x").kind, "ineq");
  near(rel("2^-x - y").F(1, 0.5, 0, 0), 0, 1e-12, "esponente negativo");
  near(rel("y = sqrt(x)·a").F(4, 2, 0, 1), 0, 1e-12);
  assert.deepEqual(rel("y = x + k").uses, { x: true, y: true, k: true, a: false });
  for (const [bad, code] of [["", "err.empty"], ["y = ", "err.side"], ["x = = 3", "err.rel"], ["foo(x)", "err.var"], ["sin x", "err.func"], ["x +", "err.end"], ["(x", "err.paren"], ["3 = 4", "err.noxy"], ["y = x @ 2", "err.char"]]) {
    const t = E.tryParse(bad); assert.equal(t.ok, false, bad); assert.equal(t.error.code, code, bad);
  }
  // nessun eval di testo libero: un nome di funzione non ammesso viene rifiutato, non eseguito
  assert.equal(E.tryParse("y = process(x)").ok, false);
  assert.equal(E.tryParse("y = constructor").ok, false);
}

// 2. curva di livello: la circonferenza x²+y²=4 ha raggio 2; i poli di tan non danno segmenti verticali
{
  const c = G.contour(rel("x^2+y^2=4").F, 0, 0, 4, 120);
  let worst = 0;
  for (let i = 0; i < c.seg.length; i += 4) for (const o of [0, 2]) worst = Math.max(worst, Math.abs(Math.hypot(c.seg[i + o], c.seg[i + o + 1]) - 2));
  assert.ok(worst < 2e-3, "raggio " + worst);
  const t = G.contour(rel("y = tan(x)").F, 0, 0, 4, 120);
  let longest = 0;
  for (let i = 0; i < t.seg.length; i += 4) longest = Math.max(longest, Math.hypot(t.seg[i + 2] - t.seg[i], t.seg[i + 3] - t.seg[i + 1]));
  assert.ok(longest < 1.2, "nessun segmento attraverso il polo: " + longest);
  assert.ok(t.n > 100);
}

// 3. intersezioni in una fetta: retta e circonferenza
{
  const A = rel("x^2+y^2=4").F, B = rel("y = x + k").F;
  assert.equal(G.intersections(A, B, 0, 0, 4, 80).length, 2);
  assert.equal(G.intersections(A, B, 2, 0, 4, 80).length, 2); // 2 < 2√2
  assert.equal(G.intersections(A, B, 3, 0, 4, 80).length, 0); // 3 > 2√2
  const p = G.intersections(A, B, 1, 0, 4, 80);
  for (const [x, y] of p) { near(x * x + y * y, 4, 1e-6, "sulla circonferenza"); near(y, x + 1, 1e-6, "sulla retta"); }
}

// 4. discussione: i valori critici di retta/circonferenza sono ±2√2, trovati con la tangenza
{
  const A = rel("x^2+y^2=4").F, B = rel("y = x + k").F;
  const sc = G.scan(A, B, -4, 4, 0, 4, { nk: 80, N: 64 });
  const d = G.discuss(A, B, sc);
  assert.equal(d.crit.length, 2);
  near(d.crit[0].k, -2 * Math.SQRT2, 1e-4, "k critico −2√2"); near(d.crit[1].k, 2 * Math.SQRT2, 1e-4, "k critico 2√2");
  assert.ok(d.crit.every((c) => c.tangent && c.at === 1), "tangenza: un solo punto");
  assert.deepEqual(d.runs.map((r) => r.n), [0, 2, 0]);
  near(d.crit[1].x, -Math.SQRT2, 1e-3, "punto di tangenza"); near(d.crit[1].y, Math.SQRT2, 1e-3);
}

// 5. radici di x² − 2kx + k = 0: critici 0 e 1 (discriminante k² − k)
{
  const A = rel("y = x^2 - 2*k*x + k").F, B = rel("y = 0").F;
  const sc = G.scan(A, B, -2, 3, 0, 6, { nk: 100, N: 80 });
  const d = G.discuss(A, B, sc);
  assert.equal(d.crit.length, 2);
  near(d.crit[0].k, 0, 5e-3); near(d.crit[1].k, 1, 5e-3);
  assert.deepEqual(d.runs.map((r) => r.n), [2, 0, 2]);
  assert.equal(G.countAt(sc, 2), 2);
}

// 6. il collegamento produce curve 3D chiuse alla tangenza: due rami che si fondono
{
  const A = rel("x^2+y^2=4").F, B = rel("y = x + k").F;
  const sc = G.scan(A, B, -4, 4, 0, 4, { nk: 80, N: 64 });
  const L = G.link(sc);
  assert.ok(L.length / 6 > 60, "segmenti " + L.length / 6);
  // tutti i segmenti stanno sulla superficie: x²+y²=4 e y = x + k (con la tolleranza della polish)
  for (let i = 0; i < L.length; i += 6) for (const o of [0, 3]) near(L[i + o + 1] - L[i + o], L[i + o + 2], 1e-3, "y − x = k");
  // il punto più alto è la punta vicino a k = 2√2
  let kmax = -9; for (let i = 0; i < L.length; i += 3) kmax = Math.max(kmax, L[i + 2]);
  assert.ok(kmax > 2.7 && kmax < 2.9, "punta a k = " + kmax);
}

// 7. due cerchi: criticali ±1 e ±3 (0 | 2 | 0 | 2 | 0)
{
  const A = rel("x^2+y^2=4").F, B = rel("(x-k)^2+y^2=1").F;
  const sc = G.scan(A, B, -4, 4, 0, 5, { nk: 160, N: 80 });
  const d = G.discuss(A, B, sc);
  assert.deepEqual(d.crit.map((c) => Math.round(c.k * 100) / 100), [-3, -1, 1, 3]);
  assert.deepEqual(d.runs.map((r) => r.n), [0, 2, 0, 2, 0]);
}

// 8. superficie: il cono x²+y²=k² ha i suoi triangoli sulla superficie; la parabola con polo non ha facce attraverso il polo
{
  const F = rel("x^2+y^2=k").F, s = G.surface(F, 0, 3, 0, 4, 24, 24);
  assert.ok(s.n > 300);
  let worst = 0;
  for (let i = 0; i < s.pos.length; i += 3) worst = Math.max(worst, Math.abs(s.pos[i] ** 2 + s.pos[i + 1] ** 2 - s.pos[i + 2]));
  assert.ok(worst < 0.2, "aderenza alla superficie " + worst); // interpolazione lineare nello spigolo
  const T = G.surface(rel("y = tan(x)").F, 0, 3, 0, 1, 24, 6);
  let tall = 0; for (let i = 0; i < T.pos.length; i += 9) tall = Math.max(tall, Math.abs(T.pos[i + 1] - T.pos[i + 4]));
  assert.ok(tall < 1.5, "nessuna faccia lungo il polo di tan: " + tall);
}

// 9. regioni e soluzioni: la maschera dà l'area del cerchio; filterInside tiene la parte di curva dentro la regione
{
  const M = 200, m = G.mask(rel("x^2+y^2<=4"), 0, 0, 4, M);
  let n = 0; for (const v of m) n += v;
  near(n * (8 / M) ** 2, Math.PI * 4, 0.15, "area del cerchio");
  const c = G.contour(rel("y = x").F, 0, 0, 4, 80);
  const half = G.filterInside(c.seg, rel("x^2+y^2<=4"), 0, 0);
  assert.ok(half.length > 0 && half.length < c.seg.length, "metà (circa) della retta");
  let far = 0; for (let i = 0; i < half.length; i += 2) far = Math.max(far, Math.hypot(half[i], half[i + 1]));
  assert.ok(far < 2.2, "dentro il cerchio " + far);
}

// 10. ogni esempio si legge, ha una scansione senza errori e rispetta il proprio intervallo
{
  for (const p of PR.LIST) {
    const A = rel(p.a), B = p.b ? rel(p.b) : null;
    assert.ok(p.k >= p.k0 && p.k <= p.k1, p.id);
    if (B) {
      const sc = G.scan(A.F, B.F, p.k0, p.k1, p.p, p.W, { nk: 60, N: 64 });
      const d = G.discuss(A.F, B.F, sc);
      assert.ok(d.runs.length >= 1 && d.runs.length <= 26, `${p.id}: ${d.runs.length} intervalli`);
      assert.ok(sc.counts.every((n) => n <= 24), p.id);
    }
  }
  // dettagli didattici: radice quadrata e retta (0, 1, 2, 1 soluzioni) e fascio di rette per (0,−1) con la parabola (critici ±2)
  const q = PR.byId("sqrt"), A = rel(q.a).F, B = rel(q.b).F;
  const d = G.discuss(A, B, G.scan(A, B, q.k0, q.k1, 0, q.W, { nk: 160, N: 80 }));
  assert.deepEqual(d.runs.map((r) => r.n), [0, 2, 1]);
  near(d.crit[0].k, -0.25, 2e-3, "tangenza di √x con x − k");
  const f = PR.byId("pencil"), FA = rel(f.a).F, FB = rel(f.b).F;
  const df = G.discuss(FA, FB, G.scan(FA, FB, f.k0, f.k1, 0, f.W, { nk: 160, N: 80 }));
  near(df.crit[0].k, -2, 1e-3); near(df.crit[1].k, 2, 1e-3);
  assert.deepEqual(df.runs.map((r) => r.n), [2, 0, 2]);
  // x³ − 3x = k: 1, 2 (tangente), 3, 2 (tangente), 1 soluzioni; critici ±2
  const cu = PR.byId("cubic"), CA = rel(cu.a).F, CB = rel(cu.b).F;
  const dc = G.discuss(CA, CB, G.scan(CA, CB, cu.k0, cu.k1, 0, cu.W, { nk: 160, N: 80 }));
  near(dc.crit[0].k, -2, 1e-3); near(dc.crit[1].k, 2, 1e-3);
  assert.deepEqual(dc.runs.map((r) => r.n), [1, 3, 1]);
  assert.deepEqual(dc.crit.map((c) => c.at), [2, 2]);
}
console.log("engine: ok");
// 11. il bordo del dominio sulla griglia: √x = x − k perde la radice vicino a x = 0 solo se la riga x = 0 non è esatta
{
  const A = rel("y = sqrt(x)").F, B = rel("y = x - k").F;
  const sc = G.scan(A, B, -1, 3, 0, 6, { nk: 160, N: 80 }), d = G.discuss(A, B, sc);
  assert.deepEqual(d.runs.map((r) => r.n), [0, 2, 1]);
  near(d.crit[1].k, 0, 5e-3, "la radice s = 0 esce dal dominio a k = 0");
}
console.log("engine: ok (domain edge)");
