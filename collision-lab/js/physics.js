// Collision Lab · physics.js
// Pure model (no DOM): discs on a frictionless air table, rigid clusters of discs stuck together, exact contact
// times for discs that do not rotate, impulses with a coefficient of restitution, explosions, optional bumpers.
//
// A world holds discs (mass, radius, label) and clusters. Every disc belongs to exactly one cluster; a free disc
// is a cluster of one. A cluster is a rigid body: centre of mass (X, Y), velocity (VX, VY), angle th, angular
// velocity w, mass M, moment of inertia I = Σ m·|o|² (discs as point masses at their centres, so that the
// kinetic energy of a cluster is exactly Σ ½·m·v² over its discs).

const EPS = 1e-12;
const ROT_STEP = 1 / 1000; // sub-step while some cluster rotates (contacts found by overlap, not exactly)

// bodies: [{ m, r, x, y, vx, vy, label?, group? }]; discs with the same `group` start stuck together.
// opts: { e: restitution 0..1, sticky: discs stick on contact, walls: null | { W, H } bumpers of the table }
export function createWorld(bodies, opts = {}) {
  const world = {
    discs: bodies.map((b, i) => ({ id: i, m: b.m, r: b.r, label: b.label ?? String.fromCharCode(65 + i), c: null })),
    clusters: [],
    t: 0,
    e: opts.e ?? 1,
    sticky: !!opts.sticky,
    walls: opts.walls || null,
    ext: { x: 0, y: 0 }, // impulse given by the bumpers so far (the only external force)
    events: [], // { t, kind: "hit" | "stick" | "wall" | "split", a, b, J }
  };
  const groups = new Map();
  bodies.forEach((b, i) => {
    if (b.group == null) return addCluster(world, [i], [b]);
    if (!groups.has(b.group)) groups.set(b.group, []);
    groups.get(b.group).push(i);
  });
  for (const ids of groups.values()) addCluster(world, ids, ids.map((i) => bodies[i]));
  return world;
}

// a cluster from discs given with absolute positions and velocities (the velocities of a group must be equal)
function addCluster(world, ids, states) {
  let M = 0, X = 0, Y = 0, PX = 0, PY = 0;
  ids.forEach((id, k) => {
    const m = world.discs[id].m, s = states[k];
    M += m; X += m * s.x; Y += m * s.y; PX += m * (s.vx || 0); PY += m * (s.vy || 0);
  });
  X /= M; Y /= M;
  const members = ids.map((id, k) => ({ d: id, ox: states[k].x - X, oy: states[k].y - Y }));
  const I = members.reduce((s, o) => s + world.discs[o.d].m * (o.ox * o.ox + o.oy * o.oy), 0);
  const c = { members, M, I, X, Y, VX: PX / M, VY: PY / M, th: 0, w: 0 };
  world.clusters.push(c);
  for (const o of members) world.discs[o.d].c = c;
  return c;
}

export function cloneWorld(w) {
  const discs = w.discs.map((d) => ({ ...d, c: null }));
  const clusters = w.clusters.map((c) => ({ ...c, members: c.members.map((o) => ({ ...o })) }));
  clusters.forEach((c) => c.members.forEach((o) => (discs[o.d].c = c)));
  return { ...w, discs, clusters, walls: w.walls && { ...w.walls }, ext: { ...w.ext }, events: w.events.map((e) => ({ ...e })) };
}

// ---------- kinematics of one disc ----------
function offset(c, o) {
  const cs = Math.cos(c.th), sn = Math.sin(c.th);
  return [cs * o.ox - sn * o.oy, sn * o.ox + cs * o.oy];
}
function memberOf(d) {
  return d.c.members.find((o) => o.d === d.id);
}
// absolute position and velocity of disc i: { x, y, vx, vy }
export function discState(world, i) {
  const d = world.discs[i], c = d.c;
  const [rx, ry] = offset(c, memberOf(d));
  return { x: c.X + rx, y: c.Y + ry, vx: c.VX - c.w * ry, vy: c.VY + c.w * rx };
}
export function states(world) {
  return world.discs.map((_, i) => discState(world, i));
}

