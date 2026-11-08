// Map maths, analysis, presets and (de)serialisation.
import { PALETTE, MAX_MAPS } from './state.js';

export function newMap(i, o = {}) {
  return Object.assign({ x: 0.25, y: 0.25, w: 0.5, h: 0.5, rot: 0, p: 1, fx: false, fy: false, color: PALETTE[i % PALETTE.length] }, o);
}

// A map sends the frame onto a (rotated, optionally mirrored) rectangle: p' = centre + R·diag(sx,sy)·(p − ½)
export function linear(m) {
  const c = Math.cos(m.rot), s = Math.sin(m.rot);
  const sx = m.w * (m.fx ? -1 : 1), sy = m.h * (m.fy ? -1 : 1);
  const a = c * sx, b = -s * sy, cc = s * sx, d = c * sy;
  return { a, b, c: cc, d, e: m.x + m.w / 2 - 0.5 * (a + b), f: m.y + m.h / 2 - 0.5 * (cc + d) };
}

// The same map in school coordinates: frame = [−1,1]², y up
export function mathMatrix(T) {
  return { A: T.a, B: -T.b, C: -T.c, D: T.d, E: T.a + T.b + 2 * T.e - 1, F: 1 - T.c - T.d - 2 * T.f };
}

export function svals(T) {
  const s1 = T.a * T.a + T.b * T.b + T.c * T.c + T.d * T.d, det = T.a * T.d - T.b * T.c;
  const disc = Math.sqrt(Math.max(0, s1 * s1 - 4 * det * det));
  return { max: Math.sqrt((s1 + disc) / 2), min: Math.sqrt(Math.max(0, (s1 - disc) / 2)), det };
}

export function analyze(maps) {
  const per = maps.map(m => {
    const sv = svals(linear(m));
    return { max: sv.max, min: sv.min, r: Math.sqrt(Math.abs(sv.det)), similar: sv.max < 1e-9 || sv.min / sv.max > 0.98 };
  });
  const sumP = maps.reduce((s, m) => s + m.p, 0);
  const expanding = per.map((q, i) => (q.max >= 1 ? i : -1)).filter(i => i >= 0);
  let dim = null;
  if (maps.length && !expanding.length) {
    if (maps.length === 1) dim = 0;
    else {
      let lo = 0, hi = 8;
      for (let it = 0; it < 50; it++) {
        const mid = (lo + hi) / 2;
        const f = per.reduce((s, q) => s + Math.pow(q.r, mid), 0);
        if (f > 1) lo = mid; else hi = mid;
      }
      dim = (lo + hi) / 2;
    }
  }
  return { per, sumP, expanding, dim, exact: per.every(q => q.similar) };
}

