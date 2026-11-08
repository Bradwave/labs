/* hud.js — quadro strumenti di Orbit Lab su canvas 2D (porta di readoutHTML, drawBars e drawCam di orbit-lab.html).
   Serve alla plancia in VR, al pannello accanto al pianeta in AR e alla finestrella "Ship cam" nella vista dall'esterno.
   Nessun THREE né DOM: riceve il contesto 2D e la palette. Global `Hud`. */
(function (root) {
  'use strict';

  const Core = root.OrbitCore || (typeof require !== 'undefined' ? require('./core.js') : null);
  const SimM = root.OrbitSim || (typeof require !== 'undefined' ? require('./sim.js') : null);
  const CORE = Core.CORE;
  const FONT = '"Space Mono", ui-monospace, Menlo, Consolas, monospace';
  const font = (px, bold) => (bold ? '700 ' : '400 ') + px + 'px ' + FONT;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (v, d) => { d = d === undefined ? 3 : d; return !isFinite(v) ? '∞' : (Math.abs(v) < 5e-4 && d >= 3 ? '0' : v.toFixed(d)); };

  const orbitColor = (I, C) => I.crash ? C['c-crash'] : I.type === 'circle' ? C['c-circle'] : I.type === 'ellipse' ? C['c-ellipse'] : I.type === 'parabola' ? C['c-parab'] : I.type === 'hyperbola' ? C['c-hyper'] : C['c-crash'];

  // righe di lettura (stesse voci di readoutHTML) per l'orbita prevista Io e lo stato attuale I
  function rows(sim, q, I) {
    const Io = I, p = sim.planetInfo(), real = sim.feat('realUnits') && p.R;
    const out = [];
    if (!sim.feat('readFull')) {
      out.push(['Closest', Io.crash ? 'the ground' : fmt(Io.rp - 1, 2) + ' R above']);
      out.push(['Farthest', Io.ra === Infinity ? 'escapes' : fmt(Io.ra - 1, 2) + ' R above']);
      return out;
    }
    const alt = I.r - 1;
    out.push(['Altitude', fmt(alt, 3) + ' R' + (real ? ' · ' + Math.round(alt * p.R).toLocaleString('en') + ' km' : '')]);
    out.push(['Speed', fmt(I.v, 3) + (real ? ' · ' + (I.v * p.v0).toFixed(2) + ' km/s' : '')]);
    out.push(['e', fmt(Io.e, 3)]);
    out.push(['a', Io.a === Infinity ? '∞' : fmt(Io.a, 3) + ' R']);
    out.push(['r_p', Io.crash ? fmt(Io.rp, 3) + ' (below ground)' : fmt(Io.rp, 3) + ' R']);
    out.push(['r_a', Io.ra === Infinity ? '∞' : fmt(Io.ra, 3) + ' R']);
    out.push(['T', Io.T === Infinity ? '∞' : fmt(Io.T, 2) + (real ? ' · ' + (Io.T * p.tau / 60).toFixed(1) + ' min' : '')]);
    out.push(['Δv used', fmt(q.dv, 3)]);
    return out;
  }

  function hatch(c, x, y, w, h, color, gap) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = color; c.lineWidth = 3; c.beginPath();
    for (let k = -h; k < w + h; k += gap) { c.moveTo(x + k, y + h); c.lineTo(x + k + h, y); }
    c.stroke(); c.restore();
  }

  // barre dell'energia K (piena), U (a tratteggio), E (punteggiata) in [x, y, w, h]
  function drawBars(c, x, y, w, h, q, sim, C) {
    c.save(); c.translate(x, y);
    c.fillStyle = C.surface; c.fillRect(0, 0, w, h); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
    const en = CORE.energy(q.x, q.y, q.vx, q.vy), Eu = 0.5, K = en.K / Eu, U = en.U / Eu, E = en.E / Eu;
    const top = 34, bot = h - 30, lo = -2.6, hi = 3.2, Y = v => top + (hi - clamp(v, lo, hi)) / (hi - lo) * (bot - top), y0 = Y(0);
    c.font = font(17, true); c.fillStyle = C.muted; c.textBaseline = 'alphabetic'; c.fillText('E=0 escape', 8, y0 + 18);
    const bw = Math.min(56, (w - 30) / 3.4), gx = (w - 3 * bw) / 4, xs = [gx, 2 * gx + bw, 3 * gx + 2 * bw];
    const bar = (i, v, kind) => {
      const bx = xs[i], yv = Y(v), ytop = Math.min(y0, yv), hh = Math.abs(yv - y0);
      if (kind === 'K') { c.fillStyle = C.kin; c.fillRect(bx, ytop, bw, hh); }
      else if (kind === 'U') { c.fillStyle = C.surface; c.fillRect(bx, ytop, bw, hh); hatch(c, bx, ytop, bw, hh, C.pot, 8); }
      else { c.fillStyle = C.tot; c.globalAlpha = 0.14; c.fillRect(bx, ytop, bw, hh); c.globalAlpha = 1; }
      c.strokeStyle = kind === 'K' ? C.kin : kind === 'U' ? C.pot : C.tot; c.lineWidth = 4; if (kind === 'E') c.setLineDash([5, 5]);
      c.strokeRect(bx, ytop, bw, hh); c.setLineDash([]);
      if (sim.feat('barNumbers')) { c.fillStyle = C.ink; c.textAlign = 'center'; c.font = font(16, true); c.fillText(fmt(v, 2), bx + bw / 2, v >= 0 ? ytop - 5 : ytop + hh + 16); c.textAlign = 'left'; }
    };
    bar(0, K, 'K'); bar(1, U, 'U'); bar(2, E, 'E');
    c.strokeStyle = C.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(0, y0); c.lineTo(w, y0); c.stroke();
    c.fillStyle = C.ink; c.textAlign = 'center'; c.font = font(20, true); ['K', 'U', 'E'].forEach((s, i) => c.fillText(s, xs[i] + bw / 2, h - 8)); c.textAlign = 'left';
    if (sim.feat('work')) { c.fillStyle = C.thr; c.font = font(16, true); c.fillText('W_T=' + fmt(q.W / Eu, 2), 8, 22); }
    c.restore();
  }

  // quadro completo: schede (tipo di orbita + letture) e barre. w x h in pixel.
  function draw(c, w, h, F, sim, C) {
    const q = F.q, Io = F.Io, I = F.I, S = sim.S;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.fillStyle = C.ink; c.fillRect(8, 8, w - 8, h - 8);
    c.fillStyle = C.surface; c.fillRect(0, 0, w - 8, h - 8);
    c.strokeStyle = C.ink; c.lineWidth = 4; c.strokeRect(0, 0, w - 8, h - 8);
    const showBars = S.show.bars, lw = showBars ? w * 0.58 : w - 8;
    c.textBaseline = 'alphabetic';
    c.font = font(34, true); c.fillStyle = orbitColor(Io, C); c.fillText(SimM.typeLabel(Io), 22, 52);
    const rs = rows(sim, q, I);
    c.font = font(26, false);
    const rh = Math.min(38, (h - 100) / Math.max(rs.length, 1));
    rs.forEach((r, i) => {
      const y = 96 + i * rh;
      c.fillStyle = C.muted; c.font = font(24, false); c.fillText(r[0], 22, y);
      c.fillStyle = C.ink; c.font = font(24, true); c.textAlign = 'right'; c.fillText(r[1], lw - 14, y); c.textAlign = 'left';
    });
    if (showBars) drawBars(c, lw + 6, 18, w - lw - 32, h - 44, q, sim, C);
    // stato: a terra / in attesa
    if (S.crashed && F.atEnd) { c.fillStyle = C.accent; c.fillRect(22, h - 68, 360, 40); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(22, h - 68, 360, 40); c.fillStyle = C.onaccent; c.font = font(22, true); c.fillText('Landed at t = ' + S.crashed.t.toFixed(2), 34, h - 40); }
  }

  // ---------- Ship cam (finestrella 2D, porta di drawCam) ----------
  const CAB = [{ x: .2, y: .78, vx: 0, vy: 0, c: '#FF6A3D', s: 9 }, { x: .5, y: .84, vx: 0, vy: 0, c: '#FFC23D', s: 7 }, { x: .78, y: .8, vx: 0, vy: 0, c: '#6E3FE0', s: 8 }, { x: .62, y: .7, vx: 0, vy: 0, c: '#0F9A63', s: 6 }];
  const STARS = Array.from({ length: 70 }, (_, i) => { const a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin(i * 311.7) * 43758.5453; return [a - Math.floor(a), b - Math.floor(b), .5 + ((i * 37) % 10) / 10]; });
  function drawCam(c, w, h, F, dtReal, C) {
    const q = F.q, I = F.I, cmd = F.cmd;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const rho = Math.asin(Math.min(1, 1 / Math.max(I.r, 1))), dip = Math.PI / 2 - rho, beta = clamp(dip * .6, 0, 1.1);
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#030712'); sky.addColorStop(1, '#0B1B3A'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; for (const s of STARS) { c.globalAlpha = s[2] * .8; c.fillRect(s[0] * w, s[1] * h * .9, 2.4, 2.4); } c.globalAlpha = 1;
    const Fp = (w / 2) / Math.tan(50 * Math.PI / 180);
    const proj = (l, f, u) => { const df = f * Math.cos(beta) - u * Math.sin(beta), du = f * Math.sin(beta) + u * Math.cos(beta); if (df < .02) return null; return [w / 2 + Fp * l / df, h / 2 - Fp * du / df]; };
    const pts = []; let all = true;
    for (let i = 0; i <= 240; i++) { const th = i / 240 * Math.PI * 2, p = proj(Math.sin(rho) * Math.cos(th), Math.sin(rho) * Math.sin(th), -Math.cos(rho)); if (p) pts.push(p); else all = false; }
    c.fillStyle = C.planet; c.strokeStyle = '#8FDDF3'; c.lineWidth = 4;
    if (pts.length > 3) {
      if (all) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.stroke(); }
      else { pts.sort((a, b) => a[0] - b[0]); c.beginPath(); c.moveTo(pts[0][0] - w, h + 20); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(pts[pts.length - 1][0] + w, h + 20); c.closePath(); c.fill(); c.stroke(); }
    }
    const vt = Math.abs(I.hz) / I.r, vu = I.vr, vm = Math.hypot(vt, vu);
    if (vm > 1e-6 && !q.pad) {
      const P1 = proj(0, vt / vm, vu / vm), P2 = proj(0, -vt / vm, -vu / vm);
      if (P1) { c.strokeStyle = C.vel; c.lineWidth = 3.5; c.beginPath(); c.arc(P1[0], P1[1], 11, 0, Math.PI * 2); c.moveTo(P1[0], P1[1] - 18); c.lineTo(P1[0], P1[1] - 11); c.moveTo(P1[0] - 18, P1[1]); c.lineTo(P1[0] - 11, P1[1]); c.moveTo(P1[0] + 18, P1[1]); c.lineTo(P1[0] + 11, P1[1]); c.stroke(); }
      if (P2) { c.strokeStyle = C['c-crash']; c.lineWidth = 3.5; c.beginPath(); c.arc(P2[0], P2[1], 11, 0, Math.PI * 2); c.moveTo(P2[0] - 7, P2[1] - 7); c.lineTo(P2[0] + 7, P2[1] + 7); c.moveTo(P2[0] + 7, P2[1] - 7); c.lineTo(P2[0] - 7, P2[1] + 7); c.stroke(); }
    }
    const th = CORE.thrustAcc(q.x, q.y, q.vx, q.vy, cmd && cmd.k ? cmd : null), tm = Math.hypot(th[0], th[1]);
    for (const o of CAB) {
      if (tm > 1e-6) o.vy += Math.min(2, tm * 6) * dtReal;
      o.x += o.vx * dtReal; o.y += o.vy * dtReal;
      if (o.y > .93) { o.y = .93; o.vy *= -.35; } if (o.y < .55) { o.y = .55; o.vy *= -.5; }
      if (o.x < .05 || o.x > .95) { o.vx *= -1; o.x = clamp(o.x, .05, .95); }
      c.fillStyle = o.c; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(o.x * w, o.y * h, o.s * 2.2, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.font = font(20, true); c.fillStyle = '#E8F1FF'; c.fillText('SHIP CAM · alt ' + fmt(I.r - 1, 2), 12, 26);
    c.strokeStyle = C.ink; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
  }

  const api = { rows: rows, draw: draw, drawBars: drawBars, drawCam: drawCam, orbitColor: orbitColor, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Hud = api;
})(typeof window !== 'undefined' ? window : globalThis);
