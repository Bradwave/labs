/* qr.js — generatore di codici QR (modalità byte, correzione L o M, versioni 1–25), puro e senza dipendenze.
   Serve a mostrare il codice di una scena (pagina e pannello VR) senza librerie remote. Algoritmo e tabelle: standard ISO/IEC 18004.
   QR.make(testo, 'L'|'M'|'auto') → { size, version, ecl, mask, get(x, y) → true se il modulo è scuro }. */
(function (root) {
  'use strict';

  // [livello][versione]: byte di correzione per blocco e numero di blocchi (versione 1..25; indice 0 inutilizzato)
  const ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28]
  };
  const NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21]
  };
  const FORMAT_BITS = { L: 1, M: 0 };
  const MAX_VERSION = 25;

  function rawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { const na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = (ver, ecl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];

  // ---------- Reed-Solomon su GF(256), polinomio 0x11D ----------
  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDivisor(degree) {
    const r = new Array(degree).fill(0); r[degree - 1] = 1; let root = 1;
    for (let i = 0; i < degree; i++) { for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
    return r;
  }
  function rsRemainder(data, divisor) {
    const r = divisor.map(() => 0);
    data.forEach(b => { const f = b ^ r.shift(); r.push(0); divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); }); });
    return r;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
    return Array.from(Buffer.from(str, 'utf8'));
  }

  function make(text, level) {
    const bytes = utf8(String(text));
    let ecl = level === 'M' ? 'M' : 'L', ver = 0;
    const tryLevels = level === 'auto' ? ['M', 'L'] : [ecl];   // "auto": M se entra in una versione ≤ 12, altrimenti L
    for (let li = 0; li < tryLevels.length && !ver; li++) {
      const lv = tryLevels[li];
      for (let v = 1; v <= MAX_VERSION; v++) {
        const bits = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
        if (bits <= dataCodewords(v, lv) * 8 && (level !== 'auto' || lv === 'L' || v <= 12)) { ver = v; ecl = lv; break; }
      }
    }
    if (!ver) throw new Error('Testo troppo lungo per un codice QR (' + bytes.length + ' byte).');
    const size = ver * 4 + 17;

    // dati: modalità byte (0100), lunghezza, byte, terminatore, riempimento
    const bb = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(ver, ecl) * 8;
    put(0, Math.min(4, cap - bb.length)); put(0, (8 - bb.length % 8) % 8);
    for (let pad = 0xEC; bb.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bb.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bb[i + j]; data.push(b); }

    // blocchi, correzione e interleaving
    const nb = NUM_BLOCKS[ecl][ver], blockEcc = ECC_PER_BLOCK[ecl][ver], raw = Math.floor(rawModules(ver) / 8);
    const shortBlocks = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(blockEcc), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - blockEcc + (i < shortBlocks ? 0 : 1)); k += dat.length;
      const ecc = rsRemainder(dat, div); if (i < shortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - blockEcc || j >= shortBlocks) all.push(b[i]); });

    // matrice
    const m = [], fn = [];
    for (let y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const setF = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }                 // sincronismo
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const na = ver === 1 ? 0 : Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
    if (na) for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
    for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const bit = (v, i) => ((v >>> i) & 1) !== 0;
    const formatBits = mask => {
      const d = (FORMAT_BITS[ecl] << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const bits = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(bits, i)); setF(8, 7, bit(bits, 6)); setF(8, 8, bit(bits, 7)); setF(7, 8, bit(bits, 8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(bits, i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(bits, i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(bits, i));
      setF(8, size - 8, true);
    };
    formatBits(0);   // riserva le posizioni prima del posizionamento dei dati
    if (ver >= 7) {
      let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const bits = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); setF(a, b, bit(bits, i)); setF(b, a, bit(bits, i)); }
    }
    // dati a zig-zag
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && k < all.length * 8) { m[y][x] = bit(all[k >>> 3], 7 - (k & 7)); k++; }
      }
    }
    // maschere: si sceglie quella con la penalità minore (regole di continuità, blocchi 2×2 ed equilibrio)
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const applyMask = mk => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[mk](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (m[y][x] === m[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (m[y][x] === m[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      m.forEach(row => row.forEach(v => { if (v) dark++; }));
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, bestP = Infinity;
    for (let mk = 0; mk < 8; mk++) { applyMask(mk); formatBits(mk); const pp = penalty(); if (pp < bestP) { bestP = pp; best = mk; } applyMask(mk); }
    applyMask(best); formatBits(best);
    return { size: size, version: ver, ecl: ecl, mask: best, bytes: bytes.length, get: (x, y) => x >= 0 && y >= 0 && x < size && y < size && m[y][x] };
  }

  // disegna il codice in un canvas 2D quadrato di lato px (con margine di 4 moduli)
  function draw(ctx, qr, px, dark, light) {
    const n = qr.size + 8, k = px / n;
    ctx.fillStyle = light || '#ffffff'; ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = dark || '#000000';
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.get(x, y)) ctx.fillRect(Math.floor((x + 4) * k), Math.floor((y + 4) * k), Math.ceil(k), Math.ceil(k));
  }

  const api = { make: make, draw: draw, dataCodewords: dataCodewords, rsDivisor: rsDivisor, rsRemainder: rsRemainder, MAX_VERSION: MAX_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QR = api;
})(typeof window !== 'undefined' ? window : globalThis);
