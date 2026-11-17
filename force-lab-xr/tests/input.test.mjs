// Force Lab XR · input tests: throw estimator, tap/hold, stick, hand gestures
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const I = require("../js/input.js");
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok", name); };

ok("estimator recovers a known velocity from noisy 72 Hz samples", () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const e = new I.ThrowEstimator(), v = [0.4, 0.8, -1.5];
  let now = 0;
  for (let i = 0; i < 40; i++) { now = i * 1000 / 72; const t = now / 1000; e.push(now, v.map((x, k) => x * t + rnd() * 0.004)); }
  const est = e.velocity(now, "controller");
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(est[k] - v[k]) < 0.12, `axis ${k}: ${est[k]}`);
});
ok("estimator ignores the jerk of the last frame and caps the speed", () => {
  const e = new I.ThrowEstimator(); let now = 0;
  for (let i = 0; i < 30; i++) { now = i * 1000 / 72; e.push(now, [0, 0, -1 * now / 1000]); }
  e.push(now + 5, [0.2, 0, -1 * now / 1000]); // release jerk, 5 ms later
  const v = e.velocity(now + 5, "controller"); assert.ok(Math.abs(v[0]) < 0.05 && Math.abs(v[2] + 1) < 0.05);
  const f = new I.ThrowEstimator(); for (let i = 0; i < 30; i++) f.push(i * 14, [0, 0, -50 * i * 0.014]);
  assert.ok(Math.hypot(...f.velocity(29 * 14, "controller")) <= I.MAX_SPEED + 1e-9);
});
ok("button: tap, hold with progress, consume", () => {
  const b = new I.Button(600);
  assert.ok(b.update(true, 0).press); assert.ok(b.update(false, 200).tap);
  b.update(true, 1000); const mid = b.update(true, 1375); assert.ok(mid.progress > 0.45 && mid.progress < 0.55);
  assert.ok(b.update(true, 1600).hold); const r = b.update(false, 1700); assert.ok(r.release && !r.tap);
  b.update(true, 2000); b.consume(); assert.ok(!b.update(false, 2100).tap);
});
ok("stick: one event per flick, with hysteresis", () => {
  const s = new I.Stick();
  assert.equal(s.update(0, -0.9), "up"); assert.equal(s.update(0, -0.95), null); assert.equal(s.update(0, -0.5), null);
  s.update(0, 0); assert.equal(s.update(0.8, 0.1), "right"); s.update(0, 0); assert.equal(s.update(0, 0.8), "down");
});
ok("palm up and fist", () => {
  // palm up, fingers toward −z: the right hand has the index (thumb side) at +x, the left hand at −x
  const r = { wrist: [0, 0, 0], indexMeta: [0.03, 0, -0.08], pinkyMeta: [-0.03, 0, -0.07] };
  const l = { wrist: [0, 0, 0], indexMeta: [-0.03, 0, -0.08], pinkyMeta: [0.03, 0, -0.07] };
  assert.ok(I.palmUp(r, "right")); assert.ok(I.palmUp(l, "left")); assert.ok(!I.palmUp(l, "right"));
  const m = [0, 0, -0.08];
  assert.ok(I.fist({ middleMeta: m, indexTip: [0, -0.03, -0.06], middleTip: [0, -0.03, -0.07], ringTip: [0.01, -0.03, -0.07] }));
  assert.ok(!I.fist({ middleMeta: m, indexTip: [0, 0, -0.17], middleTip: [0, 0, -0.18], ringTip: [0.01, 0, -0.17] }));
});
ok("double tap: two short presses within 320 ms; slow or long presses do not count", () => {
  const d = new I.DoubleTap();
  assert.ok(!d.update(true, 0)); d.update(false, 80); assert.ok(d.update(true, 200), "second press fires"); d.update(false, 260);
  assert.ok(!d.update(true, 300), "a third press does not fire again");
  const e = new I.DoubleTap(); e.update(true, 0); e.update(false, 400); assert.ok(!e.update(true, 450), "first press too long");
  const f = new I.DoubleTap(); f.update(true, 0); f.update(false, 50); assert.ok(!f.update(true, 600), "too late");
});
ok("hand blast: fist held, then snapped open", () => {
  const g = new I.BlastGesture();
  assert.ok(!g.update(true, false, 0)); assert.ok(!g.update(true, false, 200));
  assert.ok(!g.update(false, false, 230)); assert.ok(g.update(false, true, 280), "opens within 150 ms");
  const h = new I.BlastGesture(); h.update(true, false, 0); h.update(false, false, 60); assert.ok(!h.update(false, true, 80), "fist too short");
  const k = new I.BlastGesture(); k.update(true, false, 0); k.update(false, false, 300); assert.ok(!k.update(false, true, 600), "opened too slowly");
  const m = [0, 0, -0.08];
  assert.ok(I.openHand({ middleMeta: m, indexTip: [0, 0, -0.18], middleTip: [0, 0, -0.19], ringTip: [0.01, 0, -0.18] }));
  assert.ok(!I.openHand({ middleMeta: m, indexTip: [0, -0.03, -0.06], middleTip: [0, -0.03, -0.07], ringTip: [0.01, -0.03, -0.07] }));
});
console.log(`\n${n} input tests passed`);
