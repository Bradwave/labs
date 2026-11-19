// Composition Lab XR · modello puro: parser di funzioni, catena, campionamento, ordine, traccia, esempi
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const req = createRequire(import.meta.url);
const E = req("../js/expr.js"), C = req("../js/compose.js");
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m || ""} ${a} vs ${b}`);

// 1. funzioni di una variabile
{
  const f = E.compileFn("x^2 - 1", "x"); near(f(3), 8, 1e-12);
  near(E.compileFn("2(y - 1)", "y")(2), 2, 1e-12, "prodotto implicito");
  near(E.compileFn("2sin(2y)", "y")(0.5), 2 * Math.sin(1), 1e-12);
  assert.ok(Number.isNaN(E.compileFn("sqrt(x)", "x")(-1)), "fuori dominio → NaN");
  assert.ok(Number.isNaN(E.compileFn("1/x", "x")(0)), "1/0 → NaN (non Infinity)");
  assert.equal(E.tryFn("x + y", "x").error.code, "err.var", "f non può usare y");
  assert.equal(E.tryFn("y = x", "x").ok, false, "niente segni di relazione");
  assert.equal(E.tryFn("", "x").error.code, "err.empty");
  assert.equal(E.tryFn("x^", "x").ok, false);
}
// 2. catena e dominio
{
  const f = E.compileFn("x^2", "x"), g = E.compileFn("y - 2", "y");
  let c = C.chain(f, g, 1.5); near(c.y, 2.25, 1e-12); near(c.z, 0.25, 1e-12); assert.ok(c.okZ);
  c = C.chain(f, g, 3); assert.ok(!c.okY, "f(3) = 9 esce dal cubo"); assert.ok(!c.okZ);
  const h = E.compileFn("sqrt(y)", "y"); c = C.chain(E.compileFn("-x", "x"), h, 1);
  assert.ok(c.okY && !c.okZ, "√(−1) non esiste: il secondo passo manca");
}
// 3. campionamento: si spezza dove non è definita o salta
{
  const segs = C.sample(-4, 4, 400, (x) => [x, 1 / x, 0]);
  assert.ok(segs.length >= 2, "1/x ha due rami");
  for (const s of segs) for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i][1] - s[i - 1][1]) <= 0.6 * C.R + 1e-9, "nessun salto lungo il polo");
  const r = C.range(E.compileFn("x^2 - 2", "x")); near(r.lo, -2, 1e-3); near(r.hi, 4, 0.1, "f ≤ 4 nel cubo");
}
// 4. ordine: una funzione che inverte e una che conserva
{
  const f = E.compileFn("-x/2", "x"), g = E.compileFn("-2y", "y");
  const o = C.order(C.chain(f, g, 1), C.chain(f, g, 2));
  assert.deepEqual([o.rx, o.ry, o.rz], ["<", ">", "<"]); assert.deepEqual([o.f, o.g, o.gf], ["flip", "flip", "keep"], "due inversioni conservano");
  const sq = E.compileFn("x^2", "x"), id = E.compileFn("y", "y");
  assert.equal(C.order(C.chain(sq, id, -1), C.chain(sq, id, 1)).f, "flat", "x² rende uguali ±1");
  assert.equal(C.order(C.chain(sq, id, 1), C.chain(sq, id, 1)).f, "none");
}
// 5. traccia: copre anche i salti veloci della mano, senza ripetere
{
  const t = new C.Trail();
  assert.equal(t.mark("x0", 0).length, 1);
  const n = t.mark("x0", 1).length; near(n, 1 / (2 * C.R / C.NB), 1.5, "da 0 a 1 coprono ~40 classi");
  assert.equal(t.mark("x0", 1).length, 0); assert.equal(t.mark("x0", 0.5).length, 0, "già visitate");
  t.clear(); assert.equal(t.mark("x0", 0.5).length, 1);
  near(t.xOf(C.NB / 2), 0, 1e-12); near(C.snap(1.234), 1.25, 1e-12); near(C.snap(9), C.R, 1e-12);
}
// 6. ogni esempio si legge e ha un valore iniziale visibile in tutti e tre i piani
for (const p of C.LIST) {
  const f = E.tryFn(p.f, "x"), g = E.tryFn(p.g, "y"); assert.ok(f.ok && g.ok, p.id);
  assert.ok(C.chain(f.fn, g.fn, p.x).okZ, `${p.id}: x₀ iniziale deve dare un risultato nel cubo`);
  assert.ok(C.sample(-C.R, C.R, 200, (x) => [x, f.fn(x), 0]).length >= 1, `${p.id}: f ha un tratto visibile`);
}
console.log("compose.test.mjs ok");
