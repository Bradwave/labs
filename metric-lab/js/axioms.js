/* Verifica degli assiomi di distanza su campioni, con un controesempio quando falliscono. Nessun DOM. */
(function (root) {
  'use strict';
  const DL = (root.DL = root.DL || {});
  const abs = Math.abs;

  /* Funzioni "di prova" che NON sono distanze: ognuna viola almeno un assioma. */
  const BROKEN = {
    sq: (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by),
    lphalf: (ax, ay, bx, by) => Math.pow(Math.sqrt(abs(ax - bx)) + Math.sqrt(abs(ay - by)), 2),
    asym: (ax, ay, bx, by) => abs(ax - bx) + (by > ay ? 2 : 1) * abs(ay - by),
    xonly: (ax, ay, bx, by) => abs(ax - bx)
  };
  DL.BROKEN_IDS = Object.keys(BROKEN);

  /* check(dist, seed): campioni su un reticolo di passo 0,5 in [-6, 6]. */
  function check(dist, seed) {
    const rand = DL.paths.rng(seed || 1), pt = () => ({ x: Math.round((rand() - 0.5) * 24) / 2, y: Math.round((rand() - 0.5) * 24) / 2 });
    const res = { nonneg: { ok: true }, ident: { ok: true }, sym: { ok: true }, tri: { ok: true, worst: 0 } };
    const TOL = 1e-9;
    for (let i = 0; i < 6000; i++) {
      const A = pt(), B = i % 3 === 0 ? { x: A.x + (i % 2 ? 1 : 0), y: A.y + (i % 2 ? 0 : 1) } : pt(), C = pt();
      const ab = dist(A.x, A.y, B.x, B.y), ba = dist(B.x, B.y, A.x, A.y), aa = dist(A.x, A.y, A.x, A.y);
      const bc = dist(B.x, B.y, C.x, C.y), ac = dist(A.x, A.y, C.x, C.y);
      if (res.nonneg.ok && (ab < -TOL || !isFinite(ab))) res.nonneg = { ok: false, ex: { A, B, ab } };
      if (res.ident.ok) {
        if (abs(aa) > TOL) res.ident = { ok: false, ex: { A, B: A, ab: aa, same: true } };
        else if (ab < TOL && (A.x !== B.x || A.y !== B.y)) res.ident = { ok: false, ex: { A, B, ab } };
      }
      if (res.sym.ok && abs(ab - ba) > TOL) res.sym = { ok: false, ex: { A, B, ab, ba } };
      const v = ac - ab - bc;
      if (v > TOL && v > res.tri.worst) res.tri = { ok: false, worst: v, ex: { A, B, C, ab, bc, ac } };
    }
    return res;
  }
  DL.axioms = { check, BROKEN };
})(typeof window !== 'undefined' ? window : globalThis);
