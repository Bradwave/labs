// Sensori di posizione agli estremi della rotaia, campionamento, velocità derivata dai campioni.
import { CFG } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Distanza vera (non ancora limitata) vista da ciascun sensore, e sua derivata.
// Il sensore sinistro vede la faccia sinistra del carrello più vicino, il destro la faccia destra.
export function trueReadings(world) {
  const ℓ = CFG.CART_LEN, out = { d: [NaN, NaN], v: [NaN, NaN], who: [null, null] };
  let bestL = Infinity, bestR = Infinity;
  for (const c of Object.values(world.carts)) {
    if (c.derailed) continue;
    const dl = c.x - ℓ / 2, dr = world.L - (c.x + ℓ / 2);
    if (dl < bestL) { bestL = dl; out.d[0] = dl; out.v[0] = c.v; out.who[0] = c.id; }
    if (dr < bestR) { bestR = dr; out.d[1] = dr; out.v[1] = -c.v; out.who[1] = c.id; }
  }
  return out;
}

// Quello che restituisce lo strumento: sotto 15 cm dà la distanza minima.
export function instrumentValue(dTrue, sigma, rng) {
  if (!Number.isFinite(dTrue) || dTrue > CFG.RANGE) return NaN;
  if (dTrue < CFG.DEAD) return CFG.DEAD;
  const d = dTrue + (sigma > 0 ? sigma * gauss(rng) : 0);
  return Math.max(CFG.DEAD, Math.round(d * 1e4) / 1e4);
}

// Registrazione: campiona a f Hz per T secondi e salva anche la traiettoria "reale" a passo fine.
export class Recorder {
  constructor({ f, T, sigma, seed }) {
    this.f = f; this.T = T; this.sigma = sigma;
    this.N = Math.floor(T * f + 1e-9) + 1;
    this.rng = mulberry32(seed);
    this.k = 0; this.t0 = 0; this.nextTruth = 0; this.done = false;
    this.t = []; this.d = [[], []];
    this.truth = { t: [], dT: [[], []], vT: [[], []], cx: { A: [], B: [] }, cd: { A: [], B: [] } };
    this.setup = null;
  }
  begin(world) {
    this.t0 = world.time;
    this.setup = {
      order: [...world.order], L: world.L, mu: world.mu, tiltMm: world.tiltMm,
      flipped: { A: world.carts.A.flipped, B: world.carts.B.flipped },
      plunger: { A: world.carts.A.plungerMode, B: world.carts.B.plungerMode },
      level: { A: world.carts.A.level, B: world.carts.B.level },
      extra: { ...world.extra },
      mass: { A: world.mass(world.carts.A), B: world.mass(world.carts.B) },
    };
  }
  get elapsed() { return this.k > 0 ? this.t[this.t.length - 1] : 0; }
  tick(world) {
    if (this.done) return;
    const tau = world.time - this.t0;
    while (this.k < this.N && tau + 1e-9 >= this.k / this.f) {
      const r = trueReadings(world);
      this.t.push(this.k / this.f);
      this.d[0].push(instrumentValue(r.d[0], this.sigma, this.rng));
      this.d[1].push(instrumentValue(r.d[1], this.sigma, this.rng));
      this.k++;
    }
    while (tau + 1e-9 >= this.nextTruth && this.nextTruth <= this.T + 1e-9) {
      const r = trueReadings(world);
      const tr = this.truth;
      tr.t.push(this.nextTruth);
      for (const s of [0, 1]) { tr.dT[s].push(r.d[s]); tr.vT[s].push(r.v[s]); }
      for (const id of ['A', 'B']) { tr.cx[id].push(world.carts[id].x); tr.cd[id].push(world.carts[id].derailed ? 1 : 0); }
      this.nextTruth += CFG.TRUTH_DT;
    }
    if (this.k >= this.N) this.done = true;
  }
  toRun(id, name) {
    return {
      id, name, f: this.f, T: this.T, sigma: this.sigma, t: this.t, d: this.d,
      truth: this.truth, setup: this.setup, crop: null, visible: true,
    };
  }
}

// Derivata dai campioni: differenza centrale a tre punti (differenza unilaterale agli estremi).
export function derivative(t, x) {
  const n = x.length, v = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1;
    if (a < 0) a = i;
    if (b > n - 1) b = i;
    if (a === b) continue;
    v[i] = (x[b] - x[a]) / (t[b] - t[a]);
  }
  return v;
}

// Serie mostrate per una corsa: posizione (con eventuale inversione del segno) e velocità.
export function buildSeries(run, inv) {
  return [0, 1].map((s) => {
    const sg = inv[s] ? -1 : 1;
    const x = run.d[s].map((q) => sg * q);
    return { x, v: derivative(run.t, x), sign: sg };
  });
}

// Masse ignote dei due carrelli, determinate da un seme (stesso seme, stesse masse).
export function hiddenMasses(seed) {
  const r = mulberry32((seed * 7919 + 13) >>> 0);
  const q = () => Math.round((CFG.HIDDEN_MIN + (CFG.HIDDEN_MAX - CFG.HIDDEN_MIN) * r()) * 1000) / 1000;
  const a = q(); let b = q(), k = 0;
  while (Math.abs(a - b) < CFG.HIDDEN_GAP && k++ < 50) b = q();
  return { A: a, B: b };
}
// Lettura della bilancia in grammi interi: massa vera + rumore, arrotondata alla risoluzione.
export function scaleReading(mass, rng) {
  return Math.round((mass + gauss(rng) * CFG.SCALE_SIGMA) / CFG.SCALE_RES);
}
