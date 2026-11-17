// Collision Lab · tests/scenes.test.mjs
// Scenes build valid starting states; links round-trip; strings match. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, defaults, sanitize, TABLE } from "../js/scenes.js";
import { initialSettings, toHash, fromHash } from "../js/state.js";
import { createWorld, step, totals } from "../js/physics.js";
import STRINGS from "../js/strings.js";

test("every scene starts with discs on the table, not overlapping, and they collide", () => {
  for (const s of SCENES) {
    const B = s.build(defaults(s));
    for (const b of B) assert.ok(b.x - b.r >= 0 && b.x + b.r <= TABLE.W && b.y - b.r >= 0 && b.y + b.r <= TABLE.H, s.id);
    for (let i = 0; i < B.length; i++)
      for (let j = i + 1; j < B.length; j++) assert.ok(Math.hypot(B[i].x - B[j].x, B[i].y - B[j].y) >= B[i].r + B[j].r - 1e-9, `${s.id} ${i} ${j}`);
    if (s.split) continue;
    const w = createWorld(B, { e: 1 });
    for (let k = 0; k < 300; k++) step(w, 0.01);
    assert.ok(w.events.length > 0, `${s.id}: no collision with the default settings`);
  }
});

test("handles move parameters and stay in range", () => {
  for (const s of SCENES) {
    const p = defaults(s);
    const B = s.build(p);
    for (const h of s.handles(p, B)) {
      h.set(p, h.tipX + 5, h.tipY - 5, h);
      for (const q of s.params) assert.ok(p[q.k] >= q.min - 1e-9 && p[q.k] <= q.max + 1e-9, `${s.id}.${q.k} = ${p[q.k]}`);
    }
  }
});

test("links round-trip and bad values are clamped", () => {
  const st = initialSettings();
  st.scene = "glancing";
  st.params.glancing.b = -0.35;
  st.e = 0.4;
  st.sticky = true;
  st.frame = "cm";
  const back = fromHash(toHash(st));
  assert.equal(back.scene, "glancing");
  assert.equal(back.params.glancing.b, -0.35);
  assert.equal(back.e, 0.4);
  assert.equal(back.sticky, true);
  assert.equal(back.frame, "cm");
  const bad = fromHash("#s=headon&m1=99&v1=abc&e=7&f=xyz");
  assert.equal(bad.params.headon.m1, 1);
  assert.equal(bad.params.headon.v1, 1);
  assert.equal(bad.e, 1);
  assert.equal(bad.frame, "lab");
  assert.equal(fromHash("#s=nope").scene, "headon");
  assert.deepEqual(sanitize(SCENES[4], { rows: 3.7 }).rows, 4);
});

test("explosion scene: the pair starts as one body moving at v0", () => {
  const s = SCENES.find((x) => x.id === "explosion");
  const p = { ...defaults(s), v0: 0.6 };
  const w = createWorld(s.build(p));
  assert.equal(w.clusters.length, 1);
  const t = totals(w);
  assert.ok(Math.abs(t.Vx - 0.6) < 1e-12);
});

test("Italian and English strings have the same keys and none is empty", () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
  for (const l of ["it", "en"]) for (const [k, v] of Object.entries(STRINGS[l])) assert.ok(String(v).trim(), `${l}.${k} empty`);
  for (const s of SCENES) {
    assert.ok(STRINGS.it["scene." + s.id], s.id);
    for (const q of s.params) if (!q.hidden) assert.ok(STRINGS.it[q.label], q.label);
  }
});
