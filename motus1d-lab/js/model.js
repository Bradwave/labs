/* Motion model. Every way of entering a motion ends up here, and every view reads only this.
   A model exposes S(t), V(t), A(t) on [0, T], sampled pieces for drawing, the joints between
   sections with their status, and the split points used by the integrals. */
import { compileExpr } from './parser.js';

export const RESERVED = ['t', 'τ'];
const isNum = v => typeof v === 'number' && isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));


/* ---------------------------------------------------------------- sections
   { kind: 's'|'v'|'a'|'u', f, end, s0:{inh,e}, v0:{inh,e}, a, blend }
   's': f is s(t) · 'v': f is v(t), needs s0 · 'a': f is a(t), needs s0, v0 · 'u': s0, v0, a constants */
export function newSection(kind = 'u', end = '4') {
  return { kind, f: kind === 's' ? '2t' : kind === 'v' ? '2' : kind === 'a' ? '1' : '', end, s0: { inh: true, e: '0' }, v0: { inh: true, e: '0' }, a: '0', blend: false };
}

/* compile all the text: returns { ok, errs: [{i, field, msg}], vars, comp } */
export function compileSections(secs, tr) {
  const errs = [], vars = new Set(), comp = [];
  const take = (i, field, src, opts = {}) => {
    const r = compileExpr(src);
    if (r.err) { errs.push({ i, field, msg: r.err }); return null; }
    if (opts.noT && r.vars.some(v => RESERVED.includes(v))) { errs.push({ i, field, msg: tr(opts.noT) }); return null; }
    r.vars.forEach(v => { if (!RESERVED.includes(v)) vars.add(v); });
    return r.fn;
  };
  secs.forEach((s, i) => {
    const c = { kind: s.kind };
    c.end = take(i, 'end', s.end, { noT: 'e_end_t' });
    if (s.kind !== 'u') c.f = take(i, 'f', s.f);
    const needS0 = s.kind !== 's', needV0 = s.kind === 'a' || s.kind === 'u';
    c.s0 = needS0 && (i === 0 || !s.s0.inh) ? take(i, 's0', s.s0.e, { noT: 'e_ic_t' }) : null;
    c.v0 = needV0 && (i === 0 || !s.v0.inh) ? take(i, 'v0', s.v0.e, { noT: 'e_ic_t' }) : null;
    c.inhS = needS0 && i > 0 && s.s0.inh;
    c.inhV = needV0 && i > 0 && s.v0.inh;
    if (s.kind === 'u') c.a = take(i, 'a', s.a, { noT: 'e_a_t' });
    c.blend = !!s.blend;
    comp.push(c);
  });
  return { ok: errs.length === 0, errs, vars: [...vars], comp };
}

/* cumulative integral of g from `origin`, tabulated with Simpson steps on [lo, hi] */
function cumulative(g, lo, hi, origin) {
  const N = clamp(Math.ceil((hi - lo) * 240), 240, 4000), d = (hi - lo) / N;
  const gN = new Float64Array(N + 1), I = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) gN[k] = g(lo + k * d);
  for (let k = 0; k < N; k++) I[k + 1] = I[k] + d / 6 * (gN[k] + 4 * g(lo + (k + 0.5) * d) + gN[k + 1]);
  const raw = t => {
    const k = clamp(Math.floor((t - lo) / d), 0, N - 1), x = lo + k * d, r = t - x;
    return I[k] + r / 6 * (gN[k] + 4 * g(x + r / 2) + g(t));
  };
  const off = raw(origin);
  return t => raw(t) - off;
}

