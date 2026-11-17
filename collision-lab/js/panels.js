// Collision Lab · panels.js
// The panel's drawings and tables: momentum vectors head to tail (before and now), the momentum and energy
// tables, the kinetic-energy bars (centre of mass + internal), the time graph and the CSV export.
import { t, fmtNum, niceTicks, getLang } from "../../kit/kit.js";
import { drawMath, toHTML } from "../../kit/mathtext.js";
import { arrow, arrowLabel, lineOf, fillOf } from "./render.js";

function prep(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}
const text = (ctx, s, x, y, color, size = 11, align = "left", weight = 400) => {
  ctx.font = `${weight} ${size}px "Space Mono", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
};

// ---------- momentum vectors, head to tail ----------
// before, now: totals() results in the current frame
export function drawMomentum(canvas, C, discs, before, now) {
  const { ctx, w, h } = prep(canvas);
  if (w < 20) return;
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, w, h);
  const chains = [before, now].map((T) => {
    let x = 0, y = 0;
    const pts = [[0, 0]];
    for (const d of T.per) pts.push([(x += d.px), (y += d.py)]);
    return pts;
  });
  let span = 1e-9;
  const boxes = chains.map((pts) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    span = Math.max(span, b.x1 - b.x0, b.y1 - b.y0);
    return b;
  });
  const pad = 26, half = w / 2;
  const k = Math.min((half - 2 * pad) / span, (h - 2 * pad - 6) / span);
  // dotted divider
  ctx.strokeStyle = C.gridline;
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(half, 8);
  ctx.lineTo(half, h - 8);
  ctx.stroke();
  ctx.setLineDash([]);
  [before, now].forEach((T, n) => {
    const b = boxes[n], pts = chains[n];
    const ox = n * half + half / 2 - ((b.x0 + b.x1) / 2) * k;
    const oy = 12 + h / 2 + ((b.y0 + b.y1) / 2) * k;
    const X = (x) => ox + x * k, Y = (y) => oy - y * k;
    text(ctx, t(n ? "b.now" : "b.before"), n * half + 8, 16, C.muted, 11, "left", 700);
    // label each p only when there are few and more than one is not zero (else it sits on P)
    const moving = T.per.filter((d) => Math.hypot(d.px, d.py) * k > 2).length;
    for (let i = 0; i < T.per.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (arrow(ctx, X(x0), Y(y0), X(x1), Y(y1), lineOf(C, i), 2) && T.per.length <= 4 && moving > 1)
        arrowLabel(ctx, C, `p_${discs[i].label}`, X(x0), Y(y0), X(x1), Y(y1), lineOf(C, i), 11);
    }
    const [ex, ey] = pts[pts.length - 1];
    ctx.setLineDash([]);
    if (arrow(ctx, X(0), Y(0), X(ex), Y(ey), C.mom, 3.5)) arrowLabel(ctx, C, "P", X(0), Y(0), X(ex), Y(ey), C.mom, 13);
    else drawMath(ctx, "P = 0", X(0) + 8, Y(0) - 8, { size: 12, weight: 700, color: C.mom, halo: C.surface });
    ctx.fillStyle = C.ink;
    ctx.fillRect(X(0) - 2.5, Y(0) - 2.5, 5, 5);
  });
}

// ---------- tables ----------
const sw = (C, i) => `<i class="sq" style="background:${fillOf(C, i)}"></i>`;
export function fillTables(ptab, ktab, C, discs, before, now) {
  const f = (x) => fmtNum(x, 3);
  let h = `<thead><tr class="grp"><th></th><th colspan="2">${toHTML("p_x")}</th><th colspan="2">${toHTML("p_y")}</th></tr>`;
  h += `<tr><th>${t("b.body")}</th><th>${t("b.before")}</th><th>${t("b.now")}</th><th>${t("b.before")}</th><th>${t("b.now")}</th></tr></thead><tbody>`;
  discs.forEach((d, i) => {
    h += `<tr><td>${sw(C, i)}${d.label}</td><td>${f(before.per[i].px)}</td><td>${f(now.per[i].px)}</td><td>${f(before.per[i].py)}</td><td>${f(now.per[i].py)}</td></tr>`;
  });
  h += `<tr class="tot"><td>${t("b.total")}</td><td>${f(before.Px)}</td><td>${f(now.Px)}</td><td>${f(before.Py)}</td><td>${f(now.Py)}</td></tr></tbody>`;
  ptab.innerHTML = h + `<caption class="note">${t("b.pUnit")}</caption>`;
  let k = `<thead><tr><th>${t("b.body")}</th><th>${t("b.before")}</th><th>${t("b.now")}</th><th>Δ<i>K</i></th></tr></thead><tbody>`;
  discs.forEach((d, i) => {
    k += `<tr><td>${sw(C, i)}${d.label}</td><td>${f(before.per[i].K)}</td><td>${f(now.per[i].K)}</td><td>${f(now.per[i].K - before.per[i].K)}</td></tr>`;
  });
  k += `<tr class="tot"><td>${t("b.total")}</td><td>${f(before.K)}</td><td>${f(now.K)}</td><td>${f(now.K - before.K)}</td></tr></tbody>`;
  ktab.innerHTML = k + `<caption class="note">${t("b.kUnit")}</caption>`;
}

// ---------- kinetic energy: centre-of-mass part and internal part ----------
export function drawEnergy(canvas, C, before, now) {
  const { ctx, w, h } = prep(canvas);
  if (w < 20) return;
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, w, h);
  const left = 64, right = 64, top = 12, bh = 22, gap = 14;
  const Kmax = Math.max(before.K, now.K, 1e-6);
  const k = (w - left - right) / Kmax;
  const rows = [[t("b.before"), before], [t("b.now"), now]];
  rows.forEach(([name, T], n) => {
    const y = top + n * (bh + gap);
    text(ctx, name, 8, y + bh / 2 + 4, C.ink, 11.5, "left", 700);
    const wc = Math.max(0, T.Kcm) * k, wi = Math.max(0, T.Kint) * k;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = C.ek;
    ctx.fillRect(left, y, wc, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ek;
    ctx.fillRect(left + wc, y, wi, bh);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, y, wc + wi, bh);
    if (wc > 1 && wi > 1) {
      ctx.beginPath();
      ctx.moveTo(left + wc, y);
      ctx.lineTo(left + wc, y + bh);
      ctx.stroke();
    }
    if (n === 1 && before.K - now.K > 1e-6) {
      const wl = (before.K - now.K) * k;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(left + wc + wi, y, wl, bh);
      ctx.setLineDash([]);
      if (wl > 40) text(ctx, t("b.lost"), left + wc + wi + wl / 2, y + bh / 2 + 4, C.muted, 10.5, "center");
    }
    text(ctx, fmtNum(T.K, 3, "J"), Math.max(left + wc + wi, n ? left + before.K * k : 0) + 6, y + bh / 2 + 4, C.ink, 11);
  });
  // legend
  const ly = top + 2 * (bh + gap) + 8;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = C.ek;
  ctx.fillRect(8, ly - 9, 12, 12);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.ink;
  ctx.strokeRect(8, ly - 9, 12, 12);
  let x = 26 + drawMath(ctx, "K_{CM}", 26, ly + 1, { size: 11, color: C.ink }) + 16;
  ctx.fillStyle = C.ek;
  ctx.fillRect(x, ly - 9, 12, 12);
  ctx.strokeRect(x, ly - 9, 12, 12);
  drawMath(ctx, "K_{int}", x + 18, ly + 1, { size: 11, color: C.ink });
}

// ---------- graph over time (DESIGN.md §10) ----------
// series: [{ data: [[t, v]], color, width, dash? }]; events: times of the collisions
export function drawGraph(canvas, C, { series, tmax, cursor, events, ylabel }) {
  const { ctx, w, h } = prep(canvas);
  if (w < 20) return;
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, w, h);
  const L = 50, R = 12, T = 14, B = 30;
  const pw = w - L - R, ph = h - T - B;
  let lo = 0, hi = 0;
  for (const s of series) for (const [, v] of s.data) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  if (hi - lo < 1e-6) (hi += 0.1), (lo -= hi > 0.1 ? 0 : 0.1);
  const m = (hi - lo) * 0.08;
  lo -= lo < 0 ? m : 0;
  hi += m;
  const X = (x) => L + (x / tmax) * pw, Y = (y) => T + ((hi - y) / (hi - lo)) * ph;
  const xt = niceTicks(0, tmax, Math.max(3, Math.floor(pw / 60))), yt = niceTicks(lo, hi, Math.max(3, Math.floor(ph / 40)));
  const digits = (tk) => (tk.length > 1 ? Math.max(0, Math.min(3, -Math.floor(Math.log10(Math.abs(tk[1] - tk[0]) || 1)))) : 1);
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.gridline;
  for (const x of xt) {
    ctx.beginPath();
    ctx.moveTo(Math.round(X(x)) + 0.5, T);
    ctx.lineTo(Math.round(X(x)) + 0.5, T + ph);
    ctx.stroke();
    text(ctx, fmtNum(x, digits(xt)), X(x), T + ph + 14, C.muted, 11, "center");
  }
  for (const y of yt) {
    if (y < lo || y > hi) continue;
    ctx.beginPath();
    ctx.moveTo(L, Math.round(Y(y)) + 0.5);
    ctx.lineTo(L + pw, Math.round(Y(y)) + 0.5);
    ctx.stroke();
    text(ctx, fmtNum(y, digits(yt)), L - 5, Y(y) + 4, C.muted, 11, "right");
  }
  // collisions
  ctx.strokeStyle = C.muted;
  ctx.setLineDash([4, 3]);
  for (const e of events) {
    if (e > tmax) continue;
    ctx.beginPath();
    ctx.moveTo(X(e), T);
    ctx.lineTo(X(e), T + ph);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // zero axis
  if (lo < 0 && hi > 0) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L, Y(0));
    ctx.lineTo(L + pw, Y(0));
    ctx.stroke();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, T, pw, ph);
  ctx.clip();
  for (const s of series) {
    if (!s.data.length) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 2;
    ctx.lineJoin = "round";
    ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    s.data.forEach(([x, y], n) => (n ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (cursor != null && cursor > 0) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(cursor) + 0.5, T);
    ctx.lineTo(X(cursor) + 0.5, T + ph);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(L, T, pw, ph);
  drawMath(ctx, "t (s)", L + pw, h - 4, { size: 11, color: C.ink, align: "right" });
  drawMath(ctx, ylabel, L + 4, T + 12, { size: 11, color: C.ink, halo: C.surface });
}

// ---------- CSV: lab frame, Italian = ";" and decimal comma (DESIGN.md §10) ----------
export function buildCsv(discs, history) {
  const it = getLang() === "it", sep = it ? ";" : ",";
  const num = (x, d = 4) => (it ? x.toFixed(d).replace(".", ",") : x.toFixed(d));
  const head = ["t (s)"];
  for (const d of discs) head.push(`x_${d.label} (m)`, `y_${d.label} (m)`, `v_x,${d.label} (m/s)`, `v_y,${d.label} (m/s)`);
  head.push("x_CM (m)", "y_CM (m)", "P_x (kg·m/s)", "P_y (kg·m/s)", "K (J)");
  const rows = [head.join(sep)];
  for (const s of history) {
    const r = [num(s.t, 2)];
    let Px = 0, Py = 0, K = 0;
    discs.forEach((d, i) => {
      const p = s.p[i];
      r.push(num(p.x), num(p.y), num(p.vx), num(p.vy));
      Px += d.m * p.vx;
      Py += d.m * p.vy;
      K += 0.5 * d.m * (p.vx * p.vx + p.vy * p.vy);
    });
    r.push(num(s.X), num(s.Y), num(Px), num(Py), num(K));
    rows.push(r.join(sep));
  }
  return rows.join("\n");
}
