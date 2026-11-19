// Composition Lab XR · compose.js
// Modello puro (nessun DOM, nessun THREE): funzioni f e g, catena x → f(x) → g(f(x)), confronto d'ordine,
// campionamento delle curve nel cubo [−R, R]³, traccia di g∘f (i punti compaiono solo dove la mano è passata), esempi.
// UMD: in Node `require`, nel browser globale `Compose`.
(function (root) {
  "use strict";
  const R = 4;                                   // il cubo va da −R a R su ogni asse
  const inBox = (v) => Number.isFinite(v) && Math.abs(v) <= R + 1e-9;
  const snap = (x, step) => Math.min(R, Math.max(-R, Math.round(x / (step || 0.05)) * (step || 0.05)));

  // Un esempio: f(x), g(y), x iniziale. Nome e domanda guida sono nelle stringhe: "pr.<id>" e "pq.<id>".
  const P = (id, f, g, x) => ({ id, f, g, x });
  const LIST = [
    P("square", "x^2", "y - 2", 1.5),
    P("shifted", "x^2 - 2", "sqrt(y)", 1.5),
    P("root", "x - 1", "sqrt(y)", 2),
    P("flip", "-x", "y^2/2", 1.5),
    P("double", "2x", "y^2/4", 1),
    P("wave", "x^2", "2sin(2y)", 1),
    P("order", "-x/2", "-2y", 1.5),
    P("affine", "x/2 + 1", "2(y - 1)", 2),
    P("recip", "1/x", "1/y", 2),
  ];
  const byId = (id) => LIST.find((p) => p.id === id) || null;

  // Composizione e catena per un ingresso. okY: f(x) cade nel cubo; okZ: anche g(f(x)).
  function chain(f, g, x) {
    const y = f(x), z = Number.isFinite(y) ? g(y) : NaN, okY = inBox(y), okZ = okY && inBox(z);
    return { x, y, z, okY, okZ };
  }
  // Campiona una curva a tratti, spezzandola dove non è definita, esce dal cubo o salta. fn(u) → [x, y, z] (matematici).
  function sample(a, b, N, fn) {
    const segs = []; let cur = [], prev = null;
    for (let i = 0; i <= N; i++) {
      const p = fn(a + ((b - a) * i) / N), ok = p.every(inBox);
      const jump = ok && prev && p.some((v, k) => Math.abs(v - prev[k]) > R * 0.6);
      if (!ok || jump) { if (cur.length > 1) segs.push(cur); cur = []; }
      if (ok) cur.push(p);
      prev = ok ? p : null;
    }
    if (cur.length > 1) segs.push(cur);
    return segs;
  }
  // Immagine di f nel cubo (campionata): la parte di g che g∘f usa davvero.
  function range(f, N) {
    let lo = Infinity, hi = -Infinity; N = N || 600;
    for (let i = 0; i <= N; i++) { const y = f(-R + (2 * R * i) / N); if (inBox(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }
    return lo <= hi ? { lo, hi } : null;
  }
  // Confronto d'ordine tra due punti: relazione di x, f e g∘f e giudizio di ogni passo.
  const rel = (a, b) => !(Number.isFinite(a) && Number.isFinite(b)) ? null : Math.abs(a - b) < 1e-9 ? "=" : a < b ? "<" : ">";
  const step = (rIn, rOut) => !rIn || !rOut || rIn === "=" ? "none" : rOut === "=" ? "flat" : rIn === rOut ? "keep" : "flip";
  function order(p0, p1) {
    const rx = rel(p0.x, p1.x), ry = rel(p0.y, p1.y), rz = rel(p0.z, p1.z);
    return { rx, ry, rz, f: step(rx, ry), g: step(ry, rz), gf: step(rx, rz) };
  }

  // Traccia: NB+1 classi di x; mark(key, x) restituisce le classi nuove, anche tra l'ultima posizione e questa (la mano è veloce).
  const NB = 320;
  function Trail() { this.visited = new Set(); this.last = {}; }
  Trail.prototype.clear = function () { this.visited = new Set(); this.last = {}; };
  Trail.prototype.xOf = (k) => -R + (2 * R * k) / NB;
  Trail.prototype.mark = function (key, x) {
    const i = Math.round(((x + R) / (2 * R)) * NB), from = this.last[key] === undefined ? i : this.last[key], out = [];
    for (let k = Math.min(from, i); k <= Math.max(from, i); k++) if (!this.visited.has(k)) { this.visited.add(k); out.push(k); }
    this.last[key] = i; return out;
  };
  Trail.prototype.forget = function (key) { delete this.last[key]; };

  const api = { R, NB, LIST, byId, inBox, snap, chain, sample, range, rel, step, order, Trail };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Compose = api;
})(typeof window !== "undefined" ? window : globalThis);
