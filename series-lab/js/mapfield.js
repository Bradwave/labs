// Series Lab · mapfield.js
// S_N(z) on a fine grid of sample points z, for the colour map of the Field view (pure module, no DOM).
// Only the running sum and the last term of every cell are kept; the grid advances term by term in slices
// of a time budget, so the interface stays responsive.

export class MapField {
  constructor() {
    this.sig = "";
    this.kDone = -1; // index of the last term already added to every cell (-1: none)
    this.fromReset = true; // true until the target is first reached after a (re)start
  }

  // geo: { cols, rows, cx, cy, dx }: cell (i, j) has centre z = (cx + (i − (cols−1)/2)·dx, cy − (j − (rows−1)/2)·dx).
  // Returns true when the grid was rebuilt (different signature) and must be recomputed from scratch.
  configure(fn, n0, geo, sig) {
    if (sig === this.sig) return false;
    this.sig = sig;
    this.fn = fn;
    this.n0 = n0;
    this.geo = geo;
    const N = geo.cols * geo.rows;
    this.sRe = new Float64Array(N);
    this.sIm = new Float64Array(N);
    this.aRe = new Float64Array(N);
    this.aIm = new Float64Array(N);
    this.kDone = -1;
    this.fromReset = true;
    return true;
  }

  zOf(i, j) {
    const g = this.geo;
    return [g.cx + (i - (g.cols - 1) / 2) * g.dx, g.cy - (j - (g.rows - 1) / 2) * g.dx];
  }
  cellAt(re, im) {
    const g = this.geo;
    const i = Math.round((re - g.cx) / g.dx + (g.cols - 1) / 2),
      j = Math.round((g.cy - im) / g.dx + (g.rows - 1) / 2);
    return i >= 0 && i < g.cols && j >= 0 && j < g.rows ? [i, j] : null;
  }

  // Adds terms until kDone = target or the time budget (ms) is spent. Going back restarts from the first term.
  // A cell whose term or sum is not finite stays NaN from then on. Returns true when the target is reached.
  advance(target, budgetMs = 8, now = () => performance.now()) {
    const { cols, rows } = this.geo;
    if (target < this.kDone) {
      this.sRe.fill(0);
      this.sIm.fill(0);
      this.aRe.fill(0);
      this.aIm.fill(0);
      this.kDone = -1;
      this.fromReset = true;
    }
    const t0 = now();
    while (this.kDone < target) {
      const n = this.n0 + this.kDone + 1;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const c = j * cols + i;
          if (Number.isNaN(this.sRe[c])) continue;
          const a = this.fn(n, this.zOf(i, j));
          const re = this.sRe[c] + a[0],
            im = this.sIm[c] + a[1];
          if (!Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(re) || !Number.isFinite(im)) {
            this.sRe[c] = this.sIm[c] = this.aRe[c] = this.aIm[c] = NaN;
          } else {
            this.sRe[c] = re;
            this.sIm[c] = im;
            this.aRe[c] = a[0];
            this.aIm[c] = a[1];
          }
        }
      }
      this.kDone++;
      if (now() - t0 > budgetMs) break;
    }
    const done = this.kDone >= target;
    if (done) this.fromReset = false;
    return done;
  }
}
