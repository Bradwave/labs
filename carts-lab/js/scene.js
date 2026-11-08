// Scena: rotaia, sensori, carrelli. Disegno su canvas e interazione (trascinare, lanciare).
import { CFG } from './config.js';

const FONT = (n = 11, w = 700) => `${w} ${n}px "Space Mono", ui-monospace, Menlo, monospace`;
const POLE = { N: '#E5383B', S: '#2B6CFF' };
const TILT_VIS = 3;   // l'inclinazione è esagerata ×3 nel disegno

export class Scene {
  constructor({ canvas, world, onGrab, onRelease }) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.world = world;
    this.cb = { onGrab, onRelease };
    this.C = {}; this.W = 300; this.H = 200; this.dpr = 1;
    this.replay = null; this.showVec = false; this.sensorText = ['', ''];
    this.holdId = null; this.holdOff = 0; this.hits = [];
    this.refreshColors();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));
  }
  refreshColors() {
    const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue('--' + n).trim();
    for (const n of ['surface', 'ink', 'muted', 'grid', 's1', 's2', 'hot', 'accent', 'tile2', 'floor', 'deadfill'])
      this.C[n] = g(n);
  }
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.W = Math.max(200, this.cv.clientWidth); this.H = Math.max(140, this.cv.clientHeight);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
  }

  // ---- geometria ----
  get M() { return Math.max(34, Math.min(52, this.W * 0.07)); }
  get s() { return (this.W - 2 * this.M) / this.world.L; }        // px per metro
  get railY() { return Math.round(this.H * 0.68); }
  get angle() { return this.world.tiltDeg() * Math.PI / 180 * TILT_VIS; }
  // coordinate locali (origine all'estremo sinistro della rotaia, y verso l'alto) → schermo
  toScreen(lx, ly) {
    const a = this.angle, cx = this.W / 2, cy = this.railY, px = lx - (this.W / 2 - this.M), c = Math.cos(a), sn = Math.sin(a);
    // il punto locale ruota attorno al centro della rotaia
    return [cx + px * c + ly * sn, cy + px * sn - ly * c];
  }
  fromScreen(sx, sy) {
    const a = this.angle, cx = this.W / 2, cy = this.railY, dx = sx - cx, dy = sy - cy, c = Math.cos(a), sn = Math.sin(a);
    const px = dx * c + dy * sn, ly = dx * sn - dy * c;
    return [px + (this.W / 2 - this.M), ly];
  }

  // ---- disegno ----
  draw(now, info = {}) {
    const ctx = this.ctx, C = this.C, w = this.world, W = this.W, H = this.H, s = this.s, M = this.M;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    // pavimento
    const floorY = this.railY + 40;
    ctx.fillStyle = C.floor; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, floorY + .5); ctx.lineTo(W, floorY + .5); ctx.stroke();

    const ℓp = CFG.CART_LEN * s, ch = Math.max(26, Math.min(40, ℓp * 0.42));
    // piedini: verticali, di lunghezza diversa se la rotaia è inclinata
    ctx.fillStyle = C.ink;
    for (const u of [10, w.L * s - 10]) {
      const [fx, fy] = this.toScreen(u, -8);
      ctx.fillRect(fx - 5, fy, 10, Math.max(4, floorY - fy));
    }
    // rotaia e zone morte nel sistema ruotato
    ctx.save();
    ctx.translate(W / 2, this.railY); ctx.rotate(this.angle);
    const x0 = -(W / 2 - M), Lp = w.L * s, dz = CFG.DEAD * s;
    ctx.fillStyle = C.deadfill;
    ctx.fillRect(x0, -ch - 40, dz, ch + 40 + 8);
    ctx.fillRect(x0 + Lp - dz, -ch - 40, dz, ch + 40 + 8);
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x0 + dz, -ch - 40); ctx.lineTo(x0 + dz, 0); ctx.moveTo(x0 + Lp - dz, -ch - 40); ctx.lineTo(x0 + Lp - dz, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.ink; ctx.fillRect(x0, 0, Lp, 8);
    ctx.fillStyle = C.tile2; ctx.fillRect(x0, 0, Lp, 3);
    ctx.strokeStyle = C.surface; ctx.lineWidth = 1; ctx.beginPath();
    const step = w.L <= 1.2 ? 0.1 : 0.2;
    for (let m = 0; m <= w.L + 1e-9; m += step) { ctx.moveTo(x0 + m * s + .5, 3); ctx.lineTo(x0 + m * s + .5, 8); }
    ctx.stroke();
    ctx.restore();

    // numeri della scala (in metri dal sensore sinistro)
    ctx.fillStyle = C.muted; ctx.font = FONT(9, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const every = w.L <= 1.2 ? 2 : 1;
    for (let i = 0; i * step <= w.L + 1e-9; i++) {
      if (i % every !== 0) continue;
      const [sx, sy] = this.toScreen(i * step * s, -12);
      ctx.fillText((i * step).toFixed(1), sx, sy);
    }

    const carts = this._cartStates(now);
    this.hits = [];
    for (const k of carts) this._drawCart(ctx, k, s, ℓp, ch, w);
    this._drawSensors(ctx, w, s, ch, carts, info);
    if (this.replay) {
      ctx.fillStyle = C.ink; ctx.fillRect(8, 8, 150, 22);
      ctx.fillStyle = C.surface; ctx.font = FONT(11); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText('REPLAY  t = ' + this.replay.t.toFixed(3) + ' s', 14, 19.5);
    }
  }

  _cartStates(now) {
    const w = this.world, out = [];
    for (const id of ['A', 'B']) {
      const c = w.carts[id];
      if (this.replay) {
        out.push({ id, c, x: this.replay.x[id], v: this.replay.v?.[id] ?? 0, derailed: !!this.replay.der[id], tau: 0, held: false });
      } else {
        out.push({ id, c, x: c.x, v: c.v, derailed: c.derailed, tau: c.derailed ? w.time - c.dT : 0, held: c.held });
      }
    }
    return out;
  }

  _drawCart(ctx, k, s, ℓp, ch, w) {
    const C = this.C, c = k.c, id = k.id, slot = w.slot(id);
    const [fl, fr] = w.faces(c);
    const m = w.mass(c), bodyW = ℓp, wr = 4.5;
    let cx, cy, rot = 0;
        if (!k.derailed) {
      const [sx, sy] = this.toScreen(k.x * s, 0);
      cx = sx; cy = sy; rot = this.angle;
    } else {
      // caduta: parabola e rotazione, poi giace sul pavimento
      const T = 0.45, tt = Math.min(k.tau, T), fall = (tt / T) ** 2;
      const dir = c.dDir || (k.x < w.L / 2 ? -1 : 1);
      const xm = k.tau > 0 ? c.dX + c.dV * Math.min(k.tau, 0.6) : k.x;
      let [sx] = this.toScreen(Math.min(Math.max(xm, -0.12), w.L + 0.12) * s, 0);
      const floorY = this.railY + 38 - wr - 3;
      cx = Math.min(Math.max(sx, 22), this.W - 22);
      cy = this.railY + (floorY - this.railY) * fall;
      rot = dir * (tt / T) * 1.35;
      if (k.tau > 0 && k.tau >= T) cy = floorY - bodyW * 0.12;
    }
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot);
    const x0 = -bodyW / 2, yTop = -wr * 2 - ch, yBot = -wr * 2;
    // ruote
    ctx.fillStyle = C.ink;
    for (const dx of [-bodyW * 0.3, bodyW * 0.3]) { ctx.beginPath(); ctx.arc(dx, -wr, wr, 0, 6.2832); ctx.fill(); }
    // masse aggiunte
    let stack = yTop;
    const extras = [];
    if (w.extra.m1 === id) extras.push(['1 kg', 0.84, 15]);
    if (w.extra.m05 === id) extras.push(['0.5', 0.54, 11]);
    for (const [lab, fw, fh] of extras) {
      const bw = bodyW * fw;
      ctx.fillStyle = C.ink; ctx.fillRect(-bw / 2, stack - fh, bw, fh);
      ctx.fillStyle = C.surface; ctx.font = FONT(fh > 12 ? 10 : 8, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lab, 0, stack - fh / 2 + .5);
      stack -= fh;
    }
    // corpo
    const sensorCol = C[slot === 0 ? 's1' : 's2'];
    ctx.fillStyle = C.surface; ctx.fillRect(x0, yTop, bodyW, ch);
    ctx.fillStyle = sensorCol; ctx.fillRect(x0, yBot - 5, bodyW, 5);
    ctx.strokeStyle = C.ink; ctx.lineWidth = k.held ? 3.5 : 2; ctx.strokeRect(x0, yTop, bodyW, ch);
    // tessera con la lettera
    const t = Math.min(ch - 10, 22);
    ctx.fillStyle = C.ink; ctx.fillRect(-t / 2, yTop + (ch - 5 - t) / 2 + 1, t, t);
    ctx.fillStyle = C.surface; ctx.font = FONT(Math.round(t * 0.62), 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(id, 0, yTop + (ch - 5) / 2 + 2);
    // facce
    const cap = Math.min(15, bodyW * 0.26);
    this._face(ctx, fl, -1, x0, yTop, ch - 5, cap, id, c, s);
    this._face(ctx, fr, +1, x0 + bodyW, yTop, ch - 5, cap, id, c, s);
    ctx.restore();

    // etichetta di massa e vettore velocità (schermo, non ruotati)
    if (!k.derailed) {
      const [tx, ty] = this.toScreen(k.x * s, ch + 2 * wr + 10 + extras.reduce((a, e) => a + e[2], 0));
      ctx.fillStyle = C.muted; ctx.font = FONT(10, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(w.hideMass ? '? kg' : m.toFixed(2) + ' kg', tx, ty);
      if (this.showVec && Math.abs(k.v) > 0.005) {
        const L = k.v * 110, y = ty - 14;
        ctx.strokeStyle = C.hot; ctx.fillStyle = C.hot; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx + L, y); ctx.stroke();
        const d = Math.sign(L);
        ctx.beginPath(); ctx.moveTo(tx + L, y); ctx.lineTo(tx + L - d * 8, y - 5); ctx.lineTo(tx + L - d * 8, y + 5); ctx.closePath(); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.textAlign = d > 0 ? 'left' : 'right';
        ctx.fillText(k.v.toFixed(2), tx + L + d * 4, y);
      }
      this.hits.push({ id, cx, cy, rot, bodyW, ch, derailed: false });
    } else {
      this.hits.push({ id, cx, cy, rot, bodyW, ch, derailed: true });
    }
  }

  // Estremità di un carrello: molla, velcro con magnete, magnete liscio.
  _face(ctx, face, dir, xe, yTop, h, cap, id, c, s) {
    const C = this.C, mid = yTop + h / 2;
    ctx.save();
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 1.6;
    if (face === 'spring') {
      const prot = c.plunger === 'active' || c.firing ? CFG.PLUNGER_PROT * s : 0;
      const x1 = xe - dir * 1, x2 = xe - dir * cap;
      ctx.strokeStyle = c.plunger === 'loaded' ? C.hot : C.ink;
      ctx.beginPath(); ctx.moveTo(x2, mid);
      const n = 4;
      for (let i = 1; i <= n; i++) {
        const xx = x2 + (x1 - x2) * i / n - ((x1 - x2) / n) * 0.5, yy = mid + (i % 2 ? -1 : 1) * (h * 0.22);
        ctx.lineTo(xx, yy);
      }
      ctx.lineTo(x1, mid); ctx.stroke();
      ctx.strokeStyle = C.ink;
      if (prot > 0) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(Math.min(xe, xe + dir * prot), mid - 1.5, prot, 3);
        ctx.fillRect(xe + dir * prot - (dir > 0 ? 0 : 3), mid - h * 0.2, 3, h * 0.4);
      }
      if (c.plunger === 'loaded') { ctx.fillStyle = C.hot; ctx.fillRect(xe - dir * cap * 0.5 - 3, yTop + 2, 6, 6); }
    } else {
      const pole = face === 'magnet' ? 'N' : (id === 'A' ? 'N' : 'S');
      ctx.fillStyle = POLE[pole];
      const bx = dir > 0 ? xe - cap : xe, by = yTop + 3, bh = h * 0.36;
      ctx.fillRect(bx, by, cap, bh);
      ctx.fillStyle = '#fff'; ctx.font = FONT(8, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pole, bx + cap / 2, by + bh / 2 + 0.5);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, cap, bh);
      if (face === 'velcro') {
        ctx.fillStyle = C.ink;
        const sy = by + bh + 2, sh = h - bh - 6;
        for (let i = 0; i < 3; i++) ctx.fillRect(bx + 2 + i * (cap - 4) / 2.6, sy, 2, sh);
      } else {
        ctx.fillStyle = C.ink;
        ctx.fillRect(bx, by + bh + 2, cap, 3);
      }
    }
    ctx.restore();
  }

  _drawSensors(ctx, w, s, ch, carts, info) {
    const C = this.C, ℓ = CFG.CART_LEN;
    const seen = [null, null];
    let bl = Infinity, br = Infinity;
    for (const k of carts) {
      if (k.derailed) continue;
      const dl = k.x - ℓ / 2, dr = w.L - (k.x + ℓ / 2);
      if (dl < bl) { bl = dl; seen[0] = k; }
      if (dr < br) { br = dr; seen[1] = k; }
    }
    for (const sIdx of [0, 1]) {
      const col = C[sIdx ? 's2' : 's1'], xm = sIdx ? w.L : 0, dir = sIdx ? -1 : 1;
      const [sx, sy] = this.toScreen(xm * s - dir * 12, 22);
      // fascio
      const k = seen[sIdx];
      if (k) {
        const face = sIdx ? k.x + ℓ / 2 : k.x - ℓ / 2;
        const [fx, fy] = this.toScreen(face * s, 20), [ox, oy] = this.toScreen(xm * s, 20);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.globalAlpha = .9;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(fx, fy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      // corpo del sensore
      ctx.save();
      const [bx, by] = this.toScreen(xm * s - dir * 2, 20);
      ctx.translate(bx, by); ctx.rotate(this.angle);
      ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.fillRect(sIdx ? 0 : -16, -17, 16, 34); ctx.strokeRect(sIdx ? 0 : -16, -17, 16, 34);
      ctx.fillStyle = C.ink; ctx.font = FONT(10, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('S' + (sIdx + 1), sIdx ? 8 : -8, -6);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      for (const rr of [3, 6]) { ctx.beginPath(); ctx.arc(sIdx ? 0 : 0, 6, rr, sIdx ? -1.1 : Math.PI - 1.1 + 0, sIdx ? 1.1 : Math.PI + 1.1, false); ctx.stroke(); }
      ctx.restore();
      // lettura dello strumento
      const txt = this.sensorText[sIdx];
      if (txt) {
        ctx.fillStyle = col; ctx.font = FONT(11, 700); ctx.textAlign = sIdx ? 'right' : 'left'; ctx.textBaseline = 'middle';
        const [tx, ty] = this.toScreen(xm * s + (sIdx ? -6 : 6), ch + 62);
        ctx.fillStyle = C.surface; const wd = ctx.measureText(txt).width + 8;
        ctx.globalAlpha = .85; ctx.fillRect(sIdx ? tx - wd + 4 : tx - 4, ty - 8, wd, 16); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.fillText(txt, tx, ty + .5);
      }
    }
    // indicazione zona morta
    ctx.fillStyle = C.muted; ctx.font = FONT(9, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const sIdx of [0, 1]) {
      const xm = sIdx ? w.L - CFG.DEAD / 2 : CFG.DEAD / 2;
      const [tx, ty] = this.toScreen(xm * s, ch + 38);
      ctx.fillText('<15 cm', tx, ty);
    }
  }

  // ---- interazione ----
  _hit(sx, sy) {
    for (const h of [...this.hits].reverse()) {
      const dx = sx - h.cx, dy = sy - h.cy, c = Math.cos(-h.rot), s_ = Math.sin(-h.rot);
      const lx = dx * c - dy * s_, ly = dx * s_ + dy * c;
      if (Math.abs(lx) <= h.bodyW / 2 + 8 && ly <= 10 && ly >= -(h.ch + 30)) return h;
    }
    return null;
  }
  _xm(ev) {
    const r = this.cv.getBoundingClientRect();
    const [lx] = this.fromScreen(ev.clientX - r.left, ev.clientY - r.top);
    return lx / this.s;
  }
  _down(ev) {
    const r = this.cv.getBoundingClientRect(), h = this._hit(ev.clientX - r.left, ev.clientY - r.top);
    if (!h) return;
    this.cb.onGrab?.(h.id);
    const xm = this._xm(ev), c = this.world.carts[h.id];
    this.holdId = h.id;
    this.holdOff = h.derailed ? 0 : (c.x - xm);
    this.world.hold(h.id, Math.min(Math.max(xm + this.holdOff, CFG.CART_LEN / 2), this.world.L - CFG.CART_LEN / 2));
    this.cv.setPointerCapture(ev.pointerId);
  }
  _move(ev) {
    if (!this.holdId) return;
    const xm = this._xm(ev) + this.holdOff;
    this.world.moveHeld(this.holdId, Math.min(Math.max(xm, CFG.CART_LEN / 2), this.world.L - CFG.CART_LEN / 2));
  }
  _up() {
    if (!this.holdId) return;
    const id = this.holdId, c = this.world.carts[id];
    this.holdId = null;
    this.world.release(id, c.hv);
    this.cb.onRelease?.(id);
  }
}
