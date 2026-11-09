/* pointer.js — logica pura del puntatore a raggio, uguale per controller (grilletto) e mani (pinza col raggio).
   Un Tracker per sorgente trasforma lo stato (premuto? cosa indica il raggio?) in eventi:
     down  — premuto sul bersaglio (un pulsante si attiva subito);
     tap   — rilasciato presto e senza spostarsi (selezione di un oggetto);
     hold  — tenuto fermo oltre holdMs (menu rapido dell'oggetto);
     cancel — il bersaglio si è spostato oltre la tolleranza.
   Per le mani, il bersaglio viene "agganciato" quando la pinza si sta chiudendo (near): quando le dita si toccano
   la posa della mano cambia e il raggio salterebbe. Nessun THREE, nessun DOM: testabile in Node. */
(function (root) {
  'use strict';

  function Tracker(opts) {
    opts = opts || {};
    this.holdMs = opts.holdMs === undefined ? 500 : opts.holdMs;
    this.tapMs = opts.tapMs === undefined ? 450 : opts.tapMs;
    this.slop = opts.slop === undefined ? 0.04 : opts.slop; // m: spostamento massimo del punto indicato
    this.s = {};
  }

  // s = { down: bool, near: bool, target: id|null, point: [x,y,z]|null, grabbing: bool }; now in ms
  Tracker.prototype.update = function (id, s, now) {
    const st = this.s[id] || (this.s[id] = { down: false, pre: null, target: null, t0: 0, p0: null, held: false, dead: false });
    const ev = { down: null, tap: null, hold: null, cancel: null, target: s.target, latched: null };
    if (s.grabbing) { // la sorgente sta afferrando un oggetto: nessun clic
      st.down = false; st.pre = null; st.target = null; st.dead = false;
      return ev;
    }
    if (!st.down) {
      if (s.near && !s.down) { if (!st.pre) st.pre = s.target ? { target: s.target, point: s.point } : null; }
      else if (!s.near && !s.down) st.pre = null;
      if (s.down) {
        const t = st.pre || (s.target ? { target: s.target, point: s.point } : null);
        st.down = true; st.t0 = now; st.held = false; st.dead = false; st.pre = null;
        st.target = t ? t.target : null; st.p0 = t ? t.point : null;
        if (st.target) ev.down = st.target;
      }
    } else if (!s.down) {
      const target = st.target;
      if (target && !st.held && !st.dead && now - st.t0 <= this.tapMs) ev.tap = target;
      st.down = false; st.target = null; st.pre = null;
    } else if (st.target && !st.dead) {
      if (s.point && st.p0) {
        const dx = s.point[0] - st.p0[0], dy = s.point[1] - st.p0[1], dz = s.point[2] - st.p0[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > this.slop) { st.dead = true; ev.cancel = st.target; return ev; }
      }
      if (!st.held && now - st.t0 >= this.holdMs) { st.held = true; ev.hold = st.target; }
    }
    ev.latched = st.down ? st.target : (st.pre ? st.pre.target : null);
    return ev;
  };
  Tracker.prototype.reset = function () { this.s = {}; };

  // Bersaglio più vicino lungo un raggio tra punti campione (locali), con soglia perpendicolare maxD. Restituisce {i, t, d} o null.
  // o, d in coordinate dello stesso sistema dei punti; d normalizzata. samples = Float32Array xyz.
  function nearestOnRay(samples, o, d, maxD) {
    let best = null, bd = maxD;
    for (let k = 0; k < samples.length; k += 3) {
      const vx = samples[k] - o[0], vy = samples[k + 1] - o[1], vz = samples[k + 2] - o[2];
      const t = vx * d[0] + vy * d[1] + vz * d[2];
      if (t <= 0) continue;
      const px = vx - t * d[0], py = vy - t * d[1], pz = vz - t * d[2];
      const dist = Math.sqrt(px * px + py * py + pz * pz);
      if (dist < bd || (best && Math.abs(dist - bd) < 1e-9 && t < best.t)) { bd = dist; best = { i: k / 3, t: t, d: dist }; }
    }
    return best;
  }

  const api = { Tracker: Tracker, nearestOnRay: nearestOnRay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Pointer = api;
})(typeof window !== 'undefined' ? window : globalThis);
