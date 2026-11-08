// Relative Motion Lab: Fitting the view to the motion and sizing the panels.
import { len } from "./vec.js";
import { kin, rotating } from "./motion.js";
import { ui, st } from "./state.js";
import { pan, vec, gph, sizeCanvas, mapPtoS } from "./canvas.js";

export const bb = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export const addP = (b, p) => {
  if (!isFinite(p[0]) || !isFinite(p[1])) return;
  b.x0 = Math.min(b.x0, p[0]);
  b.x1 = Math.max(b.x1, p[0]);
  b.y0 = Math.min(b.y0, p[1]);
  b.y1 = Math.max(b.y1, p[1]);
};
export function bodyPts(b) {
  return b.type === "rect"
    ? [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x + b.w, b.y + b.h],
        [b.x, b.y + b.h],
      ]
    : [
        [b.x - b.r, b.y],
        [b.x + b.r, b.y],
        [b.x, b.y - b.r],
        [b.x, b.y + b.r],
      ];
}
export const ext = {};
export function refit() {
  const N = 240,
    bS = bb(),
    bP = bb();
  let mv = 0,
    ma = 0,
    fy0 = Infinity,
    fy1 = -Infinity;
  for (let i = 0; i <= N; i++) {
    const t = (st.T * i) / N,
      k = kin(t);
    addP(bS, k.S.r);
    addP(bS, k.F.r);
    addP(bP, k.P.r);
    fy0 = Math.min(fy0, k.F.r[1]);
    fy1 = Math.max(fy1, k.F.r[1]);
    mv = Math.max(mv, len(k.S.v), len(k.P.v), len(k.F.v));
    ma = Math.max(ma, len(k.S.a), len(k.P.a), len(k.F.a));
    if (i % 12 === 0) for (const b of st.bodiesP) for (const q of bodyPts(b)) addP(bS, mapPtoS(q, k.F));
  }
  addP(bS, [0, 0]);
  addP(bP, [0, 0]);
  for (const b of st.bodiesS) for (const q of bodyPts(b)) addP(bS, q);
  for (const b of st.bodiesP) for (const q of bodyPts(b)) addP(bP, q);
  for (const g of st.ground) {
    bS.y0 = Math.min(bS.y0, g.y);
    bS.y1 = Math.max(bS.y1, g.y);
    if (fy1 - fy0 < 1e-9 && !rotating()) {
      const y = g.y - fy0;
      bP.y0 = Math.min(bP.y0, y);
      bP.y1 = Math.max(bP.y1, y);
    }
  }
  Object.assign(ext, { bS, bP, mv, ma });
  st.t = Math.min(st.t, st.T);
  adjustHeights();
  layout();
}
export function spans(b) {
  let sx = b.x1 - b.x0,
    sy = b.y1 - b.y0;
  const m = Math.max(sx, sy, 1e-9);
  if (m < 1e-6) sx = sy = 2;
  return [Math.max(sx, m * 0.05), Math.max(sy, m * 0.05)];
}
export function fitOne(o, b) {
  const [sx, sy] = spans(b);
  return {
    s: Math.min(o.w / (sx * 1.3), (o.h - 10) / (sy * 1.35)),
    cx: (b.x0 + b.x1) / 2,
    cy: (b.y0 + b.y1) / 2,
  };
}
export function layout() {
  if (!ext.bS) return;
  const vis = st.view === "both" ? ["S", "P"] : [st.view];
  pan.S.f = fitOne(pan.S, ext.bS);
  pan.P.f = fitOne(pan.P, ext.bP);
  if (st.show.same && vis.length === 2) {
    const s = Math.min(pan.S.f.s, pan.P.f.s);
    pan.S.f.s = pan.P.f.s = s;
  }
  const md = Math.min(...vis.map((k) => Math.min(pan[k].w, pan[k].h)));
  ext.kv = ext.mv > 1e-9 ? (0.22 * md) / ext.mv : 0;
  ext.ka = ext.ma > 1e-9 ? (0.18 * md) / ext.ma : 0;
  ext.strobe = niceStep(st.T / 20);
  ui.dirty = true;
}
export function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x))),
    m = x / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
export const isShell = () => matchMedia("(max-width:720px) and (min-height:560px)").matches;
export const isLand = () => matchMedia("(max-height:559px) and (orientation:landscape)").matches;
export function adjustHeights() {
  if (!ext.bS) return;
  const vis = st.view === "both" ? ["S", "P"] : [st.view];
  let H;
  if (isShell()) {
    const tot = innerHeight * 0.47;
    H = vis.length === 2 ? (tot - 8) / 2 : tot;
  } else if (isLand()) {
    H = innerHeight - 200;
  } else {
    const maxH = st.view === "both" ? Math.min(innerHeight * 0.56, 560) : Math.min(innerHeight * 0.64, 660);
    let need = 0;
    for (const k of vis) {
      const b = k === "S" ? ext.bS : ext.bP,
        w = pan[k].cv.parentElement.clientWidth,
        [sx, sy] = spans(b);
      need = Math.max(need, (w * (sy * 1.35)) / (sx * 1.3) + 10);
    }
    H = Math.max(240, Math.min(maxH, need));
  }
  H = Math.round(Math.max(120, H));
  for (const k of vis) {
    const el = pan[k].cv.parentElement;
    if (Math.abs(el.clientHeight - H) > 2) el.style.height = H + "px";
  }
}
export function resizeAll() {
  adjustHeights();
  for (const o of [pan.S, pan.P, vec, gph]) if (o.cv.offsetParent !== null) sizeCanvas(o);
  layout();
}
