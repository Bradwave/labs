/* Drawn graphs. A drawing is a list of segments, back to back in time, on one graph (s, v or a),
   in world coordinates. It becomes sections of the same model as the equations, so joints,
   blending and every analysis tool work the same way.
   seg: { type: 'line'|'para'|'free', ta, tb, ya, yb, m0 (para), ys (free, uniform), blend } */
import { buildEqModel } from './model.js';

export const FREE_DT = 1 / 50;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function segValue(g, t) {
  const u = t - g.ta, L = g.tb - g.ta;
  if (g.type === 'line') return g.ya + (g.yb - g.ya) * (L > 0 ? u / L : 0);
  if (g.type === 'para') { const c = (g.yb - g.ya - g.m0 * L) / (L * L); return g.ya + g.m0 * u + c * u * u; }
  // free: Catmull–Rom through uniform samples
  const n = g.ys.length, f = clamp(u / FREE_DT, 0, n - 1), k = Math.min(Math.floor(f), n - 2), r = f - k;
  if (n < 2) return g.ys[0] ?? 0;
  const p0 = g.ys[Math.max(0, k - 1)], p1 = g.ys[k], p2 = g.ys[k + 1], p3 = g.ys[Math.min(n - 1, k + 2)];
  return 0.5 * ((2 * p1) + (-p0 + p2) * r + (2 * p0 - 5 * p1 + 4 * p2 - p3) * r * r + (-p0 + 3 * p1 - 3 * p2 + p3) * r * r * r);
}
export function segSlope(g, t) {
  const h = 1e-4; return (segValue(g, t + h) - segValue(g, t - h)) / (2 * h);
}
export const endT = segs => (segs.length ? segs[segs.length - 1].tb : 0);
export function valueAt(segs, t, side = 'left') {
  for (const g of segs) if (side === 'left' ? t > g.ta && t <= g.tb + 1e-9 : t >= g.ta - 1e-9 && t < g.tb) return segValue(g, t);
  return null;
}
export function slopeLeft(segs, t) {
  for (const g of segs) if (t > g.ta && t <= g.tb + 1e-9) return segSlope(g, Math.min(t, g.tb) - 1e-4);
  return 0;
}

/* cut everything after time t (a segment that straddles t is shortened) */
export function cutAt(segs, t) {
  const out = [];
  for (const g of segs) {
    if (g.ta >= t - 1e-9) break;
    if (g.tb <= t + 1e-9) { out.push(g); continue; }
    const yb = segValue(g, t);
    if (g.type === 'free') out.push({ ...g, tb: t, yb, ys: g.ys.slice(0, Math.max(2, Math.round((t - g.ta) / FREE_DT) + 1)) });
    else if (g.type === 'line') out.push({ ...g, tb: t, yb });
    else out.push({ ...g, tb: t, yb });
  }
  return out;
}

/* drop everything before time t (a segment that straddles t starts there instead) */
export function cutFrom(segs, t) {
  const out = [];
  for (const g of segs) {
    if (g.tb <= t + 1e-9) continue;
    if (g.ta >= t - 1e-9) { out.push(g); continue; }
    const ya = segValue(g, t);
    if (g.type === 'free') { const k = Math.min(g.ys.length - 2, Math.round((t - g.ta) / FREE_DT)); out.push({ ...g, ta: g.ta + k * FREE_DT, ya: g.ys[k], ys: g.ys.slice(k) }); }
    else if (g.type === 'line') out.push({ ...g, ta: t, ya });
    else out.push({ ...g, ta: t, ya, m0: segSlope(g, t + 1e-4) });
  }
  return out;
}
/* put a new piece over [g.ta, g.tb], keeping what comes before and after it.
   With snap, the end of a freehand piece bends gently onto what follows; lines and parabolas end on it. */
export function splice(segs, g, snap) {
  const before = cutAt(segs, g.ta), after = cutFrom(segs, g.tb);
  if (snap && after.length) {
    const target = after[0].ya;
    if (g.type === 'free') {
      const n = g.ys.length, d = target - g.ys[n - 1], m = Math.max(1, Math.round(n * 0.25));
      g = { ...g, ys: g.ys.map((y, i) => (i < n - m ? y : y + d * ((i - (n - m)) / (m - 1 || 1)))) };
      g.yb = g.ys[n - 1];
    } else g = { ...g, yb: target };
    if (Math.abs(after[0].ta - g.tb) > 1e-9) after[0] = { ...after[0], ta: g.tb };
  }
  return [...before, g, ...after];
}

/* a freehand stroke: points with increasing t, resampled and lightly smoothed */
export function freeSeg(pts) {
  const ta = pts[0][0], tb = pts[pts.length - 1][0], n = Math.max(2, Math.round((tb - ta) / FREE_DT) + 1), ys = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = ta + k * FREE_DT;
    while (j < pts.length - 2 && pts[j + 1][0] < t) j++;
    const [t0, y0] = pts[j], [t1, y1] = pts[Math.min(j + 1, pts.length - 1)];
    ys.push(t1 > t0 ? y0 + (y1 - y0) * clamp((t - t0) / (t1 - t0), 0, 1) : y1);
  }
  // three passes of a 5-point moving average keep the shape and remove the jitter of the hand
  let a = ys;
  for (let p = 0; p < 3; p++) {
    const b = a.slice();
    for (let k = 2; k < a.length - 2; k++) b[k] = (a[k - 2] + a[k - 1] + a[k] + a[k + 1] + a[k + 2]) / 5;
    a = b;
  }
  const tEnd = ta + (n - 1) * FREE_DT;
  return { type: 'free', ta, tb: tEnd, ya: a[0], yb: a[n - 1], ys: a, blend: false };
}

