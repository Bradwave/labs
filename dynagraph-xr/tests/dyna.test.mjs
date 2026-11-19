// Dynagraph XR · modello puro: viste, tacche, catena, connessioni, campioni, traccia, link
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const req = createRequire(import.meta.url);
const E = req("../js/expr.js"), D = req("../js/dyna.js");
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m || ""} ${a} vs ${b}`);

// 1. vista: valore ↔ posizione, zoom, spostamento, intervallo
{
  const w = D.newView();
  near(D.valToX(5, w), D.R, 1e-12); near(D.valToX(0, w), 0, 1e-12); near(D.xToVal(D.valToX(3.3, w), w), 3.3, 1e-12);
  assert.ok(D.inView(5, w) && !D.inView(5.1, w) && !D.inView(NaN, w));
  near(D.edgeX(100, w), D.EDGE, 1e-12, "fuori vista: resta sul bordo");
  near(D.zoom(w, 2).hr, 2.5, 1e-12);
  assert.equal(D.zoom({ c: 0, hr: 0.03 }, 100).hr, 0.02, "limite minimo");
  near(D.pan(w, D.R / 2).c, -2.5, 1e-12, "trascinare a destra sposta la vista a sinistra");
  const r = D.setRange(w, -1, 3); near(r.c, 1, 1e-12); near(r.hr, 2, 1e-12);
  assert.equal(D.setRange(w, 3, 1), w, "intervallo non valido: invariato");
}
// 2. tacche tonde
{
  assert.equal(D.niceStep(5), 1); assert.equal(D.niceStep(50), 10); assert.equal(D.niceStep(1), 0.2);
  const t = D.ticks(D.newView()); assert.deepEqual(t.values.slice(0, 3), [-5, -4, -3]); assert.equal(t.values.length, 11);
}
// 3. catena e connessioni (h si applica all'uscita di f)
{
  const f = E.compileFn("x + 1", "x"), g = E.compileFn("x^2 / 2", "x"), h = E.compileFn("sin(x)", "x");
  const fns = { f, g, h };
  let c = D.chain(fns, "f", 1, true); near(c.y, 2, 1e-12); near(c.hv, Math.sin(2), 1e-12);
  c = D.chain(fns, "g", 2, true); near(c.y, 2, 1e-12); near(c.hv, Math.sin(2), 1e-12);
  assert.ok(Number.isNaN(D.chain(fns, "f", 1, false).hv), "h spenta: nessuna uscita");
  const sq = E.compileFn("sqrt(x)", "x"); assert.ok(Number.isNaN(D.chain({ f: sq, g, h }, "f", -1, true).hv), "f non definita → h non definita");
  assert.deepEqual(D.lines("both", false), { l12: true, l23: false, l13: false });
  assert.deepEqual(D.lines("2_to_3", true), { l12: true, l23: true, l13: false });
  assert.deepEqual(D.lines("1_to_3", true), { l12: false, l23: false, l13: true });
  assert.deepEqual(D.lines("both", true), { l12: true, l23: true, l13: true });
  assert.equal(D.nextConn("2_to_3"), "1_to_3"); assert.equal(D.nextConn("both"), "2_to_3");
}
// 4. campioni
{
  const w = D.newView(), xs = D.sampleXs(w, { density: 10 }, 0.3);
  assert.ok(xs.length > 20 && xs.length <= 160 && xs.every((x) => x >= -5 && x <= 5));
  assert.ok(!xs.some((x) => Math.abs(x - 0.3) < 1e-9), "l'ingresso corrente non è un campione");
  assert.ok(D.sampleXs(w, { density: 30 }, 0).length > D.sampleXs(w, { density: 1 }, 0).length, "più densità, più campioni");
  assert.deepEqual(D.sampleXs(w, { interval: 1, start: 0, end: 3 }, 99), [0, 1, 2, 3], "intervallo esatto, da start a end");
  assert.ok(D.sampleXs(D.newView(), { interval: 0.0001 }, 0).length <= 160, "tetto sul numero di campioni");
  assert.deepEqual(D.sampleXs(w, { start: 3, end: 1 }, 0), []);
  const zoomed = D.sampleXs({ c: 100, hr: 5 }, { density: 10 }, 0); assert.ok(zoomed.every((x) => x >= 95 && x <= 105), "segue la vista");
}
// 4b. grafico cartesiano
{
  const sq = E.compileFn("x^2", "x"), w = D.newView(), segs = D.curve(sq, w, w, 200);
  assert.equal(segs.length, 1); assert.ok(segs[0].every(([u, v]) => Math.abs(u) <= 1 && Math.abs(v) <= 1), "dentro il riquadro");
  near(segs[0][0][0], -Math.sqrt(5) / 5, 0.02, "x² esce dal riquadro oltre ±√5");
  assert.equal(D.curve(E.compileFn("1/x", "x"), w, w, 200).length, 2, "1/x: due rami, il salto non è unito");
  assert.equal(D.curve(E.compileFn("sqrt(x)", "x"), w, w, 200).length, 1, "sqrt: solo dove è definita");
  assert.deepEqual(D.curve(E.compileFn("x + 100", "x"), w, w, 50), [], "tutta fuori: nessun segmento");
}
// 5. traccia: passo minimo, tetto, fasce di età
{
  const t = new D.Trace(3);
  assert.ok(t.push(0, 0.1) && !t.push(0.05, 0.1) && t.push(0.2, 0.1) && t.push(0.4, 0.1) && t.push(0.6, 0.1));
  assert.deepEqual(t.pts.map((v) => +v.toFixed(1)), [0.2, 0.4, 0.6], "tiene solo le ultime");
  t.setMax(2); assert.equal(t.pts.length, 2); t.clear(); assert.equal(t.pts.length, 0);
  assert.deepEqual([0, 1, 2, 3].map((i) => D.bucket(i, 4, 4)), [0, 1, 2, 3]);
}
// 6. link: andata e ritorno
{
  const s = Object.assign({}, D.DEFAULTS, { f: "x^2", g: "2x+1", h: "cos(x)", xf: 1.25, xg: -2, link: true, hOn: true, conn: "both", cart: true, full: false,
    col: { f: 3, g: 1, h: 2 }, view: { in: { c: 1, hr: 2 }, out: D.newView(), comp: { c: 0, hr: 0.5 } } });
  const back = D.fromQuery(D.toQuery(s));
  assert.equal(back.f, "x^2"); assert.equal(back.g, "2x+1"); assert.equal(back.h, "cos(x)");
  assert.equal(back.xf, 1.25); assert.equal(back.xg, -2);
  assert.ok(back.link && back.hOn && back.cart && !back.full); assert.equal(back.conn, "both");
  assert.equal(back.col.f, 3); assert.equal(back.col.h, 2);
  assert.deepEqual(back.view.in, { c: 1, hr: 2 }); assert.deepEqual(back.view.out, { c: 0, hr: 5 }); assert.deepEqual(back.view.comp, { c: 0, hr: 0.5 });
  assert.equal(D.fromQuery(""), null); assert.equal(D.fromQuery("#zzz=1"), null);
  const d = D.fromQuery("f=x&cn=bogus&cf=99&vin=abc"); assert.equal(d.conn, "2_to_3"); assert.equal(d.col.f, 0); assert.deepEqual(d.view.in, { c: 0, hr: 5 });
  assert.ok(D.toQuery(Object.assign({}, D.DEFAULTS, { col: D.DEFAULT_COLORS, view: {} })).indexOf("link") < 0, "i valori predefiniti non sporcano il link");
}
console.log("dyna: ok");
