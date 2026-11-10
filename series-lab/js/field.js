// Series Lab · field.js
// The partial-sum path of the series for every point z of a square grid of sample points (pure module, no DOM).
// History is kept (S_0 … S_k for every path), so moving the cursor back is free; going forward adds terms in
// slices of a time budget, so the interface stays responsive.

const MAX_ENTRIES = 1e6; // paths × terms kept in memory

// Largest side of the grid for a series of `len` terms.
export const maxSide = (len) => Math.max(3, Math.min(21, Math.floor(Math.sqrt(MAX_ENTRIES / Math.max(1, len)))));

export class Field {
  constructor() {
    this.sig = "";
    this.kDone = -1; // index of the last term already added to every path (-1: none)
  }

  // grid: { side, cx, cy, r, len }: side × side points covering [cx−r, cx+r] × [cy−r, cy+r]; len = number of terms.
  // Returns true when the grid was rebuilt (different signature) and every path starts again.
  configure(fn, n0, grid, sig) {
    if (sig === this.sig) return false;
    this.sig = sig;
    this.fn = fn;
    this.n0 = n0;
    this.grid = grid;
    const P = grid.side * grid.side;
    this.count = P;
    this.zRe = new Float64Array(P);
    this.zIm = new Float64Array(P);
    const step = (2 * grid.r) / (grid.side - 1);
    for (let j = 0; j < grid.side; j++)
      for (let i = 0; i < grid.side; i++) {
        this.zRe[j * grid.side + i] = grid.cx + (i - (grid.side - 1) / 2) * step;
        this.zIm[j * grid.side + i] = grid.cy - (j - (grid.side - 1) / 2) * step;
      }
    this.sRe = new Float64Array(P * grid.len); // S_k of path c at c·len + k
    this.sIm = new Float64Array(P * grid.len);
    this.aAbs = new Float64Array(P * grid.len); // |a_k| (not from differences of sums: those lose tiny terms)
    this.valid = new Int32Array(P); // number of finite partial sums of each path
    this.runRe = new Float64Array(P);
    this.runIm = new Float64Array(P);
    this.dead = new Uint8Array(P); // 1 once a term or a sum is not finite
    this.kDone = -1;
    return true;
  }

  // S_k of path c, or null if that path stopped earlier.
  at(c, k) {
    if (k < 0 || k >= this.valid[c]) return null;
    const o = c * this.grid.len + k;
    return [this.sRe[o], this.sIm[o]];
  }

  // Adds terms until kDone = target (clamped to the last term) or the time budget (ms) is spent.
  // Returns true when the target is reached.
  advance(target, budgetMs = 8, now = () => performance.now()) {
    const last = this.grid.len - 1,
      goal = Math.min(target, last),
      len = this.grid.len;
    const t0 = now();
    while (this.kDone < goal) {
      const k = this.kDone + 1,
        n = this.n0 + k;
      for (let c = 0; c < this.count; c++) {
        if (this.dead[c]) continue;
        const a = this.fn(n, [this.zRe[c], this.zIm[c]]);
        const re = this.runRe[c] + a[0],
          im = this.runIm[c] + a[1];
        if (!Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(re) || !Number.isFinite(im)) {
          this.dead[c] = 1;
          continue;
        }
        this.runRe[c] = re;
        this.runIm[c] = im;
        this.sRe[c * len + k] = re;
        this.sIm[c * len + k] = im;
        this.aAbs[c * len + k] = Math.hypot(a[0], a[1]);
        this.valid[c] = k + 1;
      }
      this.kDone = k;
      if (now() - t0 > budgetMs) break;
    }
    return this.kDone >= goal;
  }

  // Terms of path c get smaller: |a_k| < |a_{k/2}| (or are exactly zero). A necessary (not sufficient) condition for convergence.
  // Returns null while too few terms are known, false for a path that stopped (non-finite).
  shrinking(c, k) {
    if (k < 4) return null;
    if (k >= this.valid[c]) return false;
    const len = this.grid.len,
      o = c * len;
    const ak = this.aAbs[o + k];
    return ak === 0 || ak < this.aAbs[o + Math.max(1, k >> 1)];
  }

  // Index of the sample point nearest to z, or -1 when it is farther than a step.
  nearest(re, im) {
    let best = -1,
      bd = Infinity;
    for (let c = 0; c < this.count; c++) {
      const d = Math.hypot(this.zRe[c] - re, this.zIm[c] - im);
      if (d < bd) (bd = d), (best = c);
    }
    const step = (2 * this.grid.r) / (this.grid.side - 1);
    return bd <= step * 0.51 ? best : -1;
  }
}
