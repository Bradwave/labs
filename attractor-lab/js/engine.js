// Chaos-game accumulation buffer, tone-mapped presentation, and level-by-level (Hutchinson) drawing.
import { S, kCss } from './state.js';
import { linear, rgbOf } from './ifs.js';

export const B = {
  W: 0, H: 0, q: 1, ctx: null, cnt: null, rgb: null, img: null, u32: null,
  x: 0.5, y: 0.5, cr: 128, cg: 128, cb: 128, burnLeft: 0, dirty: true, lut: new Float32Array(4096),
};

export const SEEDS = {
  square: [[0, 0], [1, 0], [1, 1], [0, 1]],
  triangle: [[0.5, 0.04], [0.96, 0.96], [0.04, 0.96]],
  F: [[0.25, 0.1], [0.8, 0.1], [0.8, 0.3], [0.45, 0.3], [0.45, 0.45], [0.7, 0.45], [0.7, 0.62], [0.45, 0.62], [0.45, 0.9], [0.25, 0.9]],
};
const SEED_PATHS = {};
for (const k in SEEDS) {
  const p = new Path2D();
  SEEDS[k].forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  SEED_PATHS[k] = p;
}

// ---- colours of the current canvas ------------------------------------------
let C = null;
export function refreshColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  C = S.o.night
    ? { bg: '#0B1226', ink: '#E8F1FF', muted: '#9BB0CF', accent: g('--accent') }
    : { bg: g('--surface'), ink: g('--ink'), muted: g('--muted'), accent: g('--accent') };
  B.dirty = true; S.ovDirty = true;
}
export const colors = () => C || (refreshColors(), C);

// ---- buffers -------------------------------------------------------------------
export function alloc(cssW, cssH, ctx) {
  let q = Math.min(window.devicePixelRatio || 1, 2);
  while (cssW * q * cssH * q > 1.8e6 && q > 0.5) q *= 0.9;
  B.q = q; B.ctx = ctx;
  B.W = Math.max(1, Math.round(cssW * q)); B.H = Math.max(1, Math.round(cssH * q));
  const n = B.W * B.H;
  B.cnt = new Uint32Array(n);
  B.rgb = S.o.color === 'ink' ? null : new Float32Array(n * 3);
  B.img = new ImageData(B.W, B.H);
  B.u32 = new Uint32Array(B.img.data.buffer);
  B.dirty = true;
}
export function ensureColorBuffer() {
  if (S.o.color !== 'ink' && !B.rgb) B.rgb = new Float32Array(B.W * B.H * 3);
}
export function clearBuf() {
  B.cnt.fill(0);
  if (B.rgb) B.rgb.fill(0);
  B.x = B.y = 0.5; B.cr = B.cg = B.cb = 128;
  B.burnLeft = S.o.burn;
  S.total = 0; S.dots.length = 0; S.flash = null; S.trace = null;
  B.dirty = true; S.ovDirty = true;
}

function compile() {
  const total = S.maps.reduce((s, m) => s + m.p, 0);
  if (!S.maps.length || !(total > 0)) return null;
  const T = S.maps.map(m => { const t = linear(m), c = rgbOf(m.color); t.r = c[0]; t.g = c[1]; t.bl = c[2]; return t; });
  const cum = []; let s = 0;
  for (const m of S.maps) { s += m.p / total; cum.push(s); }
  cum[cum.length - 1] = 2;
  return { T, cum };
}

function plot(x, y, t, k, vx, vy) {
  const fx = (x - vx) * k + B.W / 2, fy = (y - vy) * k + B.H / 2;
  if (fx < 0 || fx >= B.W || fy < 0 || fy >= B.H) return;
  const idx = ((fy | 0) * B.W) + (fx | 0);
  B.cnt[idx]++;
  if (B.rgb && S.o.color !== 'ink') {
    const o = idx * 3, bl = S.o.color === 'blend';
    B.rgb[o] += bl ? B.cr : t.r; B.rgb[o + 1] += bl ? B.cg : t.g; B.rgb[o + 2] += bl ? B.cb : t.bl;
  }
}

export function runBatch(n) {
  const m = compile();
  if (!m) return;
  const { T, cum } = m, last = T.length - 1;
  const k = kCss() * B.q, vx = S.view.cx, vy = S.view.cy, hw = B.W / 2, hh = B.H / 2, W = B.W, H = B.H;
  const mode = S.o.color, blend = mode === 'blend', col = mode !== 'ink' && B.rgb, cnt = B.cnt, rgb = B.rgb;
  const burn = B.burnLeft;
  let x = B.x, y = B.y, cr = B.cr, cg = B.cg, cb = B.cb;
  for (let i = 0; i < n + burn; i++) {
    const r = Math.random(); let j = 0;
    while (r >= cum[j]) j++;
    const t = T[j], nx = t.a * x + t.b * y + t.e; y = t.c * x + t.d * y + t.f; x = nx;
    if (!(x > -1e4 && x < 1e4 && y > -1e4 && y < 1e4)) { x = y = 0.5; continue; }
    if (blend) { cr = (cr + t.r) * 0.5; cg = (cg + t.g) * 0.5; cb = (cb + t.bl) * 0.5; }
    if (i < burn) continue;
    const fx = (x - vx) * k + hw, fy = (y - vy) * k + hh;
    if (fx < 0 || fx >= W || fy < 0 || fy >= H) continue;
    const idx = ((fy | 0) * W) + (fx | 0);
    cnt[idx]++;
    if (col) {
      const o = idx * 3;
      if (blend) { rgb[o] += cr; rgb[o + 1] += cg; rgb[o + 2] += cb; } else { rgb[o] += t.r; rgb[o + 1] += t.g; rgb[o + 2] += t.bl; }
    }
  }
  B.x = x; B.y = y; B.cr = cr; B.cg = cg; B.cb = cb; B.burnLeft = 0;
  S.total += n; B.dirty = true;
}