/* build a model from compiled sections and an environment holding the parameter values */
export function buildEqModel(C, E, opts = {}) {
  const blendW = opts.blendW ?? 0.4;
  const n = C.comp.length, errs = [];
  const t0 = [], t1 = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    const end = C.comp[i].end(E);
    if (!isNum(end) || end <= start + 1e-6) { errs.push({ i, field: 'end', msg: 'e_order' }); return { ok: false, errs }; }
    t0.push(start); t1.push(Math.min(end, 600)); start = t1[i];
  }
  const T = t1[n - 1];
  const pad = blendW / 2 + 0.02;
  const ev = [];
  const h = 1e-4, H = 2e-3;
  for (let i = 0; i < n; i++) {
    const c = C.comp[i], a0 = t0[i], lo = a0 - pad, hi = t1[i] + pad;
    const prev = i > 0 ? ev[i - 1] : null;
    const s0 = c.inhS ? prev(a0)[0] : c.s0 ? c.s0(E) : 0;
    const v0 = c.inhV ? prev(a0)[1] : c.v0 ? c.v0(E) : 0;
    const F = c.f ? (t => { E.t = t; E.τ = t - a0; return c.f(E); }) : null;
    let ext;
    if (c.kind === 's') {
      ext = t => { const s = F(t), p = F(t + h), m = F(t - h); return [s, (p - m) / (2 * h), (F(t + H) - 2 * s + F(t - H)) / (H * H)]; };
    } else if (c.kind === 'v') {
      const I = cumulative(F, lo, hi, a0);
      ext = t => [s0 + I(t), F(t), (F(t + h) - F(t - h)) / (2 * h)];
    } else if (c.kind === 'a') {
      const IV = cumulative(F, lo, hi, a0), Vf = t => v0 + IV(t);
      const IS = cumulative(Vf, lo, hi, a0);
      ext = t => [s0 + IS(t), Vf(t), F(t)];
    } else {
      const acc = c.a(E);
      ext = t => { const u = t - a0; return [s0 + v0 * u + 0.5 * acc * u * u, v0 + acc * u, acc]; };
    }
    ev.push(ext);
  }

  /* joints */
  const joints = [];
  for (let i = 1; i < n; i++) {
    const tj = t0[i], L = ev[i - 1](tj), R = ev[i](tj);
    const dS = R[0] - L[0], dV = R[1] - L[1], dA = R[2] - L[2];
    const tol = (x, y, k) => k * (1 + Math.abs(x) + Math.abs(y));
    let status = 'smooth';
    if (!isNum(dS) || Math.abs(dS) > tol(L[0], R[0], 1e-6)) status = 'jump';
    else if (Math.abs(dV) > tol(L[1], R[1], 1e-5)) status = 'kink';
    else if (Math.abs(dA) > tol(L[2], R[2], 1e-3)) status = 'acorner';
    if (C.comp[i].coll && status !== 'jump' && status !== 'smooth') status = 'coll'; // a bounce: wanted, not an error
    const w = Math.min(blendW, 0.98 * (t1[i - 1] - t0[i - 1]), 0.98 * (t1[i] - t0[i]));
    const blend = C.comp[i].blend && w > 1e-4;
    joints.push({ i, t: tj, status, dS, dV, dA, L, R, blend, w: blend ? w : 0 });
  }

  /* the blend is the quintic that matches s, v and a of the two sections at the edges of the window:
     nothing is extrapolated, so there is no overshoot, and the motion stays C2 */
  for (const J of joints) if (J.blend) {
    const h = J.w, ta = J.t - h / 2, tb = J.t + h / 2;
    const [s0, v0, a0] = ev[J.i - 1](ta), [s1, v1, a1] = ev[J.i](tb), h2 = h * h;
    J.q = [s0, h * v0, 0.5 * h2 * a0,
      -10 * s0 - 6 * h * v0 - 1.5 * h2 * a0 + 0.5 * h2 * a1 - 4 * h * v1 + 10 * s1,
      15 * s0 + 8 * h * v0 + 1.5 * h2 * a0 - h2 * a1 + 7 * h * v1 - 15 * s1,
      -6 * s0 - 3 * h * v0 - 0.5 * h2 * a0 + 0.5 * h2 * a1 - 3 * h * v1 + 6 * s1];
  }
  const blendAt = (j, t) => {
    const J = joints[j - 1], h = J.w, u = (t - (J.t - h / 2)) / h, c = J.q;
    const p = c[0] + u * (c[1] + u * (c[2] + u * (c[3] + u * (c[4] + u * c[5]))));
    const d1 = c[1] + u * (2 * c[2] + u * (3 * c[3] + u * (4 * c[4] + u * 5 * c[5])));
    const d2 = 2 * c[2] + u * (6 * c[3] + u * (12 * c[4] + u * 20 * c[5]));
    return [p, d1 / h, d2 / (h * h)];
  };
  const evalIn = (i, t) => {
    if (i > 0) { const J = joints[i - 1]; if (J.blend && t < J.t + J.w / 2) return blendAt(i, t); }
    if (i < n - 1) { const J = joints[i]; if (J.blend && t > J.t - J.w / 2) return blendAt(i + 1, t); }
    return ev[i](t);
  };
  const secAt = t => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t0[m] <= t) lo = m; else hi = m - 1; } return lo; };
  const at = t => { t = clamp(t, 0, T); return evalIn(secAt(t), t); };

  /* split points for the integrals: joints and the edges of blended intervals */
  const splits = [];
  for (const J of joints) { if (J.blend) splits.push(J.t - J.w / 2, J.t + J.w / 2); else splits.push(J.t); }

  /* sampled pieces, one per section, denser inside the blends */
  const pieces = [];
  const per = Math.max(60, Math.round(1400 / n));
  for (let i = 0; i < n; i++) {
    const a = t0[i], b = t1[i], ts = [];
    const N = Math.max(40, Math.round(per * Math.min(1, (b - a) / T * n)));
    for (let k = 0; k <= N; k++) ts.push(a + (b - a) * k / N);
    for (const J of joints) if (J.blend) {
      const lo = Math.max(a, J.t - J.w / 2), hi = Math.min(b, J.t + J.w / 2);
      if (hi > lo) for (let k = 0; k <= 80; k++) ts.push(lo + (hi - lo) * k / 80);
    }
    ts.sort((x, y) => x - y);
    pieces.push(samplePiece(ts, t => evalIn(i, t)));
  }
  return finish({ kind: 'eq', ok: true, T, t0, t1, at, joints, splits, pieces });
}

