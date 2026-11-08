/* quick.js — galleria rapida: stato e gesti dello stick, puri (nessun THREE, nessun DOM), condivisi con la galleria sul palmo.
   Stick su = apre, giù = chiude; sinistra/destra sullo stick che l'ha aperta scorre le superfici (anello unico ordinato per famiglia);
   sinistra/destra sull'altro stick salta di famiglia. In WebXR l'asse y dello stick è negativo verso l'alto. */
(function (root) {
  'use strict';

  const TH = 0.7;   // soglia dell'asse (0..1)
  function dirOf(x, y) {
    if (Math.hypot(x, y) < TH) return null;
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y < 0 ? 'up' : 'down');
  }

  // items = [{ id, group }] con group = indice intero della famiglia; l'ordine interno resta quello dato
  function Quick(items, opts) {
    opts = opts || {};
    this.idleMs = opts.idleMs === undefined ? 8000 : opts.idleMs;
    this.items = items.map((q, k) => ({ id: q.id, group: q.group, k: k })).sort((a, b) => a.group - b.group || a.k - b.k);
    this.i = 0; this.open = false; this.owner = null; this.last = 0; this.sticks = {};
  }
  Quick.prototype.size = function () { return this.items.length; };
  Quick.prototype.current = function () { return this.items[this.i].id; };
  Quick.prototype.groupIdx = function () { return this.items[this.i].group; };
  Quick.prototype.set = function (id) { const k = this.items.findIndex(q => q.id === id); if (k >= 0) this.i = k; return k >= 0; };
  Quick.prototype.pos = function () { return (this.i + 1) + '/' + this.items.length; };
  Quick.prototype.step = function (d) { const n = this.items.length; this.i = ((this.i + d) % n + n) % n; };
  Quick.prototype.groupStep = function (d) { // salta alla prima superficie della famiglia successiva/precedente (circolare)
    const gs = [...new Set(this.items.map(q => q.group))], g = this.items[this.i].group, k = gs.indexOf(g);
    const ng = gs[((k + d) % gs.length + gs.length) % gs.length];
    this.i = this.items.findIndex(q => q.group === ng);
  };
  Quick.prototype.close = function () { this.open = false; this.owner = null; };
  Quick.prototype.update = function (sid, x, y, now) { // un evento per ogni fronte (cambio di direzione); restituisce una lista
    const st = this.sticks[sid] || (this.sticks[sid] = { dir: null }), d = dirOf(x, y), ev = [];
    if (d === st.dir) return ev;
    st.dir = d;
    if (!d) return ev;
    this.last = now;
    if (d === 'up' && !this.open) { this.open = true; this.owner = sid; ev.push({ type: 'open', stick: sid }); }
    else if (d === 'down' && this.open) { this.close(); ev.push({ type: 'close' }); }
    else if ((d === 'left' || d === 'right') && this.open) {
      const s = d === 'right' ? 1 : -1;
      if (sid === this.owner) { this.step(s); ev.push({ type: 'item', dir: s }); }
      else { this.groupStep(s); ev.push({ type: 'group', dir: s }); }
    }
    return ev;
  };
  Quick.prototype.tick = function (now) { // chiusura per inattività
    if (this.open && now - this.last > this.idleMs) { this.close(); return [{ type: 'close', idle: true }]; }
    return [];
  };

  const api = { Quick: Quick, dirOf: dirOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Quick = api;
})(typeof window !== 'undefined' ? window : globalThis);
