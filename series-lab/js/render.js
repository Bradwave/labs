// Series Lab · render.js
// Canvas drawing of the three views: Argand plane, Re/Im parts, moduli. Pure drawing: state comes in through `m`.
import { niceTicks, fmtNum, fmtSci } from "../../kit/kit.js";
import { drawMath } from "../../kit/mathtext.js";

// bottom margin grows when the hint box sits under the plot (set by main.js)
export const MARGIN = { l: 48, t: 12, r: 14, b: 28 };
export const plotRect = (W, H) => ({ x0: MARGIN.l, y0: MARGIN.t, x1: W - MARGIN.r, y1: H - MARGIN.b });

function fmtTick(v, step) {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1e6 || step < 1e-4) return fmtSci(v, 1);
  const d = Math.min(8, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
  return fmtNum(v, d);
}
const stepOf = (ticks) => (ticks.length > 1 ? ticks[1] - ticks[0] : 1);
const text = (ctx, src, x, y, C, o = {}) =>
  drawMath(ctx, src, x, y, { size: 11, weight: 400, color: C.muted, halo: C.surface, ...o });

function frame(ctx, P, C) {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
}
function clip(ctx, P) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
  ctx.clip();
}
function arrow(ctx, x0, y0, x1, y1, color, w) {
  const dx = x1 - x0,
    dy = y1 - y0,
    len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len,
    uy = dy / len,
    head = Math.min(10, len);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * head * 0.8, y1 - uy * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * head - uy * 4, y1 - uy * head + ux * 4);
  ctx.lineTo(x1 - ux * head + uy * 4, y1 - uy * head - ux * 4);
  ctx.closePath();
  ctx.fill();
}

// ---------- Argand plane ----------
// m: { s (series), k (cursor index), V (view {cx, cy, s}), frame, opts, est, hover {x, y} | null, n (current n) }
export function fitView(m, P) {
  const { s, k, frame } = m;
  const kEnd = frame === "all" ? s.count - 1 : k;
  let a = 0,
    b = 0,
    c = 0,
    d = 0;
  for (let i = 0; i <= kEnd; i++) {
    const x = s.sRe[i],
      y = s.sIm[i];
    if (x < a) a = x;
    if (x > b) b = x;
    if (y < c) c = y;
    if (y > d) d = y;
  }
  const pad = 30,
    pw = P.x1 - P.x0,
    ph = P.y1 - P.y0;
  let rw = b - a,
    rh = d - c;
  if (rw === 0 && rh === 0) rw = rh = 1;
  m.V.s = Math.min((pw - 2 * pad) / Math.max(rw, 1e-300), (ph - 2 * pad) / Math.max(rh, 1e-300));
  m.V.cx = (a + b) / 2;
  m.V.cy = (c + d) / 2;
}