const hexCache = {};
export function rgbOf(hex) {
  if (hexCache[hex]) return hexCache[hex];
  const h = hex.replace('#', '');
  return (hexCache[hex] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
}

// ---- presets -------------------------------------------------------------
const r6 = (x, y, w, h, rot, p) => ({ x: x / 600, y: y / 600, w: w / 600, h: h / 600, rot, p, fx: false, fy: false });
// z ↦ λe^{iθ}·z + t on a curve drawn from 0 to 1 on the real axis (frame centred on its midpoint)
function cmap(lam, th, tgx, tgy, p) {
  const tx = 0.5 * lam * Math.cos(th) + tgx - 0.5, ty = 0.5 * lam * Math.sin(th) + tgy;
  return { x: 0.5 + tx - lam / 2, y: 0.5 - ty - lam / 2, w: lam, h: lam, rot: -th, p, fx: false, fy: false };
}
const sq = (x, y, s, p) => ({ x, y, w: s, h: s, rot: 0, p, fx: false, fy: false });
const D = Math.PI / 180;

function grid(skip, n, s) {
  const out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (!skip(i, j)) out.push(sq(i * s, j * s, s, 1));
  return out;
}
function pentagon() {
  const r = 0.382, out = [];
  for (let k = 0; k < 5; k++) {
    const a = (2 * Math.PI * k) / 5, vx = 0.5 * Math.sin(a), vy = 0.5 * Math.cos(a);
    out.push(sq(0.5 + (1 - r) * vx - r / 2, 0.5 - (1 - r) * vy - r / 2, r, 0.2));
  }
  return out;
}
const S3 = Math.sqrt(3) / 6, L2 = Math.SQRT1_2;

export const PRESETS = [
  { key: 'sierpinski', name: 'Gasket', blurb: 'Three maps, each halving the frame. Similarity dimension log 3 / log 2 ≈ 1.585: more than a line, less than a plane.',
    maps: [r6(0, 0, 300, 300, 0, 1), r6(300, 0, 300, 300, 0, 1), r6(150, 300, 300, 300, 0, 1)] },
  { key: 'carpet', name: 'Carpet', blurb: 'Eight maps at ⅓ scale: a 3×3 grid without its centre. Dimension log 8 / log 3 ≈ 1.893.',
    maps: grid((i, j) => i === 1 && j === 1, 3, 1 / 3) },
  { key: 'vicsek', name: 'Vicsek', blurb: 'Four corners and the centre, ⅓ scale. Dimension log 5 / log 3 ≈ 1.465.',
    maps: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]].map(([i, j]) => sq(i / 3, j / 3, 1 / 3, 1)) },
  { key: 'pentagon', name: 'Pentagon', blurb: 'Five maps at scale 0.382 (1/φ²), one per vertex of a pentagon. Dimension ≈ 1.672.', maps: pentagon() },
  { key: 'cantor', name: 'Cantor', blurb: 'Two maps at ⅓ scale on one row: a Cantor set. Dimension log 2 / log 3 ≈ 0.631, so it is "dust", thinner than a line.',
    maps: [r6(0, 200, 200, 200, 0, 1), r6(400, 200, 200, 200, 0, 1)] },
  { key: 'koch', name: 'Koch', blurb: 'Four maps at ⅓ scale; two are rotated ±60°. Dimension log 4 / log 3 ≈ 1.262. Try the Levels method to watch the bump grow.',
    maps: [cmap(1 / 3, 0, 0, 0, 1), cmap(1 / 3, 60 * D, 1 / 3, 0, 1), cmap(1 / 3, -60 * D, 0.5, S3, 1), cmap(1 / 3, 0, 2 / 3, 0, 1)] },
  { key: 'levy', name: 'Lévy C', blurb: 'Two maps at scale 1/√2, rotated ±45°. Dimension 2: this curve covers regions of the plane.',
    maps: [cmap(L2, 45 * D, 0, 0, 1), cmap(L2, -45 * D, 0.5, 0.5, 1)] },
  { key: 'dragon', name: 'Dragon', blurb: 'The Heighway dragon: two maps at scale 1/√2, rotated 45° and 135°. Dimension 2, and it tiles the plane.',
    maps: [cmap(L2, 45 * D, 0, 0, 1), cmap(L2, 135 * D, 1, 0, 1)] },
  { key: 'barnsley', name: 'Fern', blurb: 'Four non-uniform maps. The big stretch map gets p = 0.85, the two leaflets 0.07 each, the stem 0.01. Weights matter: try changing them.',
    maps: [r6(295, 504, 10, 96, 0, 0.01), r6(45, 285, 510, 510, 0.03, 0.85), r6(200, 200, 150, 150, 0.85, 0.07), r6(250, 350, 150, 150, -0.85, 0.07)] },
  { key: 'tree', name: 'Tree', blurb: 'A trunk, two rotated branches and a canopy. The branch maps are rotations of the whole picture by ±0.4 rad.',
    maps: [r6(290, 480, 20, 120, 0, 0.05), r6(180, 280, 240, 240, -0.4, 0.4), r6(180, 280, 240, 240, 0.4, 0.4), r6(250, 150, 100, 100, 0, 0.15)] },
  { key: 'spiral', name: 'Spiral', blurb: 'One map that shrinks and rotates a little, plus a tiny seed map. The frame is swirled into itself again and again.',
    maps: [r6(30, 30, 540, 540, 0.15, 0.92), r6(250, 250, 100, 100, 0, 0.08)] },
  { key: 'crystal', name: 'Crystal', blurb: 'Four copies of the same map rotated by 90°: the attractor has four-fold symmetry.',
    maps: [0, 1, 2, 3].map(k => r6(100, 100, 400, 400, (k * Math.PI) / 2, 0.25)) },
];

