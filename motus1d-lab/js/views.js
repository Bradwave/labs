/* Drawing: the track with the cart, the three graphs and the gallery previews.
   Every function reads a view snapshot V built by main.js and never changes state. */
import { C, fit, niceTicks, label, arrow, hatch, FONT } from './plot.js';
import { num, fx } from './i18n.js';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const IDX = { s: 0, v: 1, a: 2 };
const UNIT = { s: 'm', v: 'm/s', a: 'm/s²' };
const BAR = { v: 'v̄', a: 'ā' };
export const qcol = q => ({ s: C().cs, v: C().cv, a: C().ca }[q]);

function interp(pc, q, t) {
  const ts = pc.t, n = ts.length;
  if (t <= ts[0]) return pc[q][0];
  if (t >= ts[n - 1]) return pc[q][n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
  const d = ts[hi] - ts[lo], r = d > 0 ? (t - ts[lo]) / d : 0;
  return pc[q][lo] * (1 - r) + pc[q][hi] * r;
}

/* path between the curve and a horizontal level, over [a, b], one sub-path per piece */
function polyBetween(P, M, q, a, b, base) {
  const c = P.ctx; c.beginPath();
  for (const pc of M.pieces) {
    const n = pc.t.length, pa = Math.max(a, pc.t[0]), pb = Math.min(b, pc.t[n - 1]);
    if (!(pb > pa)) continue;
    c.moveTo(P.X(pa), P.Y(base));
    c.lineTo(P.X(pa), P.Yc(interp(pc, q, pa)));
    for (let i = 0; i < n; i++) { const t = pc.t[i]; if (t > pa && t < pb && isFinite(pc[q][i])) c.lineTo(P.X(t), P.Yc(pc[q][i])); }
    c.lineTo(P.X(pb), P.Yc(interp(pc, q, pb)));
    c.lineTo(P.X(pb), P.Y(base)); c.closePath();
  }
}
function fillTwo(P, build, base, colAbove, colBelow, alpha) {
  const c = P.ctx, yb = P.Y(base);
  c.save(); c.globalAlpha = alpha;
  c.save(); c.beginPath(); c.rect(P.x0, -1e5, P.x1 - P.x0, yb + 1e5); c.clip(); build(); c.fillStyle = colAbove; c.fill(); c.restore();
  c.save(); c.beginPath(); c.rect(P.x0, yb, P.x1 - P.x0, 1e5); c.clip(); build(); c.fillStyle = colBelow; c.fill(); c.restore();
  c.restore();
}

/* Labels on a graph are collected first and placed at the end, so they keep off the axes, the t₁ t₂ tabs,
   the letter tags, the impulse arrows and each other. Each label tries its own spot, then nearby ones. */
let LB = null;
function lab(c, txt, x, y, color, align = 'left', size = 11) {
  if (!LB) { label(c, txt, x, y, color, align, size); return; }
  LB.items.push({ txt, x, y, color, align, size });
}
const obstacle = (x0, y0, x1, y1) => { if (LB) LB.obs.push([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]); };
function placeLabels(c, P) {
  const L = LB; LB = null; if (!L) return;
  const hit = (r, list) => list.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
  const placed = [];
  for (const it of L.items) {
    c.save(); c.font = `700 ${it.size}px ${FONT}`; const w = c.measureText(it.txt).width; c.restore();
    const rectAt = (x, y) => { const l = it.align === 'left' ? x : it.align === 'right' ? x - w : x - w / 2; return [l - 2, y - it.size, l + w + 2, y + 3]; };
    const fits = (x, y) => { const r = rectAt(x, y); return r[0] >= P.x0 + 2 && r[2] <= P.x1 + 12 && r[1] >= P.y1 + 15 && r[3] <= P.y0 - 1 && !hit(r, L.obs) && !hit(r, placed); };
    // keep it inside the plot horizontally before searching
    const r0 = rectAt(it.x, it.y); let x = it.x;
    if (r0[0] < P.x0 + 2) x += P.x0 + 2 - r0[0]; else if (r0[2] > P.x1 + 12) x -= r0[2] - P.x1 - 12;
    let best = null;
    for (const dy of [0, -13, 13, -26, 26, -39, 39, -52, 52]) for (const dx of [0, -w / 2 - 8, w / 2 + 8]) { if (!best && fits(x + dx, it.y + dy)) best = [x + dx, it.y + dy]; }
    if (!best) best = [x, Math.min(P.y0 - 4, Math.max(P.y1 + 26, it.y))];
    placed.push(rectAt(best[0], best[1]));
    label(c, it.txt, best[0], best[1], it.color, it.align, it.size);
  }
}

/* Δt as a horizontal vector, then Δs (or Δv) as a vertical one: the two legs of the secant triangle */
function deltaVec(P, t1, y1, t2, y2, col, txt, dtTxt) {
  const c = P.ctx, x1 = P.X(t1), x2 = P.X(t2), ya = P.Yc(y1), yb = P.Yc(y2), m = C().muted;
  if (x2 - x1 > 8) {
    arrow(c, x1, ya, x2, ya, m, 2); obstacle(x1, ya - 4, x2, ya + 4);
    lab(c, dtTxt, (x1 + x2) / 2, yb < ya ? ya + 14 : ya - 6, m, 'center', 10.5);
  }
  if (Math.abs(yb - ya) > 8) { arrow(c, x2 + 5, ya, x2 + 5, yb, col, 3); obstacle(x2 + 1, ya, x2 + 9, yb); }
  const right = x2 + 14 + txt.length * 7 < P.x1;
  lab(c, txt, right ? x2 + 12 : x2 - 4, (ya + yb) / 2 + 4, col, right ? 'left' : 'right', 11);
}

function tangentSeg(P, t, y, slope, half, col, lw, dash) {
  P.seg(t - half, y - slope * half, t + half, y + slope * half, col, lw, dash);
}

/* an impulse in a(t): an arrow from the zero line, kept inside the plot */
function dirac(P, dV) {
  const H = P.y0 - P.y1, up = (dV || 1) > 0;
  let y0 = Math.min(P.y0 - 2, Math.max(P.y1 + 2, P.Y(0)));
  const room = up ? y0 - P.y1 - 6 : P.y0 - y0 - 6;
  if (room < H * 0.3) y0 = up ? P.y0 - 2 : P.y1 + 2;
  const L = Math.min(H * 0.42, up ? y0 - P.y1 - 6 : P.y0 - y0 - 6) * (up ? 1 : -1);
  return [y0, L];
}

function tagBox(c, x, y, txt, fill) {
  c.save(); c.font = `700 10px ${FONT}`;
  const w = c.measureText(txt).width + 8;
  c.fillStyle = fill; c.strokeStyle = C().ink; c.lineWidth = 1.5;
  c.fillRect(x - w, y - 18, w, 14); c.strokeRect(x - w, y - 18, w, 14); obstacle(x - w - 2, y - 20, x + 2, y - 2);
  c.fillStyle = fill === C().surface ? C().ink : '#0A1240'; c.textAlign = 'center'; c.fillText(txt, x - w / 2, y - 7.5); c.restore();
}

function diamond(c, x, y, col) {
  c.save(); c.fillStyle = col; c.strokeStyle = C().ink; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath(); c.fill(); c.stroke(); c.restore();
}

export function drawGraph(P, q, V) {
  if (V.ml) P.m.l = V.ml;
  // a hidden curve of the active motion takes everything drawn from it along: areas, slopes, joints, dots
  const offA = !!(V.hideA && V.hideA[q]), col = C(), c = P.begin(), M = offA ? null : V.M, qc = qcol(q);
  const [lo, hi] = V.yr[q];
  P.range(0, V.tSpan, lo, hi);
  const yl = (q === 's' ? V.Q : q) + ' (' + UNIT[q] + ')';
  P.grid({ yl, ycol: qc, xl: 't (s)' });
  LB = { items: [], obs: [] };
  { const ya = Math.min(P.y0, Math.max(P.y1, P.Y(0))); obstacle(P.x0, ya - 3, P.x1 + 14, ya + 3); obstacle(P.x1 - 44, ya - 22, P.x1 + 14, ya - 2); }
  if (V.an.iv) for (const t of [V.an.t1, V.an.t2]) obstacle(P.X(t) - 12, P.y1, P.X(t) + 12, P.y1 + 16);
  const hide = V.pred && V.pred.q === q && !V.pred.revealed;
  const an = V.an, st = V.st, iv = an.iv && M && st && !hide;
  P.clipOn();

  if (M) for (const J of M.joints) if (J.blend) {
    const xa = P.X(J.t - J.w / 2), xb = P.X(J.t + J.w / 2);
    hatch(c, xa, P.y1, Math.max(2, xb - xa), P.y0 - P.y1, col.hatch);
  }
  if (V.TM && V.tq === q) for (const pc of V.TM.pieces) P.line(pc.t, pc[q], col.target, 11);

  /* areas and averages on v-t and a-t */
  if (iv && q !== 's') {
    const { t1, t2 } = an, areaOn = q === 'v' ? an.areaV : an.areaA, avgOn = an.avg && (q === 'v' || V.f('gA'));
    const fn = q === 'v' ? M.V : M.A;
    if (areaOn) {
      if (an.method === 'true' || !V.f('riemann')) fillTwo(P, () => polyBetween(P, M, q, t1, t2, 0), 0, qc, col.neg, avgOn ? 0.16 : 0.32);
      else {
        const R = V.rs[q];
        if (R) for (const it of R.items) {
          const x0 = P.X(it.a), x1 = P.X(it.b), y0 = P.Y(0);
          c.save(); c.beginPath();
          if (an.method === 'trap') { c.moveTo(x0, y0); c.lineTo(x0, P.Yc(it.ha)); c.lineTo(x1, P.Yc(it.hb)); c.lineTo(x1, y0); }
          else { c.rect(x0, P.Yc(it.h), x1 - x0, y0 - P.Yc(it.h)); }
          c.closePath();
          const pos = an.method === 'trap' ? it.ha + it.hb >= 0 : it.h >= 0;
          c.globalAlpha = 0.3; c.fillStyle = pos ? qc : col.neg; c.fill();
          c.globalAlpha = 0.9; c.strokeStyle = col.ink; c.lineWidth = 1; c.stroke(); c.restore();
        }
      }
    }
    if (avgOn) {
      const m = q === 'v' ? st.vmean : st.amean;
      if (isFinite(m)) {
        fillTwo(P, () => polyBetween(P, M, q, t1, t2, m), m, col.over, col.under, 0.5);
        c.save(); c.strokeStyle = col.accent; c.lineWidth = 2.5; c.setLineDash([7, 4]);
        c.strokeRect(P.X(t1), P.Yc(m), P.X(t2) - P.X(t1), P.Y(0) - P.Yc(m)); c.restore();
        const cr = q === 'v' ? st.cv : st.ca;
        if (Array.isArray(cr)) for (const tc of cr) diamond(c, P.X(tc), P.Yc(m), col.accent);
        const ym = P.Yc(m), up = m >= 0 ? ym - 7 > P.y1 + 12 : ym + 16 > P.y0 - 4;
        lab(c, BAR[q] + ' = ' + fx(m) + ' ' + UNIT[q], (P.X(t1) + P.X(t2)) / 2, up ? ym - 7 : ym + 16, col.accent, 'center', 11);
      }
    }
  }

  /* the curve */
  if (M && !hide) for (const pc of M.pieces) P.line(pc.t, pc[q], qc, 2.6);
  /* samples: every recorded point while editing a recording, every freehand point in the move tool */
  if (M && V.recDots && M.pieces.length === 1) {
    const pc = M.pieces[0], n = pc.t.length, step = Math.max(1, Math.ceil(n / ((P.x1 - P.x0) / 6)));
    c.save(); c.fillStyle = col.surface; c.strokeStyle = qc; c.lineWidth = 1.4;
    for (let i = 0; i < n; i += step) { const y = (q === 's' && M.raw ? M.raw : pc[q])[i]; if (!isFinite(y)) continue; c.beginPath(); c.arc(P.X(pc.t[i]), P.Yc(y), 2.4, 0, 7); c.fill(); c.stroke(); }
    c.restore();
  }
  if (V.dots && V.drawQ === q) {
    const step = Math.max(1, Math.ceil(V.dots.length / ((P.x1 - P.x0) / 6)));
    c.save(); c.fillStyle = col.surface; c.strokeStyle = qc; c.lineWidth = 1.4;
    for (let i = 0; i < V.dots.length; i += step) { const [t, y] = V.dots[i]; c.beginPath(); c.arc(P.X(t), P.Yc(y), 2.3, 0, 7); c.fill(); c.stroke(); }
    c.restore();
  }
  if (V.editPrev && V.editPrev.q === q && V.editPrev.pts.length > 1) {
    c.save(); c.strokeStyle = col.accent; c.globalAlpha = 0.55; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    V.editPrev.pts.forEach(([t, y], i) => (i ? c.lineTo(P.X(t), P.Yc(y)) : c.moveTo(P.X(t), P.Yc(y)))); c.stroke(); c.restore();
  }
  /* other motions: same colour, dashed, each with its letter; meetings on s-t */
  if (V.others && V.others.length) {
    const endLab = (Mx, txt, fill) => { const pc = Mx.pieces[Mx.pieces.length - 1], n = pc.t.length - 1, y = pc[q][n]; if (isFinite(y)) { const yy = P.Yc(y); tagBox(c, P.X(pc.t[n]) - 4, yy - 18 < P.y1 ? yy + 22 : yy, txt, fill); } };
    V.others.forEach((o, k) => { if (o.hid && o.hid[q]) return; for (const pc of o.M.pieces) P.line(pc.t, pc[q], qc, 2.2, k % 2 ? [3, 4] : [7, 5]); endLab(o.M, o.L, col.tile2); });
    if (M && !hide && !offA && V.La) endLab(M, V.La, col.surface);
    if (q === 's') for (const m of V.meet || []) {
      P.seg(m.t, m.s, m.t, lo - 1e3, col.muted, 1.2, [2, 3]);
      diamond(c, P.X(m.t), P.Yc(m.s), col.tile2);
    }
  }
  if (V.pred && V.pred.q === q) {
    const pr = V.pred, c2 = P.ctx;
    c2.save(); c2.strokeStyle = col.accent; c2.lineWidth = hide ? 3 : 2.5; c2.lineJoin = 'round'; c2.lineCap = 'round';
    if (!hide) c2.setLineDash([7, 5]);
    c2.beginPath(); let pen = false;
    for (let i = 0; i < pr.ys.length; i++) {
      const y = pr.ys[i], t = pr.tspan * i / (pr.ys.length - 1);
      if (!isFinite(y)) { pen = false; continue; }
      if (pen) c2.lineTo(P.X(t), P.Yc(y)); else { c2.moveTo(P.X(t), P.Yc(y)); pen = true; }
    }
    c2.stroke(); c2.restore();
  }
  if (V.drawQ === q) {
    if (V.preview && V.preview.length > 1) {
      c.save(); c.strokeStyle = col.accent; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
      V.preview.forEach(([t, y], i) => (i ? c.lineTo(P.X(t), P.Yc(y)) : c.moveTo(P.X(t), P.Yc(y))));
      c.stroke(); c.restore();
    }
    if (M) { c.save(); c.strokeStyle = col.muted; c.setLineDash([2, 4]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(P.X(M.T), P.y1); c.lineTo(P.X(M.T), P.y0); c.stroke(); c.restore(); }
    for (const hd of V.handles || []) {
      const x = P.X(hd.t), y = P.Yc(hd.y);
      c.save(); c.fillStyle = col.surface; c.strokeStyle = col.ink; c.lineWidth = 2; c.fillRect(x - 5, y - 5, 10, 10); c.strokeRect(x - 5, y - 5, 10, 10); c.restore();
    }
  }
  if (M && !hide && V.raw && q === 's' && M.raw) {
    c.save(); c.fillStyle = V.rawBig ? col.accent : col.ink; c.globalAlpha = V.rawBig ? 0.9 : 0.45;
    const step = Math.max(1, Math.floor(M.raw.length / (V.rawBig ? 900 : 400))), rr = V.rawBig ? 2.4 : 1.6;
    for (let i = 0; i < M.raw.length; i += step) { c.beginPath(); c.arc(P.X(i * (M.rawDt || 1 / 60)), P.Yc(M.raw[i]), rr, 0, 7); c.fill(); }
    c.restore();
  }

  /* joints that were not blended */
  let lastLab = -1e9;
  const canLab = x => { if (x - lastLab < 120) return false; lastLab = x; return true; };
  if (M && !hide) for (const J of M.joints) if (!J.blend) {
    const t = J.t;
    if (J.status === 'jump') {
      if (q === 's') { P.seg(t, J.L[0], t, J.R[0], col.err, 2, [4, 3]); P.dot(t, J.L[0], col.err, 4, true); P.dot(t, J.R[0], col.err, 4); }
      else { P.seg(t, lo - 1e3, t, hi + 1e3, col.err, 1.5, [3, 4]); if (q === 'v') lab(c, '∞', P.X(t) + 4, P.y1 + 14, col.err, 'left', 13); }
    } else if (J.status === 'kink') {
      if (q === 's') { c.save(); c.strokeStyle = col.warn; c.lineWidth = 2.5; c.beginPath(); c.arc(P.X(t), P.Yc(J.R[0]), 8, 0, 7); c.stroke(); c.restore(); }
      else if (q === 'v') { P.seg(t, J.L[1], t, J.R[1], col.warn, 2, [4, 3]); P.dot(t, J.L[1], col.warn, 4, true); P.dot(t, J.R[1], col.warn, 4); }
      else {
        const x = P.X(t), [y0, L] = dirac(P, J.dV);
        arrow(c, x, y0, x, y0 - L, col.warn, 3); obstacle(x - 7, y0, x + 7, y0 - L);
        if (canLab(x)) lab(c, 'Δv = ' + fx(J.dV), x + 6, y0 - L * 0.8, col.warn, 'left', 10.5);
      }
    } else if (J.status === 'coll') {
      if (q === 'v') { P.seg(t, J.L[1], t, J.R[1], col.accent, 2, [4, 3]); P.dot(t, J.L[1], col.accent, 4, true); P.dot(t, J.R[1], col.accent, 4); }
      else if (q === 'a') {
        const x = P.X(t), [y0, L] = dirac(P, J.dV);
        arrow(c, x, y0, x, y0 - L, col.accent, 3); obstacle(x - 7, y0, x + 7, y0 - L);
        if (canLab(x)) lab(c, V.collTxt + ' Δv = ' + fx(J.dV), x + 6, y0 - L * 0.8, col.accent, 'left', 10.5);
      }
    } else if (J.status === 'acorner') {
      if (q === 'a') { P.seg(t, J.L[2], t, J.R[2], col.muted, 2, [4, 3]); P.dot(t, J.L[2], col.muted, 3.5, true); P.dot(t, J.R[2], col.muted, 3.5); }
      else if (q === 'v') { c.save(); c.strokeStyle = col.muted; c.lineWidth = 2; c.beginPath(); c.arc(P.X(t), P.Yc(J.R[1]), 6, 0, 7); c.stroke(); c.restore(); }
    }
  }

  /* secants, brackets, mean-value tangents */
  if (iv) {
    const { t1, t2 } = an, gA = V.f('gA');
    if (q === 's') {
      if (an.sec || an.avg) {
        const sl = st.vbar, ex = (t2 - t1) * 0.12;
        P.seg(t1 - ex, st.s1 - sl * ex, t2 + ex, st.s2 + sl * ex, col.cv, 2, [6, 4]);
        P.dot(t1, st.s1, col.cv, 4); P.dot(t2, st.s2, col.cv, 4);
        lab(c, BAR.v + ' = ' + fx(sl) + ' m/s', P.X((t1 + t2) / 2), P.Yc((st.s1 + st.s2) / 2) + (sl >= 0 ? -9 : 17), col.cv, 'center', 11);
      }
      if (an.sec || an.areaV || an.avg) deltaVec(P, t1, st.s1, t2, st.s2, col.cs, 'Δ' + V.Q + ' = ' + fx(st.ds) + ' m', 'Δt = ' + fx(t2 - t1) + ' s');
      if (an.avg && Array.isArray(st.cv)) for (const tc of st.cv) tangentSeg(P, tc, M.S(tc), st.vmean, V.tSpan * 0.07, col.cv, 2.2, [2, 3]);
    } else if (q === 'v' && gA) {
      if (an.sec || an.avg) {
        const sl = st.abar, ex = (t2 - t1) * 0.12;
        P.seg(t1 - ex, st.v1 - sl * ex, t2 + ex, st.v2 + sl * ex, col.ca, 2, [6, 4]);
        P.dot(t1, st.v1, col.ca, 4); P.dot(t2, st.v2, col.ca, 4);
      }
      if (an.sec || an.areaA || an.avg) deltaVec(P, t1, st.v1, t2, st.v2, col.cv, 'Δv = ' + fx(st.dv) + ' m/s', 'Δt = ' + fx(t2 - t1) + ' s');
      if (an.avg && Array.isArray(st.ca)) for (const tc of st.ca) tangentSeg(P, tc, M.V(tc), st.amean, V.tSpan * 0.07, col.ca, 2.2, [2, 3]);
    }
  }

  /* tangent at the cursor */
  const tc = V.t;
  if (M && !hide && an.tan && V.f('tan') && tc <= M.T + 1e-9 && (q === 's' || (q === 'v' && V.f('gA')))) {
    const r = M.at(tc), y = r[IDX[q]], sl = r[IDX[q] + 1], half = V.tSpan * 0.14, sc = q === 's' ? col.cv : col.ca;
    if (isFinite(y) && isFinite(sl)) {
      tangentSeg(P, tc, y, sl, half, sc, 2.4);
      const xe = P.X(tc + half), ye = P.Yc(y + sl * half);
      const txt = (q === 's' ? 'v' : 'a') + ' = ' + fx(sl) + ' ' + (q === 's' ? 'm/s' : 'm/s²');
      const left = xe + txt.length * 7 > P.x1;
      lab(c, txt, left ? P.X(tc - half) - 4 : xe + 4, left ? P.Yc(y - sl * half) + 4 : ye + 4, sc, left ? 'right' : 'left', 11);
    }
  }

  /* cursor */
  if (tc <= V.tSpan) {
    P.seg(tc, lo - 1e3, tc, hi + 1e3, col.ink, 1.3);
    if (M && !hide && !offA && tc <= M.T + 1e-9) { const y = M.at(tc)[IDX[q]]; if (isFinite(y)) P.dot(tc, y, qc, 5); }
    for (const o of V.others || []) if (tc <= o.M.T + 1e-9 && !(o.hid && o.hid[q])) { const y = o.M.at(tc)[IDX[q]]; if (isFinite(y)) P.dot(tc, y, col.tile2, 4.5); }
  }
  P.clipOff();

  /* a recording being edited: every graph says it can be dragged */
  /* the graph that takes the pen (drawing) or the fingers (editing): dashed frame and a tag */
  const boxTag = V.editable && M ? V.editable : V.drawQ === q && V.drawTag ? V.drawTag : '';
  if (boxTag) {
    c.save(); c.strokeStyle = col.accent; c.lineWidth = 2; c.setLineDash([6, 4]);
    c.strokeRect(P.x0 + 2, P.y1 - 1, P.x1 - P.x0 - 2, P.y0 - P.y1 + 1); c.restore();
    tagBox(c, P.x1 - 44, P.y1 + 18, '✎ ' + boxTag, col.accent);
  }
  /* interval handles */
  if (an.iv) for (const [k, t] of [['₁', an.t1], ['₂', an.t2]]) {
    const x = P.X(t);
    c.save(); c.strokeStyle = col.muted; c.lineWidth = 1.2; c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(x, P.y1); c.lineTo(x, P.y0); c.stroke(); c.restore();
    c.save(); c.fillStyle = col.ink; c.fillRect(x - 10, P.y1 + 1, 20, 13);
    c.font = `700 10px ${FONT}`; c.fillStyle = col.surface; c.textAlign = 'center'; c.fillText('t' + k, x, P.y1 + 11); c.restore();
  }
  placeLabels(c, P);
}

export function drawTrack(cv, V) {
  const { ctx: c, w, h } = fit(cv), col = C(), vert = V.vert;
  c.fillStyle = col.surface; c.fillRect(0, 0, w, h);
  const [lo, hi] = V.wr;
  let a0, a1, base;
  if (!vert) { a0 = V.fab && V.lefty ? 84 : 22; a1 = w - (V.fab && !V.lefty ? 84 : 30); base = Math.round(h * 0.68) + 0.5; }
  else { a0 = h - (V.fab ? 86 : 30); a1 = 30; base = Math.round(Math.min(58, w * 0.45)) + 0.5; }
  const A = x => a0 + (x - lo) / (hi - lo) * (a1 - a0);
  const pt = (x, off) => (vert ? [base + off, A(x)] : [A(x), base - off]);
  V.trackInv = (px, py) => lo + ((vert ? py : px) - a0) / (a1 - a0) * (hi - lo);
  V.trackPt = x => { const [px, py] = pt(clamp(x, lo, hi), 0); return vert ? [px, py] : [px, py - 14]; };
  const { o, dir } = V.frame, toV = x => dir * (x - o), toW = x => o + dir * x;

  if (V.floor) {
    const y = A(0) + 11;
    c.save(); c.strokeStyle = col.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(6, y); c.lineTo(w - 6, y); c.stroke();
    hatch(c, 6, y + 1, w - 12, 10, col.hatch, 6); c.restore();
  }
  /* ticks in the chosen frame */
  const xa = toV(lo), xb = toV(hi), span = Math.abs(a1 - a0);
  const ticks = niceTicks(Math.min(xa, xb), Math.max(xa, xb), Math.max(3, Math.floor(span / (vert ? 40 : 55))));
  c.strokeStyle = col.ink; c.lineWidth = 1.5; c.textBaseline = vert ? 'middle' : 'top';
  for (const x of ticks) {
    const [px, py] = pt(toW(x), 0), big = x === 0;
    c.beginPath();
    if (vert) { c.moveTo(px, py); c.lineTo(px - (big ? 8 : 5), py); } else { c.moveTo(px, py); c.lineTo(px, py + (big ? 8 : 5)); }
    c.stroke();
    c.fillStyle = big ? col.ink : col.muted; c.font = `${big ? 700 : 400} 10.5px ${FONT}`; c.textAlign = vert ? 'right' : 'center';
    if (vert) { if (!(x === 0 && o >= lo - 1e-9 && o <= hi + 1e-9)) c.fillText(num(x, 3), px - 10, py); } else c.fillText(num(x, 3), px, py + 9);
  }
  /* axis arrow points towards increasing values */
  const [p0x, p0y] = pt(dir > 0 ? lo : hi, 0), [p1x, p1y] = pt(dir > 0 ? hi : lo, 0);
  const ux = Math.sign(p1x - p0x), uy = Math.sign(p1y - p0y);
  arrow(c, p0x - ux * 12, p0y - uy * 12, p1x + ux * 14, p1y + uy * 14, col.ink, 2);
  if (vert) label(c, V.Q + ' (m)', p1x + 8, p1y + uy * 14 + (uy < 0 ? 4 : 0), col.ink, 'left', 11);
  else label(c, V.Q + ' (m)', p1x + ux * 12, p1y - 8, col.ink, ux > 0 ? 'right' : 'left', 11);
  /* origin, draggable */
  if (o >= lo - 1e-9 && o <= hi + 1e-9) {
    const [ox, oy] = pt(o, 0);
    c.save(); c.fillStyle = col.tile2; c.strokeStyle = col.ink; c.lineWidth = 2;
    c.beginPath(); c.arc(ox, oy, 6, 0, 7); c.fill(); c.stroke(); c.restore();
    label(c, 'O', vert ? ox - 10 : ox - 9, vert ? oy + 4 : oy - 8, col.ink, 'right', 11);
    V.originPx = [ox, oy];
  } else V.originPx = null;

  const M = V.Mw, kv = span * 0.16 / Math.max(0.5, V.vmax), ka = span * 0.14 / Math.max(0.3, V.amax);
  const along = (x, y, d) => (vert ? [x, y - d] : [x + d, y]);
  /* strobe and motion diagram */
  if (M && (V.show.strobe || V.diagram)) {
    const raw = M.T / 16, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, dt = (f < 1.5 ? 1 : f < 3.5 ? 2 : 5) * p;
    const N = Math.floor(M.T / dt + 1e-9) + 1, room = vert ? w - base - 26 : 0;
    const dots = [];
    for (let k = 0; k < N; k++) {
      const t = k * dt, r = M.at(t);
      if (!isFinite(r[0])) continue;
      const off = vert ? 16 + (N > 1 ? room * k / (N - 1) : 0) : 0;
      dots.push({ t, r, p: pt(r[0], off) });
    }
    if (V.diagram) {
      for (let k = 0; k < dots.length; k++) {
        const d = dots[k], [x, y] = vert ? d.p : [d.p[0], d.p[1] - 12];
        const [x2, y2] = along(x, y, d.r[1] * kv);
        if (Math.abs(d.r[1] * kv) > 2) arrow(c, x, y, x2, y2, col.cv, 2);
        if (V.f('gA') && k < dots.length - 1) {
          const e = dots[k + 1], dv = e.r[1] - d.r[1];
          const [mx, my] = vert ? [(d.p[0] + e.p[0]) / 2 + 4, (d.p[1] + e.p[1]) / 2] : [(d.p[0] + e.p[0]) / 2, d.p[1] - 26];
          const [mx2, my2] = along(mx, my, dv * kv * 1.5);
          if (Math.abs(dv * kv * 1.5) > 2) arrow(c, mx, my, mx2, my2, col.ca, 1.8);
        }
      }
    }
    for (const d of dots) {
      c.beginPath(); c.arc(d.p[0], d.p[1] - (vert ? 0 : 2), 3.4, 0, 7);
      if (d.t <= V.t + 1e-9) { c.fillStyle = col.cs; c.fill(); } else { c.fillStyle = col.surface; c.fill(); c.strokeStyle = col.cs; c.lineWidth = 1.5; c.stroke(); }
    }
  }

  /* the second object, drawn first so A stays on top when they meet */
  const body = (x, y, fill, txt) => {
    c.save(); c.strokeStyle = col.ink; c.lineWidth = 2; c.fillStyle = fill;
    if (!vert) {
      const bw = 34, bh = 15, by = y - 9 - bh;
      c.fillRect(x - bw / 2, by, bw, bh); c.strokeRect(x - bw / 2, by, bw, bh);
      for (const dx of [-9, 9]) { c.beginPath(); c.arc(x + dx, y - 4.5, 4, 0, 7); c.fillStyle = col.ink; c.fill(); }
      if (txt) { c.font = `700 10px ${FONT}`; c.fillStyle = fill === col.tile2 ? '#0A1240' : col.onaccent; c.textAlign = 'center'; c.fillText(txt, x, by + 11); }
    } else {
      c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.stroke();
      if (txt) { c.font = `700 10px ${FONT}`; c.fillStyle = fill === col.tile2 ? '#0A1240' : col.onaccent; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + 0.5); }
    }
    c.restore();
  };
  for (const o of V.carts || []) if (isFinite(o.w)) { const [bx, by] = pt(clamp(o.w, lo, hi), 0); body(bx, by, col.tile2, o.L); }
  /* the cart (horizontal) or the ball (vertical) */
  const s = V.cartW;
  if (isFinite(s)) {
    const sc = clamp(s, lo, hi), [cx, cy] = pt(sc, 0);
    c.strokeStyle = col.ink; c.lineWidth = 2; c.fillStyle = V.dragging ? col.tile2 : col.accent;
    let ax0, ay0, ax1, ay1;
    if (!vert) {
      const bw = 34, bh = 15, by = cy - 9 - bh;
      body(cx, cy, V.dragging ? col.tile2 : col.accent, V.La || '');
      ax0 = [cx, by - 8]; ax1 = [cx, by - 22];
    } else {
      body(cx, cy, V.dragging ? col.tile2 : col.accent, V.La || '');
      ax0 = [cx + 20, cy]; ax1 = [cx + 34, cy];
    }
    if (s < lo || s > hi) label(c, vert ? (s < lo ? '▼' : '▲') : (s < lo ? '◀' : '▶'), cx + (vert ? 18 : 0), cy - (vert ? 0 : 30), col.err, 'center', 12);
    if (V.show.vel && isFinite(V.cartVw) && Math.abs(V.cartVw * kv) > 2) {
      const [x2, y2] = along(ax0[0], ax0[1], V.cartVw * kv); arrow(c, ax0[0], ax0[1], x2, y2, col.cv, 3);
      label(c, 'v', x2 + (vert ? 6 : V.cartVw > 0 ? 5 : -5), y2 + (vert ? 4 : 4), col.cv, vert ? 'left' : V.cartVw > 0 ? 'left' : 'right', 11);
    }
    if (V.show.acc && V.f('gA') && isFinite(V.cartAw) && Math.abs(V.cartAw * ka) > 2) {
      const [x2, y2] = along(ax1[0], ax1[1], V.cartAw * ka); arrow(c, ax1[0], ax1[1], x2, y2, col.ca, 3);
      label(c, 'a', x2 + (vert ? 6 : V.cartAw > 0 ? 5 : -5), y2 + 4, col.ca, vert ? 'left' : V.cartAw > 0 ? 'left' : 'right', 11);
    }
  }
  if (V.trackMsg && !(vert && w < 160)) label(c, V.trackMsg, vert ? 8 : 22, 16, col.muted, 'left', 11, false); // a narrow vertical track has no room: the graph says it
}

/* small previews for the gallery and the targets */
export function drawMini(cv, M, qs, hiQ, Q = 's') {
  const { ctx: c, w, h } = fit(cv), col = C();
  c.fillStyle = col.surface; c.fillRect(0, 0, w, h);
  if (!M) return;
  const n = qs.length, gw = w / n;
  qs.forEach((q, k) => {
    const x0 = k * gw + 4, x1 = (k + 1) * gw - 4, y0 = h - 5, y1 = 5;
    let [lo, hi] = M.range[q]; lo = Math.min(lo, 0); hi = Math.max(hi, 0);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const X = t => x0 + t / M.T * (x1 - x0), Y = v => y0 + (v - lo) / (hi - lo) * (y1 - y0);
    c.strokeStyle = col.gridline; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, Y(0)); c.lineTo(x1, Y(0)); c.moveTo(x0, y1); c.lineTo(x0, y0); c.stroke();
    c.strokeStyle = hiQ === q ? col.target : qcol(q); c.lineWidth = hiQ === q ? 5 : 2; c.lineJoin = 'round';
    for (const pc of M.pieces) {
      c.beginPath(); let pen = false;
      for (let i = 0; i < pc.t.length; i += 2) { const v = pc[q][i]; if (!isFinite(v)) { pen = false; continue; } const X1 = X(pc.t[i]), Y1 = Math.min(h + 50, Math.max(-50, Y(v))); if (pen) c.lineTo(X1, Y1); else { c.moveTo(X1, Y1); pen = true; } }
      c.stroke();
    }
    c.font = `700 9px ${FONT}`; c.fillStyle = qcol(q); c.textAlign = 'left'; c.fillText(q === 's' ? Q : q, x0 + 3, y1 + 8);
  });
}
