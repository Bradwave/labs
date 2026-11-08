// Overlay canvas: frame, target ghost, map rectangles with handles, trace; plus pointer interaction.
import { S, H, kCss, toScreen, toWorld } from './state.js';
import { linear } from './ifs.js';
import { B, SEEDS, colors } from './engine.js';
import { G, X0, SPAN } from './challenge.js';

let ov, ctx;
const ptrs = new Map();
let drag = null;

export function initView(canvas) {
  ov = canvas; ctx = ov.getContext('2d');
  ov.addEventListener('pointerdown', down);
  ov.addEventListener('pointermove', move);
  ov.addEventListener('pointerup', up);
  ov.addEventListener('pointercancel', up);
  ov.addEventListener('wheel', wheel, { passive: false });
}

const unitSq = [[0, 0], [1, 0], [1, 1], [0, 1]];
function poly(T, pts) {
  return pts.map(([u, v]) => toScreen(T.a * u + T.b * v + T.e, T.c * u + T.d * v + T.f));
}
function path(pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
function geom(m) {
  const c = Math.cos(m.rot), s = Math.sin(m.rot);
  return { cx: m.x + m.w / 2, cy: m.y + m.h / 2, c, s };
}
const loc2w = (g, lx, ly) => [g.cx + g.c * lx - g.s * ly, g.cy + g.s * lx + g.c * ly];
const ROT_OFF = 26;

function handles(m) {
  const g = geom(m), k = kCss();
  return {
    corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ sx, sy, p: toScreen(...loc2w(g, (sx * m.w) / 2, (sy * m.h) / 2)) })),
    rot: toScreen(...loc2w(g, 0, -m.h / 2 - ROT_OFF / k)),
    top: toScreen(...loc2w(g, 0, -m.h / 2)),
  };
}

