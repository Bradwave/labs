/* xrpanel.js — Force Lab XR: pannelli disegnati su canvas (stile DESIGN.md §17: schede piatte, bordi d'inchiostro 2 px,
   ombra dura, Space Mono, pulsanti accento; bersagli ≥ 4 cm). Logica pura: layout (rettangoli in pixel), hit-test, raggio,
   "poke" col dito indice; il disegno usa un contesto 2D. Stesse convenzioni di xrpanel.js di Orbit Lab XR e panel.js di Surface Lab XR:
   coordinate locali del pannello in metri, x a destra, y in alto, z verso l'utente; MPP = metri per pixel. */
(function (root) {
  'use strict';

  const MPP = 0.0006;                                   // 68 px ≈ 4,1 cm
  const ARM = 0.012, BACK = 0.03, HOVER = 0.05;        // poke (m, mondo)
  const B = (id, x, y, w, h, label, o) => Object.assign({ id: id, kind: 'btn', x: x, y: y, w: w, h: h, label: label }, o || {});
  const T = (id, x, y, w, h, label, o) => Object.assign({ id: id, kind: 'text', x: x, y: y, w: w, h: h, label: label }, o || {});
  function row(items, x, y, w, h, gap) {
    gap = gap === undefined ? 10 : gap;
    const n = items.length, bw = (w - gap * (n - 1)) / n;
    return items.map((it, i) => B(it[0], Math.round(x + i * (bw + gap)), y, Math.round(bw), h, it[1], it[2]));
  }
  const num = (v, d, lang) => { const s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); return lang === 'it' ? s.replace('.', ',') : s; };
  const L = (o, lang) => (o && (o[lang] || o.en)) || '';

  // ---------- pannello delle opzioni ----------
  // s: { t, lang, opt: {vec:{v,a,F}, each, split, strobe, predict, slow, snap, g, mass}, sandbox, xr }
  function buildOptions(s) {
    const t = s.t, o = s.opt, it = [], W = 640, X = 36, IW = 568;
    'force'.split('').forEach((c, i) => it.push({ id: 'tile' + i, kind: 'tile', x: X + i * 46, y: 34, w: 50, h: 50, label: c, tone: ['p', 'a', 'p', 'b', 'k'][i] }));
    if (s.xr) it.push(B('close', W - X - 76, 26, 76, 68, '', { icon: 'close', tip: t('x.close') }));
    let y = 116;
    const label = (id, key) => { it.push(T(id, X, y, IW, 30, t(key), { small: true, bold: true })); y += 36; };
    label('l-arrows', 'x.arrows');
    it.push.apply(it, row([['vec:v', 'v', { toggle: true, on: o.vec.v, swatch: 'vel' }], ['vec:a', 'a', { toggle: true, on: o.vec.a, swatch: 'acc' }], ['vec:F', 'F', { toggle: true, on: o.vec.F, swatch: 'force' }]], X, y, IW, 68));
    y += 80;
    it.push.apply(it, row([['each', t(o.each ? 'x.forces.each' : 'x.forces.net'), { toggle: true, on: o.each }], ['split', t('x.split'), { toggle: true, on: o.split }]], X, y, IW, 68));
    y += 80;
    it.push.apply(it, row([['strobe', t('x.strobe'), { toggle: true, on: o.strobe }], ['snap', t('x.snap'), { toggle: true, on: o.snap }]], X, y, IW, 68));
    y += 88;
    label('l-pred', 'x.predict');
    it.push.apply(it, row(['auto', 'always', 'never'].map(k => ['pred:' + k, t('x.predict.' + k), { on: o.predict === k }]), X, y, IW, 68));
    y += 88;
    label('l-slow', 'x.slow');
    it.push.apply(it, row([1, 0.5, 0.25].map(k => ['slow:' + k, num(k, k === 1 ? 0 : k === 0.5 ? 1 : 2, s.lang) + '×', { on: o.slow === k }]), X, y, IW, 68));
    y += 88;
    if (s.sandbox) {
      label('l-g', 'x.gravity');
      it.push.apply(it, row([[0, t('x.g.off')], [1, t('x.g.low')], [9.8, t('x.g.earth')]].map(k => ['g:' + k[0], k[1], { on: o.g === k[0] }]), X, y, IW, 68));
      y += 88;
      label('l-m', 'x.mass');
      it.push.apply(it, row([0.25, 0.5, 1].map(m => ['mass:' + m, num(m, m === 0.25 ? 2 : 1, s.lang) + ' kg', { on: o.mass === m }]), X, y, IW, 68));
      y += 88;
    }
    label('l-lang', 'x.lang');
    it.push.apply(it, row([['lang:it', 'IT', { on: s.lang === 'it' }], ['lang:en', 'EN', { on: s.lang === 'en' }]], X, y, IW, 68));
    y += 92;
    it.push.apply(it, row([['clearZones', t('x.clearZones'), { icon: 'trash' }], ['homeStage', t('x.homeStage'), { icon: 'target' }]], X, y, IW, 68));
    y += 80;
    if (s.xr) { it.push(B('exit', X, y, IW, 68, t('x.exit'), { icon: 'exit', primary: true })); y += 80; }
    return { W: W, H: y + 30, MPP: MPP, frame: 0, items: it };
  }

  // ---------- quadro (HUD) sulla pista ----------
  // s: { t, lang, track, run: {state, time, next, total, result}, v, a, F, best, msg }
  function buildHud(s) {
    const t = s.t, it = [], W = 600, X = 30, IW = 540, tr = s.track;
    it.push(T('name', X, 26, IW, 40, (tr.sandbox ? '' : tr.n + ' · ') + L(tr.name, s.lang), { bold: true, px: 30 }));
    it.push(T('msg', X, 72, IW, 34, s.msg || '', { small: true, color: s.msgColor }));
    if (!tr.sandbox) {
      it.push(T('time', X, 112, 260, 70, 't = ' + num(s.run.time, 2, s.lang) + ' s', { bold: true, px: 40 }));
      it.push(T('gates', X + 280, 112, 260, 70, t('x.gates') + ' ' + s.run.next + '/' + s.run.total, { bold: true, px: 30, right: true }));
    }
    const y = tr.sandbox ? 116 : 196;
    it.push(T('v', X, y, 176, 40, '|v| ' + num(s.v, 2, s.lang), { bold: true, color: 'vel', px: 25 }));
    it.push(T('a', X + 182, y, 176, 40, '|a| ' + num(s.a, 2, s.lang), { bold: true, color: 'acc', px: 25 }));
    it.push(T('F', X + 364, y, 176, 40, '|F| ' + num(s.F, 2, s.lang), { bold: true, color: 'force', px: 25 }));
    it.push(T('units', X, y + 40, IW, 28, 'm/s · m/s² · N   (m = ' + num(s.mass, 2, s.lang) + ' kg' + (s.g ? ', g = ' + num(s.g, 1, s.lang) + ' m/s²' : '') + ')', { small: true, px: 18 }));
    if (!tr.sandbox) {
      const md = tr.medals;
      it.push(T('medals', X, y + 74, IW, 30, '🥇 ' + num(md[0], 1, s.lang) + '  🥈 ' + num(md[1], 1, s.lang) + '  🥉 ' + num(md[2], 1, s.lang) + ' s' + (s.best != null ? '   · ' + t('x.best') + ' ' + num(s.best, 2, s.lang) : ''), { small: true, px: 19 }));
    }
    return { W: W, H: (tr.sandbox ? 200 : 316), MPP: MPP, frame: 0, items: it };
  }

  // ---------- scheda della galleria (controller o palmo) ----------
  // s: { t, lang, track, index, count, best, medal, palm }
  function buildGallery(s) {
    const t = s.t, it = [], W = 560, X = 24, IW = 512, tr = s.track;
    it.push(B('gprev', X, 24, 80, 80, '', { icon: 'prev', tip: t('x.prev') }));
    it.push(B('gnext', W - X - 80, 24, 80, 80, '', { icon: 'next', tip: t('x.next') }));
    it.push(T('gname', X + 92, 30, IW - 184, 40, L(tr.name, s.lang), { bold: true, center: true, px: 28 }));
    it.push(T('gnum', X + 92, 70, IW - 184, 28, tr.sandbox ? '' : s.index + ' / ' + s.count, { small: true, centerSmall: true }));
    it.push(T('gidea', X, 118, IW, 96, L(tr.idea, s.lang), { wrap: true, px: 21 }));
    const tools = tr.sandbox ? '' : [tr.maxZones ? t('x.tool.zones', { n: tr.maxZones }) : t('x.tool.nozones'), tr.band ? t('x.tool.band') : '', tr.g ? 'g = ' + num(tr.g, 0, s.lang) + ' m/s²' : '', tr.timeLimit ? '≤ ' + num(tr.timeLimit, 0, s.lang) + ' s' : ''].filter(Boolean).join(' · ');
    it.push(T('gtools', X, 222, IW, 30, tools, { small: true, px: 19 }));
    it.push(T('gbest', X, 254, IW, 30, s.best != null ? t('x.best') + ' ' + num(s.best, 2, s.lang) + ' s  ' + ['', '🥉', '🥈', '🥇'][s.medal || 0] : '', { small: true, px: 19 }));
    let y = 296;
    it.push(B('gplay', X, y, IW, 72, t('x.play'), { primary: true, icon: 'play' }));
    y += 84;
    if (s.palm) {
      it.push.apply(it, row([['retry', t('x.retry'), { icon: 'reset' }], ['addZone', t('x.addZone'), { icon: 'plus', off: !s.canAdd }], ['options', '', { icon: 'gear', tip: t('x.options') }]], X, y, IW, 72));
      y += 84;
    }
    return { W: W, H: y + 12, MPP: MPP, frame: 0, items: it };
  }

  // ---------- menu rapido di una zona ----------
  function buildZoneMenu(s) {
    const t = s.t, it = [], W = 460, X = 24, IW = 412;
    it.push(T('ztitle', X, 22, IW - 90, 40, t('x.zone') + ' · ' + num(s.F, 2, s.lang) + ' N', { bold: true, px: 26 }));
    it.push(B('zclose', W - X - 72, 16, 72, 68, '', { icon: 'close' }));
    let y = 96;
    it.push.apply(it, row([['zdel', t('x.zdel'), { icon: 'trash' }], ['zdup', t('x.zdup'), { icon: 'plus', off: !s.canAdd }]], X, y, IW, 72)); y += 84;
    it.push.apply(it, row([['zzero', '0 N'], ['zsnap', t('x.snap'), { toggle: true, on: s.snap }]], X, y, IW, 72)); y += 84;
    return { W: W, H: y + 14, MPP: MPP, frame: 0, items: it };
  }

  // ---------- hit-test e geometria ----------
  const toPx = (lx, ly, Lo) => [lx / Lo.MPP + Lo.W / 2, Lo.H / 2 - ly / Lo.MPP];
  function hit(layout, lx, ly, kinds) {
    const p = toPx(lx, ly, layout);
    for (let i = layout.items.length - 1; i >= 0; i--) {
      const it = layout.items[i];
      if (it.hidden || (kinds && kinds.indexOf(it.kind) < 0)) continue;
      if (p[0] >= it.x && p[0] <= it.x + it.w && p[1] >= it.y && p[1] <= it.y + it.h) return it;
    }
    return null;
  }
  function inside(layout, lx, ly, margin) {
    const p = toPx(lx, ly, layout), m = (margin || 0) / layout.MPP;
    return p[0] >= -m && p[0] <= layout.W + m && p[1] >= -m && p[1] <= layout.H + m;
  }
  function toLocal(m, x, y, z, w) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];
  }
  // inv = inversa della matrice mondiale del pannello (elementi THREE, per colonne); o, d = raggio nel mondo
  function rayHit(inv, o, d) {
    const lo = toLocal(inv, o[0], o[1], o[2], 1), ld = toLocal(inv, d[0], d[1], d[2], 0);
    if (Math.abs(ld[2]) < 1e-9) return null;
    const t = -lo[2] / ld[2];
    if (t <= 0) return null;
    return { x: lo[0] + ld[0] * t, y: lo[1] + ld[1] * t, t: t };
  }
  // Poke: il dito preme attraversando il piano da davanti dentro un pulsante (si arma oltre ARM); la pinza lo disattiva.
  function Poke() { this.s = {}; }
  Poke.prototype.update = function (id, p, pinching, layout, scale) {
    const st = this.s[id] || (this.s[id] = { armed: false });
    const zw = p.z * scale;
    if (pinching) { st.armed = false; return { press: null, hover: null }; }
    const it = hit(layout, p.x, p.y, ['btn']);
    let press = null;
    if (zw > ARM) st.armed = true;
    if (zw <= 0) { if (st.armed && it && zw > -BACK && !it.off) press = it.id; st.armed = false; }
    return { press: press, hover: it && zw > -BACK && zw < HOVER ? it.id : null };
  };
  Poke.prototype.reset = function () { this.s = {}; };

  // ---------- disegno ----------
  const FONT = '"Space Mono", ui-monospace, Menlo, Consolas, monospace';
  const font = (px, bold) => (bold ? '700 ' : '400 ') + px + 'px ' + FONT;
  function glyph(c, name, cx, cy, sz, color) {
    c.save(); c.translate(cx, cy); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = Math.max(3, sz * 0.14); c.lineCap = 'round'; c.lineJoin = 'round';
    const h = sz / 2;
    c.beginPath();
    switch (name) {
      case 'play': c.moveTo(-h * 0.6, -h); c.lineTo(h * 0.9, 0); c.lineTo(-h * 0.6, h); c.closePath(); c.fill(); break;
      case 'prev': c.moveTo(h * 0.5, -h); c.lineTo(-h * 0.6, 0); c.lineTo(h * 0.5, h); c.stroke(); break;
      case 'next': c.moveTo(-h * 0.5, -h); c.lineTo(h * 0.6, 0); c.lineTo(-h * 0.5, h); c.stroke(); break;
      case 'reset': c.arc(0, 0, h * 0.8, -Math.PI * 0.35, Math.PI * 1.3); c.stroke(); c.beginPath(); c.moveTo(h * 0.95, -h * 1.05); c.lineTo(h * 0.8, -h * 0.25); c.lineTo(h * 0.05, -h * 0.65); c.closePath(); c.fill(); break;
      case 'close': c.moveTo(-h * 0.7, -h * 0.7); c.lineTo(h * 0.7, h * 0.7); c.moveTo(h * 0.7, -h * 0.7); c.lineTo(-h * 0.7, h * 0.7); c.stroke(); break;
      case 'plus': c.moveTo(-h * 0.8, 0); c.lineTo(h * 0.8, 0); c.moveTo(0, -h * 0.8); c.lineTo(0, h * 0.8); c.stroke(); break;
      case 'trash': c.moveTo(-h * 0.8, -h * 0.55); c.lineTo(h * 0.8, -h * 0.55); c.moveTo(-h * 0.25, -h * 0.55); c.lineTo(-h * 0.25, -h * 0.85); c.lineTo(h * 0.25, -h * 0.85); c.lineTo(h * 0.25, -h * 0.55);
        c.moveTo(-h * 0.6, -h * 0.4); c.lineTo(-h * 0.45, h * 0.9); c.lineTo(h * 0.45, h * 0.9); c.lineTo(h * 0.6, -h * 0.4); c.stroke(); break;
      case 'exit': c.moveTo(-h * 0.2, -h * 0.9); c.lineTo(-h * 0.9, -h * 0.9); c.lineTo(-h * 0.9, h * 0.9); c.lineTo(-h * 0.2, h * 0.9); c.moveTo(-h * 0.3, 0); c.lineTo(h * 0.9, 0); c.moveTo(h * 0.3, -h * 0.5); c.lineTo(h * 0.9, 0); c.lineTo(h * 0.3, h * 0.5); c.stroke(); break;
      case 'target': c.arc(0, 0, h * 0.7, 0, Math.PI * 2); c.moveTo(-h, 0); c.lineTo(-h * 0.4, 0); c.moveTo(h * 0.4, 0); c.lineTo(h, 0); c.moveTo(0, -h); c.lineTo(0, -h * 0.4); c.moveTo(0, h * 0.4); c.lineTo(0, h); c.stroke(); break;
      case 'gear': c.arc(0, 0, h * 0.42, 0, Math.PI * 2); c.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(Math.cos(a) * h * 0.62, Math.sin(a) * h * 0.62); c.lineTo(Math.cos(a) * h * 0.95, Math.sin(a) * h * 0.95); } c.stroke(); break;
      default: break;
    }
    c.restore();
  }
  function fit(c, text, maxW, px, bold) { let s = px; c.font = font(s, bold); while (s > 12 && c.measureText(text).width > maxW) { s -= 1; c.font = font(s, bold); } return s; }
  function wrapLines(c, text, maxW) {
    const out = [];
    String(text).split('\n').forEach(par => {
      let line = '';
      par.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
      out.push(line);
    });
    return out;
  }

  // C = colori ({surface, ink, muted, accent, onaccent, tile2, vel, acc, force}); hover = id sotto il dito/raggio; flash = id appena premuto
  function draw(c, layout, hover, flash, C, card) {
    const w = layout.W, h = layout.H;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    if (card !== false) { // scheda: superficie, bordo d'inchiostro, ombra dura (in basso a destra, dentro il canvas)
      c.fillStyle = C.ink; c.fillRect(10, 10, w - 10, h - 10);
      c.fillStyle = C.surface; c.fillRect(0, 0, w - 10, h - 10);
      c.strokeStyle = C.ink; c.lineWidth = 4; c.strokeRect(2, 2, w - 14, h - 14);
    }
    const dark = C.tile2Ink || '#062A30';
    const tileCol = { k: [C.ink, C.surface], a: [C.accent, C.onaccent], p: [C.surface, C.ink], b: [C.tile2, dark] };
    for (const it of layout.items) {
      if (it.hidden) continue;
      if (it.kind === 'tile') {
        const col = tileCol[it.tone];
        c.fillStyle = col[0]; c.fillRect(it.x, it.y, it.w, it.h); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(it.x, it.y, it.w, it.h);
        c.fillStyle = col[1]; c.font = font(32, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.label, it.x + it.w / 2, it.y + it.h / 2 + 2);
      } else if (it.kind === 'text') {
        const px = it.px || (it.small ? 21 : 25);
        c.fillStyle = it.color ? (C[it.color] || it.color) : (it.small ? C.muted : C.ink);
        if (it.wrap) {
          c.font = font(px, it.bold); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
          let y = it.y + px + 2;
          wrapLines(c, it.label, it.w).forEach(l => { c.fillText(l, it.x, y); y += px + 7; });
        } else {
          const s = fit(c, it.label, it.w, px, it.bold);
          c.font = font(s, it.bold); c.textBaseline = 'middle';
          c.textAlign = it.center || it.centerSmall ? 'center' : it.right ? 'right' : 'left';
          c.fillText(it.label, it.center || it.centerSmall ? it.x + it.w / 2 : it.right ? it.x + it.w : it.x, it.y + it.h / 2);
        }
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      } else if (it.kind === 'btn') {
        const hv = hover === it.id && !it.off, dx = flash === it.id ? 4 : 0;
        let bg = C.surface, fg = C.ink;
        if (it.primary) { bg = C.accent; fg = C.onaccent; }
        if (it.on && !it.toggle) { bg = C.ink; fg = C.surface; }
        if (hv && !(it.on && !it.toggle)) { bg = C.tile2; fg = dark; }
        c.save(); c.globalAlpha = it.off ? 0.4 : 1;
        if (!dx) { c.fillStyle = C.ink; c.fillRect(it.x + 4, it.y + 4, it.w, it.h); }
        c.fillStyle = bg; c.fillRect(it.x + dx, it.y + dx, it.w, it.h); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(it.x + dx, it.y + dx, it.w, it.h);
        const cy = it.y + dx + it.h / 2;
        let lx = it.x + dx + 14, rw = 14;
        if (it.swatch) { c.fillStyle = C[it.swatch] || C.ink; c.fillRect(lx, cy - 10, 20, 20); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(lx, cy - 10, 20, 20); lx += 30; }
        if (it.toggle) { const bx = it.x + dx + it.w - 56, by = cy - 13; c.strokeStyle = fg; c.lineWidth = 3; c.strokeRect(bx, by, 42, 26); c.fillStyle = it.on ? C.accent : fg; c.fillRect(it.on ? bx + 22 : bx + 4, by + 4, 16, 18); rw = 64; }
        if (it.icon && !it.label) glyph(c, it.icon, it.x + dx + it.w / 2, cy, Math.min(it.w, it.h) * 0.5, fg);
        else {
          if (it.icon) { glyph(c, it.icon, lx + it.h * 0.25, cy, it.h * 0.4, fg); lx += it.h * 0.55; }
          c.fillStyle = fg; const s = fit(c, it.label, Math.max(30, it.x + dx + it.w - rw - lx), 24, true);
          c.font = font(s, true); c.textBaseline = 'middle';
          if (it.toggle || it.swatch || it.icon) { c.textAlign = 'left'; c.fillText(it.label, lx, cy + 1); }
          else { c.textAlign = 'center'; c.fillText(it.label, it.x + dx + it.w / 2, cy + 1); }
          c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        }
        c.restore();
      }
    }
  }

  const api = { MPP: MPP, buildOptions: buildOptions, buildHud: buildHud, buildGallery: buildGallery, buildZoneMenu: buildZoneMenu,
    hit: hit, inside: inside, rayHit: rayHit, toPx: toPx, Poke: Poke, draw: draw, glyph: glyph, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XRPanel = api;
})(typeof window !== 'undefined' ? window : globalThis);