export function drawPlane(ctx, W, H, C, m) {
  const P = plotRect(W, H),
    { s, k, V, opts } = m;
  if (m.frame !== "free") fitView(m, P);
  const mx = (P.x0 + P.x1) / 2,
    my = (P.y0 + P.y1) / 2;
  const X = (re) => mx + (re - V.cx) * V.s,
    Y = (im) => my - (im - V.cy) * V.s;
  const reMin = V.cx - (mx - P.x0) / V.s,
    reMax = V.cx + (P.x1 - mx) / V.s,
    imMin = V.cy - (P.y1 - my) / V.s,
    imMax = V.cy + (my - P.y0) / V.s;

  // grid with the same step on both axes (the plane keeps a 1:1 aspect)
  const tx = niceTicks(reMin, reMax, Math.max(2, (P.x1 - P.x0) / 90));
  const step = stepOf(tx);
  const ty = [];
  for (let v = Math.ceil(imMin / step) * step; v <= imMax + step * 1e-9 && ty.length < 60; v += step) ty.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  clip(ctx, P);
  ctx.strokeStyle = C.gridline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const v of tx) ctx.moveTo(Math.round(X(v)) + 0.5, P.y0), ctx.lineTo(Math.round(X(v)) + 0.5, P.y1);
  for (const v of ty) ctx.moveTo(P.x0, Math.round(Y(v)) + 0.5), ctx.lineTo(P.x1, Math.round(Y(v)) + 0.5);
  ctx.stroke();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (reMin < 0 && reMax > 0) ctx.moveTo(X(0), P.y0), ctx.lineTo(X(0), P.y1);
  if (imMin < 0 && imMax > 0) ctx.moveTo(P.x0, Y(0)), ctx.lineTo(P.x1, Y(0));
  ctx.stroke();

  // the polygonal path of the partial sums
  if (opts.line && k > 0) {
    ctx.strokeStyle = C.pos;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(X(s.sRe[0]), Y(s.sIm[0]));
    for (let i = 1; i <= k; i++) ctx.lineTo(X(s.sRe[i]), Y(s.sIm[i]));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (opts.dots && k <= 600) {
    ctx.fillStyle = C.pos;
    for (let i = 0; i <= k; i++) ctx.fillRect(X(s.sRe[i]) - 2, Y(s.sIm[i]) - 2, 4, 4);
  }
  // estimated limit: dashed line to a hollow marker
  if (opts.limit && m.est) {
    const ex = X(m.est[0]),
      ey = Y(m.est[1]);
    ctx.strokeStyle = C.vel;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(X(s.sRe[k]), Y(s.sIm[k]));
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeRect(ex - 6, ey - 6, 12, 12);
    text(ctx, "L", ex + 10, ey - 8, C, { color: C.vel, weight: 700, size: 12 });
  }
  // the last term as a vector from S_{n-1} to S_n
  const px = X(s.sRe[k]),
    py = Y(s.sIm[k]);
  if (opts.term) {
    const bx = k > 0 ? X(s.sRe[k - 1]) : X(0),
      by = k > 0 ? Y(s.sIm[k - 1]) : Y(0);
    arrow(ctx, bx, by, px, py, C.force, 2.5);
    text(ctx, `a_{${m.n}}`, (bx + px) / 2 + 6, (by + py) / 2 - 6, C, { color: C.force, weight: 700, size: 12 });
  }
  ctx.fillStyle = C.pos;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.fillRect(px - 5, py - 5, 10, 10);
  ctx.strokeRect(px - 5, py - 5, 10, 10);
  text(ctx, `S_{${m.n}}`, px + 9, py + 17, C, { color: C.pos, weight: 700, size: 12 });

  // hover: nearest partial sum
  if (m.hover) {
    let best = -1,
      bd = 14 * 14;
    for (let i = 0; i <= k; i++) {
      const dx = X(s.sRe[i]) - m.hover.x,
        dy = Y(s.sIm[i]) - m.hover.y,
        dd = dx * dx + dy * dy;
      if (dd < bd) (bd = dd), (best = i);
    }
    if (best >= 0) {
      const hx = X(s.sRe[best]),
        hy = Y(s.sIm[best]);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(hx - 6, hy - 6, 12, 12);
      text(ctx, `S_{${s.n0 + best}}`, hx + 10, hy - 9, C, { color: C.ink, weight: 700, size: 12 });
    }
  }
  ctx.restore();

  // tick labels outside the plot area, axis names inside
  frame(ctx, P, C);
  for (const v of tx) {
    const x = X(v);
    if (x > P.x0 + 10 && x < P.x1 - 10) text(ctx, fmtTick(v, step), x, P.y1 + 16, C, { align: "center" });
  }
  for (const v of ty) {
    const y = Y(v);
    if (y > P.y0 + 6 && y < P.y1 - 4) text(ctx, fmtTick(v, step), P.x0 - 6, y + 4, C, { align: "right" });
  }
  text(ctx, "Re", P.x1 - 8, P.y1 - 6, C, { align: "right", color: C.ink, weight: 700, size: 12 });
  text(ctx, "Im", P.x0 + 6, P.y0 + 14, C, { color: C.ink, weight: 700, size: 12 });
}

// ---------- Re/Im parts and moduli against n ----------
const hypot = (a, b) => Math.hypot(a, b);

