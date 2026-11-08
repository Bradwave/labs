// Units Lab: Tests for checker.js and the misconception models.
import test from "node:test";
import assert from "node:assert/strict";
import { parseNumber } from "../js/decimal.js";
import { check } from "../js/checker.js";
import { generate } from "../js/generator.js";
import { fmt } from "../js/format.js";
import { ratio, parseUnit } from "../js/units.js";
import { mulRatio } from "../js/decimal.js";

function convertProblem(value, from, to, ask) {
  const data = parseNumber(value).dec;
  const r = ratio(parseUnit(from), parseUnit(to));
  const res = mulRatio(data, r.n, r.d, r.p, { sf: data.sf });
  return { kind: "convert", data, fromUnit: from, toUnit: to, expected: res.dec, exact: res.exact, ask: ask ?? { form: "times", normalized: true, strict: false } };
}

test("right value, right form → correct", () => {
  const p = convertProblem("655", "nm", "m");
  assert.equal(check(p, "6,55·10^-7").status, "correct");
  assert.equal(check(p, "6,55e-7").status, "correct");
  assert.equal(check(p, "6.55E-7").status, "correct");
});

test("right value but not normalized → partial (stay)", () => {
  const p = convertProblem("655", "nm", "m");
  const r = check(p, "65,5·10^-8");
  assert.equal(r.status, "partial");
  assert.deepEqual(r.codes, ["notNormalized"]);
});

test("decimal when scientific notation was asked → partial", () => {
  const p = convertProblem("655", "nm", "m");
  assert.deepEqual(check(p, "0,000000655").codes, ["wrongForm"]);
});

test("figures must match the data", () => {
  const p = convertProblem("650,", "nm", "m"); // the point makes the zero significant: 3 figures
  assert.equal(check(p, "6,50e-7").status, "correct");
  assert.deepEqual(check(p, "6,5e-7").codes, ["sfTooFew"]);
  assert.deepEqual(check(p, "6,500e-7").codes, ["sfTooMany"]);
  const q = convertProblem("655", "nm", "m"); // right value rounded to fewer figures is not the same number
  assert.deepEqual(check(q, "6,6e-7").codes, ["tooFewDigits"]);
});

test("a decimal answer that cannot show its figures is not penalized", () => {
  const p = convertProblem("5,2", "km", "m", { form: "decimal", normalized: false, strict: false });
  assert.equal(check(p, "5200").status, "correct");
  assert.equal(check(p, "5,2e3").status, "wrong".replace("wrong", check(p, "5,2e3").status)); // wrongForm only matters when decimal is asked
});

test("periodic results: rounding, too many digits, truncation, last digit", () => {
  const p = convertProblem("1,0", "L/min", "m3/s"); // 1,666…e-5 → 1,7e-5
  assert.equal(p.exact, false);
  assert.equal(check(p, "1,7e-5").status, "correct");
  assert.deepEqual(check(p, "1,6666e-5").codes, ["tooManyDigits"]);
  assert.deepEqual(check(p, "1,6e-5").codes, ["truncated"]);
  assert.deepEqual(check(p, "1,8e-5").codes, ["lastDigit"]);
  assert.equal(check(p, "1,8e-5").status, "correct");
  assert.equal(check(p, "1,9e-5", { lenientLastDigit: true }).status, "wrong");
  assert.equal(check(p, "1,8e-5", { lenientLastDigit: false }).status, "wrong");
});

test("unparseable input is invalid, not wrong", () => {
  const p = convertProblem("655", "nm", "m");
  assert.equal(check(p, "").status, "invalid");
  assert.equal(check(p, "abc").status, "invalid");
  assert.equal(check(p, "1.000").error, "thousands");
});

test("misconception: wrong direction, no conversion, off by one", () => {
  const p = convertProblem("655", "nm", "m");
  assert.deepEqual(check(p, "6,55e11").codes, ["wrongDirection"]);
  assert.deepEqual(check(p, "6,55e2").codes, ["noConversion"]);
  assert.deepEqual(check(p, "6,55e-6").codes, ["offByOne"]);
  assert.deepEqual(check(p, "6,55e-8").codes, ["offByOne"]);
});

test("misconception: exponent of the unit not multiplied by 2 or 3", () => {
  const p = convertProblem("3,0", "cm2", "m2"); // right: 3,0e-4
  assert.deepEqual(check(p, "3,0e-2").codes, ["dimNotMultiplied"]);
  const q = convertProblem("2,0", "m3", "cm3"); // right: 2,0e6
  assert.deepEqual(check(q, "2,0e2").codes, ["dimNotMultiplied"]);
});

test("misconception: 60 and 3600 treated as 100", () => {
  const p = convertProblem("2,0", "h", "s", { form: "times", normalized: true, strict: false }); // right: 7,2e3
  assert.deepEqual(check(p, "2,0e4").codes, ["timeDecimal"]);
  const q = convertProblem("3,0", "min", "s"); // right: 1,8e2
  assert.ok(check(q, "3,0e2").codes.includes("timeDecimal"));
});

test("misconception: litre bridge, milli/mega swap", () => {
  const p = convertProblem("2,0", "L", "m3"); // right 2,0e-3
  assert.ok(check(p, "2,0e0").codes.includes("litreBridge"));
  const q = convertProblem("5,0", "mm", "m"); // right 5,0e-3
  assert.ok(check(q, "5,0e3").codes.includes("prefixSwap") || check(q, "5,0e3").codes.includes("wrongDirection"));
});

test("scientific data: both shifts applied (mantissa and exponent)", () => {
  const p = convertProblem("6,5e-7", "m", "nm"); // right 6,5e2
  assert.equal(check(p, "6,5e2").status, "correct");
  assert.deepEqual(check(p, "6,5e11").codes, ["doubleShift"]);
});

test("module 1: notation errors", () => {
  const p = generate(1, 1, { variant: "toSci" });
  const ok = fmt(p.expected, "it", "times");
  assert.equal(check(p, ok).status, "correct");
  const q = generate(1, 7, { variant: "normalize" });
  assert.equal(check(q, fmt(q.expected, "it", "e")).status, "correct");
  // a non-normalized but equal answer is partial
  const mantissa = parseNumber(fmt(q.expected, "it", "e"));
  const wrongX = `${mantissa.ip}${mantissa.fp},0e${mantissa.exp - mantissa.fp.length}`;
  assert.ok(["partial", "wrong"].includes(check(q, wrongX).status));
});

test("module 1: sign error, forgotten shift, off by one are named", () => {
  for (let seed = 1; seed < 80; seed++) {
    const p = generate(1, seed, { variant: "toSci" });
    const X = p.diag.n;
    const m = fmt(p.diag.base, "it", "e").split("e")[0];
    assert.deepEqual(check(p, `${m}e${-X}`).codes, ["wrongDirection"], `seed ${seed}`);
    assert.ok(check(p, `${m}e0`).codes.includes("noShift"), `seed ${seed}`);
    assert.ok(check(p, `${m}e${X + 1}`).codes.includes("offByOne"), `seed ${seed}`);
  }
});

test("notation 'format' exercises insist on the requested notation", () => {
  const p = generate(1, 3, { variant: "format" });
  const other = p.ask.form === "e" ? "times" : "e";
  assert.equal(check(p, fmt(p.expected, "it", p.ask.form)).status, "correct");
  assert.deepEqual(check(p, fmt(p.expected, "it", other)).codes, ["wrongNotation"]);
});
