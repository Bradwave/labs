// Units Lab · units.js
// Unit catalogue with EXACT conversion factors (BigInt ratios times a power of ten).
// Irrational or measured factors (parsec, degrees, atomic mass unit) and non-multiplicative
// scales (°C, °F, dB) are deliberately not here.

const F = (n, d, p) => ({ n: BigInt(n), d: BigInt(d), p });

// dimension vector order: [length, mass, time, current, data]
const U = (sym, dim, f, o = {}) => ({ sym, dim, f, prefixable: false, tier: 1, ...o });

const UNITS = [
  U("m", [1, 0, 0, 0, 0], F(1, 1, 0), { prefixable: true }),
  U("g", [0, 1, 0, 0, 0], F(1, 1, -3), { prefixable: true }), // the SI unit is the kilogram
  U("s", [0, 0, 1, 0, 0], F(1, 1, 0), { prefixable: true }),
  U("Hz", [0, 0, -1, 0, 0], F(1, 1, 0), { prefixable: true }),
  U("N", [1, 1, -2, 0, 0], F(1, 1, 0), { prefixable: true }),
  U("L", [3, 0, 0, 0, 0], F(1, 1, -3), { prefixable: true }),
  U("min", [0, 0, 1, 0, 0], F(60, 1, 0)),
  U("h", [0, 0, 1, 0, 0], F(3600, 1, 0)),
  U("d", [0, 0, 1, 0, 0], F(86400, 1, 0)),
  U("t", [0, 1, 0, 0, 0], F(1, 1, 3), { tier: 2 }),
  U("ha", [2, 0, 0, 0, 0], F(1, 1, 4), { tier: 2 }),
  U("Pa", [-1, 1, -2, 0, 0], F(1, 1, 0), { prefixable: true, tier: 2 }),
  U("J", [2, 1, -2, 0, 0], F(1, 1, 0), { prefixable: true, tier: 2 }),
  U("W", [2, 1, -3, 0, 0], F(1, 1, 0), { prefixable: true, tier: 2 }),
  U("A", [0, 0, 0, 1, 0], F(1, 1, 0), { prefixable: true, tier: 2 }),
  U("V", [2, 1, -3, -1, 0], F(1, 1, 0), { prefixable: true, tier: 2 }),
  U("C", [0, 0, 1, 1, 0], F(1, 1, 0), { prefixable: true, tier: 3 }),
  U("Ω", [2, 1, -3, -2, 0], F(1, 1, 0), { prefixable: true, tier: 3 }),
  U("F", [-2, -1, 4, 2, 0], F(1, 1, 0), { prefixable: true, tier: 3 }),
  U("B", [0, 0, 0, 0, 1], F(1, 1, 0), { prefixable: true, tier: 3 }), // decimal prefixes only: 1 kB = 1000 B
  U("Wh", [2, 1, -2, 0, 0], F(3600, 1, 0), { prefixable: true, tier: 3 }),
  U("eV", [2, 1, -2, 0, 0], F(1602176634, 1, -28), { prefixable: true, tier: 3 }),
  U("cal", [2, 1, -2, 0, 0], F(4184, 1, -3), { prefixable: true, tier: 3 }),
  U("bar", [-1, 1, -2, 0, 0], F(1, 1, 5), { prefixable: true, tier: 3 }),
  U("atm", [-1, 1, -2, 0, 0], F(101325, 1, 0), { tier: 3 }),
  U("mmHg", [-1, 1, -2, 0, 0], F(133322387415, 1, -9), { tier: 3 }),
  U("CV", [2, 1, -3, 0, 0], F(73549875, 1, -5), { tier: 3 }),
  U("au", [1, 0, 0, 0, 0], F(149597870700, 1, 0), { tier: 3 }),
  U("al", [1, 0, 0, 0, 0], F(9460730472580800, 1, 0), { tier: 3 }),
];

const BY_SYM = Object.fromEntries(UNITS.map((u) => [u.sym, u]));

const PREFIXES = [
  { sym: "p", exp: -12 },
  { sym: "n", exp: -9 },
  { sym: "µ", exp: -6 },
  { sym: "m", exp: -3 },
  { sym: "c", exp: -2 },
  { sym: "d", exp: -1 },
  { sym: "", exp: 0 },
  { sym: "da", exp: 1 },
  { sym: "h", exp: 2 },
  { sym: "k", exp: 3 },
  { sym: "M", exp: 6 },
  { sym: "G", exp: 9 },
  { sym: "T", exp: 12 },
];
const PX = Object.fromEntries(PREFIXES.map((p) => [p.sym, p]));
const PX_BY_LEN = PREFIXES.filter((p) => p.sym).sort((a, b) => b.sym.length - a.sym.length);

