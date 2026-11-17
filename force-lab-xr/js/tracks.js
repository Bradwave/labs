/* tracks.js — Force Lab XR: piste (dati), validazione, macchina a stati di una prova, medaglie. Pura, testabile in Node.
   Coordinate del palco (metri): l'utente sta all'origine e guarda verso −z; la partenza è davanti al petto.
   Ogni pista ha una `solution` (lancio + zone, eventualmente un elastico fisso) che i test simulano per garantire che sia risolvibile. */
(function (root) {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('./physics.js') : root.Physics;
  const { add, sub, mul, len, norm } = P.V;

  const START = [0, 1.2, -0.45];
  const ring = (p, n, r, o) => Object.assign({ type: 'ring', p: p, n: norm(n), r: r || 0.22 }, o || {});
  const speed = (p, n, vmin, r) => ({ type: 'speed', p: p, n: norm(n), r: r || 0.22, vmin: vmin });
  const target = (p, r, vmax) => ({ type: 'target', p: p, r: r, vmax: vmax });
  const zone = (min, max, F, locked) => ({ min: min, max: max, F: F, locked: !!locked });

  const D2 = norm([-0.4, 0.1, -0.9]);
  const SLING_C = [0, 1.25, -0.8], SLING_R = 0.5;
  const sl = th => { const a = th * Math.PI / 180; return [SLING_C[0] + SLING_R * Math.cos(a), SLING_C[1], SLING_C[2] - SLING_R * Math.sin(a)]; };
  const slN = th => { const a = th * Math.PI / 180; return [-Math.sin(a), 0, -Math.cos(a)]; };

  const TRACKS = [
    { id: 'straight', n: 1, name: { it: 'Dritto', en: 'Straight' },
      idea: { it: 'Nessuna forza: la palla va dritta, sempre alla stessa velocità.', en: 'No force: the ball goes straight, always at the same speed.' },
      g: 0, mass: 0.5, predict: true, band: false, maxZones: 0, maxForce: 1, timeLimit: 10, medals: [3, 4.5, 6],
      start: { p: START, r: 0.15 },
      gates: [ring([0, 1.2, -1.2], [0, 0, -1]), ring([0, 1.2, -2.0], [0, 0, -1]), ring([0, 1.2, -2.8], [0, 0, -1])],
      zones: [], solution: { launch: [0, 0, -1.0], zones: [] } },

    { id: 'fastlane', n: 2, name: { it: 'Corsia veloce', en: 'Fast lane' },
      idea: { it: 'La velocità scalare è la lunghezza di v: lancia abbastanza forte per le porte veloci.', en: 'Speed is the length of v: throw hard enough for the speed gates.' },
      g: 0, mass: 0.5, predict: true, band: false, maxZones: 0, maxForce: 1, timeLimit: 3, medals: [2, 2.4, 2.8],
      start: { p: START, r: 0.15 },
      gates: [1, 2, 3].map(i => speed(add(START, mul([-0.4, 0.1, -0.9], i)), D2, 1.2)),
      zones: [], solution: { launch: mul(D2, 1.6), zones: [] } },

    { id: 'bend', n: 3, name: { it: 'La curva', en: 'The bend' },
      idea: { it: 'Una forza di traverso a v piega la traiettoria.', en: 'A force across v bends the path.' },
      g: 0, mass: 0.5, predict: true, band: false, maxZones: 0, maxForce: 1, timeLimit: 8, medals: [2.6, 3.2, 4],
      start: { p: START, r: 0.15 },
      gates: [ring([0, 1.2, -0.8], [0, 0, -1]), ring([-0.318, 1.2, -1.7], [-0.623, 0, -0.782]), ring([-1.238, 1.2, -2.85], [-0.625, 0, -0.781])],
      zones: [zone([-0.5, 0.9, -1.7], [0.3, 1.5, -0.9], [-0.5, 0, 0], true)],
      solution: { launch: [0, 0, -1], zones: [] } },

    { id: 'yourbend', n: 4, name: { it: 'La tua curva', en: 'Your bend' },
      idea: { it: 'Ora metti tu la forza che piega la traiettoria.', en: 'Now you place the force that bends the path.' },
      g: 0, mass: 0.5, predict: true, band: false, maxZones: 1, maxForce: 1, timeLimit: 8, medals: [2.6, 3.2, 4],
      start: { p: START, r: 0.15 },
      gates: [ring([0, 1.2, -0.8], [0, 0, -1]), ring([0.318, 1.2, -1.7], [0.623, 0, -0.782]), ring([1.238, 1.2, -2.85], [0.625, 0, -0.781])],
      zones: [], solution: { launch: [0, 0, -1], zones: [zone([-0.3, 0.9, -1.7], [0.5, 1.5, -0.9], [0.5, 0, 0])] } },

    { id: 'brake', n: 5, name: { it: 'Frenata', en: 'Brake' },
      idea: { it: 'Una forza contro v rallenta la palla: fermala nel bersaglio.', en: 'A force against v slows the ball down: stop it in the target.' },
      g: 0, mass: 0.5, predict: false, band: false, maxZones: 1, maxForce: 1, timeLimit: 8, medals: [2.2, 3, 4],
      start: { p: START, r: 0.15 },
      gates: [ring([0, 1.2, -0.8], [0, 0, -1]), target([0, 1.2, -1.9], 0.25, 0.3)],
      zones: [], solution: { launch: [0, 0, -1.2], zones: [zone([-0.4, 0.9, -2.6], [0.4, 1.5, -1.0], [0, 0, 0.4])] } },

    { id: 'slalom', n: 6, name: { it: 'Slalom', en: 'Slalom' },
      idea: { it: 'Forze alterne, a destra e a sinistra; il tempo limite vieta le soluzioni lente.', en: 'Alternating forces, left and right; the time limit forbids slow solutions.' },
      g: 0, mass: 0.5, predict: false, band: false, maxZones: 3, maxForce: 1, timeLimit: 5, medals: [3.6, 4.2, 4.8],
      start: { p: START, r: 0.15 },
      gates: [ring([0.25, 1.2, -1.2], [0, 0, -1], 0.2), ring([-0.25, 1.2, -2.45], [0, 0, -1], 0.2), ring([0.25, 1.2, -3.7], [0.5, 0, -1], 0.2)],
      zones: [], solution: { launch: [0.5, 0, -1], zones: [zone([-0.5, 0.9, -1.7], [0.6, 1.5, -0.7], [-0.5, 0, 0]), zone([-0.6, 0.9, -2.95], [0.5, 1.5, -1.95], [0.5, 0, 0])] } },

    { id: 'sling', n: 7, name: { it: 'Fionda', en: 'Sling' },
      idea: { it: "Una forza verso il centro fa girare la palla in cerchio: tienila con l'elastico.", en: 'A force toward the centre keeps the ball circling: hold it with the band.' },
      g: 0, mass: 0.5, predict: false, band: true, maxZones: 0, maxForce: 1, timeLimit: 10, medals: [4, 5.5, 7],
      start: { p: sl(0), r: 0.15 }, center: SLING_C,
      gates: [ring(sl(90), slN(90)), ring(sl(180), slN(180)), ring(sl(270), slN(270)), ring(sl(358), slN(358))],
      zones: [], solution: { launch: [0, 0, -1], zones: [], band: { anchor: SLING_C, rest: 0.20, slack: 0.05 } } },

    { id: 'lowg', n: 8, name: { it: 'Gravità bassa', en: 'Low gravity' },
      idea: { it: 'Anche il peso è una forza: annullalo, o sfruttalo.', en: 'Weight is a force too: cancel it, or use it.' },
      g: 1, mass: 0.5, predict: true, band: false, maxZones: 2, maxForce: 1, timeLimit: 8, medals: [3.4, 4.2, 5.5],
      start: { p: [0, 1.1, -0.45], r: 0.15 },
      gates: [ring([0, 1.519, -1.05], [0, 0.371, -0.928]), ring([0, 1.727, -1.85], [0, 0.239, -0.971]), ring([0, 1.821, -2.65], [0, -0.2, -0.98]), ring([0, 1.336, -3.45], [0, -0.709, -0.706])],
      zones: [], solution: { launch: [0, 1, -1], zones: [zone([-0.4, 1.4, -2.2], [0.4, 2.1, -1.2], [0, 0.5, 0])] } },

    { id: 'kick', n: 9, name: { it: 'Colpi', en: 'Kicks' },
      idea: { it: "Un colpo è un impulso J = F·Δt: cambia v di colpo, Δv = J/m, nella direzione del colpo.", en: 'A kick is an impulse J = F·Δt: it changes v at once, Δv = J/m, in the direction of the kick.' },
      g: 0, mass: 0.5, predict: true, band: false, maxZones: 0, maxBlasts: 3, maxForce: 1, timeLimit: 6, medals: [3.4, 4.2, 5],
      start: { p: START, r: 0.15 },
      gates: [ring([0, 1.2, -0.9], [0, 0, -1]), ring([0.276, 1.2, -1.754], [0.447, 0, -0.894]), ring([0.916, 1.2, -2.535], [0.781, 0, -0.625]), ring([1.659, 1.2, -3.129], [0.781, 0, -0.625])],
      zones: [], solution: { launch: [0, 0, -1], zones: [], blasts: [{ t: 0.7, dir: [1, 0, 0] }, { t: 1.7, dir: [1, 0, 0.6] }] } },

    { id: 'sandbox', n: 0, sandbox: true, maxBlasts: 99, name: { it: 'Laboratorio libero', en: 'Sandbox' },
      idea: { it: 'Tutti gli strumenti, nessuna porta: prova quello che vuoi.', en: 'Every tool, no gates: try anything.' },
      g: 0, mass: 0.5, predict: true, band: true, maxZones: 6, maxForce: 1, timeLimit: 0, medals: null,
      start: { p: START, r: 0.15 }, gates: [], zones: [], solution: null },
  ];

  // Volume di gioco: scatola attorno alla pista (palco); fuori = palla persa
  const VOLUME = { min: [-3, -0.2, -5], max: [3, 3.2, 1.5] };
  const inVolume = p => P.inBox(p, VOLUME);

  // ---------- validazione dei dati ----------
  function validate(t) {
    const err = [];
    const inPlay = p => p[0] >= -2.2 && p[0] <= 2.2 && p[1] >= 0.5 && p[1] <= 2.2 && p[2] >= -4.2 && p[2] <= 0.6;
    if (!t.name || !t.name.it || !t.name.en) err.push('name');
    if (!t.idea || !t.idea.it || !t.idea.en) err.push('idea');
    if (!inPlay(t.start.p)) err.push('start outside the room');
    t.gates.forEach((g, i) => { if (!inPlay(g.p)) err.push('gate ' + i + ' outside the room'); if (g.type !== 'target' && Math.abs(len(g.n) - 1) > 1e-6) err.push('gate ' + i + ' normal'); });
    t.gates.forEach((g, i) => { if (g.type === 'target' && i !== t.gates.length - 1) err.push('target must be last'); });
    t.zones.forEach((z, i) => { for (let k = 0; k < 3; k++) if (z.max[k] <= z.min[k]) err.push('zone ' + i + ' box'); if (P.inBox(t.start.p, z)) err.push('zone ' + i + ' covers the start'); });
    if (t.solution) {
      if (t.solution.zones.length > t.maxZones) err.push('solution uses too many zones');
      t.solution.zones.forEach(z => { if (len(z.F) > t.maxForce + 1e-9) err.push('solution force too big'); });
      if ((t.solution.blasts || []).length > (t.maxBlasts || 0)) err.push('solution uses too many blasts');
    }
    if (!t.sandbox && (!t.medals || t.medals.length !== 3 || !(t.medals[0] < t.medals[1] && t.medals[1] < t.medals[2] && t.medals[2] <= t.timeLimit))) err.push('medals');
    return err;
  }

  function medalFor(t, time) {
    if (!t.medals || time == null) return 0;
    return time <= t.medals[0] ? 3 : time <= t.medals[1] ? 2 : time <= t.medals[2] ? 1 : 0;   // 3 = oro
  }

  // ---------- una prova ----------
  // Stati: ready (palla ferma sulla partenza) · held (in mano) · flying (prova cronometrata) · free (in volo, non cronometrata)
  //        · done (tutte le porte) · failed (tempo scaduto) · lost (fuori dal volume)
  function Run(track) {
    this.track = track;
    this.reset();
  }
  Run.prototype.reset = function () {
    const t = this.track;
    this.state = 'ready';
    this.ball = { p: t.start.p.slice(), v: [0, 0, 0], m: t.mass };
    this.next = 0; this.time = 0; this.result = null;
    this.passed = t.gates.map(() => false);
    this.events = [];
    this.kicks = []; this.blastsUsed = 0;
  };
  Run.prototype.emit = function (type, data) { this.events.push(Object.assign({ type: type }, data || {})); };
  Run.prototype.inStart = function (p) { return len(sub(p, this.track.start.p)) <= this.track.start.r + 0.05; };
  Run.prototype.timed = function () { return this.state === 'flying'; };

  // la mano prende la palla
  Run.prototype.grab = function () {
    if (this.state === 'flying') { this.emit('void'); }
    this.state = 'held'; this.next = 0; this.time = 0; this.passed = this.track.gates.map(() => false); this.result = null;
    this.kicks = []; this.blastsUsed = 0;
  };
  // colpo: impulso J lungo il versore dir (coordinate di pista). Restituisce true se è partito.
  Run.prototype.blastsLeft = function () { return Math.max(0, (this.track.maxBlasts || 0) - this.blastsUsed); };
  Run.prototype.blast = function (dir) {
    const t = this.track;
    if (!t.maxBlasts) { this.emit('noBlast'); return false; }
    if (this.blastsLeft() <= 0) { this.emit('noBlastsLeft'); return false; }
    if (this.state === 'held' || this.state === 'lost') return false;
    const u = norm(dir), J = mul(u, P.BLAST.J);
    this.kicks.push({ F: mul(u, P.BLAST.J / P.BLAST.dt), n: Math.round(P.BLAST.dt / P.DT) });
    this.blastsUsed++;
    if (this.state === 'ready') { this.state = t.sandbox ? 'free' : 'flying'; this.time = 0; if (!t.sandbox) this.emit('launch'); }
    this.emit('blast', { J: J, vBefore: this.ball.v.slice(), left: this.blastsLeft() });
    return true;
  };
  Run.prototype.hold = function (p) { this.ball.p = p.slice(); this.ball.v = [0, 0, 0]; };
  // la mano lascia la palla con velocità v
  Run.prototype.release = function (v) {
    this.ball.v = v.slice();
    if (this.track.sandbox) { this.state = 'free'; return; }
    if (this.inStart(this.ball.p)) { this.state = 'flying'; this.time = 0; this.emit('launch'); }
    else { this.state = 'free'; this.emit('notStart'); }
  };

  // avanza di dt (passi fissi): env = { zones, g, band }
  Run.prototype.advance = function (env, steps) {
    const b = this.ball, t = this.track;
    for (let i = 0; i < steps; i++) {
      if (this.state === 'held' || this.state === 'lost') return;
      if (this.state === 'ready') {
        if (!env.band) return;                        // (un colpo fa partire la prova da solo: vedi blast)                        // ferma sulla partenza; parte solo se l'elastico tira
        const f = P.forces(b.p, b.m, { zones: [], g: 0, band: env.band });
        if (len(f.net) < 1e-9) return;
        this.state = t.sandbox ? 'free' : 'flying'; this.time = 0; if (!t.sandbox) this.emit('launch');
      }
      let e = env;
      if (this.kicks.length) {
        let k = [0, 0, 0];
        for (const q of this.kicks) { k = add(k, q.F); q.n--; }
        e = Object.assign({}, env, { kick: k });
        this.kicks = this.kicks.filter(q => q.n > 0);
      }
      const seg = P.step(b, e, P.DT);
      if (this.state === 'flying') {
        this.time += P.DT;
        const g = t.gates[this.next];
        if (g) {
          let ok = false;
          if (g.type === 'target') ok = P.inTarget(g, b.p, b.v);
          else {
            const f = P.crossRing(g, seg.p0, seg.p1);
            ok = f >= 0 && (g.type !== 'speed' || len(b.v) >= g.vmin);
            if (f >= 0 && g.type === 'speed' && !ok) this.emit('tooSlow', { gate: this.next, speed: len(b.v) });
          }
          if (ok) {
            this.passed[this.next] = true; this.emit('gate', { gate: this.next });
            this.next++;
            if (this.next >= t.gates.length) { this.state = 'done'; this.result = { time: this.time, medal: medalFor(t, this.time) }; this.emit('done', this.result); }
          }
        }
        if (this.state === 'flying' && t.timeLimit && this.time > t.timeLimit) { this.state = 'failed'; this.emit('timeUp'); }
      }
      if (!inVolume(b.p)) { this.state = 'lost'; this.emit('lost'); return; }
    }
  };

  // simula la soluzione di una pista (senza mani): restituisce la prova finita
  function simulateSolution(t, maxT) {
    const r = new Run(t);
    const sol = t.solution;
    const zones = t.zones.concat(sol.zones);
    const env = { zones: zones, g: t.g, band: sol.band || null };
    r.grab(); r.hold(t.start.p); r.release(sol.launch);
    const n = Math.round((maxT || (t.timeLimit + 1)) / P.DT);
    const blasts = (sol.blasts || []).slice();
    for (let i = 0; i < n && (r.state === 'flying'); i++) {
      while (blasts.length && r.time >= blasts[0].t - 1e-9) r.blast(blasts.shift().dir);
      r.advance(env, 1);
    }
    return r;
  }

  // traccia guida: punti di Catmull-Rom attraverso partenza e porte
  function pathPoints(t, perSeg) {
    const pts = [t.start.p].concat(t.gates.map(g => g.p));
    if (pts.length < 2) return pts;
    perSeg = perSeg || 12;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < perSeg; k++) {
        const s = k / perSeg, s2 = s * s, s3 = s2 * s;
        out.push([0, 1, 2].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * s + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * s2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * s3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  const api = { TRACKS: TRACKS, VOLUME: VOLUME, inVolume: inVolume, validate: validate, medalFor: medalFor, Run: Run, simulateSolution: simulateSolution, pathPoints: pathPoints, zone: zone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tracks = api;
})(typeof window !== 'undefined' ? window : globalThis);