// ---------- totals ----------
// Momentum, kinetic energy, centre of mass. With frame = { vx, vy } the velocities are measured in a frame moving
// at that velocity (the centre-of-mass frame when it is the velocity of the centre of mass).
export function totals(world, frame = null) {
  const fx = frame ? frame.vx : 0, fy = frame ? frame.vy : 0;
  let M = 0, X = 0, Y = 0, Px = 0, Py = 0, K = 0;
  const per = world.discs.map((d, i) => {
    const s = discState(world, i);
    const vx = s.vx - fx, vy = s.vy - fy;
    const px = d.m * vx, py = d.m * vy, k = 0.5 * d.m * (vx * vx + vy * vy);
    M += d.m; X += d.m * s.x; Y += d.m * s.y; Px += px; Py += py; K += k;
    return { x: s.x, y: s.y, vx, vy, px, py, K: k };
  });
  // kinetic energy of the motion of the centre of mass: it can never be lost in a collision
  const Kcm = (Px * Px + Py * Py) / (2 * M);
  return { per, M, X: X / M, Y: Y / M, Px, Py, P: Math.hypot(Px, Py), K, Kcm, Kint: K - Kcm, Vx: Px / M, Vy: Py / M };
}

// ---------- contact times ----------
// Time t ≥ 0 at which two discs moving uniformly touch (|d + w·t| = R), or null if they do not approach.
export function contactTime(dx, dy, wx, wy, R) {
  const b = dx * wx + dy * wy; // half the linear coefficient
  if (b >= -EPS) return null; // separating or sliding past
  const c = dx * dx + dy * dy - R * R;
  if (c <= 0) return 0; // already touching and approaching
  const a = wx * wx + wy * wy;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  return (-b - Math.sqrt(disc)) / a;
}
// time at which a disc reaches a bumper (walls: 0 ≤ x ≤ W, 0 ≤ y ≤ H)
function wallTime(s, r, walls) {
  let best = null;
  const tryWall = (pos, v, lim, nx, ny) => {
    // lim: the coordinate the centre must reach; v must point towards it
    const gap = lim - pos;
    if (Math.abs(v) < EPS || Math.sign(gap) !== Math.sign(v)) {
      if (Math.abs(gap) < 1e-9 && Math.sign(v) === -Math.sign(nx || ny)) best = best && best.t <= 0 ? best : { t: 0, nx, ny };
      return;
    }
    const t = gap / v;
    if (!best || t < best.t) best = { t: Math.max(0, t), nx, ny };
  };
  if (s.x - r < 0 && s.vx < 0) return { t: 0, nx: 1, ny: 0 };
  if (s.x + r > walls.W && s.vx > 0) return { t: 0, nx: -1, ny: 0 };
  if (s.y - r < 0 && s.vy < 0) return { t: 0, nx: 0, ny: 1 };
  if (s.y + r > walls.H && s.vy > 0) return { t: 0, nx: 0, ny: -1 };
  if (s.vx < 0) tryWall(s.x, s.vx, r, 1, 0);
  if (s.vx > 0) tryWall(s.x, s.vx, walls.W - r, -1, 0);
  if (s.vy < 0) tryWall(s.y, s.vy, r, 0, 1);
  if (s.vy > 0) tryWall(s.y, s.vy, walls.H - r, 0, -1);
  return best;
}

// ---------- collision response ----------
const cross = (ax, ay, bx, by) => ax * by - ay * bx;

