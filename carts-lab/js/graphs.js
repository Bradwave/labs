// Grafici x–t e v–t con asse del tempo condiviso, cursori di lettura, selezione, pan/zoom e rette di fit.
import { evalFit } from './fit.js';

const ML = 58, MR = 12, MT = 10;
const FONT = '700 11px "Space Mono", ui-monospace, Menlo, monospace';

function niceStep(range, target) {
  const raw = range / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function ticks(a, b, target) {
  const st = niceStep(b - a, target), out = [];
  for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-6; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
  return { list: out, step: st };
}
const decimals = (st) => Math.max(0, Math.min(5, -Math.floor(Math.log10(st) + 1e-9)));

export class Graphs {
  constructor({ canvasX, canvasV, onCursor, onSelection, onView }) {
    this.cvs = { x: canvasX, v: canvasV };
    this.ctx = { x: canvasX.getContext('2d'), v: canvasV.getContext('2d') };
    this.cb = { onCursor, onSelection, onView };
    this.view = { t0: 0, t1: 10, x: [0, 1], v: [-0.5, 0.5] };
    this.auto = true; this.tool = 'probe'; this.joined = true; this.showTruth = false; this.extend = true;
    this.cursorA = null; this.cursorB = null; this.useB = false; this.sel = null;
    this.vm = []; this.fits = []; this.geo = {}; this.size = {};
    this.C = {}; this.dpr = 1; this._ptr = new Map(); this._drag = null;
    this.refreshColors();
    for (const k of ['x', 'v']) this._bind(k);
    new ResizeObserver(() => this.resize()).observe(canvasX.parentElement);
    new ResizeObserver(() => this.resize()).observe(canvasV.parentElement);
  }

  refreshColors() {
    const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue('--' + n).trim();
    for (const n of ['surface', 'ink', 'muted', 'grid', 's1', 's2', 'hot', 'accent', 'sel'])
      this.C[n] = g(n);
  }
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    for (const k of ['x', 'v']) {
      const c = this.cvs[k], w = Math.max(60, c.clientWidth), h = Math.max(40, c.clientHeight);
      c.width = Math.round(w * this.dpr); c.height = Math.round(h * this.dpr);
      this.size[k] = { w, h };
    }
    this.draw();
  }

  // ---- modello dati ----
  setModel(vm, fits) {
    this.vm = vm; this.fits = fits;
    if (this.auto) this.autoscale(false);
  }
  active() { return this.vm.find((e) => e.active); }

  _range(e) {
    const t = e.t; let i0 = 0, i1 = t.length - 1;
    if (e.crop) {
      i0 = t.findIndex((q) => q >= e.crop[0] - 1e-9);
      let j = -1; for (let i = t.length - 1; i >= 0; i--) if (t[i] <= e.crop[1] + 1e-9) { j = i; break; }
      i1 = j;
      if (i0 < 0) i0 = t.length;
    }
    return [i0, i1];
  }

  autoscale(userAction = true) {
    if (userAction) this.auto = true;
    let t0 = Infinity, t1 = -Infinity;
    const ext = { x: [Infinity, -Infinity], v: [Infinity, -Infinity] };
    for (const e of this.vm) {
      if (e.fixedT) { t0 = Math.min(t0, e.fixedT[0] + e.offset); t1 = Math.max(t1, e.fixedT[1] + e.offset); }
      const [i0, i1] = this._range(e);
      if (i1 < i0) continue;
      if (!e.fixedT) { t0 = Math.min(t0, e.t[i0] + e.offset); t1 = Math.max(t1, e.t[i1] + e.offset); }
      for (const k of ['x', 'v']) for (const s of [0, 1]) {
        const a = e[k][s];
        for (let i = i0; i <= i1; i++) { const q = a[i]; if (Number.isFinite(q) && (k === 'x' || Math.abs(q) <= 2.5)) { if (q < ext[k][0]) ext[k][0] = q; if (q > ext[k][1]) ext[k][1] = q; } }
      }
    }
    if (!Number.isFinite(t0)) { t0 = 0; t1 = 10; }
    if (t1 - t0 < 1e-6) t1 = t0 + 1;
    const pad = (r, minSpan) => {
      let [a, b] = r;
      if (!Number.isFinite(a)) { a = -minSpan / 2; b = minSpan / 2; }
      if (b - a < minSpan) { const m = (a + b) / 2; a = m - minSpan / 2; b = m + minSpan / 2; }
      const p = (b - a) * 0.08; return [a - p, b + p];
    };
    this.view.t0 = t0; this.view.t1 = t1;
    this.view.x = pad(ext.x, 0.1); this.view.v = pad(ext.v, 0.2);
    this.cb.onView?.();
  }

  // ---- disegno ----
  draw() {
    for (const k of ['x', 'v']) this._plot(k);
  }

  _plot(kind) {
    const ctx = this.ctx[kind], { w: W, h: H } = this.size[kind] || { w: 100, h: 100 }, C = this.C, v = this.view;
    const bottom = kind === 'v', mb = bottom ? 24 : 6, pw = W - ML - MR, ph = H - MT - mb;
    const y = v[kind];
    this.geo[kind] = { W, H, mb, pw, ph };
    const tx = (t) => ML + (t - v.t0) / (v.t1 - v.t0) * pw;
    const ty = (q) => MT + ph - (q - y[0]) / (y[1] - y[0]) * ph;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.surface; ctx.fillRect(0, 0, W, H);
    ctx.font = FONT; ctx.textBaseline = 'middle';

    // griglia e tacche
    const ty_ = ticks(y[0], y[1], Math.max(3, Math.floor(ph / 26)));
    const tt_ = ticks(v.t0, v.t1, Math.max(3, Math.floor(pw / 80)));
    ctx.lineWidth = 1; ctx.strokeStyle = C.grid;
    ctx.beginPath();
    for (const q of ty_.list) { const yy = Math.round(ty(q)) + .5; ctx.moveTo(ML, yy); ctx.lineTo(W - MR, yy); }
    for (const t of tt_.list) { const xx = Math.round(tx(t)) + .5; ctx.moveTo(xx, MT); ctx.lineTo(xx, MT + ph); }
    ctx.stroke();
    // asse zero
    if (y[0] < 0 && y[1] > 0) { ctx.strokeStyle = C.ink; ctx.globalAlpha = .45; ctx.beginPath(); ctx.moveTo(ML, ty(0)); ctx.lineTo(W - MR, ty(0)); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = C.muted; ctx.textAlign = 'right';
    const dy = decimals(ty_.step);
    for (const q of ty_.list) ctx.fillText(q.toFixed(dy), ML - 6, ty(q));
    if (bottom) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const dt = decimals(tt_.step);
      for (const t of tt_.list) ctx.fillText(t.toFixed(dt), tx(t), MT + ph + 5);
      ctx.textAlign = 'right'; ctx.fillText('t (s)', ML - 8, MT + ph + 5);
      ctx.textBaseline = 'middle';
    }
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
    ctx.fillText(kind === 'x' ? 'x (m)' : 'v (m/s)', ML + 6, MT + 8);

    // bordo
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(ML, MT, pw, ph);

    ctx.save();
    ctx.beginPath(); ctx.rect(ML, MT, pw, ph); ctx.clip();

    // selezione
    if (this.sel) {
      const a = tx(this.sel.t0), b = tx(this.sel.t1);
      ctx.fillStyle = C.sel; ctx.fillRect(Math.min(a, b), MT, Math.abs(b - a), ph);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(a, MT); ctx.lineTo(a, MT + ph); ctx.moveTo(b, MT); ctx.lineTo(b, MT + ph); ctx.stroke(); ctx.setLineDash([]);
    }

    // minimo misurabile (solo posizione)
    if (kind === 'x') {
      for (const s of [0, 1]) {
        const d = this.vm.find((e) => e.active)?.deadLine?.[s];
        if (d == null) continue;
        ctx.strokeStyle = C['s' + (s + 1)]; ctx.globalAlpha = .55; ctx.setLineDash([2, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ML, ty(d)); ctx.lineTo(W - MR, ty(d)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }

    // serie: prima le corse non attive, poi quella attiva
    const order = [...this.vm].sort((a, b) => (a.active ? 1 : 0) - (b.active ? 1 : 0));
    for (const e of order) {
      const [i0, i1] = this._range(e);
      if (i1 < i0) continue;
      const al = e.active ? 1 : 0.26, r = e.active ? 3 : 2;
      for (const s of [0, 1]) {
        const col = C['s' + (s + 1)], arr = e[kind][s];
        ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.fillStyle = col;
        if (this.joined) {
          ctx.lineWidth = e.active ? 1.8 : 1.4; ctx.beginPath();
          let pen = false;
          for (let i = i0; i <= i1; i++) {
            const q = arr[i];
            if (!Number.isFinite(q)) { pen = false; continue; }
            const X = tx(e.t[i] + e.offset), Y = ty(q);
            if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
          }
          ctx.stroke();
        }
        for (let i = i0; i <= i1; i++) {
          const q = arr[i];
          if (!Number.isFinite(q)) continue;
          const X = tx(e.t[i] + e.offset), Y = ty(q);
          if (X < ML - 4 || X > W - MR + 4) continue;
          ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (e.active && this.showTruth && e.truth) {
          const T = e.truth;
          ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.globalAlpha = .75;
          ctx.beginPath(); let pen = false;
          for (let i = 0; i < T.t.length; i++) {
            const q = T[kind][s][i];
            if (!Number.isFinite(q)) { pen = false; continue; }
            const X = tx(T.t[i] + e.offset), Y = ty(q);
            if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
          }
          ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
      }
    }

    // rette di fit
    for (const f of this.fits) {
      if (f.graph !== kind) continue;
      const col = C['s' + (f.sensor + 1)];
      const seg = (a, b, wd, dash, al) => {
        ctx.beginPath(); ctx.lineWidth = wd; ctx.setLineDash(dash); ctx.globalAlpha = al; ctx.strokeStyle = col;
        const n = f.fit.deg === 2 ? 60 : 2;
        for (let i = 0; i <= n; i++) {
          const t = a + (b - a) * i / n, X = tx(t + f.offset), Y = ty(evalFit(f.fit, t));
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      };
      if (this.extend) {
        const a = v.t0 - f.offset, b = v.t1 - f.offset;
        seg(a, f.fit.t0, 2, [6, 4], .7); seg(f.fit.t1, b, 2, [6, 4], .7);
      }
      // alone chiaro + tratto del colore, così si distingue dai dati
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.lineWidth = 6; ctx.strokeStyle = C.surface; ctx.globalAlpha = .9;
      for (let i = 0; i <= (f.fit.deg === 2 ? 60 : 2); i++) { const n = f.fit.deg === 2 ? 60 : 2, t = f.fit.t0 + (f.fit.t1 - f.fit.t0) * i / n, X = tx(t + f.offset), Y = ty(evalFit(f.fit, t)); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
      ctx.stroke(); ctx.globalAlpha = 1;
      seg(f.fit.t0, f.fit.t1, 3, [], 1);
      ctx.lineCap = 'butt';
      if (f.label) {
        const t = f.fit.t1, X = Math.min(W - MR - 4, tx(t + f.offset)), Y = ty(evalFit(f.fit, t));
        ctx.font = FONT; ctx.textAlign = X > W * .6 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
        const tw = ctx.measureText(f.label).width, lx = ctx.textAlign === 'right' ? X - 6 : X + 6;
        ctx.fillStyle = C.surface; ctx.globalAlpha = .88;
        ctx.fillRect(ctx.textAlign === 'right' ? lx - tw - 3 : lx - 3, Y - 20, tw + 6, 16);
        ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillText(f.label, lx, Y - 6);
        ctx.textBaseline = 'middle';
      }
    }

    // cursori
    const act = this.active();
    for (const [name, t] of [['A', this.cursorA], ['B', this.useB ? this.cursorB : null]]) {
      if (t == null) continue;
      const X = tx(t);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X, MT); ctx.lineTo(X, MT + ph); ctx.stroke(); ctx.setLineDash([]);
      if (act) {
        const i = this._nearestIdx(act, t);
        for (const s of [0, 1]) {
          const q = act[kind][s][i];
          if (!Number.isFinite(q)) continue;
          ctx.fillStyle = C.surface; ctx.strokeStyle = C['s' + (s + 1)]; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(X, ty(q), 5.5, 0, 6.2832); ctx.fill(); ctx.stroke();
        }
      }
      ctx.fillStyle = C.ink; ctx.fillRect(X - 7, MT, 14, 14);
      ctx.fillStyle = C.surface; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, X, MT + 7.5);
    }
    ctx.restore();

    if (!this.vm.length) {
      ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = FONT;
      ctx.fillText(this.emptyMsg || '', ML + pw / 2, MT + ph / 2);
    }
  }

  // ---- utilità ----
  _nearestIdx(e, tDisp) {
    const tr = tDisp - e.offset, t = e.t; let best = 0, bd = Infinity;
    for (let i = 0; i < t.length; i++) { const d = Math.abs(t[i] - tr); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  snap(tDisp) {
    const e = this.active();
    if (!e || !e.t.length) return tDisp;
    const [i0, i1] = this._range(e);
    let i = this._nearestIdx(e, tDisp);
    i = Math.min(Math.max(i, i0), Math.max(i0, i1));
    return e.t[i] + e.offset;
  }
  _t(kind, px) { const g = this.geo[kind], v = this.view; return v.t0 + (px - ML) / g.pw * (v.t1 - v.t0); }
  _px(kind, t) { const g = this.geo[kind], v = this.view; return ML + (t - v.t0) / (v.t1 - v.t0) * g.pw; }
  _yv(kind, py) { const g = this.geo[kind], y = this.view[kind]; return y[0] + (MT + g.ph - py) / g.ph * (y[1] - y[0]); }

  // ---- interazione ----
  _bind(kind) {
    const c = this.cvs[kind];
    c.addEventListener('pointerdown', (ev) => this._down(kind, ev));
    c.addEventListener('pointermove', (ev) => this._move(kind, ev));
    const up = (ev) => this._up(kind, ev);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (ev) => this._wheel(kind, ev), { passive: false });
  }
  _pos(kind, ev) { const r = this.cvs[kind].getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }

  _down(kind, ev) {
    this.cvs[kind].setPointerCapture(ev.pointerId);
    const p = this._pos(kind, ev);
    this._ptr.set(ev.pointerId, p);
    if (this._ptr.size === 2) {
      this._wait = null;
      this._drag = { mode: 'pinch', kind, base: this._pinchState(kind), view: JSON.parse(JSON.stringify(this.view)) };
      return;
    }
    // Col dito, in lettura e selezione, si aspetta di capire il verso del gesto:
    // verticale = scorrimento della pagina (gestito dal browser), orizzontale = lettura.
    if (ev.pointerType === 'touch' && this.tool !== 'pan') { this._wait = { kind, p }; return; }
    ev.preventDefault();
    this._begin(kind, p);
  }
  _begin(kind, p) {
    const t = this._t(kind, p[0]);
    if (this.tool === 'probe') {
      this._drag = { mode: 'cursor', kind, which: this._pickCursor(kind, p[0]) };
      this._setCursor(this._drag.which, t);
    } else if (this.tool === 'select') {
      let edge = null;
      if (this.sel) {
        if (Math.abs(this._px(kind, this.sel.t0) - p[0]) < 12) edge = 't0';
        else if (Math.abs(this._px(kind, this.sel.t1) - p[0]) < 12) edge = 't1';
      }
      if (edge) this._drag = { mode: 'edge', kind, edge };
      else { this.sel = { t0: this.snap(t), t1: this.snap(t) }; this._drag = { mode: 'new', kind, anchor: this.sel.t0 }; }
    } else {
      this._drag = { mode: 'pan', kind, p0: p, view: JSON.parse(JSON.stringify(this.view)) };
    }
  }
  _pickCursor(kind, px) {
    if (!this.useB || this.cursorB == null) return 'A';
    if (this.cursorA == null) return 'A';
    const da = Math.abs(this._px(kind, this.cursorA) - px), db = Math.abs(this._px(kind, this.cursorB) - px);
    return db < da ? 'B' : 'A';
  }
  _setCursor(which, t) {
    const s = this.snap(t);
    if (which === 'A') this.cursorA = s; else this.cursorB = s;
    this.cb.onCursor?.();
    this.draw();
  }
  _move(kind, ev) {
    if (!this._ptr.has(ev.pointerId)) return;
    const p = this._pos(kind, ev);
    this._ptr.set(ev.pointerId, p);
    if (this._wait) {
      const dx = p[0] - this._wait.p[0], dy = p[1] - this._wait.p[1];
      if (Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) { const w = this._wait; this._wait = null; this._begin(w.kind, w.p); }
      else { if (Math.abs(dy) > 8) this._wait = null; return; }
    }
    const d = this._drag;
    if (!d) return;
    if (d.mode === 'pinch' && this._ptr.size >= 2) { this._pinch(d); return; }
    if (d.mode === 'cursor') this._setCursor(d.which, this._t(d.kind, p[0]));
    else if (d.mode === 'new') {
      const t = this.snap(this._t(d.kind, p[0]));
      this.sel = { t0: Math.min(d.anchor, t), t1: Math.max(d.anchor, t) };
      this.cb.onSelection?.(this.sel, false); this.draw();
    } else if (d.mode === 'edge') {
      const t = this.snap(this._t(d.kind, p[0]));
      this.sel = { ...this.sel, [d.edge]: t };
      if (this.sel.t0 > this.sel.t1) this.sel = { t0: this.sel.t1, t1: this.sel.t0 };
      if (d.edge === 't0' && this.sel.t0 === this.sel.t1) { /* stesso punto */ }
      this.cb.onSelection?.(this.sel, false); this.draw();
    } else if (d.mode === 'pan') {
      const g = this.geo[d.kind], v = d.view, dx = p[0] - d.p0[0], dy = p[1] - d.p0[1];
      const dt = -dx / g.pw * (v.t1 - v.t0), yy = v[d.kind], dq = dy / g.ph * (yy[1] - yy[0]);
      this.view.t0 = v.t0 + dt; this.view.t1 = v.t1 + dt;
      this.view[d.kind] = [yy[0] + dq, yy[1] + dq];
      this.auto = false; this.cb.onView?.(); this.draw();
    }
  }
  _up(kind, ev) {
    if (this._wait && ev.type === 'pointerup') { const w = this._wait; this._wait = null; this._begin(w.kind, w.p); }   // tocco breve
    this._wait = null;
    this._ptr.delete(ev.pointerId);
    const d = this._drag;
    if (d && (d.mode === 'new' || d.mode === 'edge')) {
      if (this.sel && this.sel.t1 - this.sel.t0 < 1e-9) this.sel = null;
      this.cb.onSelection?.(this.sel, true); this.draw();
    }
    if (this._ptr.size < 2 && d?.mode === 'pinch') this._drag = null;
    if (this._ptr.size === 0) this._drag = null;
  }
  _pinchState(kind) {
    const [a, b] = [...this._ptr.values()];
    return { dx: Math.max(10, Math.abs(a[0] - b[0])), dy: Math.max(10, Math.abs(a[1] - b[1])), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
  }
  _pinch(d) {
    const cur = this._pinchState(d.kind), g = this.geo[d.kind], v = d.view;
    const kx = d.base.dx / cur.dx, ky = d.base.dy / cur.dy;
    const tc = v.t0 + (d.base.cx - ML) / g.pw * (v.t1 - v.t0);
    this.view.t0 = tc - (tc - v.t0) * kx; this.view.t1 = tc + (v.t1 - tc) * kx;
    const yy = v[d.kind], yc = yy[0] + (MT + g.ph - d.base.cy) / g.ph * (yy[1] - yy[0]);
    this.view[d.kind] = [yc - (yc - yy[0]) * ky, yc + (yy[1] - yc) * ky];
    this.auto = false; this.cb.onView?.(); this.draw();
  }
  _wheel(kind, ev) {
    ev.preventDefault();
    const [px, py] = this._pos(kind, ev), k = Math.exp(ev.deltaY * 0.0015), v = this.view, g = this.geo[kind];
    if (!ev.shiftKey) {
      const tc = this._t(kind, px);
      v.t0 = tc - (tc - v.t0) * k; v.t1 = tc + (v.t1 - tc) * k;
    }
    if (ev.shiftKey || ev.ctrlKey) {
      const yy = v[kind], yc = this._yv(kind, py);
      v[kind] = [yc - (yc - yy[0]) * k, yc + (yy[1] - yc) * k];
    }
    this.auto = false; this.cb.onView?.(); this.draw();
  }
}
