// Relative Motion Lab: Drawing a frame panel: grids, ground, bodies, axes, paths and vectors.
import { PR, len, Z } from "./vec.js";
import { toP, frameAt, kin, rotating } from "./motion.js";
import { ui, st } from "./state.js";
import { pan, C, mapPtoS, mapStoP } from "./canvas.js";
import { bb, addP, bodyPts, ext, niceStep } from "./layout.js";

export function arrow(ctx, x, y, dx, dy, col, kind, label, mid) {
  const L = Math.hypot(dx, dy);
  if (L < 3) return;
  const ux = dx / L,
    uy = dy / L,
    hd = Math.min(kind === "a" ? 10 : 12, L * 0.55),
    lw = kind === "v" ? 3.2 : kind === "a" ? 2.2 : 2;
  const ex = x + dx,
    ey = y + dy,
    bx = ex - ux * hd,
    by = ey - uy * hd,
    nx = -uy,
    ny = ux,
    hw = hd * 0.5;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "d") ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kind === "a" ? ex - ux * 1.5 : bx + ux, kind === "a" ? ey - uy * 1.5 : by + uy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(bx + nx * hw, by + ny * hw);
  ctx.lineTo(ex, ey);
  ctx.lineTo(bx - nx * hw, by - ny * hw);
  if (kind === "a") ctx.stroke();
  else {
    ctx.closePath();
    ctx.fill();
  }
  if (label) {
    ctx.font = 'italic 700 13px "Space Mono",monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lx = mid ? x + dx / 2 + nx * 14 * mid : ex + ux * 12 + nx * 6,
      ly = mid ? y + dy / 2 + ny * 14 * mid : ey + uy * 12 + ny * 6;
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.surface;
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
  }
  ctx.restore();
}
export function txt(ctx, s, x, y, col, al = "left", sz = 11, w = "700") {
  ctx.font = `${w} ${sz}px "Space Mono",monospace`;
  ctx.textAlign = al;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.surface;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}
