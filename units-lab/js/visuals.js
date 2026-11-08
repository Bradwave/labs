// Units Lab · visuals.js
// HTML/SVG builders for the visual feedback: sliding comma, exponent line, power substitution,
// unit-factor chain, significant-figure colouring, log line. Pure functions returning strings.

import { parseUnit, ratio, PX, PREFIXES, unitLabel } from "./units.js";
import { sciExp, mulRatio, mk, fromSci } from "./decimal.js";
import { mantString, expText, fmt, sepOf } from "./format.js";
import { t } from "./i18n.js";

const sup = (x) => `<sup>${expText(x)}</sup>`;
const pow10 = (x) => `10${sup(x)}`;
const singleUnit = (term, pow) => ({ terms: [{ ...term, pow }] });

// ---------- sliding comma ----------

/** Where the comma starts and ends, and the exponents that go with it. Null when digits change. */
function commaPlan(problem) {
  if (problem.kind !== "notation" && problem.kind !== "convert") return null;
  const data = problem.data;
  const exp = problem.expected;
  if (data.d !== exp.d) return null;
  const n = data.sf;
  const decDigits = (a) => n + a.e;
  const dec = problem.dataForm === "decimal";
  const iStart = dec ? decDigits(data) : problem.dataI ?? 1;
  const xStart = dec ? 0 : sciExp(data) + 1 - iStart;
  const toDecimal = problem.ask.form === "decimal";
  const iEnd = toDecimal ? decDigits(exp) : 1;
  const xEnd = toDecimal ? 0 : sciExp(exp);
  return { digits: data.d.toString(), iStart, xStart, iEnd, xEnd, toDecimal, fromDecimal: dec };
}

function tileRange(i, n) {
  return { lo: i <= 0 ? i - 1 : 0, hi: Math.max(n, i) };
}

function commaVisual(problem, loc) {
  const plan = commaPlan(problem);
  if (!plan) return "";
  const { digits, iStart, iEnd, xStart, xEnd } = plan;
  const n = digits.length;
  const a = tileRange(iStart, n);
  const b = tileRange(iEnd, n);
  const lo = Math.min(a.lo, b.lo);
  const hi = Math.max(a.hi, b.hi);
  let html = "";
  for (let j = lo; j <= hi; j++) {
    if (j === iStart && j === iEnd) html += `<i class="cm both" title="${sepOf(loc)}">${sepOf(loc)}</i>`;
    else if (j === iStart) html += `<i class="cm s">${sepOf(loc)}</i>`;
    else if (j === iEnd) html += `<i class="cm e">${sepOf(loc)}</i>`;
    if (j === hi) break;
    const isDigit = j >= 0 && j < n;
    html += `<span class="tl${isDigit ? "" : " z"}">${isDigit ? digits[j] : "0"}</span>`;
  }
  const places = Math.abs(iEnd - iStart);
  const dir = iEnd < iStart ? t("predLeft") : t("predRight");
  const exps = plan.toDecimal ? "" : ` · ${pow10(xStart)} → ${pow10(xEnd)}`;
  return `<div class="vis comma"><div class="tiles">${html}</div><div class="cap">${places ? `${places} ${dir}` : "="}${exps}</div><div class="cap">${t("solComma")}</div></div>`;
}

// ---------- exponent line ----------

function matchTerms(from, to) {
  const key = (tm) => tm.unit.dim.map((v) => v * tm.pow).join();
  const used = new Set();
  const pairs = [];
  for (const tf of from.terms) {
    const j = to.terms.findIndex((tt, k) => !used.has(k) && key(tt) === key(tf));
    if (j < 0) return null;
    used.add(j);
    pairs.push([tf, to.terms[j]]);
  }
  return used.size === to.terms.length ? pairs : null;
}

