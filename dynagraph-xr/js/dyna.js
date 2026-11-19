// Dynagraph XR · dyna.js
// Modello puro (nessun DOM, nessun THREE): assi paralleli con vista (centro, mezza ampiezza), catena x → f(x) → h(f(x)),
// connessioni 2→3 / 1→3 / entrambe, campionamento, traccia, tacche, stato nel link.
// UMD: in Node `require`, nel browser globale `Dyna`.
(function (root) {
  "use strict";
  const R = 4;                      // un asse va da −R a R in unità del palco
  const EDGE = R + 0.7;             // oltre questo i punti restano sul bordo (fuori vista)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const HR_MIN = 0.02, HR_MAX = 1e5;

  // Colori selezionabili per f, g, h: palette Okabe-Ito (leggibile con daltonismo), chiara e scura.
  const COLORS = [
    { light: "#C96A00", dark: "#FFB44D" },  // arancione
    { light: "#0F9A63", dark: "#3DDC97" },  // verde
    { light: "#6E3FE0", dark: "#B59CFF" },  // viola
    { light: "#1070C0", dark: "#5BB4FF" },  // blu
    { light: "#C2255C", dark: "#FF7AA5" },  // rosa
    { light: "#0B7F8A", dark: "#4FD8E4" },  // turchese
    { light: "#8A6D00", dark: "#E8CC4A" },  // ocra
    { light: "#5B6070", dark: "#B7BDCB" },  // grigio
  ];
  const KEYS = ["f", "g", "h"];
  const DEFAULT_COLORS = { f: 0, g: 1, h: 2 };
  const CONNS = ["2_to_3", "1_to_3", "both"];

  // ---------- vista di un asse: valore ↔ posizione sul palco ----------
  const newView = () => ({ c: 0, hr: 5 });
  const valToX = (v, w) => ((v - w.c) / w.hr) * R;
  const xToVal = (X, w) => w.c + (X / R) * w.hr;
  const inView = (v, w) => Number.isFinite(v) && Math.abs(valToX(v, w)) <= R + 1e-9;
  const edgeX = (v, w) => clamp(valToX(v, w), -EDGE, EDGE);
  function zoom(w, k) { const hr = clamp(w.hr / k, HR_MIN, HR_MAX); return { c: w.c, hr }; }
  function pan(w, dX) { return { c: w.c - (dX / R) * w.hr, hr: w.hr }; }   // trascinare l'asse verso destra sposta la vista a sinistra
  function setRange(w, lo, hi) {
    if (!(Number.isFinite(lo) && Number.isFinite(hi)) || hi <= lo) return w;
    return { c: (lo + hi) / 2, hr: clamp((hi - lo) / 2, HR_MIN, HR_MAX) };
  }
  const range = (w) => [w.c - w.hr, w.c + w.hr];

  // Passo "tondo" delle tacche: 1, 2 o 5 per una potenza di dieci, circa 8 tacche per asse.
  function niceStep(hr) {
    const raw = (2 * hr) / 8, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function ticks(w) {
    const s = niceStep(w.hr), [lo, hi] = range(w), out = [];
    for (let k = Math.ceil(lo / s - 1e-9); k * s <= hi + 1e-9 && out.length < 40; k++) out.push(Math.round(k * s * 1e9) / 1e9);
    return { step: s, values: out };
  }

  // ---------- catena: x → f(x) → h(f(x)) ----------
  // fns: { f, g, h } funzioni numeriche (NaN se non definite). key: "f" o "g". Se h non è attiva hv è NaN.
  function chain(fns, key, x, hOn) {
    const y = fns[key](x), hv = hOn && Number.isFinite(y) ? fns.h(y) : NaN;
    return { x, y, hv };
  }
  // Quali segmenti si disegnano: IN→OUT (l12), OUT→COMP (l23), IN→COMP diretto (l13).
  function lines(conn, hOn) {
    if (!hOn) return { l12: true, l23: false, l13: false };
    return { l12: conn !== "1_to_3", l23: conn !== "1_to_3", l13: conn !== "2_to_3" };
  }
  const nextConn = (c) => CONNS[(CONNS.indexOf(c) + 1) % CONNS.length];

  // ---------- campionamento: ingressi regolari dentro la vista di IN ----------
  // density 0.1…30 (come Dynagraph: 10 → un campione ogni 0,25 unità a 40 px/unità); interval, start, end opzionali.
  function sampleXs(view, o, cur, cap) {
    cap = cap || 160;
    const [lo, hi] = range(view), a = o.start !== null && o.start !== undefined ? Math.max(lo, o.start) : lo, b = o.end !== null && o.end !== undefined ? Math.min(hi, o.end) : hi;
    if (!(b > a)) return [];
    let step = o.interval > 0 ? o.interval : (view.hr / 5) * (2.5 / clamp(o.density || 10, 0.1, 30));
    step = Math.max(step, (b - a) / cap);
    const ref = o.interval > 0 && o.start !== null && o.start !== undefined ? o.start : 0, out = [];
    for (let k = Math.ceil((a - ref) / step - 1e-9); ref + k * step <= b + 1e-9 && out.length < cap; k++) {
      const x = Math.round((ref + k * step) * 1e7) / 1e7;
      if (Math.abs(x - cur) > step * 0.02) out.push(x);
    }
    return out;
  }

  // ---------- grafico cartesiano: la curva y = fn(x) nel riquadro [−1, 1]² (x da xw, y da yw), spezzata dove non è definita, esce o salta ----------
  function curve(fn, xw, yw, N) {
    N = N || 200;
    const segs = []; let cur = [], prev = null;
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N, y = fn(xw.c + u * xw.hr), v = (y - yw.c) / yw.hr, ok = Number.isFinite(v) && Math.abs(v) <= 1 + 1e-9;
      const jump = ok && prev !== null && Math.abs(v - prev) > 0.8;
      if (!ok || jump) { if (cur.length > 1) segs.push(cur); cur = []; }
      if (ok) cur.push([u, v]);
      prev = ok ? v : null;
    }
    if (cur.length > 1) segs.push(cur);
    return segs;
  }

  // ---------- traccia: ultime posizioni dell'ingresso (come `traces` di Dynagraph), con un passo minimo ----------
  function Trace(max) { this.max = max || 120; this.pts = []; }
  Trace.prototype.setMax = function (n) { this.max = Math.max(2, n | 0); if (this.pts.length > this.max) this.pts.splice(0, this.pts.length - this.max); };
  Trace.prototype.clear = function () { this.pts = []; };
  Trace.prototype.push = function (x, minStep) {
    const l = this.pts[this.pts.length - 1];
    if (l !== undefined && Math.abs(l - x) < (minStep || 0)) return false;
    this.pts.push(x); if (this.pts.length > this.max) this.pts.shift(); return true;
  };
  // fascia di età 0 (più vecchia) … nb−1 (più recente) per l'elemento i di n
  const bucket = (i, n, nb) => Math.min(nb - 1, Math.floor((i / Math.max(1, n)) * nb));

  // ---------- stato nel link ----------
  const DEFAULTS = { f: "x + 1", g: "x^2 / 2", h: "sin(x)", xf: 1, xg: 1, link: false, conn: "2_to_3", hOn: false, cart: false, full: true, pulse: false };
  const f2 = (v) => String(+(+v).toFixed(4));
  function toQuery(s) {
    const q = new URLSearchParams({ f: s.f, g: s.g, h: s.h, xf: f2(s.xf), xg: f2(s.xg) });
    if (s.link) q.set("link", "1"); if (s.hOn) q.set("ho", "1"); if (s.conn !== "2_to_3") q.set("cn", s.conn); if (s.cart) q.set("ca", "1");
    if (!s.full) q.set("fl", "0");
    for (const k of KEYS) if (s.col && s.col[k] !== DEFAULT_COLORS[k]) q.set("c" + k, s.col[k]);
    for (const k of ["in", "out", "comp"]) { const w = s.view && s.view[k]; if (w && (w.c !== 0 || w.hr !== 5)) q.set("v" + k, f2(w.c) + ":" + f2(w.hr)); }
    return q.toString();
  }
  function fromQuery(str, parseNum) {
    const pn = parseNum || ((v) => parseFloat(String(v).replace(",", ".")));
    const q = new URLSearchParams(String(str || "").replace(/^#/, ""));
    if (!q.has("f") && !q.has("g") && !q.has("h")) return null;
    const s = Object.assign({}, DEFAULTS), num = (k, d) => { const v = pn(q.get(k)); return Number.isFinite(v) ? v : d; };
    for (const k of KEYS) if (q.has(k)) s[k] = q.get(k);
    s.xf = num("xf", s.xf); s.xg = num("xg", s.xg);
    s.link = q.get("link") === "1"; s.hOn = q.get("ho") === "1"; s.cart = q.get("ca") === "1"; s.full = q.get("fl") !== "0";
    s.conn = CONNS.includes(q.get("cn")) ? q.get("cn") : "2_to_3";
    s.col = {}; for (const k of KEYS) { const c = q.has("c" + k) ? +q.get("c" + k) : -1; s.col[k] = Number.isInteger(c) && c >= 0 && c < COLORS.length ? c : DEFAULT_COLORS[k]; }
    s.view = {};
    for (const k of ["in", "out", "comp"]) {
      const m = /^(-?[\d.]+):([\d.]+)$/.exec(q.get("v" + k) || ""), c = m ? +m[1] : 0, hr = m ? +m[2] : 5;
      s.view[k] = m && Number.isFinite(c) && hr > 0 ? { c, hr: clamp(hr, HR_MIN, HR_MAX) } : newView();
    }
    return s;
  }

  const api = { R, EDGE, COLORS, KEYS, DEFAULT_COLORS, CONNS, DEFAULTS, newView, valToX, xToVal, inView, edgeX, zoom, pan, setRange, range, niceStep, ticks,
    chain, lines, nextConn, sampleXs, curve, Trace, bucket, toQuery, fromQuery, clamp };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Dyna = api;
})(typeof window !== "undefined" ? window : globalThis);
