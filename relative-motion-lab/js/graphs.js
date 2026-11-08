// Relative Motion Lab: Graphs against time.
import { $ } from "./dom.js";
import { PR } from "./vec.js";
import { kin, rotating } from "./motion.js";
import { ui, st, U } from "./state.js";
import { gph, C } from "./canvas.js";
import { niceStep } from "./layout.js";
import { fmtN } from "./panels.js";

export const GQ = { x: ["x", "r", 0], y: ["y", "r", 1], vx: ["v_x", "v", 0], vy: ["v_y", "v", 1] };
export function drawGraph() {
  const o = gph,
    ctx = o.ctx,
    w = o.w,
    h = o.h;
  ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, w, h);
  const [nm, qq, c] = GQ[st.gq],
    N = 240,
    ser = { S: [], P: [], F: [] };
  for (let i = 0; i <= N; i++) {
    const k = kin((st.T * i) / N);
    ser.S.push(k.S[qq][c]);
    ser.P.push(k.P[qq][c]);
    ser.F.push(k.F[qq][c]);
  }
  const hid = st.pred.on ? st.pred.panel : null,
    show = ["F", "S", "P"].filter((k) => k !== hid);
  let lo = Infinity,
    hi = -Infinity;
  for (const k of show)
    for (const v of ser[k]) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const L = 46,
    R = w - 10,
    Tp = 10,
    B = h - 26,
    X = (t) => L + (t / st.T) * (R - L),
    Y = (v) => B - ((v - lo) / (hi - lo)) * (B - Tp);
  const ys = niceStep((hi - lo) / 5),
    ts = niceStep(st.T / 6);
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.gridline;
  ctx.beginPath();
  for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.moveTo(L, y);
    ctx.lineTo(R, y);
  }
  for (let t = 0; t <= st.T + 1e-9; t += ts) {
    const x = Math.round(X(t)) + 0.5;
    ctx.moveTo(x, Tp);
    ctx.lineTo(x, B);
  }
  ctx.stroke();
  ctx.font = '400 10px "Space Mono",monospace';
  ctx.fillStyle = C.muted;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys)
    ctx.fillText(fmtN(Math.abs(v) < ys * 1e-6 ? 0 : v), L - 5, Y(v));
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let t = 0; t <= st.T + 1e-9; t += ts) ctx.fillText(fmtN(t), X(t), B + 5);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("t (" + st.units[1] + ")", R, B - 3);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L, Tp);
  ctx.lineTo(L, B);
  ctx.lineTo(R, B);
  ctx.stroke();
  if (lo < 0 && hi > 0) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L, Y(0));
    ctx.lineTo(R, Y(0));
    ctx.stroke();
  }
  const col = { S: C.sC, P: C.pC, F: C.fC },
    iNow = Math.round((st.t / st.T) * N);
  for (const k of show) {
    const a = ser[k];
    ctx.save();
    ctx.strokeStyle = col[k];
    ctx.lineJoin = "round";
    if (k === "F") ctx.setLineDash([6, 4]);
    if (!st.pred.on) {
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      ctx.beginPath();
      a.forEach((v, i) => {
        i ? ctx.lineTo(X((st.T * i) / N), Y(v)) : ctx.moveTo(X(0), Y(v));
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = k === "F" ? 2 : 2.6;
    ctx.beginPath();
    for (let i = 0; i <= iNow; i++) {
      const x = X((st.T * i) / N),
        y = Y(a[i]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X(st.t), Tp);
  ctx.lineTo(X(st.t), B);
  ctx.stroke();
  const u = qq === "r" ? U("L") : U("V"),
    sb = c ? "y" : "x",
    R2 = rotating() ? " (along the turning axes)" : "";
  const lg =
    qq === "r"
      ? [
          `${sb} of the object in S`,
          `${sb}${PR} of the object in S${PR}${R2}`,
          `${sb.toUpperCase()} of O${PR} in S`,
        ]
      : [
          `v<sub>${sb}</sub> in S`,
          `v${PR}<sub>${sb}</sub> in S${PR}${R2}`,
          `V<sub>${sb}</sub> of O${PR} in S`,
        ];
  $("#glegend").innerHTML =
    `<span><i style="border-color:var(--sC)"></i>${lg[0]}</span>${hid === "P" ? "" : `<span><i style="border-color:var(--pC)"></i>${lg[1]}</span>`}<span><i style="border-color:var(--fC);border-top-style:dashed"></i>${lg[2]}</span><span style="color:var(--muted)">${u}</span>`;
  if (hid === "S") $("#glegend").firstElementChild.remove();
}
