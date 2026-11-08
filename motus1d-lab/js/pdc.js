/* Predict · Discuss · Compare: activities made of tasks, tasks made of steps.
   The groups share one device: one student drives, the others watch and discuss. Predictions are
   committed before anything is revealed; the comparison shows differences, never scores.

   Activity  { v, id?, group, title, desc, tasks: [Task] }        every text is a string or { it, en }
   Task      { title, ref?, setup: { s: [lo, hi], t: [0, T], v?, a? }, key?: [Section] | 'secret', steps: [Step] }
             key 'secret': the reference is the s(t) entered on a private handover screen
   Section   { kind: 's'|'v'|'a'|'u', f?, s0?, v0?, a?, end }      the first section carries s0 (and v0)
   Step      show { text?, graphs?, eq? } · think { prompt, timer? } · ask { items, why? }
             act { kind: 'move', live, clock, start?, prompt } · act { kind: 'draw', q, prompt }
             act { kind: 'write', prompt } (an equation s(t)) · handover { role, secret?: 'enter'|'show' }
             discuss { prompt, timer? } · reveal { graphs, eq? } · compare { s0? } · reflect { prompts }
   Activity  codes: true makes every reveal wait for a short code from the teacher
   Ask item  open { read? } (free text; read: [{ sign: 'v', at }, { trend: 'v', from, to }] shows what the reference says at compare)
             sign { of, at } · trend { of, from, to } · choice { options, expect? } · number { unit, expect? }
   Recording  a toggle (button or R) or held; the clock starts at the press; it stops at the end of the window. */
import { Plot, C, label, FONT, fit } from './plot.js';
import { compileSections, buildEqModel, resample, buildRecModel } from './model.js';
import { freeSeg, splice, drawModel } from './draw.js';
import { T, LANG, fx } from './i18n.js';
import { encodeState } from './share.js';
import { ACTIVITIES } from './activities.js';
import { ICON } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isNum = v => typeof v === 'number' && isFinite(v);
const QI = { s: 0, v: 1, a: 2 }, UNIT = { s: 'm', v: 'm/s', a: 'm/s²' };
const STEP_TYPES = ['show', 'think', 'ask', 'act', 'discuss', 'reveal', 'compare', 'reflect', 'handover'];
const L = x => (x == null ? '' : typeof x === 'string' ? x : x[LANG] ?? x.it ?? x.en ?? '');
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const ms = name => h('span', { class: 'ms', 'aria-hidden': 'true', text: name });
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage full or blocked: progress just isn't kept */ } }
};

/* ---------------------------------------------------------------- keys and answers as motion models */
function keyModel(sections) {
  if (!Array.isArray(sections) || !sections.length) return null;
  const secs = sections.map((s, i) => ({
    kind: ['s', 'v', 'a', 'u'].includes(s.kind) ? s.kind : 'u',
    f: String(s.f ?? ''), end: String(s.end),
    s0: { inh: i > 0 && s.s0 == null, e: String(s.s0 ?? 0) },
    v0: { inh: i > 0 && s.v0 == null, e: String(s.v0 ?? 0) },
    a: String(s.a ?? 0), blend: false
  }));
  const Cm = compileSections(secs, k => k);
  if (!Cm.ok || Cm.vars.length) return null;
  const M = buildEqModel(Cm, Object.create(null));
  return M.ok ? M : null;
}
const recModel = s => (s && s.length > 3 ? buildRecModel(Float64Array.from(s), 8) : null);

/* ---------------------------------------------------------------- validation */
export function validActivity(a) {
  if (!a || typeof a !== 'object' || !Array.isArray(a.tasks) || !a.tasks.length || a.tasks.length > 80) return false;
  for (const tk of a.tasks) {
    if (!tk || !Array.isArray(tk.steps) || !tk.steps.length) return false;
    const st = tk.setup || {};
    if (st.t && !(Array.isArray(st.t) && st.t[1] > 0)) return false;
    if (tk.key && tk.key !== 'secret' && !keyModel(tk.key)) return false;
    for (const s of tk.steps) {
      if (!s || !STEP_TYPES.includes(s.type)) return false;
      if (s.type === 'act' && !['move', 'draw', 'write'].includes(s.kind)) return false;
      if (s.type === 'act' && s.kind === 'draw' && !['s', 'v', 'a'].includes(s.q)) return false;
      if (s.type === 'ask' && !Array.isArray(s.items)) return false;
    }
  }
  return true;
}

