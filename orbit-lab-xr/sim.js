/* sim.js — stato della simulazione di Orbit Lab senza DOM né THREE: lancio, storia dei passi (riavvolgimento), propulsori, livelli,
   missioni. Porta fedele della sezione SIM/UI del 2D Orbit Lab (`../orbit-lab`), tranne la modalità "programma di spinta"
   (e quindi la missione 7), che in VR richiederebbe un editor di grafici. Il tempo è passato dall'esterno (nessun setTimeout):
   `update(dtReal, nowMs)` fa avanzare la simulazione e promuove i clic lunghi dei propulsori in accensioni continue. */
(function (root) {
  'use strict';

  const Core = root.OrbitCore || (typeof require !== 'undefined' ? require('./core.js') : null);
  const CORE = Core.CORE;

  const TICK = 0.01, MAXTICKS = 600000, HOLD_MS = 230;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const PLANETS = [
    { id: 'none', name: 'None' },
    { id: 'earth', name: 'Earth', R: 6371, GM: 398600.4 },
    { id: 'moon', name: 'Moon', R: 1737.4, GM: 4902.8 },
    { id: 'mars', name: 'Mars', R: 3389.5, GM: 42828.4 }
  ];
  for (const p of PLANETS) if (p.R) { p.v0 = Math.sqrt(p.GM / p.R); p.tau = p.R / p.v0; }

  const LEVEL_FEATS = { numbers: 2, readFull: 2, barNumbers: 2, radial: 2, kepler: 2, realUnits: 3, advread: 3, work: 3, budget: 3, shipcam: 1 };
  const KEYS = { pro: 1, retro: 2, out: 3, in: 4 };

  const STR = {
    types: { circle: 'circle', ellipse: 'ellipse', parabola: '≈ parabola', hyperbola: 'hyperbola', radial: 'straight line', crash: 'hits the ground', stay: 'on the pad' },
    lv: ['Qualitative: shapes, closest and farthest point.', 'Quantitative: numbers, units, radial thrusters, Kepler strobe.', 'Advanced: work by thrust, real-planet units, Δv budget.']
  };

  // Missioni: prevedi -> osserva -> spiega. check(ctx) è vero quando l'obiettivo è raggiunto (stesse formule dell'app 2D).
  const MISSIONS = [
    { id: 1, level: 1, title: 'Drop and throw', setup: { h: 0.5, v: 0, ang: 0 },
      q: 'Released at rest from the tower, how does the ship move?',
      opts: ['Straight toward the centre of the planet', 'Down and sideways, like a curve', 'It stays where it is, there is no air to push it'], correct: 0,
      goal: 'Do two launches: release with speed 0, then throw horizontally with a speed above 0.', hint: 'Set the speed to 0 and press Launch. Reset and try again with a sideways speed.',
      explain: 'At rest the ship falls along a straight line toward the centre: gravity always points to the centre, not "down" in a fixed direction. Thrown sideways it follows a curve (a piece of an ellipse) that bends toward the centre.',
      check: c => c.runs.some(r => r.v < 1e-6) && c.runs.some(r => r.v > 0.02 && Math.abs(r.ang) < 10) },
    { id: 2, level: 1, title: "Newton's cannon", setup: { h: 0.2, v: 0.5, ang: 0 },
      q: 'Throw horizontally faster and faster. What happens?',
      opts: ['There is a minimum speed above which the ship never lands', 'It always lands, only farther away', 'It never lands only at the escape speed'], correct: 0,
      goal: 'Find a horizontal speed so the ship never lands. Then do it again at a different tower height.', hint: 'Watch the dashed orbit: when it stops touching the ground, the ship will not land.',
      explain: 'The ship never lands when the closest point of its orbit stays above the ground. A taller tower lowers the threshold.',
      check: c => { const ok = c.runs.filter(r => Math.abs(r.ang) < 2 && r.rp >= 1 - 1e-6 && r.v > 0); return ok.some(a => ok.some(b => Math.abs(a.h - b.h) > 0.15)); } },
    { id: 3, level: 1, title: 'Why does it float?', setup: { h: 0.5, v: 'vc', ang: 0, launch: true },
      q: 'Inside a ship coasting in orbit with the thrusters off, objects float. Why?',
      opts: ['There is no gravity up there', 'Gravity still acts, and the ship and the objects fall together', 'Air inside the ship pushes them up'], correct: 1,
      goal: 'Coast for 5 time units with no thrust, and watch the cabin.', hint: 'Use ¼× or 1× speed and look at the small objects floating in the cabin.',
      explain: 'Gravity is still large. The ship and everything in it have the same acceleration, so nothing pushes against anything. Floating means free fall, not absence of gravity.',
      check: c => c.sim.t >= 5 && c.sim.dv < 1e-9 && c.info.type !== 'stay' && !c.info.crash },
    { id: 4, level: 2, title: 'Circular orbit at height h', setup: { h: 0.6, v: 0.8, ang: 0 },
      q: 'At the tower height h = 0.6 R, the circular speed in units of v꜀₀ is…',
      opts: ['1, the same as at the surface', '1/√(1+h) ≈ 0.79, smaller than at the surface', '√(1+h) ≈ 1.26, larger'], correct: 1,
      goal: 'Set v = v꜀(h) with a horizontal launch and get e < 0.01.', hint: 'Use the "vc" button next to the speed, then fine-tune.',
      explain: 'Gravity is weaker farther out (1/r²), so less speed is needed: v꜀² = 1/r.',
      check: c => c.info.e < 0.01 && !c.info.crash && c.sim.h > 0.15 && c.runs.length > 0 },
    { id: 5, level: 2, title: 'Escape', setup: { h: 0.2, v: 1.0, ang: 0 },
      q: 'Compared with the circular speed at the same height, the escape speed is…',
      opts: ['Twice as large', '√2 ≈ 1.41 times as large', 'The same, just in another direction'], correct: 1,
      goal: 'Find the speed at which the orbit becomes a parabola (E ≈ 0).', hint: 'Use the "vesc" button, then see how the energy bar E sits at the escape line.',
      explain: 'Escape means E = ½v² − 1/r = 0, so v² = 2/r, which is 2 times the circular v² = 1/r. Hence v_esc = √2·v꜀ at any height.',
      check: c => Math.abs(c.info.eps) < 0.01 && c.info.type !== 'radial' && c.runs.length > 0 },
    { id: 6, level: 2, title: 'Speed up, go slower', setup: { h: 0.5, v: 'vc', ang: 0, launch: true },
      q: 'After a prograde burn, when the ship has climbed to its new farthest point, its speed is…',
      opts: ['Higher than before the burn', 'Lower than before the burn', 'The same'], correct: 1,
      goal: 'Burn prograde once (Δv ≥ 0.03), climb to the new orbit, and get below the speed you had before the burn.', hint: 'Burn prograde, then watch K, U and E on the bars while the ship climbs.',
      explain: 'The burn adds kinetic energy, so the ship climbs. On the way up it trades kinetic for potential energy and, far out, moves slower than before: a higher orbit is a slower one.',
      check: c => c.sim.vFirstBurn > 0 && c.sim.dv >= 0.03 && !c.info.crash && c.info.e > 0.05 && c.info.r > 1.1 * (1 + c.sim.h) && c.info.v < c.sim.vFirstBurn }
  ];

  // ---------- storia dei passi: righe Float64 [t,x,y,vx,vy,W,dv,k,a,ang,pad] ----------
  const HS = 11;
  function History() { this.buf = new Float64Array(HS * 4096); this.n = 0; }
  History.prototype.clear = function () { this.n = 0; };
  History.prototype.push = function (st, cmd) {
    if (this.n >= MAXTICKS) return false;
    if ((this.n + 1) * HS > this.buf.length) { const b = new Float64Array(this.buf.length * 2); b.set(this.buf); this.buf = b; }
    const o = this.n * HS, b = this.buf;
    b[o] = st.t; b[o + 1] = st.x; b[o + 2] = st.y; b[o + 3] = st.vx; b[o + 4] = st.vy; b[o + 5] = st.W; b[o + 6] = st.dv;
    b[o + 7] = cmd ? cmd.k : 0; b[o + 8] = cmd ? cmd.a : 0; b[o + 9] = cmd ? (cmd.ang || 0) : 0; b[o + 10] = st.pad ? 1 : 0;
    this.n++; return true;
  };
  History.prototype.get = function (i) {
    const o = clamp(i, 0, this.n - 1) * HS, b = this.buf;
    return { t: b[o], x: b[o + 1], y: b[o + 2], vx: b[o + 3], vy: b[o + 4], W: b[o + 5], dv: b[o + 6], cmd: { k: b[o + 7], a: b[o + 8], ang: b[o + 9] }, pad: b[o + 10] === 1 };
  };
  History.prototype.trunc = function (n) { this.n = Math.max(1, n); };

  function Sim(opts) {
    opts = opts || {};
    this.S = {
      level: 1, ovr: {}, h: 0.5, v: 0, ang: 0, planet: 'none',
      phase: 'prep', cur: 0, playing: false, speed: 1, acc: 0,
      tl: 0.2, dvStep: 0.02, budget: 2, hold: 0,
      show: { vel: true, grav: true, thr: true, net: false, labels: false, trail: true, orbit: true, grid: false, ghosts: true, bars: true, strobe: false, cam: true },
      scale: 'lin', kep: 1,
      ghosts: [], crashed: null, runs: [], vFirstBurn: 0, launchH: null
    };
    this.H = new History();
    this.done = new Set();
    this.M = { id: 0, choice: -1, stage: 'predict' };
    this.thr = { down: {}, t0: {}, burning: {} };
    this.events = [];   // messaggi per l'interfaccia (toast)
    this.resetFlight(false);
  }
  const P = Sim.prototype;

  P.feat = function (k) { const S = this.S; if (k in S.ovr) return !!S.ovr[k]; return S.level >= (LEVEL_FEATS[k] || 1); };
  P.planetInfo = function () { return PLANETS.find(p => p.id === this.S.planet) || PLANETS[0]; };
  P.say = function (m) { this.events.push(m); };
  P.setLevel = function (l) { this.S.level = clamp(l | 0, 1, 3); this.S.ovr = {}; };

  P.resetFlight = function (keepGhost) {
    const S = this.S, H = this.H;
    if (keepGhost !== false && S.phase === 'flying' && H.n > 3) this.archiveTrail();
    S.phase = 'prep'; S.playing = false; S.cur = 0; S.acc = 0; S.crashed = null; S.vFirstBurn = 0; S.hold = 0;
    this.thr = { down: {}, t0: {}, burning: {} };
    H.clear();
    H.push(CORE.launchState(S.h, S.v, S.ang), null);
  };
  P.archiveTrail = function () {
    const S = this.S, H = this.H, pts = [], n = H.n, stride = Math.max(1, Math.floor(n / 400));
    for (let i = 0; i < n; i += stride) { const q = H.get(i); pts.push([q.x, q.y]); }
    const q = H.get(n - 1); pts.push([q.x, q.y]);
    S.ghosts.push(pts); if (S.ghosts.length > 8) S.ghosts.shift();
  };
  // parametri di lancio cambiati: se in volo riparte dal lancio, altrimenti aggiorna lo stato di partenza
  P.launchChanged = function () {
    const S = this.S;
    S.h = clamp(+S.h || 0, 0, 1.5); S.v = clamp(+S.v || 0, 0, 1.6); S.ang = clamp(+S.ang || 0, -10, 90);
    this.resetFlight(S.phase === 'flying');
  };
  P.launchInfoNow = function () { const q = this.H.get(0); return CORE.info(q.x, q.y, q.vx, q.vy, false); };
  P.launch = function () {
    const S = this.S;
    if (S.phase !== 'prep') this.resetFlight();
    const li = this.launchInfoNow();
    S.runs.push({ h: S.h, v: S.v, ang: S.ang, mode: 'cannon', rp: li.rp, e: li.e, eps: li.eps, type: li.type, crash: li.crash });
    S.phase = 'flying'; S.playing = true; S.launchH = S.h; S.acc = 0;
  };
  P.viewState = function () { return this.H.get(this.S.cur); };
  P.atEnd = function () { return this.S.cur >= this.H.n - 1; };
  P.info = function () { const q = this.viewState(); return CORE.info(q.x, q.y, q.vx, q.vy, q.pad); };

  P.activeCmd = function (st) {
    const S = this.S;
    if (S.hold) {
      const budgetOn = S.budget < 2 && this.feat('budget');
      if (!(budgetOn && st.dv >= S.budget - 1e-9)) return { k: S.hold, a: S.tl, ang: 0 };
    }
    return null;
  };
  P.tickOnce = function () {
    const S = this.S, H = this.H;
    if (S.crashed || H.n >= MAXTICKS) return false;
    const st = H.get(H.n - 1), cmd = this.activeCmd(st);
    if (cmd && !S.vFirstBurn && cmd.k && cmd.k < 5 && cmd.a > 0 && !st.pad) S.vFirstBurn = Math.hypot(st.vx, st.vy);
    const res = CORE.advance(st, TICK, cmd);
    H.push(st, cmd);
    if (res.crash) { S.crashed = res.crash; S.playing = false; }
    S.cur = H.n - 1;
    return true;
  };
  P.stepSim = function (dt) {
    const S = this.S, H = this.H;
    if (S.phase !== 'flying') return;
    if (S.crashed && S.cur >= H.n - 1) return;
    S.acc += dt; let g = 0;
    if (S.cur < H.n - 1 && !S.hold) { // riproduce gli stati registrati, senza ramificare finché lo studente non agisce
      const k = Math.floor(S.acc / TICK); S.acc -= k * TICK; S.cur = Math.min(H.n - 1, S.cur + k);
      if (S.cur >= H.n - 1 && S.crashed) S.playing = false;
      return;
    }
    if (S.cur < H.n - 1) H.trunc(S.cur + 1);
    while (S.acc >= TICK && g < 800) { S.acc -= TICK; g++; if (!this.tickOnce()) break; }
    if (H.n >= MAXTICKS) S.playing = false;
  };
  P.burnImpulse = function (k) {
    const S = this.S, H = this.H;
    if (S.phase !== 'flying' || S.crashed) return false;
    if (S.cur < H.n - 1) H.trunc(S.cur + 1);
    const st = H.get(H.n - 1);
    if (st.pad) return false;
    let d = S.dvStep;
    if (S.budget < 2 && this.feat('budget')) { d = Math.min(d, S.budget - st.dv); if (d <= 1e-9) return false; }
    if (!S.vFirstBurn && k < 5) S.vFirstBurn = Math.hypot(st.vx, st.vy);
    CORE.impulse(st, k, d);
    H.push(st, null); S.cur = H.n - 1; return true;
  };
  P.setCursor = function (i) { const S = this.S; S.cur = clamp(Math.round(i), 0, this.H.n - 1); S.playing = false; };
  P.togglePlay = function () {
    const S = this.S;
    if (S.phase === 'prep') { this.launch(); return; }
    if (S.crashed && this.atEnd()) { this.say('The ship has landed. Reset, or go back with the scrubber.'); return; }
    S.playing = !S.playing; S.acc = 0;
  };
  P.step = function () {
    const S = this.S;
    if (S.phase === 'prep') { this.say('Press Launch first.'); return; }
    S.playing = false;
    if (S.cur < this.H.n - 1) S.cur = Math.min(this.H.n - 1, S.cur + 10); else this.stepSim(0.1 + 1e-9);
  };

  // ---- propulsori: premuto a lungo = accensione continua, clic breve = un passo di Δv ----
  P.thrDown = function (name, now) {
    const S = this.S, t = this.thr;
    if (t.down[name]) return;
    if ((name === 'out' || name === 'in') && !this.feat('radial')) { this.say('Radial thrusters unlock at level 2.'); return; }
    if (S.phase !== 'flying') { this.say('Launch first, then use the thrusters.'); return; }
    if (S.crashed && this.atEnd()) return;
    t.down[name] = true; t.burning[name] = false; t.t0[name] = now;
  };
  P.thrUp = function (name) {
    const S = this.S, t = this.thr;
    if (!t.down[name]) return;
    t.down[name] = false;
    if (t.burning[name]) { if (S.hold === KEYS[name]) S.hold = 0; t.burning[name] = false; }
    else if (!this.burnImpulse(KEYS[name])) this.say('No Δv available here.');
  };
  P.thrHeld = function (name) { return !!this.thr.down[name]; };
  P.thrBurning = function (name) { return !!this.thr.burning[name]; };
  P.thrAll = function () { for (const k in KEYS) this.thrUp(k); };

  // Avanza il tempo reale: promuove i clic lunghi, poi fa avanzare la simulazione.
  P.update = function (dtReal, nowMs) {
    const S = this.S, t = this.thr;
    for (const k in t.down) {
      if (t.down[k] && !t.burning[k] && nowMs - t.t0[k] >= HOLD_MS) {
        t.burning[k] = true; if (S.cur < this.H.n - 1) this.H.trunc(S.cur + 1);
        S.hold = KEYS[k]; S.playing = true; S.acc = 0;
      }
    }
    if (S.playing) this.stepSim(dtReal * S.speed);
  };

  // ---- missioni ----
  P.missionCtx = function () {
    const S = this.S, q = this.viewState(), inf = CORE.info(q.x, q.y, q.vx, q.vy, q.pad);
    return { runs: S.runs, info: inf, vc: CORE.vc(S.h), sim: { t: q.t, dv: q.dv, h: S.h, vFirstBurn: S.vFirstBurn, crashed: S.crashed, launchH: S.launchH, mode: 'cannon' } };
  };
  P.applySetup = function (m) {
    const S = this.S, su = m.setup;
    if (m.level > S.level) { this.setLevel(m.level); this.say('Switched to level ' + m.level + ' for this mission'); }
    S.h = su.h; S.v = su.v === 'vc' ? Math.min(1.6, Math.round(CORE.vc(su.h) * 100) / 100) : su.v; S.ang = su.ang || 0;
    if (su.v === 'vc') S.v = Math.min(1.6, CORE.vc(su.h));
    S.runs = []; S.ghosts = [];
    this.resetFlight(false);
    if (su.launch) { this.launch(); S.speed = 1; }
  };
  P.missionOpen = function (id) { this.M = this.M.id === id ? { id: 0, choice: -1, stage: 'predict' } : { id: id, choice: -1, stage: 'predict' }; };
  P.missionPick = function (i) { const m = MISSIONS.find(x => x.id === this.M.id); if (!m) return; this.M.choice = i; this.M.stage = 'run'; this.applySetup(m); };
  P.missionAgain = function () { const m = MISSIONS.find(x => x.id === this.M.id); if (!m) return; this.M.stage = 'run'; this.applySetup(m); };
  P.missionExplain = function () { this.M.stage = 'explain'; };
  P.missionCheck = function () {
    const M = this.M, S = this.S;
    if (M.stage !== 'run' || !M.id) return false;
    const m = MISSIONS.find(x => x.id === M.id); if (!m) return false;
    let ok = false; try { ok = m.check(this.missionCtx()); } catch (e) { /* ignora */ }
    if (ok && S.phase === 'flying') { M.stage = 'explain'; this.done.add(m.id); this.say('Goal reached: ' + m.title); return true; }
    return false;
  };

  function typeLabel(I) {
    if (I.type === 'stay') return STR.types.stay;
    const base = STR.types[I.type] || I.type;
    return I.crash ? base + ' → ' + STR.types.crash : base;
  }

  const api = { Sim: Sim, MISSIONS: MISSIONS, PLANETS: PLANETS, LEVEL_FEATS: LEVEL_FEATS, KEYS: KEYS, STR: STR, TICK: TICK, HOLD_MS: HOLD_MS, typeLabel: typeLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OrbitSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
