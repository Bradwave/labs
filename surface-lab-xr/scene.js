/* scene.js — formato delle scene: validazione, codice breve (da incollare o da trasformare in QR) e confronto di pose.
   Una scena è un oggetto JSON semplice (versione 1): sistema di riferimento, piano, superfici con la loro posa.
   Nessun THREE, nessun DOM: testabile in Node. Core serve solo a riconoscere i preset e a controllare le equazioni. */
(function (root) {
  'use strict';

  const MAX_SURFACES = 6, PREFIX = 's3d1.';
  const num = (v, d, lo, hi) => { v = +v; if (!isFinite(v)) return d; return Math.min(hi === undefined ? 1e6 : hi, Math.max(lo === undefined ? -1e6 : lo, v)); };
  const str = (v, d, max) => typeof v === 'string' ? v.slice(0, max || 300) : d;
  const vec = (a, n, d) => Array.isArray(a) && a.length === n ? a.map((x, i) => num(x, d[i])) : d.slice();
  const quat = a => { const q = vec(a, 4, [0, 0, 0, 1]), l = Math.hypot(q[0], q[1], q[2], q[3]); return l < 1e-9 ? [0, 0, 0, 1] : q.map(x => x / l); };
  const pose = (o, ds, dp) => ({ p: vec(o && o.p, 3, dp || [0, 0, 0]), q: quat(o && o.q), s: num(o && o.s, ds === undefined ? 1 : ds, 0.01, 100) });

  const PARAM_KEYS = ['a', 'b', 'c', 'd', 'k', 'm', 'n'];
  const bounds = b => { // scatola [x0,x1,y0,y1,z0,z1] valida, o null
    if (!Array.isArray(b) || b.length !== 6) return null;
    const v = b.map(x => num(x, NaN, -10, 10)); if (v.some(x => x !== x)) return null;
    return v[0] < v[1] && v[2] < v[3] && v[4] < v[5] ? v : null;
  };
  const pars = o => { const r = {}; if (o && typeof o === 'object') PARAM_KEYS.forEach(k => { if (o[k] !== undefined) r[k] = num(o[k], 1, -50, 50); }); return r; };

  // Rende sicura una scena letta da fuori. Restituisce { ok, scene, errors }. Le superfici con equazioni non valide vengono scartate.
  function validate(raw, Core) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return { ok: false, scene: null, errors: ['formato non riconosciuto'] };
    const out = { v: 1, name: str(raw.name, '', 80), frame: raw.frame ? pose(raw.frame, 0.16, [0, 1.3, -0.7]) : null, planeOn: raw.planeOn !== false, clipOn: raw.clipOn !== false,
      clipSide: raw.clipSide === -1 ? -1 : 1, snapOn: raw.snapOn !== false, surfaces: [], sel: 0 };
    if (raw.plane && raw.plane.theta !== undefined) out.plane = { theta: num(raw.plane.theta, 0, 0, 180), phi: num(raw.plane.phi, 0, 0, 360), d: num(raw.plane.d, 0.5, -2.5, 2.5) };
    else out.plane = { p: vec(raw.plane && raw.plane.p, 3, [0, 0, 0.5]), q: quat(raw.plane && raw.plane.q) };
    (Array.isArray(raw.surfaces) ? raw.surfaces : []).slice(0, MAX_SURFACES).forEach((r, i) => {
      if (!r || typeof r !== 'object') { errors.push('superficie ' + (i + 1) + ' non valida'); return; }
      const s = Object.assign({ vis: r.vis !== false, pal: r.pal === undefined ? undefined : Math.round(num(r.pal, 0, 0, 5)) }, pose(r));
      const pr = r.pre && Core ? Core.presetById(str(r.pre, '', 60)) : null;
      const pp = pars(r.par); if (Object.keys(pp).length) s.par = pp;
      if (pr) { s.pre = pr.id; if (r.R !== undefined && pr.kind === 'implicit') s.R = num(r.R, pr.R, 0.5, 10); if (r.N !== undefined) s.N = Math.round(num(r.N, pr.N, 16, 96)); }
      else {
        const kind = r.kind === 'param' ? 'param' : 'implicit';
        s.kind = kind; s.name = str(r.name, 'Personalizzata', 60); s.N = Math.round(num(r.N, 48, 16, 96)); s.twoSided = !!r.twoSided; s.cone = !!r.cone;
        try {
          if (kind === 'param') {
            ['fx', 'fy', 'fz', 'u0', 'u1', 'v0', 'v1'].forEach(k => { s[k] = str(r[k], '', 200); });
            if (Core) { Core.compileParam(s.fx, s.fy, s.fz, s.par); ['u0', 'u1', 'v0', 'v1'].forEach(k => Core.evalNumber(s[k])); }
          } else {
            s.eq = str(r.eq, '', 200); s.R = num(r.R, 2, 0.5, 10);
            if (Core) Core.compile(s.eq, s.par);
          }
        } catch (e) { errors.push('superficie ' + (i + 1) + ': ' + e.message); return; }
      }
      { const bb = s.kind === 'param' || (pr && pr.kind === 'param') ? null : bounds(r.b); if (bb) s.b = bb; }
      out.surfaces.push(s);
    });
    if (!out.surfaces.length) return { ok: false, scene: null, errors: errors.concat('nessuna superficie valida') };
    out.sel = Math.min(out.surfaces.length - 1, Math.max(0, Math.round(num(raw.sel, 0, 0, 5))));
    return { ok: true, scene: out, errors: errors };
  }

  // codice breve: s3d1. + base64url del JSON (numeri a 4 decimali)
  const round = (k, v) => typeof v === 'number' ? Math.round(v * 10000) / 10000 : v;
  function b64u(s) {
    const b = typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(s)));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(t) {
    const b = t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4);
    return typeof Buffer !== 'undefined' ? Buffer.from(b, 'base64').toString('utf8') : decodeURIComponent(escape(atob(b)));
  }
  function encode(scene) { return PREFIX + b64u(JSON.stringify(scene, round)); }
  function decode(code, Core) {
    try {
      const m = /s3d1\.([A-Za-z0-9_-]+)/.exec(String(code || ''));   // il codice è la prima sequenza continua dopo il prefisso
      if (!m) return { ok: false, scene: null, errors: ['non è un codice scena'] };
      return validate(JSON.parse(unb64u(m[1])), Core);
    } catch (e) { return { ok: false, scene: null, errors: ['codice danneggiato'] }; }
  }

  // ---------- confronto di pose (cronologia dei gesti) ----------
  // a, b = { p:[x,y,z], q:[x,y,z,w], s }
  function delta(a, b) {
    const d = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
    const dot = Math.min(1, Math.abs(a.q[0] * b.q[0] + a.q[1] * b.q[1] + a.q[2] * b.q[2] + a.q[3] * b.q[3]));
    return { dist: d, angle: 2 * Math.acos(dot) * 180 / Math.PI, ratio: b.s / a.s };
  }
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  function describeDelta(a, b) { // parole: cosa è successo in un gesto
    const d = delta(a, b), t = [];
    if (d.dist > 0.005) t.push('spostata di ' + f2(d.dist));
    if (d.angle > 0.5) t.push('ruotata di ' + Math.round(d.angle) + '°');
    if (Math.abs(d.ratio - 1) > 0.005) t.push((d.ratio > 1 ? 'ingrandita ×' : 'rimpicciolita ×') + f2(d.ratio));
    return t.length ? t.join(' · ') : 'nessun cambiamento';
  }
  const changed = (a, b) => { const d = delta(a, b); return d.dist > 0.005 || d.angle > 0.5 || Math.abs(d.ratio - 1) > 0.005; };

  // ---------- lezioni: scene preparate (sempre disponibili, anche senza rete) ----------
  const base = (name, note, pre, plane, extra) => ({ id: 'lez-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: name, note: note,
    data: Object.assign({ v: 1, name: name, plane: plane, surfaces: [{ pre: pre }] }, extra || {}) });
  const LESSONS = [
    base('Circonferenza', 'Un piano perpendicolare all’asse taglia il cono in una circonferenza.', 'cono', { theta: 0, phi: 0, d: 0.5 }),
    base('Ellisse', 'Inclinando poco il piano si ottiene un’ellisse.', 'cono', { theta: 20, phi: 0, d: 0.4 }),
    base('Parabola', 'Piano parallelo a una generatrice: parabola.', 'cono', { theta: 45, phi: 0, d: 0.5 }),
    base('Iperbole', 'Piano più inclinato della generatrice: iperbole, un ramo per ogni falda.', 'cono', { theta: 75, phi: 0, d: 0.5 }),
    base('Sfera', 'Ogni sezione piana di una sfera è una circonferenza.', 'sfera', { theta: 0, phi: 0, d: 0.6 }),
    base('Paraboloide', 'Il paraboloide ellittico: sezioni orizzontali circolari, verticali paraboliche.', 'paraboloide-ellittico', { theta: 0, phi: 0, d: 1 }),
    base('Iperboloide', 'L’iperboloide a una falda: la gola è una circonferenza.', 'iperboloide-1', { theta: 0, phi: 0, d: 0 }),
    base('Sella', 'Il paraboloide iperbolico: sezioni orizzontali iperboliche.', 'paraboloide-iperbolico', { theta: 0, phi: 0, d: 0.5 })
  ];
  const DEFAULT_SCENE = { v: 1, name: 'Nuova scena', plane: { theta: 0, phi: 0, d: 0.5 }, surfaces: [{ pre: 'cono' }] };

  const api = { validate: validate, encode: encode, decode: decode, delta: delta, describeDelta: describeDelta, changed: changed, LESSONS: LESSONS, DEFAULT_SCENE: DEFAULT_SCENE, MAX_SURFACES: MAX_SURFACES, PREFIX: PREFIX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SceneIO = api;
})(typeof window !== 'undefined' ? window : globalThis);