// One visible step of the chaos game for the slow-motion trace.
export function traceStep() {
  const m = compile();
  if (!m) return;
  const { T, cum } = m, roll = Math.random();
  let j = 0;
  while (roll >= cum[j]) j++;
  const t = T[j], from = { x: B.x, y: B.y };
  let x = t.a * B.x + t.b * B.y + t.e, y = t.c * B.x + t.d * B.y + t.f;
  if (!(x > -1e4 && x < 1e4 && y > -1e4 && y < 1e4)) { x = y = 0.5; }
  B.x = x; B.y = y;
  if (S.o.color === 'blend') { B.cr = (B.cr + t.r) * 0.5; B.cg = (B.cg + t.g) * 0.5; B.cb = (B.cb + t.bl) * 0.5; }
  const burning = B.burnLeft > 0;
  if (burning) B.burnLeft--;
  else { plot(x, y, t, kCss() * B.q, S.view.cx, S.view.cy); S.total++; B.dirty = true; }
  S.dots.push({ x, y, j, burning });
  if (S.dots.length > 4000) S.dots.shift();
  S.trace = { from, to: { x, y }, roll, j, burning };
  S.flash = { j, t: performance.now() };
  S.ovDirty = true;
}

// ---- presentation ---------------------------------------------------------------
export function present() {
  const { bg, ink } = colors(), b = rgbOf(bg), f = rgbOf(ink);
  const n = B.W * B.H, cnt = B.cnt, u32 = B.u32, rgb = B.rgb, lut = B.lut, LN = lut.length;
  const la = Math.log(1 - Math.min(S.o.alpha, 0.999));
  for (let i = 0; i < LN; i++) lut[i] = 1 - Math.exp(la * i);
  const colored = S.o.color !== 'ink' && rgb;
  const bgp = (0xff000000 | (b[2] << 16) | (b[1] << 8) | b[0]) >>> 0;
  for (let i = 0; i < n; i++) {
    const c = cnt[i];
    if (!c) { u32[i] = bgp; continue; }
    const I = c < LN ? lut[c] : 1;
    let r = f[0], g = f[1], bl = f[2];
    if (colored) { const s = 1 / c, o = i * 3; r = rgb[o] * s; g = rgb[o + 1] * s; bl = rgb[o + 2] * s; }
    u32[i] = (0xff000000 | (((b[2] + (bl - b[2]) * I) | 0) << 16) | (((b[1] + (g - b[1]) * I) | 0) << 8) | ((b[0] + (r - b[0]) * I) | 0)) >>> 0;
  }
  B.ctx.putImageData(B.img, 0, 0);
  B.dirty = false;
}

// ---- levels: image of a seed under every composition of `level` maps ----------------
export const LEAF_CAP = 70000;
export function maxLevel() {
  const n = S.maps.length;
  if (n < 2) return n ? 10 : 0;
  return Math.max(0, Math.floor(Math.log(LEAF_CAP) / Math.log(n)));
}
export function drawLevels() {
  const { bg, ink } = colors(), ctx = B.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fillRect(0, 0, B.W, B.H);
  if (!S.maps.length) { B.dirty = false; return; }
  const k = kCss() * B.q, Ts = S.maps.map(linear), L = Math.min(S.o.level, maxLevel()), path = SEED_PATHS[S.o.seed];
  const colored = S.o.color !== 'ink', n = Ts.length;
  ctx.globalAlpha = 0.85; ctx.fillStyle = ink;
  const rec = (d, a, b, c, dd, e, f, top) => {
    if (d === L) { ctx.setTransform(a, c, b, dd, e, f); ctx.fill(path); return; }
    for (let j = 0; j < n; j++) {
      const t = Ts[j];
      if (d === 0 && colored) ctx.fillStyle = S.maps[j].color;
      rec(d + 1, a * t.a + b * t.c, a * t.b + b * t.d, c * t.a + dd * t.c, c * t.b + dd * t.d, a * t.e + b * t.f + e, c * t.e + dd * t.f + f, d === 0 ? j : top);
    }
  };
  rec(0, k, 0, 0, k, B.W / 2 - S.view.cx * k, B.H / 2 - S.view.cy * k, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  B.dirty = false;
}
