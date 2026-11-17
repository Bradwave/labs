// Collision Lab · tests/physics.test.mjs
// Conservation laws and textbook results for the disc model. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, step, totals, states, explode, headOn, contactTime, cloneWorld } from "../js/physics.js";

const close = (a, b, tol = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b}`);
const run = (w, T, h = 1 / 120) => {
  for (let t = 0; t < T - 1e-12; t += h) step(w, h);
};

test("contact time of two discs", () => {
  close(contactTime(1, 0, -1, 0, 0.2), 0.8);
  assert.equal(contactTime(1, 0, 1, 0, 0.2), null); // moving apart
  assert.equal(contactTime(1, 1, -1, 0, 0.2), null); // passes by
  assert.equal(contactTime(0.1, 0, -1, 0, 0.2), 0); // already overlapping and approaching
});

test("head-on collisions match the textbook formulas for every e", () => {
  for (const e of [0, 0.3, 0.7, 1])
    for (const [m1, m2, v1, v2] of [[0.25, 0.25, 1, 0], [0.5, 0.25, 1, -0.5], [0.1, 1, 2, 0]]) {
      const w = createWorld([{ m: m1, r: 0.05, x: 0.5, y: 0.6, vx: v1, vy: 0 }, { m: m2, r: 0.05, x: 1.2, y: 0.6, vx: v2, vy: 0 }], { e });
      run(w, 3);
      const [a, b] = states(w);
      const [u1, u2] = headOn(m1, v1, m2, v2, e);
      close(a.vx, u1, 1e-9, `e=${e} v1'`);
      close(b.vx, u2, 1e-9, `e=${e} v2'`);
      close(a.vy, 0);
    }
});

test("momentum is conserved and kinetic energy never grows", () => {
  for (const e of [0, 0.5, 1]) {
    const w = createWorld([{ m: 0.25, r: 0.045, x: 0.4, y: 0.62, vx: 1.3, vy: 0 }, { m: 0.6, r: 0.07, x: 1.1, y: 0.6, vx: -0.2, vy: 0.05 }], { e });
    const t0 = totals(w);
    run(w, 4);
    const t1 = totals(w);
    close(t1.Px, t0.Px, 1e-12);
    close(t1.Py, t0.Py, 1e-12);
    assert.ok(t1.K <= t0.K + 1e-12);
    if (e === 1) close(t1.K, t0.K, 1e-12);
    assert.ok(w.events.some((ev) => ev.kind === "hit"), "they should collide");
    close(t1.Kcm, t0.Kcm, 1e-12, "the energy of the centre of mass stays");
  }
});

test("equal masses, elastic, target at rest: they leave at 90°", () => {
  const w = createWorld([{ m: 0.25, r: 0.045, x: 0.4, y: 0.6 + 0.045, vx: 1, vy: 0 }, { m: 0.25, r: 0.045, x: 1.15, y: 0.6 }], { e: 1 });
  run(w, 2);
  const [a, b] = states(w);
  close(a.vx * b.vx + a.vy * b.vy, 0, 1e-12);
  assert.ok(Math.hypot(a.vx, a.vy) > 0.1 && Math.hypot(b.vx, b.vy) > 0.1);
});

test("discs that stick: momentum and angular momentum kept, energy lost", () => {
  const w = createWorld([{ m: 0.25, r: 0.045, x: 0.4, y: 0.65, vx: 1, vy: 0 }, { m: 0.5, r: 0.06, x: 1.1, y: 0.6 }], { sticky: true });
  const t0 = totals(w);
  // angular momentum about the (moving) centre of mass is constant: compute it about the origin instead
  const L = (w) => states(w).reduce((s, d, i) => s + w.discs[i].m * (d.x * d.vy - d.y * d.vx), 0);
  const L0 = L(w);
  run(w, 3);
  const t1 = totals(w);
  assert.equal(w.clusters.length, 1);
  close(t1.Px, t0.Px, 1e-12);
  close(t1.Py, t0.Py, 1e-12);
  close(L(w), L0, 1e-9, "angular momentum");
  assert.ok(t1.K < t0.K);
  assert.ok(Math.abs(w.clusters[0].w) > 0.1, "an off-centre hit makes the pair spin");
  close(t1.Kcm, t0.Kcm, 1e-12);
  // the pair stays rigid: the distance between the centres does not change
  const [a, b] = states(w);
  close(Math.hypot(b.x - a.x, b.y - a.y), 0.105, 1e-9);
});

test("explosion from rest: equal and opposite momenta, released energy as asked", () => {
  const w = createWorld([{ m: 0.25, r: 0.045, x: 0.9, y: 0.6, group: 1 }, { m: 0.75, r: 0.078, x: 0.9 + 0.123, y: 0.6, group: 1 }]);
  explode(w, 0, 0.4);
  const t = totals(w);
  close(t.Px, 0, 1e-12);
  close(t.K, 0.4, 1e-12);
  const [a, b] = t.per;
  close(a.px, -b.px, 1e-12);
  close(a.vx / b.vx, -3, 1e-9); // v ∝ 1/m
});

test("bumpers: the external impulse accounts for every change of momentum", () => {
  const w = createWorld([{ m: 0.3, r: 0.05, x: 0.5, y: 0.5, vx: 1.2, vy: 0.7 }, { m: 0.4, r: 0.06, x: 1.4, y: 0.7, vx: -0.4, vy: 0.3 }], { e: 0.8, walls: { W: 2, H: 1.2 } });
  const t0 = totals(w);
  run(w, 6);
  const t1 = totals(w);
  assert.ok(w.events.some((e) => e.kind === "wall"));
  close(t1.Px - t0.Px, w.ext.x, 1e-9);
  close(t1.Py - t0.Py, w.ext.y, 1e-9);
  for (const s of states(w)) assert.ok(s.x > 0 && s.x < 2 && s.y > 0 && s.y < 1.2);
});

test("a rack of ten: momentum conserved, clone is independent", () => {
  const r = 0.045, dx = (2 * r + 0.002) * Math.cos(Math.PI / 6), dy = r + 0.001;
  const bodies = [{ m: 0.25, r, x: 0.35, y: 0.6, vx: 1.5, vy: 0 }];
  for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) bodies.push({ m: 0.25, r, x: 1.15 + row * dx, y: 0.6 + (2 * k - row) * dy });
  const w = createWorld(bodies, { e: 0.95 });
  const c = cloneWorld(w);
  run(w, 3);
  const t1 = totals(w);
  close(t1.Px, 0.375, 1e-9);
  close(t1.Py, 0, 1e-9);
  assert.equal(totals(c).per[0].vx, 1.5);
  assert.equal(c.t, 0);
  // no two discs overlap at the end
  const S = states(w);
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) assert.ok(Math.hypot(S[i].x - S[j].x, S[i].y - S[j].y) >= 2 * r - 1e-6);
});
