/* Canvas helpers shared by the track and the graphs */
import { num } from './i18n.js';

export const FONT = '"Space Mono",ui-monospace,Menlo,Consolas,monospace';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let _C = null;
const KEYS = ['bg', 'surface', 'ink', 'muted', 'accent', 'onaccent', 'gridline', 'tile2', 'cs', 'cv', 'ca', 'neg', 'over', 'under', 'err', 'warn', 'target', 'hatch'];
export function C() {
  if (_C) return _C;
  const st = getComputedStyle(document.documentElement);
  _C = {}; for (const k of KEYS) _C[k] = st.getPropertyValue('--' + k).trim() || '#000';
  return _C;
}
export function resetColors() { _C = null; }

export function fit(cv) {
  const w = Math.max(40, cv.clientWidth), h = Math.max(30, cv.clientHeight), d = Math.min(window.devicePixelRatio || 1, 2.5);
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  return { ctx, w, h };
}

export function niceTicks(a, b, n) {
  const range = b - a; if (!(range > 0)) return [a];
  const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + s * 1e-9; v += s) out.push(Math.abs(v) < s * 1e-9 ? 0 : v);
  return out;
}
export function niceRange(lo, hi, padFrac = 0.1, minSpan = 1, withZero = true) {
  if (withZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  let span = hi - lo;
  if (span < minSpan) { const c = (hi + lo) / 2; lo = c - minSpan / 2; hi = c + minSpan / 2; span = minSpan; }
  return [lo - span * padFrac, hi + span * padFrac];
}

export function label(ctx, txt, x, y, color, align = 'left', size = 11, halo = true) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (halo) { ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C().surface; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.restore();
}

export function arrow(ctx, x0, y0, x1, y1, col, w = 3, o = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 2) return;
  const ux = dx / L, uy = dy / L, hl = Math.min(9 + w, L * 0.6), hw = hl * 0.55, bx = x1 - ux * hl, by = y1 - uy * hl;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx - uy * hw, by + ux * hw); ctx.lineTo(bx + uy * hw, by - ux * hw); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function hatch(ctx, x, y, w, h, col, step = 7) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let k = x - h; k < x + w; k += step) { ctx.moveTo(k, y + h); ctx.lineTo(k + h, y); }
  ctx.stroke(); ctx.restore();
}

