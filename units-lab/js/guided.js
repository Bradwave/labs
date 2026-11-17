// Units Lab · guided.js
// The guided method for conversions by powers of ten, as taught in class: a balance.
//   prediction  the sign of the final exponent
//   ① convert   the unit is multiplied by 10^u, the number by 10^n: balanced when u + n = 0
//   ② normalize the comma moves (mantissa × 10^s), the power compensates (× 10^q): balanced when s + q = 0
//   ③ sum       10^x0 · 10^n · 10^q = 10^E
// Pure functions, no DOM.

import { parseUnit, ratio } from "./units.js";
import { sciExp } from "./decimal.js";

/** Plan of the guided solution, or null when the problem does not fit the method. */
function planFor(problem) {
  if (!problem || problem.kind !== "convert") return null;
  let r;
  try {
    r = ratio(parseUnit(problem.fromUnit), parseUnit(problem.toUnit));
  } catch (e) {
    return null;
  }
  if (r.n !== r.d) return null; // a factor like 60 or 3600: not a power of ten
  const p = r.p;
  const data = problem.data;
  const exp = problem.expected;
  if (p === 0 || data.d !== exp.d) return null;
  const dec = problem.dataForm === "decimal";
  const i0 = dec ? data.sf + data.e : problem.dataI ?? 1;
  const x0 = dec ? 0 : sciExp(data) + 1 - i0;
  const q = i0 - 1;
  const E = x0 + p + q;
  if (E !== sciExp(exp) || E === 0) return null;
  return { digits: data.d.toString(), i0, x0, unit: -p, n: p, q, E, sign: E > 0 ? "pos" : "neg", normalized: i0 === 1 };
}

/** The same problem, asked in scientific notation (the method always ends there). */
function guidedProblem(problem, seed = 0) {
  if (problem.ask.form !== "decimal") return problem;
  const form = problem.dataForm !== "decimal" ? problem.dataForm : Math.abs(seed) % 2 ? "e" : "times";
  return { ...problem, ask: { form, normalized: true, strict: false } };
}

// ---------- checks, one per step: { ok, code? } ----------

function checkConvert(plan, u, n) {
  if (u !== plan.unit) return { ok: false, code: "g_unit", where: "unit" };
  if (n !== plan.n) return { ok: false, code: "g_balance", where: "num" };
  return { ok: true };
}

/** i: digits before the comma now; q: the exponent set to compensate. */
function checkNormalize(plan, i, q) {
  if (i !== 1) return { ok: false, code: "g_comma", where: "comma" };
  if (q !== plan.q) return { ok: false, code: "g_balance", where: "pow" };
  return { ok: true };
}

function checkSum(plan, E) {
  return E === plan.E ? { ok: true } : { ok: false, code: "g_sum", where: "sum" };
}

/** Is the beam level? (the two exponents cancel) */
const balanced = (a, b) => a + b === 0;

/**
 * Tilt of the beam in degrees. Left pan: the quantity before; right pan: after, with the tokens.
 * The tokens multiply the right pan by 10^(a+b): level when a + b = 0, down when it grew (positive).
 */
function tilt(a, b) {
  const d = a + b;
  return d === 0 ? 0 : Math.sign(d) * Math.min(14, 5 + Math.abs(d));
}

/** Exponent tokens to add in step ③ (zeros left out, but never all of them). */
function sumTerms(plan) {
  const all = [plan.x0, plan.n, plan.q];
  const nz = all.filter((x) => x !== 0);
  return nz.length ? nz : [0];
}

/** Final status: no mistake = correct; mistakes but finished = partial (the climber stays). */
function outcome(mistakes) {
  const codes = [...new Set(mistakes)];
  return { status: codes.length ? "partial" : "correct", codes };
}

export { planFor, guidedProblem, checkConvert, checkNormalize, checkSum, balanced, tilt, sumTerms, outcome };