function lineVisual(problem) {
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const pairs = matchTerms(from, to);
  if (!pairs) return "";
  const pair = pairs.find(([a, b]) => a.unit.sym === b.unit.sym && a.unit.prefixable && Math.abs(a.pow) === Math.abs(b.pow) && a.px.exp !== b.px.exp);
  if (!pair) return "";
  const [a, b] = pair;
  const pw = Math.abs(a.pow);
  const delta = a.px.exp - b.px.exp;
  const unitW = 26;
  const x = (e) => 30 + (e + 12) * unitW;
  const W = 30 * 2 + 24 * unitW;
  const ticks = PREFIXES.map((p) => {
    const on = p.exp === a.px.exp || p.exp === b.px.exp;
    const lab = p.sym || "·";
    return `<line x1="${x(p.exp)}" x2="${x(p.exp)}" y1="46" y2="${on ? 62 : 56}" class="tk${on ? " on" : ""}"/><text x="${x(p.exp)}" y="80" class="pl${on ? " on" : ""}" text-anchor="middle">${lab}</text><text x="${x(p.exp)}" y="94" class="ex" text-anchor="middle">${expText(p.exp)}</text>`;
  }).join("");
  const xa = x(a.px.exp);
  const xb = x(b.px.exp);
  const mid = (xa + xb) / 2;
  const head = xb < xa ? 6 : -6;
  const arc = `<path d="M${xa} 40 Q${mid} ${40 - Math.min(34, 8 + Math.abs(xa - xb) / 4)} ${xb} 40" class="arc"/><path d="M${xb + head} 31 L${xb} 40 L${xb + head * 0.2} 29" class="arc"/>`;
  const svg = `<svg viewBox="0 0 ${W} 100" width="${W}" height="100" role="img" aria-label="${a.px.sym}${a.unit.sym} → ${b.px.sym}${b.unit.sym}"><line x1="20" x2="${W - 20}" y1="46" y2="46" class="axis"/>${ticks}<circle cx="${xa}" cy="46" r="7" class="pa"/><circle cx="${xb}" cy="46" r="7" class="pb"/>${arc}</svg>`;
  const total = delta * a.pow;
  const exact = pw > 1 ? ` · ${expText(delta)} × ${a.pow} = ${expText(total)}` : "";
  const cap = `${t("solLine", `${a.px.sym || "·"} (${expText(a.px.exp)})`, `${b.px.sym || "·"} (${expText(b.px.exp)})`, `${expText(a.px.exp)} − (${expText(b.px.exp)}) = ${expText(delta)}${exact} → ×${pow10(total)}`)}`;
  return `<div class="vis line"><div class="scrollx">${svg}</div><div class="cap">${cap}</div></div>`;
}

// ---------- power substitution (areas, volumes, litres) ----------

function powerVisual(problem) {
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const rows = [];
  for (const tm of [...from.terms, ...to.terms]) {
    const k = Math.abs(tm.pow);
    if (k < 2 || !tm.px.sym || !tm.unit.prefixable) continue;
    const base = tm.unit.sym;
    const lab = unitLabel(singleUnit(tm, k), true);
    const e = tm.px.exp;
    rows.push(
      `<div class="sub">${lab} = (${pow10(e)} ${base})<sup>${k}</sup> = (${pow10(e)})<sup>${k}</sup> ${base}<sup>${k}</sup> = <b>${pow10(e * k)}</b> ${base}<sup>${k}</sup> <span class="mul">${expText(e)} × ${k} = ${expText(e * k)}</span></div>`,
    );
  }
  const hasL = [...from.terms, ...to.terms].some((tm) => tm.unit.sym === "L");
  const bridge = hasL ? `<div class="bridges"><span>1 L = 1 dm<sup>3</sup></span><span>1 mL = 1 cm<sup>3</sup></span><span>1 m<sup>3</sup> = 1000 L</span></div>` : "";
  if (!rows.length && !bridge) return "";
  const k0 = Math.max(...[...from.terms, ...to.terms].map((tm) => Math.abs(tm.pow)));
  return `<div class="vis power">${rows.join("")}${bridge}<div class="cap">${rows.length ? t("solPower", k0) : ""}</div></div>`;
}

// ---------- unit-factor chain ----------

const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));

function factorText(n, d, p) {
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (n === 1n && d === 1n) return p === 0 ? "1" : pow10(p);
  if (d === 1n && p >= 0 && p <= 6) return (n * 10n ** BigInt(p)).toString();
  if (d === 1n && p < 0) return `${n}·${pow10(p)}`;
  return `${n}/${d}${p ? "·" + pow10(p) : ""}`;
}

