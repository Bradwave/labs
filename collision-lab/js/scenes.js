// Collision Lab · scenes.js
// The five set-ups (pure, no DOM): parameters with ranges, the starting discs they build, and the handles that
// let the student drag a disc or the tip of its velocity arrow on the table before the start.

export const TABLE = { W: 2.0, H: 1.2 }; // metres: the visible air table
export const VSCALE = 0.25; // metres of arrow per m/s (velocity arrows and their handles)
export const SPLIT_AT = 0.5; // seconds: when the explosion happens

// discs of equal thickness and material: the area grows with the mass
export const radius = (m) => 0.045 * Math.sqrt(m / 0.25);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const snap = (v, s) => Math.round(v / s) * s;
const cy = TABLE.H / 2;

const mass = (k, def) => ({ k, min: 0.1, max: 1, step: 0.05, def, unit: "kg", digits: 2, label: "p." + k });
const speed = (k, def, min = -2) => ({ k, min, max: 2, step: 0.05, def, unit: "m/s", digits: 2, label: "p." + k });
const hidden = (k, def, min, max) => ({ k, min, max, step: 0.005, def, hidden: true });

export const SCENES = [
  {
    id: "headon",
    params: [mass("m1", 0.25), mass("m2", 0.25), speed("v1", 1), speed("v2", 0), hidden("x1", 0.5, 0.02, 1.98), hidden("x2", 1.2, 0.02, 1.98)],
    build(p) {
      return [
        { m: p.m1, r: radius(p.m1), x: p.x1, y: cy, vx: p.v1, vy: 0 },
        { m: p.m2, r: radius(p.m2), x: p.x2, y: cy, vx: p.v2, vy: 0 },
      ];
    },
    handles(p, B) {
      const R = B[0].r + B[1].r + 0.005;
      return [
        posH(0, B, (p, x) => (p.x1 = clamp(snap(x, 0.01), B[0].r, p.x2 - R)), "x"),
        posH(1, B, (p, x) => (p.x2 = clamp(snap(x, 0.01), p.x1 + R, TABLE.W - B[1].r)), "x"),
        velH(0, B, (p, vx) => (p.v1 = clamp(snap(vx, 0.05), -2, 2)), "x"),
        velH(1, B, (p, vx) => (p.v2 = clamp(snap(vx, 0.05), -2, 2)), "x"),
      ];
    },
  },
  {
    id: "glancing",
    params: [mass("m1", 0.25), mass("m2", 0.25), speed("v1", 1, 0), { k: "b", min: -1, max: 1, step: 0.05, def: 0.5, unit: "", digits: 2, label: "p.b" }, hidden("x1", 0.4, 0.02, 1.0)],
    build(p) {
      const r1 = radius(p.m1), r2 = radius(p.m2);
      return [
        { m: p.m1, r: r1, x: p.x1, y: cy + p.b * (r1 + r2), vx: p.v1, vy: 0 },
        { m: p.m2, r: r2, x: 1.15, y: cy, vx: 0, vy: 0 },
      ];
    },
    handles(p, B) {
      const R = B[0].r + B[1].r;
      return [
        posH(0, B, (p, x, y) => {
          p.x1 = clamp(snap(x, 0.01), B[0].r, 1.0);
          p.b = clamp(snap((y - cy) / R, 0.05), -1, 1);
        }, "xy"),
        velH(0, B, (p, vx) => (p.v1 = clamp(snap(vx, 0.05), 0, 2)), "x"),
      ];
    },
  },
  {
    id: "free",
    params: [
      mass("m1", 0.25), mass("m2", 0.5),
      hidden("x1", 0.5, 0.02, 1.98), hidden("y1", 0.45, 0.02, 1.18), hidden("v1x", 1, -2, 2), hidden("v1y", 0.3, -2, 2),
      hidden("x2", 1.5, 0.02, 1.98), hidden("y2", 0.75, 0.02, 1.18), hidden("v2x", -0.6, -2, 2), hidden("v2y", -0.1, -2, 2),
    ],
    build(p) {
      return [
        { m: p.m1, r: radius(p.m1), x: p.x1, y: p.y1, vx: p.v1x, vy: p.v1y },
        { m: p.m2, r: radius(p.m2), x: p.x2, y: p.y2, vx: p.v2x, vy: p.v2y },
      ];
    },
    handles(p, B) {
      const R = B[0].r + B[1].r + 0.005;
      const place = (i, kx, ky) => (p, x, y) => {
        const nx = clamp(snap(x, 0.01), B[i].r, TABLE.W - B[i].r), ny = clamp(snap(y, 0.01), B[i].r, TABLE.H - B[i].r);
        const o = B[1 - i];
        if (Math.hypot(nx - o.x, ny - o.y) < R) return;
        p[kx] = nx;
        p[ky] = ny;
      };
      const vel = (kx, ky) => (p, vx, vy) => {
        p[kx] = clamp(snap(vx, 0.05), -2, 2);
        p[ky] = clamp(snap(vy, 0.05), -2, 2);
      };
      return [posH(0, B, place(0, "x1", "y1"), "xy"), posH(1, B, place(1, "x2", "y2"), "xy"), velH(0, B, vel("v1x", "v1y"), "xy"), velH(1, B, vel("v2x", "v2y"), "xy")];
    },
  },
  {
    id: "explosion",
    params: [mass("m1", 0.25), mass("m2", 0.5), { k: "E", min: 0, max: 1, step: 0.05, def: 0.3, unit: "J", digits: 2, label: "p.E" }, speed("v0", 0), { k: "phi", min: 0, max: 180, step: 15, def: 0, unit: "°", digits: 0, label: "p.phi" }],
    split: (p) => ({ at: SPLIT_AT, E: p.E }),
    build(p) {
      const r1 = radius(p.m1), r2 = radius(p.m2), M = p.m1 + p.m2, d = r1 + r2;
      const a = (p.phi * Math.PI) / 180, nx = Math.cos(a), ny = Math.sin(a);
      const X = clamp(TABLE.W / 2 - p.v0 * SPLIT_AT, 0.3, TABLE.W - 0.3);
      return [
        { m: p.m1, r: r1, x: X - nx * d * (p.m2 / M), y: cy - ny * d * (p.m2 / M), vx: p.v0, vy: 0, group: 1 },
        { m: p.m2, r: r2, x: X + nx * d * (p.m1 / M), y: cy + ny * d * (p.m1 / M), vx: p.v0, vy: 0, group: 1 },
      ];
    },
    handles(p, B) {
      const M = p.m1 + p.m2, X = (B[0].x * p.m1 + B[1].x * p.m2) / M, Y = (B[0].y * p.m1 + B[1].y * p.m2) / M;
      return [
        // drag B around the pair to turn the line along which it comes apart
        posH(1, B, (p, x, y) => {
          let a = (Math.atan2(y - Y, x - X) * 180) / Math.PI;
          if (a < 0) a += 360;
          if (a > 180) a -= 180; // the line, not the direction: B may sit on either side
          p.phi = clamp(snap(a, 15), 0, 180);
        }, "xy"),
        { ...velH(0, B, (p, vx) => (p.v0 = clamp(snap(vx, 0.05), -2, 2)), "x"), x: X, y: Y, tipX: X + B[0].vx * VSCALE, tipY: Y },
      ];
    },
  },
  {
    id: "break",
    params: [mass("m1", 0.25), speed("v1", 1.5, 0), { k: "b", min: -1, max: 1, step: 0.05, def: 0, unit: "", digits: 2, label: "p.b" }, { ...mass("m2", 0.25), label: "p.mrack" }, { k: "rows", min: 2, max: 4, step: 1, def: 3, unit: "", digits: 0, label: "p.rows" }, hidden("x1", 0.35, 0.02, 0.9)],
    build(p) {
      const r1 = radius(p.m1), r2 = radius(p.m2);
      const out = [{ m: p.m1, r: r1, x: p.x1, y: cy + p.b * (r1 + r2), vx: p.v1, vy: 0 }];
      const gap = 0.002, dx = (2 * r2 + gap) * Math.cos(Math.PI / 6), dy = r2 + gap / 2;
      for (let row = 0; row < p.rows; row++)
        for (let k = 0; k <= row; k++) out.push({ m: p.m2, r: r2, x: 1.15 + row * dx, y: cy + (2 * k - row) * dy, vx: 0, vy: 0 });
      return out;
    },
    handles(p, B) {
      const R = B[0].r + B[1].r;
      return [
        posH(0, B, (p, x, y) => {
          p.x1 = clamp(snap(x, 0.01), B[0].r, 0.9);
          p.b = clamp(snap((y - cy) / R, 0.05), -1, 1);
        }, "xy"),
        velH(0, B, (p, vx) => (p.v1 = clamp(snap(vx, 0.05), 0, 2)), "x"),
      ];
    },
  },
];

function posH(i, B, set, axes) {
  return { body: i, kind: "pos", axes, x: B[i].x, y: B[i].y, tipX: B[i].x, tipY: B[i].y, set };
}
// a velocity handle sits at the tip of the arrow; set(p, vx, vy) receives the velocity the tip now shows
function velH(i, B, set, axes) {
  const b = B[i];
  return {
    body: i, kind: "vel", axes, x: b.x, y: b.y, tipX: b.x + b.vx * VSCALE, tipY: b.y + b.vy * VSCALE,
    set: (p, wx, wy, h) => set(p, (wx - h.x) / VSCALE, axes === "x" ? 0 : (wy - h.y) / VSCALE),
  };
}

export const sceneById = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
export function defaults(scene) {
  return Object.fromEntries(scene.params.map((q) => [q.k, q.def]));
}
// keeps every parameter inside its range (used after reading a link)
export function sanitize(scene, p) {
  const out = defaults(scene);
  for (const q of scene.params) {
    const v = Number(p?.[q.k]);
    if (Number.isFinite(v)) out[q.k] = clamp(q.step >= 1 ? Math.round(v) : v, q.min, q.max);
  }
  return out;
}