function samplePiece(ts, f) {
  const N = ts.length, P = { t: new Float64Array(N), s: new Float64Array(N), v: new Float64Array(N), a: new Float64Array(N) };
  for (let k = 0; k < N; k++) { const r = f(ts[k]); P.t[k] = ts[k]; P.s[k] = r[0]; P.v[k] = r[1]; P.a[k] = r[2]; }
  return P;
}

function finish(M) {
  const rng = { s: [Infinity, -Infinity], v: [Infinity, -Infinity], a: [Infinity, -Infinity] };
  for (const P of M.pieces) for (const q of ['s', 'v', 'a']) for (const x of P[q]) if (isNum(x)) {
    if (x < rng[q][0]) rng[q][0] = x; if (x > rng[q][1]) rng[q][1] = x;
  }
  for (const q of ['s', 'v', 'a']) if (!isNum(rng[q][0])) rng[q] = [0, 0];
  M.range = rng;
  M.S = t => M.at(t)[0]; M.V = t => M.at(t)[1]; M.A = t => M.at(t)[2];
  return M;
}

/* ---------------------------------------------------------------- recordings
   uniform samples; a local quadratic fit (Savitzky–Golay) gives s, v and a together */
export const REC_DT = 1 / 60;
export function resample(raw) {
  if (raw.length < 2) return null;
  const T = raw[raw.length - 1][0];
  if (!(T > 0)) return null;
  const N = Math.floor(T / REC_DT) + 1, s = new Float64Array(N);
  let j = 0;
  for (let k = 0; k < N; k++) {
    const t = k * REC_DT;
    while (j < raw.length - 2 && raw[j + 1][0] < t) j++;
    const [ta, sa] = raw[j], [tb, sb] = raw[j + 1], d = tb - ta;
    s[k] = d > 0 ? sa + (sb - sa) * clamp((t - ta) / d, 0, 1) : sb;
  }
  return s;
}
export function smoothSG(s, m, dt) {
  const n = s.length, S = new Float64Array(n), V = new Float64Array(n), A = new Float64Array(n);
  const w = Math.min(2 * m, n - 1);
  for (let i = 0; i < n; i++) {
    let lo = Math.max(0, i - m), hi = Math.min(n - 1, i + m);
    if (hi - lo < w) { if (lo === 0) hi = Math.min(n - 1, w); else lo = Math.max(0, hi - w); }
    let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
    for (let k = lo; k <= hi; k++) {
      const x = (k - i) * dt, x2 = x * x, y = s[k];
      S0++; S1 += x; S2 += x2; S3 += x2 * x; S4 += x2 * x2; T0 += y; T1 += y * x; T2 += y * x2;
    }
    const det = S0 * (S2 * S4 - S3 * S3) - S1 * (S1 * S4 - S3 * S2) + S2 * (S1 * S3 - S2 * S2);
    if (hi - lo < 2 || Math.abs(det) < 1e-30) { S[i] = s[i]; V[i] = 0; A[i] = 0; continue; }
    const c0 = (T0 * (S2 * S4 - S3 * S3) - S1 * (T1 * S4 - S3 * T2) + S2 * (T1 * S3 - S2 * T2)) / det;
    const c1 = (S0 * (T1 * S4 - T2 * S3) - T0 * (S1 * S4 - S3 * S2) + S2 * (S1 * T2 - T1 * S2)) / det;
    const c2 = (S0 * (S2 * T2 - S3 * T1) - S1 * (S1 * T2 - S2 * T1) + T0 * (S1 * S3 - S2 * S2)) / det;
    S[i] = c0; V[i] = c1; A[i] = 2 * c2;
  }
  return { S, V, A };
}
export function buildRecModel(s, m) {
  if (!s || s.length < 3) return null;
  const dt = REC_DT, n = s.length, T = (n - 1) * dt, F = smoothSG(s, m, dt);
  const t = new Float64Array(n); for (let k = 0; k < n; k++) t[k] = k * dt;
  const lin = arr => tt => { const f = clamp(tt / dt, 0, n - 1), k = Math.min(Math.floor(f), n - 2), r = f - k; return arr[k] * (1 - r) + arr[k + 1] * r; };
  const fs = lin(F.S), fv = lin(F.V), fa = lin(F.A);
  return finish({ kind: 'rec', ok: true, T, at: tt => [fs(tt), fv(tt), fa(tt)], joints: [], splits: [], raw: s,
    pieces: [{ t, s: F.S, v: F.V, a: F.A }] });
}

