// Units Lab · errors.js
// Misconception models. Each model computes the WRONG answer a student with that misconception
// would produce; the checker compares the student's answer with all of them.

import { mulRatio, shift10, eq } from "./decimal.js";
import { parseUnit, ratio } from "./units.js";

const F = (n, d, p) => ({ n: BigInt(n), d: BigInt(d), p });
const SWAP_MILLI_MEGA = { m: "M", M: "m" };
const SWAP_MICRO_MILLI = { µ: "m", m: "µ" };

const hasSym = (u, syms) => u.terms.some((t) => syms.includes(t.unit.sym));
const hasPx = (u, syms) => u.terms.some((t) => syms.includes(t.px.sym));

/**
 * models(problem) → [{ id, value: Dec }]  (only models that differ from the right answer).
 * problem.kind "convert": uses data, fromUnit, toUnit.
 * problem.kind "notation": uses diag = { base, n } and builds base·10^a for the typical wrong shifts a.
 */
function models(problem) {
  const out = [];
  const E = problem.expected;
  const add = (id, value) => {
    if (!value || eq(value, E)) return;
    if (out.some((m) => m.id === id && eq(m.value, value))) return;
    out.push({ id, value });
  };

  if (problem.models) {
    for (const m of problem.models) add(m.id, m.value);
    return out;
  }

  if (problem.kind === "notation") {
    const { base, n } = problem.diag;
    if (n === 0) return out;
    add("noShift", shift10(base, 0));
    add("wrongDirection", shift10(base, -n));
    add("offByOne", shift10(base, n + 1));
    add("offByOne", shift10(base, n - 1));
    add("doubleShift", shift10(base, 2 * n));
    return out;
  }

  if (problem.kind !== "convert") return out;
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const sf = E.sf;
  const run = (n, d, p) => mulRatio(problem.data, n, d, p, { sf }).dec;
  const withMods = (mods) => {
    const r = ratio(from, to, mods);
    return run(r.n, r.d, r.p);
  };
  const right = ratio(from, to);

  add("wrongDirection", run(right.d, right.n, -right.p));
  add("noConversion", run(1n, 1n, 0));
  add("dimNotMultiplied", withMods({ linear: true }));
  add("offByOne", run(right.n, right.d, right.p + 1));
  add("offByOne", run(right.n, right.d, right.p - 1));
  if (right.n === 1n && right.d === 1n) add("doubleShift", run(1n, 1n, 2 * right.p));
  if (hasSym(from, ["min", "h", "d"]) || hasSym(to, ["min", "h", "d"])) {
    add("timeDecimal", withMods({ unitF: { min: F(100, 1, 0), h: F(10000, 1, 0), d: F(1000000, 1, 0) } }));
  }
  if (hasSym(from, ["L"]) || hasSym(to, ["L"])) {
    add("litreBridge", withMods({ unitF: { L: F(1, 1, 0) } }));
    add("litreBridge", withMods({ unitF: { L: F(1, 1, -6) } }));
  }
  if (hasPx(from, ["m", "M"]) || hasPx(to, ["m", "M"])) add("prefixSwap", withMods({ prefixMap: SWAP_MILLI_MEGA }));
  if (hasPx(from, ["µ", "m"]) || hasPx(to, ["µ", "m"])) add("prefixSwap", withMods({ prefixMap: SWAP_MICRO_MILLI }));
  return out;
}

/** ids of every model whose wrong answer equals the student's value */
function diagnose(problem, x) {
  const ids = [];
  for (const m of models(problem)) if (eq(m.value, x) && !ids.includes(m.id)) ids.push(m.id);
  return ids;
}

export { models, diagnose };