function unitsHtml(terms) {
  return terms.length ? terms.map((tm) => unitLabel(singleUnit(tm, Math.abs(tm.pow)), true)).join("·") : "1";
}

function factorsVisual(problem, loc, opts = {}) {
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const pairs = matchTerms(from, to);
  const number = fmt(problem.data, loc, problem.dataForm, { html: true, i: problem.dataI ?? 1 });
  const top = from.terms.filter((tm) => tm.pow > 0);
  const bot = from.terms.filter((tm) => tm.pow < 0);
  const frac = (num, den) => `<span class="fr"><span>${num}</span>${den ? `<span class="bar"></span><span>${den}</span>` : ""}</span>`;
  const mark = (html, i) => `<span class="cx" style="--d:${0.4 + i * 0.5}s">${html}</span>`;
  let chain = frac(`${number} ${top.map((tm, i) => mark(unitLabel(singleUnit(tm, tm.pow), true), i)).join("·") || ""}`.trim(), bot.length ? bot.map((tm, i) => mark(unitLabel(singleUnit(tm, -tm.pow), true), top.length + i)).join("·") : "");
  if (pairs) {
    pairs.forEach(([tf, tt], i) => {
      const r = ratio(singleUnit(tf, Math.abs(tf.pow)), singleUnit(tt, Math.abs(tt.pow)));
      const F = factorText(r.n, r.d, r.p);
      const fu = unitLabel(singleUnit(tf, Math.abs(tf.pow)), true);
      const tu = unitLabel(singleUnit(tt, Math.abs(tt.pow)), true);
      chain += ` × ` + (tf.pow > 0 ? frac(`${F} ${tu}`, `1 ${mark(fu, i)}`) : frac(`1 ${mark(fu, i)}`, `${F} ${tu}`));
    });
  } else {
    const r = ratio(from, to);
    chain += ` × ${frac(`${factorText(r.n, r.d, r.p)} ${unitLabel(to, true)}`, `1 ${unitLabel(from, true)}`)}`;
  }
  const res = opts.hide ? "?" : fmt(problem.expected, loc, problem.ask.form, { html: true });
  return `<div class="vis factors"><div class="scrollx"><div class="chain">${chain}<span class="eq">= <b>${res}</b> ${unitLabel(to, true)}</span></div></div><div class="cap">${t("solFactors")}</div></div>`;
}

// ---------- significant figures ----------

/** Decimal writing with the filler zeros greyed out (they only place the comma). */
function figuresHtml(a, loc) {
  const D = a.d.toString();
  const sep = sepOf(loc);
  const z = (s) => (s ? `<span class="zf">${s}</span>` : "");
  const sign = a.s < 0 ? "−" : "";
  if (a.e >= 0) return sign + D + z("0".repeat(a.e));
  const k = -a.e;
  if (D.length > k) return sign + D.slice(0, D.length - k) + sep + D.slice(D.length - k);
  return sign + z("0") + z(sep + "0".repeat(k - D.length)) + D;
}

// ---------- module 5 ----------

function orderVisual(problem, loc) {
  const pts = problem.items.map((it, idx) => {
    const m = Number(it.inBase.d) / 10 ** (it.inBase.sf - 1);
    return { idx, pos: sciExp(it.inBase) + Math.log10(m), it };
  });
  const lo = Math.floor(Math.min(...pts.map((p) => p.pos))) - 0.5;
  const hi = Math.ceil(Math.max(...pts.map((p) => p.pos))) + 0.5;
  const W = 320;
  const x = (v) => 20 + ((v - lo) / (hi - lo)) * (W - 40);
  let ticks = "";
  for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) {
    ticks += `<line x1="${x(e)}" x2="${x(e)}" y1="44" y2="52" class="tk"/><text x="${x(e)}" y="66" class="ex" text-anchor="middle">${pow10txt(e)}</text>`;
  }
  const rank = new Map(problem.answer.map((i, r) => [i, r + 1]));
  const dots = pts
    .map((p) => {
      const row = (rank.get(p.idx) ?? 1) % 2 ? 26 : 10;
      return `<circle cx="${x(p.pos)}" cy="48" r="5" class="pa"/><text x="${x(p.pos)}" y="${row + 6}" text-anchor="middle" class="pl on">${rank.get(p.idx)}</text>`;
    })
    .join("");
  const svg = `<svg viewBox="0 0 ${W} 74" width="100%" role="img"><line x1="10" x2="${W - 10}" y1="48" y2="48" class="axis"/>${ticks}${dots}</svg>`;
  return `<div class="vis order">${svg}<div class="cap">${t("ordSolution")} (${problem.base})</div></div>`;
}

