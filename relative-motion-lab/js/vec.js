// Relative Motion Lab: 2D vector helpers and shared constants.

export const PR = "\u2032",
  D2R = Math.PI / 180;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  neg = (a) => [-a[0], -a[1]],
  len = (a) => Math.hypot(a[0], a[1]),
  scl = (a, k) => [a[0] * k, a[1] * k];
export const rot = (a, th) => {
  const c = Math.cos(th),
    s = Math.sin(th);
  return [c * a[0] - s * a[1], s * a[0] + c * a[1]];
};
export const cr = (w, u) => [-w * u[1], w * u[0]];
export const Z = [0, 0];