/* ---------------------------------------------------------------- integrals */
export function integrate(fn, a, b, splits, absval = false) {
  if (!(b > a)) return 0;
  const pts = [a, ...splits.filter(x => x > a && x < b), b];
  let tot = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const lo = pts[k], hi = pts[k + 1], e = (hi - lo) * 1e-9;
    const N = absval ? 400 : 160, d = (hi - lo) / N;
    const g = x => { const y = fn(clamp(x, lo + e, hi - e)); return absval ? Math.abs(y) : y; };
    let s = g(lo) + g(hi);
    for (let i = 1; i < N; i++) s += (i % 2 ? 4 : 2) * g(lo + i * d);
    tot += s * d / 3;
  }
  return tot;
}

/* ---------------------------------------------------------------- frames
   A frame is { o, dir }: x = dir·(w − o), w being the fixed world coordinate.
   transformModel maps a model to x = A + B·s (velocities and accelerations scale by B). */
export function transformModel(M, A, B) {
  if (!M || (A === 0 && B === 1)) return M;
  if (M._tf && M._tf.A === A && M._tf.B === B) return M._tf.M;
  const mp = P => ({ t: P.t, s: P.s.map(x => A + B * x), v: P.v.map(x => B * x), a: P.a.map(x => B * x) });
  const R = finish({
    kind: M.kind, ok: true, T: M.T, t0: M.t0, t1: M.t1, splits: M.splits,
    at: t => { const r = M.at(t); return [A + B * r[0], B * r[1], B * r[2]]; },
    joints: M.joints.map(J => ({ ...J, dS: B * J.dS, dV: B * J.dV, dA: B * J.dA, L: [A + B * J.L[0], B * J.L[1], B * J.L[2]], R: [A + B * J.R[0], B * J.R[1], B * J.R[2]] })),
    pieces: M.pieces.map(mp), raw: M.raw ? M.raw.map(x => A + B * x) : null
  });
  M._tf = { A, B, M: R };
  return R;
}

/* launch and free fall in world coordinates (up is positive, the floor is at 0).
   Bounces become sections whose joints are marked as collisions. */
export function freeFallModel(ff) {
  const g = Math.max(0.01, ff.g), Tend = Math.max(0.2, ff.T), parts = [];
  let t = 0, w = ff.floor ? Math.max(0, ff.w0) : ff.w0, v = ff.v0, guard = 0;
  while (t < Tend - 1e-9 && guard++ < 80) {
    if (!ff.floor) { parts.push([Tend, w, v, -g]); break; }
    if (w <= 1e-9 && v <= 1e-9) { parts.push([Tend, 0, 0, 0]); break; }
    const tau = (v + Math.sqrt(v * v + 2 * g * w)) / g;
    if (t + tau >= Tend - 1e-9) { parts.push([Tend, w, v, -g]); break; }
    parts.push([t + tau, w, v, -g]);
    const vi = v - g * tau; t += tau; w = 0; v = -ff.e * vi;
    if (v < 0.2 || tau < 0.03) v = 0;
  }
  const comp = parts.map((p, i) => ({ kind: 'u', end: () => p[0], s0: () => p[1], v0: () => p[2], a: () => p[3], inhS: false, inhV: false, blend: false, coll: i > 0 }));
  return buildEqModel({ ok: true, comp, vars: [] }, Object.create(null), { blendW: 0.1 });
}
