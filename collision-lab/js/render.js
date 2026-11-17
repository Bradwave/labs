// Collision Lab · render.js
// Draws the air table from above: grid, bumpers, discs, trails, strobe ghosts, centre of mass, vectors and the
// drag handles. Owns the world ↔ screen mapping of the stage canvas.
import { drawMath } from "../../kit/mathtext.js";
import { TABLE, VSCALE } from "./scenes.js";

export const MSCALE = 0.6; // metres of arrow per kg·m/s
const MARGIN = 0.07; // metres of table edge kept visible around the table

// fill colour token of disc i (A is always yellow, the others cycle) and its line colour for graphs
export const fillOf = (C, i) => C["d" + (i === 0 ? 1 : 2 + ((i - 1) % 4))];
export const lineOf = (C, i) => C["l" + (i === 0 ? 1 : 2 + ((i - 1) % 4))];
export const EXTRA_COLORS = ["table", "tableline", "puckink", "d1", "d2", "d3", "d4", "d5", "l1", "l2", "l3", "l4", "l5"];

// arrow with a 2.5 px shaft and a filled 10 × 8 px head (DESIGN.md §11)
export function arrow(ctx, x0, y0, x1, y1, color, width = 2.5) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 2) return false;
  const ux = dx / L, uy = dy / L, head = Math.min(10, L * 0.6), half = head * 0.4;
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * head * 0.9, y1 - uy * head * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * head - uy * half, y1 - uy * head + ux * half);
  ctx.lineTo(x1 - ux * head + uy * half, y1 - uy * head - ux * half);
  ctx.closePath();
  ctx.fill();
  return true;
}
// mathtext label beside an arrow head, pushed away from the shaft
export function arrowLabel(ctx, C, src, x0, y0, x1, y1, color, size = 12) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const x = x1 + (dx / L) * 8 + (-dy / L) * 9, y = y1 + (dy / L) * 8 + (dx / L) * 9 + 4;
  drawMath(ctx, src, x, y, { size, weight: 700, color, halo: C.surface, align: dx < -0.3 * L ? "right" : dx > 0.3 * L ? "left" : "center" });
}

