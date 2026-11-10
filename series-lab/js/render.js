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

// Grid and axes of a complex plane with view V = { cx, cy, s }. `under(ctx, b)` paints between clip and grid.
function planeBase(ctx, P, C, V, under) {
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
  if (under) under(ctx, { X, Y });
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

  return { X, Y, tx, ty, step };
}
function planeEnd(ctx, P, C, b) {
  const { X, Y, tx, ty, step } = b;
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

export function drawPlane(ctx, W, H, C, m) {
  const P = plotRect(W, H),
    { s, k, V, opts } = m;
  if (m.frame !== "free") fitView(m, P);
  const base = planeBase(ctx, P, C, V);
  const { X, Y } = base;

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
  planeEnd(ctx, P, C, base);
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

// ---------- field: one partial-sum path for every point z of a grid ----------
// m: { field, k (cursor), V (view of the sums), frame, opts, mode ("z" | "conv"), z (selected), hover, fmtC, dark }
const INSET = 96;
export function insetRect(W, H) {
  const P = plotRect(W, H),
    size = Math.min(INSET, (P.x1 - P.x0) * 0.32, (P.y1 - P.y0) * 0.4);
  return { x: P.x0 + 8, y: P.y0 + 24, size }; // under the "Im" label
}
const kShown = (m) => Math.max(0, Math.min(m.k, m.field.kDone));

// Colour of path c: hue = direction of z from the centre of the grid, or green/red = terms shrinking or not.
function pathColor(m, C, c) {
  const f = m.field;
  if (m.mode === "conv") {
    const s = f.shrinking(c, kShown(m));
    return s === null ? C.muted : s ? C.vel : C.force;
  }
  const dx = f.zRe[c] - f.grid.cx,
    dy = f.zIm[c] - f.grid.cy;
  if (Math.hypot(dx, dy) < 1e-12 * (1 + f.grid.r)) return C.ink;
  const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return `hsl(${hue.toFixed(0)} 80% ${m.dark ? 66 : 42}%)`;
}

// Fit: the view is decided by the paths whose terms are shrinking (when there are any), so diverging paths fly out
// of the frame instead of squashing the others into a dot; with none, by the closer half of the paths.
export function fitFieldView(m, P) {
  const f = m.field,
    kEnd = m.frame === "all" ? f.kDone : kShown(m);
  const radius = [],
    shrink = [];
  for (let c = 0; c < f.count; c++) {
    let mx = 0;
    const last = Math.min(kEnd, f.valid[c] - 1),
      o = c * f.grid.len;
    for (let q = 0; q <= last; q++) mx = Math.max(mx, Math.abs(f.sRe[o + q]), Math.abs(f.sIm[o + q]));
    radius.push(mx);
    shrink.push(f.shrinking(c, kEnd) === true);
  }
  let use = shrink;
  if (!shrink.some(Boolean)) {
    const cut = [...radius].sort((a, b) => a - b)[Math.floor(0.5 * (radius.length - 1))];
    use = radius.map((x) => x <= cut);
  }
  let a = 0,
    b = 0,
    c0 = 0,
    d = 0;
  for (let c = 0; c < f.count; c++) {
    if (!use[c]) continue;
    const last = Math.min(kEnd, f.valid[c] - 1),
      o = c * f.grid.len;
    for (let q = 0; q <= last; q++) {
      const x = f.sRe[o + q],
        y = f.sIm[o + q];
      if (x < a) a = x;
      if (x > b) b = x;
      if (y < c0) c0 = y;
      if (y > d) d = y;
    }
  }
  const pad = 30,
    pw = P.x1 - P.x0,
    ph = P.y1 - P.y0;
  let rw = b - a,
    rh = d - c0;
  if (rw === 0 && rh === 0) rw = rh = 1;
  m.V.s = Math.min((pw - 2 * pad) / Math.max(rw, 1e-300), (ph - 2 * pad) / Math.max(rh, 1e-300));
  m.V.cx = (a + b) / 2;
  m.V.cy = (c0 + d) / 2;
}

// Nearest path end S_k within `radius` px of (x, y), or -1.
export function fieldHit(m, W, H, x, y, radius = 14) {
  const P = plotRect(W, H),
    f = m.field,
    k = kShown(m),
    V = m.V;
  const mx = (P.x0 + P.x1) / 2,
    my = (P.y0 + P.y1) / 2;
  let best = -1,
    bd = radius * radius;
  for (let c = 0; c < f.count; c++) {
    const e = f.at(c, k);
    if (!e) continue;
    const dx = mx + (e[0] - V.cx) * V.s - x,
      dy = my - (e[1] - V.cy) * V.s - y,
      dd = dx * dx + dy * dy;
    if (dd < bd) (bd = dd), (best = c);
  }
  return best;
}
// The little map of the sample points: its cell under (x, y), or -1.
export function insetHit(m, W, H, x, y) {
  const R = insetRect(W, H),
    side = m.field.grid.side;
  if (x < R.x || y < R.y || x > R.x + R.size || y > R.y + R.size) return -2; // outside the map
  const cell = (R.size - 10) / side,
    i = Math.floor((x - R.x - 5) / cell),
    j = Math.floor((y - R.y - 5) / cell);
  return i >= 0 && i < side && j >= 0 && j < side ? j * side + i : -1;
}

export function drawField(ctx, W, H, C, m) {
  const P = plotRect(W, H),
    f = m.field,
    V = m.V,
    k = kShown(m);
  if (m.frame !== "free" && f.kDone >= 0) fitFieldView(m, P);
  const base = planeBase(ctx, P, C, V);
  const { X, Y } = base;
  const colors = Array.from({ length: f.count }, (_, c) => pathColor(m, C, c));
  const sel = (() => {
    for (let c = 0; c < f.count; c++) if (Math.abs(f.zRe[c] - m.z[0]) + Math.abs(f.zIm[c] - m.z[1]) < 1e-9 * (1 + f.grid.r)) return c;
    return -1;
  })();
  const ih = m.hover ? insetHit(m, W, H, m.hover.x, m.hover.y) : -2;
  const hov = ih >= 0 ? ih : ih === -2 && m.hover ? fieldHit(m, W, H, m.hover.x, m.hover.y) : -1;

  const trace = (c, width, alpha) => {
    const last = Math.min(k, f.valid[c] - 1),
      o = c * f.grid.len;
    if (last < 0) return;
    ctx.strokeStyle = colors[c];
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(X(f.sRe[o]), Y(f.sIm[o]));
    for (let q = 1; q <= last; q++) ctx.lineTo(X(f.sRe[o + q]), Y(f.sIm[o + q]));
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  if (f.kDone >= 0) {
    // paths whose terms do not shrink cannot converge: drawn faint and first, so the others stand out
    const faint = (c) => f.shrinking(c, k) === false;
    const order = [...Array(f.count).keys()].sort((a, b) => faint(b) - faint(a));
    if (m.opts.line) for (const c of order) if (c !== sel && c !== hov) trace(c, 1.25, faint(c) ? 0.2 : 0.8);
    if (m.opts.dots)
      for (const c of order) {
        const e = f.at(c, k);
        if (!e) continue;
        ctx.globalAlpha = faint(c) ? 0.35 : 1;
        ctx.fillStyle = colors[c];
        ctx.fillRect(X(e[0]) - 2, Y(e[1]) - 2, 4, 4);
      }
    ctx.globalAlpha = 1;
    for (const c of [sel, hov]) if (c >= 0) trace(c, 2.5, 1);
  }
  // the selected path ends in a square marker, like the S_n of the Plane view
  if (sel >= 0) {
    const e = f.at(sel, k);
    if (e) {
      ctx.fillStyle = colors[sel];
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.fillRect(X(e[0]) - 5, Y(e[1]) - 5, 10, 10);
      ctx.strokeRect(X(e[0]) - 5, Y(e[1]) - 5, 10, 10);
      text(ctx, `S_{${f.n0 + k}}`, X(e[0]) + 9, Y(e[1]) + 17, C, { color: C.ink, weight: 700, size: 12 });
    }
  }
  // hovered path: z and S_n
  if (hov >= 0) {
    const e = f.at(hov, k),
      lines = [`z = ${m.fmtC(f.zRe[hov], f.zIm[hov], 3)}`, e ? `S_{${f.n0 + k}} = ${m.fmtC(e[0], e[1], 3)}` : "S = —"];
    ctx.font = "11.5px " + '"Space Mono", ui-monospace, monospace';
    const w = Math.max(...lines.map((l) => ctx.measureText(l.replace(/[_{}]/g, "")).width)) + 14;
    let bx = m.hover.x + 14,
      by = m.hover.y + 14;
    if (bx + w > P.x1) bx = m.hover.x - w - 10;
    if (by + 40 > P.y1) by = m.hover.y - 46;
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, w, 40);
    ctx.strokeRect(bx, by, w, 40);
    drawMath(ctx, lines[0], bx + 7, by + 16, { size: 11.5, color: C.ink });
    drawMath(ctx, lines[1], bx + 7, by + 32, { size: 11.5, color: C.ink });
  }
  ctx.restore();
  planeEnd(ctx, P, C, base);

  // map of the sample points, coloured as the paths: tells which path starts from which z
  if (H > 260) {
    const R = insetRect(W, H),
      side = f.grid.side,
      cell = (R.size - 10) / side;
    ctx.fillStyle = C.surface;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.fillRect(R.x, R.y, R.size, R.size);
    ctx.strokeRect(R.x, R.y, R.size, R.size);
    for (let c = 0; c < f.count; c++) {
      const i = c % side,
        j = Math.floor(c / side);
      ctx.fillStyle = colors[c];
      ctx.fillRect(R.x + 5 + i * cell + 1, R.y + 5 + j * cell + 1, Math.max(2, cell - 2), Math.max(2, cell - 2));
    }
    for (const [c, w] of [[sel, 2], [hov, 1.5]])
      if (c >= 0) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = w;
        ctx.strokeRect(R.x + 5 + (c % side) * cell, R.y + 5 + Math.floor(c / side) * cell, cell, cell);
      }
    text(ctx, "z", R.x + R.size + 5, R.y + 12, C, { color: C.ink, weight: 700, size: 12 });
  }
}

// ---------- field, "map" kind: S_N(z) on a fine grid of z, as colours ----------
function rgbOf(hex, fallback = [128, 128, 128]) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12,
      a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
// mode "sum": domain colouring of S_N(z) (hue = argument, lightness = modulus);
// mode "term": |a_N(z)| on a log scale, from the surface colour (tiny term) to the force colour (large term).
export function paintMapImage(field, mode, C) {
  const { cols, rows } = field.geo;
  const cvs = document.createElement("canvas");
  cvs.width = cols;
  cvs.height = rows;
  const ctx = cvs.getContext("2d");
  const img = ctx.createImageData(cols, rows);
  const surf = rgbOf(C.surface),
    force = rgbOf(C.force),
    dead = rgbOf(C.ink);
  for (let c = 0; c < cols * rows; c++) {
    let rgb;
    if (Number.isNaN(field.sRe[c])) {
      rgb = [0, 1, 2].map((q) => (dead[q] + surf[q]) / 2); // not finite
    } else if (mode === "term") {
      const a = Math.hypot(field.aRe[c], field.aIm[c]);
      const v = a > 0 ? Math.min(1, Math.max(0, (Math.log10(a) + 10) / 10)) : 0;
      rgb = [0, 1, 2].map((q) => surf[q] + (force[q] - surf[q]) * v);
    } else {
      const m = Math.hypot(field.sRe[c], field.sIm[c]);
      const hue = (Math.atan2(field.sIm[c], field.sRe[c]) / (2 * Math.PI) + 1) % 1;
      rgb = hslToRgb(hue, 0.72, 0.2 + 0.62 * (m / (m + 1)));
    }
    img.data[4 * c] = rgb[0];
    img.data[4 * c + 1] = rgb[1];
    img.data[4 * c + 2] = rgb[2];
    img.data[4 * c + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: cvs, geo: field.geo };
}

// m: { F (window {cx, cy, s}), shown ({canvas, geo} | null), z (selected point), hover, field, fmtC, grid {cx, cy, r, side} }
export function drawMap(ctx, W, H, C, m) {
  const P = plotRect(W, H),
    V = m.F;
  const base = planeBase(ctx, P, C, V, (c, { X, Y }) => {
    const sh = m.shown;
    if (!sh) return;
    const g = sh.geo,
      w = g.cols * g.dx * V.s,
      h = g.rows * g.dx * V.s;
    c.imageSmoothingEnabled = false;
    c.drawImage(sh.canvas, X(g.cx) - w / 2, Y(g.cy) - h / 2, w, h);
  });
  const { X, Y } = base;
  // the window the paths are sampled from: dashed square and its sample points
  if (m.grid) {
    const g = m.grid,
      step = (2 * g.r) / (g.side - 1);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(X(g.cx - g.r), Y(g.cy + g.r), 2 * g.r * V.s, 2 * g.r * V.s);
    ctx.setLineDash([]);
    ctx.fillStyle = C.ink;
    for (let j = 0; j < g.side; j++)
      for (let i = 0; i < g.side; i++) ctx.fillRect(X(g.cx - g.r + i * step) - 1.5, Y(g.cy - g.r + j * step) - 1.5, 3, 3);
  }
  // selected z
  const zx = X(m.z[0]),
    zy = Y(m.z[1]);
  ctx.strokeStyle = C.surface;
  ctx.lineWidth = 4;
  ctx.strokeRect(zx - 6, zy - 6, 12, 12);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(zx - 6, zy - 6, 12, 12);
  text(ctx, "z", zx + 10, zy - 8, C, { color: C.ink, weight: 700, size: 12 });
  // hovered cell: its z and S_N(z)
  if (m.hover && m.field && m.shown) {
    const f = m.field,
      g = m.shown.geo,
      re = V.cx + (m.hover.x - (P.x0 + P.x1) / 2) / V.s,
      im = V.cy - (m.hover.y - (P.y0 + P.y1) / 2) / V.s;
    const i0 = Math.round((re - g.cx) / g.dx + (g.cols - 1) / 2),
      j0 = Math.round((g.cy - im) / g.dx + (g.rows - 1) / 2);
    if (i0 >= 0 && i0 < g.cols && j0 >= 0 && j0 < g.rows) {
      const i = j0 * g.cols + i0;
      const z = [g.cx + (i0 - (g.cols - 1) / 2) * g.dx, g.cy - (j0 - (g.rows - 1) / 2) * g.dx];
      const ok = f.geo === g && !Number.isNaN(f.sRe[i]);
      const lines = [`z = ${m.fmtC(z[0], z[1], 3)}`, ok ? `S_{${f.n0 + f.kDone}} = ${m.fmtC(f.sRe[i], f.sIm[i], 3)}` : "S = —"];
      ctx.font = "11.5px " + '"Space Mono", ui-monospace, monospace';
      const w = Math.max(...lines.map((l) => ctx.measureText(l.replace(/[_{}]/g, "")).width)) + 14;
      let bx = m.hover.x + 14,
        by = m.hover.y + 14;
      if (bx + w > P.x1) bx = m.hover.x - w - 10;
      if (by + 40 > P.y1) by = m.hover.y - 46;
      ctx.fillStyle = C.surface;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.fillRect(bx, by, w, 40);
      ctx.strokeRect(bx, by, w, 40);
      drawMath(ctx, lines[0], bx + 7, by + 16, { size: 11.5, color: C.ink });
      drawMath(ctx, lines[1], bx + 7, by + 32, { size: 11.5, color: C.ink });
    }
  }
  planeEnd(ctx, P, C, base);
}
