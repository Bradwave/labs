// Parameter Lab XR · engine.js
// Matematica pura (nessun DOM, nessun THREE; gira in Node): curve di livello F(x,y;k)=0 di una fetta, superficie nello spazio
// (x, y, k), regioni, intersezioni di due curve, scansione lungo k, collegamento dei punti in curve 3D, "discussione" (quanti
// punti di intersezione per ogni k, valori critici raffinati per bisezione e per Newton sulla tangenza).
// Le funzioni ricevono F(x, y, k, a) già compilate da expr.js. Finestra: x, y ∈ [−W, W].
// UMD: in Node `require`, nel browser globale `Engine`.
(function (root) {
  "use strict";

  const fin = (v) => v === v && v !== Infinity && v !== -Infinity;

  // ---------- curva di livello F = 0 su un piano (marching squares) ----------
  // Uno spigolo con cambio di segno è un vero zero solo se |F| nel punto trovato non supera il minore degli estremi:
  // altrimenti è un polo (tan, 1/x) e il segmento verticale che lo unirebbe viene scartato.
  const CASES = [
    [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]],
    [[2, 3]], [[0, 2]], null, [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
  ];
  function contour(F, k, a, W, N) {
    const n1 = N + 1, h = (2 * W) / N, v = new Float64Array(n1 * n1), gc = (i) => (W * (2 * i - N)) / N; // gc(N/2) è esattamente 0
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) v[j * n1 + i] = F(gc(i), gc(j), k, a);
    const seg = [], cell = [], P = [0, 0, 0, 0, 0, 0, 0, 0], good = [false, false, false, false];
    function edge(e, x0, y0, f0, f1, f2, f3, x1, y1) {
      // e: 0 basso (f0→f1), 1 destra (f1→f2), 2 alto (f3→f2), 3 sinistra (f0→f3)
      let ax, ay, bx, by, fa, fb;
      if (e === 0) { ax = x0; ay = y0; bx = x1; by = y0; fa = f0; fb = f1; }
      else if (e === 1) { ax = x1; ay = y0; bx = x1; by = y1; fa = f1; fb = f2; }
      else if (e === 2) { ax = x0; ay = y1; bx = x1; by = y1; fa = f3; fb = f2; }
      else { ax = x0; ay = y0; bx = x0; by = y1; fa = f0; fb = f3; }
      const t = fa / (fa - fb), x = ax + t * (bx - ax), y = ay + t * (by - ay);
      const fm = F(x, y, k, a);
      good[e] = Math.abs(fm) <= Math.min(Math.abs(fa), Math.abs(fb)) + 1e-9;
      P[2 * e] = x; P[2 * e + 1] = y;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const f0 = v[j * n1 + i], f1 = v[j * n1 + i + 1], f2 = v[(j + 1) * n1 + i + 1], f3 = v[(j + 1) * n1 + i];
      if (!(fin(f0) && fin(f1) && fin(f2) && fin(f3))) continue;
      const idx = (f0 > 0 ? 1 : 0) | (f1 > 0 ? 2 : 0) | (f2 > 0 ? 4 : 0) | (f3 > 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const x0 = gc(i), y0 = gc(j), x1 = gc(i + 1), y1 = gc(j + 1);
      let pairs = CASES[idx];
      if (!pairs) { // sella: il centro decide come si collegano gli spigoli
        const c = (f0 + f1 + f2 + f3) / 4 > 0;
        pairs = idx === 5 ? (c ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]) : (c ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]);
      }
      for (const pr of pairs) {
        edge(pr[0], x0, y0, f0, f1, f2, f3, x1, y1); edge(pr[1], x0, y0, f0, f1, f2, f3, x1, y1);
        if (good[pr[0]] && good[pr[1]]) { seg.push(P[2 * pr[0]], P[2 * pr[0] + 1], P[2 * pr[1]], P[2 * pr[1] + 1]); cell.push(j * N + i); }
      }
    }
    return { seg: new Float32Array(seg), cell: new Int32Array(cell), N, W, n: cell.length };
  }

  // Parte di una curva (segmenti) che soddisfa una disequazione: punto medio con rel.inside(F) vero.
  function filterInside(seg, rel, k, a) {
    const out = [];
    for (let i = 0; i < seg.length; i += 4) {
      const mx = (seg[i] + seg[i + 2]) / 2, my = (seg[i + 1] + seg[i + 3]) / 2;
      if (rel.inside(rel.F(mx, my, k, a))) out.push(seg[i], seg[i + 1], seg[i + 2], seg[i + 3]);
    }
    return new Float32Array(out);
  }

  // ---------- regioni: maschera M×M (1 = dentro) al centro delle celle ----------
  function mask(rel, k, a, W, M, out) {
    const m = out && out.length === M * M ? out : new Uint8Array(M * M), h = (2 * W) / M;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const v = rel.F(-W + (i + 0.5) * h, -W + (j + 0.5) * h, k, a);
      m[j * M + i] = fin(v) && rel.inside(v) ? 1 : 0;
    }
    return m;
  }

  // ---------- superficie F(x,y,k)=0 nello spazio (marching tetrahedra, triangolazione di Kuhn) ----------
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const TETS = PERMS.map((pm) => { const v = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [1, 1, 1]]; v[1][pm[0]] = 1; v[2][pm[0]] = 1; v[2][pm[1]] = 1; return v; });
  // Restituisce { pos: Float32Array [x,y,k]·3 per triangolo, nrm: normali per vertice, n: numero di triangoli }.
  function surface(F, a, W, k0, k1, N, Nz) {
    const hx = (2 * W) / N, hz = (k1 - k0) / Nz, n1 = N + 1, nz1 = Nz + 1, gc = (i) => (W * (2 * i - N)) / N;
    const f = new Float64Array(n1 * n1 * nz1);
    for (let l = 0; l < nz1; l++) for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) f[i + n1 * (j + n1 * l)] = F(gc(i), gc(j), k0 + l * hz, a);
    const pos = [], mf = []; // mf: min(|fa|,|fb|) per vertice, per scartare i poli
    const I = [0, 0, 0, 0], O = [0, 0, 0, 0], px = [0, 0, 0, 0], py = [0, 0, 0, 0], pz = [0, 0, 0, 0], fv = [0, 0, 0, 0];
    const emit = (p, q) => {
      const t = fv[p] / (fv[p] - fv[q]);
      pos.push(px[p] + t * (px[q] - px[p]), py[p] + t * (py[q] - py[p]), pz[p] + t * (pz[q] - pz[p]));
      mf.push(Math.min(Math.abs(fv[p]), Math.abs(fv[q])));
    };
    for (let l = 0; l < Nz; l++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let mn = Infinity, mx = -Infinity, bad = false;
      for (let c = 0; c < 8; c++) {
        const v = f[(i + (c & 1)) + n1 * ((j + ((c >> 1) & 1)) + n1 * (l + ((c >> 2) & 1)))];
        if (!fin(v)) { bad = true; break; }
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      if (bad || mx <= 0 || mn > 0) continue;
      for (let t = 0; t < 6; t++) {
        let ni = 0, no = 0;
        const tv = TETS[t];
        for (let q = 0; q < 4; q++) {
          const ii = i + tv[q][0], jj = j + tv[q][1], ll = l + tv[q][2];
          fv[q] = f[ii + n1 * (jj + n1 * ll)];
          px[q] = gc(ii); py[q] = gc(jj); pz[q] = k0 + ll * hz;
          if (fv[q] <= 0) I[ni++] = q; else O[no++] = q;
        }
        if (ni === 0 || no === 0) continue;
        if (ni === 1) { emit(I[0], O[0]); emit(I[0], O[1]); emit(I[0], O[2]); }
        else if (ni === 3) { emit(I[0], O[0]); emit(I[1], O[0]); emit(I[2], O[0]); }
        else { // quadrilatero → due triangoli
          const e0 = pos.length;
          emit(I[0], O[0]); emit(I[0], O[1]); emit(I[1], O[1]); emit(I[1], O[0]);
          const A = pos.slice(e0, e0 + 3), C = pos.slice(e0 + 6, e0 + 9), D = pos.slice(e0 + 9, e0 + 12), mA = mf[mf.length - 4], mC = mf[mf.length - 2], mD = mf[mf.length - 1];
          pos.length = e0 + 6; mf.length -= 2;
          pos.push(C[0], C[1], C[2], A[0], A[1], A[2], C[0], C[1], C[2], D[0], D[1], D[2]);
          mf.push(mC, mA, mC, mD);
        }
      }
    }
    // scarta i triangoli che attraversano un polo: |F| nel vertice deve essere piccolo rispetto agli estremi
    const nv = pos.length / 3, okv = new Uint8Array(nv);
    for (let q = 0; q < nv; q++) okv[q] = Math.abs(F(pos[3 * q], pos[3 * q + 1], pos[3 * q + 2], a)) <= mf[q] + 1e-9 ? 1 : 0;
    const P = [];
    for (let q = 0; q < nv; q += 3) if (okv[q] && okv[q + 1] && okv[q + 2]) for (let r = 0; r < 9; r++) P.push(pos[3 * q + r]);
    const n = P.length / 9, pa = new Float32Array(P), nrm = new Float32Array(P.length), e = hx * 0.5;
    for (let q = 0; q < P.length; q += 3) {
      const x = pa[q], y = pa[q + 1], z = pa[q + 2];
      let gx = F(x + e, y, z, a) - F(x - e, y, z, a), gy = F(x, y + e, z, a) - F(x, y - e, z, a), gz = F(x, y, z + e, a) - F(x, y, z - e, a);
      const L = Math.hypot(gx, gy, gz);
      if (L > 0 && fin(L)) { nrm[q] = gx / L; nrm[q + 1] = gy / L; nrm[q + 2] = gz / L; }
    }
    return { pos: pa, nrm, n };
  }

  // ---------- intersezione di due curve in una fetta ----------
  function segHit(a, ia, b, ib) {
    const rx = a[ia + 2] - a[ia], ry = a[ia + 3] - a[ia + 1], sx = b[ib + 2] - b[ib], sy = b[ib + 3] - b[ib + 1];
    const d = rx * sy - ry * sx;
    if (Math.abs(d) < 1e-12 * (Math.hypot(rx, ry) * Math.hypot(sx, sy) + 1e-30)) return null;
    const qx = b[ib] - a[ia], qy = b[ib + 1] - a[ia + 1];
    const t = (qx * sy - qy * sx) / d, u = (qx * ry - qy * rx) / d, e = 1e-6;
    if (t < -e || t > 1 + e || u < -e || u > 1 + e) return null;
    return [a[ia] + t * rx, a[ia + 1] + t * ry];
  }
  function polish(FA, FB, k, a, W, x, y, lim) {
    const x0 = x, y0 = y, e = 1e-5 * Math.max(1, W);
    for (let it = 0; it < 12; it++) {
      const fa = FA(x, y, k, a), fb = FB(x, y, k, a);
      if (!fin(fa) || !fin(fb)) return [x0, y0];
      const ax = (FA(x + e, y, k, a) - FA(x - e, y, k, a)) / (2 * e), ay = (FA(x, y + e, k, a) - FA(x, y - e, k, a)) / (2 * e);
      const bx = (FB(x + e, y, k, a) - FB(x - e, y, k, a)) / (2 * e), by = (FB(x, y + e, k, a) - FB(x, y - e, k, a)) / (2 * e);
      const det = ax * by - ay * bx;
      if (!fin(det) || Math.abs(det) < 1e-12 * (Math.abs(ax) + Math.abs(ay) + 1e-30) * (Math.abs(bx) + Math.abs(by) + 1e-30)) break;
      const dx = (fa * by - fb * ay) / det, dy = (ax * fb - bx * fa) / det;
      x -= dx; y -= dy;
      if (Math.abs(dx) + Math.abs(dy) < 1e-12 * W) break;
    }
    if (!fin(x) || !fin(y) || Math.hypot(x - x0, y - y0) > lim || Math.abs(x) > W || Math.abs(y) > W) return [x0, y0];
    return [x, y];
  }
  // Punti [x, y] dove le curve FA = 0 e FB = 0 si incontrano alla fetta k (candidati dai segmenti, poi Newton).
  function intersections(FA, FB, k, a, W, N, cA, cB) {
    cA = cA || contour(FA, k, a, W, N); cB = cB || contour(FB, k, a, W, N);
    const head = new Int32Array(N * N).fill(-1), next = new Int32Array(cA.n);
    for (let s = 0; s < cA.n; s++) { next[s] = head[cA.cell[s]]; head[cA.cell[s]] = s; }
    const h = (2 * W) / N, cand = [];
    for (let s = 0; s < cB.n; s++) {
      const ci = cB.cell[s], cx = ci % N, cy = (ci / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Y = cy + dy;
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        for (let q = head[Y * N + X]; q >= 0; q = next[q]) {
          const p = segHit(cA.seg, 4 * q, cB.seg, 4 * s);
          if (p) cand.push(polish(FA, FB, k, a, W, p[0], p[1], 2 * h));
          if (cand.length > 200) break;
        }
      }
    }
    const pts = [];
    for (const p of cand) if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.25 * h)) pts.push(p);
    return pts.length > 24 ? pts.slice(0, 24) : pts;
  }

  // ---------- scansione lungo k ----------
  // opt: nk (intervalli), N (celle), stride (ogni quante fette si tengono i contorni per i "strati" disegnati)
  function scan(FA, FB, k0, k1, a, W, opt) {
    opt = opt || {};
    const nk = opt.nk || 160, N = opt.N || 80, stride = opt.stride || 8;
    const ks = [], pts = [], counts = [], layers = [];
    for (let j = 0; j <= nk; j++) {
      const k = k0 + ((k1 - k0) * j) / nk;
      ks.push(k);
      const keep = j % stride === 0;
      let cA = null, cB = null;
      if (FA && (keep || FB)) cA = contour(FA, k, a, W, N);
      if (FB && (keep || FA)) cB = contour(FB, k, a, W, N);
      if (keep) layers.push({ k, j, a: cA ? cA.seg : null, b: cB ? cB.seg : null });
      const p = FA && FB ? intersections(FA, FB, k, a, W, N, cA, cB) : [];
      pts.push(p); counts.push(p.length);
    }
    return { ks, pts, counts, layers, N, W, nk, k0, k1, a, paired: !!(FA && FB) };
  }

  // Collega i punti di fette successive in segmenti 3D [x,y,k, x,y,k]; i punti che nascono o muoiono in coppia
  // (tangenza) si chiudono tra loro, così la curva ha la sua punta.
  function link(sc) {
    const out = [], thr = 0.4 * sc.W, thrCap = 0.6 * sc.W;
    const seg = (p, kp, q, kq) => out.push(p[0], p[1], kp, q[0], q[1], kq);
    const capPairs = (idxs, pts, k) => {
      const left = idxs.slice();
      while (left.length > 1) {
        const i = left.shift();
        let best = -1, bd = thrCap;
        for (let m = 0; m < left.length; m++) { const d = Math.hypot(pts[i][0] - pts[left[m]][0], pts[i][1] - pts[left[m]][1]); if (d < bd) { bd = d; best = m; } }
        if (best >= 0) { seg(pts[i], k, pts[left[best]], k); left.splice(best, 1); }
      }
    };
    for (let j = 0; j < sc.nk; j++) {
      const A = sc.pts[j], B = sc.pts[j + 1], pairs = [];
      A.forEach((p, i) => B.forEach((q, m) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < thr) pairs.push([d, i, m]); }));
      pairs.sort((u, v) => u[0] - v[0]);
      const usedA = new Set(), usedB = new Set();
      for (const [, i, m] of pairs) if (!usedA.has(i) && !usedB.has(m)) { usedA.add(i); usedB.add(m); seg(A[i], sc.ks[j], B[m], sc.ks[j + 1]); }
      capPairs(A.map((_, i) => i).filter((i) => !usedA.has(i)), A, sc.ks[j]);
      capPairs(B.map((_, i) => i).filter((i) => !usedB.has(i)), B, sc.ks[j + 1]);
    }
    return new Float32Array(out);
  }

  // ---------- discussione: valori critici e intervalli ----------
  function solve3(M, b) { // risolve M·u = b (3×3) per eliminazione
    const A = [[M[0][0], M[0][1], M[0][2], b[0]], [M[1][0], M[1][1], M[1][2], b[1]], [M[2][0], M[2][1], M[2][2], b[2]]];
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-14) return null;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = c + 1; r < 3; r++) { const f = A[r][c] / A[c][c]; for (let q = c; q < 4; q++) A[r][q] -= f * A[c][q]; }
    }
    const u = [0, 0, 0];
    for (let r = 2; r >= 0; r--) { let s = A[r][3]; for (let q = r + 1; q < 3; q++) s -= A[r][q] * u[q]; u[r] = s / A[r][r]; }
    return u;
  }
  // Tangenza: (x, y, k) con FA = FB = 0 e gradienti paralleli (det = 0). Newton da (x, y, k) iniziali; null se non converge.
  function tangency(FA, FB, a, W, x, y, k) {
    const e = 1e-4 * Math.max(1, W), G = (u) => {
      const [X, Y, K] = u;
      const ax = (FA(X + e, Y, K, a) - FA(X - e, Y, K, a)) / (2 * e), ay = (FA(X, Y + e, K, a) - FA(X, Y - e, K, a)) / (2 * e);
      const bx = (FB(X + e, Y, K, a) - FB(X - e, Y, K, a)) / (2 * e), by = (FB(X, Y + e, K, a) - FB(X, Y - e, K, a)) / (2 * e);
      return [FA(X, Y, K, a), FB(X, Y, K, a), ax * by - ay * bx];
    };
    let u = [x, y, k];
    const e2 = 1e-3 * Math.max(1, W);
    for (let it = 0; it < 40; it++) {
      const g = G(u);
      if (!g.every(fin)) return null;
      const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let c = 0; c < 3; c++) {
        const up = u.slice(), um = u.slice(); up[c] += e2; um[c] -= e2;
        const gp = G(up), gm = G(um);
        for (let r = 0; r < 3; r++) J[r][c] = (gp[r] - gm[r]) / (2 * e2);
      }
      const d = solve3(J, g);
      if (!d || !d.every(fin)) return null;
      const L = Math.hypot(d[0], d[1], d[2]), sc = L > 0.5 * W ? (0.5 * W) / L : 1;
      u = [u[0] - sc * d[0], u[1] - sc * d[1], u[2] - sc * d[2]];
      if (L < 1e-9 * W) break;
    }
    const g = G(u), scale = 1 + Math.abs(u[0]) + Math.abs(u[1]);
    if (!g.every(fin) || Math.abs(g[0]) > 1e-6 * scale || Math.abs(g[1]) > 1e-6 * scale || Math.abs(g[2]) > 1e-3 * scale) return null;
    if (Math.abs(u[0]) > W || Math.abs(u[1]) > W) return null;
    return { x: u[0], y: u[1], k: u[2] };
  }

  // Intervalli [k0,k1] con n punti, e valori critici (dove n cambia). Solo per coppie di relazioni.
  function discuss(FA, FB, sc) {
    const a = sc.a, W = sc.W, N = sc.N, cnt = (k) => intersections(FA, FB, k, a, W, N).length;
    const crit = [];
    for (let j = 0; j < sc.nk && crit.length < 24; j++) {
      const n0 = sc.counts[j], n1 = sc.counts[j + 1];
      if (n0 === n1) continue;
      let lo = sc.ks[j], hi = sc.ks[j + 1];
      for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (cnt(m) === n0) lo = m; else hi = m; }
      let k = (lo + hi) / 2, tang = null;
      const richer = n0 >= n1 ? sc.pts[j] : sc.pts[j + 1];
      if (richer.length) {
        // punto di partenza: il punto medio della coppia più vicina (due punti che si fondono), o l'unico punto
        let sx = richer[0][0], sy = richer[0][1], bd = Infinity;
        for (let i = 0; i < richer.length; i++) for (let m = i + 1; m < richer.length; m++) {
          const d = Math.hypot(richer[i][0] - richer[m][0], richer[i][1] - richer[m][1]);
          if (d < bd) { bd = d; sx = (richer[i][0] + richer[m][0]) / 2; sy = (richer[i][1] + richer[m][1]) / 2; }
        }
        const step = sc.ks[j + 1] - sc.ks[j], T = tangency(FA, FB, a, W, sx, sy, k);
        if (T && T.k > sc.ks[j] - step && T.k < sc.ks[j + 1] + step) tang = T;
      }
      if (tang) k = tang.k;
      crit.push({ k, before: n0, after: n1, at: tang ? Math.max(n0, n1) - 1 : null, tangent: !!tang, x: tang ? tang.x : null, y: tang ? tang.y : null });
    }
    // fonde critici troppo vicini (la stessa tangenza trovata in due fette)
    const dk = (sc.k1 - sc.k0) / sc.nk, merged = [];
    for (const c of crit) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(c.k - last.k) < 1.5 * dk) {
        if (c.before === last.before && c.after === last.after) continue; // la stessa tangenza vista in due fette
        if (c.before === last.after) { // la fetta caduta sul valore critico ha il conteggio intermedio (es. 2 → 1 → 0)
          const t = last.tangent ? last : c.tangent ? c : null;
          merged[merged.length - 1] = { k: t ? t.k : (last.k + c.k) / 2, before: last.before, after: c.after, at: last.after, tangent: !!t, x: t ? t.x : null, y: t ? t.y : null };
          continue;
        }
      }
      merged.push(c);
    }
    // intervalli: da un critico al successivo, con il conteggio della fetta di mezzo
    const edges = [sc.k0].concat(merged.map((c) => c.k), [sc.k1]), runs = [];
    for (let i = 0; i < edges.length - 1; i++) {
      if (edges[i + 1] - edges[i] <= 0) continue;
      const mid = (edges[i] + edges[i + 1]) / 2;
      let j = Math.round(((mid - sc.k0) / (sc.k1 - sc.k0)) * sc.nk);
      j = Math.max(0, Math.min(sc.nk, j));
      runs.push({ k0: edges[i], k1: edges[i + 1], n: sc.counts[j] });
    }
    return { crit: merged, runs };
  }

  // Quanti punti alla fetta k (conteggio dalla scansione, per la lettura sul pannello).
  function countAt(sc, k) {
    const j = Math.max(0, Math.min(sc.nk, Math.round(((k - sc.k0) / (sc.k1 - sc.k0)) * sc.nk)));
    return sc.counts[j];
  }

  const api = { contour, filterInside, mask, surface, intersections, scan, link, discuss, tangency, countAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
