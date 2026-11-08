// Minimi quadrati per polinomi di grado 0, 1, 2 nel tempo locale τ = t − t0.
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-14) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
    x[i] = s / M[i][i];
  }
  return x;
}
function inverse(A) {
  const n = A.length, cols = [];
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0); e[j] = 1;
    const c = solve(A, e);
    if (!c) return null;
    cols.push(c);
  }
  return A.map((_, i) => cols.map((c) => c[i]));
}

// Restituisce { coef:[c0,c1,c2], t0, deg, n, r2, rms, se:[...] } oppure null.
// y(t) = c0 + c1 τ + c2 τ², τ = t − t0.
export function polyfit(ts, ys, deg, t0, t1) {
  const px = [], py = [];
  for (let i = 0; i < ts.length; i++) {
    if (ts[i] >= t0 - 1e-9 && ts[i] <= t1 + 1e-9 && Number.isFinite(ys[i])) { px.push(ts[i] - t0); py.push(ys[i]); }
  }
  const n = px.length, p = deg + 1;
  if (n < p) return null;
  const sc = Math.max(t1 - t0, 1e-6);
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0)), Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const u = px[i] / sc, row = [];
    for (let j = 0; j < p; j++) row.push(Math.pow(u, j));
    for (let a = 0; a < p; a++) { Xty[a] += row[a] * py[i]; for (let b = 0; b < p; b++) XtX[a][b] += row[a] * row[b]; }
  }
  const w = solve(XtX, Xty);
  if (!w) return null;
  const coef = w.map((c, j) => c / Math.pow(sc, j));
  let sse = 0, mean = 0;
  for (const y of py) mean += y;
  mean /= n;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    let yh = 0;
    for (let j = 0; j < p; j++) yh += coef[j] * Math.pow(px[i], j);
    sse += (py[i] - yh) ** 2; sst += (py[i] - mean) ** 2;
  }
  let se = null;
  if (n > p) {
    const inv = inverse(XtX);
    if (inv) {
      const s2 = sse / (n - p);
      se = inv.map((r, j) => Math.sqrt(Math.max(0, r[j] * s2)) / Math.pow(sc, j));
    }
  }
  return { coef, t0, t1, deg, n, r2: sst > 0 ? 1 - sse / sst : 1, rms: Math.sqrt(sse / n), se };
}

export function evalFit(fit, t) {
  const u = t - fit.t0;
  let y = 0;
  for (let j = 0; j < fit.coef.length; j++) y += fit.coef[j] * Math.pow(u, j);
  return y;
}
// Derivata del modello in t (pendenza locale).
export function slopeAt(fit, t) {
  const u = t - fit.t0;
  let s = 0;
  for (let j = 1; j < fit.coef.length; j++) s += j * fit.coef[j] * Math.pow(u, j - 1);
  return s;
}
