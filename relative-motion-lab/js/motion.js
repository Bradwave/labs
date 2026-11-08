// Relative Motion Lab: Motion models and the change of reference frame (translating and rotating).
import { D2R, add, sub, scl, rot, cr } from "./vec.js";
import { st } from "./state.js";

export const TYPES = {
  rest: { name: "At rest", keys: ["x0", "y0"] },
  uniform: { name: "Constant velocity", keys: ["x0", "y0", "vx", "vy"] },
  accel: { name: "Constant acceleration", keys: ["x0", "y0", "vx", "vy", "ax", "ay"] },
  circular: { name: "Uniform circular", keys: ["cx", "cy", "R", "w", "phi"] },
  harmonic: { name: "Oscillation", keys: ["cx", "cy", "Ax", "Ay", "w", "phi"] },
};
export const DEF = {
  x0: 0,
  y0: 0,
  vx: 1,
  vy: 0,
  ax: 0,
  ay: 0,
  cx: 0,
  cy: 0,
  R: 1,
  w: 1,
  phi: 0,
  Ax: 1,
  Ay: 0,
};
export const LAB = {
  x0: ["x<sub>0</sub>", "X<sub>0</sub>", "L"],
  y0: ["y<sub>0</sub>", "Y<sub>0</sub>", "L"],
  vx: ["v<sub>x</sub>", "V<sub>x</sub>", "V"],
  vy: ["v<sub>y</sub>", "V<sub>y</sub>", "V"],
  ax: ["a<sub>x</sub>", "A<sub>x</sub>", "A"],
  ay: ["a<sub>y</sub>", "A<sub>y</sub>", "A"],
  cx: ["center x", "center x", "L"],
  cy: ["center y", "center y", "L"],
  R: ["radius", "radius", "L"],
  w: ["ω", "ω", "W"],
  phi: ["φ<sub>0</sub>", "φ<sub>0</sub>", "D"],
  Ax: ["amplitude x", "amplitude x", "L"],
  Ay: ["amplitude y", "amplitude y", "L"],
  Om: ["Ω", "Ω", "W"],
  th0: ["θ<sub>0</sub>", "θ<sub>0</sub>", "D"],
};
export function ev(m, t) {
  const p = m.p;
  switch (m.type) {
    case "rest":
      return { r: [p.x0, p.y0], v: [0, 0], a: [0, 0] };
    case "uniform":
      return { r: [p.x0 + p.vx * t, p.y0 + p.vy * t], v: [p.vx, p.vy], a: [0, 0] };
    case "accel":
      return {
        r: [p.x0 + p.vx * t + 0.5 * p.ax * t * t, p.y0 + p.vy * t + 0.5 * p.ay * t * t],
        v: [p.vx + p.ax * t, p.vy + p.ay * t],
        a: [p.ax, p.ay],
      };
    case "circular": {
      const th = p.phi * D2R + p.w * t,
        c = Math.cos(th),
        s = Math.sin(th),
        R = p.R,
        w = p.w;
      return {
        r: [p.cx + R * c, p.cy + R * s],
        v: [-R * w * s, R * w * c],
        a: [-R * w * w * c, -R * w * w * s],
      };
    }
    case "harmonic": {
      const th = p.w * t + p.phi * D2R,
        s = Math.sin(th),
        c = Math.cos(th),
        w = p.w;
      return {
        r: [p.cx + p.Ax * s, p.cy + p.Ay * s],
        v: [p.Ax * w * c, p.Ay * w * c],
        a: [-p.Ax * w * w * s, -p.Ay * w * w * s],
      };
    }
  }
}
export function toP(Q, F) {
  const W = F.Om,
    rp = rot(sub(Q.r, F.r), -F.th),
    vp = sub(rot(sub(Q.v, F.v), -F.th), cr(W, rp)),
    ap = add(sub(rot(sub(Q.a, F.a), -F.th), cr(2 * W, vp)), scl(rp, W * W));
  return { r: rp, v: vp, a: ap };
}
export function fromP(Q, F) {
  const W = F.Om;
  return {
    r: add(F.r, rot(Q.r, F.th)),
    v: add(F.v, rot(add(Q.v, cr(W, Q.r)), F.th)),
    a: add(F.a, rot(add(add(Q.a, cr(2 * W, Q.v)), scl(Q.r, -W * W)), F.th)),
  };
}
export function frameAt(t) {
  const F = ev(st.frame, t);
  F.Om = st.rot.Om;
  F.th = st.rot.th0 * D2R + st.rot.Om * t;
  return F;
}
export function kin(t) {
  const F = frameAt(t),
    O = ev(st.obj, t);
  let S, P;
  if (st.obj.in === "S") {
    S = O;
    P = toP(O, F);
  } else {
    P = O;
    S = fromP(O, F);
  }
  const W = F.Om,
    th = F.th;
  const T = {
    rP: rot(P.r, th),
    vP: rot(P.v, th),
    aP: rot(P.a, th),
    tr: rot(cr(W, P.r), th),
    cor: rot(cr(2 * W, P.v), th),
    cen: rot(scl(P.r, -W * W), th),
  };
  return { F, S, P, T };
}
export const rotating = () => Math.abs(st.rot.Om) > 1e-12;
export function frameInertial() {
  if (rotating()) return false;
  const m = st.frame,
    p = m.p;
  switch (m.type) {
    case "rest":
    case "uniform":
      return true;
    case "accel":
      return !p.ax && !p.ay;
    case "circular":
      return !p.R || !p.w;
    case "harmonic":
      return !p.w || (!p.Ax && !p.Ay);
  }
  return true;
}