// Impulse between disc a and disc b (different clusters), normal from a to b.
function hit(world, ia, ib) {
  const A = world.discs[ia].c, B = world.discs[ib].c;
  const sa = discState(world, ia), sb = discState(world, ib);
  let nx = sb.x - sa.x, ny = sb.y - sa.y;
  const dist = Math.hypot(nx, ny) || 1;
  nx /= dist; ny /= dist;
  const ra = world.discs[ia].r;
  const cx = sa.x + ra * nx, cy = sa.y + ra * ny; // contact point
  const rAx = cx - A.X, rAy = cy - A.Y, rBx = cx - B.X, rBy = cy - B.Y;
  const vAx = A.VX - A.w * rAy, vAy = A.VY + A.w * rAx;
  const vBx = B.VX - B.w * rBy, vBy = B.VY + B.w * rBx;
  const vrel = (vBx - vAx) * nx + (vBy - vAy) * ny;
  if (vrel >= -EPS) return false;
  if (world.sticky) {
    merge(world, A, B);
    world.events.push({ t: world.t, kind: "stick", a: ia, b: ib, J: NaN });
    return true;
  }
  const cA = cross(rAx, rAy, nx, ny), cB = cross(rBx, rBy, nx, ny);
  const k = 1 / A.M + 1 / B.M + (A.I > EPS ? (cA * cA) / A.I : 0) + (B.I > EPS ? (cB * cB) / B.I : 0);
  const J = (-(1 + world.e) * vrel) / k; // J > 0: pushes b away from a
  A.VX -= (J * nx) / A.M; A.VY -= (J * ny) / A.M;
  B.VX += (J * nx) / B.M; B.VY += (J * ny) / B.M;
  if (A.I > EPS) A.w -= (cA * J) / A.I;
  if (B.I > EPS) B.w += (cB * J) / B.I;
  world.events.push({ t: world.t, kind: "hit", a: ia, b: ib, J });
  return true;
}

// Elastic bounce of disc i on a bumper with inward normal (nx, ny).
function bounce(world, i, nx, ny) {
  const C = world.discs[i].c, s = discState(world, i), r = world.discs[i].r;
  const cx = s.x - r * nx, cy = s.y - r * ny;
  const rx = cx - C.X, ry = cy - C.Y;
  const vx = C.VX - C.w * ry, vy = C.VY + C.w * rx;
  const vn = vx * nx + vy * ny;
  if (vn >= -EPS) return false;
  const cr = cross(rx, ry, nx, ny);
  const k = 1 / C.M + (C.I > EPS ? (cr * cr) / C.I : 0);
  const J = (-2 * vn) / k;
  C.VX += (J * nx) / C.M; C.VY += (J * ny) / C.M;
  if (C.I > EPS) C.w += (cr * J) / C.I;
  world.ext.x += J * nx; world.ext.y += J * ny;
  world.events.push({ t: world.t, kind: "wall", a: i, b: -1, J });
  return true;
}

// Two clusters become one: momentum and angular momentum (about the new centre of mass) are kept.
function merge(world, A, B) {
  const M = A.M + B.M;
  const X = (A.M * A.X + B.M * B.X) / M, Y = (A.M * A.Y + B.M * B.Y) / M;
  const VX = (A.M * A.VX + B.M * B.VX) / M, VY = (A.M * A.VY + B.M * B.VY) / M;
  let L = 0;
  for (const C of [A, B]) L += C.M * cross(C.X - X, C.Y - Y, C.VX - VX, C.VY - VY) + C.I * C.w;
  const members = [];
  for (const C of [A, B])
    for (const o of C.members) {
      const [rx, ry] = offset(C, o);
      members.push({ d: o.d, ox: C.X + rx - X, oy: C.Y + ry - Y });
    }
  const I = members.reduce((s, o) => s + world.discs[o.d].m * (o.ox * o.ox + o.oy * o.oy), 0);
  const c = { members, M, I, X, Y, VX, VY, th: 0, w: I > EPS ? L / I : 0 };
  world.clusters = world.clusters.filter((k) => k !== A && k !== B);
  world.clusters.push(c);
  for (const o of members) world.discs[o.d].c = c;
  return c;
}

// Explosion: the cluster of disc i comes apart into free discs; a pair receives equal and opposite impulses along
// the line of centres that release the energy E (joules) as kinetic energy of the parts.
export function explode(world, i, E) {
  const C = world.discs[i].c;
  if (C.members.length < 2) return false;
  const st = C.members.map((o) => ({ id: o.d, ...discState(world, o.d) }));
  world.clusters = world.clusters.filter((k) => k !== C);
  for (const s of st) addCluster(world, [s.id], [s]);
  if (st.length === 2 && E > 0) {
    const [a, b] = st;
    const A = world.discs[a.id].c, B = world.discs[b.id].c;
    let nx = b.x - a.x, ny = b.y - a.y;
    const d = Math.hypot(nx, ny) || 1;
    nx /= d; ny /= d;
    const mu = (A.M * B.M) / (A.M + B.M);
    const J = mu * Math.sqrt((2 * E) / mu); // ½·μ·u² = E with u the separation speed
    A.VX -= (J * nx) / A.M; A.VY -= (J * ny) / A.M;
    B.VX += (J * nx) / B.M; B.VY += (J * ny) / B.M;
    world.events.push({ t: world.t, kind: "split", a: a.id, b: b.id, J });
  }
  return true;
}

