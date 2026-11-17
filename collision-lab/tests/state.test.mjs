// Collision Lab · tests/state.test.mjs
// Links: the physical keys behave exactly as in version 0.1.0; the presentation keys round-trip.
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialSettings, initialPresentation, parseLink, fromHash, toHash } from "../js/state.js";
import { sceneById, sanitize } from "../js/scenes.js";

// js/state.js fromHash as released in 0.1.0, frozen here as the reference for old links
function fromHash010(hash, base = initialSettings()) {
  const st = structuredClone(base);
  const q = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (!q.has("s")) return st;
  const scene = sceneById(q.get("s"));
  st.scene = scene.id;
  const raw = {};
  for (const par of scene.params) raw[par.k] = q.has(par.k) ? q.get(par.k) : st.params[scene.id][par.k];
  st.params[scene.id] = sanitize(scene, raw);
  const e = Number(q.get("e"));
  if (q.has("e") && Number.isFinite(e)) st.e = Math.min(1, Math.max(0, e));
  if (q.has("st")) st.sticky = q.get("st") === "1";
  if (q.has("w")) st.walls = q.get("w") === "1";
  if (q.get("f") === "cm" || q.get("f") === "lab") st.frame = q.get("f");
  return st;
}

const OLD_LINKS = [
  "#s=headon&m1=0.25&m2=0.25&v1=1&v2=0&x1=0.5&x2=1.2&e=0.5&st=0&w=0&f=lab",
  "#s=headon&m1=0.25&m2=0.25&v1=1&v2=0&x1=0.5&x2=1.2&e=1&st=0&w=0&f=lab",
  "#s=glancing&m1=0.25&m2=0.5&v1=1.2&b=0.6&x1=0.4&e=1&st=1&w=1&f=lab",
  "#s=break&m1=0.25&v1=1.5&b=0.15&m2=0.25&rows=3&x1=0.35&e=0.9&st=0&w=0&f=cm",
  "#s=explosion&m1=0.25&m2=0.5&E=0.3&v0=0.4&phi=30&e=1&st=0&w=0&f=lab",
  "#s=free&m1=0.25&m2=0.5&x1=0.5&y1=0.45&v1x=1&v1y=0.3&x2=1.5&y2=0.75&v2x=-0.6&v2y=-0.1&e=1&st=0&w=0&f=lab",
  "#s=headon&m1=99&v1=abc&e=7&f=xyz",
  "#s=nope",
  "#e=0.5",
  "",
];

test("old links give exactly the state they gave in 0.1.0, with no presentation", () => {
  for (const h of OLD_LINKS) {
    const { st, pres, preset } = parseLink(h);
    assert.deepEqual(st, fromHash010(h), h);
    assert.deepEqual(fromHash(h), fromHash010(h), h);
    assert.deepEqual(pres, initialPresentation(), h);
    assert.equal(preset, null);
  }
});

test("an old link rewritten by the app stays identical", () => {
  for (const h of OLD_LINKS.slice(0, 6)) {
    const { st, pres } = parseLink(h);
    assert.equal(toHash(st, pres), h);
  }
});

test("presentation keys round-trip and are written only when given", () => {
  const h = "#s=headon&m1=0.25&m2=0.25&v1=1&v2=0&x1=0.5&x2=1.2&e=0.5&st=0&w=0&f=lab&show=cm,strobe&tab=1&g=vx&hide=e,num&lock=1";
  const { st, pres } = parseLink(h);
  assert.deepEqual(pres, { show: ["cm", "strobe"], tab: 1, g: "vx", hide: ["e", "num"], lock: true });
  assert.equal(st.e, 0.5);
  assert.equal(toHash(st, pres), h);
  // any order, duplicates and unknown names: normalised
  const p2 = parseLink("#s=headon&hide=vec,zzz,e,e&show=strobe,mom,nope&lock=1").pres;
  assert.deepEqual(p2.hide, ["e", "vec"]);
  assert.deepEqual(p2.show, ["mom", "strobe"]);
  assert.equal(toHash(initialSettings(), initialPresentation()).includes("show"), false);
});

test("bad presentation values are ignored", () => {
  const { pres } = parseLink("#s=headon&tab=7&g=zz&lock=yes&hide=");
  assert.equal(pres.tab, null);
  assert.equal(pres.g, null);
  assert.equal(pres.lock, false);
  assert.deepEqual(pres.hide, []);
  assert.equal(parseLink("#tab=2").pres.tab, 2); // presentation keys work without a scene
  assert.equal(parseLink("#tab=2&e=0.3").st.e, 1); // physical keys still need one, as before
});

test("hide=e: the value of e appears in no generated text", async () => {
  const { hiddenNow, eLabel } = await import("../js/state.js");
  const { _test, fmtNum } = await import("../../kit/kit.js");
  const { pres, st } = parseLink("#s=headon&m1=0.25&m2=0.25&v1=1&v2=0&x1=0.5&x2=1.2&e=0.7&st=0&w=0&f=lab&hide=e,bal");
  const hidden = hiddenNow(pres);
  assert.ok(hidden.has("e") && hidden.has("bal"));
  for (const lang of ["it", "en"]) {
    _test.setLangForTest(lang);
    const label = eLabel(st.e, hidden.has("e"), fmtNum);
    assert.equal(label, "?");
    assert.ok(!/0[.,]7/.test(label));
    assert.equal(eLabel(st.e, false, fmtNum), lang === "it" ? "0,70" : "0.70");
  }
  assert.equal(hiddenNow(pres, true).size, 0, "revealed: nothing hidden");
});
