/* physics.js — Force Lab XR: fisica pura della palla (nessun THREE, nessun DOM; testabile in Node).
   Coordinate del "palco" (stage), in metri: x a destra, y in alto, −z davanti all'utente.
   Forze: zone di forza uniformi (scatole allineate agli assi, forza in newton), elastico (tira soltanto), peso m·g lungo −y.
   Integratore: Eulero semi-implicito a passo fisso DT (simplettico: adatto all'elastico). */
(function (root) {
  'use strict';

  const DT = 1 / 240;
  const BALL_R = 0.04;                       // raggio della palla (m)
  // Colpo (impulso): J fisso, applicato come forza costante J/dt per dt secondi (così le frecce F e a si vedono);
  // colpisce solo se la palla è nel cono (semiapertura in gradi) entro la portata; pausa minima tra due colpi.
  const BLAST = { J: 0.25, dt: 0.1, cone: 30, range: 2.5, cooldown: 0.5 };
  const BAND = { k: 4, slack: 0.05, cap: 3, reach: 2.5 };   // N/m, zona morta predefinita (m; regolabile nelle opzioni), forza massima (N), portata (m)

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.sqrt(dot(a, a));
  const norm = a => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 0]; };

  function inBox(p, z) {
    return p[0] >= z.min[0] && p[0] <= z.max[0] && p[1] >= z.min[1] && p[1] <= z.max[1] && p[2] >= z.min[2] && p[2] <= z.max[2];
  }

  // Elastico: rest = lunghezza a riposo (distanza all'aggancio); la zona morta `slack` si aggiunge.
  // F = k · max(0, d − rest − slack) verso la mano, limitata a cap. Restituisce anche lo "stiramento" per il disegno.
  function bandForce(p, band) {
    const d = sub(band.anchor, p), L = len(d);
    const free = band.rest + (band.slack === undefined ? BAND.slack : band.slack);
    const stretch = L - free;
    if (stretch <= 0 || L < 1e-9) return { F: [0, 0, 0], stretch: stretch, L: L, free: free };
    const mag = Math.min(band.cap === undefined ? BAND.cap : band.cap, (band.k === undefined ? BAND.k : band.k) * stretch);
    return { F: mul(d, mag / L), stretch: stretch, L: L, free: free };
  }

  // env = { zones: [{min, max, F}], g (m/s², verso −y), band: null | {anchor, rest, k?, slack?, cap?}, kick?: [Fx, Fy, Fz] (colpo in corso) }
  function forces(p, m, env) {
    let zone = [0, 0, 0];
    const inside = [];
    (env.zones || []).forEach((z, i) => { if (inBox(p, z)) { zone = add(zone, z.F); inside.push(i); } });
    const weight = [0, -m * (env.g || 0), 0];
    const b = env.band ? bandForce(p, env.band) : null;
    const band = b ? b.F : [0, 0, 0];
    const kick = env.kick || [0, 0, 0];
    const net = add(add(add(zone, band), weight), kick);
    return { zone: zone, band: band, weight: weight, kick: kick, net: net, a: mul(net, 1 / m), inside: inside, stretch: b ? b.stretch : null };
  }

  // un passo: s = {p, v, m}; muta s e restituisce il segmento percorso [p0, p1]
  function step(s, env, dt) {
    dt = dt || DT;
    const f = forces(s.p, s.m, env);
    const p0 = s.p.slice();
    s.v = add(s.v, mul(f.a, dt));
    s.p = add(s.p, mul(s.v, dt));
    return { p0: p0, p1: s.p.slice(), f: f };
  }

  // Attraversamento di un anello (porta): il segmento p0→p1 attraversa il piano della porta nel verso della normale,
  // dentro il raggio (meno metà del raggio della palla). Restituisce la frazione 0..1 del segmento o -1.
  function crossRing(g, p0, p1) {
    const n = norm(g.n);
    const d0 = dot(sub(p0, g.p), n), d1 = dot(sub(p1, g.p), n);
    if (!(d0 < 0 && d1 >= 0)) return -1;
    const f = d0 / (d0 - d1);
    const q = add(p0, mul(sub(p1, p0), f));
    return len(sub(q, g.p)) <= g.r - BALL_R * 0.5 ? f : -1;
  }
  // bersaglio: palla dentro la sfera e abbastanza lenta
  function inTarget(g, p, v) { return len(sub(p, g.p)) <= g.r && len(v) <= g.vmax; }

  // Traiettoria prevista (senza elastico) per `T` secondi: punti ogni `every` secondi.
  function predict(p, v, m, env, T, every, stopFn) {
    const s = { p: p.slice(), v: v.slice(), m: m }, e = { zones: env.zones, g: env.g, band: null };
    const out = [s.p.slice()], n = Math.round(T / DT), k = Math.max(1, Math.round(every / DT));
    for (let i = 1; i <= n; i++) {
      step(s, e, DT);
      if (i % k === 0) out.push(s.p.slice());
      if (stopFn && stopFn(s.p)) { out.push(s.p.slice()); break; }
    }
    return out;
  }

  // Il colpo partito da `o` in direzione `d` (versore) raggiunge la palla in p? (cono e portata)
  function blastHits(o, d, p) {
    const op = sub(p, o), L = len(op);
    if (L > BLAST.range || L < 1e-9) return false;
    return dot(op, norm(d)) / L >= Math.cos(BLAST.cone * Math.PI / 180);
  }

  // Scomposizione dell'accelerazione lungo v (cambia la velocità scalare) e perpendicolare (cambia la direzione)
  function splitA(a, v) {
    const u = norm(v);
    if (len(u) < 0.5) return { par: [0, 0, 0], perp: a.slice() };
    const par = mul(u, dot(a, u));
    return { par: par, perp: sub(a, par) };
  }

  // Aggancio a direzioni "belle" (assi e diagonali, 26 direzioni) entro `deg` gradi, modulo a passi di `stepN`
  const DIRS = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) DIRS.push(norm([x, y, z]));
  function snapForce(F, maxF, opts) {
    opts = opts || {};
    const deg = opts.deg === undefined ? 8 : opts.deg, stepN = opts.step === undefined ? 0.05 : opts.step;
    let mag = len(F);
    if (mag < 1e-9) return [0, 0, 0];
    let u = mul(F, 1 / mag);
    if (opts.snap !== false) {
      let best = null, bd = Math.cos(deg * Math.PI / 180);
      for (const d of DIRS) { const c = dot(u, d); if (c > bd) { bd = c; best = d; } }
      if (best) u = best;
      mag = Math.round(mag / stepN) * stepN;
    }
    mag = Math.min(maxF, mag);
    return mul(u, mag);
  }

  const api = { DT: DT, BALL_R: BALL_R, BAND: BAND, BLAST: BLAST, blastHits: blastHits, forces: forces, step: step, bandForce: bandForce, inBox: inBox, crossRing: crossRing, inTarget: inTarget,
    predict: predict, splitA: splitA, snapForce: snapForce, V: { add: add, sub: sub, mul: mul, dot: dot, len: len, norm: norm } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Physics = api;
})(typeof window !== 'undefined' ? window : globalThis);
