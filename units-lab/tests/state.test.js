// Units Lab: Tests for state.js (mountain rules, statistics, adaptive level, link parameters).
import test from "node:test";
import assert from "node:assert/strict";
import { S, climb, resetAll, record, accuracy, adapt, topErrors, readParams, TOP } from "../js/state.js";

test("correct climbs, wrong slips but never below the base camp, partial stays", () => {
  resetAll();
  assert.equal(S.mountain.alt, 0);
  assert.equal(climb("wrong").to, 0); // nothing below the first camp
  assert.equal(climb("wrong").held, true);
  for (let i = 0; i < 5; i++) climb("correct"); // 5
  assert.equal(S.mountain.alt, 5);
  assert.equal(climb("partial").moved, 0);
  assert.equal(climb("wrong").to, 4);
  const stuck = climb("wrong"); // 4 is a base camp: it holds
  assert.equal(stuck.to, 4);
  assert.equal(stuck.held, true);
});

test("summit after 12 stations", () => {
  resetAll();
  let r;
  for (let i = 0; i < TOP; i++) r = climb("correct");
  assert.equal(r.summit, true);
  assert.equal(S.mountain.summits, 1);
  assert.equal(S.mountain.alt, TOP);
});

test("statistics: accuracy over the last 20 and error counts", () => {
  resetAll();
  for (let i = 0; i < 30; i++) record(2, 1, { status: i < 10 ? "wrong" : "correct", codes: i < 10 ? ["wrongDirection"] : [] }, false);
  assert.equal(accuracy(2), 1); // the last 20 are all correct
  record(2, 1, { status: "wrong", codes: [] }, false);
  record(2, 1, { status: "partial", codes: ["sfTooMany"] }, true);
  assert.equal(accuracy(2), 18 / 20);
  const errors = Object.fromEntries(topErrors(9));
  assert.equal(errors.wrongDirection, 10);
  assert.equal(errors.other, 1);
  assert.equal(errors.sfTooMany, 1);
  assert.equal(S.stats.byModule["2"][1].h, 1);
});

test("adaptive level: 5 right without hints go up, 3 wrong in a row go down", () => {
  resetAll();
  let r = null;
  for (let i = 0; i < 4; i++) r = adapt(1, "correct", false, 1);
  assert.equal(r, null);
  assert.equal(adapt(1, "correct", false, 1), "up");
  for (let i = 0; i < 2; i++) assert.equal(adapt(1, "wrong", false, 2), null);
  assert.equal(adapt(1, "wrong", false, 2), "down");
  for (let i = 0; i < 10; i++) assert.equal(adapt(1, "correct", true, 1), null); // hints do not count
});

test("link parameters", () => {
  const p = readParams("?lang=en&level=2&modules=1,3,9&tier=1&seed=42");
  assert.deepEqual(p, { lang: "en", level: 2, tier: 1, seed: 42, modules: [1, 3] });
  const q = readParams("");
  assert.deepEqual(q, { lang: null, level: null, tier: 3, seed: null, modules: null });
});
