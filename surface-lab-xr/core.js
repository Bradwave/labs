/* core.js — parser di equazioni, poligonizzazione (implicite e parametriche), sezioni con un piano,
   classificazione delle coniche, libreria di superfici. Nessuna dipendenza. */
(function (root) {
  'use strict';

  const FUNCS = {
    sin: { js: 'Math.sin', n: 1 }, cos: { js: 'Math.cos', n: 1 }, tan: { js: 'Math.tan', n: 1 },
    asin: { js: 'Math.asin', n: 1 }, acos: { js: 'Math.acos', n: 1 }, atan: { js: 'Math.atan', n: 1 },
    sinh: { js: 'Math.sinh', n: 1 }, cosh: { js: 'Math.cosh', n: 1 }, tanh: { js: 'Math.tanh', n: 1 },
    exp: { js: 'Math.exp', n: 1 }, ln: { js: 'Math.log', n: 1 }, log: { js: 'Math.log10', n: 1 },
    sqrt: { js: 'Math.sqrt', n: 1 }, abs: { js: 'Math.abs', n: 1 }, sign: { js: 'Math.sign', n: 1 }, floor: { js: 'Math.floor', n: 1 },
    atan2: { js: 'Math.atan2', n: 2 }, min: { js: 'Math.min', n: 2 }, max: { js: 'Math.max', n: 2 }
  };
  const CONSTS = { pi: 'Math.PI', e: 'Math.E' };
  const NAMES = Object.keys(FUNCS).concat(Object.keys(CONSTS)).sort((a, b) => b.length - a.length);
  // Parametri: lettere che, oltre alle variabili, possono comparire nelle equazioni (a, b, c, d, k, m, n); ognuna diventa un cursore.
  const PARAM_LETTERS = ['a', 'b', 'c', 'd', 'k', 'm', 'n'];
  const DEF_PARAM = [1, -3, 3];   // valore, minimo, massimo predefiniti di un parametro (anche negativi; con a = 0 le divisioni per a lasciano dei buchi)

  function tokenize(src, vars) {
    const s = src.toLowerCase()
      .replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/[−–]/g, '-').replace(/[·×]/g, '*').replace(/π/g, 'pi');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      const m = /^(\d+(\.\d+)?|\.\d+)/.exec(s.slice(i));
      if (m) { out.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
      if ('+-*/^(),'.indexOf(c) >= 0) { out.push({ t: c }); i++; continue; }
      let found = null;
      for (const n of NAMES) { if (s.startsWith(n, i)) { found = n; break; } }   // prima funzioni e costanti: «abs» non è a·b·s
      if (found) {
        out.push(FUNCS[found] ? { t: 'func', v: found } : { t: 'const', v: found });
        i += found.length; continue;
      }
      if (vars.indexOf(c) >= 0) { out.push({ t: 'var', v: c }); i++; continue; }
      throw new Error('Simbolo non riconosciuto: «' + c + '». Variabili ammesse: ' + (vars.length ? vars.join(', ') : 'nessuna (solo numeri e costanti)') + '.');
    }
    return out;
  }

  // Parser a discesa ricorsiva che produce codice JavaScript sicuro (solo token validati).
  function parseSide(tokens) {
    let p = 0;
    const peek = () => tokens[p];
    const next = () => tokens[p++];

    function expr() {
      let left = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) { const op = next().t; left = '(' + left + op + term() + ')'; }
      return left;
    }
    function startsFactor(tk) { return tk && (tk.t === 'num' || tk.t === 'var' || tk.t === 'func' || tk.t === 'const' || tk.t === '('); }
    function term() {
      let left = unary();
      for (;;) {
        const tk = peek();
        if (tk && (tk.t === '*' || tk.t === '/')) { next(); left = '(' + left + tk.t + unary() + ')'; }
        else if (startsFactor(tk)) { left = '(' + left + '*' + unary() + ')'; }
        else break;
      }
      return left;
    }
    function unary() {
      const tk = peek();
      if (tk && tk.t === '-') { next(); return '(-' + unary() + ')'; }
      if (tk && tk.t === '+') { next(); return unary(); }
      return power();
    }
    function power() {
      const base = atom();
      if (peek() && peek().t === '^') { next(); return 'Math.pow(' + base + ',' + unary() + ')'; }
      return base;
    }
    function atom() {
      const tk = next();
      if (!tk) throw new Error('Espressione incompleta: manca un termine alla fine.');
      if (tk.t === 'num') return tk.v;
      if (tk.t === 'var') return tk.v;
      if (tk.t === 'const') return CONSTS[tk.v];
      if (tk.t === 'func') {
        const f = FUNCS[tk.v];
        if (!peek() || peek().t !== '(') throw new Error('Dopo «' + tk.v + '» servono le parentesi, ad es. ' + tk.v + (f.n === 2 ? '(a, b).' : '(x).'));
        next();
        const args = [expr()];
        if (f.n === 2) {
          if (!peek() || peek().t !== ',') throw new Error('«' + tk.v + '» vuole due argomenti separati da una virgola.');
          next(); args.push(expr());
        }
        if (!peek() || peek().t !== ')') throw new Error('Manca una parentesi chiusa dopo «' + tk.v + '(…».');
        next();
        return f.js + '(' + args.join(',') + ')';
      }
      if (tk.t === '(') {
        const inner = expr();
        if (!peek() || peek().t !== ')') throw new Error('Manca una parentesi chiusa.');
        next();
        return '(' + inner + ')';
      }
      throw new Error('Simbolo inatteso: «' + tk.t + '».');
    }

    if (tokens.length === 0) throw new Error('Espressione vuota.');
    const code = expr();
    if (p < tokens.length) throw new Error('Simbolo inatteso: «' + tokens[p].t + '».');
    return code;
  }

  function usedParams(tokens) { // lettere-parametro presenti, in ordine alfabetico
    const u = {}; tokens.forEach(t => { if (t.t === 'var' && PARAM_LETTERS.indexOf(t.v) >= 0) u[t.v] = true; });
    return PARAM_LETTERS.filter(l => u[l]);
  }
  // I parametri entrano nel codice come variabili locali di una fabbrica: make(valori) restituisce la funzione con quei valori.
  function factory(argList, body, params) {
    const decl = params.map(l => 'var ' + l + '=+P.' + l + ';').join('');
    const mk = new Function('P', decl + 'return function(' + argList + '){return ' + body + ';};');
    return v => mk(Object.assign({}, defaultsOf(params), v || {}));
  }
  const defaultsOf = params => { const d = {}; params.forEach(l => { d[l] = DEF_PARAM[0]; }); return d; };

  // "lhs = rhs"  →  F = lhs − rhs ;  senza "=" si assume "… = 0". vals = { a: 1.5, … } (mancanti: 1).
  function compile(eq, vals) {
    const V = ['x', 'y', 'z'].concat(PARAM_LETTERS);
    const parts = String(eq).split('=');
    if (parts.length > 2) throw new Error('Ci può essere un solo segno «=».');
    const tl = tokenize(parts[0], V), tr = parts.length === 2 ? tokenize(parts[1], V) : [];
    const params = usedParams(tl.concat(tr));
    let code = parseSide(tl);
    if (parts.length === 2) code = '(' + code + '-' + parseSide(tr) + ')';
    const make = factory('x,y,z', code, params);
    return { fn: make(vals), code: code, params: params, make: make };
  }

  // Superficie parametrica: tre espressioni in u e v (più i parametri).
  function compileParam(fx, fy, fz, vals) {
    const V = ['u', 'v'].concat(PARAM_LETTERS), toks = [], used = [];
    const codes = [fx, fy, fz].map(function (s, i) {
      if (String(s).indexOf('=') >= 0) throw new Error('Nelle espressioni parametriche non va il segno «=».');
      try { const tk = tokenize(String(s), V); toks.push(tk); return parseSide(tk); }
      catch (e) { throw new Error(['x(u,v)', 'y(u,v)', 'z(u,v)'][i] + ': ' + e.message); }
    });
    const params = usedParams([].concat.apply([], toks)), make = factory('u,v', '[' + codes.join(',') + ']', params);
    return { fn: make(vals), codes: codes, params: params, make: make };
  }
  // parametri presenti in un'equazione (senza compilarla): ["a", "b"]; errori di sintassi → lista vuota
  function detectParams(eq) { try { return compile(eq).params; } catch (e) { return []; } }
  function detectParamsParam(fx, fy, fz) { try { return compileParam(fx, fy, fz).params; } catch (e) { return []; } }
  // {a:[valore,min,max]} di un preset → {a: valore}
  function defaultParams(p) { const o = {}; Object.keys((p && p.params) || {}).forEach(k => { o[k] = p.params[k][0]; }); return o; }

  // Numero da testo: «2*pi», «pi/2», «-1.5».
  function evalNumber(str) {
    const v = new Function('return ' + parseSide(tokenize(String(str), [])) + ';')();
    if (!isFinite(v)) throw new Error('«' + str + '» non è un numero valido.');
    return v;
  }

  // ---------- superfici implicite: marching tetrahedra (triangolazione di Kuhn, coerente tra celle vicine) ----------
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const TETS = PERMS.map(function (pm) {
    const v = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [1, 1, 1]];
    v[1][pm[0]] = 1; v[2][pm[0]] = 1; v[2][pm[1]] = 1;
    return v;
  });

  // Dominio: cubo [-R,R]^3 (opt.R) oppure scatola opt.bounds = [x0,x1,y0,y1,z0,z1]; N = celle lungo il lato più lungo.
  function polygonize(fn, opt) {
    const N = opt.N, B = opt.bounds || [-opt.R, opt.R, -opt.R, opt.R, -opt.R, opt.R];
    const ext = [B[1] - B[0], B[3] - B[2], B[5] - B[4]], mxe = Math.max(ext[0], ext[1], ext[2]);
    if (!(ext[0] > 0 && ext[1] > 0 && ext[2] > 0)) return { positions: new Float32Array(0), normals: new Float32Array(0), triangles: 0 };
    const cells = ext.map(e => Math.max(1, Math.round(e / (mxe / N))));
    const nx = cells[0], ny = cells[1], nz = cells[2], hx = ext[0] / nx, hy = ext[1] / ny, hz = ext[2] / nz, h = Math.min(hx, hy, hz);
    const nx1 = nx + 1, ny1 = ny + 1, nz1 = nz + 1, X0 = B[0], Y0 = B[2], Z0 = B[4];
    const f = new Float64Array(nx1 * ny1 * nz1);
    for (let k = 0; k < nz1; k++) for (let j = 0; j < ny1; j++) for (let i = 0; i < nx1; i++) f[i + nx1 * (j + ny1 * k)] = fn(X0 + i * hx, Y0 + j * hy, Z0 + k * hz);
    const pos = [];
    const I = [0, 0, 0, 0], O = [0, 0, 0, 0];
    const px = [0, 0, 0, 0], py = [0, 0, 0, 0], pz = [0, 0, 0, 0], fv = [0, 0, 0, 0];
    function emit(a, b) {
      const t = fv[a] / (fv[a] - fv[b]);
      pos.push(px[a] + t * (px[b] - px[a]), py[a] + t * (py[b] - py[a]), pz[a] + t * (pz[b] - pz[a]));
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let mn = Infinity, mx = -Infinity, bad = false;
      for (let c = 0; c < 8; c++) {
        const v = f[(i + (c & 1)) + nx1 * ((j + ((c >> 1) & 1)) + ny1 * (k + ((c >> 2) & 1)))];
        if (v !== v || v === Infinity || v === -Infinity) { bad = true; break; }
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      if (bad || mx < 0 || mn >= 0) continue;
      for (let t = 0; t < 6; t++) {
        let ni = 0, no = 0;
        const tv = TETS[t];
        for (let q = 0; q < 4; q++) {
          const ii = i + tv[q][0], jj = j + tv[q][1], kk = k + tv[q][2];
          fv[q] = f[ii + nx1 * (jj + ny1 * kk)];
          px[q] = X0 + ii * hx; py[q] = Y0 + jj * hy; pz[q] = Z0 + kk * hz;
          if (fv[q] < 0) I[ni++] = q; else O[no++] = q;
        }
        if (ni === 0 || no === 0) continue;
        if (ni === 1) { emit(I[0], O[0]); emit(I[0], O[1]); emit(I[0], O[2]); }
        else if (ni === 3) { emit(I[0], O[0]); emit(I[1], O[0]); emit(I[2], O[0]); }
        else {
          const e0 = pos.length;
          emit(I[0], O[0]); emit(I[0], O[1]); emit(I[1], O[1]); emit(I[1], O[0]);
          const a = pos.slice(e0, e0 + 3), c = pos.slice(e0 + 6, e0 + 9), d = pos.slice(e0 + 9, e0 + 12);
          pos.length = e0 + 6;
          pos.push(c[0], c[1], c[2]);
          pos.push(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
        }
      }
    }
    const nv = pos.length / 3;
    const P = new Float32Array(pos), Nn = new Float32Array(pos.length), e = h * 0.5;
    for (let v = 0; v < nv; v++) {
      const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
      let gx = fn(x + e, y, z) - fn(x - e, y, z), gy = fn(x, y + e, z) - fn(x, y - e, z), gz = fn(x, y, z + e) - fn(x, y, z - e);
      const L = Math.sqrt(gx * gx + gy * gy + gz * gz);
      if (L > 0 && L === L) { gx /= L; gy /= L; gz /= L; } else { gx = gy = gz = 0; }
      Nn[3 * v] = gx; Nn[3 * v + 1] = gy; Nn[3 * v + 2] = gz;
    }
    orient(P, Nn);
    return { positions: P, normals: Nn, triangles: nv / 3 };
  }

  // Orientamento: il lato "fronte" di ogni triangolo guarda dove puntano le normali dei vertici.
  function orient(P, Nn) {
    const tris = P.length / 9;
    for (let t = 0; t < tris; t++) {
      const a = 9 * t;
      const ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2];
      const vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const gx = Nn[a] + Nn[a + 3] + Nn[a + 6], gy = Nn[a + 1] + Nn[a + 4] + Nn[a + 7], gz = Nn[a + 2] + Nn[a + 5] + Nn[a + 8];
      if (cx * gx + cy * gy + cz * gz < 0) {
        for (let q = 0; q < 3; q++) {
          let tmp = P[a + 3 + q]; P[a + 3 + q] = P[a + 6 + q]; P[a + 6 + q] = tmp;
          tmp = Nn[a + 3 + q]; Nn[a + 3 + q] = Nn[a + 6 + q]; Nn[a + 6 + q] = tmp;
        }
      }
      // Punti singolari (gradiente nullo): si usa la normale della faccia
      const L = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (L > 0) for (let q = 0; q < 3; q++) {
        const b = a + 3 * q;
        if (Math.abs(Nn[b]) + Math.abs(Nn[b + 1]) + Math.abs(Nn[b + 2]) < 0.5) {
          const sg = (cx * gx + cy * gy + cz * gz) < 0 ? -1 : 1;
          Nn[b] = sg * cx / L; Nn[b + 1] = sg * cy / L; Nn[b + 2] = sg * cz / L;
        }
      }
    }
  }

  // ---------- superfici parametriche: griglia (u,v) ----------
  function polygonizeParam(fn, u0, u1, v0, v1, Nu, Nv) {
    const nu = Nu + 1, nv = Nv + 1, du = (u1 - u0) / Nu, dv = (v1 - v0) / Nv;
    const P = new Float32Array(nu * nv * 3), G = new Float32Array(nu * nv * 3), ok = new Uint8Array(nu * nv), hasN = new Uint8Array(nu * nv);
    const hu = (u1 - u0) * 1e-4, hv = (v1 - v0) * 1e-4;
    const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    function good(p) { return p && isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]) && Math.abs(p[0]) < 60 && Math.abs(p[1]) < 60 && Math.abs(p[2]) < 60; }
    function normalAt(u, v) {
      const a = fn(u + hu, v), b = fn(u - hu, v), c = fn(u, v + hv), d = fn(u, v - hv);
      if (!good(a) || !good(b) || !good(c) || !good(d)) return null;
      const pu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], pv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
      const x = pu[1] * pv[2] - pu[2] * pv[1], y = pu[2] * pv[0] - pu[0] * pv[2], z = pu[0] * pv[1] - pu[1] * pv[0];
      const L = Math.sqrt(x * x + y * y + z * z), lu = Math.hypot(pu[0], pu[1], pu[2]), lv = Math.hypot(pv[0], pv[1], pv[2]);
      if (!(L > 1e-9 * lu * lv) || !(L > 0)) return null;
      return [x / L, y / L, z / L];
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const u = u0 + i * du, v = v0 + j * dv, k = i + nu * j, p = fn(u, v);
      if (!good(p)) continue;
      ok[k] = 1; P[3 * k] = p[0]; P[3 * k + 1] = p[1]; P[3 * k + 2] = p[2];
      for (let q = 0; q < 3; q++) { if (p[q] < bb[q]) bb[q] = p[q]; if (p[q] > bb[3 + q]) bb[3 + q] = p[q]; }
      let n = normalAt(u, v);
      if (!n) n = normalAt(u + (i < Nu / 2 ? 1 : -1) * du * 0.02, v + (j < Nv / 2 ? 1 : -1) * dv * 0.02);
      if (n) { hasN[k] = 1; G[3 * k] = n[0]; G[3 * k + 1] = n[1]; G[3 * k + 2] = n[2]; }
    }
    const pos = [], nor = [];
    function pushTri(a, b, c) {
      const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
      const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az;
      const vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
      let cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const L = Math.sqrt(cx * cx + cy * cy + cz * cz); if (!(L > 0)) return;
      cx /= L; cy /= L; cz /= L;
      let gx = 0, gy = 0, gz = 0;
      for (const q of [a, b, c]) if (hasN[q]) { gx += G[3 * q]; gy += G[3 * q + 1]; gz += G[3 * q + 2]; }
      if (cx * gx + cy * gy + cz * gz < 0) { const t = b; b = c; c = t; cx = -cx; cy = -cy; cz = -cz; }
      for (const q of [a, b, c]) {
        pos.push(P[3 * q], P[3 * q + 1], P[3 * q + 2]);
        if (hasN[q]) nor.push(G[3 * q], G[3 * q + 1], G[3 * q + 2]); else nor.push(cx, cy, cz);
      }
    }
    for (let j = 0; j < Nv; j++) for (let i = 0; i < Nu; i++) {
      const a = i + nu * j, b = a + 1, d = a + nu, c = d + 1;
      if (!(ok[a] && ok[b] && ok[c] && ok[d])) continue;
      pushTri(a, b, c); pushTri(a, c, d);
    }
    return { positions: new Float32Array(pos), normals: new Float32Array(nor), triangles: pos.length / 9,
             grid: { pos: P, ok: ok, nu: nu, nv: nv }, bbox: bb };
  }

  // ---------- sezioni con un piano ----------
  // Marching squares su una griglia mx × my di valori; edgePt(i,j,lato,v0,v1,v2,v3) → [x,y] sul lato (0 basso, 1 destra, 2 alto, 3 sinistra).
  function march(vals, mx, my, edgePt) {
    const out = [];
    for (let j = 0; j < my - 1; j++) for (let i = 0; i < mx - 1; i++) {
      const v0 = vals[i + mx * j], v1 = vals[i + 1 + mx * j], v2 = vals[i + 1 + mx * (j + 1)], v3 = vals[i + mx * (j + 1)];
      if (!(isFinite(v0) && isFinite(v1) && isFinite(v2) && isFinite(v3))) continue;
      const idx = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      let pairs;
      switch (idx) {
        case 1: case 14: pairs = [[3, 0]]; break;
        case 2: case 13: pairs = [[0, 1]]; break;
        case 3: case 12: pairs = [[3, 1]]; break;
        case 4: case 11: pairs = [[1, 2]]; break;
        case 6: case 9: pairs = [[0, 2]]; break;
        case 7: case 8: pairs = [[3, 2]]; break;
        default: {
          const ci = (v0 + v1 + v2 + v3) < 0;
          if (idx === 5) pairs = ci ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
          else pairs = ci ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
        }
      }
      for (const pr of pairs) {
        const a = edgePt(i, j, pr[0], v0, v1, v2, v3), b = edgePt(i, j, pr[1], v0, v1, v2, v3);
        out.push(a[0], a[1], b[0], b[1]);
      }
    }
    return new Float32Array(out);
  }

  // e: elementi (colonna-maggiore) della matrice sistema-di-riferimento → locale della superficie (implicite).
  function sectionSegments(fn, e, O, E1, E2, R, PR, n) { // R: null, un numero (cubo [-R,R]^3) o [x0,x1,y0,y1,z0,z1]
    const B = R == null ? null : (typeof R === 'number' ? [-R, R, -R, R, -R, R] : R);
    const m = n + 1, h = (2 * PR) / n;
    const val = new Float64Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const u = -PR + i * h, v = -PR + j * h;
      const px = O[0] + E1[0] * u + E2[0] * v, py = O[1] + E1[1] * u + E2[1] * v, pz = O[2] + E1[2] * u + E2[2] * v;
      const lx = e[0] * px + e[4] * py + e[8] * pz + e[12], ly = e[1] * px + e[5] * py + e[9] * pz + e[13], lz = e[2] * px + e[6] * py + e[10] * pz + e[14];
      val[i + m * j] = (B && (lx < B[0] || lx > B[1] || ly < B[2] || ly > B[3] || lz < B[4] || lz > B[5])) ? NaN : fn(lx, ly, lz);
    }
    return march(val, m, m, function (i, j, ed, v0, v1, v2, v3) {
      const x0 = -PR + i * h, y0 = -PR + j * h;
      if (ed === 0) return [x0 + h * v0 / (v0 - v1), y0];
      if (ed === 1) return [x0 + h, y0 + h * v1 / (v1 - v2)];
      if (ed === 2) return [x0 + h - h * v2 / (v2 - v3), y0 + h];
      return [x0, y0 + h - h * v3 / (v3 - v0)];
    });
  }

  // Sezione di una superficie parametrica: si cerca g(u,v) = n·P − d = 0 sulla griglia dei parametri.
  // e: matrice locale→riferimento; piano n·p = d con origine O e assi E1, E2 (nel riferimento).
  function sectionSegmentsMesh(grid, e, O, E1, E2, nrm, d) {
    const nu = grid.nu, nv = grid.nv, P = grid.pos, ok = grid.ok;
    const a0 = nrm[0] * e[0] + nrm[1] * e[1] + nrm[2] * e[2], a1 = nrm[0] * e[4] + nrm[1] * e[5] + nrm[2] * e[6];
    const a2 = nrm[0] * e[8] + nrm[1] * e[9] + nrm[2] * e[10], c = nrm[0] * e[12] + nrm[1] * e[13] + nrm[2] * e[14] - d;
    const g = new Float64Array(nu * nv);
    for (let k = 0; k < nu * nv; k++) g[k] = ok[k] ? a0 * P[3 * k] + a1 * P[3 * k + 1] + a2 * P[3 * k + 2] + c : NaN;
    return march(g, nu, nv, function (i, j, ed, v0, v1, v2, v3) {
      let ka, kb, t;
      if (ed === 0) { ka = i + nu * j; kb = ka + 1; t = v0 / (v0 - v1); }
      else if (ed === 1) { ka = i + 1 + nu * j; kb = ka + nu; t = v1 / (v1 - v2); }
      else if (ed === 2) { ka = i + 1 + nu * (j + 1); kb = ka - 1; t = v2 / (v2 - v3); }
      else { ka = i + nu * (j + 1); kb = i + nu * j; t = v3 / (v3 - v0); }
      const lx = P[3 * ka] + t * (P[3 * kb] - P[3 * ka]), ly = P[3 * ka + 1] + t * (P[3 * kb + 1] - P[3 * ka + 1]), lz = P[3 * ka + 2] + t * (P[3 * kb + 2] - P[3 * ka + 2]);
      const fx = e[0] * lx + e[4] * ly + e[8] * lz + e[12] - O[0], fy = e[1] * lx + e[5] * ly + e[9] * lz + e[13] - O[1], fz = e[2] * lx + e[6] * ly + e[10] * lz + e[14] - O[2];
      return [fx * E1[0] + fy * E1[1] + fz * E1[2], fx * E2[0] + fy * E2[1] + fz * E2[2]];
    });
  }

  // Adatta A u² + B uv + C v² + D u + E v + F ai valori di G; null se G non è quadratica sul piano.
  function fitConic(G) {
    const M = [], b = [];
    for (let i = 0; i < 6; i++) { M.push([0, 0, 0, 0, 0, 0]); b.push(0); }
    let maxG = 0;
    for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) {
      const u = a * 0.6, v = c * 0.6, g = G(u, v);
      if (!isFinite(g)) return null;
      maxG = Math.max(maxG, Math.abs(g));
      const r = [u * u, u * v, v * v, u, v, 1];
      for (let i = 0; i < 6; i++) { b[i] += r[i] * g; for (let j = 0; j < 6; j++) M[i][j] += r[i] * r[j]; }
    }
    for (let i = 0; i < 6; i++) {
      let p = i; for (let k = i + 1; k < 6; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      if (Math.abs(M[p][i]) < 1e-12) return null;
      const t = M[i]; M[i] = M[p]; M[p] = t; const tb = b[i]; b[i] = b[p]; b[p] = tb;
      for (let k = i + 1; k < 6; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j < 6; j++) M[k][j] -= f * M[i][j]; b[k] -= f * b[i]; }
    }
    const c = [0, 0, 0, 0, 0, 0];
    for (let i = 5; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < 6; j++) s -= M[i][j] * c[j]; c[i] = s / M[i][i]; }
    const test = [[0.37, -0.91], [-1.13, 0.29], [0.83, 1.07], [-0.55, -1.31], [1.21, -0.43], [0.05, 0.77], [-1.4, 1.0], [1.45, 1.3]];
    for (const t of test) {
      const g = G(t[0], t[1]);
      const pr = c[0] * t[0] * t[0] + c[1] * t[0] * t[1] + c[2] * t[1] * t[1] + c[3] * t[0] + c[4] * t[1] + c[5];
      if (!isFinite(g) || Math.abs(g - pr) > 1e-7 * (1 + maxG)) return null;
    }
    return c;
  }

  const TOL2 = 2e-3;
  function classifyConic(c) {
    let nm = 0; for (const x of c) nm = Math.max(nm, Math.abs(x));
    if (nm < 1e-12) return { kind: 'all', name: 'piano contenuto nella superficie' };
    const A = c[0] / nm, B = c[1] / nm, C = c[2] / nm, D = c[3] / nm, E = c[4] / nm, F = c[5] / nm;
    const q = Math.max(Math.abs(A), Math.abs(B), Math.abs(C));
    if (q < 1e-7) {
      if (Math.hypot(D, E) < 1e-7) return { kind: 'none', name: 'nessuna intersezione' };
      return { kind: 'line', name: 'retta' };
    }
    const det2 = A * C - B * B / 4, d2n = det2 / (q * q);
    const det3 = A * (C * F - E * E / 4) - (B / 2) * ((B / 2) * F - (E / 2) * (D / 2)) + (D / 2) * ((B / 2) * (E / 2) - C * (D / 2));
    if (Math.abs(det3) < 1e-9) {
      if (d2n > TOL2) return { kind: 'point', name: 'un punto' };
      if (d2n < -TOL2) return { kind: 'lines2', name: 'due rette incidenti' };
      return { kind: 'line1', name: 'una retta (o due parallele)' };
    }
    const tr = A + C, dd = Math.sqrt(Math.max(0, (A - C) * (A - C) / 4 + B * B / 4));
    const l1 = tr / 2 + dd, l2 = tr / 2 - dd;
    if (d2n > TOL2) {
      if (det3 * tr >= 0) return { kind: 'empty', name: 'nessun punto reale' };
      const big = Math.max(Math.abs(l1), Math.abs(l2)), small = Math.min(Math.abs(l1), Math.abs(l2));
      if (big - small < 1e-3 * big) {
        const a = tr / 2, r2 = (D * D + E * E) / (4 * a * a) - F / a;
        return { kind: 'circle', name: 'circonferenza', r: Math.sqrt(Math.max(0, r2)), e: 0 };
      }
      return { kind: 'ellipse', name: 'ellisse', e: Math.sqrt(1 - small / big) };
    }
    if (d2n < -TOL2) {
      const k = -det3 / det2;
      const lp = (l1 * k > 0) ? l1 : l2, ln = (l1 * k > 0) ? l2 : l1;
      return { kind: 'hyperbola', name: 'iperbole', e: Math.sqrt(1 + Math.abs(lp) / Math.abs(ln)) };
    }
    return { kind: 'parabola', name: 'parabola', e: 1 };
  }

  function sectionConic(fn, e, O, E1, E2) {
    const G = function (u, v) {
      const px = O[0] + E1[0] * u + E2[0] * v, py = O[1] + E1[1] * u + E2[1] * v, pz = O[2] + E1[2] * u + E2[2] * v;
      return fn(e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]);
    };
    const c = fitConic(G);
    if (!c) return { kind: 'other', name: 'curva non conica' };
    return classifyConic(c);
  }

  // ---------- libreria di superfici ----------
  const GROUPS = ['Quadriche', 'Cilindri e piani', 'Tori', 'Spirali ed eliche', 'Superfici minime', 'Nastri e superfici non orientabili',
                  'Superfici di rotazione', 'Cubiche, quartiche e altre famose', 'Grafici di funzioni di due variabili', 'Superfici periodiche', 'Superfici con parametri'];
  const I = (id, group, name, eq, R, extra) => Object.assign({ id: id, group: group, name: name, kind: 'implicit', eq: eq, R: R, N: 48 }, extra || {});
  const P = (id, group, name, fx, fy, fz, u0, u1, v0, v1, extra) => Object.assign({ id: id, group: group, name: name, kind: 'param', fx: fx, fy: fy, fz: fz, u0: u0, u1: u1, v0: v0, v1: v1, N: 64 }, extra || {});
  const Q = GROUPS[0], CP = GROUPS[1], TO = GROUPS[2], SP = GROUPS[3], MI = GROUPS[4], NO = GROUPS[5], RO = GROUPS[6], FA = GROUPS[7], FU = GROUPS[8], PE = GROUPS[9], PA = GROUPS[10];
  const PRESETS = [
    I('sfera', Q, 'Sfera', 'x^2+y^2+z^2=1', 1.5),
    I('ellissoide', Q, 'Ellissoide', 'x^2/2+y^2+z^2/0.5=1', 2),
    I('paraboloide-ellittico', Q, 'Paraboloide ellittico', 'z=x^2+y^2', 2),
    I('paraboloide-iperbolico', Q, 'Paraboloide iperbolico (sella)', 'z=x^2-y^2', 2),
    I('iperboloide-1', Q, 'Iperboloide a una falda', 'x^2+y^2-z^2=1', 2),
    I('iperboloide-2', Q, 'Iperboloide a due falde', 'z^2-x^2-y^2=1', 2),
    I('cono', Q, 'Cono doppio', 'x^2+y^2=z^2', 2, { cone: true }),
    I('cono-ellittico', Q, 'Cono ellittico', 'x^2/4+y^2=z^2', 2),
    I('cilindro', CP, 'Cilindro circolare', 'x^2+y^2=1', 2),
    I('cilindro-ellittico', CP, 'Cilindro ellittico', 'x^2/2.25+y^2=1', 2),
    I('cilindro-parabolico', CP, 'Cilindro parabolico', 'z=x^2', 2),
    I('cilindro-iperbolico', CP, 'Cilindro iperbolico', 'x^2-y^2=1', 2),
    I('piano', CP, 'Piano', 'x+2y+z=1', 2),
    I('toro', TO, 'Toro', '(sqrt(x^2+y^2)-1.2)^2+z^2=0.25', 2),
    I('toro-corno', TO, 'Toro a corno', '(sqrt(x^2+y^2)-1)^2+z^2=1', 2.1),
    I('toro-fuso', TO, 'Toro a fuso (autointersecante)', '(sqrt(x^2+y^2)-0.6)^2+z^2=1', 1.8),
    P('elicoide', SP, 'Elicoide', 'v*cos(u)', 'v*sin(u)', '0.25*u', '-2*pi', '2*pi', '-1.5', '1.5'),
    P('rampa', SP, 'Rampa elicoidale', '(1+0.5*v)*cos(u)', '(1+0.5*v)*sin(u)', '0.2*u', '-3*pi', '3*pi', '-1', '1', { N: 80 }),
    P('molla', SP, 'Molla (tubo a spirale)', 'cos(u)-0.25*cos(v)*cos(u)+0.25*sin(v)*0.2*sin(u)/1.0198', 'sin(u)-0.25*cos(v)*sin(u)-0.25*sin(v)*0.2*cos(u)/1.0198', '0.2*u+0.25*sin(v)/1.0198', '-2*pi', '2*pi', '0', '2*pi', { N: 80 }),
    P('archimede', SP, 'Parete a spirale di Archimede', '(0.15+0.1*u)*cos(u)', '(0.15+0.1*u)*sin(u)', 'v', '0', '4*pi', '-0.6', '0.6', { N: 80 }),
    P('conchiglia', SP, 'Conchiglia', '(1-exp(u/(6*pi)))*cos(u)*cos(v/2)^2', '(exp(u/(6*pi))-1)*sin(u)*cos(v/2)^2', '0.5*(1-exp(u/(3*pi))-sin(v)+exp(u/(6*pi))*sin(v))', '0', '4*pi', '0', '2*pi', { N: 80 }),
    P('dini', SP, 'Superficie di Dini', 'cos(u)*sin(v)', 'sin(u)*sin(v)', 'cos(v)+ln(tan(v/2))+0.2*u-0.6', '0', '4*pi', '0.2', '2', { N: 80 }),
    P('catenoide', MI, 'Catenoide', 'cosh(v)*cos(u)', 'cosh(v)*sin(u)', 'v', '0', '2*pi', '-1.4', '1.4'),
    P('enneper', MI, 'Superficie di Enneper', 'u-u^3/3+u*v^2', 'v-v^3/3+v*u^2', 'u^2-v^2', '-1.2', '1.2', '-1.2', '1.2'),
    I('scherk', MI, 'Superficie di Scherk', 'exp(z)*cos(x)=cos(y)', 1.4),
    P('mobius', NO, 'Nastro di Möbius (mezza torsione)', '(1+(v/2)*cos(u/2))*cos(u)', '(1+(v/2)*cos(u/2))*sin(u)', '(v/2)*sin(u/2)', '0', '2*pi', '-1', '1', { twoSided: true }),
    P('mobius3', NO, 'Nastro con 3 mezze torsioni', '(1+(v/2)*cos(3*u/2))*cos(u)', '(1+(v/2)*cos(3*u/2))*sin(u)', '(v/2)*sin(3*u/2)', '0', '2*pi', '-1', '1', { twoSided: true, N: 80 }),
    P('nastro-torto', NO, 'Nastro con torsione completa (orientabile)', '(1+(v/2)*cos(u))*cos(u)', '(1+(v/2)*cos(u))*sin(u)', '(v/2)*sin(u)', '0', '2*pi', '-1', '1'),
    P('klein', NO, 'Bottiglia di Klein', '0.7*(2+cos(u/2)*sin(v)-sin(u/2)*sin(2*v))*cos(u)', '0.7*(2+cos(u/2)*sin(v)-sin(u/2)*sin(2*v))*sin(u)', '0.7*(sin(u/2)*sin(v)+cos(u/2)*sin(2*v))', '0', '2*pi', '0', '2*pi', { twoSided: true, N: 80 }),
    P('vaso', RO, 'Vaso', '(0.8+0.3*sin(3*v))*cos(u)', '(0.8+0.3*sin(3*v))*sin(u)', 'v', '0', '2*pi', '-1.5', '1.5'),
    P('pseudosfera', RO, 'Pseudosfera', 'cos(u)/cosh(v)', 'sin(u)/cosh(v)', 'v-tanh(v)-1', '0', '2*pi', '0', '3'),
    P('gabriele', RO, 'Corno di Gabriele', 'cos(u)/v', 'sin(u)/v', 'v-1.5', '0', '2*pi', '0.5', '3'),
    I('cayley', FA, 'Cubica di Cayley', 'x^2+y^2+z^2-2*x*y*z=1', 1.4),
    I('steiner', FA, 'Superficie romana di Steiner', 'x^2*y^2+y^2*z^2+z^2*x^2=x*y*z', 1.2),
    I('whitney', FA, 'Ombrello di Whitney', 'x^2=y^2*z', 1.5),
    I('conoide', FA, 'Conoide di Plücker', 'z*(x^2+y^2)=2*x*y', 1.5),
    I('cubo-smussato', FA, 'Cubo arrotondato (x⁴+y⁴+z⁴=1)', 'x^4+y^4+z^4=1', 1.4),
    I('astroide', FA, 'Astroide tridimensionale', 'abs(x)^(2/3)+abs(y)^(2/3)+abs(z)^(2/3)=1', 1.3, { N: 64 }),
    I('sella-scimmia', FU, 'Sella della scimmia', 'z=x^3-3*x*y^2', 1.5),
    I('gaussiana', FU, 'Campana gaussiana', 'z=2*exp(-(x^2+y^2))', 2),
    I('onde', FU, 'Onde circolari', 'z=0.5*cos(4*sqrt(x^2+y^2))*exp(-0.3*(x^2+y^2))', 2.5, { N: 64 }),
    I('eggbox', FU, 'Cartone delle uova', 'z=0.5*sin(2*x)*sin(2*y)', 2.2, { N: 64 }),
    I('gyroid', PE, 'Giroide', 'sin(2*x)*cos(2*y)+sin(2*y)*cos(2*z)+sin(2*z)*cos(2*x)=0', 1.6, { N: 52 }),
    I('schwarz-p', PE, 'Superficie P di Schwarz', 'cos(2*x)+cos(2*y)+cos(2*z)=0', 1.6, { N: 52 }),
    I('schwarz-d', PE, 'Superficie D di Schwarz', 'sin(2*x)*sin(2*y)*sin(2*z)+sin(2*x)*cos(2*y)*cos(2*z)+cos(2*x)*sin(2*y)*cos(2*z)+cos(2*x)*cos(2*y)*sin(2*z)=0', 1.6, { N: 44 }),
    // famiglie con parametri: i cursori compaiono nella pagina e nel pannello VR
    I('ellissoide-abc', PA, 'Ellissoide (a, b, c)', 'x^2/a^2+y^2/b^2+z^2/c^2=1', 2.5, { params: { a: [1.4, 0.4, 2.4], b: [1, 0.4, 2.4], c: [0.7, 0.4, 2.4] } }),
    I('sfera-a', PA, 'Sfera di raggio a', 'x^2+y^2+z^2=a^2', 2.5, { params: { a: [1.2, 0.3, 2.4] } }),
    I('cono-k', PA, 'Cono con apertura k', 'x^2+y^2=k^2*z^2', 2.2, { params: { k: [1, -2.5, 2.5] } }),
    I('paraboloide-ab', PA, 'Paraboloide (a, b)', 'z=x^2/a^2+y^2/b^2', 2, { params: { a: [1, 0.4, 2], b: [1, 0.4, 2] } }),
    I('iperboloide-abc', PA, 'Iperboloide a una falda (a, b, c)', 'x^2/a^2+y^2/b^2-z^2/c^2=1', 2.5, { params: { a: [1, 0.4, 2], b: [1, 0.4, 2], c: [1, 0.4, 2] } }),
    I('toro-ab', PA, 'Toro (raggio a, tubo b)', '(sqrt(x^2+y^2)-a)^2+z^2=b^2', 2.5, { params: { a: [1.5, 0.8, 2], b: [0.5, 0.2, 0.9] } }),
    I('onde-ak', PA, 'Onde (ampiezza a, frequenza k)', 'z=a*sin(k*x)*cos(k*y)', 2.5, { N: 64, params: { a: [0.6, -1.2, 1.2], k: [1.5, -3, 3] } }),
    P('elicoide-a', PA, 'Elicoide (passo a)', 'u*cos(v)', 'u*sin(v)', 'a*v', '-2', '2', '-pi', 'pi', { params: { a: [0.5, -0.8, 0.8] } })
  ];
  function presetById(id) { return PRESETS.find(p => p.id === id); }

  function tickStep(R) { for (const s of [0.25, 0.5, 1, 2, 5, 10]) if (R / s <= 6) return s; return 10; }

  const api = { compile: compile, compileParam: compileParam, detectParams: detectParams, detectParamsParam: detectParamsParam, defaultParams: defaultParams, PARAM_LETTERS: PARAM_LETTERS, DEF_PARAM: DEF_PARAM, evalNumber: evalNumber, polygonize: polygonize, polygonizeParam: polygonizeParam,
                sectionSegments: sectionSegments, sectionSegmentsMesh: sectionSegmentsMesh, fitConic: fitConic, classifyConic: classifyConic, sectionConic: sectionConic,
                PRESETS: PRESETS, GROUPS: GROUPS, presetById: presetById, tickStep: tickStep };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
