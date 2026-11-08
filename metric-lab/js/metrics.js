/* Metriche: distanza tra punti e distanza punto-retta. Nessuna dipendenza dal DOM. */
(function (root) {
  'use strict';
  const DL = (root.DL = root.DL || {});
  const EPS = 1e-9;
  const abs = Math.abs, max = Math.max, min = Math.min, pow = Math.pow, sqrt = Math.sqrt;

  const d1 = (ax, ay, bx, by) => abs(ax - bx) + abs(ay - by);
  const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return sqrt(dx * dx + dy * dy); };
  const dinf = (ax, ay, bx, by) => max(abs(ax - bx), abs(ay - by));
  const dd = (ax, ay, bx, by) => (abs(ax - bx) < EPS && abs(ay - by) < EPS ? 0 : 1);
  const dp = p => (ax, ay, bx, by) => pow(pow(abs(ax - bx), p) + pow(abs(ay - by), p), 1 / p);

  /* Distanza minima da un punto a una retta {x0,y0,vx,vy}: forma chiusa per L1, L2, L-inf,
     minimizzazione convessa (sezione aurea) per Lp. */
  function distToLine(m, px, py, L) {
    const vx = L.vx, vy = L.vy, a = px - L.x0, b = py - L.y0;
    const vn2 = vx * vx + vy * vy;
    if (vn2 < EPS) return m.dist(px, py, L.x0, L.y0);
    const f = t => m.dist(px, py, L.x0 + t * vx, L.y0 + t * vy);
    const cross = abs(a * vy - b * vx);
    switch (m.id) {
      case 'l2': return cross / sqrt(vn2);
      case 'disc': return cross / sqrt(vn2) < EPS ? 0 : 1;
      case 'l1': {
        let best = Infinity;
        if (abs(vx) > EPS) best = min(best, f(a / vx));
        if (abs(vy) > EPS) best = min(best, f(b / vy));
        return best;
      }
      case 'linf': {
        let best = Infinity;
        if (abs(vx) > EPS) best = min(best, f(a / vx));
        if (abs(vy) > EPS) best = min(best, f(b / vy));
        if (abs(vx - vy) > EPS) best = min(best, f((a - b) / (vx - vy)));
        if (abs(vx + vy) > EPS) best = min(best, f((a + b) / (vx + vy)));
        return best;
      }
      case 'sncf': {                       // forma chiusa: passando per H, oppure lungo la retta PH fino a incontrare L
        const H = m.H, hx = H.x - px, hy = H.y - py, nh = sqrt(hx * hx + hy * hy);
        const eu = cross / sqrt(vn2);                                   // distanza euclidea di P da L
        if (nh < EPS) return eu;
        const dHL = abs((H.x - L.x0) * vy - (H.y - L.y0) * vx) / sqrt(vn2);
        let best = nh + dHL;
        const den = hx * vy - hy * vx;                                  // retta PH incontra L?
        if (abs(den) > EPS) {
          const s = ((L.x0 - px) * vy - (L.y0 - py) * vx) / den;       // punto P + s (H - P)
          best = min(best, abs(s) * nh);
        }
        return best;
      }
      default: {
        const ts = (a * vx + b * vy) / vn2;
        const W = 4 * (cross / sqrt(vn2) + 1e-6) / sqrt(vn2);
        let lo = ts - W, hi = ts + W;
        const g = 0.6180339887498949;
        let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = f(x1), f2 = f(x2);
        for (let i = 0; i < 42; i++) {
          if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = f(x1); }
          else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = f(x2); }
        }
        return min(f1, f2);
      }
    }
  }

  /* Metrica della ferrovia francese: A e B si raggiungono in linea retta se sono allineati con il nodo H,
     altrimenti si passa per H. */
  const dsncf = H => (ax, ay, bx, by) => {
    const ux = ax - H.x, uy = ay - H.y, vx = bx - H.x, vy = by - H.y;
    const nu = sqrt(ux * ux + uy * uy), nv = sqrt(vx * vx + vy * vy);
    if (abs(ux * vy - uy * vx) <= 1e-9 * (1 + nu * nv)) return d2(ax, ay, bx, by);
    return nu + nv;
  };
  /* Norma poligonale: palla = poligono regolare con n lati (n pari), norma(v) = max_k v.u_k. */
  const dpoly = n => {
    const us = []; for (let k = 0; k < n; k++) us.push([Math.cos(2 * Math.PI * k / n), Math.sin(2 * Math.PI * k / n)]);
    return (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; let r = 0; for (const u of us) r = max(r, dx * u[0] + dy * u[1]); return r; };
  };

  /* make(id, p, opts): id in l1, l2, linf, lp, disc, sncf, poly; p vale solo per lp; opts {n, H} per poly e sncf. */
  function make(id, p, opts) {
    const pp = p == null ? 3 : p, o = opts || {}, H = o.H || { x: 0, y: 0 };
    let n = Math.round(o.n || 6); if (n % 2) n++; n = Math.min(12, Math.max(4, n));
    const dist = { l1: d1, l2: d2, linf: dinf, lp: dp(pp), disc: dd, sncf: dsncf(H), poly: dpoly(n) }[id];
    const m = {
      id, p: pp, n, H, dist,
      strict: id === 'l2' || (id === 'lp' && pp > 1),   // palla strettamente convessa: percorso minimo unico
      norm: id !== 'disc' && id !== 'sncf',
      disc: id === 'disc'
    };
    m.toLine = (px, py, L) => distToLine(m, px, py, L);
    return m;
  }

  DL.metric = make;
  DL.METRIC_IDS = ['l1', 'l2', 'linf', 'lp', 'disc', 'sncf', 'poly'];
  DL.EPS = EPS;
})(typeof window !== 'undefined' ? window : globalThis);
