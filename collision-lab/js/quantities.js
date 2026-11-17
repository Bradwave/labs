// Collision Lab · quantities.js
// The quantities of the time graph (pure, no DOM): what each one plots for a disc, whether it has a total or the
// centre of mass as its extra series, and its axis label. Samples are recorded in the lab frame; in the
// centre-of-mass frame positions are measured from the centre of mass and velocities relative to it.

export const QUANTITIES = ["x", "y", "vx", "vy", "px", "py", "K"];
export const DEFAULT_QUANTITY = "px";

const LABELS = {
  x: "x (m)", y: "y (m)",
  vx: "v_x (m/s)", vy: "v_y (m/s)",
  px: "p_x (kg·m/s)", py: "p_y (kg·m/s)",
  K: "K (J)",
};
export const axisLabel = (q) => LABELS[q] || LABELS[DEFAULT_QUANTITY];
// positions get the centre of mass as extra series; the others the sum over the discs
export const extraKind = (q) => (q === "x" || q === "y" ? "cm" : "tot");

// value of quantity q for disc d (index i) in sample s; cm = centre-of-mass frame
export function valueOf(q, s, d, i, cm) {
  const p = s.p[i];
  if (q === "x") return p.x - (cm ? s.X : 0);
  if (q === "y") return p.y - (cm ? s.Y : 0);
  const vx = p.vx - (cm ? s.Vx : 0), vy = p.vy - (cm ? s.Vy : 0);
  if (q === "vx") return vx;
  if (q === "vy") return vy;
  if (q === "px") return d.m * vx;
  if (q === "py") return d.m * vy;
  return 0.5 * d.m * (vx * vx + vy * vy);
}
// the extra series: total over the discs, or the centre of mass for positions
export function extraOf(q, s, discs, cm) {
  if (q === "x") return cm ? 0 : s.X;
  if (q === "y") return cm ? 0 : s.Y;
  return discs.reduce((a, d, i) => a + valueOf(q, s, d, i, cm), 0);
}