export function fromPreset(key) {
  const p = PRESETS.find(q => q.key === key);
  return p.maps.map((m, i) => newMap(i, m));
}

export function randomMaps() {
  const n = 2 + Math.floor(Math.random() * 4), out = [];
  for (let i = 0; i < n; i++) {
    const s = 0.35 + Math.random() * 0.3, cx = 0.2 + Math.random() * 0.6, cy = 0.2 + Math.random() * 0.6;
    out.push(newMap(i, { x: cx - s / 2, y: cy - s / 2, w: s, h: s * (0.7 + Math.random() * 0.4), rot: (Math.random() * 2 - 1) * Math.PI, p: 1, fx: Math.random() < 0.25 }));
  }
  return out;
}

export function equalWeights(maps) { maps.forEach(m => (m.p = 1 / maps.length)); }
export function normalizeWeights(maps) {
  const s = maps.reduce((a, m) => a + m.p, 0);
  if (s > 0) maps.forEach(m => (m.p /= s)); else equalWeights(maps);
}
export function areaWeights(maps) {
  const a = maps.map(m => Math.abs(svals(linear(m)).det));
  const s = a.reduce((x, y) => x + y, 0);
  maps.forEach((m, i) => (m.p = s > 0 ? a[i] / s : 1 / maps.length));
}

// ---- files and links -----------------------------------------------------
export function toJSON(maps) {
  return maps.map(m => ({ x: m.x * 600, y: m.y * 600, width: m.w * 600, height: m.h * 600, rotation: m.rot, p: m.p, color: m.color, flipX: m.fx, flipY: m.fy }));
}
export function fromJSON(arr) {
  if (!Array.isArray(arr) || !arr.length || arr.length > MAX_MAPS) throw new Error('bad file');
  return arr.map((r, i) => {
    if (![r.x, r.y, r.width, r.height, r.rotation, r.p].every(Number.isFinite)) throw new Error('bad map');
    return newMap(i, {
      x: r.x / 600, y: r.y / 600, w: Math.max(0.02, r.width / 600), h: Math.max(0.02, r.height / 600), rot: r.rotation, p: Math.max(0, r.p),
      fx: !!r.flipX, fy: !!r.flipY, color: /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : PALETTE[i % PALETTE.length],
    });
  });
}
export function encodeHash(maps) {
  const rows = maps.map(m => [m.x, m.y, m.w, m.h, m.rot, m.p].map(v => +v.toFixed(4)).concat([m.fx ? 1 : 0, m.fy ? 1 : 0, m.color.slice(1)]));
  return 'm=' + btoa(JSON.stringify(rows));
}
export function decodeHash(hash) {
  const m = /^#?m=([A-Za-z0-9+/=]+)$/.exec(hash);
  if (!m) return null;
  try {
    const rows = JSON.parse(atob(m[1]));
    if (!Array.isArray(rows) || !rows.length || rows.length > MAX_MAPS) return null;
    return rows.map((r, i) => {
      if (!r.slice(0, 6).every(Number.isFinite)) throw new Error();
      return newMap(i, { x: r[0], y: r[1], w: Math.max(0.02, r[2]), h: Math.max(0.02, r[3]), rot: r[4], p: Math.max(0, r[5]), fx: !!r[6], fy: !!r[7], color: /^[0-9a-f]{6}$/i.test(r[8]) ? '#' + r[8] : PALETTE[i % PALETTE.length] });
    });
  } catch (e) { return null; }
}
