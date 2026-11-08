// Collage challenge: compare the attractor of the user's maps with a target on a coarse occupancy grid.
import { S } from './state.js';
import { linear, fromPreset, PRESETS } from './ifs.js';

export const G = 64, X0 = -0.25, SPAN = 1.5;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function occupancy(maps, n = 120000) {
  const cells = new Uint8Array(G * G), total = maps.reduce((s, m) => s + m.p, 0);
  if (!maps.length || !(total > 0)) return cells;
  const T = maps.map(linear), cum = []; let s = 0;
  for (const m of maps) { s += m.p / total; cum.push(s); }
  cum[cum.length - 1] = 2;
  const rand = rng(12345), sc = G / SPAN;
  let x = 0.5, y = 0.5;
  for (let i = 0; i < n + 20; i++) {
    const r = rand(); let j = 0;
    while (r >= cum[j]) j++;
    const t = T[j], nx = t.a * x + t.b * y + t.e; y = t.c * x + t.d * y + t.f; x = nx;
    if (!(x > -1e4 && x < 1e4 && y > -1e4 && y < 1e4)) { x = y = 0.5; continue; }
    if (i < 20) continue;
    const gx = Math.floor((x - X0) * sc), gy = Math.floor((y - X0) * sc);
    if (gx >= 0 && gx < G && gy >= 0 && gy < G) cells[gy * G + gx] = 1;
  }
  return cells;
}

export function setTarget(key) {
  if (!key) { S.target = null; S.score = null; S.ovDirty = true; return; }
  const maps = fromPreset(key), grid = occupancy(maps), cells = [];
  grid.forEach((v, i) => v && cells.push(i));
  S.target = { key, name: PRESETS.find(p => p.key === key).name, n: maps.length, grid, cells };
  updateScore();
}

export function updateScore() {
  if (!S.target) { S.score = null; return; }
  const cur = occupancy(S.maps), t = S.target.grid;
  let inter = 0, union = 0;
  for (let i = 0; i < cur.length; i++) { if (cur[i] && t[i]) inter++; if (cur[i] || t[i]) union++; }
  S.score = union ? (100 * inter) / union : 0;
}

export function targetBounds() {
  if (!S.target || !S.target.cells.length) return null;
  let x0 = G, x1 = 0, y0 = G, y1 = 0;
  for (const i of S.target.cells) {
    const x = i % G, y = Math.floor(i / G);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const c = SPAN / G;
  return { x0: X0 + x0 * c, x1: X0 + (x1 + 1) * c, y0: X0 + y0 * c, y1: X0 + (y1 + 1) * c };
}
