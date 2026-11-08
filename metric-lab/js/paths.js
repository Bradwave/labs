/* Percorsi minimi: intervallo metrico, estremi, campioni casuali, scaletta, lunghezza,
   conteggio dei cammini minimi sul reticolo. Nessun DOM. */
(function (root) {
  'use strict';
  const DL = (root.DL = root.DL || {});
  const abs = Math.abs, max = Math.max, min = Math.min;

  function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Eccesso d(A,P)+d(P,B)-d(A,B): zero esattamente sull'intervallo metrico. */
  function excessField(m, A, B) {
    const D = m.dist(A.x, A.y, B.x, B.y);
    return (x, y) => m.dist(A.x, A.y, x, y) + m.dist(x, y, B.x, B.y) - D;
  }

  /* Punto casuale dell'intervallo metrico I(P,B). In una norma A->Q->B con Q in I e' sempre minimo,
     perche' ogni segmento retto e' un percorso minimo. */
  function sampleInInterval(m, P, B, rand) {
    if (m.disc) return null;
    const lerp = () => { const t = rand(); return { x: P.x + t * (B.x - P.x), y: P.y + t * (B.y - P.y) }; };
    if (m.strict) return lerp();
    const D = m.dist(P.x, P.y, B.x, B.y);
    if (D < 1e-12) return { x: P.x, y: P.y };
    if (m.id === 'l1') {
      return { x: min(P.x, B.x) + rand() * abs(B.x - P.x), y: min(P.y, B.y) + rand() * abs(B.y - P.y) };
    }
    const e = D / 2;
    const x0 = min(P.x, B.x) - e, y0 = min(P.y, B.y) - e, w = abs(B.x - P.x) + 2 * e, h = abs(B.y - P.y) + 2 * e;
    for (let n = 0; n < 600; n++) {
      const q = { x: x0 + rand() * w, y: y0 + rand() * h };
      if (abs(m.dist(P.x, P.y, q.x, q.y) + m.dist(q.x, q.y, B.x, B.y) - D) < 1e-9) return q;
    }
    return lerp();
  }

  /* Percorso minimo casuale con k punti intermedi. */
  function randomPath(m, A, B, k, seed) {
    const rand = rng(seed), pts = [{ x: A.x, y: A.y }];
    let cur = pts[0];
    for (let i = 0; i < k; i++) {
      const q = sampleInInterval(m, cur, B, rand);
      if (!q) break;
      pts.push(q); cur = q;
    }
    pts.push({ x: B.x, y: B.y });
    return pts;
  }

  /* Percorsi estremi: due L per L1, bordo della regione per L-inf, il segmento negli altri casi. */
  function extremes(m, A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, ax = abs(dx), ay = abs(dy);
    const seg = [[{ x: A.x, y: A.y }, { x: B.x, y: B.y }]];
    if (m.id === 'sncf') {
      const d = m.dist(A.x, A.y, B.x, B.y), s = Math.hypot(dx, dy);
      return abs(d - s) < 1e-9 ? seg : [[A, { x: m.H.x, y: m.H.y }, B]];
    }
    if (m.id === 'l1' && ax > 1e-12 && ay > 1e-12) {
      return [[A, { x: B.x, y: A.y }, B], [A, { x: A.x, y: B.y }, B]];
    }
    if (m.id === 'linf' && abs(ax - ay) > 1e-12) {
      const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
      let p1, p2;
      if (ax > ay) {
        p1 = { x: A.x + sx * (ax + ay) / 2, y: A.y + sy * (ax + ay) / 2 };
        p2 = { x: A.x + sx * (ax - ay) / 2, y: A.y - sy * (ax - ay) / 2 };
      } else {
        p1 = { x: A.x + sx * (ay + ax) / 2, y: A.y + sy * (ay + ax) / 2 };
        p2 = { x: A.x - sx * (ay - ax) / 2, y: A.y + sy * (ay - ax) / 2 };
      }
      return [[A, p1, B], [A, p2, B]];
    }
    return seg;
  }


  /* Espande una spezzata in un cammino "nello stile della metrica": tra due punti consecutivi
     L1 usa un tratto orizzontale e uno verticale, L-inf un tratto a 45 gradi e uno assiale.
     La lunghezza nella metrica non cambia. */
  function route(m, pts, seed) {
    if (m.id !== 'l1' && m.id !== 'linf') return pts;
    const rand = rng(seed + 977), out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, first = rand() < 0.5;
      let mid = null;
      if (m.id === 'l1') mid = first ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
      else {
        const ax = abs(dx), ay = abs(dy), d = Math.min(ax, ay), sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
        mid = first ? { x: a.x + sx * d, y: a.y + sy * d } : { x: b.x - sx * d, y: b.y - sy * d };
      }
      if (abs(mid.x - a.x) + abs(mid.y - a.y) > 1e-12 && abs(mid.x - b.x) + abs(mid.y - b.y) > 1e-12) out.push(mid);
      out.push(b);
    }
    return out;
  }


  /* Cammino L1 a gradini: k gradini di ampiezza casuale (tagli casuali in x e in y), attacco orizzontale o verticale.
     Con k = 0 il numero di gradini e' casuale (da 1 a 6). */
  function l1Walk(A, B, k, seed) {
    const rand = rng(seed + 31), n = k > 0 ? k : 1 + Math.floor(rand() * 6);
    const cut = () => { const u = []; for (let i = 0; i < n - 1; i++) u.push(rand()); u.sort((a, b) => a - b); return [0].concat(u, [1]); };
    const ux = cut(), uy = cut(), hFirst = rand() < 0.5, pts = [{ x: A.x, y: A.y }];
    const X = t => A.x + (B.x - A.x) * t, Y = t => A.y + (B.y - A.y) * t;
    for (let i = 0; i < n; i++) {
      if (hFirst) { pts.push({ x: X(ux[i + 1]), y: Y(uy[i]) }, { x: X(ux[i + 1]), y: Y(uy[i + 1]) }); }
      else { pts.push({ x: X(ux[i]), y: Y(uy[i + 1]) }, { x: X(ux[i + 1]), y: Y(uy[i + 1]) }); }
    }
    return pts.filter((q, i) => i === 0 || abs(q.x - pts[i - 1].x) + abs(q.y - pts[i - 1].y) > 1e-12);
  }

  /* Un cammino minimo campionato, nello stile della metrica. k: gradini/punti intermedi (0 = casuale). */
  function sample(m, A, B, k, seed) {
    if (m.id === 'l1') return l1Walk(A, B, k, seed);
    return route(m, randomPath(m, A, B, k > 0 ? k : 2 + Math.floor(rng(seed + 5)() * 4), seed), seed);
  }

  /* Scaletta di n gradini da A a B (percorso minimo in L1). */
  function staircase(A, B, n) {
    const dx = B.x - A.x, dy = B.y - A.y, pts = [{ x: A.x, y: A.y }];
    for (let i = 1; i <= n; i++) {
      pts.push({ x: A.x + dx * i / n, y: A.y + dy * (i - 1) / n });
      pts.push({ x: A.x + dx * i / n, y: A.y + dy * i / n });
    }
    return pts;
  }

  function length(m, pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += m.dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    return s;
  }

  /* Numero di cammini minimi sul reticolo (dx, dy interi, in unita' di passo). L1: binomiale;
     L-inf: sequenze di n passi in {-1,0,1} con somma pari al lato minore. Altrimenti null. */
  function latticeCount(id, dx, dy) {
    const ax = abs(Math.round(dx)), ay = abs(Math.round(dy));
    if (id === 'l1') {
      if (ax + ay > 600) return null;
      const k = min(ax, ay), n = ax + ay;
      let r = 1n;
      for (let i = 1; i <= k; i++) r = r * BigInt(n - k + i) / BigInt(i);
      return r;
    }
    if (id === 'linf') {
      const n = max(ax, ay), mm = min(ax, ay);
      if (n > 200) return null;
      let cur = new Array(2 * n + 3).fill(0n);
      const off = n + 1;
      cur[off] = 1n;
      for (let s = 0; s < n; s++) {
        const nxt = new Array(cur.length).fill(0n);
        for (let i = 1; i < cur.length - 1; i++) if (cur[i] !== 0n) { nxt[i - 1] += cur[i]; nxt[i] += cur[i]; nxt[i + 1] += cur[i]; }
        cur = nxt;
      }
      return cur[off + mm];
    }
    return null;
  }

  DL.paths = { rng, excessField, sampleInInterval, randomPath, route, l1Walk, sample, extremes, staircase, length, latticeCount };
})(typeof window !== 'undefined' ? window : globalThis);
