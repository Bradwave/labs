// Units Lab: Tests for guided.js (the balance method, step by step).
import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "../js/generator.js";
import { check } from "../js/checker.js";
import { fmt } from "../js/format.js";
import { fromSci, parseNumber, sciExp } from "../js/decimal.js";
import { planFor, guidedProblem, checkConvert, checkNormalize, checkSum, tilt, sumTerms, outcome } from "../js/guided.js";

const conv = (data, fromUnit, toUnit, extra = {}) => {
  const p = generate(3, 1);
  return { ...p, data, dataForm: "decimal", dataI: 1, fromUnit, toUnit, ...extra };
};

test("150 mg → kg: the example from class", () => {
  const data = parseNumber("150", "it").dec;
  const expected = fromSci(1, data.d.toString(), -4);
  const plan = planFor(conv(data, "mg", "kg", { expected }));
  assert.equal(plan.unit, 6); // the unit grows by 10^6
  assert.equal(plan.n, -6); // the number compensates
  assert.equal(plan.q, 2); // 150 → 1,5: the power compensates with 10^2
  assert.equal(plan.E, -4);
  assert.equal(plan.sign, "neg");
  assert.deepEqual(sumTerms(plan), [-6, 2]);
});

test("data already in scientific notation: 2,4·10^-10 m → nm", () => {
  const data = fromSci(1, "24", -10);
  const expected = fromSci(1, "24", -1);
  const plan = planFor(conv(data, "m", "nm", { expected, dataForm: "e", dataI: 1 }));
  assert.equal(plan.unit, -9);
  assert.equal(plan.n, 9);
  assert.equal(plan.q, 0);
  assert.ok(plan.normalized);
  assert.equal(plan.E, -1);
  assert.deepEqual(sumTerms(plan), [-10, 9]);
});

test("non-decimal factors (min, h) do not fit the method", () => {
  const data = parseNumber("120", "it").dec;
  assert.equal(planFor(conv(data, "min", "s", { expected: data })), null);
});

test("every planned module 3 problem is consistent with the checker", () => {
  let planned = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const p0 = generate(3, seed);
    const plan = planFor(p0);
    if (!plan) continue;
    planned++;
    const p = guidedProblem(p0, seed);
    assert.notEqual(p.ask.form, "decimal");
    assert.equal(plan.x0 + plan.n + plan.q, sciExp(p.expected));
    assert.equal(plan.unit, -plan.n);
    // the answer built by the steps is the expected one
    const answer = fmt(p.expected, "it", p.ask.form);
    assert.equal(check(p, answer, { locale: "it" }).status, "correct", `${p.id}: ${answer}`);
    assert.ok(checkConvert(plan, plan.unit, plan.n).ok);
    assert.ok(checkNormalize(plan, 1, plan.q).ok);
    assert.ok(checkSum(plan, plan.E).ok);
  }
  assert.ok(planned > 150, `only ${planned} problems fit the guided method`);
});

test("step checks name the mistake", () => {
  const plan = { unit: 6, n: -6, q: 2, E: -4 };
  assert.equal(checkConvert(plan, -6, 6).code, "g_unit");
  assert.equal(checkConvert(plan, 6, 6).code, "g_balance");
  assert.equal(checkNormalize(plan, 3, 2).code, "g_comma");
  assert.equal(checkNormalize(plan, 1, -2).code, "g_balance");
  assert.equal(checkSum(plan, -8).code, "g_sum");
});

test("the beam: level when the exponents cancel, the side that grew goes down", () => {
  assert.equal(tilt(0, 0), 0);
  assert.equal(tilt(-6, 6), 0);
  assert.equal(tilt(2, -2), 0);
  assert.ok(tilt(0, 6) > 0);
  assert.ok(tilt(-9, 0) < 0);
  assert.ok(tilt(-6, -6) < 0);
});

test("outcome: mistakes make it partial, never wrong", () => {
  assert.deepEqual(outcome([]), { status: "correct", codes: [] });
  assert.deepEqual(outcome(["g_unit", "g_unit"]), { status: "partial", codes: ["g_unit"] });
});
