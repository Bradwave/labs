// Relative Motion Lab: Same-or-different table and the frame message.
import { $ } from "./dom.js";
import { sub, len } from "./vec.js";
import { kin, rotating, frameInertial } from "./motion.js";
import { st, U } from "./state.js";
import { ext } from "./layout.js";
import { f2, fv } from "./panels.js";

export function updateTable() {
  const k = kin(st.t),
    k0 = kin(0),
    hid = st.pred.on ? st.pred.panel : null,
    eqv = (a, b, sc) => len(sub(a, b)) <= 1e-6 * Math.max(1, sc);
  const sc = Math.max(1, len(k.S.r), len(k.P.r)),
    q = "?";
  const rows = [
    [`t <small>${st.units[1]}</small>`, f2(st.t), f2(st.t), true],
    [`position <small>${st.units[0]}</small>`, fv(k.S.r), fv(k.P.r), eqv(k.S.r, k.P.r, sc)],
    [
      `displacement Δr <small>${st.units[0]}, since t = 0</small>`,
      fv(sub(k.S.r, k0.S.r)),
      fv(sub(k.P.r, k0.P.r)),
      eqv(sub(k.S.r, k0.S.r), sub(k.P.r, k0.P.r), sc),
    ],
    [`velocity <small>${U("V")}</small>`, fv(k.S.v), fv(k.P.v), eqv(k.S.v, k.P.v, ext.mv || 1)],
    [
      `speed <small>${U("V")}</small>`,
      f2(len(k.S.v)),
      f2(len(k.P.v)),
      Math.abs(len(k.S.v) - len(k.P.v)) <= 1e-6 * Math.max(1, ext.mv || 1),
    ],
    [`acceleration <small>${U("A")}</small>`, fv(k.S.a), fv(k.P.a), eqv(k.S.a, k.P.a, ext.ma || 1)],
  ];
  $("#tbody").innerHTML = rows
    .map((r, i) => {
      const sv = hid === "S" && i ? q : r[1],
        pv = hid === "P" && i ? q : r[2],
        vd = hid && i ? "" : `<span class="${r[3] ? "v-same" : "v-diff"}">${r[3] ? "same" : "differ"}</span>`;
      return `<tr><td>${r[0]}</td><td>${sv}</td><td>${pv}</td><td>${vd}</td></tr>`;
    })
    .join("");
}
export function updateFrameMsg() {
  $("#frameMsg").innerHTML = rotating()
    ? 'S′ rotates (Ω ≠ 0): its axes turn, so even an object at rest in S goes round in circles for S′. Two extra terms appear: <i class="q">v</i> = <i class="q">V</i> + <i class="q">v</i>′ + Ω×<i class="q">r</i>′ and <i class="q">a</i> = <i class="q">A</i> + <i class="q">a</i>′ + 2Ω×<i class="q">v</i>′ − Ω²<i class="q">r</i>′.'
    : frameInertial()
      ? 'S′ moves at constant velocity relative to S, so it is inertial too: <i class="q">a</i>′ = <i class="q">a</i> at every instant. Positions, displacements and velocities can still differ.'
      : 'S′ accelerates relative to S (<i class="q">A</i> ≠ 0), so the two observers disagree about acceleration too: <i class="q">a</i>′ = <i class="q">a</i> − <i class="q">A</i>.';
}
