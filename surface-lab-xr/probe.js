/* probe.js — matematica della sonda: proiezione di un punto sulla superficie F=0, gradiente numerico e formattazione.
   Puro (nessun THREE, nessun DOM). fn(x,y,z) = F nel sistema della superficie. */
(function (root) {
  'use strict';

  // gradiente numerico (differenze centrali); h relativo alla scala del punto
  function gradient(fn, p, h) {
    h = h || 1e-4;
    return [
      (fn(p[0] + h, p[1], p[2]) - fn(p[0] - h, p[1], p[2])) / (2 * h),
      (fn(p[0], p[1] + h, p[2]) - fn(p[0], p[1] - h, p[2])) / (2 * h),
      (fn(p[0], p[1], p[2] + h) - fn(p[0], p[1], p[2] - h)) / (2 * h)
    ];
  }
  // porta p sulla superficie F=0 con passi di Newton lungo il gradiente. Restituisce { p, F, g, ok }.
  function project(fn, p0, iters) {
    let p = p0.slice(), ok = false, g = null, F = fn(p[0], p[1], p[2]);
    for (let k = 0; k < (iters || 4); k++) {
      g = gradient(fn, p); const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
      if (!(g2 > 1e-12) || !isFinite(F)) break;
      if (Math.abs(F) < 1e-9) { ok = true; break; }
      const t = F / g2; p = [p[0] - t * g[0], p[1] - t * g[1], p[2] - t * g[2]]; F = fn(p[0], p[1], p[2]);
    }
    g = gradient(fn, p);
    if (Math.abs(F) < 1e-6 && isFinite(F)) ok = true;
    return { p: p, F: F, g: g, ok: ok };
  }
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : null; };
  const f = v => (Math.abs(v) < 0.005 ? 0 : Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace('-', '−');
  const fmtVec = v => '(' + f(v[0]) + '; ' + f(v[1]) + '; ' + f(v[2]) + ')';

  const api = { gradient: gradient, project: project, norm: norm, fmtVec: fmtVec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProbeMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
