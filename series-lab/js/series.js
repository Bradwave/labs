// Series Lab · series.js
// Partial sums, Aitken extrapolation, presets, URL-hash state and CSV export (pure module, no DOM).
import { compile } from "./expr.js";

export const LIMITS = { nMax: 20000, nMaxDefault: 300 };

// Computes a_n and S_n for n = n0 … nMax. Stops at the first non-finite term (stoppedAt = that n).
export function computeSeries(fn, n0, nMax, z) {
  const len = Math.max(1, nMax - n0 + 1);
  const aRe = new Float64Array(len),
    aIm = new Float64Array(len),
    sRe = new Float64Array(len),
    sIm = new Float64Array(len);
  let count = 0,
    stoppedAt = null,
    re = 0,
    im = 0;
  for (let k = 0; k < len; k++) {
    const a = fn(n0 + k, z);
    if (!Number.isFinite(a[0]) || !Number.isFinite(a[1])) {
      stoppedAt = n0 + k;
      break;
    }
    re += a[0];
    im += a[1];
    if (!Number.isFinite(re) || !Number.isFinite(im)) {
      stoppedAt = n0 + k;
      break;
    }
    aRe[k] = a[0];
    aIm[k] = a[1];
    sRe[k] = re;
    sIm[k] = im;
    count++;
  }
  return { n0, count, aRe, aIm, sRe, sIm, stoppedAt };
}

// Aitken Δ² estimate of the limit from S_{k-2}, S_{k-1}, S_k (k = index in the arrays). null when not available.
export function aitken(s, k) {
  if (k < 2 || k >= s.count) return null;
  const d1 = [s.sRe[k] - s.sRe[k - 1], s.sIm[k] - s.sIm[k - 1]],
    d0 = [s.sRe[k - 1] - s.sRe[k - 2], s.sIm[k - 1] - s.sIm[k - 2]];
  const den = [d1[0] - d0[0], d1[1] - d0[1]];
  const dd = den[0] * den[0] + den[1] * den[1];
  if (dd < 1e-300) return [s.sRe[k], s.sIm[k]];
  // d1² / den
  const sq = [d1[0] * d1[0] - d1[1] * d1[1], 2 * d1[0] * d1[1]];
  const q = [(sq[0] * den[0] + sq[1] * den[1]) / dd, (sq[1] * den[0] - sq[0] * den[1]) / dd];
  const r = [s.sRe[k] - q[0], s.sIm[k] - q[1]];
  return Number.isFinite(r[0]) && Number.isFinite(r[1]) ? r : null;
}

// Aitken estimate shown to the user only when it looks trustworthy: the estimate is stable from one step to the
// next compared with the term size, and the terms are shrinking (otherwise Aitken would "sum" a divergent
// geometric series to its analytic continuation). Still just a hint, never a proof.
export function limitEstimate(s, k) {
  if (k < 4) return null;
  const A = aitken(s, k),
    B = aitken(s, k - 1);
  if (!A || !B) return null;
  const a = Math.hypot(s.aRe[k], s.aIm[k]),
    k0 = k >> 1,
    a0 = Math.hypot(s.aRe[k0], s.aIm[k0]);
  const d = Math.hypot(A[0] - B[0], A[1] - B[1]);
  const scale = Math.hypot(A[0], A[1]) * 1e-12;
  return d <= 0.5 * a + scale && a <= a0 ? A : null;
}

export const PRESETS = [
  { id: "geo", expr: "z^n", n0: 0, z: [0.8, 0.5], nMax: 120 },
  { id: "harm", expr: "1/n", n0: 1, z: [1, 0], nMax: 300 },
  { id: "alt", expr: "(-1)^n/n", n0: 1, z: [1, 0], nMax: 300 },
  { id: "ipow", expr: "i^n/n", n0: 1, z: [1, 0], nMax: 300 },
  { id: "phase", expr: "exp(i*n)/n", n0: 1, z: [1, 0], nMax: 400 },
  { id: "exp", expr: "z^n/n!", n0: 0, z: [2, 2], nMax: 40 },
  { id: "dir", expr: "1/n^z", n0: 1, z: [1.5, 3], nMax: 400 },
  { id: "chirp", expr: "exp(i*n^2/12)/n", n0: 1, z: [1, 0], nMax: 800 },
];

// ---------- URL hash ----------
export function encodeState(s) {
  const q = new URLSearchParams();
  q.set("e", s.expr);
  q.set("n0", String(s.n0));
  q.set("z", `${s.z[0]},${s.z[1]}`);
  q.set("M", String(s.nMax));
  q.set("N", String(s.N));
  return q.toString();
}
// Defensive: returns only the valid fields.
export function decodeState(hash) {
  const q = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const out = {};
  const e = q.get("e");
  if (e && e.length <= 200) {
    try {
      compile(e);
      out.expr = e;
    } catch (_) {
      /* ignore */
    }
  }
  const int = (k, lo, hi) => {
    const v = q.get(k);
    if (v == null || !/^-?\d+$/.test(v)) return undefined;
    const x = Number(v);
    return x >= lo && x <= hi ? x : undefined;
  };
  const n0 = int("n0", -1000, 1000),
    nMax = int("M", 1, LIMITS.nMax),
    N = int("N", -1000, 1e6);
  if (n0 !== undefined) out.n0 = n0;
  if (nMax !== undefined) out.nMax = nMax;
  if (N !== undefined) out.N = N;
  const z = (q.get("z") || "").split(",").map(Number);
  if (z.length === 2 && z.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e6)) out.z = z;
  return out;
}

// ---------- CSV (DESIGN.md §10: Italian uses ";" and a decimal comma) ----------
export function toCSV(s, lang, upTo) {
  const it = lang === "it",
    sep = it ? ";" : ",";
  const f = (x) => (it ? String(x).replace(".", ",") : String(x));
  const rows = [["n", "Re(a_n)", "Im(a_n)", "Re(S_n)", "Im(S_n)"].join(sep)];
  const last = Math.min(s.count - 1, upTo - s.n0);
  for (let k = 0; k <= last; k++) rows.push([s.n0 + k, f(s.aRe[k]), f(s.aIm[k]), f(s.sRe[k]), f(s.sIm[k])].join(sep));
  return rows.join("\n") + "\n";
}