const pow10txt = (e) => `10${superDigits(e)}`;
function superDigits(e) {
  const m = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻" };
  return String(e)
    .split("")
    .map((c) => m[c] ?? c)
    .join("");
}

function intruderVisual(problem, loc) {
  const rows = problem.items
    .map((it, i) => {
      const r = ratio(parseUnit(it.unit), parseUnit(problem.base));
      const inBase = mulRatio(it.dec, r.n, r.d, r.p, { sf: it.dec.sf }).dec;
      const bad = i === problem.answer;
      return `<div class="row${bad ? " bad" : ""}"><span>${fmt(it.dec, loc, it.form, { html: true })} ${unitLabel(parseUnit(it.unit), true)}</span><span>= ${fmt(inBase, loc, "times", { html: true })} ${problem.base}</span><b>${bad ? "✗" : "✓"}</b></div>`;
    })
    .join("");
  return `<div class="vis intruder">${rows}<div class="cap">${t("intSolution", problem.base)}</div></div>`;
}


// ---------- balance: same quantity, tiles of different size ----------

const approx = (r) => (Number(r.n) / Number(r.d)) * 10 ** r.p;

/** one long tile of the big unit against F small tiles (at most 10 drawn, then "…") */
function tilesPair(bigLab, smallLab, F, cap) {
  const shownN = Math.max(2, Math.min(10, Math.round(F)));
  const small = Array.from({ length: shownN }, () => `<i class="tile s"></i>`).join("") + (F > 10.5 ? `<i class="tile more">⋯</i>` : "");
  return `<div class="brow"><span class="bl">${bigLab}</span><div class="bar"><i class="tile b"></i></div></div><div class="brow"><span class="bl">${smallLab}</span><div class="bar">${small}</div></div><div class="cap">${cap}</div>`;
}

/** unit pair (single terms) → { F text, big/small labels, grows (number grows for the exercise) } */
function pairBalance(tf, tt, loc) {
  const same = Math.abs(tf.pow) === Math.abs(tt.pow) && tf.unit.sym === tt.unit.sym;
  const k = Math.abs(tf.pow);
  const r = ratio(singleUnit(tf, k), singleUnit(tt, Math.abs(tt.pow)));
  if (r.n === 1n && r.d === 1n && r.p === 0) return null;
  const fu = unitLabel(singleUnit(tf, k), true);
  const tu = unitLabel(singleUnit(tt, Math.abs(tt.pow)), true);
  const fromBig = approx(r) >= 1;
  const inv = { n: r.d, d: r.n, p: -r.p };
  const html = fromBig
    ? { big: `1 ${fu}`, small: `${factorText(r.n, r.d, r.p)} ${tu}`, F: approx(r) }
    : { big: `1 ${tu}`, small: `${factorText(inv.n, inv.d, inv.p)} ${fu}`, F: approx(inv) };
  return { ...html, fromBig, same, den: tf.pow < 0 };
}

