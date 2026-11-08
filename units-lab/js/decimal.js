// Units Lab · decimal.js
// Exact decimal numbers that remember their significant figures. No floats anywhere.
//   Dec = { s: 1 | -1, d: BigInt, e: int, sf: int }      value = s · d · 10^e
// Invariant: d has exactly sf digits and does not start with 0 (zero is d = 0n, sf = 1).
// Convention (decided with the teacher): trailing zeros of an integer written without a
// decimal separator are NOT significant ("5200" has 2 significant figures, "5200," has 4).

const TEN = 10n;

const p10 = (n) => TEN ** BigInt(n);
const ndigits = (b) => (b === 0n ? 1 : b.toString().length);

function gcd(a, b) {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function mk(s, d, e, sf) {
  return Object.freeze({ s: d === 0n ? 1 : s, d, e, sf });
}

const ZERO = mk(1, 0n, 0, 1);

// ---------- construction ----------

/** Canonical Dec from a digit string (no sign, no separator) and the exponent of its LAST digit. */
function fromDigits(s, digits, e, hasPoint) {
  let t = digits.replace(/^0+/, "");
  if (t === "") return ZERO;
  if (!hasPoint) {
    const tz = t.length - t.replace(/0+$/, "").length;
    if (tz) {
      t = t.slice(0, t.length - tz);
      e += tz;
    }
  }
  return mk(s, BigInt(t), e, t.length);
}

/** Dec from its significant digits and the exponent X of scientific notation (d.ddd · 10^X). */
function fromSci(s, digits, X) {
  return mk(s, BigInt(digits), X - (digits.length - 1), digits.length);
}

// ---------- queries ----------

const sciExp = (a) => a.e + a.sf - 1;
const sgn = (a) => (a.d === 0n ? 0 : a.s);

function cmp(a, b) {
  const sa = sgn(a);
  const sb = sgn(b);
  if (sa !== sb) return sa < sb ? -1 : 1;
  if (sa === 0) return 0;
  const m = Math.min(a.e, b.e);
  const x = a.d * p10(a.e - m);
  const y = b.d * p10(b.e - m);
  const c = x === y ? 0 : x < y ? -1 : 1;
  return sa * c;
}

const eq = (a, b) => cmp(a, b) === 0;

/** True when the plain decimal writing cannot show all significant figures (integer ending in 0). */
function decimalAmbiguous(a) {
  return a.d !== 0n && a.e >= 0 && a.d % TEN === 0n;
}

// ---------- arithmetic ----------

const shift10 = (a, k) => mk(a.s, a.d, a.e + k, a.sf);
const neg = (a) => mk(-a.s, a.d, a.e, a.sf);

function cmpScaled(N, D, k) {
  // compare N with D·10^k
  const l = k >= 0 ? N : N * p10(-k);
  const r = k >= 0 ? D * p10(k) : D;
  return l === r ? 0 : l < r ? -1 : 1;
}

/**
 * Multiply by the exact ratio (n/dn)·10^p and keep `sf` significant figures.
 * mode "round" is half-up on the magnitude, "trunc" cuts.
 * Returns { dec, exact } where exact is false when digits were discarded.
 */
function mulRatio(a, n, dn, p = 0, { sf = a.sf, mode = "round" } = {}) {
  if (a.d === 0n) return { dec: a, exact: true };
  const g = gcd(n, dn);
  n /= g;
  dn /= g;
  while (n % TEN === 0n) {
    n /= TEN;
    p++;
  }
  while (dn % TEN === 0n) {
    dn /= TEN;
    p--;
  }
  if (n === 1n && dn === 1n) return { dec: mk(a.s, a.d, a.e + p, a.sf), exact: true };
  const N = a.d * n;
  const D = dn;
  let k = ndigits(N) - ndigits(D);
  if (cmpScaled(N, D, k) < 0) k--;
  let t = sf - 1 - k;
  const num = t >= 0 ? N * p10(t) : N;
  const den = t >= 0 ? D : D * p10(-t);
  let R = num / den;
  const rem = num % den;
  if (mode === "round" && 2n * rem >= den) R += 1n;
  if (R === p10(sf)) {
    R /= TEN;
    t -= 1;
  }
  return { dec: mk(a.s, R, a.e + p - t, sf), exact: rem === 0n };
}

/** Round (or pad with zeros) to a number of significant figures. */
function roundTo(a, sf, mode = "round") {
  if (a.d === 0n || sf === a.sf) return a;
  if (sf > a.sf) {
    const k = sf - a.sf;
    return mk(a.s, a.d * p10(k), a.e - k, sf);
  }
  const drop = a.sf - sf;
  const base = p10(drop);
  let q = a.d / base;
  const r = a.d % base;
  if (mode === "round" && 2n * r >= base) q += 1n;
  let e = a.e + drop;
  if (q === p10(sf)) {
    q /= TEN;
    e += 1;
  }
  return mk(a.s, q, e, sf);
}

/** The neighbour k units of the last significant digit away (same number of figures). */
function step(a, k) {
  let d = a.d + BigInt(k) * BigInt(a.s);
  let e = a.e;
  if (d <= 0n) return a;
  if (d < p10(a.sf - 1)) {
    // below the decade: the next number down has a finer last digit
    d = p10(a.sf) - 1n;
    e -= 1;
  } else if (d >= p10(a.sf)) {
    d /= TEN;
    e += 1;
  }
  return mk(a.s, d, e, a.sf);
}

// ---------- parsing ----------

const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };

/**
 * Parse what a student may type: 5,2e3  5.2E-3  5,2·10^3  5,2*10^-3  5,2x10^3  5,2×10³  0,042  5200,
 * Returns { ok, dec, form: "decimal"|"e"|"times", normalized, ip, fp, hasPoint, exp } or { ok:false, error }.
 * A lone "1.000" is refused as ambiguous (thousands separator).
 */
function parseNumber(raw, { locale = "it" } = {}) {
  let s = String(raw ?? "").replace(/\s+/g, "");
  if (!s) return { ok: false, error: "empty" };
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""))
    .replace(/[×·⋅*xX]/g, "*");
  const head = s.split(/[eE*]/)[0].replace(/^[+-]/, "");
  if (locale === "en" ? /^\d{1,3}(,\d{3})+$/.test(head) : /^\d{1,3}(\.\d{3})+$/.test(head)) {
    return { ok: false, error: "thousands" };
  }
  const m = /^([+-])?(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d{1,4})|\*10\^?([+-]?\d{1,4})|\*10)?$/.exec(s);
  if (!m) return { ok: false, error: "syntax" };
  const hasPoint = /[.,]/.test(s.split(/[eE*]/)[0]);
  const ip = m[2] ?? "";
  const fp = m[3] ?? "";
  if (ip === "" && fp === "") return { ok: false, error: "syntax" };
  if (ip === "" && !hasPoint) return { ok: false, error: "syntax" };
  const sign = m[1] === "-" ? -1 : 1;
  const hasE = m[4] !== undefined;
  const hasT = m[5] !== undefined || /\*10$/.test(s);
  const exp = hasE ? parseInt(m[4], 10) : m[5] !== undefined ? parseInt(m[5], 10) : hasT ? 1 : 0;
  const form = hasE ? "e" : hasT ? "times" : "decimal";
  const dec = fromDigits(sign, ip + fp, exp - fp.length, hasPoint);
  const normalized = form !== "decimal" && /^[1-9]$/.test(ip);
  return { ok: true, dec, form, normalized, ip, fp, hasPoint, exp };
}

export { ZERO, mk, fromDigits, fromSci, p10, sciExp, cmp, eq, decimalAmbiguous, shift10, neg, mulRatio, roundTo, step, parseNumber };
