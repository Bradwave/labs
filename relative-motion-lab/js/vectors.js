// Relative Motion Lab: Vector-addition diagram.
import { $ } from "./dom.js";
import { PR, add, sub, neg, len, Z } from "./vec.js";
import { kin, rotating } from "./motion.js";
import { ui, st, U } from "./state.js";
import { vec, C } from "./canvas.js";
import { bb, addP } from "./layout.js";
import { arrow, txt, fv } from "./panels.js";

export function chain() {
  const k = kin(st.t),
    T = k.T,
    R = rotating();
  if (st.vq === "dr") {
    if (R)
      return {
        res: { v: k.S.r, l: "r" },
        items: [
          { v: k.F.r, l: "R", c: C.fC },
          { v: T.rP, l: "r" + PR, c: C.pC },
        ],
        u: "L",
        kind: "d",
        note: "With a rotating frame, displacements don’t simply add, but positions still do: r = R + r′, with r′ drawn in the axes of S.",
      };
    const k0 = kin(0);
    return {
      res: { v: sub(k.S.r, k0.S.r), l: "Δr" },
      items: [
        { v: sub(k.F.r, k0.F.r), l: "ΔR", c: C.fC },
        { v: sub(k.P.r, k0.P.r), l: "Δr" + PR, c: C.pC },
      ],
      u: "L",
      kind: "d",
      note: "Displacements since t = 0.",
    };
  }
  if (st.vq === "v") {
    const it = [
      { v: k.F.v, l: "V", c: C.fC },
      { v: T.vP, l: "v" + PR, c: C.pC },
    ];
    if (R) it.push({ v: T.tr, l: "Ω×r" + PR, c: C.ink });
    return {
      res: { v: k.S.v, l: "v" },
      items: it,
      u: "V",
      kind: "v",
      note: R
        ? "Ω×r′ is the velocity of the point of S′ where the object is. v′ is drawn in the axes of S."
        : "",
    };
  }
  const it = [
    { v: k.F.a, l: "A", c: C.fC },
    { v: T.aP, l: "a" + PR, c: C.pC },
  ];
  if (R) it.push({ v: T.cor, l: "2Ω×v" + PR, c: C.ink }, { v: T.cen, l: "−Ω²r" + PR, c: C.muted });
  return {
    res: { v: k.S.a, l: "a" },
    items: it,
    u: "A",
    kind: "a",
    note: R ? "2Ω×v′ is the Coriolis term, −Ω²r′ the centripetal term. a′ is drawn in the axes of S." : "",
  };
}
export function drawVec() {
  const o = vec,
    ctx = o.ctx,
    w = o.w,
    h = o.h;
  ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, w, h);
  if (st.pred.on) {
    txt(ctx, "Hidden while you predict.", w / 2, h / 2, C.muted, "center", 11.5, "400");
    $("#vals").innerHTML = "";
    $("#vnote").textContent = "";
    return;
  }
  const q = chain(),
    b = bb();
  let acc = [0, 0];
  addP(b, Z);
  for (const it of q.items) {
    acc = add(acc, it.v);
    addP(b, acc);
  }
  addP(b, q.res.v);
  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  if (span < 1e-9) txt(ctx, "All zero at this instant.", w / 2, h / 2, C.muted, "center", 11.5, "400");
  else {
    const s = Math.min(
      (w - 60) / Math.max(b.x1 - b.x0, span * 0.05),
      (h - 50) / Math.max(b.y1 - b.y0, span * 0.05),
    );
    const cx = (b.x0 + b.x1) / 2,
      cy = (b.y0 + b.y1) / 2,
      X = (x) => w / 2 + (x - cx) * s,
      Y = (y) => h / 2 - (y - cy) * s;
    const nz = q.items.filter((it) => len(it.v) * s >= 3),
      single = nz.length === 1 && len(sub(nz[0].v, q.res.v)) * s < 3;
    const rdx = q.res.v[0] * s,
      rdy = -q.res.v[1] * s,
      rl = Math.hypot(rdx, rdy) || 1,
      first = nz[0] ? nz[0].v : Z;
    const side = (-rdy / rl) * first[0] * s + (rdx / rl) * (-first[1] * s) > 0 ? -1 : 1;
    ctx.save();
    ctx.globalAlpha = 0.3;
    arrow(ctx, X(0), Y(0), rdx, rdy, C.sC, "v", null);
    ctx.restore();
    arrow(ctx, X(0), Y(0), rdx, rdy, C.sC, q.kind, single ? null : q.res.l, side);
    let p = [0, 0];
    for (const it of q.items) {
      arrow(
        ctx,
        X(p[0]),
        Y(p[1]),
        it.v[0] * s,
        -it.v[1] * s,
        it.c,
        q.kind,
        single && it === nz[0] ? q.res.l + " = " + it.l : it.l,
        single ? 1 : 0,
      );
      p = add(p, it.v);
    }
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const u = U(q.u),
    cls = (c) => (c === C.fC ? "f" : c === C.pC ? "p" : "");
  const eq = q.items
    .map((it, i) => {
      const neg = it.l[0] === "−";
      return (
        (i ? (neg ? " − " : " + ") : "") + `<i class="${cls(it.c)}">${neg && i ? it.l.slice(1) : it.l}</i>`
      );
    })
    .join("");
  $("#vals").innerHTML =
    `<span style="grid-column:1/-1" class="eq"><i class="s">${q.res.l}</i> = ${eq}</span><i class="s">${q.res.l}</i><span>${fv(q.res.v)} ${u}</span>` +
    q.items.map((it) => `<i class="${cls(it.c)}">${it.l}</i><span>${fv(it.v)} ${u}</span>`).join("");
  $("#vnote").textContent = q.note;
}