function balanceVisual(problem, loc) {
  if (problem.kind === "notation") {
    if (problem.variant === "format") return "";
    const plan = commaPlan(problem);
    if (!plan || plan.xStart === plan.xEnd) return "";
    const row = (i, x) => `${mantString(plan.digits, i, loc)} ${t("balBlocks", pow10(x))}`;
    const a = { i: plan.iStart, x: plan.xStart };
    const b = { i: plan.iEnd, x: plan.xEnd };
    const [big, small] = a.x > b.x ? [a, b] : [b, a];
    return `<div class="vis bal2">${tilesPair(row(big.i, big.x), row(small.i, small.x), 10 ** Math.abs(a.x - b.x), t("balNotation"))}</div>`;
  }
  if (problem.kind !== "convert") return "";
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const pairs = matchTerms(from, to);
  const blocks = [];
  if (pairs) {
    for (const [tf, tt] of pairs) {
      const b = pairBalance(tf, tt, loc);
      if (!b) continue;
      const grows = b.fromBig !== b.den; // denominator: the effect on the number is inverted
      let cap = t(grows ? "balGrow" : "balShrink");
      if (b.den) cap = t("balDenFlip") + " " + cap;
      blocks.push(tilesPair(b.big, b.small, b.F, cap));
    }
  } else {
    const r = ratio(from, to);
    const fromBig = approx(r) >= 1;
    const inv = { n: r.d, d: r.n, p: -r.p };
    blocks.push(tilesPair(fromBig ? `1 ${unitLabel(from, true)}` : `1 ${unitLabel(to, true)}`, fromBig ? `${factorText(r.n, r.d, r.p)} ${unitLabel(to, true)}` : `${factorText(inv.n, inv.d, inv.p)} ${unitLabel(from, true)}`, fromBig ? approx(r) : approx(inv), t(fromBig ? "balGrow" : "balShrink")));
  }
  if (!blocks.length) return "";
  return `<div class="vis bal2">${blocks.join('<div class="sep"></div>')}</div>`;
}

// ---------- composite units: substitution ----------

function substitutionVisual(problem, loc, opts = {}) {
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const pairs = matchTerms(from, to);
  if (!pairs) return factorsVisual(problem, loc, opts);
  const eqs = [];
  const num = [];
  const den = [];
  const fNum = [];
  const fDen = [];
  for (const [tf, tt] of pairs) {
    const k = Math.abs(tf.pow);
    const kt = Math.abs(tt.pow);
    const perOne = k === kt && tf.unit.dim.join() === tt.unit.dim.join() && k >= 1;
    const r = perOne ? ratio(singleUnit(tf, 1), singleUnit(tt, 1)) : ratio(singleUnit(tf, k), singleUnit(tt, kt));
    const fu = unitLabel(singleUnit(tf, perOne ? 1 : k), true);
    const tu = unitLabel(singleUnit(tt, perOne ? 1 : kt), true);
    const same = r.n === 1n && r.d === 1n && r.p === 0;
    const powSup = perOne && k > 1 ? `<sup>${k}</sup>` : "";
    let piece;
    let fac;
    if (same) {
      piece = unitLabel(singleUnit(tf, k), true);
      fac = null;
    } else {
      const F = factorText(r.n, r.d, r.p);
      eqs.push(`1 ${fu} = ${F} ${tu}`);
      piece = `(${F} ${tu})${powSup}`;
      fac = perOne && k > 1 ? `(${F})${powSup}` : F;
    }
    (tf.pow > 0 ? num : den).push(piece);
    if (fac) (tf.pow > 0 ? fNum : fDen).push(fac);
  }
  const frac = (a, b) => `<span class="fr"><span>${a}</span>${b ? `<span class="bar"></span><span>${b}</span>` : ""}</span>`;
  const subst = frac(num.join("·") || "1", den.join("·"));
  const tl = unitLabel(to, true);
  const fl = unitLabel(from, true);
  const facFrac = frac(fNum.join("·") || "1", fDen.join("·"));
  const number = fmt(problem.data, loc, problem.dataForm, { html: true, i: problem.dataI ?? 1 });
  const res = opts.hide ? "?" : fmt(problem.expected, loc, problem.ask.form, { html: true });
  return `<div class="vis subst">
    ${eqs.length ? `<div class="ln eqs"><span>${eqs.join(' <span class="dotsep">·</span> ')}</span></div>` : ""}
    <div class="ln"><span>${fl}</span> <span>=</span> ${subst}</div>
    <div class="ln"><span>=</span> ${facFrac} <span>${tl}</span></div>
    <div class="ln"><span>${number} ${fl}</span> <span>→</span> <span>${number}·</span>${facFrac}<span> = <b>${res}</b> ${tl}</span></div>
    <div class="cap">${t("solSubst")}</div>
    <details class="alt"><summary>${t("altFactors")}</summary>${factorsVisual(problem, loc, opts)}</details>
  </div>`;
}

