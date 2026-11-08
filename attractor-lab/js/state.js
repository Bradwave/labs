// Shared state and view geometry. Frame = unit square [0,1]² (y down); maps live in these coordinates.
export const PALETTE = ['#FF6A3D', '#2350D8', '#0F9A63', '#B42BA0', '#6E3FE0', '#E9A92A', '#E2412A', '#1AA7D1'];
export const LIMIT = 40e6;
export const RATES = { slow: 3, med: 12, fast: 60 };
export const MAX_MAPS = 12;

export const S = {
  maps: [], sel: 0,
  view: { cx: 0.5, cy: 0.5, z: 1 },
  size: { w: 600, h: 600 },
  o: {
    points: 200000, alpha: 0.35, burn: 20, color: 'ink', night: false,
    maps: true, glyph: true, frame: true,
    method: 'chaos', rate: 'max', level: 3, seed: 'F',
  },
  playing: false, live: true, total: 0,
  dots: [], flash: null, trace: null,
  target: null, ghost: true, score: null,
  ovDirty: true,
};

// callbacks installed by main.js
export const H = {};

export const baseCss = () => 0.84 * Math.min(S.size.w, S.size.h);
export const kCss = () => baseCss() * S.view.z;
export function toScreen(x, y) {
  const k = kCss();
  return [(x - S.view.cx) * k + S.size.w / 2, (y - S.view.cy) * k + S.size.h / 2];
}
export function toWorld(px, py) {
  const k = kCss();
  return [(px - S.size.w / 2) / k + S.view.cx, (py - S.size.h / 2) / k + S.view.cy];
}
