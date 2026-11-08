/* thumbs.js — anteprime delle superfici: mesh a bassa risoluzione dalla libreria e disegno su canvas 2D (proiezione ortografica,
   algoritmo del pittore, ombreggiatura piatta). Nessun THREE, nessun WebGL: funziona in un canvas qualunque (anche su una texture VR)
   ed è testabile in Node con un contesto finto. */
(function (root) {
  'use strict';

  // mesh a bassa risoluzione di un preset: { positions, normals, triangles } (triangoli non indicizzati, 9 numeri ciascuno)
  function meshFor(Core, preset, N) {
    N = N || (preset.kind === 'param' ? 28 : 22);
    if (preset.kind === 'param') {
      const c = Core.compileParam(preset.fx, preset.fy, preset.fz, Core.defaultParams ? Core.defaultParams(preset) : {});
      return Core.polygonizeParam(c.fn, Core.evalNumber(preset.u0), Core.evalNumber(preset.u1), Core.evalNumber(preset.v0), Core.evalNumber(preset.v1), N, N);
    }
    return Core.polygonize(Core.compile(preset.eq, Core.defaultParams ? Core.defaultParams(preset) : {}).fn, { R: preset.R, N: N });
  }

  const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  // Disegna la mesh nel rettangolo (0,0,w,h) di ctx. opts: front/back (0xRRGGBB), yaw, pitch (radianti), margin (0..1), transparent
  function render(ctx, w, h, mesh, opts) {
    opts = opts || {};
    const yaw = opts.yaw === undefined ? 0.7 : opts.yaw, pitch = opts.pitch === undefined ? 0.8 : opts.pitch;
    const cF = hex(opts.front === undefined ? 0x0072b2 : opts.front), cB = hex(opts.back === undefined ? 0xf2efe6 : opts.back);
    if (!opts.transparent) { ctx.fillStyle = opts.bg || 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, w, h); if (opts.bg) ctx.fillRect(0, 0, w, h); }
    const P = mesh.positions, Nn = mesh.normals, nt = Math.floor(P.length / 9);
    if (!nt) return 0;
    // centro e raggio della sfera che racchiude la mesh
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { const v = P[i + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
    const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    let rad = 0; for (let i = 0; i < P.length; i += 3) rad = Math.max(rad, Math.hypot(P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2]));
    rad = rad || 1;
    const sc = (1 - (opts.margin === undefined ? 0.08 : opts.margin)) * Math.min(w, h) / 2 / rad;
    const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // vista: ruota di yaw attorno a z (alto), poi inclina di pitch; schermo = (x', z·cp + y'·sp), profondità verso l'osservatore = z·sp − y'·cp
    const tf = (x, y, z, out, o) => { const xr = cy_ * x - sy_ * y, yr = sy_ * x + cy_ * y; out[o] = xr; out[o + 1] = z * cp + yr * sp; out[o + 2] = z * sp - yr * cp; };
    const V = new Float32Array(nt * 9), Nz = new Float32Array(nt), D = new Float32Array(nt), idx = new Array(nt);
    for (let t = 0; t < nt; t++) {
      for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; tf(P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2], V, i); }
      D[t] = (V[t * 9 + 2] + V[t * 9 + 5] + V[t * 9 + 8]) / 3;
      const i = t * 9, o = [0, 0, 0];
      tf(Nn[i], Nn[i + 1], Nn[i + 2], o, 0);   // normale del primo vertice nel sistema vista
      const l = Math.hypot(o[0], o[1], o[2]) || 1; Nz[t] = o[2] / l;
      idx[t] = t;
    }
    // luce da in alto a sinistra, davanti
    const L = [-0.4, 0.6, 0.7], ll = Math.hypot(L[0], L[1], L[2]);
    idx.sort((a, b) => D[a] - D[b]);   // dal più lontano al più vicino
    let drawn = 0;
    for (let q = 0; q < nt; q++) {
      const t = idx[q], i = t * 9;
      const n = [0, 0, 0]; tf(Nn[i], Nn[i + 1], Nn[i + 2], n, 0);
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      const lam = Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * ll));
      const k = 0.4 + 0.6 * lam, col = Nz[t] >= 0 ? cF : cB;
      ctx.fillStyle = 'rgb(' + Math.round(col[0] * k) + ',' + Math.round(col[1] * k) + ',' + Math.round(col[2] * k) + ')';
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(w / 2 + V[i] * sc, h / 2 - V[i + 1] * sc);
      ctx.lineTo(w / 2 + V[i + 3] * sc, h / 2 - V[i + 4] * sc);
      ctx.lineTo(w / 2 + V[i + 6] * sc, h / 2 - V[i + 7] * sc);
      ctx.closePath(); ctx.fill(); ctx.stroke(); drawn++;
    }
    return drawn;
  }

  const api = { meshFor: meshFor, render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Thumbs = api;
})(typeof window !== 'undefined' ? window : globalThis);