// ---------- prefix ladder ----------

function ladderVisual(a, b, cap) {
  const unitW = 26;
  const x = (e) => 30 + (e + 12) * unitW;
  const W = 30 * 2 + 24 * unitW;
  const marks = [a, b].filter((v) => v !== null && v !== undefined);
  const ticks = PREFIXES.map((p) => {
    const on = marks.includes(p.exp);
    return `<line x1="${x(p.exp)}" x2="${x(p.exp)}" y1="46" y2="${on ? 62 : 56}" class="tk${on ? " on" : ""}"/><text x="${x(p.exp)}" y="80" class="pl${on ? " on" : ""}" text-anchor="middle">${p.sym || "·"}</text><text x="${x(p.exp)}" y="94" class="ex" text-anchor="middle">${expText(p.exp)}</text>`;
  }).join("");
  let arc = "";
  if (marks.length === 2 && a !== b) {
    const xa = x(a);
    const xb = x(b);
    const head = xb < xa ? 6 : -6;
    arc = `<path d="M${xa} 40 Q${(xa + xb) / 2} ${40 - Math.min(34, 8 + Math.abs(xa - xb) / 4)} ${xb} 40" class="arc"/><path d="M${xb + head} 31 L${xb} 40 L${xb + head * 0.2} 29" class="arc"/>`;
  }
  const dots = marks.map((m, i) => `<circle cx="${x(m)}" cy="46" r="7" class="${i ? "pb" : "pa"}"/>`).join("");
  const top = arc ? 0 : 38;
  const svg = `<svg viewBox="0 ${top} ${W} ${100 - top}" width="${W}" height="${100 - top}" role="img" aria-label="prefix scale"><line x1="20" x2="${W - 20}" y1="46" y2="46" class="axis"/>${ticks}${dots}${arc}</svg>`;
  return `<div class="vis line ladder"><div class="scrollx">${svg}</div><div class="cap">${cap}</div></div>`;
}

const pxName = (sym) => t(`px_${sym || "none"}`);
const pxLabel = (sym, base) => `${sym}${base}`;

function prefixVisuals(p, loc) {
  const sub = (h) => `<div class="vis power"><div class="sub">${h}</div></div>`;
  if (p.variant === "toPower") {
    return [ladderVisual(0, p.exp, t("ladCap")), sub(`1 ${pxLabel(p.px, p.base)} = 10${sup(p.exp)} ${p.base} <span class="mul">${pxName(p.px)} = 10${sup(p.exp)}</span>`)];
  }
  if (p.variant === "toPrefix") {
    const px = p.items[p.answer];
    return [ladderVisual(0, p.exp, t("ladCap")), sub(`10${sup(p.exp)} = <b>${px}</b> <span class="mul">${pxName(px)}</span>`)];
  }
  if (p.variant === "substitute") {
    const number = fmt(p.data, loc, "decimal");
    const mant = number;
    return [sub(`${number} ${pxLabel(p.px, p.base)} = ${mant} · (${pxName(p.px)}) ${p.base} = ${mant} · 10${sup(p.exp)} ${p.base}`), ladderVisual(0, p.exp, t("ladCap"))];
  }
  if (p.variant === "swapBack") {
    const px = p.items[p.answer];
    const m = fmt(p.mant, loc, "decimal");
    return [sub(`${m}·10${sup(p.exp)} ${p.base} = ${m} · (${pxName(px)}) ${p.base} = <b>${m} ${pxLabel(px, p.base)}</b>`), ladderVisual(0, p.exp, t("ladCap"))];
  }
  const ea = PREFIXES.find((x) => x.sym === p.a).exp;
  const eb = PREFIXES.find((x) => x.sym === p.b).exp;
  return [ladderVisual(ea, eb, t("solLine", `${p.a || "·"} (${expText(ea)})`, `${p.b || "·"} (${expText(eb)})`, `${expText(ea)} − (${expText(eb)}) = ${expText(p.exp)}`)), sub(`1 ${pxLabel(p.a, p.base)} = 10${sup(ea)} ${p.base} = 10${sup(ea)} · 10${sup(-eb)} ${pxLabel(p.b, p.base)} = <b>10${sup(p.exp)}</b> ${pxLabel(p.b, p.base)}`)];
}

