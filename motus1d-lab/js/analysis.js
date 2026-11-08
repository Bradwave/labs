/* Areas, averages and slopes over an interval [t1, t2] */
import { integrate } from './model.js';

/* Riemann sums: rule is 'left' | 'mid' | 'right' | 'trap'. Values at a joint come from the side inside the strip. */
export function riemann(fn, t1, t2, n, rule) {
  const d = (t2 - t1) / n, e = Math.max(1e-9, d * 1e-7), items = [];
  let sum = 0;
  for (let k = 0; k < n; k++) {
    const a = t1 + k * d, b = a + d;
    if (rule === 'trap') {
      const ha = fn(a + e), hb = fn(b - e);
      items.push({ a, b, ha, hb }); sum += (ha + hb) / 2 * d;
    } else {
      const h = fn(rule === 'left' ? a + e : rule === 'right' ? b - e : (a + b) / 2);
      items.push({ a, b, h }); sum += h * d;
    }
  }
  return { items, sum };
}

/* times in (t1, t2) where fn crosses `level`; 'all' when fn stays on it */
export function crossings(fn, t1, t2, level, splits) {
  const N = 600, out = [];
  let allFlat = true, prevT = t1, prev = fn(t1 + 1e-9) - level;
  const tol = 1e-6 * (1 + Math.abs(level));
  if (Math.abs(prev) > tol) allFlat = false;
  for (let k = 1; k <= N; k++) {
    const t = t1 + (t2 - t1) * k / N, y = fn(k === N ? t - 1e-9 : t) - level;
    if (Math.abs(y) > tol) allFlat = false;
    if (prev === 0 && k > 1) out.push(prevT);
    else if (prev * y < 0) {
      // skip sign changes that are only a jump at a joint
      const jump = splits.some(x => x > prevT && x <= t);
      let a = prevT, b = t, fa = prev;
      for (let i = 0; i < 50; i++) { const m = (a + b) / 2, fm = fn(m) - level; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
      const r = (a + b) / 2;
      if (!jump || Math.abs(fn(r) - level) < 1e-3 * (1 + Math.abs(level))) out.push(r);
    }
    prev = y; prevT = t;
  }
  if (allFlat) return 'all';
  const res = out.filter((x, i) => i === 0 || x - out[i - 1] > (t2 - t1) * 1e-3);
  return res.length > 6 ? [] : res; // noisy data: too many to be meaningful
}

/* everything the panel and the graphs need for one interval */
export function intervalStats(M, t1, t2) {
  const dt = t2 - t1;
  const s1 = M.S(t1), s2 = M.S(t2), v1 = M.V(t1), v2 = M.V(t2);
  const intV = integrate(M.V, t1, t2, M.splits);
  const intA = integrate(M.A, t1, t2, M.splits);
  const dist = integrate(M.V, t1, t2, M.splits, true);
  // jumps that the areas cannot see (only joints that are not blended)
  let jS = 0, jV = 0;
  for (const J of M.joints) if (!J.blend && J.t > t1 && J.t <= t2) {
    if (J.status === 'jump') jS += J.dS;
    if (J.status === 'jump' || J.status === 'kink') jV += J.dV;
  }
  return { dt, s1, s2, v1, v2, ds: s2 - s1, dv: v2 - v1, intV, intA, dist, jS, jV,
    vbar: dt > 0 ? (s2 - s1) / dt : NaN, abar: dt > 0 ? (v2 - v1) / dt : NaN,
    spd: dt > 0 ? dist / dt : NaN, vmean: dt > 0 ? intV / dt : NaN, amean: dt > 0 ? intA / dt : NaN };
}
