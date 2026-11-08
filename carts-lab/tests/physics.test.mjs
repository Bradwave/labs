import assert from 'node:assert/strict';
import { World } from '../js/physics.js';
import { CFG } from '../js/config.js';
import { Recorder, trueReadings, instrumentValue, derivative, mulberry32, buildSeries, hiddenMasses, scaleReading } from '../js/sensors.js';
import { polyfit, evalFit } from '../js/fit.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('ok  ', name); };
const run = (w, secs) => { const n = Math.round(secs / CFG.DT); for (let i = 0; i < n; i++) w.step(); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const fresh = (preset) => {
  const w = new World(); w.mu = 0; w.setRail(3); w.preset(preset);
  if (preset !== 'explosion') { w.carts.A.x = w.home.A = 1.0; w.carts.B.x = w.home.B = 1.4; }
  return w;
};

ok('magnetic elastic collision conserves p and K, exchanges velocity (equal masses)', () => {
  const w = fresh('elastic');
  w.launch('A', 0.4);
  const p0 = w.momentum(), k0 = w.kinetic();
  run(w, 2);
  near(w.momentum(), p0, 2e-3, 'p');
  near(w.kinetic(), k0, 0.02 * k0, 'K');
  near(w.carts.A.v, 0, 0.01, 'vA');
  near(w.carts.B.v, 0.4, 0.01, 'vB');
});

ok('magnetic collision never touches at 0.4 m/s relative', () => {
  const w = fresh('elastic');
  w.launch('A', 0.4);
  let minGap = Infinity;
  const n = Math.round(3 / CFG.DT);
  for (let i = 0; i < n; i++) { w.step(); const g = (w.carts.B.x - 0.06) - (w.carts.A.x + 0.06); if (g < minGap) minGap = g; }
  assert.ok(minGap > 0.002, 'min gap ' + minGap);
});

ok('velcro collision is perfectly inelastic: common v = p/M', () => {
  const w = fresh('sticky');
  w.launch('A', 0.4);
  run(w, 3);
  near(w.carts.A.v, 0.2, 0.005, 'vA'); near(w.carts.B.v, 0.2, 0.005, 'vB');
  near(w.momentum(), 0.4, 2e-3, 'p');
});

ok('inelastic collision with unequal masses', () => {
  const w = fresh('sticky');
  w.setExtra('m1', 'B');         // B = 2 kg
  w.launch('A', 0.6);
  run(w, 3);
  near(w.carts.A.v, 0.2, 0.005); near(w.carts.B.v, 0.2, 0.005);
});

ok('spring (active) collision is nearly elastic, momentum conserved', () => {
  const w = fresh('spring');
  w.launch('A', 0.5);
  const p0 = w.momentum(), k0 = w.kinetic();
  run(w, 2.5);
  near(w.momentum(), p0, 2e-3);
  assert.ok(w.kinetic() > 0.8 * k0 && w.kinetic() <= k0 * 1.001, 'K ' + w.kinetic());
});

ok('spring blocked: hard collision loses energy but conserves p', () => {
  const w = fresh('spring');
  w.setPlunger('A', 'blocked');
  w.launch('A', 0.5);
  const p0 = w.momentum(), k0 = w.kinetic();
  run(w, 2.5);
  near(w.momentum(), p0, 2e-3);
  assert.ok(w.kinetic() < 0.9 * k0, 'K ' + w.kinetic() + ' of ' + k0);
});

ok('loaded plunger "explosion": total p = 0, K = stored energy', () => {
  const w = fresh('explosion');
  w.setLevel('A', 2);
  assert.ok(w.fire('A'));
  run(w, 1.0);
  near(w.momentum(), 0, 1e-3);
  const E = 0.5 * CFG.K_FIRE * CFG.FIRE_E[1] ** 2;
  near(w.kinetic(), E, 0.05 * E, 'K');
  assert.ok(w.carts.A.v < 0 && w.carts.B.v > 0);
});

ok('heavier cart moves slower after explosion (m1 v1 = −m2 v2)', () => {
  const w = fresh('explosion');
  w.setExtra('m1', 'B');
  w.fire('A');
  run(w, 0.5);
  near(w.carts.A.v * 1 + w.carts.B.v * 2, 0, 1e-3);
  assert.ok(Math.abs(w.carts.A.v) > Math.abs(w.carts.B.v));
});

ok('rolling friction: constant deceleration mu g', () => {
  const w = fresh('elastic'); w.mu = 0.01; w.carts.B.x = 2.9;
  w.launch('A', 0.3);
  run(w, 1.0);
  const expected = 0.3 - 0.01 * CFG.G * 1.0;
  near(w.carts.A.v, expected, 0.003, 'v after 1 s');
});

ok('friction stops the cart and it stays stopped', () => {
  const w = fresh('elastic'); w.mu = 0.02;
  w.launch('A', 0.15);
  run(w, 2.0);
  assert.equal(w.carts.A.v, 0);
});

ok('compensating tilt (tan θ = μ) keeps velocity almost constant', () => {
  const w = fresh('elastic'); w.mu = 0.005; w.carts.B.x = 2.9;
  w.tiltMm = 15;                 // 15 mm su 3 m → tan θ ≈ 0.005
  w.launch('A', 0.2);
  run(w, 1.0);
  near(w.carts.A.v, 0.2, 0.003, 'v');
});

ok('cart at rest stays at rest if tan θ < μ, rolls if tan θ > μ', () => {
  const a = fresh('elastic'); a.mu = 0.01; a.tiltMm = 15; run(a, 1);
  assert.equal(a.carts.A.v, 0);
  const b = fresh('elastic'); b.mu = 0.01; b.carts.B.x = 2.9; b.tiltMm = 60; run(b, 1);
  assert.ok(b.carts.A.v > 0.05);
});

ok('cart that passes the rail end derails', () => {
  const w = fresh('elastic');
  w.carts.B.x = 2.9; w.home.B = 2.9;
  w.launch('B', 1.0);
  run(w, 0.5);
  assert.ok(w.carts.B.derailed);
});

ok('sensors: dead zone reports the minimum distance, no data when nothing is seen', () => {
  const w = fresh('elastic');
  w.carts.A.x = 0.1;            // faccia sinistra a 4 cm
  const r = trueReadings(w);
  near(r.d[0], 0.04, 1e-9);
  assert.equal(instrumentValue(r.d[0], 0, mulberry32(1)), CFG.DEAD);
  w.carts.A.derailed = true; w.carts.B.derailed = true;
  assert.ok(Number.isNaN(trueReadings(w).d[0]));
});

ok('each sensor sees the cart in front of it; right sensor derivative has opposite sign', () => {
  const w = fresh('elastic');
  w.carts.A.v = 0.4;
  const r = trueReadings(w);
  assert.equal(r.who[0], 'A'); assert.equal(r.who[1], 'B');
  near(r.v[0], 0.4, 1e-12);
  near(r.v[1], 0, 1e-12);
  w.carts.B.v = 0.3;
  near(trueReadings(w).v[1], -0.3, 1e-12);
});

ok('recorder: sample count and times match the sampling frequency', () => {
  const w = fresh('elastic');
  const rec = new Recorder({ f: 30, T: 2, sigma: 0, seed: 1 });
  rec.begin(w);
  const n = Math.round(2.2 / CFG.DT);
  for (let i = 0; i < n; i++) { w.step(); rec.tick(w); }
  assert.equal(rec.t.length, 61);
  near(rec.t[30], 1.0, 1e-12);
  assert.ok(rec.done);
});

ok('velocity from samples of uniform motion equals the true velocity', () => {
  const w = fresh('elastic');
  w.carts.B.x = 2.5;
  w.launch('A', 0.3);
  const rec = new Recorder({ f: 20, T: 1, sigma: 0, seed: 1 });
  rec.begin(w);
  for (let i = 0; i < Math.round(1.1 / CFG.DT); i++) { w.step(); rec.tick(w); }
  const run1 = rec.toRun(1, 'r');
  const s = buildSeries(run1, [false, false]);
  for (let i = 1; i < s[0].v.length - 1; i++) near(s[0].v[i], 0.3, 3e-3, 'v' + i);
  const inv = buildSeries(run1, [true, false]);
  near(inv[0].v[5], -0.3, 3e-3);
});

ok('central difference smears a velocity step over about 2Δt', () => {
  const t = [0, 1, 2, 3, 4, 5], x = [0, 0, 0, 1, 2, 3];
  const v = derivative(t, x);
  assert.deepEqual(v.map((q) => Math.round(q * 100) / 100), [0, 0, 0.5, 1, 1, 1]);
});

ok('fit: exact recovery of a parabola, slope, standard error', () => {
  const ts = Array.from({ length: 40 }, (_, i) => i / 20);
  const ys = ts.map((t) => 0.5 + 0.3 * (t - 0.4) - 0.2 * (t - 0.4) ** 2);
  const f = polyfit(ts, ys, 2, 0.4, 1.8);
  near(f.coef[0], 0.5, 1e-9); near(f.coef[1], 0.3, 1e-9); near(f.coef[2], -0.2, 1e-9);
  near(evalFit(f, 1.0), 0.5 + 0.3 * 0.6 - 0.2 * 0.36, 1e-9);
  const lin = polyfit(ts, ts.map((t) => 2 * t + 1), 1, 0, 1.95);
  near(lin.coef[1], 2, 1e-9); near(lin.r2, 1, 1e-12);
});

ok('fit ignores NaN gaps', () => {
  const ts = [0, 1, 2, 3, 4], ys = [0, 1, NaN, 3, 4];
  const f = polyfit(ts, ys, 1, 0, 4);
  near(f.coef[1], 1, 1e-9); assert.equal(f.n, 4);
});

ok('noise has the requested standard deviation', () => {
  const rng = mulberry32(7), a = [];
  for (let i = 0; i < 4000; i++) a.push(instrumentValue(0.5, 0.001, rng) - 0.5);
  const m = a.reduce((s, q) => s + q, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, q) => s + (q - m) ** 2, 0) / a.length);
  near(sd, 0.001, 0.0001, 'sd');
});

