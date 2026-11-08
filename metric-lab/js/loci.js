/* Luoghi geometrici definiti da relazioni tra distanze, come campi F(P) il cui zero e' il luogo.
   Nessun DOM. ctx = {m, A, B, C, D, r, e, f, dAB}: A, B fuochi (o centro A), C-D direttrice. */
(function (root) {
  'use strict';
  const DL = (root.DL = root.DL || {});

  const TYPES = ['axis', 'circle', 'ellipse', 'hyperbola', 'parabola'];

  function line(c) { return { x0: c.C.x, y0: c.C.y, vx: c.D.x - c.C.x, vy: c.D.y - c.C.y }; }

  function fields(type, c) {
    const m = c.m, A = c.A, B = c.B;
    const d = (x, y, Q) => m.dist(x, y, Q.x, Q.y);
    switch (type) {
      case 'axis': return { fields: [(x, y) => d(x, y, A) - d(x, y, B)] };
      case 'circle': return { fields: [(x, y) => d(x, y, A) - c.r] };
      case 'ellipse': {
        const s2 = c.dAB + c.e;
        return { fields: [(x, y) => d(x, y, A) + d(x, y, B) - s2], twoA: s2 };
      }
      case 'hyperbola': {
        const s2 = c.f * c.dAB;
        return { fields: [(x, y) => d(x, y, A) - d(x, y, B) - s2, (x, y) => d(x, y, B) - d(x, y, A) - s2], twoA: s2 };
      }
      default: {
        const L = line(c);
        return { fields: [(x, y) => d(x, y, A) - m.toLine(x, y, L)], line: L };
      }
    }
  }

  /* Coppie di campi per la costruzione con le palle: ogni coppia e' (G1, G2); le intersezioni
     dei loro zeri sono punti del luogo. t = raggio corrente. */
  function construction(type, c, t) {
    const m = c.m, A = c.A, B = c.B;
    const d = (x, y, Q) => m.dist(x, y, Q.x, Q.y);
    switch (type) {
      case 'axis': return [[(x, y) => d(x, y, A) - t, (x, y) => d(x, y, B) - t]];
      case 'ellipse': { const s2 = c.dAB + c.e; return [[(x, y) => d(x, y, A) - t, (x, y) => d(x, y, B) - (s2 - t)]]; }
      case 'hyperbola': {
        const s2 = c.f * c.dAB;
        return [[(x, y) => d(x, y, A) - t, (x, y) => d(x, y, B) - (t - s2)],
                [(x, y) => d(x, y, A) - (t - s2), (x, y) => d(x, y, B) - t]];
      }
      case 'parabola': {
        const Ln = line(c);
        return [[(x, y) => d(x, y, A) - t, (x, y) => m.toLine(x, y, Ln) - t]];
      }
      default: return [];
    }
  }

  /* Intervallo ammesso del raggio t per la costruzione. */
  function constructionRange(type, c) {
    switch (type) {
      case 'axis': return [0, 14];
      case 'ellipse': return [0, c.dAB + c.e];
      case 'hyperbola': return [c.f * c.dAB, c.f * c.dAB + 14];
      case 'parabola': return [0, 14];
      default: return [0, 0];
    }
  }

  /* Valori della relazione nel punto di prova Pt. res = 0 quando Pt sta sul luogo. */
  function describe(type, c, Pt) {
    const m = c.m, abs = Math.abs;
    const dA = m.dist(Pt.x, Pt.y, c.A.x, c.A.y), dB = m.dist(Pt.x, Pt.y, c.B.x, c.B.y);
    switch (type) {
      case 'axis': return { rows: [['d(P,A)', dA], ['d(P,B)', dB]], res: dA - dB };
      case 'circle': return { rows: [['d(P,A)', dA], ['r', c.r]], res: dA - c.r };
      case 'ellipse': { const s2 = c.dAB + c.e; return { rows: [['d(P,A) + d(P,B)', dA + dB], ['2a', s2]], res: dA + dB - s2 }; }
      case 'hyperbola': { const s2 = c.f * c.dAB; return { rows: [['|d(P,A) − d(P,B)|', abs(dA - dB)], ['2a', s2]], res: abs(dA - dB) - s2 }; }
      default: {
        const dl = m.toLine(Pt.x, Pt.y, line(c));
        return { rows: [['d(P,F)', dA], ['d(P,ℓ)', dl]], res: dA - dl };
      }
    }
  }

  DL.loci = { TYPES, fields, construction, constructionRange, describe, line };
})(typeof window !== 'undefined' ? window : globalThis);
