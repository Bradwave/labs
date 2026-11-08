/* Campionamento di un campo F(x,y) su griglia di pixel, contorni (marching squares),
   regioni, intersezioni tra contorni. Coordinate di uscita: pixel. Nessun DOM. */
(function (root) {
  'use strict';
  const DL = (root.DL = root.DL || {});

  /* view = {cx, cy, s}: pixel = (cx + x*s, cy - y*s). */
  function sample(F, view, W, H, cell) {
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
    const v = new Float64Array(nx * ny);
    let maxAbs = 0;
    for (let j = 0; j < ny; j++) {
      const y = (view.cy - j * cell) / view.s;
      for (let i = 0; i < nx; i++) {
        const x = (i * cell - view.cx) / view.s;
        let val = F(x, y);
        if (!isFinite(val)) val = 1e6;
        v[j * nx + i] = val;
        const a = Math.abs(val);
        if (a > maxAbs && a < 1e5) maxAbs = a;
      }
    }
    const eps = 1e-9 * (1 + maxAbs);       // il rumore numerico dentro le regioni diventa zero esatto
    for (let k = 0; k < v.length; k++) if (Math.abs(v[k]) <= eps) v[k] = 0;
    return { nx, ny, cell, v, eps };
  }

  function map(g, fn) {
    const v = new Float64Array(g.v.length);
    for (let k = 0; k < v.length; k++) v[k] = fn(g.v[k]);
    return { nx: g.nx, ny: g.ny, cell: g.cell, v, eps: g.eps };
  }

  /* Esiste una cella con tutti e quattro gli angoli a zero esatto: il luogo ha un interno. */
  function hasRegion(g) {
    const { nx, ny, v } = g;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if (v[j * nx + i] === 0 && v[j * nx + i + 1] === 0 && v[(j + 1) * nx + i] === 0 && v[(j + 1) * nx + i + 1] === 0) return true;
    }
    return false;
  }

  /* Segmenti del contorno a livello `level` (dentro = valore < livello). Array piatto x1,y1,x2,y2,... */
  function contours(g, level) {
    const { nx, ny, cell, v } = g, out = [], L = level || 0;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i] - L, b = v[j * nx + i + 1] - L, c = v[(j + 1) * nx + i + 1] - L, d = v[(j + 1) * nx + i] - L;
      const ia = a < 0, ib = b < 0, ic = c < 0, id = d < 0;
      if (ia === ib && ib === ic && ic === id) continue;
      const x0 = i * cell, y0 = j * cell, x1 = x0 + cell, y1 = y0 + cell;
      const T = ia !== ib ? [x0 + cell * a / (a - b), y0] : null;
      const R = ib !== ic ? [x1, y0 + cell * b / (b - c)] : null;
      const B = id !== ic ? [x0 + cell * d / (d - c), y1] : null;
      const Lf = ia !== id ? [x0, y0 + cell * a / (a - d)] : null;
      const pts = [T, R, B, Lf].filter(Boolean);
      if (pts.length === 2) out.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      else if (pts.length === 4) {
        const cIn = (a + b + c + d) / 4 < 0;
        if (ia === cIn) { out.push(T[0], T[1], R[0], R[1], B[0], B[1], Lf[0], Lf[1]); }
        else { out.push(T[0], T[1], Lf[0], Lf[1], R[0], R[1], B[0], B[1]); }
      }
    }
    return out;
  }

  /* Regione {valore < livello}: rettangoli (celle interamente dentro, fuse per riga) e poligoni di bordo. */
  function fillShapes(g, level) {
    const { nx, ny, cell, v } = g, rects = [], polys = [], L = level || 0;
    for (let j = 0; j < ny - 1; j++) {
      let run = -1;
      for (let i = 0; i < nx - 1; i++) {
        const a = v[j * nx + i] - L, b = v[j * nx + i + 1] - L, c = v[(j + 1) * nx + i + 1] - L, d = v[(j + 1) * nx + i] - L;
        const ia = a < 0, ib = b < 0, ic = c < 0, id = d < 0;
        if (ia && ib && ic && id) { if (run < 0) run = i; continue; }
        if (run >= 0) { rects.push(run * cell, j * cell, (i - run) * cell, cell); run = -1; }
        if (!ia && !ib && !ic && !id) continue;
        const x0 = i * cell, y0 = j * cell, x1 = x0 + cell, y1 = y0 + cell;
        const P = [x0, y0, a, x1, y0, b, x1, y1, c, x0, y1, d], poly = [];
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          const px = P[3 * k], py = P[3 * k + 1], pv = P[3 * k + 2], qx = P[3 * k2], qy = P[3 * k2 + 1], qv = P[3 * k2 + 2];
          if (pv < 0) poly.push(px, py);
          if ((pv < 0) !== (qv < 0)) { const t = pv / (pv - qv); poly.push(px + (qx - px) * t, py + (qy - py) * t); }
        }
        polys.push(poly);
      }
      if (run >= 0) rects.push(run * cell, j * cell, (nx - 1 - run) * cell, cell);
    }
    return { rects, polys };
  }

  function segInt(x1, y1, x2, y2, x3, y3, x4, y4) {
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (Math.abs(d) < 1e-12) return null;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  }

  /* Intersezioni tra due insiemi di segmenti (array piatti). Punti entro tol pixel sono fusi. */
  function intersections(sa, sb, tol) {
    const out = [], tt = tol || 4;
    for (let i = 0; i < sa.length; i += 4) {
      const ax1 = sa[i], ay1 = sa[i + 1], ax2 = sa[i + 2], ay2 = sa[i + 3];
      const minx = Math.min(ax1, ax2), maxx = Math.max(ax1, ax2), miny = Math.min(ay1, ay2), maxy = Math.max(ay1, ay2);
      for (let k = 0; k < sb.length; k += 4) {
        const bx1 = sb[k], by1 = sb[k + 1], bx2 = sb[k + 2], by2 = sb[k + 3];
        if (Math.max(bx1, bx2) < minx || Math.min(bx1, bx2) > maxx || Math.max(by1, by2) < miny || Math.min(by1, by2) > maxy) continue;
        const p = segInt(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
        if (!p) continue;
        let dup = false;
        for (let q = 0; q < out.length; q += 2) if (Math.abs(out[q] - p[0]) < tt && Math.abs(out[q + 1] - p[1]) < tt) { dup = true; break; }
        if (!dup) out.push(p[0], p[1]);
      }
    }
    return out;
  }

  DL.field = { sample, map, hasRegion, contours, fillShapes, intersections };
})(typeof window !== 'undefined' ? window : globalThis);
