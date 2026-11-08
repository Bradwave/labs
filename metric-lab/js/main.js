/* Interfaccia: canvas, pannelli, interazione. Usa solo il nucleo in DL.* per i calcoli. */
(function () {
  'use strict';
  const DL = window.DL, MT = DL.metric, FD = DL.field, PA = DL.paths, LO = DL.loci, I18 = DL.i18n, MODES = DL.modes;
  const IDS = DL.METRIC_IDS;
  const $ = s => document.querySelector(s);

  /* ---------- stato ---------- */
  const S = {
    lang: 'it', theme: null,
    A: { x: -4, y: -2 }, B: { x: 3, y: 3 }, P: { x: -1, y: 5 }, C: { x: -6, y: -5 }, D: { x: 6, y: -3 },
    h: 1, grid: true, snap: true, lattice: false,
    view: { cx: 0, cy: 0, s: 44, init: false },
    tab: 'dist', metric: 'l2', p: 3, n: 6, H: { x: 0, y: -3 },
    show: { l1: true, l2: true, linf: true, lp: false, disc: false, sncf: false, poly: false },
    paths: { region: true, extremes: true, family: false, k: 3, seed: 1, stair: 0, probe: false, own: false, verts: [] },
    loci: { type: 'axis', r: 5, e: 2, f: 0.5, construct: false, t: 3, play: false },
    scene: { objs: [], sel: null, inter: true, next: 1, lastMetric: 'l2' },
    seed: 1,
    dragging: false, status: ''
  };
  const SC = S.scene;
  const selObj = () => SC.objs.find(o => o.id === SC.sel) || null;
  const curMetric = () => (S.tab === 'scene' ? (selObj() ? selObj().metric : SC.lastMetric) : S.metric);
  const curP = () => (S.tab === 'scene' && selObj() ? selObj().p : S.p);
  const mk = (id, p) => MT(id, p == null ? S.p : p, { n: S.n, H: S.H });
  const met = id => mk(id || S.metric, S.p);
  const t = k => I18.t(S.lang, k);
  const fmt = (x, d) => {
    if (!isFinite(x)) return '∞';
    const k = Math.pow(10, d == null ? 3 : d);
    const s = String(Math.round(x * k) / k);
    return S.lang === 'it' ? s.replace('.', ',') : s;
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* senza storage la pagina funziona lo stesso */ } }
  };

  /* ---------- colori dal tema ---------- */
  let C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    C = { bg: g('--cv-bg'), ink: g('--ink'), muted: g('--muted'), line: g('--line'), axis: g('--axis'), good: g('--good'), bad: g('--bad'),
      l1: g('--m-l1'), l2: g('--m-l2'), linf: g('--m-linf'), lp: g('--m-lp'), disc: g('--m-disc'), sncf: g('--m-sncf'), poly: g('--m-poly'), acc: g('--accent') };
  }

  /* ---------- canvas ---------- */
  const cv = $('#cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0;
  function resize() {
    const r = $('#view').getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const first = !S.view.init;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (first) { S.view.s0 = Math.min(44, Math.max(18, Math.min(W / 18, H / 14))); S.view.s = S.view.s0; S.view.cx = W / 2; S.view.cy = H / 2; S.view.init = true; }
    dirty();
  }
  const toPx = p => [S.view.cx + p.x * S.view.s, S.view.cy - p.y * S.view.s];
  const toW = (px, py) => ({ x: (px - S.view.cx) / S.view.s, y: (S.view.cy - py) / S.view.s });
  const snapV = v => (S.snap ? Number((Math.round(v / S.h) * S.h).toFixed(9)) : v);

  let queued = false;
  function dirty() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }

  function cellSize() {
    let c = S.dragging ? 6 : (S.tab === 'scene' ? 3 : S.metric === 'l1' || S.metric === 'linf' ? 2 : 3);
    while ((W / c) * (H / c) > 160000) c++;
    return c;
  }

  /* ---------- primitive di disegno ---------- */
  function strokeSegs(segs, color, lw, alpha, dash) {
    if (!segs.length) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i < segs.length; i += 4) { ctx.moveTo(segs[i], segs[i + 1]); ctx.lineTo(segs[i + 2], segs[i + 3]); }
    ctx.stroke(); ctx.restore();
  }
  function fillShapes(sh, color, alpha) {
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = 0.6;
    ctx.beginPath();
    const r = sh.rects;
    for (let i = 0; i < r.length; i += 4) ctx.rect(r[i], r[i + 1], r[i + 2], r[i + 3]);
    for (const poly of sh.polys) {
      if (poly.length < 6) continue;
      ctx.moveTo(poly[0], poly[1]);
      for (let k = 2; k < poly.length; k += 2) ctx.lineTo(poly[k], poly[k + 1]);
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function polyline(pts, color, lw, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((p, i) => { const q = toPx(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke(); ctx.restore();
  }
  function label(text, x, y, color, align) {
    ctx.save(); ctx.font = '700 12px "Space Mono", monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = C.bg; ctx.strokeText(text, x, y);
    ctx.fillStyle = color || C.ink; ctx.fillText(text, x, y); ctx.restore();
  }

  /* ---------- griglia e assi ---------- */
  function drawGrid() {
    const s = S.view.s, v = S.view;
    const x0 = (0 - v.cx) / s, x1 = (W - v.cx) / s, y1 = (v.cy - 0) / s, y0 = (v.cy - H) / s;
    let vs = S.h, i = 0;
    while (vs * s < 12) { vs *= (i % 2 ? 2.5 : 2); i++; }
    let ls = vs; i = 0;
    while (ls * s < 54) { ls *= (i % 2 ? 2.5 : 2); i++; }
    ctx.save(); ctx.lineWidth = 1;
    if (S.grid) {
      ctx.strokeStyle = C.line; ctx.beginPath();
      for (let k = Math.ceil(x0 / vs); k <= Math.floor(x1 / vs); k++) { const px = Math.round(v.cx + k * vs * s) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); }
      for (let k = Math.ceil(y0 / vs); k <= Math.floor(y1 / vs); k++) { const py = Math.round(v.cy - k * vs * s) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); }
      ctx.stroke();
    }
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1.5; ctx.beginPath();
    const ax = Math.round(v.cx) + 0.5, ay = Math.round(v.cy) + 0.5;
    ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke();
    ctx.restore();
    if (S.lattice && S.h * s >= 7 && (W / (S.h * s)) * (H / (S.h * s)) < 9000) {
      ctx.save(); ctx.fillStyle = C.muted; ctx.globalAlpha = 0.7;
      for (let j = Math.ceil(y0 / S.h); j <= Math.floor(y1 / S.h); j++) for (let k = Math.ceil(x0 / S.h); k <= Math.floor(x1 / S.h); k++) { ctx.beginPath(); ctx.arc(v.cx + k * S.h * s, v.cy - j * S.h * s, 2, 0, 6.2832); ctx.fill(); }
      ctx.restore();
    }
    const yl = Math.min(Math.max(v.cy + 14, 14), H - 8), xl = Math.min(Math.max(v.cx - 6, 14), W - 6);
    for (let k = Math.ceil(x0 / ls); k <= Math.floor(x1 / ls); k++) if (k) label(fmt(k * ls, 2), v.cx + k * ls * s, yl, C.muted, 'center');
    for (let k = Math.ceil(y0 / ls); k <= Math.floor(y1 / ls); k++) if (k) label(fmt(k * ls, 2), xl, v.cy - k * ls * s, C.muted, 'right');
  }

  /* ---------- schede: distanze ---------- */
  /* Un cammino minimo vero tra due punti nella metrica m (punti del piano), oppure null se non esiste (discreta). */
  function geoPath(m, A, B, seed) {
    if (m.disc) return null;
    if (m.id === 'sncf') return PA.extremes(m, A, B)[0];
    if (m.strict) return [A, B];
    return PA.sample(m, A, B, 0, seed);
  }
  const NONUNIQUE = ['l1', 'linf', 'poly'];
  const diceUseful = () => (S.tab === 'dist' ? NONUNIQUE.some(id => S.show[id]) : NONUNIQUE.includes(S.metric));
  function drawGeo(m, A, B, col, lw, seed) {
    if (m.disc) {                                  // un salto: arco pieno con punta di freccia
      const a = toPx(A), b = toPx(B), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = 0.22;
      const cx = mx - dy * k, cy = my + dx * k, ex = b[0] - cx, ey = b[1] - cy, el = Math.hypot(ex, ey) || 1;
      ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(cx, cy, b[0], b[1]); ctx.stroke();
      const ux = ex / el, uy = ey / el;
      ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - ux * 12 - uy * 6, b[1] - uy * 12 + ux * 6); ctx.lineTo(b[0] - ux * 12 + uy * 6, b[1] - uy * 12 - ux * 6); ctx.closePath(); ctx.fill();
      ctx.restore(); return;
    }
    const pts = geoPath(m, A, B, seed);
    if (pts) { polyline(pts, col, lw); pts.slice(1, -1).forEach(p => dot(p, 3.5, col, C.bg)); }
  }
  function drawDist() {
    const A = S.A, B = S.B, cell = S.dragging ? 6 : 3;
    if (S.show.l1 || S.show.linf) {              // guida: i cateti Δx e Δy, sottili e continui
      const a = toPx(A), c = toPx({ x: B.x, y: A.y }), b = toPx(B);
      ctx.save(); ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
      label('|Δx| = ' + fmt(Math.abs(B.x - A.x), 2), (a[0] + c[0]) / 2, a[1] + (B.y >= A.y ? 14 : -14), C.muted, 'center');
      label('|Δy| = ' + fmt(Math.abs(B.y - A.y), 2), c[0] + (B.x >= A.x ? 8 : -8), (c[1] + b[1]) / 2, C.muted, B.x >= A.x ? 'left' : 'right');
    }
    let lat = null;
    for (const id of IDS) {
      if (!S.show[id] || id === 'disc') continue;
      const m = met(id), D = m.dist(A.x, A.y, B.x, B.y);
      if (D < 1e-9) continue;
      const F = (x, y) => m.dist(x, y, A.x, A.y) - D;
      const g = FD.sample(F, S.view, W, H, cell);
      strokeSegs(FD.contours(g, 0), C[id], 2.6, S.lattice ? 0.3 : 1);
      if (S.lattice) lat = drawLattice([F], C[id]);
    }
    S.status = S.show.disc ? t('dist.disc') : (S.lattice && lat && lat.zoom ? t('loci.note.zoom') : '');
    IDS.forEach((id, i) => { if (S.show[id]) drawGeo(met(id), A, B, C[id], 3.6, S.seed + i); });
  }

  /* ---------- schede: percorsi ---------- */
  function pathProbe() {
    const m = met(), A = S.A, B = S.B, P = S.P;
    const dAB = m.dist(A.x, A.y, B.x, B.y), s1 = m.dist(A.x, A.y, P.x, P.y), s2 = m.dist(P.x, P.y, B.x, B.y);
    const tol = S.lattice ? 1e-9 : 1.5 / S.view.s;
    return { dAB, s1, s2, exc: s1 + s2 - dAB, on: s1 + s2 - dAB <= tol };
  }
  function drawPaths() {
    const m = met(), A = S.A, B = S.B, col = C[S.metric], Q = S.paths, cell = cellSize();
    S.status = '';
    if (m.id === 'sncf') {
      for (const e of PA.extremes(m, A, B)) polyline(e, col, 4);
    } else if (m.disc) {
      const a = toPx(A), b = toPx(B);
      ctx.save(); ctx.setLineDash([3, 7]); ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
    } else {
      if (Q.region) {
        if (m.strict) polyline([A, B], col, 5);
        else {
          const g = FD.sample(PA.excessField(m, A, B), S.view, W, H, cell), kappa = 0.75 * cell / S.view.s;
          const gh = FD.map(g, v => v - kappa);
          fillShapes(FD.fillShapes(gh, 0), col, 0.24);
          strokeSegs(FD.contours(gh, 0), col, 1.5, 0.9);
        }
      }
      if (Q.extremes) for (const e of PA.extremes(m, A, B)) polyline(e, col, 3);
      if (Q.family) {
        const pts = PA.sample(m, A, B, Q.k, Q.seed);
        polyline(pts, C.ink, 2.6);
        pts.slice(1, -1).forEach(p => dot(p, 3.5, C.ink, C.bg));
      }
      if (Q.stair > 0 && m.id === 'l1') polyline(PA.staircase(A, B, Q.stair), C.ink, 2);
    }
    if (Q.own) polyline([A].concat(Q.verts, [B]), C.ink, 3);
  }
  function dot(p, r, color, ring) {
    const q = toPx(p);
    ctx.save(); ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832);
    ctx.fillStyle = color; ctx.fill();
    if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke(); }
    ctx.restore();
  }

  /* ---------- schede: luoghi ---------- */
  function locusCtx() {
    const m = met(), A = S.A, B = S.B;
    return { m, A, B, C: S.C, D: S.D, r: S.loci.r, e: S.loci.e, f: S.loci.f, dAB: m.dist(A.x, A.y, B.x, B.y) };
  }
  function drawFields(fields, col, cell, lw) {
    let region = false;
    for (const fn of fields) {
      const g = FD.sample(fn, S.view, W, H, cell);
      if (FD.hasRegion(g)) {
        region = true;
        const kappa = 0.75 * cell / S.view.s, gh = FD.map(g, v => Math.abs(v) - kappa);
        fillShapes(FD.fillShapes(gh, 0), col, 0.24);
        strokeSegs(FD.contours(gh, 0), col, 1.4, 0.9);
      }
      strokeSegs(FD.contours(g, 0), col, lw || 2.8, 1);
    }
    return region;
  }
  function drawLattice(fields, col) {
    const h = S.h, s = S.view.s, v = S.view;
    if (h * s < 5) return { zoom: true, n: 0 };
    const i0 = Math.ceil(((0 - v.cx) / s) / h), i1 = Math.floor(((W - v.cx) / s) / h);
    const j0 = Math.ceil(((v.cy - H) / s) / h), j1 = Math.floor(((v.cy - 0) / s) / h);
    let n = 0;
    ctx.save(); ctx.fillStyle = col;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * h, y = j * h;
      for (const fn of fields) {
        if (Math.abs(fn(x, y)) <= 1e-8) {
          const px = v.cx + x * s, py = v.cy - y * s;
          ctx.beginPath(); ctx.arc(px, py, 3.4, 0, 6.2832); ctx.fill(); n++; break;
        }
      }
    }
    ctx.restore();
    return { zoom: false, n };
  }
  function drawLoci() {
    const c = locusCtx(), type = S.loci.type, col = C[S.metric], cell = cellSize();
    const spec = LO.fields(type, c);
    if (spec.line) {
      const L = spec.line, len = Math.hypot(L.vx, L.vy) || 1, big = (W + H) / S.view.s;
      const p1 = { x: L.x0 - L.vx / len * big, y: L.y0 - L.vy / len * big }, p2 = { x: L.x0 + L.vx / len * big, y: L.y0 + L.vy / len * big };
      polyline([p1, p2], C.ink, 1.5, [8, 5]);
    }
    let region = false, lat = null;
    if (S.lattice) lat = drawLattice(spec.fields, col);
    else region = drawFields(spec.fields, col, cell);
    if (S.loci.construct && type !== 'circle') {
      for (const pair of LO.construction(type, c, S.loci.t)) {
        const g1 = FD.sample(pair[0], S.view, W, H, cell), g2 = FD.sample(pair[1], S.view, W, H, cell);
        const s1 = FD.contours(g1, 0), s2 = FD.contours(g2, 0);
        strokeSegs(s1, C.ink, 1.6, 0.7, [6, 4]); strokeSegs(s2, C.ink, 1.6, 0.7, [6, 4]);
        const pts = FD.intersections(s1, s2, 3);
        for (let i = 0; i < pts.length; i += 2) {
          ctx.save(); ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], 5, 0, 6.2832); ctx.fillStyle = C.ink; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = C.bg; ctx.stroke(); ctx.restore();
        }
      }
    }
    if (!S.lattice && !c.m.disc) {
      const usesB = ['axis', 'ellipse', 'hyperbola'].includes(type), dA = c.m.dist(S.P.x, S.P.y, c.A.x, c.A.y);
      const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      drawGeo(c.m, S.P, c.A, col, 3, S.seed);
      const la = toPx(mid(S.P, c.A)); label('d(P,A) = ' + fmt(dA, 2), la[0] + 6, la[1] - 10, col, 'left');
      if (usesB) {
        drawGeo(c.m, S.P, c.B, C.ink, 3, S.seed + 7);
        const dB = c.m.dist(S.P.x, S.P.y, c.B.x, c.B.y), lb = toPx(mid(S.P, c.B)); label('d(P,B) = ' + fmt(dB, 2), lb[0] + 6, lb[1] + 12, C.ink, 'left');
      }
    }
    S.locusRegion = region; S.locusLat = lat;
    S.status = lat ? (lat.zoom ? '' : String(lat.n)) : (region ? t('hud.region') : t('hud.curve'));
    if (lat && !lat.zoom) S.status = lat.n ? '' : t('hud.empty');
  }
  function testPoint() {
    const c = locusCtx(), d = LO.describe(S.loci.type, c, S.P);
    const tol = S.lattice ? 1e-8 : 2 / S.view.s;
    return { rows: d.rows, res: d.res, on: Math.abs(d.res) <= tol };
  }


  /* ---------- scena: oggetti, intersezioni, storia ---------- */
  const PTS = ['A', 'B', 'C', 'D'];
  const SHORT = { l1: 'L1', l2: 'L2', linf: 'L∞', lp: 'Lp', disc: 'd₀', sncf: 'SNCF', poly: 'Pol' };
  const objMet = o => mk(o.metric, o.p);
  const objCtx = o => { const m = objMet(o); return { m, A: o.A, B: o.B, C: o.C, D: o.D, r: o.r, e: o.e, f: o.f, dAB: m.dist(o.A.x, o.A.y, o.B.x, o.B.y) }; };
  const objName = o => t('loci.' + o.type) + ' · ' + SHORT[o.metric] + (o.metric === 'lp' ? ' (p=' + fmt(o.p, 1) + ')' : '');
  function makeObj(type, metric, props) {
    const o = { id: SC.next++, type, metric: metric || 'l2', p: S.p, vis: true, r: 3, e: 2, f: 0.5,
      A: { x: -2, y: -1 }, B: { x: 2, y: 1 }, C: { x: -4, y: -3 }, D: { x: 4, y: -2 } };
    if (props) for (const k in props) o[k] = (PTS.includes(k)) ? { x: props[k][0], y: props[k][1] } : props[k];
    return o;
  }
  function newAtCenter(type) {
    const wc = toW(W / 2, H / 2), cx = snapV(wc.x), cy = snapV(wc.y), h = S.h, k = Math.max(1, Math.round(1 / h)) * h;
    const o = makeObj(type, SC.lastMetric);
    const mv = (p, dx, dy) => { p.x = snapV(cx + dx * k); p.y = snapV(cy + dy * k); };
    mv(o.A, -2, -1); mv(o.B, 2, 1); mv(o.C, -4, -3); mv(o.D, 4, -2);
    return o;
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  let hist = [], hi = -1;
  const snapState = () => JSON.stringify({ o: SC.objs, s: SC.sel, n: SC.next });
  function commit() {
    const st = snapState();
    if (hist[hi] === st) return;
    hist.length = hi + 1; hist.push(st); if (hist.length > 120) hist.shift(); hi = hist.length - 1;
    syncUI();
  }
  function restore(i) {
    const d = JSON.parse(hist[i]); SC.objs = d.o; SC.sel = d.s; SC.next = d.n; hi = i; syncUI(); dirty();
  }
  const undo = () => { if (hi > 0) restore(hi - 1); };
  const redo = () => { if (hi < hist.length - 1) restore(hi + 1); };

  function combine(g1, g2, fn) {
    const v = new Float64Array(g1.v.length);
    for (let k = 0; k < v.length; k++) v[k] = fn(g1.v[k], g2.v[k]);
    return { nx: g1.nx, ny: g1.ny, cell: g1.cell, v, eps: g1.eps };
  }
  const nonEmpty = sh => sh.rects.length > 0 || sh.polys.length > 0;
  function shapeCenters(sh) {
    const out = [];
    for (let i = 0; i < sh.rects.length; i += 4) out.push([sh.rects[i] + sh.rects[i + 2] / 2, sh.rects[i + 1] + sh.rects[i + 3] / 2]);
    for (const p of sh.polys) { let x = 0, y = 0; const n = p.length / 2; for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; } out.push([x / n, y / n]); }
    return out;
  }
  function cluster(cs, rad) {
    const cl = [];
    for (const c of cs) {
      let hit = null;
      for (const k of cl) if (Math.hypot(k.x / k.n - c[0], k.y / k.n - c[1]) < rad) { hit = k; break; }
      if (hit) { hit.x += c[0]; hit.y += c[1]; hit.n++; } else cl.push({ x: c[0], y: c[1], n: 1 });
    }
    return cl.map(k => [k.x / k.n, k.y / k.n]);
  }

  /* Costruisce le primitive grafiche della scena (usate sia dal canvas sia dall'SVG). */
  function sceneOps() {
    const ops = [], bands = [], cell = cellSize(), kappa = 0.75 * cell / S.view.s, res = { pts: [], touch: [], overlap: false };
    for (const o of SC.objs) {
      if (!o.vis) continue;
      const spec = LO.fields(o.type, objCtx(o)), col = C[o.metric], sel = o.id === SC.sel;
      if (spec.line) {
        const L = spec.line, len = Math.hypot(L.vx, L.vy) || 1, big = (W + H) / S.view.s;
        const a = toPx({ x: L.x0 - L.vx / len * big, y: L.y0 - L.vy / len * big }), b = toPx({ x: L.x0 + L.vx / len * big, y: L.y0 + L.vy / len * big });
        ops.push({ k: 'segs', segs: [a[0], a[1], b[0], b[1]], color: col, lw: 1.5, alpha: 0.8, dash: [8, 5] });
      }
      let region = false, segs = [], band = null;
      for (const fn of spec.fields) {
        const g = FD.sample(fn, S.view, W, H, cell), gh = FD.map(g, v => Math.abs(v) - kappa);
        if (FD.hasRegion(g)) {
          region = true;
          ops.push({ k: 'fill', sh: FD.fillShapes(gh, 0), color: col, alpha: 0.24 });
          const cs = FD.contours(gh, 0);
          ops.push({ k: 'segs', segs: cs, color: col, lw: 1.4, alpha: 0.9 }); segs = segs.concat(cs);
        } else segs = segs.concat(FD.contours(g, 0));
        ops.push({ k: 'segs', segs: FD.contours(g, 0), color: col, lw: sel ? 4 : 2.6, alpha: 1 });
        band = band ? combine(band, gh, Math.min) : gh;
      }
      bands.push({ o, segs, region, band });
    }
    if (SC.inter) {
      for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
        const a = bands[i], b = bands[j];
        const p = FD.intersections(a.segs, b.segs, 9);
        const ov = FD.fillShapes(combine(a.band, b.band, Math.max), 0), has = nonEmpty(ov);
        for (let k = 0; k < p.length; k += 2) res.pts.push({ px: p[k], py: p[k + 1], a: a.o, b: b.o });
        if ((a.region || b.region) && has) { ops.push({ k: 'fill', sh: ov, color: C.ink, alpha: 0.4 }); res.overlap = true; }
        else if (!p.length && has) for (const c of cluster(shapeCenters(ov), 12)) res.touch.push({ px: c[0], py: c[1], a: a.o, b: b.o });
      }
      if (res.pts.length) ops.push({ k: 'pts', pts: res.pts.flatMap(q => [q.px, q.py]), color: C.ink, r: 5 });
      if (res.touch.length) ops.push({ k: 'pts', pts: res.touch.flatMap(q => [q.px, q.py]), color: C.ink, r: 6, ring: true });
    }
    return { ops, res };
  }
  function paintOps(ops) {
    for (const op of ops) {
      if (op.k === 'segs') strokeSegs(op.segs, op.color, op.lw, op.alpha, op.dash);
      else if (op.k === 'fill') fillShapes(op.sh, op.color, op.alpha);
      else if (op.k === 'pts') {
        ctx.save();
        for (let i = 0; i < op.pts.length; i += 2) {
          ctx.beginPath(); ctx.arc(op.pts[i], op.pts[i + 1], op.r, 0, 6.2832);
          if (op.ring) { ctx.lineWidth = 2.5; ctx.strokeStyle = op.color; ctx.stroke(); ctx.fillStyle = C.bg; ctx.fill(); }
          else { ctx.fillStyle = op.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.bg; ctx.stroke(); }
        }
        ctx.restore();
      }
    }
  }
  function drawScene() {
    const { ops, res } = sceneOps();
    paintOps(ops); S.interRes = res;
    S.status = SC.objs.length ? '' : t('sc.empty');
  }

  /* ---------- esportazione SVG ---------- */
  function buildSVG() {
    const f = n => Math.round(n * 10) / 10, { ops } = sceneOps(), v = S.view, s = v.s;
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}" font-family="monospace" fill="none" stroke-linecap="round" stroke-linejoin="round">`,
      `<rect width="${f(W)}" height="${f(H)}" fill="${C.bg}"/>`];
    if (S.grid) {
      let vs = S.h, i = 0; while (vs * s < 12) { vs *= (i % 2 ? 2.5 : 2); i++; }
      let d = '';
      for (let k = Math.ceil((0 - v.cx) / s / vs); k <= Math.floor((W - v.cx) / s / vs); k++) d += `M${f(v.cx + k * vs * s)} 0V${f(H)}`;
      for (let k = Math.ceil((v.cy - H) / s / vs); k <= Math.floor(v.cy / s / vs); k++) d += `M0 ${f(v.cy - k * vs * s)}H${f(W)}`;
      out.push(`<path d="${d}" stroke="${C.line}" stroke-width="1"/>`);
    }
    out.push(`<path d="M${f(v.cx)} 0V${f(H)}M0 ${f(v.cy)}H${f(W)}" stroke="${C.axis}" stroke-width="1.5"/>`);
    for (const op of ops) {
      if (op.k === 'segs' && op.segs.length) {
        let d = ''; for (let i = 0; i < op.segs.length; i += 4) d += `M${f(op.segs[i])} ${f(op.segs[i + 1])}L${f(op.segs[i + 2])} ${f(op.segs[i + 3])}`;
        out.push(`<path d="${d}" stroke="${op.color}" stroke-width="${op.lw}" opacity="${op.alpha}"${op.dash ? ` stroke-dasharray="${op.dash.join(' ')}"` : ''}/>`);
      } else if (op.k === 'fill') {
        let d = ''; const r = op.sh.rects;
        for (let i = 0; i < r.length; i += 4) d += `M${f(r[i])} ${f(r[i + 1])}h${f(r[i + 2])}v${f(r[i + 3])}h${f(-r[i + 2])}z`;
        for (const p of op.sh.polys) { if (p.length < 6) continue; d += `M${f(p[0])} ${f(p[1])}`; for (let k = 2; k < p.length; k += 2) d += `L${f(p[k])} ${f(p[k + 1])}`; d += 'z'; }
        out.push(`<path d="${d}" fill="${op.color}" fill-opacity="${op.alpha}" stroke="${op.color}" stroke-opacity="${op.alpha}" stroke-width="0.6"/>`);
      } else if (op.k === 'pts') {
        for (let i = 0; i < op.pts.length; i += 2) out.push(`<circle cx="${f(op.pts[i])}" cy="${f(op.pts[i + 1])}" r="${op.r}" fill="${op.ring ? C.bg : op.color}" stroke="${op.ring ? op.color : C.bg}" stroke-width="2"/>`);
      }
    }
    out.push('</svg>');
    return out.join('\n');
  }

  /* ---------- esempi ---------- */
  const PRESETS = [
    ['balls', () => [['circle', 'l1', { A: [0, 0], r: 4 }], ['circle', 'l2', { A: [0, 0], r: 4 }], ['circle', 'linf', { A: [0, 0], r: 4 }]]],
    ['bis', () => [['axis', 'l1', { A: [-3, -1], B: [3, 2] }], ['axis', 'l2', { A: [-3, -1], B: [3, 2] }]]],
    ['cross', () => [['circle', 'l2', { A: [-1, 0], r: 4 }], ['circle', 'l1', { A: [2, 1], r: 4 }]]],
    ['conic', () => [['ellipse', 'l1', { A: [-3, 0], B: [3, 0], e: 2 }], ['ellipse', 'l2', { A: [-3, 0], B: [3, 0], e: 2 }]]],
    ['par', () => [['parabola', 'linf', { A: [0, 2], C: [-6, -2], D: [6, -2] }], ['parabola', 'l2', { A: [0, 2], C: [-6, -2], D: [6, -2] }]]],
    ['hyp', () => [['hyperbola', 'l1', { A: [-3, 0], B: [3, 0], f: 0.5 }], ['hyperbola', 'l2', { A: [-3, 0], B: [3, 0], f: 0.5 }], ['hyperbola', 'linf', { A: [-3, 0], B: [3, 0], f: 0.5 }]]]
  ];
  function loadPreset(id) {
    const pr = PRESETS.find(p => p[0] === id); if (!pr) return false;
    SC.objs = pr[1]().map(([ty, me, pp]) => makeObj(ty, me, pp));
    SC.sel = SC.objs.length ? SC.objs[0].id : null; SC.lastMetric = SC.objs.length ? SC.objs[0].metric : 'l2';
    if (S.view.init) { S.view.s = S.view.s0; S.view.cx = W / 2; S.view.cy = H / 2; }
    commit(); return true;
  }
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------- punti trascinabili ---------- */
  const needHub = () => (S.tab === 'scene' ? SC.objs.some(o => o.vis && o.metric === 'sncf') : S.tab === 'dist' ? S.show.sncf : S.metric === 'sncf');
  function handles() {
    const hs = baseHandles();
    if (needHub()) hs.push({ k: 'H', p: S.H, sq: true });
    return hs;
  }
  function baseHandles() {
    if (MODES[S.tab]) return MODES[S.tab].handles(api);
    if (S.tab === 'scene') {
      const hs = [];
      for (const o of SC.objs) {
        if (!o.vis) continue;
        const sel = o.id === SC.sel;
        hs.push({ k: 'A', p: o.A, o, small: !sel });
        if (['axis', 'ellipse', 'hyperbola'].includes(o.type)) hs.push({ k: 'B', p: o.B, o, small: !sel });
        if (o.type === 'parabola') hs.push({ k: 'C', p: o.C, o, sq: true, small: !sel }, { k: 'D', p: o.D, o, sq: true, small: !sel });
      }
      return hs;
    }
    const hs = [{ k: 'A', p: S.A }];
    const bUsed = S.tab !== 'loci' || ['axis', 'ellipse', 'hyperbola'].includes(S.loci.type);
    if (bUsed) hs.push({ k: 'B', p: S.B });
    if (S.tab === 'paths') {
      if (S.paths.probe) hs.push({ k: 'P', p: S.P });
      if (S.paths.own) S.paths.verts.forEach((v, i) => hs.push({ k: 'V' + (i + 1), p: v, small: true }));
    }
    if (S.tab === 'loci') {
      hs.push({ k: 'P', p: S.P });
      if (S.loci.type === 'parabola') hs.push({ k: 'C', p: S.C, sq: true }, { k: 'D', p: S.D, sq: true });
    }
    return hs;
  }
  function drawHandles() {
    for (const h of handles()) {
      const q = toPx(h.p);
      let fill = C.ink, ring = C.bg;
      if (h.o) fill = C[h.o.metric];
      if (h.fill) fill = h.fill;
      if (h.k === 'H') fill = C.sncf;
      if (h.k === 'P') {
        const ok = S.tab === 'paths' ? pathProbe().on : testPoint().on;
        fill = ok ? C.good : C.bad;
      }
      ctx.save();
      if (h.sq) { ctx.fillStyle = fill; ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.fillRect(q[0] - 6, q[1] - 6, 12, 12); ctx.strokeRect(q[0] - 6, q[1] - 6, 12, 12); }
      else { ctx.beginPath(); ctx.arc(q[0], q[1], h.small ? 5 : 8, 0, 6.2832); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ring; ctx.stroke(); }
      ctx.restore();
      if (h.o && h.small) continue;
      const txt = h.lab != null ? h.lab : h.small ? h.k : `${h.k} (${fmt(h.p.x, 2)}; ${fmt(h.p.y, 2)})`;
      label(txt, q[0] + 12, q[1] - 14, C.ink, 'left');
    }
  }

  function render() {
    if (!W) return;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    drawGrid();
    if (S.tab === 'dist') drawDist(); else if (S.tab === 'paths') drawPaths(); else if (S.tab === 'scene') drawScene(); else if (MODES[S.tab]) MODES[S.tab].draw(api); else drawLoci();
    drawHandles();
    $('#hud').textContent = S.status || '';
    updateReadouts();
  }

  /* ---------- pannelli: costruzione ---------- */
  function applyI18n() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
    $('#langCur').textContent = S.lang.toUpperCase();
    buildMetricBar(); buildDTable(); buildLocusType(); buildAddRow(); buildPresets(); for (const k in MODES) if (MODES[k].relabel) MODES[k].relabel(api); dirty();
  }
  function buildMetricBar() {
    const bar = $('#metricBar');
    bar.querySelectorAll('.mchip').forEach(n => n.remove());
    for (const id of IDS) {
      const b = document.createElement('button');
      b.className = 'mchip'; b.style.setProperty('--c', `var(--m-${id})`); b.dataset.id = id;
      b.setAttribute('aria-pressed', String(curMetric() === id));
      b.innerHTML = '<i></i><span></span>'; b.lastChild.textContent = t('m.' + id);
      b.addEventListener('click', () => {
        if (S.tab === 'dist') S.show[id] = !S.show[id];
        else if (S.tab === 'scene') { const o = selObj(); SC.lastMetric = id; if (o) { o.metric = id; commit(); } } else S.metric = id;
        syncUI(); dirty();
      });
      bar.insertBefore(b, bar.querySelector('.pctl'));
    }
  }
  function buildDTable() {
    const box = $('#dtable'); box.textContent = '';
    for (const id of IDS) {
      const row = document.createElement('label');
      row.className = 'drow'; row.style.setProperty('--c', `var(--m-${id})`); row.dataset.id = id;
      row.innerHTML = '<input type="checkbox" aria-label=""><div><div class="dname"></div><div class="dform"></div></div><span class="dval"></span>';
      const cb = row.querySelector('input');
      cb.checked = !!S.show[id]; cb.setAttribute('aria-label', t('dist.show') + ': ' + t('m.' + id));
      cb.addEventListener('change', () => { S.show[id] = cb.checked; syncUI(); dirty(); });
      row.querySelector('.dname').textContent = t('m.' + id);
      row.querySelector('.dform').textContent = t('f.' + id);
      box.appendChild(row);
    }
  }
  function buildLocusType() {
    const box = $('#locusType'); box.textContent = '';
    for (const ty of LO.TYPES) {
      const b = document.createElement('button');
      b.textContent = t('loci.' + ty); b.dataset.type = ty; b.setAttribute('aria-pressed', String(S.loci.type === ty));
      b.addEventListener('click', () => { S.loci.type = ty; syncUI(); dirty(); });
      box.appendChild(b);
    }
  }
  function buildPControl() {
    const w = document.createElement('div'); w.className = 'pctl'; w.hidden = true;
    w.innerHTML = '<label for="pSlider">p</label><input type="range" id="pSlider" min="1" max="8" step="0.1" value="3"><output id="pVal">3</output>';
    $('#mParams').appendChild(w);
    const nw = document.createElement('div'); nw.className = 'pctl nctl'; nw.hidden = true;
    nw.innerHTML = '<label for="nSlider">n</label><input type="range" id="nSlider" min="4" max="12" step="2" value="6"><output id="nVal">6</output>';
    $('#mParams').appendChild(nw);
    $('#nSlider').addEventListener('input', e => { S.n = parseInt(e.target.value, 10); $('#nVal').textContent = S.n; dirty(); });
    $('#pSlider').addEventListener('input', e => {
      const v = parseFloat(e.target.value), o = S.tab === 'scene' ? selObj() : null;
      if (o) o.p = v; else S.p = v; dirty();
    });
    $('#pSlider').addEventListener('change', () => { if (S.tab === 'scene') commit(); });
  }

  /* ---------- sincronizza i controlli con lo stato ---------- */
  function syncUI() {
    const cm = curMetric();
    document.querySelectorAll('.mchip').forEach(b => b.setAttribute('aria-pressed', String(S.tab === 'dist' ? !!S.show[b.dataset.id] : b.dataset.id === cm)));
    const dv = $('#diceBtn'); dv.hidden = !['dist', 'paths', 'loci'].includes(S.tab);
    dv.classList.toggle('off', !diceUseful());
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
    document.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + S.tab; });
    document.querySelectorAll('#locusType button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === S.loci.type)));
    document.querySelectorAll('#dtable .drow').forEach(r => { r.dataset.off = String(!S.show[r.dataset.id]); r.querySelector('input').checked = !!S.show[r.dataset.id]; });
    $('#gridBtn').setAttribute('aria-pressed', String(S.grid));
    $('#snapBtn').setAttribute('aria-pressed', String(S.snap));
    $('#latBtn').setAttribute('aria-pressed', String(S.lattice));
    const nc = $('.nctl'); nc.hidden = !(cm === 'poly' || (S.tab === 'dist' && S.show.poly));
    const pc = $('#pSlider').closest('.pctl');
    pc.hidden = S.tab === 'scene' ? cm !== 'lp' || !selObj() : !(S.metric === 'lp' || (S.tab === 'dist' && S.show.lp));
    $('#pSlider').value = curP();
    $('#grpStair').hidden = S.metric !== 'l1';
    const ty = S.loci.type;
    $('#rowR').hidden = $('#lThrough').hidden = ty !== 'circle';
    $('#rowE').hidden = ty !== 'ellipse';
    $('#rowF').hidden = ty !== 'hyperbola';
    $('#ownRow').hidden = !S.paths.own;
    $('#lPlay').setAttribute('aria-pressed', String(S.loci.play));
    const def = $('#locusDef'); def.textContent = t('loci.def.' + ty); def.style.setProperty('--c', `var(--m-${S.metric})`);
    syncScenePane();
    $('#pathInfo').style.setProperty('--c', `var(--m-${S.metric})`);
  }


  /* ---------- pannello scena ---------- */
  const eyeSvg = '<svg class="ic" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const trashSvg = '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
  function buildAddRow() {
    const box = $('#addRow'); box.textContent = '';
    for (const ty of LO.TYPES) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.type = ty;
      b.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span></span>'; b.lastChild.textContent = t('loci.' + ty);
      b.addEventListener('click', () => { const o = newAtCenter(ty); SC.objs.push(o); SC.sel = o.id; commit(); dirty(); });
      box.appendChild(b);
    }
  }
  function buildPresets() {
    const sel = $('#presetSel'); sel.textContent = '';
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('sc.example'); sel.appendChild(o0);
    for (const p of PRESETS) { const o = document.createElement('option'); o.value = p[0]; o.textContent = t('ex.' + p[0]); sel.appendChild(o); }
  }
  function buildOList() {
    const box = $('#olist'); box.textContent = ''; box.dataset.empty = t('sc.empty');
    for (const o of SC.objs) {
      const r = document.createElement('div'); r.className = 'orow'; r.style.setProperty('--c', `var(--m-${o.metric})`);
      r.setAttribute('aria-selected', String(o.id === SC.sel)); r.dataset.off = String(!o.vis); r.setAttribute('role', 'option');
      r.innerHTML = '<span class="oname"></span><button type="button" class="icon-btn" data-a="vis"></button><button type="button" class="icon-btn" data-a="del"></button>';
      r.querySelector('.oname').textContent = objName(o);
      const bv = r.querySelector('[data-a=vis]'), bd = r.querySelector('[data-a=del]');
      bv.innerHTML = eyeSvg; bd.innerHTML = trashSvg; bv.title = t('sc.visible'); bd.title = t('sc.delete');
      bv.setAttribute('aria-label', t('sc.visible')); bd.setAttribute('aria-label', t('sc.delete'));
      r.addEventListener('click', e => {
        const a = e.target.closest('[data-a]');
        if (a && a.dataset.a === 'vis') { o.vis = !o.vis; commit(); }
        else if (a && a.dataset.a === 'del') { SC.objs = SC.objs.filter(q => q !== o); if (SC.sel === o.id) SC.sel = SC.objs.length ? SC.objs[SC.objs.length - 1].id : null; commit(); }
        else { SC.sel = o.id; SC.lastMetric = o.metric; syncUI(); }
        dirty();
      });
      box.appendChild(r);
    }
  }
  function syncScenePane() {
    buildOList();
    const o = selObj();
    $('#selBox').hidden = !o;
    $('#undoBtn').disabled = hi <= 0; $('#redoBtn').disabled = hi >= hist.length - 1;
    $('#sInter').checked = SC.inter;
    if (!o) return;
    $('#sRowR').hidden = o.type !== 'circle'; $('#sRowE').hidden = o.type !== 'ellipse'; $('#sRowF').hidden = o.type !== 'hyperbola';
    const d = $('#selDef'); d.textContent = t('loci.def.' + o.type); d.style.setProperty('--c', `var(--m-${o.metric})`);
    $('#sR').value = o.r; $('#sE').value = o.e; $('#sF').value = o.f;
    $('#sRv').textContent = fmt(o.r, 2); $('#sEv').textContent = fmt(o.e, 2); $('#sFv').textContent = fmt(o.f, 2);
  }
  function updateScene() {
    const r = S.interRes, box = $('#interOut');
    if (!SC.inter) { box.textContent = ''; return; }
    if (!r) return;
    const idx = o => SC.objs.indexOf(o) + 1;
    const lines = r.pts.slice(0, 14).map(q => { const w = toW(q.px, q.py); return `${idx(q.a)} × ${idx(q.b)}: (${fmt(w.x, 2)}; ${fmt(w.y, 2)})`; });
    const tl = r.touch.slice(0, 6).map(q => { const w = toW(q.px, q.py); return `${idx(q.a)} ~ ${idx(q.b)}: (${fmt(w.x, 2)}; ${fmt(w.y, 2)}) ○`; });
    let html = r.pts.length ? `<b>${r.pts.length}</b> ${t('sc.inter.pts')}<br>` + lines.join('<br>') : (r.overlap || r.touch.length ? '' : t('sc.inter.none'));
    if (r.pts.length > 14) html += '<br>…';
    if (tl.length) html += (html ? '<br>' : '') + tl.join('<br>');
    if (r.overlap) html += (html ? '<br>' : '') + t('sc.inter.reg');
    box.innerHTML = html;
  }

  /* ---------- letture ---------- */
  function updateReadouts() {
    $('#pVal').textContent = fmt(curP(), 1);
    if (S.tab === 'dist') {
      const A = S.A, B = S.B;
      $('#coordA').textContent = `A (${fmt(A.x, 2)}; ${fmt(A.y, 2)})`; $('#coordB').textContent = `B (${fmt(B.x, 2)}; ${fmt(B.y, 2)})`;
      const v = {};
      document.querySelectorAll('#dtable .drow').forEach(r => {
        const id = r.dataset.id, m = met(id); v[id] = m.dist(A.x, A.y, B.x, B.y);
        r.querySelector('.dval').textContent = fmt(v[id]);
        r.querySelector('.dname').textContent = id === 'lp' ? `${t('m.lp')} p = ${fmt(S.p, 1)}` : t('m.' + id);
      });
      const items = [['d∞', v.linf], ['d₂', v.l2], ['d₁', v.l1], ['√2·d₂', Math.SQRT2 * v.l2], ['2·d∞', 2 * v.linf]];
      const ok = items.every((it, i) => i === 0 || items[i - 1][1] <= it[1] + 1e-9);
      $('#chain').innerHTML = items.map(it => `${it[0]} ${fmt(it[1])}`).join(' ≤ ') + (ok ? ' <span class="ok">✓</span>' : '');
    } else if (S.tab === 'paths') updatePaths();
    else if (S.tab === 'scene') updateScene();
    else if (MODES[S.tab]) MODES[S.tab].update(api);
    else updateLoci();
  }
  function updatePaths() {
    const m = met(), A = S.A, B = S.B, Q = S.paths;
    const dx = Math.abs(B.x - A.x), dy = Math.abs(B.y - A.y), dAB = m.dist(A.x, A.y, B.x, B.y);
    let key;
    if (m.disc) key = 'paths.info.disc';
    else if (m.id === 'sncf') key = 'paths.info.sncf';
    else if (m.id === 'poly') key = 'paths.info.poly';
    else if (m.strict) key = 'paths.info.strict';
    else if (m.id === 'l1') key = (dx < 1e-9 || dy < 1e-9) ? 'paths.info.l1.one' : 'paths.info.l1.many';
    else if (m.id === 'linf') key = Math.abs(dx - dy) < 1e-9 ? 'paths.info.linf.one' : 'paths.info.linf.many';
    else key = 'paths.info.poly';
    $('#pathInfo').textContent = `d(A,B) = ${fmt(dAB)}. ` + t(key);
    $('#pKv').textContent = Q.k; $('#pStairV').textContent = Q.stair;
    $('#stairOut').innerHTML = Q.stair > 0 && m.id === 'l1'
      ? `${t('paths.stair.out')}: <b>${fmt(dx + dy)}</b><br>${t('paths.stair.euc')}: <b>${fmt(Math.hypot(dx, dy))}</b><br>${t('paths.stair.note')}` : '';
    if (Q.probe) {
      const p = pathProbe();
      $('#probeOut').innerHTML = `d(A,P) + d(P,B) = ${fmt(p.s1)} + ${fmt(p.s2)} = <b>${fmt(p.s1 + p.s2)}</b><br>d(A,B) = <b>${fmt(p.dAB)}</b><br>` +
        (p.on ? `<span class="ok">${t('paths.probe.yes')}</span>` : `<span class="no">${t('paths.probe.no')} ${fmt(p.exc)}</span>`);
    } else $('#probeOut').textContent = '';
    if (Q.own) {
      const len = PA.length(m, [A].concat(Q.verts, [B])), exc = len - dAB, min = exc < 1e-7;
      $('#ownOut').innerHTML = `${t('paths.own.len')}: <b>${fmt(len)}</b><br>${t('paths.own.d')}: <b>${fmt(dAB)}</b><br>${t('paths.own.exc')}: <b>${fmt(Math.max(0, exc))}</b><br>` +
        (min ? `<span class="ok">${t('paths.own.yes')}</span>` : `<span class="no">${t('paths.own.no')}</span>`);
    } else $('#ownOut').textContent = '';
    let lat;
    if (!S.lattice) lat = t('paths.lat.off');
    else if (m.id !== 'l1' && m.id !== 'linf') lat = t('paths.lat.l2');
    else {
      const ix = (B.x - A.x) / S.h, iy = (B.y - A.y) / S.h;
      if (Math.abs(ix - Math.round(ix)) > 1e-6 || Math.abs(iy - Math.round(iy)) > 1e-6) lat = t('paths.lat.na');
      else {
        const n = PA.latticeCount(m.id, ix, iy);
        lat = n === null ? t('paths.lat.na') : `<b>${n.toLocaleString(S.lang)}</b> (Δx = ${Math.round(Math.abs(ix))}, Δy = ${Math.round(Math.abs(iy))})`;
      }
    }
    $('#latOut').innerHTML = lat;
  }
  function updateLoci() {
    const L = S.loci, c = locusCtx(), ty = L.type;
    $('#lRv').textContent = fmt(L.r, 2); $('#lEv').textContent = fmt(L.e, 2); $('#lFv').textContent = fmt(L.f, 2);
    const rng = LO.constructionRange(ty, c), tt = $('#lT');
    tt.min = rng[0]; tt.max = rng[1];
    if (L.t < rng[0] || L.t > rng[1]) { L.t = Math.min(Math.max(L.t, rng[0]), rng[1]); }
    tt.value = L.t; $('#lTv').textContent = fmt(L.t, 2);
    $('#rowT').style.opacity = L.construct && ty !== 'circle' ? 1 : 0.45;
    const d = testPoint();
    $('#testOut').innerHTML = d.rows.map(r => `${r[0]} = <b>${fmt(r[1])}</b>`).join('<br>') + '<br>' +
      (d.on ? `<span class="ok">${t('loci.test.yes')}</span>` : `<span class="no">${t('loci.test.no')}</span>`);
    const notes = [];
    if (S.metric === 'disc') notes.push(t('loci.note.disc'));
    if (S.lattice) notes.push(S.locusLat && S.locusLat.zoom ? t('loci.note.zoom') : t('loci.note.lattice'));
    else if (S.locusRegion) notes.push(t('loci.note.region'));
    if (S.metric !== 'l2') notes.push(t('loci.note.name'));
    if (ty === 'circle' && L.construct) notes.push(t('loci.construct.none'));
    $('#locusNote').textContent = notes.join(' ');
  }

  /* ---------- interazione ---------- */
  const pointers = new Map();
  let drag = null, pinch = null;
  const evPos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function hit(px, py) {
    let best = null, bd = 26;
    for (const h of handles()) {
      const q = toPx(h.p), d = Math.hypot(q[0] - px, q[1] - py);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const pos = evPos(e); pointers.set(e.pointerId, pos);
    if (pointers.size === 1) {
      const h = hit(pos.x, pos.y);
      if (h && h.o && h.o.id !== SC.sel) { SC.sel = h.o.id; SC.lastMetric = h.o.metric; syncUI(); }
      drag = h ? { kind: 'pt', obj: h.p, moved: false } : { kind: 'pan', sx: pos.x, sy: pos.y, cx: S.view.cx, cy: S.view.cy, moved: false };
      S.dragging = true; cv.style.cursor = h ? 'grabbing' : 'move';
    } else if (pointers.size === 2) {
      const ps = [...pointers.values()];
      pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), s: S.view.s, mx: (ps[0].x + ps[1].x) / 2, my: (ps[0].y + ps[1].y) / 2 };
      drag = null;
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const pos = evPos(e); pointers.set(e.pointerId, pos);
    if (pointers.size === 2 && pinch) {
      const ps = [...pointers.values()], d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      zoomAt(pinch.mx, pinch.my, Math.min(Math.max(pinch.s * d / pinch.d, 8), 400));
      return;
    }
    if (!drag) return;
    if (drag.kind === 'pt') { const w = toW(pos.x, pos.y); drag.obj.x = snapV(w.x); drag.obj.y = snapV(w.y); drag.moved = true; }
    else {
      if (Math.abs(pos.x - drag.sx) + Math.abs(pos.y - drag.sy) > 5) drag.moved = true;
      if (drag.moved) { S.view.cx = drag.cx + pos.x - drag.sx; S.view.cy = drag.cy + pos.y - drag.sy; }
    }
    dirty();
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      if (drag && drag.moved && S.tab === 'scene' && drag.kind === 'pt') commit();
      if (drag && drag.kind === 'pan' && !drag.moved && MODES[S.tab] && MODES[S.tab].tap) { const w = toW(drag.sx, drag.sy); MODES[S.tab].tap(api, w.x, w.y); }
      drag = null; S.dragging = false; cv.style.cursor = 'crosshair'; dirty(); }
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  function zoomAt(px, py, ns) {
    const w = toW(px, py); S.view.s = ns;
    S.view.cx = px - w.x * ns; S.view.cy = py + w.y * ns; dirty();
  }
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const pos = evPos(e);
    zoomAt(pos.x, pos.y, Math.min(Math.max(S.view.s * Math.pow(1.0015, -e.deltaY), 8), 400));
  }, { passive: false });

  function resnap() { const ps = [S.A, S.B, S.P, S.C, S.D].concat(S.paths.verts);
    for (const o of SC.objs) ps.push(o.A, o.B, o.C, o.D);
    ps.push(S.H, ...S.pred.pts, ...S.vor.sites);
    for (const k of ['X', 'Y']) ps.push(S.sets[k].p, S.sets[k].q);
    for (const p of ps) { p.x = snapV(p.x); p.y = snapV(p.y); } }

  /* ---------- eventi dei controlli ---------- */
  function wire() {
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.tab; syncUI(); dirty(); }));
    $('#gridBtn').addEventListener('click', () => { S.grid = !S.grid; syncUI(); dirty(); toast(t(S.grid ? 'tg.grid.on' : 'tg.grid.off')); });
    $('#snapBtn').addEventListener('click', () => { S.snap = !S.snap; if (S.snap) resnap(); syncUI(); dirty(); toast(t(S.snap ? 'tg.snap.on' : 'tg.snap.off')); });
    $('#latBtn').addEventListener('click', () => { S.lattice = !S.lattice; if (S.lattice) { S.snap = true; resnap(); } syncUI(); dirty(); toast(t(S.lattice ? 'tg.lat.on' : 'tg.lat.off')); });
    $('#diceBtn').addEventListener('click', () => {
      if (!diceUseful()) { toast(t('tg.dice.unique')); return; }
      if (S.tab === 'paths') { S.paths.seed = (S.paths.seed * 1664525 + 1013904223) >>> 0; S.paths.family = true; $('#pFamily').checked = true; }
      else S.seed = (S.seed * 1664525 + 1013904223) >>> 0;
      dirty(); toast(t('tg.dice.new'));
    });
    $('#stepSel').addEventListener('change', e => { S.h = parseFloat(e.target.value); if (S.snap) resnap(); dirty(); });
    $('#centerBtn').addEventListener('click', () => { S.view.s = S.view.s0; S.view.cx = W / 2; S.view.cy = H / 2; dirty(); toast(t('tg.center')); });
    $('#pRegion').addEventListener('change', e => { S.paths.region = e.target.checked; dirty(); });
    $('#pExtremes').addEventListener('change', e => { S.paths.extremes = e.target.checked; dirty(); });
    $('#pFamily').addEventListener('change', e => { S.paths.family = e.target.checked; dirty(); });
    $('#pK').addEventListener('input', e => { S.paths.k = parseInt(e.target.value, 10); dirty(); });
    $('#pSeed').addEventListener('click', () => { S.paths.seed = (S.paths.seed * 1664525 + 1013904223) >>> 0; S.paths.family = true; $('#pFamily').checked = true; dirty(); });
    $('#pStair').addEventListener('input', e => { S.paths.stair = parseInt(e.target.value, 10); dirty(); });
    $('#pProbe').addEventListener('change', e => { S.paths.probe = e.target.checked; dirty(); });
    $('#pOwn').addEventListener('change', e => {
      S.paths.own = e.target.checked;
      if (S.paths.own && !S.paths.verts.length) S.paths.verts.push({ x: snapV(S.B.x), y: snapV(S.A.y) });
      syncUI(); dirty();
    });
    $('#ownAdd').addEventListener('click', () => {
      const v = S.paths.verts, last = v.length ? v[v.length - 1] : S.A;
      v.push({ x: snapV((last.x + S.B.x) / 2 + 0.5), y: snapV((last.y + S.B.y) / 2 - 0.5) }); dirty();
    });
    $('#ownDel').addEventListener('click', () => { S.paths.verts.pop(); dirty(); });
    $('#ownReset').addEventListener('click', () => { S.paths.verts = [{ x: snapV(S.B.x), y: snapV(S.A.y) }]; dirty(); });
    $('#lR').addEventListener('input', e => { S.loci.r = parseFloat(e.target.value); dirty(); });
    $('#lThrough').addEventListener('click', () => {
      const m = met(), d = m.dist(S.A.x, S.A.y, S.B.x, S.B.y);
      S.loci.r = Math.min(14, Math.max(0.25, Math.round(d * 4) / 4)); $('#lR').value = S.loci.r; dirty();
    });
    $('#lE').addEventListener('input', e => { S.loci.e = parseFloat(e.target.value); dirty(); });
    $('#lF').addEventListener('input', e => { S.loci.f = parseFloat(e.target.value); dirty(); });
    $('#lConstruct').addEventListener('change', e => { S.loci.construct = e.target.checked; dirty(); });
    $('#lT').addEventListener('input', e => { S.loci.t = parseFloat(e.target.value); S.loci.construct = true; $('#lConstruct').checked = true; dirty(); });
    $('#lPlay').addEventListener('click', () => {
      S.loci.play = !S.loci.play;
      if (S.loci.play) { S.loci.construct = true; $('#lConstruct').checked = true; S.last = 0; requestAnimationFrame(tick); }
      syncUI();
    });

    const sl = (id, key) => {
      $(id).addEventListener('input', e => { const o = selObj(); if (!o) return; o[key] = parseFloat(e.target.value); dirty(); });
      $(id).addEventListener('change', () => { if (selObj()) commit(); });
    };
    sl('#sR', 'r'); sl('#sE', 'e'); sl('#sF', 'f');
    $('#sInter').addEventListener('change', e => { SC.inter = e.target.checked; dirty(); });
    $('#undoBtn').addEventListener('click', undo); $('#redoBtn').addEventListener('click', redo);
    $('#presetSel').addEventListener('change', e => {
      const id = e.target.value; if (id && loadPreset(id)) { try { history.replaceState(null, '', '#' + id); } catch (er) { /* senza cronologia la pagina funziona lo stesso */ } }
      e.target.value = ''; dirty();
    });
    $('#dupBtn').addEventListener('click', () => {
      const o = selObj(); if (!o) return;
      const order = ['l1', 'l2', 'linf', 'lp'], n = clone(o); n.id = SC.next++;
      n.metric = order[(Math.max(0, order.indexOf(o.metric)) + 1) % order.length];
      SC.objs.push(n); SC.sel = n.id; SC.lastMetric = n.metric; commit(); dirty();
    });
    $('#dupAllBtn').addEventListener('click', () => {
      const o = selObj(); if (!o) return;
      let last = null;
      for (const id of ['l1', 'l2', 'linf']) if (id !== o.metric) { const n = clone(o); n.id = SC.next++; n.metric = id; SC.objs.push(n); last = n; }
      if (last) { SC.sel = last.id; SC.lastMetric = last.metric; }
      commit(); dirty();
    });
    $('#svgBtn').addEventListener('click', () => { $('#svgText').value = buildSVG(); $('#dlgSvg').showModal(); $('#svgText').select(); });
    $('#svgClose').addEventListener('click', () => $('#dlgSvg').close());
    $('#svgCopy').addEventListener('click', () => {
      const ta = $('#svgText'); ta.select();
      const ok = () => toast(t('sc.copied'));
      try { navigator.clipboard.writeText(ta.value).then(ok, () => { try { document.execCommand('copy'); ok(); } catch (e) { /* resta selezionato */ } }); }
      catch (e) { try { document.execCommand('copy'); ok(); } catch (e2) { /* resta selezionato */ } }
    });
    $('#themeBtn').addEventListener('click', () => {
      const cur = S.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      S.theme = cur === 'dark' ? 'light' : 'dark'; applyTheme(); store.set('metric-lab.theme', S.theme);
    });
    $('#langBtn').addEventListener('click', () => { S.lang = S.lang === 'it' ? 'en' : 'it'; store.set('metric-lab.lang', S.lang); applyI18n(); syncUI(); });
    new ResizeObserver(resize).observe($('#view'));
  }
  function tick(ts) {
    if (!S.loci.play) return;
    const dt = S.last ? Math.min((ts - S.last) / 1000, 0.1) : 0; S.last = ts;
    const rng = LO.constructionRange(S.loci.type, locusCtx());
    let v = S.loci.t + dt * 2;
    if (v > rng[1] || v < rng[0]) v = rng[0];
    S.loci.t = v; dirty();
    requestAnimationFrame(tick);
  }
  function applyTheme() {
    if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
    readColors(); dirty();
  }

  /* ---------- interfaccia per le schede aggiuntive (modes.js) ---------- */
  const api = {
    S, FD, PA, LO, IDS, t, fmt, $, mk, met, toPx, toW, snapV, polyline, label, dot, strokeSegs, fillShapes, drawFields, cellSize,
    dirty: () => dirty(), syncUI: () => syncUI(),
    get ctx() { return ctx; }, get C() { return C; }, get W() { return W; }, get H() { return H; }
  };

  /* ---------- avvio ---------- */
  function init() {
    const sl = store.get('metric-lab.lang'); S.lang = sl || ((navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en');
    const st = store.get('metric-lab.theme'); if (st === 'light' || st === 'dark') S.theme = st;
    if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
    for (const k in MODES) MODES[k].init(S);
    readColors(); buildPControl(); wire(); for (const k in MODES) MODES[k].wire(api); applyI18n(); resize();
    const hs = (location.hash || '').slice(1);
    if (!hs || !loadPreset(hs)) { loadPreset('balls'); }
    if (hs && PRESETS.some(p => p[0] === hs)) S.tab = 'scene';
    syncUI();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); dirty(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => dirty());
  }
  init();
})();
