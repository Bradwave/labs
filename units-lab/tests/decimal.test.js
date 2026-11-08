// Units Lab: Tests for decimal.js (exact numbers, significant figures, parsing).
import test from "node:test";
import assert from "node:assert/strict";
import { parseNumber, mulRatio, roundTo, eq, sciExp, decimalAmbiguous, step, fromSci } from "../js/decimal.js";
import { fmt, decimalString } from "../js/format.js";

const P = (s, o) => {
  const r = parseNumber(s, o);
  assert.ok(r.ok, `"${s}" should parse (${r.error})`);
  return r;
};

test("0,042·10^-3 is 4,2·10^-5 with 2 figures", () => {
  const a = P("0,042·10^-3").dec;
  assert.equal(a.sf, 2);
  assert.equal(sciExp(a), -5);
  assert.equal(fmt(a, "it", "times"), "4,2·10^−5");
  assert.equal(fmt(a, "it", "e"), "4,2e−5");
  assert.equal(fmt(a, "it", "times", { html: true }), "4,2·10<sup>−5</sup>");
});

test("trailing zeros: not significant without separator, significant with it", () => {
  assert.equal(P("5200").dec.sf, 2);
  assert.equal(P("5200,").dec.sf, 4);
  assert.equal(P("5,20e3").dec.sf, 3);
  assert.equal(P("5e3").dec.sf, 1);
  assert.equal(P("0,00420").dec.sf, 3);
  assert.equal(P("50e2").dec.sf, 1);
});

test("accepted spellings of the same number", () => {
  const ref = P("5,2e3").dec;
  for (const s of ["5,2E3", "5.2e3", "5,2·10^3", "5,2*10^3", "5,2x10^3", "5,2 × 10^3", "5,2×10³", "5,2·10^+3", "52e2", "0,52e4"]) {
    assert.ok(eq(P(s).dec, ref), s);
  }
  assert.equal(P("−5,2e−3").dec.s, -1);
  assert.equal(P("5,2·10⁻³").dec.e, -4);
});

test("form and normalization are reported", () => {
  assert.equal(P("5,2e3").form, "e");
  assert.equal(P("5,2·10^3").form, "times");
  assert.equal(P("5200").form, "decimal");
  assert.equal(P("5,2e3").normalized, true);
  assert.equal(P("52e2").normalized, false);
  assert.equal(P("0,52·10^4").normalized, false);
});

test("bad input is refused, 1.000 is flagged as ambiguous", () => {
  assert.equal(parseNumber("").error, "empty");
  assert.equal(parseNumber("abc").error, "syntax");
  assert.equal(parseNumber("1,2,3").error, "syntax");
  assert.equal(parseNumber("e5").error, "syntax");
  assert.equal(parseNumber("1.000").error, "thousands");
  assert.equal(parseNumber("1.000", { locale: "en" }).ok, true);
  assert.equal(parseNumber("1,000", { locale: "en" }).error, "thousands");
  assert.equal(parseNumber("2.5").ok, true);
});

test("rounding keeps the figures of the data: 1,0 L/min → 1,7·10^-5 m³/s", () => {
  const r = mulRatio(P("1,0").dec, 1n, 60n, -3, { sf: 2 });
  assert.equal(fmt(r.dec, "it", "times"), "1,7·10^−5");
  assert.equal(r.exact, false);
});

test("exact results are flagged exact; 36 km/h = 10 m/s", () => {
  const r = mulRatio(P("36").dec, 1000n, 3600n, 0);
  assert.equal(r.exact, true);
  assert.equal(decimalString(r.dec, "it"), "10");
  assert.equal(r.dec.sf, 2);
  assert.equal(decimalAmbiguous(r.dec), true);
});

test("pure power-of-ten factors keep every digit, including trailing zeros", () => {
  const r = mulRatio(P("5,20").dec, 1000n, 1n, 0);
  assert.equal(r.dec.sf, 3);
  assert.equal(fmt(r.dec, "it", "times"), "5,20·10^3");
});

test("half-up rounding and carry over", () => {
  assert.equal(fmt(roundTo(P("9,96").dec, 2), "it", "e"), "1,0e1");
  assert.equal(fmt(roundTo(P("2,25").dec, 2), "it", "e"), "2,3e0");
  assert.equal(fmt(roundTo(P("2,25").dec, 2, "trunc"), "it", "e"), "2,2e0");
  assert.equal(fmt(roundTo(P("2,5").dec, 3), "it", "e"), "2,50e0");
});

test("step moves the last digit and handles carries", () => {
  assert.equal(fmt(step(P("1,7e-5").dec, 1), "it", "e"), "1,8e−5");
  assert.equal(fmt(step(P("1,0e1").dec, -1), "it", "e"), "9,9e0");
  assert.equal(fmt(step(P("9,9e0").dec, 1), "it", "e"), "1,0e1");
});

test("english formatting uses the decimal point", () => {
  const a = fromSci(1, "42", -3);
  assert.equal(decimalString(a, "en"), "0.0042");
  assert.equal(decimalString(a, "it"), "0,0042");
  assert.equal(fmt(a, "en", "e"), "4.2e−3");
});

test("format → parse round trip for many numbers and forms", () => {
  for (const s of ["4,2", "0,00042", "123,4", "5,20", "7", "300000", "0,5", "9,99e-9", "1,0e12"]) {
    const a = P(s).dec;
    for (const form of ["decimal", "times", "e"]) {
      const back = P(fmt(a, "it", form)).dec;
      assert.ok(eq(a, back), `${s} → ${form}`);
      if (!(form === "decimal" && decimalAmbiguous(a))) assert.equal(back.sf, a.sf, `${s} sf in ${form}`);
    }
  }
});
