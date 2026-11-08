// Units Lab · generator.js
// Procedural exercises from a seed. A problem is plain data (no DOM):
//   { id, module, kind, data, dataForm, dataI, fromUnit?, toUnit?, ctx?, expected, ask, exact, diag? }
// kinds: "notation" (1), "prefix" (2), "convert" (3-5), "order"/"intruder" (6), "oom" (7).

import { mk, fromSci, parseNumber, sciExp, mulRatio, shift10, cmp, eq, decimalAmbiguous } from "./decimal.js";
import { decimalString, fmt } from "./format.js";
import { makeRng } from "./rng.js";
import { parseUnit, ratio, sameDim, PREFIXES, unitLabel, SYMBOL_TIER } from "./units.js";
import { CONTEXTS } from "../data/contexts.js";

const MAX_DECIMAL_LEN = 9;

// ---------- digits and values ----------

function drawDigits(rng, sf) {
  let s = String(rng.int(1, 9));
  for (let i = 1; i < sf; i++) s += String(rng.int(0, 9));
  if (sf > 1 && s.endsWith("0")) s = s.slice(0, -1) + String(rng.int(1, 9));
  return s;
}

/** A value in [lo, hi] with `sf` significant figures (last digit never 0 for sf > 1). */
function drawInRange(rng, lo, hi, sf) {
  const q = Math.floor(Math.log10(hi)) - sf + 1;
  const unit = 10 ** q;
  const dmin = Math.max(10 ** (sf - 1), Math.ceil(lo / unit - 1e-9));
  const dmax = Math.min(10 ** sf - 1, Math.floor(hi / unit + 1e-9));
  for (let k = 0; k < 40; k++) {
    const D = rng.int(dmin, dmax);
    if (sf > 1 && D % 10 === 0) continue;
    return mk(1, BigInt(D), q, sf);
  }
  return mk(1, BigInt(dmin + (dmin % 10 === 0 ? 1 : 0)), q, sf);
}

const pointDigits = (dec, i) => ({ digits: dec.d.toString(), i });

/** Text of a number as it appears in the statement: decimal, or sci with the mantissa point at i. */
function shown(problem, loc, html = false) {
  return fmt(problem.data, loc, problem.dataForm, { html, i: problem.dataI ?? 1 });
}

// ---------- module 1: notation ----------

const FORMS = ["times", "e"];

function genNotation(rng, opts = {}) {
  const kind = opts.variant ?? pickWeighted(rng, { toSci: 0.35, normalize: 0.3, toDecimal: 0.2, format: 0.15 });
  const sf = rng.pick([1, 2, 2, 3, 3, 4]);
  const digits = drawDigits(rng, sf);
  const sign = 1;
  const askForm = rng.pick(FORMS);
  const base = { module: 1, kind: "notation", variant: kind };

  if (kind === "toSci") {
    const X = rng.pick([-7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7]);
    const data = fromSci(sign, digits, X);
    if (decimalString(data, "it").length > 11) return genNotation(rng, opts);
    const baseDec = fromSci(sign, digits, 0);
    return { ...base, data, dataForm: "decimal", expected: data, ask: { form: askForm, normalized: true, strict: false }, exact: true, diag: { base: baseDec, n: X } };
  }
  if (kind === "toDecimal") {
    const X = rng.pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
    const data = fromSci(sign, digits, X);
    if (decimalString(data, "it").length > MAX_DECIMAL_LEN) return genNotation(rng, opts);
    const baseDec = fromSci(sign, digits, 0);
    return { ...base, data, dataForm: rng.pick(FORMS), dataI: 1, expected: data, ask: { form: "decimal", normalized: false, strict: false }, exact: true, diag: { base: baseDec, n: X } };
  }
  if (kind === "normalize") {
    const X = rng.int(-9, 9);
    const i = rng.pick([-2, -1, 0, 2, 3, 4]);
    const data = fromSci(sign, digits, X);
    const xShown = X + 1 - i;
    if (Math.abs(xShown) > 12) return genNotation(rng, opts);
    const baseDec = fromSci(sign, digits, xShown);
    return { ...base, data, dataForm: rng.pick(FORMS), dataI: i, expected: data, ask: { form: askForm, normalized: true, strict: false }, exact: true, diag: { base: baseDec, n: X - xShown } };
  }
  // format: same number, other notation
  const X = rng.int(-8, 8) || 3;
  const data = fromSci(sign, digits, X);
  const fromForm = rng.pick(FORMS);
  const toForm = fromForm === "e" ? "times" : "e";
  return { ...base, data, dataForm: fromForm, dataI: 1, expected: data, ask: { form: toForm, normalized: true, strict: true }, exact: true, diag: { base: data, n: 0 } };
}

