// Force Lab XR · panel tests: every button inside its card, no overlaps, ≥ 4 cm (DESIGN.md §17), hit-test and poke
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const X = require("../js/xrpanel.js");
const T = require("../js/tracks.js");
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok", name); };
const t = (k) => k;
const opt = { vec: { v: true, a: true, F: true }, each: false, split: false, strobe: true, predict: "auto", slow: 1, snap: true, g: 0, mass: 0.5 };
const layouts = [];
for (const sandbox of [false, true]) for (const xr of [null, "immersive-vr"]) layouts.push(["options " + sandbox + " " + xr, X.buildOptions({ t, lang: "it", opt, sandbox, xr })]);
for (const tr of T.TRACKS) for (const palm of [false, true]) layouts.push(["gallery " + tr.id + " " + palm, X.buildGallery({ t, lang: "en", track: tr, index: 1, count: 8, palm, canAdd: true })]);
for (const tr of T.TRACKS) layouts.push(["hud " + tr.id, X.buildHud({ t, lang: "it", track: tr, run: { time: 1.234, next: 1, total: tr.gates.length }, v: 1, a: 0.5, F: 0.25, mass: 0.5, g: 0 })]);
layouts.push(["zone menu", X.buildZoneMenu({ t, lang: "it", F: 0.5, snap: true, canAdd: true })]);

for (const [name, L] of layouts) ok(name, () => {
  const btns = L.items.filter((i) => i.kind === "btn");
  for (const b of btns) {
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w + 4 <= L.W - 10 + 4 && b.y + b.h + 4 <= L.H, `${b.id} inside the card`);
    assert.ok(Math.min(b.w, b.h) * L.MPP >= 0.04, `${b.id} at least 4 cm (${(Math.min(b.w, b.h) * L.MPP * 100).toFixed(1)} cm)`);
  }
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
    const a = btns[i], b = btns[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} overlaps ${b.id}`);
  }
  assert.equal(new Set(L.items.map((i) => i.id)).size, L.items.length, "unique ids");
});
ok("hit-test at a button centre and poke from the front", () => {
  const L = X.buildZoneMenu({ t, lang: "it", F: 0.5, snap: true, canAdd: true });
  const b = L.items.find((i) => i.id === "zdel");
  const lx = (b.x + b.w / 2 - L.W / 2) * L.MPP, ly = (L.H / 2 - (b.y + b.h / 2)) * L.MPP;
  assert.equal(X.hit(L, lx, ly).id, "zdel");
  const p = new X.Poke();
  assert.equal(p.update("h", { x: lx, y: ly, z: 0.03 }, false, L, 1).press, null);
  assert.equal(p.update("h", { x: lx, y: ly, z: -0.005 }, false, L, 1).press, "zdel");
  assert.equal(p.update("h", { x: lx, y: ly, z: -0.01 }, false, L, 1).press, null, "one press per pass");
});
ok("ray hits the panel plane", () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const h = X.rayHit(I, [0.1, 0.05, 1], [0, 0, -1]); assert.ok(Math.abs(h.t - 1) < 1e-12 && Math.abs(h.x - 0.1) < 1e-12);
  assert.equal(X.rayHit(I, [0, 0, 1], [0, 0, 1]), null);
});
console.log(`\n${n} panel tests passed`);