ok('hidden masses: deterministic per seed, in range, distinct, and used by the physics', () => {
  const a = hiddenMasses(42), b = hiddenMasses(42), c = hiddenMasses(43);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  for (let sd = 1; sd <= 300; sd++) {
    const m = hiddenMasses(sd);
    for (const k of ['A', 'B']) assert.ok(m[k] >= CFG.HIDDEN_MIN - 1e-9 && m[k] <= CFG.HIDDEN_MAX + 1e-9, `range seed ${sd}`);
    assert.ok(Math.abs(m.A - m.B) >= CFG.HIDDEN_GAP - 1e-9, `gap seed ${sd}`);
  }
  // con masse diverse l'urto elastico conserva ancora p e K, e la velocità dei due carrelli cambia come previsto
  const w = fresh('elastic'); w.setBase('A', 1.1); w.setBase('B', 0.9);
  w.launch('A', 0.4);
  const p0 = w.momentum(), k0 = w.kinetic();
  run(w, 2);
  near(w.momentum(), p0, 3e-3, 'p'); near(w.kinetic(), k0, 0.03 * k0, 'K');
  near(w.carts.A.v, (1.1 - 0.9) / 2 * 0.4, 0.01, 'vA'); near(w.carts.B.v, 2 * 1.1 / 2 * 0.4, 0.01, 'vB');
});

ok('scale: resolution 1 g, mean equals the true mass, small scatter', () => {
  const rng = mulberry32(5), m = 1.0237, r = [];
  for (let i = 0; i < 2000; i++) r.push(scaleReading(m, rng));
  assert.ok(r.every(Number.isInteger));
  const mean = r.reduce((s, q) => s + q, 0) / r.length;
  near(mean, 1023.7, 0.1, 'mean g');
  const sd = Math.sqrt(r.reduce((s, q) => s + (q - mean) ** 2, 0) / r.length);
  assert.ok(sd > 0.3 && sd < 1.2, `sd ${sd}`);
});

ok('trigger: a launched cart crosses a 10 mm threshold within ~40 ms, a resting cart never does', () => {
  const w = fresh('elastic');
  const d0 = trueReadings(w).d;
  run(w, 1);
  near(trueReadings(w).d[0], d0[0], 1e-9, 'rest');
  w.launch('A', 0.4);
  let t = 0;
  while (Math.abs(trueReadings(w).d[0] - d0[0]) * 1000 <= 10 && t < 1) { w.step(); t += CFG.DT; }
  near(t, 0.025, 0.006, 'trigger time');
});

console.log(`\n${passed} tests passed`);