/** "mm" → { px: {sym:"m",exp:-3}, unit: m }.  Exact unit symbols win over prefix+unit ("min", "ha", "cal"). */
function resolveSymbol(tok) {
  const t = tok.replace(/^μ/, "µ");
  if (BY_SYM[t]) return { px: PX[""], unit: BY_SYM[t] };
  for (const p of PX_BY_LEN) {
    if (!t.startsWith(p.sym)) continue;
    const rest = BY_SYM[t.slice(p.sym.length)];
    if (rest && rest.prefixable) return { px: p, unit: rest };
  }
  return null;
}

const cache = new Map();

/** "km/h", "g/cm3", "N/cm2", "m^3", "L/min", "kWh" → { terms:[{px,unit,pow}], spec } */
function parseUnit(spec) {
  if (cache.has(spec)) return cache.get(spec);
  const clean = spec.replace(/[()\s]/g, "").replace(/·/g, "*");
  const [num, den, extra] = clean.split("/");
  if (extra !== undefined) throw new Error(`unit "${spec}": more than one "/"`);
  const terms = [];
  const add = (part, sign) => {
    if (!part) return;
    for (const tok of part.split("*")) {
      const m = /^([^\d^-]+)\^?(-?\d+)?$/.exec(tok);
      if (!m) throw new Error(`unit "${spec}": bad term "${tok}"`);
      const r = resolveSymbol(m[1]);
      if (!r) throw new Error(`unit "${spec}": unknown symbol "${m[1]}"`);
      terms.push({ px: r.px, unit: r.unit, pow: sign * (m[2] ? parseInt(m[2], 10) : 1) });
    }
  };
  add(num, 1);
  add(den, -1);
  const u = { terms, spec };
  cache.set(spec, u);
  return u;
}

function dimOf(u) {
  const out = [0, 0, 0, 0, 0];
  for (const t of u.terms) t.unit.dim.forEach((v, i) => (out[i] += v * t.pow));
  return out;
}
const sameDim = (a, b) => dimOf(a).every((v, i) => v === dimOf(b)[i]);

/**
 * Factor to coherent SI units as an exact ratio n/d·10^p.
 * mods (used by the error models): linear (prefix exponent NOT multiplied by the power),
 * unitF (replace the factor of a unit symbol), prefixMap (swap prefix symbols).
 */
function unitFactor(u, mods = {}) {
  let n = 1n;
  let d = 1n;
  let p = 0;
  for (const t of u.terms) {
    const f = mods.unitF?.[t.unit.sym] ?? t.unit.f;
    const k = BigInt(Math.abs(t.pow));
    const pxSym = mods.prefixMap?.[t.px.sym] ?? t.px.sym;
    const pxExp = PX[pxSym].exp;
    const pxPart = mods.linear ? pxExp * Math.sign(t.pow) : pxExp * t.pow;
    const fn = f.n ** k;
    const fd = f.d ** k;
    if (t.pow > 0) {
      n *= fn;
      d *= fd;
      p += f.p * t.pow;
    } else {
      n *= fd;
      d *= fn;
      p += f.p * t.pow;
    }
    p += pxPart;
  }
  return { n, d, p };
}

/** Ratio value_to = value_from · ratio. */
function ratio(from, to, mods = {}) {
  const a = unitFactor(from, mods);
  const b = unitFactor(to, mods);
  return { n: a.n * b.d, d: a.d * b.n, p: a.p - b.p };
}

// ---------- display ----------

const SUPCH = { 2: "²", 3: "³" };
const supText = (k) => SUPCH[k] ?? "^" + k;
const supHtml = (k) => `<sup>${k}</sup>`;

function termStr(t, html) {
  const k = Math.abs(t.pow);
  const s = t.px.sym + t.unit.sym;
  if (k === 1) return s;
  return s + (html ? supHtml(k) : supText(k));
}

/** "km/h", "m/s²", "g/cm³", "kg·m/s²" (text or HTML). */
function unitLabel(u, html = false) {
  const top = u.terms.filter((t) => t.pow > 0).map((t) => termStr(t, html));
  const bot = u.terms.filter((t) => t.pow < 0).map((t) => termStr(t, html));
  let s = top.length ? top.join("·") : "1";
  if (bot.length === 1) s += "/" + bot[0];
  else if (bot.length > 1) s += "/(" + bot.join("·") + ")";
  return s;
}

const SYMBOL_TIER = (u) => Math.max(...u.terms.map((t) => t.unit.tier));

export { UNITS, BY_SYM, PREFIXES, PX, parseUnit, dimOf, sameDim, unitFactor, ratio, unitLabel, SYMBOL_TIER };
