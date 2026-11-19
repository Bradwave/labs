// Fourier Lab XR · fourier.js
// Matematica pura (niente THREE, niente DOM): segnale g(t), centro di massa c(f) dell'avvolgimento, spettro, picchi,
// esplorazione dell'asse delle frequenze e geometria della manopola. Uguale al prototipo 2D "Fourier Lab"; testata in Node.
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const T = 4;              // durata del segnale (s)
  const NS = 800;           // campioni del segnale
  const FMAX = 6;           // massima frequenza di avvolgimento (Hz)
  const DF = 0.02;          // passo della griglia delle frequenze
  const NF = Math.round(FMAX / DF) + 1;
  const TOL = 0.3;          // Hz: una previsione è giusta se un picco vero cade entro questa distanza

  const PRESETS = {
    one:   { dc: 0, a1: 1, f1: 2,   a2: 0,   f2: 3.5, noise: 0 },
    two:   { dc: 0, a1: 1, f1: 1.5, a2: 0.7, f2: 3.5, noise: 0 },
    mean:  { dc: 1, a1: 0.8, f1: 2.5, a2: 0, f2: 3.5, noise: 0 },
    noisy: { dc: 0, a1: 0.8, f1: 2, a2: 0,   f2: 3.5, noise: 1.4 },
  };
  const PRESET_ORDER = ['one', 'two', 'mean', 'noisy'];

  function rng(seed) { // mulberry32
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function Model() {
    this.P = Object.assign({}, PRESETS.one);
    this.tk = new Float64Array(NS);
    for (let k = 0; k < NS; k++) this.tk[k] = ((k + 0.5) * T) / NS;
    // rumore: nodi gaussiani a varianza 1, interpolati (uno ogni 1/30 s)
    const KN = 121; this.KN = KN;
    this.knots = new Float64Array(KN);
    const r = rng(20261113);
    let s2 = 0;
    for (let i = 0; i < KN; i++) { this.knots[i] = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(TAU * r()); s2 += this.knots[i] * this.knots[i]; }
    const sd = Math.sqrt(s2 / KN);
    for (let i = 0; i < KN; i++) this.knots[i] /= sd;
    this.g = new Float64Array(NS);
    this.cRe = new Float64Array(NF); this.cIm = new Float64Array(NF); this.cMag = new Float64Array(NF);
    this.visited = new Uint8Array(NF);
    this.gmax = 1; this.cMaxAll = 0.5; this.peaks = [];
    this.recompute();
  }
  Model.prototype.noiseAt = function (k) {
    const x = (this.tk[k] / T) * (this.KN - 1), i = Math.min(this.KN - 2, Math.floor(x)), u = x - i;
    return this.knots[i] * (1 - u) + this.knots[i + 1] * u;
  };
  Model.prototype.computeSignal = function () {
    const P = this.P;
    this.gmax = 0.2;
    for (let k = 0; k < NS; k++) {
      const x = this.tk[k];
      this.g[k] = P.dc + P.a1 * Math.cos(TAU * P.f1 * x) + P.a2 * Math.cos(TAU * P.f2 * x + 0.9) + P.noise * this.noiseAt(k);
      this.gmax = Math.max(this.gmax, Math.abs(this.g[k]));
    }
    this.R = Math.max(0.6, 1.12 * this.gmax); // raggio del piano di avvolgimento
  };
  // centro di massa del segnale avvolto alla frequenza f: c(f) = media di g(t) e^{-2 pi i f t}
  Model.prototype.com = function (f) {
    let re = 0, im = 0;
    for (let k = 0; k < NS; k++) { const a = TAU * f * this.tk[k]; re += this.g[k] * Math.cos(a); im -= this.g[k] * Math.sin(a); }
    return [re / NS, im / NS];
  };
  Model.prototype.computeSpectrum = function () {
    this.cMaxAll = 0.05;
    for (let j = 0; j < NF; j++) {
      const c = this.com(j * DF);
      this.cRe[j] = c[0]; this.cIm[j] = c[1]; this.cMag[j] = Math.hypot(c[0], c[1]);
      this.cMaxAll = Math.max(this.cMaxAll, this.cMag[j]);
    }
    const sorted = Array.from(this.cMag).sort((a, b) => a - b), med = sorted[sorted.length >> 1];
    const thr = Math.max(0.3 * this.cMaxAll, 2.5 * med);
    this.peaks = [];
    for (let j = 0; j < NF; j++) {
      const v = this.cMag[j];
      if (v < thr) continue;
      let top = true;
      for (let d = -8; d <= 8 && top; d++) {
        const q = j + d;
        if (d === 0 || q < 0 || q >= NF) continue;
        if (this.cMag[q] > v || (this.cMag[q] === v && q < j)) top = false;
      }
      if (top) this.peaks.push({ f: j * DF, v });
    }
  };
  Model.prototype.recompute = function () { this.computeSignal(); this.computeSpectrum(); };
  Model.prototype.setPreset = function (key) {
    if (!PRESETS[key]) return;
    Object.assign(this.P, PRESETS[key]);
    this.recompute();
    this.visited.fill(0);
  };

  // ---------- esplorazione: si disegna solo ciò che l'asse ha già visitato ----------
  Model.prototype.markVisited = function (a, b) {
    const i0 = clamp(Math.round(Math.min(a, b) / DF), 0, NF - 1), i1 = clamp(Math.round(Math.max(a, b) / DF), 0, NF - 1);
    for (let i = i0; i <= i1; i++) this.visited[i] = 1;
  };
  Model.prototype.coverage = function () { let s = 0; for (let i = 0; i < NF; i++) s += this.visited[i]; return s / NF; };

  // ---------- avvolgimento: punti del segnale avvolto a frequenza f, nel piano (Re, Im) ----------
  // out = Float32Array(3 * n) con (Re, Im, 0) per n campioni equispaziati; restituisce anche il centro di massa.
  Model.prototype.wound = function (f, out, n) {
    n = n || NS;
    const step = NS / n;
    let sr = 0, si = 0;
    for (let k = 0; k < NS; k++) { const a = TAU * f * this.tk[k]; sr += this.g[k] * Math.cos(a); si -= this.g[k] * Math.sin(a); }
    for (let i = 0; i < n; i++) {
      const k = Math.min(NS - 1, Math.floor(i * step)), a = TAU * f * this.tk[k];
      out[3 * i] = this.g[k] * Math.cos(a); out[3 * i + 1] = -this.g[k] * Math.sin(a); out[3 * i + 2] = 0;
    }
    return [sr / NS, si / NS];
  };

  // ---------- manopola: la mano gira attorno all'asse f; un giro in senso orario (come l'avvolgimento) = 1 Hz ----------
  // Posizione del segnale avvolto: (Re, Im) = g (cos 2πft, −sin 2πft): per f che cresce il punto gira da Re verso −Im.
  const knobAngle = (re, im) => Math.atan2(-im, re);                 // angolo "di avvolgimento" di un punto del piano
  const wrapPi = (d) => { while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const crankDelta = (prev, cur) => wrapPi(cur - prev) / TAU;        // variazione di f (Hz)

  // ---------- ruota (volano): f = κ · giri al secondo, solo in senso orario; l'attrito la frena ----------
  const FRIC = { low: { g: 0.12, c: 0.03 }, mid: { g: 0.35, c: 0.1 }, high: { g: 0.9, c: 0.3 } };
  function Wheel() { this.w = 0; this.phi = 0; this.held = false; this.idle = 0; this.kappa = 2; this.fric = 'mid'; }
  Wheel.prototype.wmax = function () { return FMAX / this.kappa; };
  Wheel.prototype.setKappa = function (k, f) { this.kappa = k; this.w = clamp(f / k, 0, this.wmax()); }; // f resta continua
  // la mano gira la ruota di dTurns giri in dt secondi (positivo = senso orario, come l'avvolgimento)
  Wheel.prototype.drive = function (dTurns, dt) {
    this.held = true; this.idle = 0; this.phi += dTurns * TAU;
    this.w = clamp(0.65 * this.w + 0.35 * (dTurns / Math.max(0.008, dt)), 0, this.wmax());
  };
  Wheel.prototype.release = function () { this.held = false; if (this.idle > 0.12) this.w = 0; }; // una mano ferma la blocca
  Wheel.prototype.brake = function () { this.w = 0; };
  // avanza di dt e restituisce la frequenza f = κ w
  Wheel.prototype.step = function (dt) {
    if (this.held) { this.idle += dt; if (this.idle > 0.09) this.w *= 0.7; }
    else if (this.w > 0) {
      const fr = FRIC[this.fric];
      this.w = Math.max(0, this.w - (fr.g * this.w + fr.c) * dt);
      if (this.w < 0.005) this.w = 0;
      this.phi += TAU * this.w * dt;
    }
    return clamp(this.kappa * this.w, 0, FMAX);
  };


  // ---------- altri modi di vedere l'integrale (opzioni avanzate) ----------
  // prodotto g(t)·e^{-2πift}: parte reale g cos e parte immaginaria −g sin, campione per campione; la media di ciascuna è Re c e Im c
  Model.prototype.products = function (f, re, im) {
    for (let k = 0; k < NS; k++) { const a = TAU * f * this.tk[k]; re[k] = this.g[k] * Math.cos(a); im[k] = -this.g[k] * Math.sin(a); }
  };
  // cammino: l'integrale parziale I(τ) = ∫0^τ g e^{-2πift} dt (in s) in n punti equispaziati; out = Float32Array(2n) di (Re, Im); I(T) = T·c
  Model.prototype.walk = function (f, out, n) {
    const dt = T / NS, step = NS / n;
    let re = 0, im = 0, next = 0, i = 0;
    for (let k = 0; k < NS; k++) {
      const a = TAU * f * this.tk[k];
      re += this.g[k] * Math.cos(a) * dt; im -= this.g[k] * Math.sin(a) * dt;
      if (i < n && k >= Math.floor(next)) { out[2 * i] = re; out[2 * i + 1] = im; i++; next += step; }
    }
    while (i < n) { out[2 * i] = re; out[2 * i + 1] = im; i++; }
    return [re, im];
  };
  // epicicli (la direzione inversa): i fasori dei picchi, A cos(2π f t + φ) con A = 2|c| (|c| per la componente continua) e φ = arg c
  Model.prototype.phasors = function (max) {
    const list = this.peaks.slice().sort((a, b) => b.v - a.v).slice(0, max || 4);
    return list.map((p) => { // la frequenza del picco è affinata con una parabola sui tre punti vicini
      const j = Math.round(p.f / DF); let f = p.f;
      if (j > 0 && j < NF - 1) { const y0 = this.cMag[j - 1], y1 = this.cMag[j], y2 = this.cMag[j + 1], den = y0 - 2 * y1 + y2; if (den < 0) f = (j + clamp(0.5 * (y0 - y2) / den, -1, 1)) * DF; }
      const c = this.com(f);
      return { f, A: (f < 0.05 ? 1 : 2) * Math.hypot(c[0], c[1]), phi: Math.atan2(c[1], c[0]) };
    });
  };
  // il segnale ricampionato su n punti equispaziati (periodico, interpolazione lineare): è il buffer che si ascolta
  Model.prototype.signalSamples = function (n) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = (i / n) * NS - 0.5, k0 = Math.floor(u), w = u - k0;
      out[i] = this.g[((k0 % NS) + NS) % NS] * (1 - w) + this.g[(((k0 + 1) % NS) + NS) % NS] * w;
    }
    return out;
  };

  // ---------- manopola della radio: 270° (da −135° a +135° dalla verticale, in senso orario) coprono 0–FMAX Hz ----------
  const DIAL = { a0: -0.75 * Math.PI, span: 1.5 * Math.PI };
  const HZ_PER_TURN = FMAX / (DIAL.span / TAU);                         // 8 Hz per giro completo di manopola
  const dialPhi = (f) => DIAL.a0 + (f / FMAX) * DIAL.span;              // angolo dell'indice per la frequenza f
  const dialAngle = (x, y) => Math.atan2(x, y);                          // angolo di un punto della faccia, dalla verticale, in senso orario
  const dialTurn = (prev, cur) => wrapPi(cur - prev) / TAU;              // giri (orari positivi) fatti tra due angoli

  // ---------- suono: le frequenze (Hz) del prototipo sono portate nell'udibile moltiplicando per AUDIO_K ----------
  const AUDIO_K = 110;

  // ---------- previsioni (bandierine sull'asse) ----------
  function evalFlags(flags, peaks) {
    return flags.map((f) => {
      let best = null;
      for (const p of peaks) if (Math.abs(p.f - f) <= TOL && (!best || Math.abs(p.f - f) < Math.abs(best.f - f))) best = p;
      return { f, ok: !!best, peak: best };
    });
  }

  const api = { TAU, T, NS, FMAX, DF, NF, TOL, PRESETS, PRESET_ORDER, Model, rng, clamp, knobAngle, wrapPi, crankDelta, evalFlags, Wheel, FRIC, DIAL, HZ_PER_TURN, dialPhi, dialAngle, dialTurn, AUDIO_K };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Fourier = api;
})(typeof window !== 'undefined' ? window : globalThis);