// lines: [{ color, get(i) → value }] over indices 0..kEnd; log: log10 axis.
function plotVsN(ctx, W, H, C, m, lines, log, estLines) {
  const P = plotRect(W, H),
    { s, k } = m;
  const kEnd = m.frame === "all" ? s.count - 1 : k;
  let x0 = s.n0,
    x1 = s.n0 + kEnd;
  if (x1 - x0 < 1) (x0 -= 0.5), (x1 += 0.5);
  // y range
  let lo = Infinity,
    hi = -Infinity;
  const f = (v) => (log ? (v > 0 ? Math.log10(v) : NaN) : v);
  for (const ln of lines) {
    for (let i = 0; i <= kEnd; i++) {
      const v = f(ln.get(i));
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (log) {
    if (!(hi >= lo)) (lo = -1), (hi = 1);
    if (hi - lo < 1) (lo -= 0.6), (hi += 0.6);
  } else {
    if (!(hi >= lo)) (lo = -1), (hi = 1);
    for (const e of estLines) if (e.v < lo) lo = e.v;
    for (const e of estLines) if (e.v > hi) hi = e.v;
    if (hi === lo) (lo -= 1), (hi += 1);
  }
  const padY = (hi - lo) * 0.08;
  if (log) (lo -= padY * 0.5), (hi += padY * 0.5);
  else (lo -= padY), (hi += padY);
  const X = (n) => P.x0 + ((n - x0) / (x1 - x0)) * (P.x1 - P.x0),
    Y = (v) => P.y1 - ((v - lo) / (hi - lo)) * (P.y1 - P.y0);

  // grid and labels
  const tx = niceTicks(x0, x1, Math.max(2, (P.x1 - P.x0) / 70));
  let ty, yLabel;
  if (log) {
    const a = Math.ceil(lo),
      b = Math.floor(hi),
      every = Math.max(1, Math.ceil((b - a + 1) / 6));
    ty = [];
    for (let e = a; e <= b; e += every) ty.push(e);
    yLabel = (e) => `10^{${String(e).replace("-", "−")}}`;
  } else {
    ty = niceTicks(lo, hi, Math.max(2, (P.y1 - P.y0) / 45));
    const st = stepOf(ty);
    yLabel = (v) => fmtTick(v, st);
  }
  clip(ctx, P);
  ctx.strokeStyle = C.gridline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const v of tx) ctx.moveTo(Math.round(X(v)) + 0.5, P.y0), ctx.lineTo(Math.round(X(v)) + 0.5, P.y1);
  for (const v of ty) ctx.moveTo(P.x0, Math.round(Y(v)) + 0.5), ctx.lineTo(P.x1, Math.round(Y(v)) + 0.5);
  ctx.stroke();
  if (!log && lo < 0 && hi > 0) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(P.x0, Y(0));
    ctx.lineTo(P.x1, Y(0));
    ctx.stroke();
  }
  // estimated limit: dashed horizontal lines
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  for (const e of estLines) {
    ctx.strokeStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(P.x0, Y(e.v));
    ctx.lineTo(P.x1, Y(e.v));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // cursor
  if (kEnd > k) {
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(s.n0 + k)) + 0.5, P.y0);
    ctx.lineTo(Math.round(X(s.n0 + k)) + 0.5, P.y1);
    ctx.stroke();
  }
  // series: 1 px line, 4 px square markers when few points (data-logger look)
  for (const ln of lines) {
    ctx.strokeStyle = ctx.fillStyle = ln.color;
    ctx.lineWidth = kEnd < 150 ? 1 : 1.5;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= kEnd; i++) {
      const v = f(ln.get(i));
      if (Number.isNaN(v)) {
        pen = false;
        continue;
      }
      const x = X(s.n0 + i),
        y = Y(v);
      if (pen) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke();
    if (kEnd <= 150)
      for (let i = 0; i <= kEnd; i++) {
        const v = f(ln.get(i));
        if (!Number.isNaN(v)) ctx.fillRect(X(s.n0 + i) - 2, Y(v) - 2, 4, 4);
      }
  }
  ctx.restore();
  frame(ctx, P, C);
  const sx = stepOf(tx);
  for (const v of tx) {
    const x = X(v);
    if (x > P.x0 + 6 && x < P.x1 - 6) text(ctx, fmtTick(v, sx), x, P.y1 + 16, C, { align: "center" });
  }
  for (const v of ty) {
    const y = Y(v);
    if (y > P.y0 + 4 && y < P.y1 - 4) text(ctx, yLabel(v), P.x0 - 6, y + 4, C, { align: "right" });
  }
  text(ctx, "n", P.x1 - 8, P.y1 - 6, C, { align: "right", color: C.ink, weight: 700, size: 12 });
}

export function drawParts(ctx, W, H, C, m) {
  const { s, legend, opts, est } = m;
  const lines = [];
  if (legend.re) lines.push({ color: C.pos, get: (i) => s.sRe[i] });
  if (legend.im) lines.push({ color: C.acc, get: (i) => s.sIm[i] });
  const e = [];
  if (opts.limit && est) {
    if (legend.re) e.push({ color: C.pos, v: est[0] });
    if (legend.im) e.push({ color: C.acc, v: est[1] });
  }
  plotVsN(ctx, W, H, C, m, lines, false, e);
}
export function drawMod(ctx, W, H, C, m) {
  const { s, legend, opts } = m;
  const lines = [];
  if (legend.a) lines.push({ color: C.force, get: (i) => hypot(s.aRe[i], s.aIm[i]) });
  if (legend.s) lines.push({ color: C.pos, get: (i) => hypot(s.sRe[i], s.sIm[i]) });
  plotVsN(ctx, W, H, C, m, lines, opts.log, []);
}
