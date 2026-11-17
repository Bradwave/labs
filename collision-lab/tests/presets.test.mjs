// Collision Lab · tests/presets.test.mjs
// Named scenes: valid settings, discs that do not overlap, at least one collision, and the order
// defaults → preset → hash. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, PRESET_MAP } from "../js/presets.js";
import { parseLink, toHash, initialSettings } from "../js/state.js";
import { sceneById, sanitize, SPLIT_AT } from "../js/scenes.js";
import { createWorld, step, explode, totals } from "../js/physics.js";

test("eleven presets with unique ids, titles and notes in both languages", () => {
  assert.equal(PRESETS.length, 11);
  assert.equal(PRESET_MAP.size, 11);
  for (const p of PRESETS) {
    for (const l of ["it", "en"]) assert.ok(p.title[l] && p.note[l], `${p.id} ${l}`);
    assert.match(p.settings, /show=strobe,cm/);
    assert.match(p.settings, /f=lab/);
    assert.match(p.settings, /w=0/);
  }
});

test("every preset passes sanitize, builds discs that do not overlap, and (but explosions) collides", () => {
  for (const p of PRESETS) {
    const { st, preset } = parseLink("#p=" + p.id, PRESET_MAP);
    assert.equal(preset, p.id);
    const scene = sceneById(st.scene);
    const params = st.params[st.scene];
    assert.deepEqual(sanitize(scene, params), params, `${p.id}: values outside their range`);
    // the values written in the preset arrive unchanged (nothing was clamped)
    for (const [k, v] of new URLSearchParams(p.settings)) if (k in params) assert.equal(params[k], Number(v), `${p.id}.${k}`);
    const B = scene.build(params);
    for (let i = 0; i < B.length; i++)
      for (let j = i + 1; j < B.length; j++) assert.ok(Math.hypot(B[i].x - B[j].x, B[i].y - B[j].y) >= B[i].r + B[j].r - 1e-9, `${p.id}: overlap`);
    const w = createWorld(B, { e: st.e, sticky: st.sticky });
    if (scene.split) {
      step(w, SPLIT_AT);
      explode(w, 0, params.E);
      assert.ok(Math.abs(totals(w).K - (0.5 * (params.m1 + params.m2) * params.v0 ** 2 + params.E)) < 1e-9, `${p.id}: energy`);
      continue;
    }
    for (let k = 0; k < 400; k++) step(w, 0.01);
    assert.ok(w.events.some((e) => e.kind === "hit" || e.kind === "stick"), `${p.id}: no collision`);
  }
});

test("the physical values of the presets", () => {
  const g = (id) => parseLink("#p=" + id, PRESET_MAP);
  assert.equal(g("urti/s2").st.e, 0.5);
  assert.equal(g("urti/s3").st.sticky, true);
  const s4 = g("urti/s4");
  assert.equal(s4.st.e, 0.7);
  assert.deepEqual(s4.pres.hide, ["e", "bal"]);
  assert.equal(s4.pres.lock, true);
  assert.equal(g("urti/s7").st.e, 1); // not given: the default
  assert.equal(g("urti/s9").st.params.explosion.v0, 0.6);
  assert.deepEqual(g("urti/s1").pres.show, ["cm", "strobe"]);
});

test("order: defaults, then the preset, then the keys in the hash", () => {
  const { st, pres } = parseLink("#p=urti/s1&e=0.3&v1=1.5&lock=1&show=mom", PRESET_MAP);
  assert.equal(st.e, 0.3);
  assert.equal(st.params.headon.v1, 1.5);
  assert.equal(st.params.headon.m1, 0.25);
  assert.equal(pres.lock, true);
  assert.deepEqual(pres.show, ["mom"]);
  // another scene after the preset: its own defaults, then the keys
  const b = parseLink("#p=urti/s1&s=glancing&b=-0.2", PRESET_MAP);
  assert.equal(b.st.scene, "glancing");
  assert.equal(b.st.params.glancing.b, -0.2);
  assert.equal(b.st.params.glancing.v1, initialSettings().params.glancing.v1);
  // unknown preset: ignored, as an unknown key
  assert.deepEqual(parseLink("#p=nope", PRESET_MAP).st, initialSettings());
});

test("a preset link is rewritten as itself, and hidden values stay out of the URL", () => {
  for (const p of PRESETS) {
    const { st, pres, preset } = parseLink("#p=" + p.id, PRESET_MAP);
    assert.equal(toHash(st, pres, preset, PRESET_MAP), "#p=" + p.id);
  }
  const s4 = parseLink("#p=urti/s4", PRESET_MAP);
  assert.ok(!toHash(s4.st, s4.pres, s4.preset, PRESET_MAP).includes("0.7"));
  // changes after the preset round-trip
  const cases = ["#p=urti/s1&e=0.3&v1=1.5", "#p=urti/s4&lock=0", "#p=urti/s1&s=glancing&m1=0.25&m2=0.25&v1=1&b=-0.2&x1=0.4", "#p=urti/s8&show=mom,cm&tab=1&g=vx"];
  for (const h of cases) {
    const a = parseLink(h, PRESET_MAP);
    const back = parseLink(toHash(a.st, a.pres, a.preset, PRESET_MAP), PRESET_MAP);
    assert.deepEqual(back, a, h);
  }
  // after unlocking s4 the link says so
  const u = parseLink("#p=urti/s4", PRESET_MAP);
  u.pres.lock = false;
  assert.equal(toHash(u.st, u.pres, u.preset, PRESET_MAP), "#p=urti/s4&lock=0");
});
