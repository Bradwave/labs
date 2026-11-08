// lab-kit · tests/kit.test.mjs
// Number parsing and formatting, ticks, strings parity, mathtext. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNum, fmtNum, fmtSci, niceTicks, _test } from "../kit/kit.js";
import { toHTML, plain } from "../kit/mathtext.js";

test("parseNum accepts Italian and English input", () => {
  assert.equal(parseNum("0,5"), 0.5);
  assert.equal(parseNum("0.5"), 0.5);
  assert.equal(parseNum("−2,25"), -2.25);
  assert.equal(parseNum(" 1 250,5 "), 1250.5);
  assert.equal(parseNum("1.250,5"), 1250.5);
  assert.equal(parseNum("1,250.5"), 1250.5);
  assert.equal(parseNum("3,2×10^-4"), 0.00032);
  assert.equal(parseNum("3.2e-4"), 0.00032);
  assert.equal(parseNum(".5"), 0.5);
  assert.equal(parseNum("+7"), 7);
});
test("parseNum rejects junk", () => {
  for (const s of ["", "abc", "1,2,3", "2..5", "1-2", "--3"]) assert.ok(Number.isNaN(parseNum(s)), s);
});
test("fmtNum follows the language", () => {
  _test.setLangForTest("it");
  assert.equal(fmtNum(-1.5, 2), "−1,50");
  assert.equal(fmtNum(3.14159, 2, "m/s"), "3,14 m/s");
  assert.equal(fmtNum(-0.0001, 2), "0,00");
  assert.equal(fmtNum(NaN), "—");
  _test.setLangForTest("en");
  assert.equal(fmtNum(-1.5, 2), "−1.50");
  assert.equal(fmtSci(3.2e-4, 1), "3.2 × 10⁻⁴");
  _test.setLangForTest("it");
});
test("niceTicks gives round steps", () => {
  assert.deepEqual(niceTicks(0, 2, 6), [0, 0.5, 1, 1.5, 2]);
  assert.deepEqual(niceTicks(0, 19.62, 5), [0, 5, 10, 15]);
  assert.deepEqual(niceTicks(-1, 1, 4), [-1, -0.5, 0, 0.5, 1]);
});
test("kit strings have the same keys in Italian and English", () => {
  const it = Object.keys(_test.KIT_STRINGS.it).sort(),
    en = Object.keys(_test.KIT_STRINGS.en).sort();
  assert.deepEqual(it, en);
});
test("mathtext renders subscripts, superscripts and Greek", () => {
  assert.equal(toHTML("v_x"), "v<sub>x</sub>");
  assert.equal(toHTML("m/s^2"), "m/s<sup>2</sup>");
  assert.equal(toHTML("\\Delta s"), "Δ s");
  assert.equal(plain("a_{max}"), "a_max");
});