// ---------- time step ----------
function drift(world, dt) {
  for (const c of world.clusters) {
    c.X += c.VX * dt; c.Y += c.VY * dt; c.th += c.w * dt;
  }
  world.t += dt;
}
const spins = (c) => Math.abs(c.w) > EPS;

// Advances the world by dt. Between contacts every cluster moves uniformly (no forces on an air table), so for
// non-rotating clusters the next contact is found exactly; rotating clusters use small sub-steps and overlaps.
export function step(world, dt) {
  let rem = dt, guard = 0;
  const n = world.discs.length;
  while (rem > EPS && guard++ < 20000) {
    const rot = world.clusters.some(spins);
    const h = rot ? Math.min(rem, ROT_STEP) : rem;
    let best = null;
    const S = states(world);
    for (let i = 0; i < n; i++) {
      const ci = world.discs[i].c;
      if (spins(ci)) continue;
      for (let j = i + 1; j < n; j++) {
        const cj = world.discs[j].c;
        if (cj === ci || spins(cj)) continue;
        const t = contactTime(S[j].x - S[i].x, S[j].y - S[i].y, S[j].vx - S[i].vx, S[j].vy - S[i].vy, world.discs[i].r + world.discs[j].r);
        if (t != null && t <= h && (!best || t < best.t)) best = { t, i, j };
      }
      if (world.walls) {
        const wt = wallTime(S[i], world.discs[i].r, world.walls);
        if (wt && wt.t <= h && (!best || wt.t < best.t)) best = { t: wt.t, i, j: -1, nx: wt.nx, ny: wt.ny };
      }
    }
    const adv = best ? best.t : h;
    drift(world, adv);
    rem -= adv;
    if (best) {
      const done = best.j >= 0 ? hit(world, best.i, best.j) : bounce(world, best.i, best.nx, best.ny);
      if (!done && adv === 0) {
        // nothing happened at t = 0 (grazing contact): move on a little to avoid looping
        const tiny = Math.min(rem, 1e-9);
        drift(world, tiny);
        rem -= tiny;
      }
    }
    if (rot) overlaps(world);
  }
}

// contacts involving rotating clusters: resolve every approaching overlap
function overlaps(world) {
  const n = world.discs.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const ci = world.discs[i].c, cj = world.discs[j].c;
      if (ci === cj || (!spins(ci) && !spins(cj))) continue;
      const a = discState(world, i), b = discState(world, j);
      const R = world.discs[i].r + world.discs[j].r;
      if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 < R * R) hit(world, i, j);
    }
  if (!world.walls) return;
  const { W, H } = world.walls;
  for (let i = 0; i < n; i++) {
    if (!spins(world.discs[i].c)) continue;
    const s = discState(world, i), r = world.discs[i].r;
    if (s.x - r < 0) bounce(world, i, 1, 0);
    else if (s.x + r > W) bounce(world, i, -1, 0);
    if (s.y - r < 0) bounce(world, i, 0, 1);
    else if (s.y + r > H) bounce(world, i, 0, -1);
  }
}

// ---------- analysis ----------
// Coefficient of restitution measured from velocities before and after, along the line of centres n.
export function restitution(before, after, nx, ny) {
  const vb = (before.b.vx - before.a.vx) * nx + (before.b.vy - before.a.vy) * ny;
  const va = (after.b.vx - after.a.vx) * nx + (after.b.vy - after.a.vy) * ny;
  return Math.abs(vb) < EPS ? NaN : -va / vb;
}
// Final velocities of a head-on collision in one dimension (textbook formulas, used by the tests).
export function headOn(m1, v1, m2, v2, e) {
  const P = m1 * v1 + m2 * v2, M = m1 + m2;
  return [(P - m2 * e * (v1 - v2)) / M, (P + m1 * e * (v1 - v2)) / M];
}