export function createStage(canvas) {
  const view = { k: 100, ox: 0, oy: 0, w: 0, h: 0, sx: 0, sy: 0 };
  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    view.w = r.width;
    view.h = r.height;
    view.dpr = dpr;
    view.k = Math.min(r.width / (TABLE.W + 2 * MARGIN), r.height / (TABLE.H + 2 * MARGIN));
    view.ox = (r.width - TABLE.W * view.k) / 2;
    view.oy = (r.height - TABLE.H * view.k) / 2;
  }
  // world (metres, y up) → screen (px); shift: the displacement of the frame (centre-of-mass frame)
  const X = (x) => view.ox + (x - view.sx) * view.k;
  const Y = (y) => view.oy + (TABLE.H - (y - view.sy)) * view.k;
  const toWorld = (px, py) => ({ x: (px - view.ox) / view.k + view.sx, y: TABLE.H - (py - view.oy) / view.k + view.sy });

  function draw(M) {
    const { C } = M;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    view.sx = M.shift.x;
    view.sy = M.shift.y;
    const k = view.k;
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, view.w, view.h);

    // ---- table: 10 cm grid, bumpers ----
    const tx = X(0), ty = Y(TABLE.H), tw = TABLE.W * k, th = TABLE.H * k;
    ctx.fillStyle = C.table;
    ctx.fillRect(tx, ty, tw, th);
    ctx.lineWidth = 1;
    for (let i = 1; i < 20; i++) {
      ctx.strokeStyle = i % 5 ? C.tableline : C.gridline;
      const x = Math.round(tx + i * 0.1 * k) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, ty);
      ctx.lineTo(x, ty + th);
      ctx.stroke();
    }
    for (let j = 1; j < 12; j++) {
      ctx.strokeStyle = j % 5 ? C.tableline : C.gridline;
      const y = Math.round(ty + j * 0.1 * k) + 0.5;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx + tw, y);
      ctx.stroke();
    }
    if (M.walls) {
      const b = Math.max(5, 0.025 * k);
      ctx.fillStyle = C.bg;
      ctx.fillRect(tx - b, ty - b, tw + 2 * b, b);
      ctx.fillRect(tx - b, ty + th, tw + 2 * b, b);
      ctx.fillRect(tx - b, ty, b, th);
      ctx.fillRect(tx + tw, ty, b, th);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(tx - b, ty - b, tw + 2 * b, th + 2 * b);
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, tw, th);
    ctx.font = '400 10px "Space Mono", monospace';
    ctx.fillStyle = C.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("□ = 10 cm", tx + tw - 6, ty + th - 6);

    const H = M.history;
    // ---- trails and strobe ghosts (from the recorded samples, drawn in the current frame) ----
    // a sample seen from the frame of that instant: in the centre-of-mass frame the centre of mass stays at X0
    const hx = (s, x) => view.ox + (x - (M.cmFrame ? s.X - M.X0 : 0)) * k;
    const hy = (s, y) => view.oy + (TABLE.H - (y - (M.cmFrame ? s.Y - M.Y0 : 0))) * k;
    if (M.show.trail && H.length > 1)
      M.discs.forEach((d, i) => {
        ctx.strokeStyle = lineOf(C, i);
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        H.forEach((s, n) => (n ? ctx.lineTo(hx(s, s.p[i].x), hy(s, s.p[i].y)) : ctx.moveTo(hx(s, s.p[i].x), hy(s, s.p[i].y))));
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    if (M.show.strobe && H.length > 1) {
      ctx.globalAlpha = 0.35;
      // the last 4 s only (200 samples), so long runs with bumpers stay readable
      const n0 = Math.max(0, H.length - 200);
      for (let n = n0 - (n0 % M.strobeEvery); n < H.length - 1; n += M.strobeEvery) {
        const s = H[n];
        M.discs.forEach((d, i) => {
          ctx.beginPath();
          ctx.arc(hx(s, s.p[i].x), hy(s, s.p[i].y), d.r * k, 0, 2 * Math.PI);
          ctx.fillStyle = fillOf(C, i);
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
        if (M.show.cm) {
          ctx.fillStyle = C.ink;
          ctx.fillRect(hx(s, s.X) - 2, hy(s, s.Y) - 2, 4, 4);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (M.show.cm && H.length > 1) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      H.forEach((s, n) => (n ? ctx.lineTo(hx(s, s.X), hy(s, s.Y)) : ctx.moveTo(hx(s, s.X), hy(s, s.Y))));
      ctx.lineTo(X(M.T.X), Y(M.T.Y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- discs ----
    M.discs.forEach((d, i) => {
      const s = M.S[i];
      ctx.beginPath();
      ctx.arc(X(s.x), Y(s.y), d.r * k, 0, 2 * Math.PI);
      ctx.fillStyle = fillOf(C, i);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (M.hover && M.hover.kind === "pos" && M.hover.body === i) {
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(X(s.x), Y(s.y), d.r * k + 5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = C.puckink;
      ctx.font = `700 ${Math.max(10, Math.min(15, d.r * k * 0.9))}px "Space Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(d.label, X(s.x), Y(s.y) + 1);
    });
    // stuck discs: a bar across the contact (it turns with the pair)
    for (const [i, j] of M.joints) {
      const a = M.S[i], b = M.S[j], ra = M.discs[i].r;
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = (b.x - a.x) / L, ny = (b.y - a.y) / L;
      const cx = a.x + nx * ra, cy = a.y + ny * ra, half = 0.7 * Math.min(ra, M.discs[j].r);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(X(cx - ny * half), Y(cy + nx * half));
      ctx.lineTo(X(cx + ny * half), Y(cy - nx * half));
      ctx.stroke();
    }

    // ---- vectors ----
    const showVel = !M.noVec && (M.show.vel || M.setup);
    const showMom = !M.noVec && M.show.mom;
    M.discs.forEach((d, i) => {
      const s = M.S[i];
      // v and p are parallel: when both are drawn, they sit side by side, 4 px each side of the centre line
      const sp = Math.hypot(s.vx, s.vy) || 1, both = showVel && showMom ? 4 : 0;
      const qx = (-s.vy / sp) * both, qy = (-s.vx / sp) * both; // screen offset to the left of the motion
      if (showVel) {
        const x0 = X(s.x) - qx, y0 = Y(s.y) - qy;
        const x1 = X(s.x + s.vx * VSCALE) - qx, y1 = Y(s.y + s.vy * VSCALE) - qy;
        if (arrow(ctx, x0, y0, x1, y1, C.vel)) arrowLabel(ctx, C, `v_${d.label}`, x0, y0, x1, y1, C.vel);
      }
      if (showMom) {
        const x0 = X(s.x) + qx, y0 = Y(s.y) + qy;
        const x1 = X(s.x + d.m * s.vx * MSCALE) + qx, y1 = Y(s.y + d.m * s.vy * MSCALE) + qy;
        if (arrow(ctx, x0, y0, x1, y1, C.mom)) arrowLabel(ctx, C, `p_${d.label}`, x0, y0, x1, y1, C.mom);
      }
    });

    // ---- centre of mass and total momentum ----
    if (M.show.cm) {
      const cx = X(M.T.X), cy = Y(M.T.Y);
      if (showMom) {
        const x1 = X(M.T.X + M.T.Px * MSCALE), y1 = Y(M.T.Y + M.T.Py * MSCALE);
        if (arrow(ctx, cx, cy, x1, y1, C.mom, 4)) arrowLabel(ctx, C, "P", cx, cy, x1, y1, C.mom, 13);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.surface;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      for (const a of [0, Math.PI]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 7, a, a + Math.PI / 2);
        ctx.fill();
      }
    }

    // ---- handles: squares at the tips of the velocity arrows ----
    if (M.setup)
      for (const h of M.handles) {
        if (h.kind !== "vel") continue;
        const x = X(h.tipX), y = Y(h.tipY), s = M.hover === h ? 8 : 6;
        ctx.fillStyle = C.accent;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.fillRect(x - s, y - s, 2 * s, 2 * s);
        ctx.strokeRect(x - s, y - s, 2 * s, 2 * s);
      }
  }

  // the handle under the pointer: velocity tips first (they can sit over a disc), then the discs
  function pick(handles, px, py, touch) {
    const tol = touch ? 22 : 12;
    let best = null, bd = Infinity;
    for (const h of handles) {
      if (h.kind !== "vel") continue;
      const d = Math.hypot(X(h.tipX) - px, Y(h.tipY) - py);
      if (d < tol && d < bd) (best = h), (bd = d);
    }
    if (best) return best;
    for (const h of handles) {
      if (h.kind !== "pos") continue;
      const d = Math.hypot(X(h.x) - px, Y(h.y) - py);
      if (d < h.r * view.k + (touch ? 12 : 4) && d < bd) (best = h), (bd = d);
    }
    return best;
  }

  return { resize, draw, toWorld, pick, view };
}
