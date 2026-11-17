// lab-kit · qr.js
// QR codes with no dependencies (for links to a scene: works offline). Byte mode (UTF-8), error correction
// level M (L when M does not fit), versions 1–13 (up to 331 bytes at M, 425 at L), automatic mask choice.
// Follows ISO/IEC 18004; the structure mirrors Project Nayuki's reference implementation (MIT).
// qrMatrix(text) → { size, version, ecl, mask, modules: boolean[][] (row, column), dark = true }
// qrSVG(text, { quiet = 4, dark = "#000", light = "#fff", title }) → SVG markup, one module = one unit

// [error-correction codewords per block, [blocks, data codewords], [blocks, data codewords]?] by version
const BLOCKS = {
  L: [null, [7, [1, 19]], [10, [1, 34]], [15, [1, 55]], [20, [1, 80]], [26, [1, 108]], [18, [2, 68]], [20, [2, 78]], [24, [2, 97]], [30, [2, 116]], [18, [2, 68], [2, 69]], [20, [4, 81]], [24, [2, 92], [2, 93]], [26, [4, 107]]],
  M: [null, [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]], [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]], [30, [1, 50], [4, 51]], [22, [6, 36], [2, 37]], [22, [8, 37], [1, 38]]],
};
const ECL_BITS = { L: 1, M: 0 };
const MAX_VERSION = 13;

const dataCodewords = (ver, ecl) => BLOCKS[ecl][ver].slice(1).reduce((s, [n, d]) => s + n * d, 0);

// ---------- Reed–Solomon over GF(256), polynomial 0x11D ----------
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ r.shift();
    r.push(0);
    divisor.forEach((coef, i) => (r[i] ^= gfMul(coef, factor)));
  }
  return r;
}

// ---------- data codewords: mode, length, bytes, terminator, padding, then blocks with their ECC ----------
function codewords(bytes, ver, ecl) {
  const bits = [];
  const put = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver, ecl) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const [ecLen, ...groups] = BLOCKS[ecl][ver];
  const divisor = rsDivisor(ecLen);
  const blocks = [];
  let k = 0;
  for (const [n, d] of groups)
    for (let i = 0; i < n; i++) {
      const dat = data.slice(k, (k += d));
      blocks.push({ dat, ecc: rsRemainder(dat, divisor) });
    }
  const out = [];
  const maxD = Math.max(...blocks.map((b) => b.dat.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.dat.length) out.push(b.dat[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ecc[i]);
  return out;
}

// ---------- the matrix ----------
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const size = ver * 4 + 17, n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function build(ver, ecl, words, mask) {
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    mod[y][x] = dark;
    fn[y][x] = true;
  };
  // timing patterns, finders with separators, alignment patterns
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  const al = alignmentPositions(ver), last = al.length - 1;
  for (let i = 0; i <= last; i++)
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  // format information (two copies) and the dark module
  const fmt = (ECL_BITS[ecl] << 3) | mask;
  let rem = fmt;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fbits = ((fmt << 10) | rem) ^ 0x5412;
  const fb = (i) => ((fbits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, fb(i));
  set(8, 7, fb(6));
  set(8, 8, fb(7));
  set(7, 8, fb(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, fb(i));
  set(8, size - 8, true);
  // version information (version 7 and up)
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vbits = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >>> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
  // data in a zigzag from the bottom right, two columns at a time, skipping the vertical timing column
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        if (i < words.length * 8) mod[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
  }
  // mask on the data modules only
  const m = MASKS[mask];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && m(x, y)) mod[y][x] = !mod[y][x];
  return mod;
}

// penalty of a masked symbol (the four rules of the standard), to pick the best mask
function penalty(mod) {
  const size = mod.length;
  let p = 0, dark = 0;
  const lines = [];
  for (let y = 0; y < size; y++) lines.push(mod[y]);
  for (let x = 0; x < size; x++) lines.push(mod.map((row) => row[x]));
  const F1 = [true, false, true, true, true, false, true, false, false, false, false];
  const F2 = [...F1].reverse();
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) p += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      if (F1.every((v, k) => line[i + k] === v)) p += 40;
      if (F2.every((v, k) => line[i + k] === v)) p += 40;
    }
  }
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
    }
  for (const row of mod) for (const c of row) if (c) dark++;
  const total = size * size;
  p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

export function qrMatrix(text, opts = {}) {
  const bytes = [...new TextEncoder().encode(String(text))];
  for (const ecl of opts.ecl ? [opts.ecl] : ["M", "L"]) {
    if (!BLOCKS[ecl]) throw new Error(`QR: error correction level ${ecl} not supported (M or L)`);
    for (let ver = 1; ver <= MAX_VERSION; ver++) {
      if (4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver, ecl) * 8) continue;
      const words = codewords(bytes, ver, ecl);
      let best = null;
      const masks = opts.mask != null ? [opts.mask] : [0, 1, 2, 3, 4, 5, 6, 7];
      for (const mask of masks) {
        const modules = build(ver, ecl, words, mask);
        const score = penalty(modules);
        if (!best || score < best.score) best = { score, mask, modules };
      }
      return { size: ver * 4 + 17, version: ver, ecl, mask: best.mask, modules: best.modules };
    }
  }
  throw new Error(`QR: text too long (${bytes.length} bytes; at most 425)`);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function qrSVG(text, opts = {}) {
  const { quiet = 4, dark = "#000", light = "#fff", title = "" } = opts;
  const q = qrMatrix(text, opts);
  const n = q.size + 2 * quiet;
  let d = "";
  q.modules.forEach((row, y) => {
    // one rectangle per horizontal run of dark modules
    for (let x = 0; x < q.size; x++) {
      if (!row[x]) continue;
      let w = 1;
      while (x + w < q.size && row[x + w]) w++;
      d += `M${x + quiet} ${y + quiet}h${w}v1h-${w}z`;
      x += w - 1;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"${title ? ' role="img"' : ' aria-hidden="true"'}>` +
    (title ? `<title>${esc(title)}</title>` : "") +
    `<rect width="${n}" height="${n}" fill="${light}"/><path fill="${dark}" d="${d}"/></svg>`
  );
}

// for tests in Node
export const _test = { rsRemainder, rsDivisor, codewords, alignmentPositions, penalty };