export function line2(ctx, a, b) {
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
}
export function drawPanel(key) {
  const o = pan[key];
  if (st.view !== "both" && st.view !== key) return;
  const ctx = o.ctx,
    w = o.w,
    h = o.h,
    f = o.f;
  if (!f) return;
  ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, w, h);
  const X = (x) => w / 2 + (x - f.cx) * f.s,
    Y = (y) => h / 2 - (y - f.cy) * f.s,
    P = (p) => [X(p[0]), Y(p[1])];
  const isS = key === "S",
    k = kin(st.t),
    F = k.F,
    own = isS ? C.sC : C.pC,
    hide = st.pred.on && st.pred.panel === key;
  const Q = isS ? k.S : k.P;
  // maps from each frame's coordinates into this panel's coordinates
  const mS = isS ? (q) => q : (q) => mapStoP(q, F),
    mP = isS ? (q) => mapPtoS(q, F) : (q) => q;
  const mOther = isS ? mP : mS,
    mOtherInv = isS ? (q) => mapStoP(q, F) : (q) => mapPtoS(q, F);
  const step = niceStep(70 / f.s),
    xL = f.cx - w / 2 / f.s,
    xR = f.cx + w / 2 / f.s,
    yB = f.cy - h / 2 / f.s,
    yT = f.cy + h / 2 / f.s;
  const corners = [
    [xL, yB],
    [xR, yB],
    [xR, yT],
    [xL, yT],
  ];
  const grid = (M, Minv, col, dash, lw) => {
    const b = bb();
    for (const c of corners) addP(b, Minv(c));
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let n = 0;
    for (let x = Math.ceil(b.x0 / step) * step; x <= b.x1 && n < 300; x += step, n++)
      line2(ctx, P(M([x, b.y0])), P(M([x, b.y1])));
    n = 0;
    for (let y = Math.ceil(b.y0 / step) * step; y <= b.y1 && n < 300; y += step, n++)
      line2(ctx, P(M([b.x0, y])), P(M([b.x1, y])));
    ctx.stroke();
    ctx.restore();
  };
  if (st.show.grid) {
    grid(
      (q) => q,
      (q) => q,
      C.gridline,
      [],
      1,
    );
    ctx.globalAlpha = 0.5;
    grid(mOther, mOtherInv, C.fC, [3, 5], 1);
    ctx.globalAlpha = 1;
  }
  // ground lines (they belong to S)
  if (st.ground.length) {
    const b = bb();
    for (const c of corners) addP(b, isS ? c : mapPtoS(c, F));
    const hs = niceStep(14 / f.s),
      d = 7 / f.s;
    for (const g of st.ground) {
      ctx.save();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      line2(ctx, P(mS([b.x0 - 1, g.y])), P(mS([b.x1 + 1, g.y])));
      ctx.stroke();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = C.muted;
      ctx.beginPath();
      let n = 0;
      for (let x = Math.floor(b.x0 / hs) * hs; x <= b.x1 + hs && n < 800; x += hs, n++)
        line2(ctx, P(mS([x, g.y])), P(mS([x - d, g.y + d * g.side])));
      ctx.stroke();
      ctx.restore();
    }
  }
  // bodies
  const drawBody = (b, M) => {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    if (b.type === "rect") {
      const pts = bodyPts(b).map((q) => P(M(q)));
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = C.body;
      ctx.fill();
      ctx.stroke();
    } else {
      const c = P(M([b.x, b.y])),
        r = Math.max(3, b.r * f.s);
      ctx.beginPath();
      ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
      if (b.fill === "sun") {
        ctx.fillStyle = C.fC;
        ctx.fill();
        ctx.stroke();
      } else if (b.fill === "solid") {
        ctx.fillStyle = C.muted;
        ctx.fill();
      } else if (b.fill === "none") {
        ctx.strokeStyle = C.muted;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
      } else {
        ctx.fillStyle = C.body;
        ctx.fill();
        ctx.stroke();
      }
      if (b.marks) {
        ctx.setLineDash([]);
        ctx.strokeStyle = C.muted;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 4;
          line2(
            ctx,
            P(M([b.x + b.r * Math.cos(a), b.y + b.r * Math.sin(a)])),
            P(M([b.x - b.r * Math.cos(a), b.y - b.r * Math.sin(a)])),
          );
        }
        ctx.stroke();
        const m = P(M([b.x + b.r * 0.85, b.y]));
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(m[0], m[1], 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (b.spoke && !hide) {
        ctx.strokeStyle = C.muted;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        line2(ctx, c, P(Q.r));
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  for (const b of st.bodiesS) drawBody(b, mS);
  for (const b of st.bodiesP) drawBody(b, mP);
  // axes of both frames
  const tripod = (M, col, lab) => {
    const L = Math.max(28, Math.min(60, step * f.s * 1.2)) / f.s,
      p = P(M(Z));
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const [e, nm] of [
      [[L, 0], "x"],
      [[0, L], "y"],
    ]) {
      const q = P(M(e));
      arrow(ctx, p[0], p[1], q[0] - p[0], q[1] - p[1], col, "a", null);
      const dx = q[0] - p[0],
        dy = q[1] - p[1],
        l = Math.hypot(dx, dy) || 1;
      txt(ctx, nm + lab, q[0] + (dx / l) * 9, q[1] + (dy / l) * 9, col, "center");
    }
    txt(ctx, "O" + lab, p[0] - 6, p[1] + 11, col, "right");
  };
  tripod(mOther, C.fC, isS ? PR : "");
  tripod((q) => q, C.ink, isS ? "" : PR);
  // path of the other frame's origin
  const N = Math.max(2, Math.ceil((300 * st.t) / st.T)),
    otherO = (t) => {
      const Fk = frameAt(t);
      return isS ? Fk.r : toP({ r: Z, v: Z, a: Z }, Fk).r;
    };
  if (st.show.frame && st.t > 0) {
    ctx.save();
    ctx.strokeStyle = C.fC;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const q = P(otherO((st.t * i) / N));
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.restore();
  }
  // prediction strokes
  const strokes = st.pred.strokes.filter((s) => s.panel === key);
  if (strokes.length) {
    ctx.save();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 6]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) {
      ctx.beginPath();
      s.pts.forEach((q, i) => {
        const p = P(q);
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      });
      ctx.stroke();
    }
    ctx.restore();
    if (!st.pred.on) {
      const l = strokes[strokes.length - 1].pts,
        e = P(l[l.length - 1]);
      const rt = e[0] + 130 > w;
      txt(ctx, "your prediction", rt ? e[0] - 8 : e[0] + 8, e[1] - 12, C.ink, rt ? "right" : "left", 10.5);
    }
  }
  const posAt = (t) => {
    const kk = kin(t);
    return isS ? kk.S.r : kk.P.r;
  };
  if (!hide) {
    if (st.trail === "line" && st.t > 0) {
      ctx.save();
      ctx.strokeStyle = own;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const q = P(posAt((st.t * i) / N));
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (st.trail === "strobe") {
      ctx.save();
      ctx.fillStyle = own;
      const dt = ext.strobe;
      for (let i = 0; i * dt <= st.t + 1e-9 && i < 400; i++) {
        const q = P(posAt(i * dt));
        ctx.beginPath();
        ctx.arc(q[0], q[1], 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  const r0 = posAt(0),
    p0 = P(r0),
    pr = P(Q.r);
  if (st.show.dr && !hide) {
    ctx.save();
    ctx.strokeStyle = own;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p0[0], p0[1], 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    arrow(ctx, p0[0], p0[1], pr[0] - p0[0], pr[1] - p0[1], own, "d", "Δr" + (isS ? "" : PR));
  }
  if (hide) {
    ctx.save();
    ctx.strokeStyle = own;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p0[0], p0[1], 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    txt(ctx, "start", p0[0] + 10, p0[1] + 12, own, "left", 10.5);
  }
  // frame vectors at the other origin
  if (st.show.frame) {
    let Fq, lv, la;
    if (isS) {
      Fq = { r: F.r, v: F.v, a: F.a };
      lv = "V";
      la = "A";
    } else {
      Fq = toP({ r: Z, v: Z, a: Z }, F);
      lv = rotating() ? "v" + PR + "(O)" : "−V";
      la = rotating() ? "a" + PR + "(O)" : "−A";
    }
    const po = P(Fq.r);
    if (st.show.v && ext.kv) arrow(ctx, po[0], po[1], Fq.v[0] * ext.kv, -Fq.v[1] * ext.kv, C.fC, "v", lv);
    if (st.show.a && ext.ka) arrow(ctx, po[0], po[1], Fq.a[0] * ext.ka, -Fq.a[1] * ext.ka, C.fC, "a", la);
  }
  if (!hide) {
    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pr[0], pr[1], 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (st.show.v && ext.kv) {
      const L = len(Q.v) * ext.kv;
      if (L < 3) txt(ctx, "v" + (isS ? "" : PR) + " = 0", pr[0] + 10, pr[1] - 14, own);
      else arrow(ctx, pr[0], pr[1], Q.v[0] * ext.kv, -Q.v[1] * ext.kv, own, "v", "v" + (isS ? "" : PR));
    }
    if (st.show.a && ext.ka)
      arrow(ctx, pr[0], pr[1], Q.a[0] * ext.ka, -Q.a[1] * ext.ka, own, "a", "a" + (isS ? "" : PR));
  }
  txt(ctx, "grid " + fmtN(step) + " " + st.units[0], w - 8, h - 11, C.muted, "right", 10.5, "400");
}
export function fmtN(x) {
  return +x.toPrecision(3) + "";
}
export const f2 = (x) => {
  const r = Math.abs(x) < 0.005 ? 0 : x;
  return r.toFixed(2);
};
export const fv = (v) => `(${f2(v[0])}, ${f2(v[1])})`;
