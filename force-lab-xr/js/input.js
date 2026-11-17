/* input.js — Force Lab XR: logica pura degli ingressi (nessun THREE, nessun DOM; testabile in Node).
   - ThrowEstimator: velocità di rilascio dalla storia delle posizioni (retta ai minimi quadrati in una finestra che salta
     gli ultimi fotogrammi, dove il rilascio sporca la posa).
   - Button: tocco breve (tap) o pressione lunga (hold) con avanzamento 0..1 per l'anello indicatore.
   - Stick: scatti su/giù/sinistra/destra con isteresi.
   - palmUp / fist: gesti della mano da posizioni delle articolazioni (array [x,y,z]). */
(function (root) {
  'use strict';

  // finestre in ms prima del rilascio: [inizio, fine]; le mani rilevano il rilascio in ritardo
  const WINDOWS = { controller: [110, 15], hand: [150, 35] };
  const MAX_SPEED = 4;

  function ThrowEstimator(keepMs) { this.keep = keepMs || 400; this.s = []; }
  ThrowEstimator.prototype.clear = function () { this.s = []; };
  ThrowEstimator.prototype.push = function (t, p) {
    this.s.push({ t: t, p: p.slice() });
    while (this.s.length && t - this.s[0].t > this.keep) this.s.shift();
  };
  // velocità stimata al tempo `now` (ms); kind = 'controller' | 'hand'
  ThrowEstimator.prototype.velocity = function (now, kind) {
    const w = WINDOWS[kind] || WINDOWS.controller;
    let pts = this.s.filter(q => now - q.t <= w[0] && now - q.t >= w[1]);
    if (pts.length < 3) pts = this.s.slice(-4);          // fotogrammi lenti: usa gli ultimi campioni
    if (pts.length < 2) return [0, 0, 0];
    const t0 = pts[0].t;
    let st = 0, stt = 0; const sp = [0, 0, 0], stp = [0, 0, 0];
    for (const q of pts) { const t = (q.t - t0) / 1000; st += t; stt += t * t; for (let k = 0; k < 3; k++) { sp[k] += q.p[k]; stp[k] += t * q.p[k]; } }
    const n = pts.length, den = n * stt - st * st;
    if (Math.abs(den) < 1e-12) return [0, 0, 0];
    const v = [0, 1, 2].map(k => (n * stp[k] - st * sp[k]) / den);
    const L = Math.hypot(v[0], v[1], v[2]);
    return L > MAX_SPEED ? v.map(x => x * MAX_SPEED / L) : v;
  };

  // Pulsante: tap al rilascio se tenuto meno di holdMs; hold una volta sola quando supera holdMs.
  function Button(holdMs) { this.holdMs = holdMs || 600; this.down = false; this.t0 = 0; this.fired = false; }
  Button.prototype.update = function (pressed, now) {
    const ev = { press: false, tap: false, hold: false, release: false, progress: 0 };
    if (pressed && !this.down) { this.down = true; this.t0 = now; this.fired = false; ev.press = true; }
    else if (pressed && this.down) {
      const el = now - this.t0;
      if (!this.fired) {
        ev.progress = el < 150 ? 0 : Math.min(1, (el - 150) / (this.holdMs - 150));
        if (el >= this.holdMs) { this.fired = true; ev.hold = true; ev.progress = 0; }
      }
    } else if (!pressed && this.down) {
      this.down = false; ev.release = true;
      if (!this.fired) ev.tap = true;
    }
    return ev;
  };
  // annulla: il rilascio successivo non darà tap (il pulsante è stato "consumato" da altro)
  Button.prototype.consume = function () { if (this.down) this.fired = true; };

  // Levetta: scatti con isteresi (si arma oltre 0.7, si riarma sotto 0.3). y negativo = su (xr-standard).
  function Stick() { this.armed = true; }
  Stick.prototype.update = function (x, y) {
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (m < 0.3) { this.armed = true; return null; }
    if (!this.armed || m < 0.7) return null;
    this.armed = false;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
    return y < 0 ? 'up' : 'down';
  };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // Normale del palmo (verso il lato della mano interna). j: {wrist, indexMeta, pinkyMeta}; handed: 'left' | 'right'.
  // Il segno per la mano sinistra è invertito (stessa convenzione di Surface Lab XR: DA VERIFICARE sulla Quest).
  function palmNormal(j, handed) {
    const a = sub(j.indexMeta, j.wrist), b = sub(j.pinkyMeta, j.wrist);
    let n = nrm(cross(a, b));
    if (handed === 'left') n = n.map(x => -x);
    return n;
  }
  // palmo rivolto verso l'alto: componente y della normale oltre la soglia
  function palmUp(j, handed, thr) { return palmNormal(j, handed)[1] > (thr === undefined ? 0.75 : thr); }
  // pugno: punte di indice, medio e anulare vicine al centro del palmo (metacarpo del medio)
  function fist(j, thr) {
    thr = thr === undefined ? 0.065 : thr;
    return dist(j.indexTip, j.middleMeta) < thr && dist(j.middleTip, j.middleMeta) < thr && dist(j.ringTip, j.middleMeta) < thr;
  }

  // mano aperta: punte di indice, medio e anulare lontane dal centro del palmo
  function openHand(j, thr) {
    thr = thr === undefined ? 0.085 : thr;
    return dist(j.indexTip, j.middleMeta) > thr && dist(j.middleTip, j.middleMeta) > thr && dist(j.ringTip, j.middleMeta) > thr;
  }
  // Colpo con la mano: pugno tenuto ≥ holdMs, poi mano aperta entro openMs da quando il pugno si scioglie.
  function BlastGesture(holdMs, openMs) { this.holdMs = holdMs || 150; this.openMs = openMs || 150; this.fist0 = null; this.release = null; }
  BlastGesture.prototype.update = function (isFist, isOpen, now) {
    if (isFist) { if (this.fist0 === null) this.fist0 = now; this.release = null; return false; }
    if (this.fist0 !== null) { this.release = now - this.fist0 >= this.holdMs ? now : null; this.fist0 = null; }
    if (this.release !== null) {
      if (now - this.release > this.openMs) { this.release = null; return false; }
      if (isOpen) { this.release = null; return true; }
    }
    return false;
  };
  // Doppio tocco: la seconda pressione entro gapMs dall'inizio della prima, se la prima è stata breve (< tapMs).
  function DoubleTap(gapMs, tapMs) { this.gapMs = gapMs || 320; this.tapMs = tapMs || 250; this.down = false; this.t0 = -1e9; this.short = false; }
  DoubleTap.prototype.update = function (pressed, now) {
    let fire = false;
    if (pressed && !this.down) {
      if (this.short && now - this.t0 <= this.gapMs) { fire = true; this.short = false; this.t0 = -1e9; }
      else this.t0 = now;
    } else if (!pressed && this.down) this.short = now - this.t0 < this.tapMs;
    this.down = pressed;
    return fire;
  };

  const api = { openHand: openHand, BlastGesture: BlastGesture, DoubleTap: DoubleTap, ThrowEstimator: ThrowEstimator, Button: Button, Stick: Stick, palmNormal: palmNormal, palmUp: palmUp, fist: fist, WINDOWS: WINDOWS, MAX_SPEED: MAX_SPEED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Input = api;
})(typeof window !== 'undefined' ? window : globalThis);