// ---------- orders of magnitude ----------

function oomBar(o) {
  const th = ((5 - 1) / 9) * 100;
  const pos = ((Math.min(o.a, 9.999) - 1) / 9) * 100;
  return `<div class="oom"><div class="oombar"><div class="seg lo" style="width:${th}%"><span>${pow10(o.n)}</span></div><div class="seg hi" style="width:${100 - th}%"><span>${pow10(o.n + 1)}</span></div><i class="dot${o.up ? " up" : ""}" style="left:${pos}%"></i></div><div class="oomlbl"><span style="left:0">1</span><span style="left:${th}%">5</span><span style="left:100%">10</span></div></div>`;
}

function oomLine(label, dec, o, loc, unit, skipNorm = false) {
  const mant = fmt(fromSci(1, dec.d.toString(), 0), loc, "decimal");
  const norm = fmt(dec, loc, "times", { html: true });
  const rule = o.up ? t("oomMore", mant, o.order) : t("oomLess", mant, o.order);
  return `<div class="ln">${skipNorm ? "" : `<span>${label}${norm} ${unit ?? ""}</span>`} <span>${skipNorm ? "" : "→ "}${rule}</span></div>${oomBar(o)}`;
}

function oomVisual(p, loc) {
  const u = (id) => unitLabel(parseUnit(id), true);
  if (p.variant === "ratio") {
    return `<div class="vis oomv">${oomLine("A: ", p.data, p.oom, loc, u(p.unit))}${oomLine("B: ", p.dataB, p.oomB, loc, u(p.unit))}<div class="ln"><b>${p.oom.order >= 0 ? "" : ""}${expText(p.oom.order)} − (${expText(p.oomB.order)}) = ${expText(p.oom.order - p.oomB.order)}</b></div><div class="cap">${t("oomRatioCap")}</div></div>`;
  }
  let pre = "";
  let dec = p.data;
  let unit = p.unit ? u(p.unit) : "";
  if (p.variant === "inUnit") {
    dec = p.converted;
    unit = u(p.toUnit);
    pre = `<div class="ln"><span>${fmt(p.data, loc, p.dataForm, { html: true, i: 1 })} ${u(p.unit)}</span> <span>= ${fmt(p.converted, loc, "times", { html: true })} ${unit}</span></div>`;
  }
  return `<div class="vis oomv">${pre}${oomLine("", dec, p.oom, loc, unit, p.variant === "inUnit")}<div class="cap">${t("oomRule")}</div></div>`;
}

// ---------- which visual for which exercise ----------

/** All the visuals that help with this exercise, in order of usefulness. */
function visualsFor(problem, loc, opts = {}) {
  if (problem.kind === "order") return [orderVisual(problem, loc)];
  if (problem.kind === "intruder") return [intruderVisual(problem, loc)];
  if (problem.kind === "prefix") return prefixVisuals(problem, loc);
  if (problem.kind === "oom") return [oomVisual(problem, loc)];
  const out = [];
  if (problem.kind === "notation") {
    out.push(balanceVisual(problem, loc));
    if (problem.variant !== "format") out.push(commaVisual(problem, loc));
    return out.filter(Boolean);
  }
  const c = commaVisual(problem, loc);
  const bal = balanceVisual(problem, loc);
  if (problem.module === 3) out.push(bal, lineVisual(problem), c);
  else if (problem.module === 4) out.push(bal, powerVisual(problem) || lineVisual(problem), c);
  else out.push(substitutionVisual(problem, loc, { hide: opts.assist }), bal);
  return out.filter(Boolean);
}

export { balanceVisual, substitutionVisual, ladderVisual, prefixVisuals, oomVisual, oomBar, commaPlan, commaVisual, lineVisual, powerVisual, factorsVisual, figuresHtml, orderVisual, intruderVisual, visualsFor, matchTerms, factorText };
