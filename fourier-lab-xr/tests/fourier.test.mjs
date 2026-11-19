// Fourier Lab XR · matematica pura
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const F = createRequire(import.meta.url)("../js/fourier.js");
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m || ""} ${a} vs ${b}`);

// 1. una sinusoide a 2 Hz: c(f) ha un picco a 2 Hz di modulo ≈ A/2; lontano dal picco è piccolo
{
  const m = new F.Model();
  m.setPreset("one");
  const c2 = Math.hypot(...m.com(2));
  near(c2, 0.5, 0.01, "|c(2)| = A/2");
  assert.ok(Math.hypot(...m.com(3.2)) < 0.05, "lontano dal picco");
  assert.equal(m.peaks.length, 1);
  near(m.peaks[0].f, 2, 0.04, "picco a 2 Hz");
}
// 2. due sinusoidi: due picchi, ai posti giusti
{
  const m = new F.Model(); m.setPreset("two");
  assert.equal(m.peaks.length, 2);
  near(m.peaks[0].f, 1.5, 0.05); near(m.peaks[1].f, 3.5, 0.05);
}
// 3. valore medio: c(0) = media di g
{
  const m = new F.Model(); m.setPreset("mean");
  near(m.com(0)[0], 1, 0.01, "c(0) = dc");
  near(m.com(0)[1], 0, 1e-9);
}
// 4. wound(): il centro di massa restituito coincide con com(f) e il primo punto è (g0, 0)
{
  const m = new F.Model(); m.setPreset("two");
  const buf = new Float32Array(3 * 200);
  const c = m.wound(1.7, buf, 200), d = m.com(1.7);
  near(c[0], d[0], 1e-9); near(c[1], d[1], 1e-9);
  near(buf[0], m.g[0] * Math.cos(F.TAU * 1.7 * m.tk[0]), 1e-4);
  near(buf[1], -m.g[0] * Math.sin(F.TAU * 1.7 * m.tk[0]), 1e-4);
}
// 5. manopola: un giro orario di avvolgimento = +1 Hz, anche attraverso ±π
{
  let f = 0, prev = F.knobAngle(1, 0);
  for (let i = 1; i <= 100; i++) {
    const psi = (i / 100) * F.TAU * 1.25;               // la mano percorre 1,25 giri nello stesso verso dell'avvolgimento
    const cur = F.knobAngle(Math.cos(psi), -Math.sin(psi));
    f += F.crankDelta(prev, cur); prev = cur;
  }
  near(f, 1.25, 1e-9, "1,25 giri = 1,25 Hz");
  // senso opposto: f scende
  const d = F.crankDelta(F.knobAngle(1, 0), F.knobAngle(Math.cos(0.1), +Math.sin(0.1)));
  assert.ok(d < 0);
}
// 6. esplorazione e bandierine
{
  const m = new F.Model(); m.setPreset("one");
  assert.equal(m.coverage(), 0);
  m.markVisited(0, 3);
  near(m.coverage(), 0.5, 0.01);
  const r = F.evalFlags([2.1, 4.5], m.peaks);
  assert.ok(r[0].ok && !r[1].ok);
}
// 7. il rumore non cambia tra due calcoli (generatore col seme)
{
  const a = new F.Model(), b = new F.Model(); a.setPreset("noisy"); b.setPreset("noisy");
  assert.deepEqual(Array.from(a.g.slice(0, 5)), Array.from(b.g.slice(0, 5)));
}
// 8. ruota: lanciata in senso orario gira per inerzia e rallenta; f = κ w; all'indietro non conta; ferma la blocca
{
  const w = new F.Wheel();
  for (let i = 0; i < 20; i++) w.drive(0.02, 0.016);            // ~1,25 giri/s
  assert.ok(w.w > 0.8 && w.w <= w.wmax(), "lancio " + w.w);
  w.release();
  const w0 = w.w; let f = 0;
  for (let i = 0; i < 60; i++) f = w.step(0.016);
  assert.ok(w.w < w0 && w.w > 0, "rallenta ma gira");
  near(f, w.kappa * w.w, 1e-9, "f = κ w");
  const b = new F.Wheel(); b.drive(-0.05, 0.016); assert.equal(b.w, 0, "solo orario");
  const c = new F.Wheel(); for (let i = 0; i < 10; i++) c.drive(0.03, 0.016);
  for (let i = 0; i < 10; i++) c.step(0.016); c.release(); assert.equal(c.w, 0, "mano ferma = blocca");
  const d = new F.Wheel(); d.w = 0.5; for (let i = 0; i < 3000; i++) d.step(0.016); assert.equal(d.w, 0, "si ferma da sola");
  const e = new F.Wheel(); e.setKappa(4, 3); near(e.w, 0.75, 1e-9, "f continua al cambio di κ");
}
// 9. prodotto: la media di g cos è Re c e quella di −g sin è Im c
{
  const m = new F.Model(); m.setPreset("two");
  const re = new Float64Array(F.NS), im = new Float64Array(F.NS);
  for (const f of [0, 1.5, 2.2, 3.5]) {
    m.products(f, re, im);
    const mr = re.reduce((a, b) => a + b, 0) / F.NS, mi = im.reduce((a, b) => a + b, 0) / F.NS, c = m.com(f);
    near(mr, c[0], 1e-9, "media g cos"); near(mi, c[1], 1e-9, "media −g sin");
  }
}
// 10. cammino: I(T) = T·c, e a frequenza giusta il cammino è un segmento lungo, altrove si richiude
{
  const m = new F.Model(); m.setPreset("one");
  const out = new Float32Array(2 * 100);
  const e = m.walk(2, out, 100), c = m.com(2);
  near(e[0], F.T * c[0], 1e-9, "I(T)"); near(e[1], F.T * c[1], 1e-9);
  near(out[2 * 99], e[0], 0.05, "l'ultimo punto è la fine");
  const far = m.walk(3.1, new Float32Array(200), 100);
  assert.ok(Math.hypot(far[0], far[1]) < 0.1 * Math.hypot(e[0], e[1]), "fuori frequenza si richiude");
}
// 11. epicicli: la somma dei fasori dei picchi ricostruisce il segnale
{
  for (const key of ["one", "two", "mean"]) {
    const m = new F.Model(); m.setPreset(key);
    const ph = m.phasors(4); let err = 0, norm = 0;
    for (let k = 0; k < F.NS; k += 7) { let v = 0; for (const p of ph) v += p.A * Math.cos(F.TAU * p.f * m.tk[k] + p.phi); err += (v - m.g[k]) ** 2; norm += m.g[k] ** 2; }
    assert.ok(Math.sqrt(err / norm) < 0.08, key + " ricostruito " + Math.sqrt(err / norm));
  }
}
// 12. campioni da ascoltare: periodici e fedeli al segnale; la frequenza portata nell'udibile ha un periodo intero
{
  const m = new F.Model(); m.setPreset("one");
  const n = 1760, s = m.signalSamples(n);
  near(s[0], Math.cos(F.TAU * 2 * 0), 0.02, "inizio");
  const i = 440; near(s[i], Math.cos(F.TAU * 2 * (i / n) * F.T), 0.02, "un punto qualsiasi");
  assert.ok(Math.abs(s[n - 1] - s[0]) < 0.2, "periodico");
}
// 13. manopola della radio: la scala copre 0–6 Hz in 270°, un giro orario aggiunge HZ_PER_TURN
{
  near(F.dialPhi(0), -0.75 * Math.PI, 1e-12); near(F.dialPhi(F.FMAX), 0.75 * Math.PI, 1e-12);
  near(F.HZ_PER_TURN, 8, 1e-12);
  assert.ok(F.dialTurn(F.dialAngle(0, 1), F.dialAngle(1, 0)) > 0.2, "da 12 a 3 è orario");  // verticale → destra
  near(F.dialTurn(3.0, -3.0), (2 * Math.PI - 6) / F.TAU, 1e-9, "attraverso ±π");
}
console.log("fourier.test.mjs: ok");