/* ================================================================ the module */
export function initPDC(env) {
  const root = h('section', { id: 'pdc', class: 'pdc', hidden: true, 'aria-label': 'activities' });
  document.body.append(root);
  let open = false, view = 'home';
  let A = null, AK = '', prog = null;           // activity, its key, its progress
  let ti = 0, si = 0;                            // current task and step
  const cache = new Map();                       // models: keys and attempts
  let rec = null, drawSt = null, play = null, dirty = true, raf = 0;
  let canv = {};                                 // canvases of the current task
  let clean = false;

  /* ---------- activities available: built in and imported */
  const mine = () => { try { const v = JSON.parse(store.get('motus1d.pdc.mine') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const saveMine = list => store.set('motus1d.pdc.mine', JSON.stringify(list.slice(0, 20)));
  const hashOf = str => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
  function addMine(act) {
    const key = 'm:' + hashOf(JSON.stringify(act)), list = mine().filter(x => x.key !== key);
    list.unshift({ key, act }); saveMine(list); return key;
  }
  function findAct(key) {
    if (key.startsWith('b:')) { const a = ACTIVITIES.find(x => x.id === key.slice(2)); return a || null; }
    const m = mine().find(x => x.key === key); return m ? m.act : null;
  }

  /* ---------- progress */
  const progKey = () => 'motus1d.pdc.p.' + AK;
  function loadProg() {
    try { const p = JSON.parse(store.get(progKey()) || 'null'); if (p && Array.isArray(p.tasks)) return p; } catch (e) { /* */ }
    return { ti: 0, tasks: [] };
  }
  const saveProg = () => { prog.ti = ti; store.set(progKey(), JSON.stringify(prog)); };
  const tp = () => (prog.tasks[ti] ||= { si: 0, ans: {}, att: {} });
  const task = () => A.tasks[ti];
  const steps = () => task().steps;
  const step = () => steps()[si];

  /* ---------- models with a cache */
  const secretKey = () => { const f = tp().secret; return f ? [{ kind: 's', f, end: Tw() }] : null; };
  const keyData = (tk = task()) => (tk.key === 'secret' ? secretKey() : tk.key);
  function keyOf(tk = task()) {
    const kd = keyData(tk), k = 'k' + ti + '|' + (tk.key === 'secret' ? tp().secret || '' : '');
    if (!cache.has(k)) cache.set(k, kd ? keyModel(kd) : null);
    return cache.get(k);
  }
  const atts = j => tp().att[j] || [];
  /* the latest attempt of answer A (or of the alternative B) of an act step */
  const latestOf = (j, alt) => { const a = atts(j); for (let n = a.length - 1; n >= 0; n--) if (!!a[n].alt === alt) return n; return -1; };
  function attModel(j, n) {
    const a = (tp().att[j] || [])[n]; if (!a) return null;
    const k = `a${ti}.${j}.${n}.${a.ver || 0}`;
    if (!cache.has(k)) {
      let M = null;
      if (a.type === 'move') M = recModel(a.s);
      else if (a.type === 'write') M = a.f ? keyModel([{ kind: 's', f: a.f, end: Tw() }]) : null;
      else if (a.segs && a.segs.length) { const K = keyOf(), q = steps()[j].q; M = drawModel(a.segs, q, K ? K.S(0) : 0, K ? K.V(0) : 0); }
      cache.set(k, M);
    }
    return cache.get(k);
  }
  const Tw = () => { const t = (task().setup || {}).t; return t && t[1] > 0 ? t[1] : 5; };
  const SR = () => { const s = (task().setup || {}).s; return s && s[1] > s[0] ? s : [-1, 1]; };

  /* which graphs a task uses */
  function qsOf(tk) {
    const set = new Set();
    for (const s of tk.steps) {
      if (s.graphs) s.graphs.forEach(q => set.add(q));
      if (s.type === 'act' && s.kind === 'draw') set.add(s.q);
      if (s.type === 'act' && s.kind === 'move') { (s.live || []).forEach(q => set.add(q)); set.add('s'); }
    }
    if (!set.size) set.add('s');
    return ['s', 'v', 'a'].filter(q => set.has(q));
  }
  const hasTrack = tk => tk.steps.some(s => s.type === 'act' && s.kind === 'move');
  /* teacher codes: a reveal waits for a three-digit code, computed from the activity, so it works offline */
  const codesOn = () => !!(A && (A.codes || store.get('motus1d.pdc.codes.' + AK) === '1'));
  const codeFor = (key, t, j) => 100 + parseInt(hashOf(key + '|' + t + '|' + j), 36) % 900;
  const revealOpen = j => !codesOn() || !!(tp().unl && tp().unl[j]);

  /* what is visible at the current step */
  function vis() {
    const given = new Set(), revealed = new Set(), texts = []; let eq = false;
    steps().forEach((s, j) => {
      if (j > si) return;
      if (s.type === 'show') { (s.graphs || []).forEach(q => given.add(q)); if (s.text) texts.push(s.text); if (s.eq) eq = true; }
      if (s.type === 'reveal' && revealOpen(j)) { (s.graphs || []).forEach(q => revealed.add(q)); if (s.eq) eq = true; }
    });
    // the latest act step of each kind up to here: its attempts are on the graphs
    // prefer the latest step that has attempts, so an empty later step doesn't hide earlier work
    const last = { move: -1, draw: -1, write: -1 }, withA = { move: -1, draw: -1, write: -1 };
    steps().forEach((s, j) => {
      if (j > si || s.type !== 'act') return;
      last[s.kind] = j; if (atts(j).length) withA[s.kind] = j;
    });
    for (const k in last) if (withA[k] >= 0 && last[k] !== si) last[k] = withA[k];
    return { given, revealed, texts, eq, move: last.move, draw: last.draw, write: last.write };
  }
  const keyVisible = (V, q) => V.given.has(q) || V.revealed.has(q);
  const moveVisible = (V, q) => V.move >= 0 && ((steps()[V.move].live || []).includes(q) || V.revealed.has(q) || (V.given.has(q) && (steps()[V.move].live || []).includes(q)));
  const lockedAsk = j => steps().some((s, k) => k > j && k <= si && (s.type === 'reveal' || s.type === 'compare'));

  /* ---------------------------------------------------------------- expected values from the key */
  function spanOf(K, q) { const r = K.range[q]; return Math.max(r[1] - r[0], 0.1); }
  function signOf(K, q, t) {
    const y = K.at(clamp(t, 0, K.T))[QI[q]], tol = 0.02 * spanOf(K, q);
    return Math.abs(y) <= tol ? '0' : y > 0 ? '+' : '-';
  }
  function trendOf(K, q, a, b) {
    const n = 40, tol = 0.01 * spanOf(K, q); let up = false, down = false, ys = [];
    for (let k = 0; k <= n; k++) ys.push(K.at(clamp(a + (b - a) * k / n, 0, K.T))[QI[q]]);
    for (let k = 1; k <= n; k++) { const d = ys[k] - ys[k - 1]; if (d > tol / n * 4) up = true; if (d < -tol / n * 4) down = true; }
    if (Math.abs(ys[n] - ys[0]) < tol && !up && !down) return 'const';
    return up && down ? 'mixed' : up ? 'up' : down ? 'down' : 'const';
  }
  /* what the reference says, for an open question: { sign: 'v', at } or { trend: 'v', from, to } */
  function readings(item) {
    const K = keyOf(); if (!K || !Array.isArray(item.read)) return null;
    const out = [];
    for (const r of item.read) {
      const tt = x => fx(x, Number.isInteger(x) ? 0 : 1);
      if (r.sign) out.push(r.sign + '(' + tt(+r.at || 0) + ' s) ' + SIGN[signOf(K, r.sign, +r.at || 0)]());
      else if (r.trend) { const a = +r.from || 0, b = +(r.to ?? K.T); out.push(r.trend + ' ' + TREND[trendOf(K, r.trend, a, b)]() + ' ' + T('pdc_between', tt(a), tt(b))); }
    }
    return out.length ? out.join(' · ') : null;
  }
  function expected(item) {
    const K = keyOf();
    if (item.kind === 'open' || !item.kind) return readings(item);
    if (item.kind === 'sign' && K) return signOf(K, item.of || 'v', +item.at || 0);
    if (item.kind === 'trend' && K) return trendOf(K, item.of || 'v', +item.from || 0, +(item.to ?? K.T));
    if (item.kind === 'choice' || item.kind === 'number') return item.expect ?? null;
    return null;
  }
  const SIGN = { '+': () => T('pdc_pos'), '-': () => T('pdc_neg'), '0': () => T('pdc_zero') };
  const TREND = { up: () => T('pdc_up'), down: () => T('pdc_down'), const: () => T('pdc_const'), mixed: () => T('pdc_mixed') };
  function showVal(item, v) {
    if (v == null || v === '') return '—';
    if (item.kind === 'sign') return SIGN[v] ? SIGN[v]() : v;
    if (item.kind === 'trend') return TREND[v] ? TREND[v]() : v;
    if (item.kind === 'choice') return L((item.options || [])[v]) || '—';
    if (item.kind === 'number') return isNum(+v) ? fx(+v) + ' ' + (item.unit || '') : '—';
    return String(v);
  }

  /* ---------------------------------------------------------------- comparison: what differs, and where */
  function analyze(q, Am, K, isMove) {
    const out = { bands: [], gap: null, lines: [] }, i = QI[q];
    const Tc = Math.min(Am.T, K.T, Tw()); if (!(Tc > 0.3)) return out;
    const span = Math.max(spanOf(K, q), 0.1), n = 200, dt = Tc / n, w = 0.12;
    const fA = t => Am.at(clamp(t, 0, Am.T))[i], fK = t => K.at(clamp(t, 0, K.T))[i];
    const slope = (f, t) => (f(Math.min(Tc, t + w)) - f(Math.max(0, t - w))) / (Math.min(Tc, t + w) - Math.max(0, t - w));
    const eps = 0.08 * span / Math.max(1, Tc);
    const sg = v => (Math.abs(v) < eps ? 0 : v > 0 ? 1 : -1);
    // slopes of opposite sign, or flat against clearly moving
    let run = null; const runs = [];
    for (let k = 0; k <= n; k++) {
      const t = k * dt, a = slope(fA, t), b = slope(fK, t), sa = sg(a), sb = sg(b);
      const bad = (sa * sb === -1) || (sa === 0 && Math.abs(b) > 3 * eps) || (sb === 0 && Math.abs(a) > 3 * eps);
      if (bad) { if (!run) run = { a: t, b: t, sa, sb }; run.b = t; } else if (run) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
    const word = s => (s > 0 ? T('pdc_rises') : s < 0 ? T('pdc_falls') : T('pdc_flat'));
    runs.filter(r => r.b - r.a >= 0.25).sort((x, y) => (y.b - y.a) - (x.b - x.a)).slice(0, 2).sort((x, y) => x.a - y.a).forEach(r => {
      out.bands.push([r.a, r.b]);
      out.lines.push(T('pdc_o_slope', fx(r.a, 1), fx(r.b, 1), word(r.sa), word(r.sb)));
    });
    // largest gap
    let gmax = 0, gt = 0, e2 = 0;
    for (let k = 0; k <= n; k++) { const t = k * dt, d = fA(t) - fK(t); e2 += d * d; if (Math.abs(d) > Math.abs(gmax)) { gmax = d; gt = t; } }
    const rms0 = Math.sqrt(e2 / (n + 1));
    // the same shape, shifted in time
    let best = { tau: 0, rms: rms0 };
    if (isMove && rms0 > 0.05 * span) for (let tau = -0.8; tau <= 0.801; tau += 0.02) {
      let s2 = 0, m = 0;
      for (let k = 0; k <= n; k++) { const t = k * dt, u = t - tau; if (u < 0 || u > K.T) continue; const d = fA(t) - fK(u); s2 += d * d; m++; }
      if (m > n * 0.6) { const r = Math.sqrt(s2 / m); if (r < best.rms) best = { tau, rms: r }; }
    }
    if (Math.abs(best.tau) >= 0.15 && best.rms < 0.45 * rms0) out.lines.push(T('pdc_o_shift', best.tau > 0 ? T('pdc_late') : T('pdc_early'), fx(Math.abs(best.tau), 1)));
    else if (Math.abs(gmax) > 0.04 * span) { out.gap = { t: gt, a: fA(gt), k: fK(gt) }; out.lines.push(T('pdc_o_gap', fx(gt, 1), fx(Math.abs(gmax)), UNIT[q])); }
    if (!out.lines.length) out.lines.push(T('pdc_o_close'));
    return out;
  }
  const anaCache = new Map();
  function analyzeC(q, src, K) {
    const k = [ti, si, q, src.name, src.n, src.ver].join('|');
    if (!anaCache.has(k)) anaCache.set(k, analyze(q, src.M, K, src.move));
    return anaCache.get(k);
  }
  /* corners and jumps of the key on a graph */
  function cornersOf(K, q) {
    const out = [];
    for (const J of K.joints) {
      if (q === 's' && J.status === 'kink') out.push({ t: J.t, kind: 'corner_s' });
      if (q === 'v' && J.status === 'kink') out.push({ t: J.t, kind: 'jump_v' });
      if (q === 'v' && J.status === 'acorner') out.push({ t: J.t, kind: 'corner_v' });
    }
    return out;
  }

  /* ================================================================ screens */
  function show(on) {
    open = on; root.hidden = !on; document.body.classList.toggle('pdc-on', on);
    if (on) { loop(); } else { cancelAnimationFrame(raf); env.onClose && env.onClose(); }
  }
  function home() {
    view = 'home'; A = null; stopRec(); play = null; clean = false;
    root.innerHTML = '';
    const head = h('header', { class: 'pdc-head' },
      h('div', { class: 'pdc-htitle' }, ms('school'), h('b', { text: T('pdc_title') })),
      h('button', { class: 'btn', type: 'button', onclick: () => show(false) }, ms('close'), h('span', { class: 'lbl', text: T('pdc_exit') })));
    const list = h('div', { class: 'pdc-list' });
    const card = (key, act, own) => {
      const p = (() => { try { return JSON.parse(store.get('motus1d.pdc.p.' + key) || 'null'); } catch (e) { return null; } })();
      const started = p && Array.isArray(p.tasks) && p.tasks.length;
      const c = h('div', { class: 'pdc-acard card' },
        h('h3', { text: L(act.title) || T('pdc_untitled') }),
        act.desc ? h('p', { class: 'note', text: L(act.desc) }) : null,
        h('p', { class: 'pdc-meta', text: T('pdc_ntasks', act.tasks.length) + (started ? ' · ' + T('pdc_at_task', (p.ti || 0) + 1) : '') }),
        h('div', { class: 'pdc-row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => start(key, false) }, ms(started ? 'play_arrow' : 'arrow_forward'), h('span', { text: started ? T('pdc_resume') : T('pdc_start') })),
          started ? h('button', { class: 'btn', type: 'button', onclick: () => start(key, true) }, ms('replay'), h('span', { text: T('pdc_restart') })) : null,
          h('button', { class: 'btn', type: 'button', title: T('pdc_link_t'), onclick: () => linkFor(key, act) }, ms('link'), h('span', { text: T('pdc_link') })),
          own ? h('button', { class: 'btn', type: 'button', title: T('pdc_remove'), onclick: () => { saveMine(mine().filter(x => x.key !== key)); home(); } }, ms('delete')) : null));
      // for the teacher: reveals that wait for a code, and the list of codes
      if (act.tasks.some(tk => tk.steps.some(x => x.type === 'reveal'))) {
        const ck = 'motus1d.pdc.codes.' + key, cb = h('input', { type: 'checkbox' });
        cb.checked = !!act.codes || store.get(ck) === '1'; cb.disabled = !!act.codes;
        cb.onchange = () => store.set(ck, cb.checked ? '1' : '0');
        c.append(h('div', { class: 'pdc-row pdc-teach' }, h('b', { text: T('pdc_teacher') }),
          h('label', { class: 'pdc-check' }, cb, h('span', { text: T('pdc_codes_on') })),
          h('button', { class: 'btn small', type: 'button', onclick: () => codeList(key, act) }, ms('key'), h('span', { text: T('pdc_codes') }))));
      }
      list.append(c);
    };
    list.append(h('h2', { class: 'pdc-sec', text: T('pdc_builtin') }));
    for (const a of ACTIVITIES) card('b:' + a.id, a, false);
    const own = mine();
    if (own.length) { list.append(h('h2', { class: 'pdc-sec', text: T('pdc_mine') })); for (const m of own) card(m.key, m.act, true); }
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    file.onchange = async () => {
      const f = file.files && file.files[0]; if (!f) return;
      try { const a = JSON.parse(await f.text()); if (!validActivity(a)) throw new Error('bad'); addMine(a); home(); env.toast(T('pdc_imported')); }
      catch (e) { env.toast(T('pdc_bad')); }
    };
    list.append(h('div', { class: 'pdc-row pdc-imp' }, h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, ms('upload_file'), h('span', { text: T('pdc_import') })), h('span', { class: 'note', text: T('pdc_import_note') }), file));
    root.append(head, h('p', { class: 'pdc-intro', text: T('pdc_intro') }), list);
  }
  function codeList(key, act) {
    const box = h('div', { class: 'pdc-codes' });
    act.tasks.forEach((tk, t) => tk.steps.forEach((x, j) => {
      if (x.type === 'reveal') box.append(h('div', null, h('span', { text: T('pdc_task', t + 1, act.tasks.length) + ' · ' + L(tk.title) }), h('b', { text: String(codeFor(key, t, j)) })));
    }));
    overlay(h('div', { class: 'pdc-sheet card' }, h('h3', { text: T('pdc_codes') }), h('p', { class: 'note', text: T('pdc_codes_note') }), box));
  }
  /* a layer over the activity, closed by its button or a tap outside */
  function overlay(content, extra) {
    const ov = h('div', { class: 'pdc-ov' });
    const close = () => ov.remove();
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    content.prepend(h('div', { class: 'pdc-row pdc-ovbar' }, ...(extra || []), h('span', { class: 'grow' }), h('button', { class: 'btn', type: 'button', title: T('close'), onclick: close }, ms('close'))));
    ov.append(content); root.append(ov); return ov;
  }
  async function linkFor(key, act) {
    try {
      const codes = store.get('motus1d.pdc.codes.' + key) === '1';
      const code = await encodeState({ act: key.startsWith('b:') ? { builtin: key.slice(2), codes: codes || undefined } : codes ? { ...act, codes: true } : act });
      const url = env.getBase() + '#' + code;
      try { await navigator.clipboard.writeText(url); env.toast(T('pdc_link_copied')); }
      catch (e) { window.prompt(T('pdc_link'), url); }
    } catch (e) { env.toast(T('pdc_bad')); }
  }
  function start(key, fresh) {
    const act = findAct(key); if (!act) { home(); return; }
    A = act; AK = key; cache.clear(); anaCache.clear(); ti = 0; si = 0;
    prog = fresh ? { ti: 0, tasks: [] } : loadProg();
    if (fresh) saveProg();
    ti = clamp(prog.ti || 0, 0, A.tasks.length - 1); si = clamp(tp().si || 0, 0, steps().length - 1);
    view = 'run'; buildTask();
  }
  function fromLink(o) {
    let key = null;
    if (o && o.builtin && ACTIVITIES.some(a => a.id === o.builtin)) key = 'b:' + o.builtin;
    else if (validActivity(o)) key = addMine(o);
    if (!key) { env.toast(T('pdc_bad')); return; }
    if (o.codes) store.set('motus1d.pdc.codes.' + key, '1');
    show(true); start(key, false);
  }

  /* ---------- the task screen */
  function buildTask() {
    stopRec(); play = null; drawSt = null; clean = false;
    const tk = task(), qs = qsOf(tk);
    root.innerHTML = '';
    const dots = h('div', { class: 'pdc-dots' });
    tk.steps.forEach((s, j) => dots.append(h('i', { class: j === si ? 'on' : j < si ? 'done' : '', title: stepName(s) })));
    const head = h('header', { class: 'pdc-head' },
      h('button', { class: 'btn', type: 'button', title: T('pdc_list'), onclick: () => { saveProg(); home(); } }, ms('arrow_back')),
      h('div', { class: 'pdc-htitle' },
        h('small', { text: T('pdc_task', ti + 1, A.tasks.length) + (tk.ref ? ' · ' + L(tk.ref) : '') }),
        h('b', { text: L(tk.title) })),
      dots,
      h('button', { class: 'btn', type: 'button', title: T('pdc_board'), onclick: () => board() }, ms('dashboard')),
      h('button', { class: 'btn pdc-cleanx', type: 'button', title: T('pdc_clean'), onclick: () => { clean = false; root.classList.remove('clean'); dirty = true; } }, ms('grid_off')),
      h('button', { class: 'btn', type: 'button', title: T('pdc_exit'), onclick: () => { saveProg(); show(false); } }, ms('close')));
    const stage = h('div', { class: 'pdc-stage card' });
    const given = h('div', { class: 'pdc-given', id: 'pdcGiven' });
    stage.append(given);
    canv = { q: {} };
    if (hasTrack(tk)) {
      const tw = h('div', { class: 'pdc-track' }), cv = h('canvas');
      tw.append(cv); stage.append(tw); canv.track = cv; trackInput(cv);
    }
    const gw = h('div', { class: 'pdc-graphs' });
    for (const q of qs) {
      const cv = h('canvas'), box = h('div', { class: 'pdc-g' }, cv);
      gw.append(box); canv.q[q] = { cv, P: new Plot(cv, { l: 46, r: 16, t: 24, b: 22 }), box };
      graphInput(q, cv);
    }
    stage.append(gw);
    const cardEl = h('aside', { class: 'pdc-card card', id: 'pdcCard' });
    root.append(head, h('div', { class: 'pdc-body' + (qs.length === 1 ? ' one' : '') }, stage, cardEl));
    renderStep();
  }
  const STEP_ICON = { show: 'visibility', think: 'psychology', ask: 'quiz', move: 'touch_app', draw: 'draw', write: 'function', discuss: 'forum', reveal: 'lock_open', compare: 'compare', reflect: 'edit_note', handover: 'swap_horiz' };
  const stepKind = s => (s.type === 'act' ? s.kind : s.type);
  const stepName = s => T('pdc_st_' + stepKind(s));

  let slot = 'A', slotStep = -1;
  function renderStep() {
    const s = step(), V = vis(), card = $('#pdcCard', root), given = $('#pdcGiven', root);
    if (slotStep !== ti + ':' + si) { slotStep = ti + ':' + si; slot = 'A'; }
    tp().si = si; saveProg();
    // header dots
    root.querySelectorAll('.pdc-dots i').forEach((d, j) => { d.className = j === si ? 'on' : j < si ? 'done' : ''; });
    // what is given so far
    given.innerHTML = '';
    for (const tx of V.texts) given.append(h('p', { text: L(tx) }));
    if (V.eq) given.append(h('p', { class: 'pdc-eq', text: eqText(keyData()) }));
    given.hidden = !given.childNodes.length;
    root.classList.toggle('clean', clean);
    // the step card
    card.innerHTML = '';
    card.append(h('div', { class: 'pdc-kind' }, ms(STEP_ICON[stepKind(s)]), h('span', { text: stepName(s) })));
    const body = h('div', { class: 'pdc-cbody' }); card.append(body);
    if (s.prompt) body.append(h('p', { class: 'pdc-prompt', text: L(s.prompt) }));
    ({ show: cShow, think: cTimer, discuss: cTimer, ask: cAsk, act: s.kind === 'move' ? cMove : s.kind === 'write' ? cWrite : cDraw, reveal: cReveal, compare: cCompare, reflect: cReflect, handover: cHandover })[s.type](body, s, V);
    // navigation
    const last = si === steps().length - 1, lastTask = ti === A.tasks.length - 1;
    const nav = h('div', { class: 'pdc-nav' },
      h('button', { class: 'btn', type: 'button', disabled: si === 0 && ti === 0, onclick: back }, ms('arrow_back'), h('span', { text: T('pdc_back') })),
      h('button', { class: 'btn primary', type: 'button', onclick: next, disabled: blocked(s) }, h('span', { text: last ? (lastTask ? T('pdc_finish') : T('pdc_next_task')) : T('pdc_next') }), ms('arrow_forward')));
    card.append(nav);
    dirty = true;
  }
  /* a step that has to be completed first: a locked reveal, a secret still missing */
  const blocked = s => (s.type === 'reveal' && !revealOpen(si)) || (s.type === 'handover' && s.secret === 'enter' && !tp().secret);
  function next() {
    if (blocked(step())) return;
    stopRec(); play = null;
    if (si < steps().length - 1) { si++; renderStep(); return; }
    if (ti < A.tasks.length - 1) { ti++; si = clamp(tp().si || 0, 0, steps().length - 1); saveProg(); buildTask(); return; }
    saveProg(); finished();
  }
  function back() {
    stopRec(); play = null;
    if (si > 0) { si--; renderStep(); return; }
    if (ti > 0) { ti--; si = steps().length - 1; saveProg(); buildTask(); }
  }
  /* the group board: one image with the task, the graphs as they are now, the answers and the reflection
     prompts. Fullscreen to present it to the class, or saved to hand it in. */
  function board() {
    const tk = task(), V = vis(), K = keyOf(), W = 1400, pad = 40, col = C();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = 6000;
    const c = cv.getContext('2d');
    c.fillStyle = col.surface; c.fillRect(0, 0, W, cv.height);
    let y = pad;
    const text = (str, size, weight, color, x = pad, maxW = W - 2 * pad) => {
      c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textBaseline = 'top';
      for (const para of String(str).split('\n')) {
        let line = '';
        for (const w of para.split(' ')) {
          const t2 = line ? line + ' ' + w : w;
          if (c.measureText(t2).width > maxW && line) { c.fillText(line, x, y); y += size * 1.35; line = w; } else line = t2;
        }
        c.fillText(line, x, y); y += size * 1.35;
      }
    };
    c.fillStyle = col.ink; c.fillRect(0, 0, W, 8);
    text(L(A.title), 18, 400, col.muted);
    text(T('pdc_task', ti + 1, A.tasks.length) + (tk.ref ? ' · ' + L(tk.ref) : '') + ' — ' + L(tk.title), 30, 700, col.ink);
    y += 6;
    for (const tx of V.texts) text(L(tx), 20, 400, col.ink);
    if (V.eq) text(eqText(keyData()), 22, 700, col.ink);
    y += 10;
    // the graphs, as drawn on screen
    for (const q of Object.keys(canv.q)) {
      const g = canv.q[q].cv; if (!g.width) continue;
      const hh = Math.round((W - 2 * pad) * g.height / g.width);
      c.drawImage(g, pad, y, W - 2 * pad, hh); c.strokeStyle = col.gridline; c.strokeRect(pad, y, W - 2 * pad, hh); y += hh + 12;
    }
    // what the comparison says
    if (K) {
      const lines = [];
      for (const q of qsOf(tk)) if (keyVisible(V, q)) for (const src of sources(V, q)) for (const line of analyzeC(q, src, K).lines) lines.push(q + '‑t · ' + src.name + ': ' + line);
      if (lines.length) { y += 6; text(T('pdc_st_compare'), 22, 700, col.ink); for (const l of lines) text('• ' + l, 18, 400, col.ink); }
    }
    // the group's answers
    const qa = [];
    steps().forEach((st, j) => {
      if (st.type !== 'ask') return;
      const ans = tp().ans[j] || {};
      st.items.forEach((it, i) => {
        const open = it.kind === 'open' || !it.kind, a = ans[i];
        const val = open ? (a && a.trim() ? a.trim() : '—') : showVal(it, a), e = expected(it);
        qa.push([L(it.q), val, e != null ? (open ? e : showVal(it, e)) : '']);
      });
      if (ans.why) qa.push([T('pdc_why'), ans.why, '']);
    });
    steps().forEach((st, j) => { if (st.type === 'act' && st.kind === 'write') { const n = latestOf(j, false); if (n >= 0) qa.push([L(st.prompt) || 's(t)', 's(t) = ' + atts(j)[n].f, '']); } });
    if (qa.length) {
      y += 8; text(T('pdc_answers'), 22, 700, col.ink);
      for (const [q, a, e] of qa) { y += 4; text(q, 18, 700, col.ink); text(T('pdc_you') + ': ' + a, 18, 400, col.ink, pad + 20, W - 2 * pad - 20); if (e) text((K ? T('pdc_graph') : T('pdc_expected')) + ': ' + e, 18, 400, col.muted, pad + 20, W - 2 * pad - 20); }
    }
    const refl = steps().filter(st => st.type === 'reflect').flatMap(st => st.prompts || []);
    if (refl.length) { y += 8; text(T('pdc_st_reflect'), 22, 700, col.ink); refl.forEach((r, k) => text((k + 1) + '. ' + L(r), 18, 400, col.ink)); }
    y += pad;
    const out = document.createElement('canvas'); out.width = W; out.height = Math.min(y, cv.height);
    out.getContext('2d').drawImage(cv, 0, 0);
    const url = out.toDataURL('image/png');
    const img = h('img', { class: 'pdc-boardimg', src: url, alt: T('pdc_board') });
    const sheet = h('div', { class: 'pdc-sheet pdc-boardsheet card' }, img);
    const name = ('motus1d-lab-' + (ti + 1) + '-' + L(tk.title)).toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, '-').slice(0, 60) + '.png';
    const dl = h('a', { class: 'btn', href: url, download: name }, ms('download'), h('span', { text: T('pdc_save') }));
    const fs = h('button', { class: 'btn', type: 'button', onclick: () => { const el = sheet; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); } }, ms('fullscreen'), h('span', { text: T('pdc_present') }));
    overlay(sheet, [h('b', { text: T('pdc_board') }), dl, fs]);
  }
  function finished() {
    root.innerHTML = '';
    root.append(h('header', { class: 'pdc-head' }, h('div', { class: 'pdc-htitle' }, ms('school'), h('b', { text: L(A.title) }))),
      h('div', { class: 'pdc-done card' }, h('h2', { text: T('pdc_done') }), h('p', { text: T('pdc_done_p') }),
        h('div', { class: 'pdc-row' },
          h('button', { class: 'btn primary', type: 'button', onclick: home }, ms('arrow_back'), h('span', { text: T('pdc_list') })),
          h('button', { class: 'btn', type: 'button', onclick: () => { ti = A.tasks.length - 1; si = steps().length - 1; buildTask(); } }, ms('replay'), h('span', { text: T('pdc_review') })))));
  }
  function eqText(key) {
    if (!key) return '';
    let t0 = 0;
    return key.map(s => {
      const dom = ', t ∈ [' + fx(t0, 0) + '; ' + fx(+s.end, 0) + '] s'; t0 = +s.end;
      const f = String(s.f || '').replace(/\*/g, '·').replace(/-/g, '−').replace(/\./g, LANG === 'it' ? ',' : '.');
      if (s.kind === 's') return 's(t) = ' + f + dom;
      if (s.kind === 'v') return 'v(t) = ' + f + (s.s0 != null ? ', s₀ = ' + fx(+s.s0) + ' m' : '') + dom;
      if (s.kind === 'a') return 'a(t) = ' + f + dom;
      return 'a = ' + fx(+s.a || 0) + ' m/s²' + (s.s0 != null ? ', s₀ = ' + fx(+s.s0) + ' m' : '') + (s.v0 != null ? ', v₀ = ' + fx(+s.v0) + ' m/s' : '') + dom;
    }).join('\n');
  }

  /* ---------- step cards */
  function cShow(body, s) { if (!s.text && !s.prompt) body.append(h('p', { class: 'note', text: T('pdc_look') })); }
  function cTimer(body, s) {
    if (s.type === 'think') body.append(h('p', { class: 'note', text: T('pdc_think_note') }));
    if (isNum(s.timer) && s.timer > 0) {
      const el = h('div', { class: 'pdc-timer', text: fmtClock(s.timer) }), end = performance.now() + s.timer * 1000;
      body.append(el);
      const tick = () => { if (!el.isConnected) return; const left = Math.max(0, (end - performance.now()) / 1000); el.textContent = fmtClock(left); el.classList.toggle('over', left <= 0); if (left > 0) setTimeout(tick, 250); };
      tick();
    }
  }
  const fmtClock = sec => { const m = Math.floor(sec / 60), r = Math.ceil(sec % 60); return m + ':' + String(r === 60 ? 0 : r).padStart(2, '0'); };
  function cAsk(body, s) {
    const ans = (tp().ans[si] ||= {}), locked = lockedAsk(si);
    if (locked) body.append(h('p', { class: 'note', text: T('pdc_locked') }));
    s.items.forEach((it, i) => {
      const box = h('div', { class: 'pdc-q' }, h('p', { text: L(it.q) }));
      const opts = it.kind === 'sign' ? [['+', T('pdc_pos')], ['-', T('pdc_neg')], ['0', T('pdc_zero')]]
        : it.kind === 'trend' ? [['up', T('pdc_up')], ['down', T('pdc_down')], ['const', T('pdc_const')]]
          : it.kind === 'choice' ? (it.options || []).map((o, k) => [k, L(o)]) : null;
      if (opts) {
        const g = h('div', { class: 'pdc-opts' + (it.kind === 'choice' ? ' col' : '') });
        for (const [v, lab] of opts) {
          const b = h('button', { type: 'button', class: ans[i] === v ? 'on' : '', disabled: locked, text: lab });
          b.onclick = () => { ans[i] = v; saveProg(); g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
          g.append(b);
        }
        box.append(g);
      } else if (it.kind === 'open' || !it.kind) {
        const ta = h('textarea', { class: 'ta pdc-open', rows: 2, placeholder: T('pdc_open_ph'), disabled: locked });
        ta.value = typeof ans[i] === 'string' ? ans[i] : ''; ta.oninput = () => { ans[i] = ta.value.slice(0, 1000); saveProg(); };
        box.append(ta);
      } else if (it.kind === 'number') {
        const inp = h('input', { class: 'ta pdc-num', inputmode: 'decimal', value: ans[i] != null ? fx(+ans[i]) : '', disabled: locked });
        inp.oninput = () => { const v = parseFloat(inp.value.replace(',', '.')); ans[i] = isNum(v) ? v : null; saveProg(); };
        box.append(h('div', { class: 'pdc-row' }, inp, h('span', { class: 'note', text: it.unit || '' })));
      }
      body.append(box);
    });
    if (s.why) {
      const ta = h('textarea', { class: 'ta', rows: 2, placeholder: T('pdc_why_ph'), disabled: locked });
      ta.value = ans.why || ''; ta.oninput = () => { ans.why = ta.value.slice(0, 600); saveProg(); };
      body.append(h('p', { class: 'pdc-sub', text: T('pdc_why') }), ta);
    }
  }
  function attemptsBar(body, j) {
    const list = tp().att[j] || [];
    if (list.length) body.append(h('p', { class: 'note', text: T('pdc_attempts', list.length) }));
  }
  function cMove(body, s) {
    body.append(h('p', { class: 'note', text: T('pdc_move_note', fx(Tw(), 0)) }));
    const b = h('button', { class: 'btn primary pdc-recbtn', type: 'button', id: 'pdcRec' }, ms('fiber_manual_record'), h('span', { text: (tp().att[si] || []).length ? T('pdc_rec_again') : T('pdc_rec') }));
    b.addEventListener('pointerdown', e => { e.preventDefault(); recPress(); });
    b.addEventListener('pointerup', recRelease); b.addEventListener('pointercancel', recRelease);
    b.addEventListener('contextmenu', e => e.preventDefault());
    body.append(b);
    attemptsBar(body, si);
    slotBar(body, s);
    if (!rec) moveState.ball = isNum(s.start) ? s.start : moveState.ball ?? 0;
  }
  /* the drawing being edited: the latest one of the current slot, created when missing */
  function drawTarget() {
    const att = (tp().att[si] ||= []), alt = slot === 'B', n = latestOf(si, alt);
    if (n >= 0) return att[n];
    const a = { type: 'draw', segs: [], ver: 0 }; if (alt) a.alt = true; att.push(a); return a;
  }
  /* A is the group's answer; B an alternative when the group disagrees */
  function slotBar(body, s) {
    if (s.alt === false) return;
    const g = h('div', { class: 'seg pdc-slot' });
    for (const v of ['A', 'B']) {
      const b = h('button', { type: 'button', class: slot === v ? 'on' : '', text: v === 'A' ? T('pdc_slot_a') : T('pdc_slot_b') });
      b.onclick = () => { if (rec) return; slot = v; renderStep(); };
      g.append(b);
    }
    body.append(h('div', { class: 'pdc-row' }, g), h('p', { class: 'note', text: T('pdc_slot_note') }));
  }
  function cDraw(body, s) {
    const att = (tp().att[si] ||= []);
    drawTarget();
    drawSt = { q: s.q, tool: drawSt && drawSt.q === s.q ? drawSt.tool : 'pen', stroke: null, undo: [] };
    const tools = h('div', { class: 'seg' });
    const tb = (v, content, title) => { const b = h('button', { type: 'button', 'data-v': v, title, class: drawSt.tool === v ? 'on' : '' }, content); b.onclick = () => { drawSt.tool = v; tools.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }; tools.append(b); };
    tb('pen', ms('gesture'), T('tool_pen'));
    tb('line', h('span', { class: 'ic-wrap', html: ICON.line }), T('tool_line'));
    const cur = drawTarget;
    body.append(h('p', { class: 'note', text: T('pdc_draw_note', s.q === 's' ? 's' : s.q) }),
      h('div', { class: 'pdc-row' }, tools,
        h('button', { class: 'btn', type: 'button', title: T('pdc_undo'), onclick: () => { const u = drawSt.undo.pop(); if (u) { cur().segs = u; cur().ver++; saveProg(); dirty = true; } } }, ms('undo')),
        h('button', { class: 'btn', type: 'button', title: T('pdc_clear'), onclick: () => { drawSt.undo.push(cur().segs); cur().segs = []; cur().ver++; saveProg(); dirty = true; } }, ms('delete'))));
    if (att.length > 1) body.append(h('p', { class: 'note', text: T('pdc_attempts', att.length) }));
    slotBar(body, s);
  }
  /* an equation as the answer: s(t), checked by drawing it next to the reference */
  function cWrite(body, s) {
    const att = (tp().att[si] ||= []), n = latestOf(si, false), cur = n >= 0 ? att[n].f : '';
    const inp = h('input', { class: 'ta pdc-eqin', value: cur || '', placeholder: '0.3t − 0.6', spellcheck: 'false', autocomplete: 'off' });
    const msg = h('p', { class: 'note' });
    const apply = () => {
      const f = inp.value.trim().replace(/−/g, '-').replace(/,/g, '.');
      if (!f) return;
      if (!keyModel([{ kind: 's', f, end: Tw() }])) { msg.textContent = T('pdc_eq_bad'); return; }
      msg.textContent = '';
      const k = latestOf(si, false);
      if (k >= 0 && att[k].f === f) return;
      att.push({ type: 'write', f, ver: 0 }); saveProg(); dirty = true;
    };
    inp.addEventListener('change', apply); inp.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
    body.append(h('p', { class: 'note', text: T('pdc_write_note') }), h('div', { class: 'pdc-row' }, h('b', { text: 's(t) =' }), inp,
      h('button', { class: 'btn', type: 'button', onclick: apply }, ms('check'))), msg);
  }
  function cReveal(body, s) {
    if (!revealOpen(si)) {
      const inp = h('input', { class: 'ta pdc-code', inputmode: 'numeric', maxlength: 3, placeholder: '•••' });
      const tryCode = () => {
        if (+inp.value === codeFor(AK, ti, si)) { (tp().unl ||= {})[si] = true; saveProg(); renderStep(); }
        else { inp.classList.add('bad'); setTimeout(() => inp.classList.remove('bad'), 600); }
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') tryCode(); });
      body.append(h('p', { text: T('pdc_code_p') }), h('div', { class: 'pdc-row' }, inp, h('button', { class: 'btn primary', type: 'button', onclick: tryCode }, ms('lock_open'))));
      return;
    }
    const names = (s.graphs || []).map(q => q + '‑t').join(', ');
    if (names) body.append(h('p', { text: T('pdc_reveal_p', names) }));
    if (s.eq) body.append(h('p', { text: T('pdc_reveal_eq') }));
    if (keyOf() && canv.track) body.append(replayBtn());
  }
  /* pass the device; a private screen lets one person enter, or see, a secret function */
  function cHandover(body, s) {
    body.append(h('p', { class: 'pdc-pass', text: T('pdc_pass', L(s.role) || '') }));
    if (s.secret === 'enter') {
      const inp = h('input', { class: 'ta pdc-eqin', type: 'password', value: tp().secret || '', placeholder: 's(t)', spellcheck: 'false', autocomplete: 'off' });
      const msg = h('p', { class: 'note', text: T('pdc_secret_note', fx(Tw(), 0)) });
      const eye = h('button', { class: 'btn', type: 'button', title: T('pdc_peek') }, ms('visibility'));
      eye.onpointerdown = () => { inp.type = 'text'; }; eye.onpointerup = eye.onpointerleave = () => { inp.type = 'password'; };
      inp.oninput = () => {
        const f = inp.value.trim().replace(/−/g, '-').replace(/,/g, '.');
        const ok = f && keyModel([{ kind: 's', f, end: Tw() }]);
        tp().secret = ok ? f : ''; cache.clear(); anaCache.clear(); saveProg();
        msg.textContent = ok ? T('pdc_secret_ok') : f ? T('pdc_eq_bad') : T('pdc_secret_note', fx(Tw(), 0));
        const nx = $('.pdc-nav .btn.primary', root); if (nx) nx.disabled = !ok;
      };
      body.append(h('div', { class: 'pdc-row' }, h('b', { text: 's(t) =' }), inp, eye), msg);
    } else if (s.secret === 'show') {
      const out = h('p', { class: 'pdc-secret', text: '••••••' });
      const b = h('button', { class: 'btn', type: 'button' }, ms('visibility'), h('span', { text: T('pdc_hold_see') }));
      const showIt = on => { out.textContent = on ? 's(t) = ' + (tp().secret || '—') : '••••••'; };
      b.onpointerdown = e => { e.preventDefault(); showIt(true); }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => showIt(false);
      body.append(b, out, h('p', { class: 'note', text: T('pdc_secret_only') }));
    }
  }
  function replayBtn() {
    return h('button', { class: 'btn', type: 'button', onclick: () => { play = { t0: performance.now() }; dirty = true; } }, ms('play_arrow'), h('span', { text: T('pdc_replay') }));
  }
  function cCompare(body, s, V) {
    const K = keyOf();
    body.append(legend(V));
    const ul = h('ul', { class: 'pdc-obs' });
    if (!K) ul.append(h('li', { text: T('pdc_o_nokey') }));
    else for (const q of qsOf(task())) {
      if (!keyVisible(V, q)) continue;
      for (const src of sources(V, q)) {
        const r = analyzeC(q, src, K);
        for (const line of r.lines) ul.append(h('li', null, h('b', { text: q + '‑t · ' + src.name + ': ' }), line));
      }
      for (const c of cornersOf(K, q)) ul.append(h('li', null, h('b', { text: q + '‑t: ' }), T('pdc_o_' + c.kind, fx(c.t, 1))));
    }
    if (s.s0 && keyVisible(V, 's')) ul.append(h('li', { text: T('pdc_o_s0') }));
    if (ul.childNodes.length) body.append(ul);
    // answers to the questions since the previous comparison
    const rows = [];
    for (let j = si - 1; j >= 0; j--) {
      const st = steps()[j]; if (st.type === 'compare') break;
      if (st.type !== 'ask') continue;
      const ans = tp().ans[j] || {}, block = [];
      st.items.forEach((it, i) => {
        const open = it.kind === 'open' || !it.kind, e = expected(it), a = ans[i];
        if (open) { if (e == null && !(a && a.trim())) return; block.push([L(it.q), a && a.trim() ? a.trim() : '—', e || '', true]); return; }
        if (e == null) return; block.push([L(it.q), showVal(it, a), showVal(it, e), false]);
      });
      rows.unshift(...block);
    }
    // each question with what the group answered and, below, what the reference shows
    if (rows.length) {
      const box = h('div', { class: 'pdc-ans' });
      for (const [q, a, e, open] of rows) box.append(h('div', { class: 'pdc-arow' + (open || a === e ? '' : ' diff') },
        h('p', { class: 'q', text: q }),
        h('p', null, h('b', { text: T('pdc_you') + ': ' }), h('span', { class: open ? 'free' : '', text: a })),
        e ? h('p', null, h('b', { text: (K ? T('pdc_graph') : T('pdc_expected')) + ': ' }), h('span', { text: e })) : null));
      body.append(box);
    }
    const lastAct = (() => { for (let j = si - 1; j >= 0; j--) if (steps()[j].type === 'act') return j; return -1; })();
    const row = h('div', { class: 'pdc-row' });
    if (lastAct >= 0) row.append(h('button', { class: 'btn', type: 'button', onclick: () => retry(lastAct) }, ms('replay'), h('span', { text: T('pdc_retry') })));
    if (K && canv.track) row.append(replayBtn());
    body.append(row);
  }
  function legend(V) {
    const K = keyOf(), lg = h('div', { class: 'pdc-legend' });
    const item = (cls, txt) => lg.append(h('span', null, h('i', { class: cls }), txt));
    if (K) item('k', T('pdc_lg_key'));
    if (V.move >= 0 && atts(V.move).length) item('m', T('pdc_lg_move'));
    if (V.draw >= 0 && atts(V.draw).some(a => a.segs && a.segs.length)) item('d', T('pdc_lg_draw'));
    if (V.write >= 0 && atts(V.write).some(a => a.f)) item('w', T('pdc_lg_write'));
    if ([V.move, V.draw, V.write].some(j => j >= 0 && hasAlt(j))) item('b', T('pdc_lg_alt'));
    if ([V.move, V.draw].some(j => j >= 0 && atts(j).filter(a => !a.alt).length > 1)) item('o', T('pdc_lg_old'));
    return lg;
  }
  function sources(V, q) {
    const out = [];
    const add = (j, name) => {
      for (const alt of [false, true]) {
        const n = latestOf(j, alt); if (n < 0) continue;
        const M = attModel(j, n); if (!M) continue;
        out.push({ name: name + (alt ? ' B' : hasAlt(j) ? ' A' : ''), M, n, ver: atts(j)[n].ver || 0, move: steps()[j].kind === 'move', alt });
      }
    };
    if (V.draw >= 0 && steps()[V.draw].q === q) add(V.draw, T('pdc_lg_draw'));
    if (V.move >= 0 && moveVisible(V, q)) add(V.move, T('pdc_lg_move'));
    if (V.write >= 0 && writeVisible(V, q)) add(V.write, T('pdc_lg_write'));
    return out;
  }
  const hasAlt = j => atts(j).some(a => a.alt);
  const writeVisible = (V, q) => V.write >= 0 && (q === 's' || keyVisible(V, q));
  function retry(j) {
    si = j; slot = 'A';
    if (steps()[j].kind === 'draw') { const att = (tp().att[j] ||= []), n = latestOf(j, false); att.push({ type: 'draw', segs: n >= 0 ? JSON.parse(JSON.stringify(att[n].segs)) : [], ver: 0 }); }
    saveProg(); renderStep();
  }
  function cReflect(body, s) {
    const ol = h('ol', { class: 'pdc-ref' });
    for (const p of s.prompts || []) ol.append(h('li', { text: L(p) }));
    body.append(ol, h('p', { class: 'note', text: T('pdc_paper') }),
      h('button', { class: 'btn', type: 'button', onclick: () => { clean = !clean; root.classList.toggle('clean', clean); dirty = true; } }, ms('grid_on'), h('span', { text: T('pdc_clean') })));
  }

  /* ---------------------------------------------------------------- recording the ball */
  const moveState = {};
  function trackX(cv) { const w = cv.clientWidth, [lo, hi] = SR(); return { a0: 28, a1: w - 28, lo, hi, X: s => 28 + (s - lo) / (hi - lo) * (w - 56), S: x => lo + (x - 28) / (w - 56) * (hi - lo) }; }
  function trackInput(cv) {
    let down = false;
    const at = e => { const r = cv.getBoundingClientRect(), m = trackX(cv); moveState.ball = clamp(m.S(e.clientX - r.left), m.lo, m.hi); dirty = true; };
    cv.addEventListener('pointerdown', e => { const s = step(); if (!(s.type === 'act' && s.kind === 'move')) return; down = true; moveState.down = true; cv.setPointerCapture(e.pointerId); at(e); });
    cv.addEventListener('pointermove', e => { if (down) at(e); });
    const up = () => { down = false; moveState.down = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
  /* recording is a toggle (tap the button or R) or held (keep the button or R pressed); the clock starts at
     the press, so the start of the movement, with its acceleration, is part of the record */
  function startRec() {
    const now = performance.now();
    rec = { phase: 'rec', t0: now, raw: [[0, moveState.ball ?? 0]] };
    const b = $('#pdcRec', root); if (b) { b.classList.add('recording'); b.lastChild.textContent = T('pdc_stop'); }
    dirty = true;
  }
  let holdAt = 0, holdStarted = false;
  function recPress() {
    const s = step(); if (!(s && s.type === 'act' && s.kind === 'move')) return;
    if (rec) { stopRec(true); holdStarted = false; return; }
    startRec(); holdAt = performance.now(); holdStarted = true;
  }
  function recRelease() { if (holdStarted && rec && performance.now() - holdAt > 450) stopRec(true); holdStarted = false; }
  function stopRec(keep = false) {
    if (!rec) return;
    const r = rec; rec = null;
    if (keep && r.raw.length > 5) {
      const s = resample(r.raw);
      if (s && s.length > 5) { (tp().att[si] ||= []).push({ type: 'move', alt: slot === 'B' || undefined, s: Array.from(s, x => Math.round(x * 1e4) / 1e4), ver: 0 }); saveProg(); }
    }
    if (open && view === 'run' && step().type === 'act') renderStep();
  }
  function recTick(now) {
    if (!rec) return;
    // after the countdown the clock starts when the ball is held, so grabbing it is not part of the motion
    if (rec.phase === 'rec') {
      const t = (now - rec.t0) / 1000;
      if (t >= Tw()) { rec.raw.push([Tw(), moveState.ball]); stopRec(true); return; }
      const last = rec.raw[rec.raw.length - 1];
      if (t > last[0] + 1e-4) rec.raw.push([t, moveState.ball]);
      if (!rec.live || now - rec.liveAt > 50) { const s = resample(rec.raw); rec.live = s && s.length > 3 ? buildRecModel(s, 8) : null; rec.liveAt = now; }
    }
    dirty = true;
  }

  /* ---------------------------------------------------------------- drawing on a graph */
  function graphInput(q, cv) {
    const pt = e => { const g = canv.q[q], r = cv.getBoundingClientRect(); return [clamp(g.P.invX(e.clientX - r.left), 0, Tw()), g.P.invY(e.clientY - r.top)]; };
    cv.addEventListener('pointerdown', e => {
      const s = step(); if (!(s.type === 'act' && s.kind === 'draw' && s.q === q) || !drawSt) return;
      cv.setPointerCapture(e.pointerId);
      const segs = drawTarget().segs, [t, y] = pt(e);
      const end = segs.length ? segs[segs.length - 1].tb : 0, ya = segs.length ? segs[segs.length - 1].yb : y;
      const ta = segs.length && t < end - 0.05 ? t : end;
      drawSt.stroke = { pts: [[ta, segs.length ? ya : y]], ta, ya: segs.length ? ya : y, tb: ta, yb: y };
      dirty = true;
    });
    cv.addEventListener('pointermove', e => {
      if (!drawSt || !drawSt.stroke) return;
      const st = drawSt.stroke, [t, y] = pt(e);
      if (drawSt.tool === 'pen') { if (t > st.pts[st.pts.length - 1][0] + 0.004) st.pts.push([t, y]); }
      else { st.tb = Math.max(st.ta + 0.05, t); st.yb = y; }
      dirty = true;
    });
    const up = () => {
      if (!drawSt || !drawSt.stroke) return;
      const st = drawSt.stroke; drawSt.stroke = null;
      let g = null;
      if (drawSt.tool === 'pen') { if (st.pts.length >= 3 && st.pts[st.pts.length - 1][0] - st.ta > 0.1) g = freeSeg(st.pts); }
      else if (st.tb > st.ta + 0.04) g = { type: 'line', ta: st.ta, tb: st.tb, ya: st.ya, yb: st.yb, blend: false };
      if (g) {
        const cur = drawTarget();
        drawSt.undo.push(cur.segs); cur.segs = splice(cur.segs, g, true); cur.ver = (cur.ver || 0) + 1; saveProg();
      }
      dirty = true;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }

  /* ---------------------------------------------------------------- drawing the stage */
  function rangeOf(q) {
    const st = task().setup || {};
    if (q === 's') return SR();
    if (Array.isArray(st[q]) && st[q][1] > st[q][0]) return st[q];
    const K = keyOf();
    if (K) { const [lo, hi] = K.range[q], pad = Math.max(0.15 * (hi - lo), 0.25); return [Math.min(lo - pad, -0.25), Math.max(hi + pad, 0.25)]; }
    return [-1, 1];
  }
  function drawAll(now) {
    if (view !== 'run') return;
    const V = vis(), K = keyOf(), col = C(), s = step();
    const qc = { s: col.cs, v: col.cv, a: col.ca };
    const playT = play ? Math.min((now - play.t0) / 1000, Tw()) : null;
    if (play && playT >= Tw()) play = null;
    for (const q of Object.keys(canv.q)) {
      const { P, box } = canv.q[q];
      const [lo, hi] = rangeOf(q);
      const c = P.begin(); P.range(0, Tw(), lo, hi);
      P.grid({ yl: q + ' (' + UNIT[q] + ')', ycol: qc[q], xl: 't (s)' });
      P.clipOn();
      const isCompare = s.type === 'compare', drawHere = s.type === 'act' && s.kind === 'draw' && s.q === q;
      let shown = false;
      // the same velocity from other starting positions
      if (isCompare && s.s0 && q === 's' && K && keyVisible(V, 's')) {
        const s00 = K.S(0);
        for (const s0 of s.s0) for (const pc of K.pieces) { P.line(pc.t, Array.from(pc.s, y => y - s00 + s0), col.muted, 1.6, [5, 5]); }
      }
      // differences
      if (isCompare && K && keyVisible(V, q)) {
        const src = sources(V, q).find(x => !x.alt);
        if (src) {
          const r = analyzeC(q, src, K);
          for (const [a, b] of r.bands) { c.save(); c.globalAlpha = 0.14; c.fillStyle = col.accent; c.fillRect(P.X(a), P.y1, P.X(b) - P.X(a), P.y0 - P.y1); c.restore(); }
          if (r.gap) { P.seg(r.gap.t, r.gap.a, r.gap.t, r.gap.k, col.accent, 2, [3, 3]); }
        }
        for (const cn of cornersOf(K, q)) { P.seg(cn.t, lo - 1e3, cn.t, hi + 1e3, col.warn, 1.6, [4, 4]); label(c, cn.kind === 'jump_v' ? '!' : '∠', P.X(cn.t) + 4, P.y1 + 26, col.warn, 'left', 13); }
      }
      // the key
      if (K && keyVisible(V, q)) { shown = true; for (const pc of K.pieces) P.line(pc.t, pc[q], qc[q], 3.2); }
      // answers: A solid, the alternative B dashed, earlier attempts faint
      const layer = (j, colr, w) => {
        const nA = latestOf(j, false), nB = latestOf(j, true);
        atts(j).forEach((a, n) => {
          const M = attModel(j, n); if (!M) return; shown = true;
          const main = (n === nA || n === nB) && !(rec && j === si);
          c.save(); c.globalAlpha = main ? 1 : 0.3;
          for (const pc of M.pieces) P.line(pc.t, pc[q], colr, main ? w : 1.6, n === nB ? [9, 6] : main ? null : [3, 4]);
          c.restore();
        });
      };
      if (V.draw >= 0 && steps()[V.draw].q === q) layer(V.draw, col.ink, 2.6);
      if (V.write >= 0 && writeVisible(V, q)) layer(V.write, col.muted, 2.6);
      if (V.move >= 0 && (moveVisible(V, q) || (rec && V.move === si && (steps()[si].live || []).includes(q)))) {
        layer(V.move, col.accent, 3);
        if (rec && rec.live && V.move === si) { shown = true; P.line(rec.live.pieces[0].t, rec.live.pieces[0][q], col.accent, 3, slot === 'B' ? [9, 6] : null); }
      }
      // the stroke being drawn
      if (drawHere && drawSt && drawSt.stroke) {
        const st = drawSt.stroke;
        if (drawSt.tool === 'pen') P.line(st.pts.map(p => p[0]), st.pts.map(p => p[1]), col.accent, 3);
        else P.seg(st.ta, st.ya, st.tb, st.yb, col.accent, 3);
      }
      // replay cursor
      if (playT != null) { P.seg(playT, lo - 1e3, playT, hi + 1e3, col.ink, 1.2); if (K && keyVisible(V, q)) P.dot(playT, K.at(playT)[QI[q]], qc[q], 5); }
      if (rec && rec.phase === 'rec') { const t = (now - rec.t0) / 1000; P.seg(t, lo - 1e3, t, hi + 1e3, col.ink, 1.2); }
      P.clipOff();
      if (drawHere) {
        c.save(); c.strokeStyle = col.accent; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(P.x0 + 2, P.y1 - 1, P.x1 - P.x0 - 2, P.y0 - P.y1 + 1); c.restore();
        label(c, '✎ ' + T('pdc_drawhere'), P.x1 - 6, P.y1 + 16, col.accent, 'right', 11);
        shown = true;
      }
      // the hatched cover marks a reference that is still a secret; an empty graph is just empty
      const liveHere = s.type === 'act' && s.kind === 'move' && (s.live || []).includes(q);
      box.classList.toggle('hidden-g', !shown && !liveHere && !!K && !keyVisible(V, q));
      box.dataset.hid = T('pdc_hidden');
    }
    if (canv.track) drawTrack(now, V, K, playT);
  }
  function drawTrack(now, V, K, playT) {
    const cv = canv.track, { ctx: c, w, h: H } = fit(cv), col = C(), m = trackX(cv), base = Math.round(H * 0.62) + 0.5;
    c.fillStyle = col.surface; c.fillRect(0, 0, w, H);
    const counting = rec && rec.phase === 'wait', recording = rec && rec.phase === 'rec';
    // a short flash at each full second while recording, so the time can be felt
    if (recording) { const t = (now - rec.t0) / 1000, f = t - Math.floor(t); if (f < 0.12) { c.fillStyle = col.target; c.fillRect(0, 0, w, H); } }
    c.strokeStyle = col.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(m.a0 - 10, base); c.lineTo(m.a1 + 12, base); c.stroke();
    c.fillStyle = col.ink; c.beginPath(); c.moveTo(m.a1 + 18, base); c.lineTo(m.a1 + 9, base - 5); c.lineTo(m.a1 + 9, base + 5); c.fill();
    const tick = (m.hi - m.lo) <= 2.5 ? 0.5 : 1;
    c.font = `10.5px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
    for (let x = Math.ceil(m.lo / tick) * tick; x <= m.hi + 1e-9; x += tick) {
      const px = m.X(x); c.strokeStyle = col.ink; c.lineWidth = x === 0 ? 2 : 1.2; c.beginPath(); c.moveTo(px, base); c.lineTo(px, base + (x === 0 ? 8 : 5)); c.stroke();
      c.fillStyle = Math.abs(x) < 1e-9 ? col.ink : col.muted; c.fillText(fx(x, tick < 1 ? 1 : 0), px, base + 10);
    }
    label(c, 's (m)', m.a1 + 14, base - 10, col.ink, 'right', 11);
    const ball = (s, fill, txt) => { const x = m.X(clamp(s, m.lo, m.hi)); c.save(); c.fillStyle = fill; c.strokeStyle = col.ink; c.lineWidth = 2; c.beginPath(); c.arc(x, base - 13, 12, 0, 7); c.fill(); c.stroke(); if (txt) { c.font = `700 10px ${FONT}`; c.fillStyle = '#0A1240'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, base - 12.5); } c.restore(); };
    const isMove = step().type === 'act' && step().kind === 'move';
    if (playT != null) {
      if (K && V.revealed.size + V.given.size) ball(K.S(playT), col.tile2, '');
      const att = tp().att[V.move] || []; const M = att.length ? attModel(V.move, att.length - 1) : null;
      if (M && playT <= M.T) ball(M.S(playT), col.accent, '');
    } else if (isMove || rec) ball(moveState.ball ?? 0, col.accent, '');
    if (recording || counting) {
      const t = recording ? (now - rec.t0) / 1000 : 0;
      c.font = `700 22px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = recording ? col.err : col.muted;
      c.fillText('t = ' + fx(t, 1) + ' s', 12, 8);
    }
    if (isMove && !rec && playT == null) label(c, T('pdc_track_hint'), 12, 18, col.muted, 'left', 11);
  }
  function loop() {
    cancelAnimationFrame(raf);
    const fr = now => {
      if (!open) return;
      try {
        recTick(now);
        if (dirty || rec || play) { dirty = false; drawAll(now); }
      } catch (e) { console.error(e); }
      raf = requestAnimationFrame(fr);
    };
    raf = requestAnimationFrame(fr);
  }
  addEventListener('resize', () => { dirty = true; });
  addEventListener('keyup', e => { if (open && (e.key === 'r' || e.key === 'R')) recRelease(); });
  addEventListener('keydown', e => {
    if (!open || view !== 'run' || e.target.closest('input,textarea')) return;
    if ((e.key === 'r' || e.key === 'R') && !e.repeat && !e.metaKey && !e.ctrlKey) { recPress(); return; }
    if (e.key === 'Escape' && clean) { clean = false; root.classList.remove('clean'); dirty = true; }
  });

  return {
    isOpen: () => open,
    home: () => { show(true); home(); },
    fromLink,
    redraw: () => { dirty = true; },
    refresh: () => { if (!open) return; if (view === 'home') home(); else if (view === 'run' && A) buildTask(); dirty = true; }
  };
}
