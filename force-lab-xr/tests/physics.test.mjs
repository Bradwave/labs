// Force Lab XR · physics tests (plain node)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const P = require("../js/physics.js");
const { len, sub } = P.V;
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok", name); };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const run = (s, env, T) => { const k = Math.round(T / P.DT); for (let i = 0; i < k; i++) P.step(s, env); return s; };

ok("no force: straight line at constant velocity (first law)", () => {
  const s = run({ p: [0, 1, 0], v: [0.3, 0, -1], m: 0.5 }, { zones: [], g: 0 }, 2);
  close(s.p[0], 0.6, 1e-9, "x"); close(s.p[2], -2, 1e-9, "z"); close(len(s.v), Math.hypot(0.3, 1), 1e-12, "speed");
});
ok("uniform zone: x = x0 + v t + ½ a t², a = F/m", () => {
  const z = { min: [-9, -9, -9], max: [9, 9, 9], F: [0.5, 0, 0] };
  for (const m of [0.25, 0.5, 1]) {
    const s = run({ p: [0, 0, 0], v: [0, 0, 1], m }, { zones: [z], g: 0 }, 1);
    close(s.p[0], 0.5 * (0.5 / m) * 1, 0.01, "x at m=" + m); close(s.v[0], 0.5 / m, 1e-9, "vx");
  }
});
ok("same force, bigger mass, smaller acceleration; gravity is the same for every mass", () => {
  const z = { min: [-9, -9, -9], max: [9, 9, 9], F: [0, 0, -0.5] };
  const a1 = P.forces([0, 0, 0], 0.5, { zones: [z], g: 1 }).a, a2 = P.forces([0, 0, 0], 1, { zones: [z], g: 1 }).a;
  close(a1[2], -1, 1e-12, "a light"); close(a2[2], -0.5, 1e-12, "a heavy"); close(a1[1], -1, 1e-12, "g light"); close(a2[1], -1, 1e-12, "g heavy");
});
ok("overlapping zones add (superposition); outside a zone no force", () => {
  const A = { min: [0, 0, 0], max: [2, 2, 2], F: [0.3, 0, 0] }, B = { min: [1, 0, 0], max: [3, 2, 2], F: [0, 0.4, 0] };
  const f = P.forces([1.5, 1, 1], 0.5, { zones: [A, B] });
  assert.deepEqual(f.net, [0.3, 0.4, 0]); assert.deepEqual(f.inside, [0, 1]);
  assert.deepEqual(P.forces([5, 1, 1], 0.5, { zones: [A, B] }).net, [0, 0, 0]);
});
ok("a is parallel to the net force, v need not be", () => {
  const f = P.forces([0, 0, 0], 0.5, { zones: [{ min: [-1, -1, -1], max: [1, 1, 1], F: [0.2, 0.1, 0] }], g: 1 });
  const cr = [f.a[1] * f.net[2] - f.a[2] * f.net[1], f.a[2] * f.net[0] - f.a[0] * f.net[2], f.a[0] * f.net[1] - f.a[1] * f.net[0]];
  close(len(cr), 0, 1e-12, "a × F");
});
ok("rubber band: slack inside rest + dead zone, pulls beyond, capped, never pushes", () => {
  const band = { anchor: [0, 0, 0], rest: 0.3 };
  assert.deepEqual(P.bandForce([0, 0, -0.4], band).F, [0, 0, 0]);         // 0.4 < 0.3 + 0.15
  assert.deepEqual(P.bandForce([0, 0, -0.1], band).F, [0, 0, 0]);         // closer: still slack (no push)
  const f = P.bandForce([0, 0, -0.65], band).F;                           // stretch 0.2 → 0.8 N toward the hand
  close(f[2], 4 * 0.2, 1e-12, "Hooke"); assert.ok(f[2] > 0);
  close(len(P.bandForce([0, 0, -5], band).F), P.BAND.cap, 1e-12, "cap");
});
ok("band orbit: circular motion stays circular (energy bounded)", () => {
  const s = { p: [0.5, 0, 0], v: [0, 0, -1], m: 0.5 };
  const env = { zones: [], g: 0, band: { anchor: [0, 0, 0], rest: 0.10 } };
  let rmin = 9, rmax = 0;
  for (let i = 0; i < 240 * 10; i++) { P.step(s, env); const r = len(s.p); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
  assert.ok(rmin > 0.48 && rmax < 0.52, `radius stays near 0.5: ${rmin}..${rmax}`);
});
ok("ring crossing: right way only, inside the radius, no tunnelling at 20 m/s", () => {
  const g = { p: [0, 0, -1], n: [0, 0, -1], r: 0.2 };
  assert.ok(P.crossRing(g, [0, 0, -0.9], [0, 0, -1.1]) >= 0);
  assert.equal(P.crossRing(g, [0, 0, -1.1], [0, 0, -0.9]), -1, "backwards");
  assert.equal(P.crossRing(g, [0.3, 0, -0.9], [0.3, 0, -1.1]), -1, "outside");
  const s = { p: [0, 0, -0.5], v: [0, 0, -20], m: 0.5 }; let hit = false;
  for (let i = 0; i < 30; i++) { const seg = P.step(s, { zones: [] }); if (P.crossRing(g, seg.p0, seg.p1) >= 0) hit = true; }
  assert.ok(hit, "fast ball detected");
});
ok("target needs the ball inside and slow", () => {
  const g = { p: [0, 0, 0], r: 0.25, vmax: 0.3 };
  assert.ok(P.inTarget(g, [0.1, 0, 0], [0.2, 0, 0])); assert.ok(!P.inTarget(g, [0.1, 0, 0], [0.5, 0, 0])); assert.ok(!P.inTarget(g, [0.4, 0, 0], [0, 0, 0]));
});
ok("split of a: along v and across v", () => {
  const s = P.splitA([1, 1, 0], [2, 0, 0]);
  assert.deepEqual(s.par, [1, 0, 0]); assert.deepEqual(s.perp, [0, 1, 0]);
});
ok("snapping: directions to axes/diagonals within 8°, magnitude to 0.05 N, capped", () => {
  const f = P.snapForce([0.98, 0.05, 0], 1); close(f[0], 1, 1e-9, "x"); close(f[1], 0, 1e-9, "y");
  const d = P.snapForce([0.31, 0.29, 0], 1); close(d[0], d[1], 1e-9, "diagonal");
  close(len(P.snapForce([0, 0, 3], 0.8)), 0.8, 1e-12, "cap");
  const free = P.snapForce([0.98, 0.05, 0], 1, { snap: false }); close(free[1], 0.05, 1e-12, "no snap");
});
ok("prediction follows the simulation", () => {
  const env = { zones: [{ min: [-9, -9, -9], max: [9, 9, 9], F: [0.5, 0, 0] }], g: 0 };
  const pts = P.predict([0, 0, 0], [0, 0, -1], 0.5, env, 1, 0.1);
  const s = run({ p: [0, 0, 0], v: [0, 0, -1], m: 0.5 }, env, 1);
  close(len(sub(pts[pts.length - 1], s.p)), 0, 1e-9, "end point");
});
console.log(`\n${n} physics tests passed`);