function pickWeighted(rng, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

// ---------- modules 2-4: conversions ----------

function candidateUnits(ctx) {
  const natural = parseUnit(ctx.unit);
  const out = [];
  for (const a of ctx.alts) {
    const u = parseUnit(a);
    if (sameDim(natural, u) && a !== ctx.unit) out.push(a);
  }
  return out;
}

function ctxTier(ctx) {
  const specs = [ctx.unit, ...ctx.alts];
  return Math.max(ctx.tier ?? 1, ...specs.map((s) => SYMBOL_TIER(parseUnit(s))));
}

function genConvert(rng, mod, opts = {}) {
  const maxTier = opts.maxTier ?? 3;
  const pool = CONTEXTS.filter((c) => c.m === mod && ctxTier(c) <= maxTier && !(opts.avoid ?? []).includes(c.id));
  for (let attempt = 0; attempt < 60; attempt++) {
    const ctx = rng.pick(pool);
    const natural = parseUnit(ctx.unit);
    const other = rng.pick(candidateUnits(ctx));
    const reverse = rng.chance(0.4);
    const x = ctx.fixed ? parseNumber(ctx.fixed).dec : drawInRange(rng, ctx.lo, ctx.hi, ctx.sf);
    let fromSpec = ctx.unit;
    let toSpec = other;
    let data = x;
    if (reverse) {
      fromSpec = other;
      toSpec = ctx.unit;
      const r = ratio(natural, parseUnit(other));
      data = mulRatio(x, r.n, r.d, r.p, { sf: x.sf }).dec;
    }
    const r = ratio(parseUnit(fromSpec), parseUnit(toSpec));
    const res = mulRatio(data, r.n, r.d, r.p, { sf: data.sf });
    const expected = res.dec;
    if (Math.abs(sciExp(expected)) > 15 || Math.abs(sciExp(data)) > 15) continue;

    const pSci = opts.pSci ?? 0.25;
    const decLen = decimalString(data, "it").length;
    const sciData = (decLen > MAX_DECIMAL_LEN || rng.chance(pSci)) && sciExp(data) !== 0;
    let dataForm = "decimal";
    let dataI = 1;
    if (sciData) {
      dataForm = rng.pick(FORMS);
      dataI = rng.chance(opts.pNonStd ?? 0.2) && data.sf < 5 ? rng.pick([0, 2]) : 1;
    }
    const expLen = decimalString(expected, "it").length;
    const askSci = (sciData || expLen > MAX_DECIMAL_LEN || sciExp(expected) < -4 || sciExp(expected) > 6) && sciExp(expected) !== 0;
    const ask = askSci ? { form: rng.pick(FORMS), normalized: true, strict: false } : { form: "decimal", normalized: false, strict: false };
    return {
      module: mod,
      kind: "convert",
      ctx: ctx.id,
      text: ctx.it,
      data,
      dataForm,
      dataI,
      fromUnit: fromSpec,
      toUnit: toSpec,
      expected,
      ask,
      exact: res.exact,
      ambiguous: decimalAmbiguous(expected),
    };
  }
  throw new Error(`could not generate module ${mod} exercise`);
}

// ---------- module 6: compare ----------

/** plain decimal when it is short, otherwise a·10^n */
const displayForm = (dec) => (decimalString(dec, "it").length > 8 ? "times" : "decimal");

const FAMILIES = [
  { base: "m", prefixes: ["p", "n", "µ", "m", "c", "d", "", "h", "k", "M", "G"] },
  { base: "g", prefixes: ["µ", "m", "c", "", "da", "h", "k", "M"] },
  { base: "s", prefixes: ["p", "n", "µ", "m", "c", "", "k"] },
  { base: "Hz", prefixes: ["", "da", "h", "k", "M", "G"] },
  { base: "W", prefixes: ["µ", "m", "", "h", "k", "M", "G"] },
  { base: "J", prefixes: ["m", "", "h", "k", "M", "G"] },
];

function genOrder(rng, opts = {}) {
  const fam = rng.pick(FAMILIES);
  for (let attempt = 0; attempt < 200; attempt++) {
    const pxs = rng.shuffle(fam.prefixes).slice(0, 4);
    const items = pxs.map((px) => {
      const sf = rng.pick([1, 2, 2, 3]);
      const digits = drawDigits(rng, sf);
      const X = rng.int(-2, 3);
      const dec = fromSci(1, digits, X);
      const unit = parseUnit(px + fam.base);
      const r = ratio(unit, parseUnit(fam.base));
      const inBase = mulRatio(dec, r.n, r.d, r.p, { sf }).dec;
      return { dec, unit: px + fam.base, inBase, form: displayForm(dec) };
    });
    // all distinct, and the printed numbers must disagree with the true order at least once
    let distinct = true;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (eq(items[i].inBase, items[j].inBase)) distinct = false;
    if (!distinct) continue;
    const trueOrder = items.map((_, i) => i).sort((a, b) => cmp(items[a].inBase, items[b].inBase));
    const numOrder = items.map((_, i) => i).sort((a, b) => cmp(items[a].dec, items[b].dec));
    if (trueOrder.every((v, i) => v === numOrder[i])) continue;
    const dir = rng.pick(["asc", "desc"]);
    const answer = dir === "asc" ? trueOrder : trueOrder.slice().reverse();
    return { module: 6, kind: "order", dir, items, answer, base: fam.base };
  }
  throw new Error("could not generate an ordering exercise");
}

function genIntruder(rng) {
  const fam = rng.pick(FAMILIES);
  for (let attempt = 0; attempt < 200; attempt++) {
    const sf = rng.pick([2, 2, 3]);
    const digits = drawDigits(rng, sf);
    const X = rng.int(-3, 4);
    const ref = fromSci(1, digits, X);
    const pxs = rng.shuffle(fam.prefixes).slice(0, 5);
    const expr = pxs.map((px) => {
      const r = ratio(parseUnit(fam.base), parseUnit(px + fam.base));
      const dec = mulRatio(ref, r.n, r.d, r.p, { sf }).dec;
      return { dec, unit: px + fam.base, form: displayForm(dec) };
    });
    if (expr.some((e) => Math.abs(sciExp(e.dec)) > 12)) continue;
    if (expr.filter((e) => e.form !== "decimal").length > 2) continue;
    const k = rng.pick([-3, -2, -1, 1, 2, 3]);
    const bad = rng.int(0, 4);
    const wrong = shift10(expr[bad].dec, k);
    expr[bad] = { ...expr[bad], dec: wrong, form: displayForm(wrong) };
    return { module: 6, kind: "intruder", items: expr, answer: bad, ref, shiftError: k, base: fam.base };
  }
  throw new Error("could not generate an intruder exercise");
}

// ---------- module 2: prefixes as powers of ten ----------

const PFX = PREFIXES.filter((p) => p.sym !== "");
const BASES_PX = ["m", "g", "s", "L", "W", "N", "Hz", "J", "Pa", "V"];
const SWAP_PX = { m: "M", M: "m", µ: "m", k: "m", c: "C" };

const intDec = (k) => parseNumber(String(k)).dec;
const swapExp = (sym) => (SWAP_PX[sym] && PX_EXP[SWAP_PX[sym]] !== undefined ? PX_EXP[SWAP_PX[sym]] : null);
const PX_EXP = Object.fromEntries(PREFIXES.map((p) => [p.sym, p.exp]));

/** wrong-answer models: [id, integer] pairs → [{id, value}] without the right answer and duplicates */
function intModels(right, pairs) {
  const out = [];
  for (const [id, v] of pairs) {
    if (v === null || v === undefined || v === right || !Number.isFinite(v)) continue;
    if (out.some((m) => m.id === id)) continue;
    out.push({ id, value: intDec(v) });
  }
  return out;
}

function genPrefix(rng, opts = {}) {
  const variant = opts.variant ?? pickWeighted(rng, { toPower: 0.22, toPrefix: 0.18, substitute: 0.24, swapBack: 0.18, diff: 0.18 });
  const base = rng.pick(BASES_PX);
  const head = { module: 2, kind: "prefix", variant, base };

  if (variant === "toPower") {
    const px = rng.pick(PFX);
    const sw = swapExp(px.sym);
    return {
      ...head,
      px: px.sym,
      exp: px.exp,
      expected: intDec(px.exp),
      integer: true,
      ask: { form: "decimal", normalized: false, strict: false },
      exact: true,
      models: [...intModels(px.exp, [["signFlip", -px.exp], ["prefixSwap", sw]]), { id: "valueNotExp", value: fromSci(1, "1", px.exp) }],
    };
  }

  if (variant === "toPrefix" || variant === "swapBack") {
    const target = rng.pick(PFX.filter((p) => p.sym !== "da"));
    const opposite = PFX.find((p) => p.exp === -target.exp && p.sym !== "da");
    const others = rng.shuffle(PFX.filter((p) => p !== target && p !== opposite)).slice(0, opposite ? 2 : 3);
    const opts4 = rng.shuffle([target, ...(opposite ? [opposite] : []), ...others]);
    const items = opts4.map((p) => p.sym);
    const answer = items.indexOf(target.sym);
    if (variant === "toPrefix") return { ...head, choice: true, exp: target.exp, items, answer };
    const digits = drawDigits(rng, rng.pick([1, 2, 2, 3]));
    return { ...head, choice: true, data: fromSci(1, digits, target.exp), dataForm: "times", dataI: 1, mant: fromSci(1, digits, 0), exp: target.exp, items, answer };
  }

  if (variant === "substitute") {
    const px = rng.pick(PFX.filter((p) => p.sym !== "da"));
    const digits = drawDigits(rng, rng.pick([1, 2, 2, 3]));
    const X = rng.pick([-2, -1, 0, 0, 1, 2]);
    const data = fromSci(1, digits, X);
    const expected = fromSci(1, digits, X + px.exp);
    const askForm = rng.pick(FORMS);
    const sw = swapExp(px.sym);
    const wrongs = [["signFlip", fromSci(1, digits, X - px.exp)], ["noPower", data]];
    if (sw !== null) wrongs.push(["prefixSwap", fromSci(1, digits, X + sw)]);
    const models = wrongs.filter(([, v]) => !eq(v, expected)).map(([id, value]) => ({ id, value }));
    return { ...head, px: px.sym, exp: px.exp, data, dataForm: "decimal", expected, ask: { form: askForm, normalized: false, strict: false }, exact: true, models };
  }

  // diff: 1 a-unit = 10^? b-units
  for (let k = 0; k < 100; k++) {
    const a = rng.pick(PREFIXES);
    const b = rng.pick(PREFIXES);
    const d = a.exp - b.exp;
    if (!d || (a.sym === "" && b.sym === "") || Math.abs(d) > 15) continue;
    return {
      ...head,
      a: a.sym,
      b: b.sym,
      exp: d,
      expected: intDec(d),
      integer: true,
      ask: { form: "decimal", normalized: false, strict: false },
      exact: true,
      models: intModels(d, [["signFlip", -d], ["sumInstead", a.exp + b.exp]]),
    };
  }
  throw new Error("could not generate a prefix exercise");
}

// ---------- module 7: orders of magnitude ----------
// Convention: for a = mantissa in [1,10), the order of magnitude is 10^n if a < 5, 10^(n+1) if a ≥ 5.

/** { n, up, order, a } of a nonzero Dec: n = exponent of the normalized form, up = mantissa ≥ 5 */
function oomOf(dec) {
  const n = sciExp(dec);
  const first = Number(dec.d.toString()[0]);
  const a = Number(dec.d) / 10 ** (dec.sf - 1);
  const up = first >= 5;
  return { n, up, a, order: up ? n + 1 : n };
}

function showForm(rng, data, opts = {}) {
  const decLen = decimalString(data, "it").length;
  const sci = (decLen > MAX_DECIMAL_LEN || rng.chance(opts.pSci ?? 0.55)) && sciExp(data) !== 0;
  return sci ? rng.pick(FORMS) : "decimal";
}

function pickCtx(rng, pool) {
  const ctx = rng.pick(pool);
  const x = ctx.fixed ? parseNumber(ctx.fixed).dec : null;
  return { ctx, x };
}

function genOom(rng, opts = {}) {
  const variant = opts.variant ?? pickWeighted(rng, { direct: 0.3, edge: 0.2, inUnit: 0.3, ratio: 0.2 });
  const maxTier = opts.maxTier ?? 3;
  const pool = CONTEXTS.filter((c) => ctxTier(c) <= maxTier && !(opts.avoid ?? []).includes(c.id));
  const head = { module: 7, kind: "oom", variant };
  const ask = { form: "decimal", normalized: false, strict: false };

  for (let attempt = 0; attempt < 200; attempt++) {
    if (variant === "edge") {
      const sf = rng.pick([2, 2, 3]);
      const first = rng.chance(0.5) ? 4 : 5;
      let digits = String(first);
      for (let i = 1; i < sf; i++) digits += String(first === 4 ? rng.int(5, 9) : rng.int(0, 5));
      if (digits.endsWith("0")) digits = digits.slice(0, -1) + "1";
      const X = rng.pick([-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8]);
      const data = fromSci(1, digits, X);
      const o = oomOf(data);
      if (o.order === 0) continue;
      const form = showForm(rng, data, { pSci: 0.7 });
      return { ...head, data, dataForm: form, dataI: 1, expected: intDec(o.order), integer: true, ask, exact: true, oom: o, models: oomModels(o) };
    }

    if (variant === "ratio") {
      const A = rng.pick(pool);
      const unitA = parseUnit(A.unit);
      const Bs = pool.filter((c) => c.id !== A.id && sameDim(parseUnit(c.unit), unitA));
      if (!Bs.length) continue;
      const B = rng.pick(Bs);
      const xa = A.fixed ? parseNumber(A.fixed).dec : drawInRange(rng, A.lo, A.hi, A.sf);
      const xb0 = B.fixed ? parseNumber(B.fixed).dec : drawInRange(rng, B.lo, B.hi, B.sf);
      const r = ratio(parseUnit(B.unit), unitA);
      const xb = mulRatio(xb0, r.n, r.d, r.p, { sf: xb0.sf }).dec;
      if (xb.d === 0n) continue;
      const oa = oomOf(xa);
      const ob = oomOf(xb);
      const diff = oa.order - ob.order;
      if (!diff || Math.abs(diff) > 25 || Math.abs(sciExp(xa)) > 15 || Math.abs(sciExp(xb)) > 15) continue;
      const pairs = [["ratioInverted", -diff], ["noRound", oa.n - ob.n], ["ratioSum", oa.order + ob.order]];
      return {
        ...head,
        ctx: A.id,
        ctxB: B.id,
        text: `A: ${A.it} · B: ${B.it}`,
        data: xa,
        dataB: xb,
        dataForm: showForm(rng, xa, { pSci: 0.7 }),
        dataFormB: showForm(rng, xb, { pSci: 0.7 }),
        dataI: 1,
        unit: A.unit,
        expected: intDec(diff),
        integer: true,
        ask,
        exact: true,
        oom: oa,
        oomB: ob,
        models: intModels(diff, pairs),
      };
    }

    const ctx = rng.pick(pool);
    const x = ctx.fixed ? parseNumber(ctx.fixed).dec : drawInRange(rng, ctx.lo, ctx.hi, ctx.sf);
    if (variant === "direct") {
      const o = oomOf(x);
      if (o.order === 0 || Math.abs(sciExp(x)) > 15) continue;
      return { ...head, ctx: ctx.id, text: ctx.it, data: x, dataForm: showForm(rng, x), dataI: 1, unit: ctx.unit, expected: intDec(o.order), integer: true, ask, exact: true, oom: o, models: oomModels(o) };
    }
    // inUnit
    const others = candidateUnits(ctx);
    if (!others.length) continue;
    const other = rng.pick(others);
    const r = ratio(parseUnit(ctx.unit), parseUnit(other));
    const conv = mulRatio(x, r.n, r.d, r.p, { sf: x.sf }).dec;
    if (conv.d === 0n || Math.abs(sciExp(conv)) > 15 || Math.abs(sciExp(x)) > 15) continue;
    const o = oomOf(conv);
    const o0 = oomOf(x);
    const back = mulRatio(x, r.d, r.n, -r.p, { sf: x.sf }).dec;
    const wrongDir = back.d === 0n ? null : oomOf(back).order;
    if (o.order === 0 || o.order === o0.order) continue;
    const pairs = [["noConversion", o0.order], ["wrongDirection", wrongDir], ["noRound", o.n], ...oomModels(o).map((m) => [m.id, m.v])];
    return {
      ...head,
      ctx: ctx.id,
      text: ctx.it,
      data: x,
      dataForm: showForm(rng, x),
      dataI: 1,
      unit: ctx.unit,
      toUnit: other,
      fromUnit: ctx.unit,
      converted: conv,
      expected: intDec(o.order),
      integer: true,
      ask,
      exact: true,
      oom: o,
      models: intModels(o.order, pairs),
    };
  }
  throw new Error("could not generate an order-of-magnitude exercise");
}

/** typical mistakes on the rounding step */
function oomModels(o) {
  const out = [];
  if (o.up) out.push({ id: "noRound", v: o.n });
  else out.push({ id: o.a >= 3.16 ? "sqrt10" : "roundWrong", v: o.n + 1 });
  return out.map((m) => ({ id: m.id, value: intDec(m.v), v: m.v }));
}

// ---------- public entry ----------

/** module 1..5; seed any integer. Returns a problem with an id "<module>-<seed>". */
function generate(module, seed, opts = {}) {
  const rng = makeRng(seed);
  let p;
  if (module === 1) p = genNotation(rng, opts);
  else if (module >= 3 && module <= 5) p = genConvert(rng, module, opts);
  else if (module === 2) p = genPrefix(rng, opts);
  else if (module === 6) p = rng.chance(0.5) ? genOrder(rng, opts) : genIntruder(rng);
  else if (module === 7) p = genOom(rng, opts);
  else throw new Error("module must be 1..7");
  return { id: `${module}-${seed}`, ...p };
}

export { oomOf, intDec, generate, shown, drawInRange, drawDigits, genNotation, genConvert, genOrder, genIntruder, ctxTier, candidateUnits, pointDigits, unitLabel };
