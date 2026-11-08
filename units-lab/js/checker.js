// Units Lab · checker.js
// Checks a student's answer: value (exact), form (decimal / scientific / normalized),
// significant figures, rounding, and which known misconception explains a wrong answer.
//   status: "correct" (climb) · "partial" (value right, something else off: stay) · "wrong" (slip) · "invalid" (not a number)

import { parseNumber, eq, mulRatio, roundTo, step, decimalAmbiguous } from "./decimal.js";
import { diagnose } from "./errors.js";
import { parseUnit, ratio } from "./units.js";

/**
 * problem: { kind, expected, ask: { form: "decimal"|"times"|"e", normalized, strict }, exact, data?, fromUnit?, toUnit?, diag? }
 * options: locale, lenientLastDigit (accept ±1 in the last digit of a rounded result, default true)
 */
function check(problem, input, { locale = "it", lenientLastDigit = true } = {}) {
  const p = typeof input === "string" ? parseNumber(input, { locale }) : input;
  if (!p.ok) return { status: "invalid", error: p.error, codes: [] };
  const x = p.dec;
  const E = problem.expected;
  const codes = [];
  const ask = problem.ask;

  // answers that are a whole number (an exponent, a count of orders): no figures, no rounding
  if (problem.integer) {
    if (eq(x, E)) return p.form === "decimal" ? { status: "correct", codes, parsed: p } : { status: "partial", codes: ["wrongForm"], parsed: p };
    return { status: "wrong", codes: diagnose(problem, x), parsed: p };
  }

  if (eq(x, E)) {
    let status = "correct";
    if (ask.form === "decimal") {
      if (p.form !== "decimal") {
        codes.push("wrongForm");
        status = "partial";
      }
    } else if (p.form === "decimal") {
      codes.push("wrongForm");
      status = "partial";
    } else {
      if (ask.strict && p.form !== ask.form) {
        codes.push("wrongNotation");
        status = "partial";
      }
      if (ask.normalized && !p.normalized) {
        codes.push("notNormalized");
        status = "partial";
      }
    }
    if (status === "correct" || codes.includes("notNormalized")) {
      const skip = p.form === "decimal" && decimalAmbiguous(E);
      if (!skip && x.sf !== E.sf) {
        codes.push(x.sf > E.sf ? "sfTooMany" : "sfTooFew");
        status = "partial";
      }
    }
    return { status, codes, parsed: p };
  }

  // not equal: rounding / figures first
  if (problem.exact === false && problem.kind === "convert") {
    const r = ratio(parseUnit(problem.fromUnit), parseUnit(problem.toUnit));
    const cut = mulRatio(problem.data, r.n, r.d, r.p, { sf: E.sf, mode: "trunc" }).dec;
    if (eq(x, cut)) return { status: "partial", codes: ["truncated"], parsed: p };
    if (lenientLastDigit && x.sf === E.sf && (eq(x, step(E, 1)) || eq(x, step(E, -1)))) {
      return { status: "correct", codes: ["lastDigit"], parsed: p };
    }
  }
  if (x.sf > E.sf && eq(roundTo(x, E.sf), E)) return { status: "partial", codes: ["tooManyDigits"], parsed: p };
  if (x.sf < E.sf && eq(roundTo(E, x.sf), x)) return { status: "partial", codes: ["tooFewDigits"], parsed: p };

  return { status: "wrong", codes: diagnose(problem, x), parsed: p };
}

export { check };