export function drawOverlay() {
  const { w, h } = S.size, C = colors();
  ctx.setTransform(B.q, 0, 0, B.q, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const colored = S.o.color !== 'ink', k = kCss();

  if (S.o.frame) {
    const [x0, y0] = toScreen(0, 0), [x1, y1] = toScreen(1, 1);
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }

  if (S.target && S.ghost) {
    const cell = (SPAN / G) * k;
    ctx.fillStyle = C.accent; ctx.globalAlpha = 0.28;
    for (const i of S.target.cells) {
      const [sx, sy] = toScreen(X0 + (i % G) * (SPAN / G), X0 + Math.floor(i / G) * (SPAN / G));
      ctx.fillRect(sx, sy, cell + 0.6, cell + 0.6);
    }
    ctx.globalAlpha = 1;
  }

  const slow = S.o.method === 'chaos' && S.o.rate !== 'max' && S.dots.length;
  const flash = S.flash && performance.now() - S.flash.t < 600 ? S.flash : null;

  if (S.o.maps) {
    S.maps.forEach((m, i) => {
      const T = linear(m), sel = i === S.sel, col = colored ? m.color : sel ? C.accent : C.ink;
      const pts = poly(T, unitSq);
      if (flash && flash.j === i) { path(pts); ctx.fillStyle = m.color; ctx.globalAlpha = 0.28 * (1 - (performance.now() - flash.t) / 600); ctx.fill(); ctx.globalAlpha = 1; }
      if (S.o.glyph) { path(poly(T, SEEDS.F)); ctx.fillStyle = col; ctx.globalAlpha = sel ? 0.16 : 0.08; ctx.fill(); ctx.globalAlpha = 1; }
      path(pts); ctx.strokeStyle = col; ctx.lineWidth = sel ? 3 : 1.6; ctx.stroke();
      const [lx, ly] = poly(T, [[0.1, 0.12]])[0];
      ctx.beginPath(); ctx.arc(lx, ly, 9, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = colored || sel ? '#fff' : C.bg; ctx.font = '700 11px "Space Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), lx, ly + 0.5);
    });
    const m = S.maps[S.sel];
    if (m) {
      const hd = handles(m), col = colored ? m.color : C.accent;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...hd.top); ctx.lineTo(...hd.rot); ctx.stroke();
      ctx.fillStyle = C.bg;
      for (const c of hd.corners) { ctx.beginPath(); ctx.arc(c.p[0], c.p[1], 6, 0, 6.2832); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(hd.rot[0], hd.rot[1], 8, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(hd.rot[0], hd.rot[1], 3.4, -2.4, 1.6); ctx.stroke();
    }
  }

  if (slow) {
    for (const d of S.dots) {
      const [x, y] = toScreen(d.x, d.y), col = colored ? S.maps[d.j]?.color : C.ink;
      ctx.beginPath(); ctx.arc(x, y, d.burning ? 3 : 2.2, 0, 6.2832);
      if (d.burning) { ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ctx.stroke(); } else { ctx.fillStyle = col || C.ink; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; }
    }
    const t = S.trace;
    if (t) {
      const [x0, y0] = toScreen(t.from.x, t.from.y), [x1, y1] = toScreen(t.to.x, t.to.y);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x1, y1, 7, 0, 6.2832); ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  S.ovDirty = !!slow || !!flash;
}

// ---- interaction --------------------------------------------------------------------
function pt(e) {
  const r = ov.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
const near = (a, b, r) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 <= r * r;

function hitTest(p) {
  if (!S.o.maps) return null;
  const m = S.maps[S.sel];
  if (m) {
    const hd = handles(m);
    if (near(p, hd.rot, 13)) return { type: 'rot', i: S.sel };
    for (const c of hd.corners) if (near(p, c.p, 12)) return { type: 'size', i: S.sel, sx: c.sx, sy: c.sy };
  }
  const [wx, wy] = toWorld(...p);
  let best = null, area = Infinity;
  S.maps.forEach((q, i) => {
    const g = geom(q), dx = wx - g.cx, dy = wy - g.cy;
    const lx = g.c * dx + g.s * dy, ly = -g.s * dx + g.c * dy;
    if (Math.abs(lx) <= q.w / 2 && Math.abs(ly) <= q.h / 2 && q.w * q.h < area) { best = i; area = q.w * q.h; }
  });
  return best === null ? null : { type: 'move', i: best };
}

function down(e) {
  ov.setPointerCapture(e.pointerId);
  const p = pt(e);
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    drag = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: S.view.z };
    return;
  }
  const hit = hitTest(p);
  if (hit) {
    if (hit.i !== S.sel) { S.sel = hit.i; H.select(); }
    const m = S.maps[hit.i], w = toWorld(...p), g = geom(m);
    drag = { ...hit, start: { ...m }, w0: w, a0: Math.atan2(w[1] - g.cy, w[0] - g.cx), moved: false };
  } else {
    drag = { type: 'pan', p0: p, cx0: S.view.cx, cy0: S.view.cy, moved: false };
  }
  S.ovDirty = true;
}

function move(e) {
  const p = pt(e);
  if (!ptrs.has(e.pointerId)) {
    if (!drag) { const hit = hitTest(p); ov.style.cursor = !hit ? 'grab' : hit.type === 'rot' ? 'alias' : hit.type === 'size' ? 'nwse-resize' : 'move'; }
    return;
  }
  ptrs.set(e.pointerId, p);
  if (!drag) return;
  if (drag.type === 'pinch') {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()];
    S.view.z = Math.min(3000, Math.max(0.2, (drag.z0 * Math.hypot(a[0] - b[0], a[1] - b[1])) / drag.d0));
    H.view();
    return;
  }
  drag.moved = true;
  if (drag.type === 'pan') {
    const k = kCss();
    S.view.cx = drag.cx0 - (p[0] - drag.p0[0]) / k; S.view.cy = drag.cy0 - (p[1] - drag.p0[1]) / k;
    ov.style.cursor = 'grabbing';
    H.view();
    return;
  }
  const m = S.maps[drag.i], st = drag.start, w = toWorld(...p);
  if (drag.type === 'move') {
    m.x = st.x + w[0] - drag.w0[0]; m.y = st.y + w[1] - drag.w0[1];
  } else if (drag.type === 'rot') {
    const g = geom(st);
    let r = st.rot + (Math.atan2(w[1] - g.cy, w[0] - g.cx) - drag.a0);
    if (e.shiftKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12);
    m.rot = r;
  } else if (drag.type === 'size') {
    const g = geom(st), A = loc2w(g, (-drag.sx * st.w) / 2, (-drag.sy * st.h) / 2);
    const dx = w[0] - A[0], dy = w[1] - A[1];
    const lx = g.c * dx + g.s * dy, ly = -g.s * dx + g.c * dy;
    let nw = Math.max(0.02, drag.sx * lx), nh = Math.max(0.02, drag.sy * ly);
    if (e.shiftKey) { const s = Math.max(nw / st.w, nh / st.h); nw = st.w * s; nh = st.h * s; }
    const c = loc2w({ cx: A[0], cy: A[1], c: g.c, s: g.s }, (drag.sx * nw) / 2, (drag.sy * nh) / 2);
    m.w = nw; m.h = nh; m.x = c[0] - nw / 2; m.y = c[1] - nh / 2;
  }
  H.edit(true);
}

function up(e) {
  ptrs.delete(e.pointerId);
  if (drag && drag.type === 'pinch') { if (ptrs.size < 2) drag = null; return; }
  if (drag && drag.moved && drag.type !== 'pan') H.commit();
  drag = null;
}

function wheel(e) {
  e.preventDefault();
  const p = pt(e), before = toWorld(...p);
  S.view.z = Math.min(3000, Math.max(0.2, S.view.z * Math.exp(-e.deltaY * 0.0015)));
  const after = toWorld(...p);
  S.view.cx += before[0] - after[0]; S.view.cy += before[1] - after[1];
  H.view();
}

export function zoomBy(f) {
  S.view.z = Math.min(3000, Math.max(0.2, S.view.z * f));
  H.view();
}
// Centre the view on the attractor itself (a few thousand chaos-game points give its bounding box).
function attractorBounds() {
  const total = S.maps.reduce((s, m) => s + m.p, 0);
  if (!S.maps.length || !(total > 0)) return null;
  const T = S.maps.map(linear), cum = []; let s = 0;
  for (const m of S.maps) { s += m.p / total; cum.push(s); }
  cum[cum.length - 1] = 2;
  let x = 0.5, y = 0.5, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 30000; i++) {
    const r = Math.random(); let j = 0;
    while (r >= cum[j]) j++;
    const t = T[j], nx = t.a * x + t.b * y + t.e; y = t.c * x + t.d * y + t.f; x = nx;
    if (!(Math.abs(x) < 1e3 && Math.abs(y) < 1e3)) return null;
    if (i < 30) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}
export function fitView(bounds) {
  const b = bounds || attractorBounds();
  if (!b) { S.view.cx = S.view.cy = 0.5; S.view.z = 1; }
  else {
    const ext = Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.05);
    S.view.cx = (b.x0 + b.x1) / 2; S.view.cy = (b.y0 + b.y1) / 2;
    S.view.z = Math.min(50, Math.max(0.2, 1 / ext));
  }
  H.view();
}
export function zoomToMap(i) {
  const m = S.maps[i];
  if (!m) return;
  S.view.cx = m.x + m.w / 2; S.view.cy = m.y + m.h / 2;
  S.view.z = Math.min(3000, 1 / Math.max(m.w, m.h));
  H.view();
}