export class Plot {
  constructor(cv, m) { this.cv = cv; this.m = Object.assign({ l: 40, r: 14, t: 22, b: 20 }, m || {}); }
  begin() {
    const f = fit(this.cv); this.ctx = f.ctx; this.w = f.w; this.h = f.h;
    this.x0 = this.m.l; this.x1 = this.w - this.m.r; this.y0 = this.h - this.m.b; this.y1 = this.m.t;
    this.ctx.clearRect(0, 0, this.w, this.h); return this.ctx;
  }
  range(xa, xb, ya, yb) { this.xa = xa; this.xb = xb; this.ya = ya; this.yb = yb; }
  X(v) { return this.x0 + (v - this.xa) / (this.xb - this.xa) * (this.x1 - this.x0); }
  Y(v) { return this.y0 + (v - this.ya) / (this.yb - this.ya) * (this.y1 - this.y0); }
  invX(px) { return this.xa + (px - this.x0) / (this.x1 - this.x0) * (this.xb - this.xa); }
  invY(py) { return this.ya + (py - this.y0) / (this.y1 - this.y0) * (this.yb - this.ya); }
  Yc(v) { return clamp(this.Y(v), this.y1 - 4000, this.y0 + 4000); }
  grid(o) {
    const c = this.ctx, col = C();
    c.save(); c.fillStyle = col.surface; c.fillRect(0, 0, this.w, this.h);
    const xt = niceTicks(this.xa, this.xb, Math.max(3, Math.floor((this.x1 - this.x0) / 72)));
    const yt = niceTicks(this.ya, this.yb, Math.max(2, Math.floor((this.y0 - this.y1) / 34)));
    c.lineWidth = 1; c.strokeStyle = col.gridline; c.beginPath();
    for (const v of xt) { const x = Math.round(this.X(v)) + 0.5; c.moveTo(x, this.y1); c.lineTo(x, this.y0); }
    for (const v of yt) { const y = Math.round(this.Y(v)) + 0.5; c.moveTo(this.x0, y); c.lineTo(this.x1, y); }
    c.stroke();
    // the time axis is the zero line, with its arrow; the bottom edge only carries the time labels
    const ya = Math.round(Math.min(this.y0, Math.max(this.y1, this.Y(0)))) + 0.5;
    c.strokeStyle = col.ink; c.lineWidth = 2; c.beginPath();
    c.moveTo(this.x0, ya); c.lineTo(this.x1 + 8, ya);
    c.moveTo(this.x0 + 0.5, this.y1 - 8); c.lineTo(this.x0 + 0.5, this.y0 + 0.5); c.stroke();
    c.lineWidth = 1.5; c.beginPath();
    for (const v of xt) { const x = Math.round(this.X(v)) + 0.5; if (x > this.x0 + 2 && x < this.x1 + 2) { c.moveTo(x, ya - 3); c.lineTo(x, ya + 3); } }
    c.stroke();
    c.fillStyle = col.ink; c.beginPath();
    c.moveTo(this.x0 + 0.5, this.y1 - 14); c.lineTo(this.x0 - 4, this.y1 - 6); c.lineTo(this.x0 + 5, this.y1 - 6); c.closePath();
    c.moveTo(this.x1 + 14, ya); c.lineTo(this.x1 + 6, ya - 4.5); c.lineTo(this.x1 + 6, ya + 4.5); c.closePath(); c.fill();
    c.font = `10.5px ${FONT}`; c.fillStyle = col.muted; c.textAlign = 'center'; c.textBaseline = 'top';
    if (o.xticks !== false) for (const v of xt) { const x = this.X(v); if (x > this.x0 - 2 && x < this.x1 + 2) c.fillText(num(v, 3), x, this.y0 + 5); }
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const v of yt) { const y = this.Y(v); if (y > this.y1 - 4 && y < this.y0 + 4) c.fillText(num(v, 3), this.x0 - 6, y); }
    c.restore();
    // labels at the arrow tips: the quantity on top of the vertical axis, t at the end of the time axis
    if (o.xl) label(c, o.xl, this.x1 + 14, ya - 7, col.ink, 'right', 10.5);
    if (o.yl) label(c, o.yl, this.x0 + 9, this.y1 - 7, o.ycol || col.ink, 'left', 11.5);
  }
  /* width of the widest tick label for a given range: graphs share it so their time axes line up */
  tickWidth(lo, hi) {
    const ctx = this.cv.getContext('2d'), h = Math.max(30, this.cv.clientHeight - this.m.t - this.m.b);
    ctx.save(); ctx.font = `10.5px ${FONT}`;
    const w = Math.max(...niceTicks(lo, hi, Math.max(2, Math.floor(h / 34))).map(v => ctx.measureText(num(v, 3)).width));
    ctx.restore(); return w;
  }
  clipOn() { const c = this.ctx; c.save(); c.beginPath(); c.rect(this.x0, this.y1 - 2, this.x1 - this.x0 + 2, this.y0 - this.y1 + 4); c.clip(); }
  clipOff() { this.ctx.restore(); }
  path(ts, ys, from = 0, to = ts.length) {
    const c = this.ctx; let pen = false;
    for (let i = from; i < to; i++) {
      const y = ys[i];
      if (!isFinite(y)) { pen = false; continue; }
      const X = this.X(ts[i]), Y = this.Yc(y);
      if (pen) c.lineTo(X, Y); else { c.moveTo(X, Y); pen = true; }
    }
  }
  line(ts, ys, color, lw = 2.5, dash) {
    const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
    if (dash) c.setLineDash(dash);
    c.beginPath(); this.path(ts, ys); c.stroke(); c.restore();
  }
  seg(xa, ya, xb, yb, color, lw = 2, dash) {
    const c = this.ctx; c.save(); c.strokeStyle = color; c.lineWidth = lw; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(this.X(xa), this.Yc(ya)); c.lineTo(this.X(xb), this.Yc(yb)); c.stroke(); c.restore();
  }
  dot(x, y, color, r = 4.5, hollow = false) {
    const c = this.ctx; c.save(); c.fillStyle = hollow ? C().surface : color; c.strokeStyle = hollow ? color : C().ink; c.lineWidth = hollow ? 2 : 1.5;
    c.beginPath(); c.arc(this.X(x), this.Yc(y), r, 0, 7); c.fill(); c.stroke(); c.restore();
  }
}
