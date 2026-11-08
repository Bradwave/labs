/* xrpanel.js — pannello flottante di controllo per la VR/AR, nello stile di Orbit Lab (tessere, bordi d'inchiostro, ombre dure).
   Logica pura (nessun THREE, nessun DOM): `build(s)` costruisce il layout (rettangoli in pixel) dallo stato `s`, poi hit-test,
   cornice afferrabile, raggio, "poke" col dito indice e disegno su un canvas 2D. Coordinate locali del pannello in metri:
   x a destra, y in alto, z uscente verso l'utente. Stesse convenzioni di panel.js di Superfici 3D. Testabile in Node. */
(function (root) {
  'use strict';

  const W = 640, H = 784, MPP = 0.0005, FR = 28;      // 0,32 × 0,392 m; cornice di 28 px = 1,4 cm
  const ARM = 0.012, BACK = 0.03, HOVER = 0.05;       // distanze MONDIALI (m) del poke, come in Superfici 3D
  const FAB = { W: 220, H: 96, MPP: MPP, frame: 0, items: [{ id: 'menu', kind: 'btn', x: 8, y: 8, w: 196, h: 72, label: 'Menu', icon: 'menu' }] };

  const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
  const TABS = [['launch', 'Launch'], ['fly', 'Fly'], ['show', 'Show'], ['goals', 'Goals'], ['setup', 'Setup']];
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
  const spdText = v => v === 0.25 ? '¼×' : v === 0.5 ? '½×' : v + '×';

  const B = (id, x, y, w, h, label, o) => Object.assign({ id: id, kind: 'btn', x: x, y: y, w: w, h: h, label: label }, o || {});
  const T = (id, x, y, w, h, label, o) => Object.assign({ id: id, kind: 'text', x: x, y: y, w: w, h: h, label: label }, o || {});

  // riga di n pulsanti uguali dentro [x, x+w]
  function row(items, x, y, w, h, gap) {
    gap = gap === undefined ? 8 : gap;
    const n = items.length, bw = (w - gap * (n - 1)) / n;
    return items.map((it, i) => B(it[0], Math.round(x + i * (bw + gap)), y, Math.round(bw), h, it[1], it[2]));
  }

  // ---------- layout ----------
  // s: { tab, phase, playing, speed, scrub (0..1), tLabel, view ('ship'|'planet'), xr ('immersive-vr'|'immersive-ar'|null), faceMe,
  //      h, v, ang, vc, vesc, hNote, tl, dvStep, dvUsed, budget, show{}, scale, level, ovr, feat(name), planet, mission{...}, hint }
  function build(s) {
    const it = [];
    // intestazione: tessere della parola ORBIT + pulsanti
    'orbit'.split('').forEach((c, i) => it.push({ id: 'tile' + i, kind: 'tile', x: 40 + i * 42, y: 40, w: 46, h: 46, label: c, tone: ['k', 'a', 'p', 'b', 'p'][i] }));
    it.push(B('view', 392, 36, 60, 60, '', { icon: s.view === 'ship' ? 'planet' : 'ship', tip: s.view === 'ship' ? 'Planet view: see the orbit from outside' : 'Ship view: first person from the cockpit' }));
    it.push(B('exit', 464, 36, 60, 60, '', { icon: 'exit', tip: s.xr ? 'Leave the session' : 'Not in a headset session', off: !s.xr }));
    it.push(B('hide', 536, 36, 60, 60, '', { icon: 'close', tip: 'Hide the panel (stick press / Menu)' }));
    TABS.forEach((t, i) => it.push(B('tab:' + t[0], 40 + i * 114, 108, 104, 56, t[1], { on: s.tab === t[0], tab: true })));

    const y0 = 184;
    if (s.tab === 'launch') {
      const par = (y, name, val) => it.push(T('lab:' + name, 40, y, 560, 34, name, { value: val }));
      par(y0, 'Tower height h', f2(s.h) + ' R');
      it.push.apply(it, row([['h-', '−'], ['h=0', '0'], ['h=0.2', '0.2'], ['h=0.5', '0.5'], ['h=1', '1'], ['h+', '+']], 40, y0 + 36, 560, 56));
      par(y0 + 104, 'Launch speed', f2(s.v) + (s.feat('numbers') ? '' : ''));
      it.push.apply(it, row([['v-0.1', '−.1'], ['v-0.01', '−.01'], ['v=vc', 'v꜀'], ['v=vesc', 'vesc'], ['v+0.01', '+.01'], ['v+0.1', '+.1']], 40, y0 + 140, 560, 56));
      par(y0 + 208, 'Angle above horizontal', Math.round(s.ang) + '°');
      it.push.apply(it, row([['a-5', '−5'], ['a=0', '0°'], ['a=30', '30°'], ['a=45', '45°'], ['a=90', '90°'], ['a+5', '+5']], 40, y0 + 244, 560, 56));
      it.push(B('launch', 40, y0 + 316, 560, 64, s.phase === 'prep' ? 'Launch' : 'Relaunch', { primary: true, icon: 'rocket' }));
      (s.noteLines || []).forEach((l, i) => it.push(T('note' + i, 40, y0 + 392 + i * 26, 560, 26, typeof l === 'string' ? l : l.text, { small: true, color: l.color })));
    } else if (s.tab === 'fly') {
      const radial = s.feat('radial');
      it.push(B('thr:pro', 40, y0, 276, 96, 'Prograde', { icon: 'up', hold: true, big: true, on: s.thrHeld.pro }));
      it.push(B('thr:retro', 324, y0, 276, 96, 'Retrograde', { icon: 'down', hold: true, big: true, on: s.thrHeld.retro }));
      it.push(B('thr:out', 40, y0 + 104, 276, 96, 'Radial out', { icon: 'up', hold: true, big: true, off: !radial, tag: radial ? '' : 'L2', on: s.thrHeld.out }));
      it.push(B('thr:in', 324, y0 + 104, 276, 96, 'Radial in', { icon: 'down', hold: true, big: true, off: !radial, tag: radial ? '' : 'L2', on: s.thrHeld.in }));
      it.push(T('tlab', 40, y0 + 214, 560, 30, 'Thrust level', { value: f2(s.tl) + ' g₀' }));
      it.push.apply(it, row([['tl-', '−'], ['tl+', '+']], 40, y0 + 248, 560, 52));
      it.push(T('dlab', 40, y0 + 310, 560, 30, 'A click = a fixed Δv step', { value: String(s.dvStep) }));
      it.push.apply(it, row([0.005, 0.02, 0.05, 0.1].map(v => ['dv=' + v, String(v), { on: Math.abs(s.dvStep - v) < 1e-9 }]), 40, y0 + 344, 560, 52));
      it.push(T('used', 40, y0 + 406, 560, 28, 'Δv used', { value: f2(s.dvUsed) + (s.budget < 2 && s.feat('budget') ? ' of ' + f2(s.budget) : ''), small: true }));
    } else if (s.tab === 'show') {
      const defs = [['vel', 'Velocity', 'vel'], ['grav', 'Gravity', 'grav'], ['thr', 'Thrust', 'thr'], ['net', 'Net acc.', 'net'], ['orbit', 'Orbit', 'c-ellipse'], ['trail', 'Trail', 'muted'],
        ['ghosts', 'Ghosts', 'muted'], ['bars', 'Energy', 'kin'], ['strobe', 'Strobe', 'kin', 'kepler'], ['cam', 'Ship cam', 'vel'], ['grid', 'Grid', 'muted']];
      defs.forEach((d, i) => {
        const off = d[3] && !s.feat(d[3]);
        it.push(B('show:' + d[0], 40 + (i % 2) * 288, y0 + Math.floor(i / 2) * 56, 272, 50, d[1], { toggle: true, on: !!s.show[d[0]], swatch: d[2], off: off, tag: off ? 'L2' : '' }));
      });
      it.push(T('sclab', 40, y0 + 340, 200, 44, 'Arrow length'));
      it.push.apply(it, row([['scl:lin', 'linear', { on: s.scale === 'lin' }], ['scl:sqrt', '√', { on: s.scale === 'sqrt' }]], 240, y0 + 340, 360, 44));
      it.push(B('ghostclear', 40, y0 + 392, 560, 44, 'Clear ghost trails', { icon: 'reset' }));
    } else if (s.tab === 'goals') {
      const m = s.mission;
      if (!m.cur) {
        s.missions.forEach((mi, i) => it.push(B('mis:' + mi.id, 40, y0 + i * 70, 560, 62, mi.id + '  ' + mi.title, { tag: 'L' + mi.level + (mi.done ? ' ✓' : ''), done: mi.done, left: true })));
      } else {
        it.push(B('misback', 40, y0, 96, 52, '', { icon: 'back' }));
        it.push(T('mtitle', 148, y0 + 8, 452, 36, m.cur.title, { bold: true }));
        if (m.stage === 'predict') {
          it.push(T('mq', 40, y0 + 58, 560, 112, m.cur.q, { wrap: true, title: 'Predict', px: 22 }));
          m.cur.opts.forEach((o, i) => it.push(B('misopt:' + i, 40, y0 + 172 + i * 88, 560, 80, o, { wrap: true, left: true })));
        } else if (m.stage === 'run') {
          it.push(T('mg', 40, y0 + 58, 560, 140, 'Goal: ' + m.cur.goal, { wrap: true, bold: true, px: 22 }));
          it.push(T('mh', 40, y0 + 206, 560, 130, 'Hint: ' + m.cur.hint, { wrap: true, small: true }));
          it.push.apply(it, row([['misagain', 'Set up again', { icon: 'reset' }], ['misexplain', 'Explanation']], 40, y0 + 356, 560, 64));
        } else {
          const ok = m.choice === m.cur.correct;
          it.push(T('mr', 40, y0 + 62, 560, 78, (ok ? 'Your prediction was right. ' : 'Not quite. ') + 'Answer: ' + m.cur.opts[m.cur.correct], { wrap: true, bold: true }));
          it.push(T('me', 40, y0 + 148, 560, 190, m.cur.explain, { wrap: true, small: true }));
          it.push.apply(it, row([['misagain', 'Try again', { icon: 'reset' }], ['misback', 'All goals']], 40, y0 + 356, 560, 64));
        }
      }
    } else if (s.tab === 'setup') {
      it.push(T('lvlab', 40, y0, 560, 30, 'Level'));
      it.push.apply(it, row([1, 2, 3].map(l => ['lv:' + l, String(l), { on: s.level === l }]), 40, y0 + 34, 560, 56));
      it.push(T('lvnote', 40, y0 + 98, 560, 60, s.levelNote, { wrap: true, small: true }));
      if (s.feat('realUnits')) {
        it.push(T('pllab', 40, y0 + 166, 560, 30, 'Real planet (display only)'));
        it.push.apply(it, row(['none', 'earth', 'moon', 'mars'].map(p => ['pl:' + p, p === 'none' ? 'None' : p[0].toUpperCase() + p.slice(1), { on: s.planet === p }]), 40, y0 + 200, 560, 52));
      }
      it.push(T('vwlab', 40, y0 + 270, 560, 30, 'Placement'));
      it.push.apply(it, row([['recenter', 'Recenter', { icon: 'target' }], ['face', 'Face me', { toggle: true, on: s.faceMe }]], 40, y0 + 304, 560, 60));
      it.push(T('xrnote', 40, y0 + 376, 560, 64, s.xrNote, { wrap: true, small: true }));
    }

    // trasporto sempre visibile
    it.push(B('reset', 40, 636, 76, 60, '', { icon: 'reset', tip: 'Back to the launch' }));
    it.push(B('play', 124, 636, 132, 60, s.playing ? 'Pause' : 'Play', { primary: true, icon: s.playing ? 'pause' : 'play' }));
    it.push(B('step', 264, 636, 76, 60, '', { icon: 'step', tip: 'One small step forward' }));
    it.push(B('spd-', 356, 636, 60, 60, '−'));
    it.push(T('spd', 420, 636, 100, 60, spdText(s.speed), { center: true, bold: true }));
    it.push(B('spd+', 524, 636, 76, 60, '+'));
    it.push({ id: 'scrub', kind: 'slider', x: 40, y: 710, w: 400, h: 44, value: s.scrub });
    it.push(T('tl', 448, 710, 152, 44, s.tLabel, { small: true, right: true }));
    return { W: W, H: H, MPP: MPP, frame: FR, items: it };
  }

  // ---------- hit-test e geometria (uguali a panel.js di Superfici 3D) ----------
  const toPx = (lx, ly, Lo) => [lx / Lo.MPP + Lo.W / 2, Lo.H / 2 - ly / Lo.MPP];
  const toLocalXY = (px, py, Lo) => [(px - Lo.W / 2) * Lo.MPP, (Lo.H / 2 - py) * Lo.MPP];
  function hit(layout, lx, ly, kinds) {
    const p = toPx(lx, ly, layout);
    for (let i = layout.items.length - 1; i >= 0; i--) {
      const it = layout.items[i];
      if (it.hidden || (kinds && kinds.indexOf(it.kind) < 0)) continue;
      if (p[0] >= it.x && p[0] <= it.x + it.w && p[1] >= it.y && p[1] <= it.y + it.h) return it;
    }
    return null;
  }
  function inFrame(layout, lx, ly, margin) {
    const p = toPx(lx, ly, layout), m = (margin === undefined ? 0.02 : margin) / layout.MPP, f = layout.frame || 0;
    const inOuter = p[0] >= -m && p[0] <= layout.W + m && p[1] >= -m && p[1] <= layout.H + m;
    const inInner = p[0] > f && p[0] < layout.W - f && p[1] > f && p[1] < layout.H - f;
    return inOuter && !inInner;
  }
  function toLocal(m, x, y, z, w) { // m = inversa della matrice del pannello (colonna per colonna, come THREE)
    w = w === undefined ? 1 : w;
    return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];
  }
  function rayHit(inv, o, d) {
    const lo = toLocal(inv, o[0], o[1], o[2], 1), ld = toLocal(inv, d[0], d[1], d[2], 0);
    if (Math.abs(ld[2]) < 1e-9) return null;
    const t = -lo[2] / ld[2];
    if (t <= 0) return null;
    return { x: lo[0] + ld[0] * t, y: lo[1] + ld[1] * t, t: t };
  }
  // valore 0..1 di un cursore dato il punto locale
  function sliderValue(layout, item, lx) {
    const px = toPx(lx, 0, layout)[0];
    return Math.min(1, Math.max(0, (px - item.x - 14) / (item.w - 28)));
  }

  // Poke: il dito indice preme quando attraversa il piano da davanti dentro un pulsante. Si arma solo oltre ARM; ignora la pinza.
  // Restituisce anche `slide` se il dito è dentro un cursore (si trascina col dito, senza bisogno di armarsi).
  function Poke() { this.s = {}; }
  Poke.prototype.update = function (id, p, pinching, layout, scale) {
    const st = this.s[id] || (this.s[id] = { armed: false });
    const zw = p.z * scale;
    if (pinching) { st.armed = false; return { press: null, hover: null, slide: null }; }
    const it = hit(layout, p.x, p.y, ['btn', 'slider']);
    let press = null, slide = null;
    if (zw > ARM) st.armed = true;
    if (zw <= 0) {
      if (st.armed && it && zw > -BACK && it.kind === 'btn' && !it.off) press = it.id;
      if (it && it.kind === 'slider' && zw > -BACK) slide = { id: it.id, value: sliderValue(layout, it, p.x) };
      st.armed = false;
    }
    return { press: press, slide: slide, hover: it && zw > -BACK && zw < HOVER ? it.id : null };
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
      case 'pause': c.fillRect(-h * 0.75, -h, h * 0.55, sz); c.fillRect(h * 0.2, -h, h * 0.55, sz); break;
      case 'step': c.moveTo(-h * 0.8, -h * 0.8); c.lineTo(h * 0.2, 0); c.lineTo(-h * 0.8, h * 0.8); c.closePath(); c.fill(); c.fillRect(h * 0.4, -h * 0.8, h * 0.4, h * 1.6); break;
      case 'reset': c.arc(0, 0, h * 0.8, -Math.PI * 0.35, Math.PI * 1.3); c.stroke(); c.beginPath(); c.moveTo(h * 0.95, -h * 1.05); c.lineTo(h * 0.8, -h * 0.25); c.lineTo(h * 0.05, -h * 0.65); c.closePath(); c.fill(); break;
      case 'up': c.moveTo(0, h); c.lineTo(0, -h * 0.8); c.moveTo(-h * 0.7, -h * 0.1); c.lineTo(0, -h * 0.9); c.lineTo(h * 0.7, -h * 0.1); c.stroke(); break;
      case 'down': c.moveTo(0, -h); c.lineTo(0, h * 0.8); c.moveTo(-h * 0.7, h * 0.1); c.lineTo(0, h * 0.9); c.lineTo(h * 0.7, h * 0.1); c.stroke(); break;
      case 'back': c.moveTo(h * 0.9, 0); c.lineTo(-h * 0.8, 0); c.moveTo(-h * 0.1, -h * 0.7); c.lineTo(-h * 0.9, 0); c.lineTo(-h * 0.1, h * 0.7); c.stroke(); break;
      case 'close': c.moveTo(-h * 0.7, -h * 0.7); c.lineTo(h * 0.7, h * 0.7); c.moveTo(h * 0.7, -h * 0.7); c.lineTo(-h * 0.7, h * 0.7); c.stroke(); break;
      case 'exit': c.moveTo(-h * 0.2, -h * 0.9); c.lineTo(-h * 0.9, -h * 0.9); c.lineTo(-h * 0.9, h * 0.9); c.lineTo(-h * 0.2, h * 0.9); c.moveTo(-h * 0.3, 0); c.lineTo(h * 0.9, 0); c.moveTo(h * 0.3, -h * 0.5); c.lineTo(h * 0.9, 0); c.lineTo(h * 0.3, h * 0.5); c.stroke(); break;
      case 'menu': c.moveTo(-h * 0.8, -h * 0.5); c.lineTo(h * 0.8, -h * 0.5); c.moveTo(-h * 0.8, 0); c.lineTo(h * 0.8, 0); c.moveTo(-h * 0.8, h * 0.5); c.lineTo(h * 0.8, h * 0.5); c.stroke(); break;
      case 'planet': c.arc(0, 0, h * 0.62, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(0, 0, h, h * 0.32, -0.45, 0, Math.PI * 2); c.stroke(); break;
      case 'ship': c.moveTo(h, 0); c.lineTo(-h * 0.8, -h * 0.75); c.lineTo(-h * 0.45, 0); c.lineTo(-h * 0.8, h * 0.75); c.closePath(); c.fill(); break;
      case 'rocket': c.moveTo(0, -h); c.quadraticCurveTo(h * 0.8, -h * 0.2, h * 0.4, h * 0.45); c.lineTo(-h * 0.4, h * 0.45); c.quadraticCurveTo(-h * 0.8, -h * 0.2, 0, -h); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-h * 0.25, h * 0.75); c.lineTo(0, h); c.lineTo(h * 0.25, h * 0.75); c.stroke(); break;
      case 'target': c.arc(0, 0, h * 0.7, 0, Math.PI * 2); c.moveTo(-h, 0); c.lineTo(-h * 0.4, 0); c.moveTo(h * 0.4, 0); c.lineTo(h, 0); c.moveTo(0, -h); c.lineTo(0, -h * 0.4); c.moveTo(0, h * 0.4); c.lineTo(0, h); c.stroke(); break;
      default: break;
    }
    c.restore();
  }

  function fit(c, text, maxW, px, bold) {
    let s = px; c.font = font(s, bold);
    while (s > 12 && c.measureText(text).width > maxW) { s -= 1; c.font = font(s, bold); }
    return s;
  }
  function wrapLines(c, text, maxW) {
    const out = [];
    String(text).split('\n').forEach(par => {
      let line = '';
      par.split(' ').forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }
  const roundRect = (c, x, y, w, h) => { c.beginPath(); c.rect(x, y, w, h); };

  // C = palette (chiavi come i token CSS di Orbit Lab); hover = id sotto il dito/raggio; held = {id: true}; flash = id appena premuto
  function draw(c, layout, s, hover, held, flash, C) {
    const w = layout.W, h = layout.H, f = layout.frame || 0;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    if (f) { // scheda con ombra dura (cornice = zona di presa)
      c.fillStyle = C.ink; c.fillRect(f + 8, f + 8, w - 2 * f, h - 2 * f);
      c.fillStyle = C.surface; c.fillRect(f, f, w - 2 * f, h - 2 * f);
      c.strokeStyle = s.frameHot ? C.accent : C.ink; c.lineWidth = s.frameHot ? 8 : 4; c.strokeRect(f, f, w - 2 * f, h - 2 * f);
    }
    const tileCol = { k: [C.ink, C.surface], a: [C.accent, C.onaccent], p: [C.surface, C.ink], b: [C.tile2, '#0B1B3A'] };
    for (const it of layout.items) {
      if (it.hidden) continue;
      if (it.kind === 'tile') {
        const col = tileCol[it.tone];
        c.fillStyle = col[0]; c.fillRect(it.x, it.y, it.w, it.h); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(it.x, it.y, it.w, it.h);
        c.fillStyle = col[1]; c.font = font(30, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.label, it.x + it.w / 2, it.y + it.h / 2 + 2);
      } else if (it.kind === 'text') {
        c.textBaseline = 'alphabetic'; c.fillStyle = it.color || (it.small ? C.muted : C.ink);
        const px = it.px || (it.small ? 21 : 25);
        if (it.wrap) {
          c.font = font(px, it.bold); c.textAlign = 'left';
          let y = it.y + px + 2;
          if (it.title) { c.fillStyle = C.accent; c.font = font(20, true); c.fillText(it.title.toUpperCase(), it.x, y); y += px + 6; c.fillStyle = C.ink; c.font = font(px, it.bold); }
          wrapLines(c, it.label, it.w).forEach(l => { c.fillText(l, it.x, y); y += px + 7; });
        } else if (it.center) {
          c.font = font(30, true); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.label, it.x + it.w / 2, it.y + it.h / 2);
        } else {
          c.font = font(px, it.bold); c.textAlign = it.right ? 'right' : 'left'; c.textBaseline = 'middle';
          c.fillText(it.label, it.right ? it.x + it.w : it.x, it.y + it.h / 2);
          if (it.value) { c.fillStyle = C.ink; c.font = font(px, true); c.textAlign = 'right'; c.fillText(it.value, it.x + it.w, it.y + it.h / 2); }
        }
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      } else if (it.kind === 'slider') {
        const tx = it.x + 14, tw = it.w - 28, cy = it.y + it.h / 2;
        c.fillStyle = C.ink; c.fillRect(tx, cy - 3, tw, 6);
        const px = tx + tw * (it.value || 0);
        const hv = hover === it.id;
        c.fillStyle = hv ? C.tile2 : C.accent; c.fillRect(px - 14, cy - 18, 28, 36); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(px - 14, cy - 18, 28, 36);
      } else if (it.kind === 'btn') {
        const isHeld = !!(held && held[it.id]), hv = hover === it.id && !it.off;
        const dx = isHeld || flash === it.id ? 4 : 0;
        let bg = C.surface, fg = C.ink;
        if (it.primary) { bg = C.accent; fg = C.onaccent; }
        if (it.on || (it.toggle && it.on)) { bg = C.ink; fg = C.surface; }
        if (it.done) { bg = C.vel; fg = '#fff'; }
        if (hv && !it.on) bg = C.tile2, fg = '#0B1B3A';
        c.save(); c.globalAlpha = it.off ? 0.4 : 1;
        if (!dx && !it.tab) { c.fillStyle = C.ink; c.fillRect(it.x + 4, it.y + 4, it.w, it.h); }
        c.fillStyle = bg; c.fillRect(it.x + dx, it.y + dx, it.w, it.h); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(it.x + dx, it.y + dx, it.w, it.h);
        const cx = it.x + dx + it.w / 2, cy = it.y + dx + it.h / 2;
        if (it.swatch) { c.fillStyle = C[it.swatch] || C.ink; c.fillRect(it.x + dx + 12, cy - 8, 16, 16); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(it.x + dx + 12, cy - 8, 16, 16); }
        if (it.toggle) { // interruttore a destra
          const bx = it.x + dx + it.w - 56, by = cy - 12; c.strokeStyle = fg; c.lineWidth = 3; c.strokeRect(bx, by, 40, 24);
          c.fillStyle = fg; c.fillRect(it.on ? bx + 22 : bx + 4, by + 4, 14, 16);
        }
        if (it.wrap) {
          c.fillStyle = fg; c.font = font(21, it.on); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
          const ls = wrapLines(c, it.label, it.w - 28); let y = it.y + dx + (it.h - ls.length * 28) / 2 + 20;
          ls.forEach(l => { c.fillText(l, it.x + dx + 14, y); y += 28; });
        } else if (it.icon && !it.label) {
          glyph(c, it.icon, cx, cy, Math.min(it.w, it.h) * 0.5, fg);
        } else {
          const bigPx = it.big ? 28 : it.tab ? 22 : 25, lx = it.x + dx + (it.swatch ? 38 : it.icon ? it.h * 0.95 : 0), lw = it.w - (it.swatch ? 38 : it.icon ? it.h * 0.95 : 0) - (it.toggle ? 60 : 0) - (it.tag ? 54 : 8);
          if (it.icon) glyph(c, it.icon, it.x + dx + it.h * (it.big ? 0.5 : 0.48), cy, it.h * 0.42, fg);
          c.fillStyle = fg; const px = fit(c, it.label, Math.max(40, lw - 8), bigPx, true);
          c.font = font(px, true); c.textBaseline = 'middle';
          if (it.left || it.swatch || it.toggle) { c.textAlign = 'left'; c.fillText(it.label, it.swatch ? it.x + dx + 38 : it.x + dx + 14, cy + 1); }
          else { c.textAlign = 'center'; c.fillText(it.label, lx + (it.w - (lx - it.x - dx) - (it.tag ? 46 : 0)) / 2, cy + 1); }
          c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        }
        if (it.tag) { c.font = font(17, true); c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(it.tag, it.x + dx + it.w - 10, it.y + dx + 16); c.textAlign = 'left'; }
        c.restore();
      }
    }
    // suggerimento sotto il dito (su una riga, sopra le schede)
    const th = hover ? layout.items.find(i => i.id === hover && i.tip) : null;
    if (th) {
      c.font = font(20, true); const tw = Math.min(w - 2 * f - 16, c.measureText(th.tip).width + 24);
      c.fillStyle = C.ink; c.fillRect(w / 2 - tw / 2, 102 - 54, tw, 34); c.fillStyle = C.surface; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(th.tip, w / 2, 102 - 54 + 17); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    }
  }

  function drawFab(c, layout, hover, C) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, layout.W, layout.H);
    const it = layout.items[0], hv = hover === 'menu';
    c.fillStyle = C.ink; c.fillRect(it.x + 5, it.y + 5, it.w, it.h);
    c.fillStyle = hv ? C.tile2 : C.accent; c.fillRect(it.x, it.y, it.w, it.h); c.strokeStyle = C.ink; c.lineWidth = 4; c.strokeRect(it.x, it.y, it.w, it.h);
    glyph(c, 'menu', it.x + 44, it.y + it.h / 2, 38, hv ? '#0B1B3A' : C.onaccent);
    c.fillStyle = hv ? '#0B1B3A' : C.onaccent; c.font = font(32, true); c.textBaseline = 'middle'; c.fillText('Menu', it.x + 82, it.y + it.h / 2 + 2); c.textBaseline = 'alphabetic';
  }

  const api = { W: W, H: H, MPP: MPP, FR: FR, FAB: FAB, SPEEDS: SPEEDS, TABS: TABS, build: build, hit: hit, inFrame: inFrame, toLocal: toLocal, toLocalXY: toLocalXY, toPx: toPx, rayHit: rayHit,
    sliderValue: sliderValue, Poke: Poke, draw: draw, drawFab: drawFab, glyph: glyph, wrapLines: wrapLines, font: font, FONT: FONT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XRPanel = api;
})(typeof window !== 'undefined' ? window : globalThis);
