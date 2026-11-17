// Collision Lab · tests/quantities.test.mjs
// The graph quantities: values per disc, totals, centre of mass, frames, labels. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUANTITIES, DEFAULT_QUANTITY, axisLabel, extraKind, valueOf, extraOf } from "../js/quantities.js";

const discs = [{ m: 0.25 }, { m: 0.75 }];
const s = { t: 1, p: [{ x: 0.4, y: 0.6, vx: 1, vy: 0.2 }, { x: 1.2, y: 0.5, vx: -0.2, vy: 0 }], X: 1.0, Y: 0.525, Vx: 0.1, Vy: 0.05 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`);

test("seven quantities, momentum by default", () => {
  assert.deepEqual(QUANTITIES, ["x", "y", "vx", "vy", "px", "py", "K"]);
  assert.equal(DEFAULT_QUANTITY, "px");
  assert.equal(axisLabel("x"), "x (m)");
  assert.equal(axisLabel("vx"), "v_x (m/s)");
  assert.equal(axisLabel("K"), "K (J)");
  assert.equal(axisLabel("nope"), "p_x (kg·m/s)");
});

test("values per disc in the lab frame", () => {
  close(valueOf("x", s, discs[0], 0, false), 0.4);
  close(valueOf("vy", s, discs[0], 0, false), 0.2);
  close(valueOf("px", s, discs[1], 1, false), -0.15);
  close(valueOf("K", s, discs[0], 0, false), 0.5 * 0.25 * (1 + 0.04));
});

test("centre-of-mass frame: positions from the CM, velocities relative to it", () => {
  close(valueOf("x", s, discs[0], 0, true), -0.6);
  close(valueOf("vx", s, discs[1], 1, true), -0.3);
  close(valueOf("py", s, discs[0], 0, true), 0.25 * 0.15);
});

test("positions get the centre of mass, the rest the total", () => {
  assert.equal(extraKind("x"), "cm");
  assert.equal(extraKind("y"), "cm");
  for (const q of ["vx", "vy", "px", "py", "K"]) assert.equal(extraKind(q), "tot");
  close(extraOf("x", s, discs, false), 1.0);
  close(extraOf("y", s, discs, true), 0);
  close(extraOf("px", s, discs, false), 0.25 - 0.15);
});