/* handles: one per segment end, for lines and parabolas */
export function handles(segs) {
  const H = [];
  segs.forEach((g, i) => {
    if (g.type === 'free') return;
    H.push({ i, end: 'a', t: g.ta, y: g.ya });
    H.push({ i, end: 'b', t: g.tb, y: g.yb });
    if (g.type === 'para') { const tm = (g.ta + g.tb) / 2; H.push({ i, end: 'm', t: tm, y: segValue(g, tm) }); }
  });
  return H;
}
/* move a handle; neighbours that touch it move along, so a continuous joint stays continuous */
export function moveHandle(segs, h, t, y, Tmax) {
  const S = segs.map(g => ({ ...g }));
  const g = S[h.i], prev = S[h.i - 1], next = S[h.i + 1];
  if (h.end === 'm') { // the middle of a parabola: its curvature
    const L = g.tb - g.ta; g.m0 = (4 * y - 3 * g.ya - g.yb) / L; return S;
  }
  if (h.end === 'a') {
    const touching = prev && Math.abs(prev.yb - g.ya) < 1e-6 && prev.type !== 'free';
    if (h.i > 0) { // a joint: time moves for both sides
      const lo = (prev.ta) + 0.05, hi = g.tb - 0.05;
      const tt = clamp(t, lo, hi);
      if (prev.type !== 'free') { prev.tb = tt; g.ta = tt; }
    }
    g.ya = y; if (touching) prev.yb = y;
  } else {
    const touching = next && Math.abs(next.ya - g.yb) < 1e-6 && next.type !== 'free';
    const lo = g.ta + 0.05, hi = next ? next.tb - 0.05 : Tmax;
    const tt = clamp(t, lo, hi);
    if (!next || next.type !== 'free') { g.tb = tt; if (next) next.ta = tt; }
    g.yb = y; if (touching) next.ya = y;
  }
  return S;
}

/* delete a node: the middle of a parabola makes it a line; a corner between two pieces joins them into one;
   the last corner removes the last piece. Returns null when it cannot be done (freehand neighbours, the start). */
export function deleteNode(segs, h) {
  const S = segs.map(g => ({ ...g }));
  if (h.end === 'm') { const g = S[h.i]; S[h.i] = { type: 'line', ta: g.ta, tb: g.tb, ya: g.ya, yb: g.yb, blend: g.blend }; return S; }
  const j = h.end === 'b' ? h.i : h.i - 1; // the node joins S[j] and S[j + 1]
  if (j < 0) return S.length === 1 ? [] : null;
  if (j === S.length - 1) return S.slice(0, -1);
  const L = S[j], R = S[j + 1];
  if (L.type === 'free' || R.type === 'free') return null;
  const g = { ...L, tb: R.tb, yb: R.yb };
  S.splice(j, 2, g);
  return S;
}

/* the drawing as a model: q tells which graph the segments live on */
export function drawModel(segs, q, s0, v0) {
  if (!segs.length) return null;
  const kind = q;
  const comp = segs.map((g, i) => ({
    kind, f: E => segValue(g, E.t), end: () => g.tb,
    s0: i === 0 ? () => s0 : null, v0: i === 0 ? () => v0 : null,
    inhS: i > 0 && kind !== 's', inhV: i > 0 && kind === 'a', blend: !!g.blend
  }));
  const M = buildEqModel({ ok: true, comp, vars: [] }, Object.create(null), { blendW: 0.4 });
  return M.ok ? M : null;
}

/* plot gallery: shapes on each graph, in world coordinates, over 6 s */
const L = (ta, ya, tb, yb) => ({ type: 'line', ta, tb, ya, yb, blend: false });
const Pp = (ta, ya, tb, yb, m0) => ({ type: 'para', ta, tb, ya, yb, m0, blend: false });
export const PLOTS = [
  { id: 'p_still', q: 's', segs: [L(0, 3, 6, 3)] },
  { id: 'p_const', q: 's', segs: [L(0, 1, 6, 8)] },
  { id: 'p_back', q: 's', segs: [L(0, 1, 3, 7), L(3, 7, 6, 1)] },
  { id: 'p_accel', q: 's', segs: [Pp(0, 1, 4, 9, 0), L(4, 9, 6, 9)] },
  { id: 'p_brake', q: 's', segs: [Pp(0, 1, 4, 7, 3), L(4, 7, 6, 7)] },
  { id: 'p_steps', q: 'v', segs: [L(0, 1, 2, 1), L(2, 2.5, 6, 2.5)], s0: 1 },
  { id: 'p_trap', q: 'v', segs: [L(0, 0, 2, 2), L(2, 2, 4, 2), L(4, 2, 6, 0)], s0: 1 },
  { id: 'p_ramp', q: 'v', segs: [L(0, 0, 6, 2.5)], s0: 0 },
  { id: 'p_rev', q: 'v', segs: [L(0, 3, 6, -3)], s0: 1 },
  { id: 'p_astep', q: 'a', segs: [L(0, 1, 3, 1), L(3, 0, 6, 0)], s0: 1, v0: 0 },
  { id: 'p_pulse', q: 'a', segs: [L(0, 0, 1, 0), L(1, 2, 3, 2), L(3, 0, 6, 0)], s0: 1, v0: 0 },
  { id: 'p_abrake', q: 'a', segs: [L(0, 1.5, 2, 1.5), L(2, 0, 4, 0), L(4, -1.5, 6, -1.5)], s0: 0, v0: 0 }
];
