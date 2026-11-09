// Force Lab XR · tracks tests: data valid, every reference solution passes every gate in time
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const T = require("../js/tracks.js");
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok", name); };

ok("ids unique, numbered in order, sandbox last", () => {
  const ids = T.TRACKS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  T.TRACKS.filter((t) => !t.sandbox).forEach((t, i) => assert.equal(t.n, i + 1));
  assert.ok(T.TRACKS[T.TRACKS.length - 1].sandbox);
});
for (const t of T.TRACKS) {
  ok(`${t.id}: data valid`, () => assert.deepEqual(T.validate(t), []));
  if (!t.solution) continue;
  ok(`${t.id}: solution completes the track within the time limit`, () => {
    const r = T.simulateSolution(t);
    assert.equal(r.state, "done", `state ${r.state}, next gate ${r.next}`);
    assert.ok(r.time <= t.timeLimit);
    assert.equal(r.result.medal, 3, "the reference solution earns gold");
  });
}
ok("no solution: launching straight fails the bend-less tracks", () => {
  const t = T.TRACKS.find((x) => x.id === "yourbend");
  const r = T.simulateSolution({ ...t, solution: { launch: [0, 0, -1], zones: [] } });
  assert.notEqual(r.state, "done");
});
ok("too slow for a speed gate", () => {
  const t = T.TRACKS.find((x) => x.id === "fastlane");
  const r = T.simulateSolution({ ...t, solution: { launch: t.solution.launch.map((x) => x * 0.5), zones: [] } });
  assert.notEqual(r.state, "done"); assert.ok(r.events.some((e) => e.type === "tooSlow"));
});
ok("run: release outside the start is not timed; grabbing in flight voids the run", () => {
  const t = T.TRACKS[0], r = new T.Run(t);
  r.grab(); r.hold([1, 1.2, -0.45]); r.release([0, 0, -1]);
  assert.equal(r.state, "free");
  r.grab(); r.hold(t.start.p); r.release([0, 0, -1]); assert.equal(r.state, "flying");
  r.advance({ zones: [], g: 0 }, 240); assert.equal(r.next, 1);
  r.grab(); assert.equal(r.next, 0); assert.ok(r.events.some((e) => e.type === "void"));
});
ok("run: the band launches from the ready state; a slack band does not", () => {
  const t = T.TRACKS[0], r = new T.Run(t);
  r.advance({ zones: [], g: 0, band: { anchor: [0, 1.2, -0.2], rest: 0.25 } }, 10); assert.equal(r.state, "ready");
  r.advance({ zones: [], g: 0, band: { anchor: [0, 1.2, 0.5], rest: 0.25 } }, 10); assert.equal(r.state, "flying");
});
ok("run: time limit and leaving the room", () => {
  const t = T.TRACKS.find((x) => x.id === "fastlane"), r = new T.Run(t);
  r.grab(); r.hold(t.start.p); r.release([0, 0, -0.1]);
  r.advance({ zones: [], g: 0 }, Math.round(3.1 * 240)); assert.equal(r.state, "failed");
  const r2 = new T.Run(t); r2.grab(); r2.hold(t.start.p); r2.release([0, 4, 0]);
  r2.advance({ zones: [], g: 0 }, 240 * 2); assert.equal(r2.state, "lost");
});
ok("medals", () => {
  const t = T.TRACKS[0];
  assert.equal(T.medalFor(t, 2.9), 3); assert.equal(T.medalFor(t, 4), 2); assert.equal(T.medalFor(t, 5.9), 1); assert.equal(T.medalFor(t, 7), 0);
});
ok("guide path starts at the start and ends at the last gate", () => {
  for (const t of T.TRACKS.filter((x) => x.gates.length)) {
    const p = T.pathPoints(t); assert.deepEqual(p[0], t.start.p); assert.deepEqual(p[p.length - 1], t.gates[t.gates.length - 1].p);
  }
});
console.log(`\n${n} track tests passed`);
