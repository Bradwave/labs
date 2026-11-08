/* Motus 1D Lab: state, panels and wiring. Drawing is in views.js, the motion model in model.js.
   Coordinates: equations are written in the current frame ("view"); recordings, drawings, free fall
   and challenge targets live in the fixed world coordinate w. The frame is x = dir·(w − o). */
import { initPDC } from './pdc.js';
import { T, num, fx, setDec, LANG, setLang, applyI18n } from './i18n.js';
import { pretty, compileExpr } from './parser.js';
import { compileSections, buildEqModel, buildRecModel, resample, REC_DT, transformModel, freeFallModel } from './model.js';
import { riemann, crossings, intervalStats } from './analysis.js';
import { Plot, C, resetColors, niceRange } from './plot.js';
import { drawGraph, drawTrack, drawMini } from './views.js';
import { PRESETS, TARGETS, clone } from './gallery.js';
import { ICON } from './icons.js';
import { featsFor, needs, ALL, FEAT_GROUPS } from './levels.js';
import qrcode from './vendor/qrcode.js';
import { encodeState, decodeState } from './share.js';
import { PLOTS, drawModel, cutAt, splice, freeSeg, handles, moveHandle, endT, valueAt, slopeLeft, segValue, FREE_DT, deleteNode } from './draw.js';

let PDC = null; // the activities mode (pdc.js), created at boot
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isNum = v => typeof v === 'number' && isFinite(v);
const r3 = v => Math.round(v * 1000) / 1000;
const fmtIn = v => (isNum(v) ? String(+v.toPrecision(4)) : '');
const pnum = s => parseFloat(String(s).replace(',', '.'));
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
const msIcon = n => h('span', { class: 'ms', text: n });
const svgIcon = n => h('span', { html: ICON[n], style: 'display:grid' });

/* ================================================================ state */
const DEF_AN = { tan: true, sec: false, areaV: true, areaA: false, avg: false, method: 'true', n: 8, t1: 1, t2: 4 };
const DEF_FF = { on: false, w0: 1, v0: 8, g: 9.81, floor: true, e: 0.6, T: 4 };
const S = {
  src: 'eq', motions: [], cur: { eq: null, draw: null, rec: null }, nextMid: 1, preset: 'trip', custom: null, params: {}, useTau: false, blendW: 0.4,
  nextId: 1, smooth: 8, chal: { id: 'c1', best: {} }, dec: 2,
  t: 0, playing: false, speed: 1,
  an: { ...DEF_AN }, show: { vel: true, acc: true, strobe: false, raw: false, diagram: false },
  gshow: { s: true, v: true, a: true },
  frame: { vert: false, o: 0, dir: 1 }, thr: { on: false, g: 9.81, e: 0.6, floor: true },
  draw: { tool: 'line', snap: true, Tmax: 6, rtool: 'nudge', radius: 6 },
  pred: { on: false, q: 'v', revealed: false, ys: [], tspan: 0 },
  hand: 'r', level: 4, locked: false, task: '', Q: 's', theme: 'auto', tab: 'motion'
};
/* ================================================================ motions
   Every motion is an item of S.motions: { id, type: 'eq'|'draw'|'rec', vis, data }.
   Each editor works on the current motion of its type (S.cur); the others can be shown for comparison. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MOT = id => S.motions.find(m => m.id === id);
const letterOf = m => LETTERS[S.motions.indexOf(m) % 26] || '?';
const DEF_SECS = () => [{ kind: 'u', f: '', end: '5', s0: { inh: false, e: '0' }, v0: { inh: false, e: '1' }, a: '0', blend: false }];
function defData(type) {
  if (type === 'eq') return { secs: DEF_SECS(), ff: { ...DEF_FF } };
  if (type === 'draw') return { q: 'v', segs: { s: [], v: [], a: [] }, s0: 0, v0: 0 };
  return { s: new Float64Array(0) };
}
function addMotion(type, data, makeCurrent = true) {
  const m = { id: S.nextMid++, type, vis: true, ver: 0, data: data || defData(type) };
  S.motions.push(m);
  if (makeCurrent) S.cur[type] = m.id;
  return m;
}
const okType = (m, type) => m && (type === 'draw' ? m.type === 'draw' || m.type === 'rec' : m.type === type);
/* the current motion of a type; equations and drawings always have one (created when missing) */
function curM(type, create = true) {
  let m = MOT(S.cur[type]);
  if (okType(m, type)) return m;
  m = [...S.motions].reverse().find(x => x.type === (type === 'draw' ? 'draw' : type)) || null;
  if (!m && create && type !== 'rec') m = addMotion(type, null, false);
  if (m) S.cur[type] = m.id;
  return m;
}
const DUMMY_EQ = defData('eq');
const eqData = () => { const m = curM('eq', S.src === 'eq'); return m ? m.data : DUMMY_EQ; };
Object.defineProperty(S, 'secs', { get: () => eqData().secs, set: v => { eqData().secs = v; } });
Object.defineProperty(S, 'ff', { get: () => eqData().ff, set: v => { eqData().ff = v; } });
const DUMMY_DRAW = defData('draw');
const drawData = () => { const m = curM('draw', S.src === 'draw'); return m && m.type === 'draw' ? m.data : DUMMY_DRAW; };
for (const k of ['q', 'segs', 's0', 'v0']) Object.defineProperty(S.draw, k, { get: () => drawData()[k], set: v => { drawData()[k] = v; } });
const editingRec = () => { const m = curM('draw', false); return m && m.type === 'rec' ? m : null; };
function activeMotion() {
  if (S.src === 'eq') return curM('eq', false);
  if (S.src === 'draw') return curM('draw', false);
  if (S.src === 'drag') return curM('rec', false);
  return null;
}

addMotion('eq', { secs: clone(PRESETS.find(p => p.id === 'trip').secs), ff: { ...DEF_FF } });
let F = featsFor(S.level);
const setF = () => { F = S.custom ? new Set(S.custom) : featsFor(S.level); };
const f = k => F.has(k);

/* ---------------- scenes: several saved states, one of them open.
   The index lists them; each scene is stored under its own key. Theme and language are shared. */
const KEY = 'motus1d.v1', IDX = 'motus1d.scenes', SKEY = id => 'motus1d.s.' + id;
const MAX_SCENES = 30;
let SC = { cur: 1, next: 2, list: [{ id: 1, name: '', updated: Date.now() }] };
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: k => { try { localStorage.removeItem(k); } catch (e) { /* */ } } };
function loadIndex() {
  try {
    const o = JSON.parse(store.get(IDX) || 'null');
    if (o && Array.isArray(o.list) && o.list.length) { SC = o; return; }
  } catch (e) { /* */ }
  // first run with scenes: the old single save becomes scene 1
  const old = store.get(KEY);
  if (old) { store.set(SKEY(1), old); store.del(KEY); }
  saveIndex();
}
const saveIndex = () => store.set(IDX, JSON.stringify(SC));
const curScene = () => SC.list.find(x => x.id === SC.cur) || SC.list[0];
let saveT = 0;
function save() {
  clearTimeout(saveT); saveT = setTimeout(doSave, 400);
  // a click, a release or a key is one step at once; sliders and typing ('input') settle first
  const ev = window.event;
  if (!ev || !['input', 'pointermove', 'mousemove', 'touchmove'].includes(ev.type)) histRecord();
}
/* ---------------- undo / redo (⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y) over the whole scene.
   Every save is a step; moving in time, playing or changing tab is not. One history per scene. */
const HIST = { list: [], i: -1, keys: [], busy: false };
const histKey = str => { const o = JSON.parse(str); delete o.t; delete o.playing; delete o.tab; delete o.nextId; if (o.draw) { delete o.draw.tool; delete o.draw.rtool; } return JSON.stringify(o); };
function histRecord() {
  if (HIST.busy || REC.on) return;
  const str = packState(), key = histKey(str);
  if (HIST.i >= 0 && HIST.keys[HIST.i] === key) { HIST.list[HIST.i] = str; return; }
  HIST.list = HIST.list.slice(0, HIST.i + 1); HIST.keys = HIST.keys.slice(0, HIST.i + 1);
  HIST.list.push(str); HIST.keys.push(key);
  if (HIST.list.length > 80) { HIST.list.shift(); HIST.keys.shift(); }
  HIST.i = HIST.list.length - 1;
}
function histReset() { HIST.list = []; HIST.keys = []; HIST.i = -1; HIST.busy = false; histRecord(); }
function histGo(d) {
  if (REC.on || gGrab) return;
  if (saveT) doSave(); // a change still waiting to be saved is a step of its own
  const j = HIST.i + d; if (j < 0 || j >= HIST.list.length) { toast(T(d < 0 ? 'undo_none' : 'redo_none')); return; }
  HIST.i = j; HIST.busy = true;
  const tab = S.tab, t = S.t, tool = S.draw.tool, rtool = S.draw.rtool, str = HIST.list[j]; // tools are not steps: they stay as chosen
  try {
    closePick(); undoBar.hidden = true; undoFn = null;
    freshState(); applyState(JSON.parse(str), false);
    try { const o = JSON.parse(str); if (isNum(o.nextId)) S.nextId = o.nextId; } catch (e) { /* */ }
    S.tab = tab; S.draw.tool = tool; S.draw.rtool = rtool; meetKey = ''; vtKey = ''; statsKey = '';
    renderAll(); S.t = t;
    const now = packState(); store.set(SKEY(curScene().id), now); HIST.list[j] = now; HIST.keys[j] = histKey(now);
  } finally { HIST.busy = false; }
  clearTimeout(saveT); saveT = 0;
  toast(T(d < 0 ? 'undone' : 'redone'));
}
function packState() { return JSON.stringify({ ...S, playing: false, motions: S.motions.map(m => packMotion(m)) }); }
function doSave() {
  clearTimeout(saveT); saveT = 0;
  histRecord();
  const sc = curScene();
  if (!store.set(SKEY(sc.id), packState())) { toast(T('store_full')); return; }
  sc.updated = Date.now(); sc.n = S.motions.length; saveIndex();
}
function loadScene(id) {
  try {
    const o = JSON.parse(store.get(SKEY(id)) || 'null');
    if (!o || (!Array.isArray(o.secs) && !Array.isArray(o.motions))) return false;
    applyState(o, false);
    if (isNum(o.nextId)) S.nextId = o.nextId;
    if (o.chal && o.chal.best) S.chal.best = o.chal.best;
    if (['motion', 'analysis', 'settings'].includes(o.tab)) S.tab = o.tab;
    return true;
  } catch (e) { return false; }
}
function load() {
  loadIndex();
  try { const t = store.get('motus1d.theme'); if (['auto', 'light', 'dark'].includes(t)) S.theme = t; } catch (e) { /* */ }
  { const hd = store.get('motus1d.hand'); S.hand = hd === 'l' ? 'l' : 'r'; } // the hand belongs to the person, not to the scene
  loadScene(SC.cur);
}
/* a new scene starts from the default motion but keeps level, frame, names and display choices */
function freshState() {
  S.motions = []; S.nextMid = 1; S.cur = { eq: null, draw: null, rec: null };
  addMotion('eq', { secs: clone(PRESETS.find(p => p.id === 'trip').secs), ff: { ...DEF_FF } });
  S.params = {}; S.an = { ...DEF_AN }; S.pred = { on: false, q: 'v', revealed: false, ys: [], tspan: 0 };
  S.t = 0; S.playing = false; S.task = ''; S.locked = false; S.custom = null; S.preset = 'trip'; S.src = 'eq'; S.chal.id = 'c1';
  CH.custom = null; CH.TM = null; CH.attempt = null; CH.score = null; MEQ = null; MFF = null; MDR = null; undo = []; meetKey = ''; statsKey = '';
  setF();
}
function openScene(id) {
  if (REC.on) stopRec(true);
  doSave();
  freshState();
  SC.cur = id; saveIndex();
  loadScene(id);
  $('#task').hidden = !S.task; $('#taskTxt').textContent = S.task;
  renderAll(); renderScenes(); histReset();
}
function newScene(copy) {
  if (SC.list.length >= MAX_SCENES) { toast(T('scenes_max', MAX_SCENES)); return; }
  doSave();
  const id = SC.next++, src = curScene();
  SC.list.push({ id, name: copy ? T('copy_of', sceneName(src)) : '', updated: Date.now(), n: copy ? S.motions.length : 1 });
  if (copy) { store.set(SKEY(id), packState()); SC.cur = id; saveIndex(); openScene(id); return; }
  freshState(); SC.cur = id; saveIndex(); doSave();
  $('#task').hidden = true;
  renderAll(); renderScenes(); toast(T('scene_new'));
}
function deleteScene(id) {
  SC.list = SC.list.filter(x => x.id !== id); store.del(SKEY(id));
  if (!SC.list.length) { SC.list.push({ id: SC.next, name: '', updated: Date.now() }); SC.cur = SC.next++; saveIndex(); freshState(); renderAll(); renderScenes(); return; }
  if (SC.cur === id) { SC.cur = SC.list[SC.list.length - 1].id; saveIndex(); freshState(); loadScene(SC.cur); renderAll(); }
  saveIndex(); renderScenes();
}
const sceneName = sc => sc.name || T('scene_n', SC.list.indexOf(sc) + 1);

/* a motion as stored: recordings become plain arrays, caches are left out */
function packMotion(m, forLink) {
  const o = { id: m.id, type: m.type, vis: m.vis, edited: !!m.edited, hid: m.hid || undefined };
  if (m.type === 'rec') {
    if (forLink) { const s = m.data.s, a = []; for (let i = 0; i < s.length; i += 4) a.push(Math.round(s[i] * 100) / 100); o.data = { s4: a }; }
    else o.data = { s: Array.from(m.data.s, r3) };
  } else if (m.type === 'draw' && forLink) {
    // freehand pieces keep one sample in two; the spacing is restored on load
    const segs = {}; for (const q of ['s', 'v', 'a']) segs[q] = m.data.segs[q].map(g => (g.type === 'free' ? { ...g, ys: g.ys.filter((_, i) => i % 2 === 0).map(x => Math.round(x * 100) / 100), half: true } : g));
    o.data = { ...m.data, segs };
  } else o.data = m.data;
  return o;
}
const okSeg = g => g && ['line', 'para', 'free'].includes(g.type) && [g.ta, g.tb, g.ya, g.yb].every(isNum) && g.tb > g.ta && (g.type !== 'para' || isNum(g.m0)) && (g.type !== 'free' || (Array.isArray(g.ys) && g.ys.length > 1));
/* shared by local restore and shared links: only known fields, checked */
function applyState(o, fromLink) {
  const okSec = s => s && ['s', 'v', 'a', 'u'].includes(s.kind) && typeof s.end === 'string' && s.s0 && s.v0;
  const cleanSecs = a => a.map(s => ({ kind: s.kind, f: String(s.f || ''), end: s.end, s0: { inh: !!s.s0.inh, e: String(s.s0.e ?? '0') }, v0: { inh: !!s.v0.inh, e: String(s.v0.e ?? '0') }, a: String(s.a ?? '0'), blend: !!s.blend }));
  const cleanFF = x => { const r = { ...DEF_FF }; if (x) for (const k in DEF_FF) if (typeof x[k] === typeof DEF_FF[k]) r[k] = x[k]; return r; };
  const cleanDraw = d => {
    const r = defData('draw');
    if (['s', 'v', 'a'].includes(d.q)) r.q = d.q;
    for (const k of ['s0', 'v0']) if (isNum(d[k])) r[k] = d[k];
    const unhalf = g => {
      if (!g || !g.half || !Array.isArray(g.ys)) return g;
      const a = g.ys, b = []; for (let i = 0; i < a.length - 1; i++) b.push(a[i], (a[i] + a[i + 1]) / 2); b.push(a[a.length - 1]);
      const { half, ...rest } = g; return { ...rest, ys: b, tb: g.ta + (b.length - 1) * FREE_DT };
    };
    if (d.segs) for (const q of ['s', 'v', 'a']) if (Array.isArray(d.segs[q])) { const a = d.segs[q].map(unhalf); if (a.every(okSeg)) r.segs[q] = a; }
    return r;
  };
  const recArr = d => {
    if (Array.isArray(d.s4) && d.s4.length > 3) { // links keep one sample in four
      const a = d.s4, n = (a.length - 1) * 4 + 1, s = new Float64Array(n);
      for (let k = 0; k < n; k++) { const f0 = k / 4, i = Math.min(Math.floor(f0), a.length - 2), r = f0 - i; s[k] = a[i] * (1 - r) + a[i + 1] * r; }
      return s;
    }
    return Array.isArray(d.s) && d.s.length > 3 && d.s.every(isNum) ? Float64Array.from(d.s) : null;
  };
  const mots = [];
  if (Array.isArray(o.motions)) {
    for (const m of o.motions) {
      if (!m || !m.data) continue;
      const hid = m.hid && typeof m.hid === 'object' ? { s: !!m.hid.s, v: !!m.hid.v, a: !!m.hid.a } : null;
      if (m.type === 'eq' && Array.isArray(m.data.secs) && m.data.secs.length && m.data.secs.every(okSec)) mots.push({ type: 'eq', vis: m.vis !== false, data: { secs: cleanSecs(m.data.secs), ff: cleanFF(m.data.ff) }, id: m.id, hid });
      else if (m.type === 'draw') mots.push({ type: 'draw', vis: m.vis !== false, data: cleanDraw(m.data), id: m.id, hid });
      else if (m.type === 'rec') { const a = recArr(m.data); if (a) mots.push({ type: 'rec', vis: m.vis !== false, data: { s: a }, edited: !!m.edited, id: m.id, hid }); }
    }
  } else { // older formats: one set of equations, an optional object B, recordings, a drawing
    if (Array.isArray(o.secs) && o.secs.length && o.secs.every(okSec)) mots.push({ type: 'eq', vis: true, data: { secs: cleanSecs(o.secs), ff: cleanFF(o.ff) } });
    if (o.bOn && Array.isArray(o.secsB) && o.secsB.every(okSec)) mots.push({ type: 'eq', vis: true, data: { secs: cleanSecs(o.secsB), ff: { ...DEF_FF } } });
    if (o.draw && o.draw.segs && Object.values(o.draw.segs).some(a => Array.isArray(a) && a.length)) mots.push({ type: 'draw', vis: true, data: cleanDraw(o.draw) });
    for (const r of [...(Array.isArray(o.recs) ? o.recs : []), ...(o.rec ? [{ s4: o.rec }] : [])]) { const a = recArr(r); if (a) mots.push({ type: 'rec', vis: true, data: { s: a } }); }
  }
  if (mots.length || (Array.isArray(o.motions) && !o.motions.length)) {
    const oldCur = o.cur || {};
    S.motions = []; S.nextMid = 1; S.cur = { eq: null, draw: null, rec: null };
    const idMap = {};
    for (const m of mots) { const nm = addMotion(m.type, m.data, false); nm.edited = !!m.edited; if (m.hid) nm.hid = m.hid; if (m.vis === false) nm.hid = { s: true, v: true, a: true }; /* older saves hid a motion with vis */ if (m.id != null) idMap[m.id] = nm.id; }
    for (const k of ['eq', 'draw', 'rec']) S.cur[k] = idMap[oldCur[k]] ?? null;
  }
  if (o.params && typeof o.params === 'object') {
    S.params = {};
    for (const n in o.params) { const p = o.params[n]; if (p && [p.v, p.min, p.max, p.step].every(isNum)) S.params[n] = { v: p.v, min: p.min, max: p.max, step: p.step }; }
  }
  if (['eq', 'draw', 'drag', 'chal'].includes(o.src)) S.src = o.src;
  if (typeof o.preset === 'string') S.preset = o.preset;
  S.useTau = !!o.useTau;
  if (isNum(o.blendW)) S.blendW = clamp(o.blendW, 0.05, 2);
  if (isNum(o.smooth)) S.smooth = clamp(Math.round(o.smooth), 1, 30);
  if (o.an) for (const k in DEF_AN) if (typeof o.an[k] === typeof DEF_AN[k]) S.an[k] = o.an[k];
  if (!['true', 'left', 'mid', 'right', 'trap'].includes(S.an.method)) S.an.method = 'true';
  if (o.show) for (const k in S.show) if (typeof o.show[k] === 'boolean') S.show[k] = o.show[k];
  if (o.frame) { S.frame.vert = !!o.frame.vert; if (isNum(o.frame.o)) S.frame.o = o.frame.o; S.frame.dir = o.frame.dir === -1 ? -1 : 1; }
  if (o.draw) {
    const d = o.draw;
    if (['pen', 'line', 'para', 'move'].includes(d.tool)) S.draw.tool = d.tool;
    if (['nudge', 'pen'].includes(d.rtool)) S.draw.rtool = d.rtool;
    if (isNum(d.radius)) S.draw.radius = clamp(Math.round(d.radius), 0, 30);
    S.draw.snap = d.snap !== false;
    if (isNum(d.Tmax)) S.draw.Tmax = clamp(d.Tmax, 1, 60);
  }
  if (o.thr) for (const k in S.thr) if (typeof o.thr[k] === typeof S.thr[k]) S.thr[k] = o.thr[k];
  if ([0, 1, 2, 3].includes(o.dec)) S.dec = o.dec;
  if (o.gshow) for (const k of ['s', 'v', 'a']) if (typeof o.gshow[k] === 'boolean') S.gshow[k] = o.gshow[k];
  if (o.pred) { S.pred.on = !!o.pred.on; if (['s', 'v', 'a'].includes(o.pred.q)) S.pred.q = o.pred.q; S.pred.revealed = !!o.pred.revealed && !fromLink; S.pred.ys = fromLink ? [] : (Array.isArray(o.pred.ys) ? o.pred.ys.map(x => (x === null ? NaN : x)) : []); S.pred.tspan = isNum(o.pred.tspan) ? o.pred.tspan : 0; }
  if ([1, 2, 3, 4].includes(o.level)) S.level = o.level;
  if (['s', 'x', 'r', 'y', 'h'].includes(o.Q)) S.Q = o.Q;
  if (o.chal && TARGETS.some(t => t.id === o.chal.id)) S.chal.id = o.chal.id;
  S.locked = !!o.locked; S.task = String(o.task || '').slice(0, 600);
  S.custom = Array.isArray(o.custom) ? o.custom.filter(k => ALL.includes(k)) : null;
  if (o.cx && typeof o.cx === 'object') { // links store only the difference from the level
    const set = featsFor([1, 2, 3, 4].includes(o.level) ? o.level : 4);
    for (const k of o.cx.m || []) set.delete(k);
    for (const k of o.cx.p || []) if (ALL.includes(k)) set.add(k);
    S.custom = [...set];
  }
  setF();
}

/* ================================================================ frames */
const toV = (w, q = 's') => (q === 's' ? S.frame.dir * (w - S.frame.o) : S.frame.dir * w);
const toW = (x, q = 's') => (q === 's' ? S.frame.o + S.frame.dir * x : S.frame.dir * x);
const viewOf = Mw => (Mw ? transformModel(Mw, -S.frame.dir * S.frame.o, S.frame.dir) : null);
const worldOf = Mv => (Mv ? transformModel(Mv, S.frame.o, S.frame.dir) : null);
const ffActive = () => { const m = curM('eq', false); return !!m && S.frame.vert && m.data.ff.on && f('ff'); };

/* rewrite "A + B·(text)": the motion stays where it is when the frame changes */
function balancedWrap(s) {
  if (!/^[−-]\(/.test(s) || !s.endsWith(')')) return null;
  let d = 0;
  for (let i = 1; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') { d--; if (d === 0 && i < s.length - 1) return null; } }
  return s.slice(2, -1);
}
function affineText(src, A, B) {
  if (A === 0 && B === 1) return src;
  const r = compileExpr(src);
  if (!r.err && r.vars.length === 0) return fmtIn(r3(A + B * r.fn({})));
  let core = src.trim(), c0 = 0;
  // a trailing "+ n" or "− n" from an earlier shift is folded into the new constant
  const m = /^(.*\S)\s*([+−-])\s*(\d+(?:\.\d+)?)$/.exec(core);
  if (m && !compileExpr(m[1]).err) { core = m[1]; c0 = (m[2] === '+' ? 1 : -1) * parseFloat(m[3]); }
  let neg = B < 0;
  const inner = neg ? balancedWrap(core) : null;
  if (inner !== null) { core = inner; neg = false; }
  let out = neg ? '−(' + core + ')' : core;
  const k = r3(A + B * c0);
  if (k !== 0) out += (k > 0 ? ' + ' : ' − ') + fmtIn(Math.abs(k));
  return out;
}
function setFrame(o, dir) {
  const oOld = S.frame.o, dOld = S.frame.dir;
  o = r3(o); if (o === oOld && dir === dOld) return;
  const A = dir * (oOld - o), B = dir * dOld;
  for (const m of S.motions) if (m.type === 'eq') m.data.secs.forEach((s, i) => {
    if (s.kind === 's') s.f = affineText(s.f, A, B);
    else if (s.kind === 'v' || s.kind === 'a') s.f = affineText(s.f, 0, B);
    if (!s.s0.inh || i === 0) s.s0.e = affineText(s.s0.e, A, B);
    if (!s.v0.inh || i === 0) s.v0.e = affineText(s.v0.e, 0, B);
    if (s.kind === 'u') s.a = affineText(s.a, 0, B);
  });
  if (S.pred.ys.length) S.pred.ys = S.pred.ys.map(y => (S.pred.q === 's' ? A + B * y : B * y));
  S.frame.o = o; S.frame.dir = dir;
  renderSections(); recompile(); renderFF(); renderDraw(); syncFrameUI(); onModelChange(); save();
}
function setVert(v) {
  if (S.frame.vert === v) return;
  S.frame.vert = v;
  const map = v ? { x: 'y', r: 'h' } : { y: 'x', h: 'r' };
  if (map[S.Q]) S.Q = map[S.Q];
  $('#arena').classList.toggle('vert', v);
  buildQSeg(); renderSections(); renderFF(); syncFrameUI(); renderDraw(); onModelChange(); save();
}

/* ================================================================ models */
const E = Object.create(null);
let MFF = null, MEQ = null, CMP = null, errsEq = [], modelGen = 0;
const cmpCache = new Map();
function compiledOf(secs) {
  const k = JSON.stringify(secs);
  let c = cmpCache.get(k);
  if (!c) { c = compileSections(secs, T); cmpCache.set(k, c); if (cmpCache.size > 60) cmpCache.delete(cmpCache.keys().next().value); }
  return c;
}
const allVars = () => [...new Set(S.motions.filter(m => m.type === 'eq').flatMap(m => { const c = m === curM('eq', false) && CMP ? CMP : compiledOf(m.data.secs); return c.ok ? c.vars : []; }))];
function syncParams() {
  for (const n of allVars()) if (!S.params[n]) {
    const wide = n === 'ω' || n === 'k';
    S.params[n] = { v: 1, min: wide ? 0 : -5, max: 5, step: 0.01 };
  }
}
function recompile() {
  CMP = compileSections(S.secs, T);
  syncParams(); rebuild(); renderParams();
}
function rebuild() {
  modelGen++;
  for (const n of allVars()) E[n] = S.params[n].v;
  errsEq = [];
  if (CMP && CMP.ok) {
    CMP.comp.forEach((c, i) => { c.blend = !!(S.secs[i] && S.secs[i].blend); });
    const M = buildEqModel(CMP, E, { blendW: S.blendW });
    errsEq = M.ok ? [] : M.errs.map(e => ({ ...e, msg: T(e.msg) }));
    if (M.ok) MEQ = M;
  }
  if (MEQ) { clampInterval(MEQ.T); if (S.src === 'eq') S.t = Math.min(S.t, MEQ.T); }
  { const m = curM('eq', S.src === 'eq'); if (m) m.ver++; }
  showSecErrors(); refreshSections(); statsKey = ''; meetKey = ''; dirty = true; renderMotions(); save();
}
function rebuildFF() { MFF = freeFallModel(S.ff); MFF = MFF && MFF.ok ? MFF : null; { const m = curM('eq', S.src === 'eq'); if (m) m.ver++; } statsKey = ''; dirty = true; }
let MDR = null;
function rebuildDraw() {
  const m = curM('draw', S.src === 'draw');
  MDR = m && m.type === 'draw' ? drawModel(m.data.segs[m.data.q], m.data.q, m.data.s0, m.data.v0) : null;
  if (m) m.ver++;
  statsKey = ''; meetKey = ''; dirty = true; refreshDrawJoints();
}
/* the world model of any motion (cached); the current one of each editor is built by that editor */
function motionWorld(m) {
  if (!m) return null;
  if (m.type === 'rec') return recModel(m);
  const key = [modelGen, m.ver, S.frame.o, S.frame.dir, S.frame.vert, S.blendW, f('ff')].join('|');
  if (m._k === key) return m._M;
  let M = null;
  if (m.type === 'eq') {
    if (m.data.ff.on && S.frame.vert && f('ff')) M = freeFallModel(m.data.ff);
    else {
      const c = compiledOf(m.data.secs);
      if (c.ok) {
        const env = Object.create(null); for (const n of c.vars) env[n] = S.params[n] ? S.params[n].v : 1;
        c.comp.forEach((cc, i) => { cc.blend = !!m.data.secs[i].blend; });
        const Mv = buildEqModel(c, env, { blendW: S.blendW });
        M = Mv.ok ? worldOf(Mv) : null;
      }
    }
  } else M = drawModel(m.data.segs[m.data.q], m.data.q, m.data.s0, m.data.v0);
  m._k = key; m._M = M && M.ok !== false ? tagModel(M) : null;
  return m._M;
}

const REC = { on: false, raw: [], t0: 0, live: null, hold: false, startedAt: 0, lastT: 0, thrown: false, restSince: 0 };
const CH = { TM: null, tq: 's', attempt: null, attemptS: null, score: null, count: 0, countEnd: 0 };
let ball = 5, ballFree = false, trkDrag = false, originDrag = false;
const PH = { free: false, v: 0, hist: [] };

function recModel(m) {
  if (!m || m.type !== 'rec') return null;
  if (!m._RM || m._rm !== S.smooth || m._rv !== m.ver) { m._RM = tagModel(buildRecModel(m.data.s, S.smooth)); m._rm = S.smooth; m._rv = m.ver; }
  return m._RM;
}
function targetModel(id) {
  const tg = TARGETS.find(t => t.id === id) || TARGETS[0];
  const C2 = compileSections(tg.secs, T);
  return { tg, M: C2.ok ? buildEqModel(C2, Object.create(null), { blendW: 0.4 }) : null };
}
function setTarget(id) {
  if (id === 'custom' && !CH.custom) id = TARGETS[0].id;
  S.chal.id = id;
  if (id === 'custom') { CH.TM = CH.custom.M; CH.tq = CH.custom.q; }
  else { const r = targetModel(id); CH.TM = r.M; CH.tq = r.tg.q; }
  CH.attempt = null; CH.attemptS = null; CH.score = null; S.t = 0;
  renderTargets(); dirty = true; save();
}
/* the motion shown, in world and in view coordinates */
function models() {
  let Mw = null, Mv = null;
  const am = activeMotion();
  if (REC.on) Mw = REC.live;
  else if (S.src === 'eq') { if (ffActive()) Mw = MFF; else { Mv = MEQ; Mw = worldOf(MEQ); } }
  else if (S.src === 'draw') Mw = am && am.type === 'rec' ? recModel(am) : MDR;
  else if (S.src === 'drag') Mw = recModel(am);
  else Mw = CH.attempt;
  if (!Mv) Mv = viewOf(Mw);
  const others = [];
  if (S.src !== 'chal' && f('two')) for (const m of S.motions) if (m.vis && m !== am) {
    const w = motionWorld(m);
    if (w) others.push({ m, L: letterOf(m), Mw: w, Mv: tagModel(viewOf(w)), hid: m.hid || {} });
  }
  return { Mw: tagModel(Mw), Mv: tagModel(Mv), others, L: am ? letterOf(am) : '', am };
}
/* times when the active motion meets each of the others */
let meetKey = '', MEET = [];
function meetings(A, others, LA) {
  const key = (A && A.uid) + '|' + others.map(o => o.Mv.uid).join(',');
  if (key === meetKey) return MEET;
  meetKey = key; MEET = [];
  if (A) for (const o of others) {
    const B = o.Mv, Tm = Math.min(A.T, B.T), r = crossings(t => A.S(t) - B.S(t), 0, Tm, 0, [...A.splits, ...B.splits]);
    const list = r === 'all' ? [] : r.map(t => ({ t, s: A.S(t), L: LA + '–' + o.L }));
    if (Math.abs(A.S(0) - B.S(0)) < 1e-6 && !list.some(x => x.t < 1e-6)) list.unshift({ t: 0, s: A.S(0), L: LA + '–' + o.L });
    MEET.push(...list);
  }
  MEET.sort((x, y) => x.t - y.t);
  renderMeet(); return MEET;
}
const model = () => models().Mv;
function clampInterval(Tm) {
  const a = S.an;
  if (a.t2 > Tm) a.t2 = r3(Tm);
  if (a.t1 > a.t2 - 0.05) a.t1 = r3(Math.max(0, a.t2 - Math.max(0.05, Tm * 0.3)));
  if (a.t1 < 0) a.t1 = 0;
}

/* ================================================================ analysis cache */
let statsKey = '', ST = null, RS = { v: null, a: null };
const predicting = () => S.pred.on && f('pred') && !S.pred.revealed;
function effAn() {
  const a = S.an, off = predicting();
  const e = {
    tan: !off && a.tan && f('tan'), sec: !off && a.sec && f('sec'), areaV: !off && a.areaV && f('areaV') && f('gV'), areaA: !off && a.areaA && f('areaA') && f('gA'),
    avg: !off && a.avg && f('avg') && f('gV'), method: f('riemann') ? a.method : 'true', n: a.n, t1: a.t1, t2: a.t2
  };
  e.iv = e.sec || e.areaV || e.areaA || e.avg;
  return e;
}
function updateStats(M, an) {
  const key = [M && M.uid, an.t1, an.t2, an.method, an.n, an.iv, LANG, S.Q].join('|');
  if (key === statsKey) return;
  statsKey = key; ST = null; RS = { v: null, a: null };
  if (!M || !an.iv) { renderStats(); return; }
  const t1 = clamp(an.t1, 0, M.T), t2 = clamp(an.t2, t1, M.T);
  if (!(t2 > t1)) { renderStats(); return; }
  ST = intervalStats(M, t1, t2);
  ST.t1 = t1; ST.t2 = t2;
  ST.cv = crossings(M.V, t1, t2, ST.vmean, M.splits);
  ST.ca = crossings(M.A, t1, t2, ST.amean, M.splits);
  if (an.method !== 'true') { RS.v = riemann(M.V, t1, t2, an.n, an.method); RS.a = riemann(M.A, t1, t2, an.n, an.method); }
  renderStats();
}
let uidN = 1;
function tagModel(M) { if (M && !M.uid) M.uid = uidN++; return M; }

/* ================================================================ small UI builders */
function seg(host, opts, val, cb, cls) {
  host.innerHTML = '';
  if (cls) host.classList.add(...cls.split(' '));
  const bs = opts.map(o => {
    const b = h('button', { type: 'button', 'data-v': String(o.v), title: o.title || null, 'aria-label': o.title || null });
    if (o.icon) b.append(msIcon(o.icon));
    if (o.svg) b.append(svgIcon(o.svg));
    if (o.text != null) b.append(h('span', { class: o.cls || 't', text: o.text }));
    if (o.feat) b.dataset.f = o.feat;
    b.addEventListener('click', () => { G.set(o.v); cb(o.v); });
    host.append(b); return b;
  });
  const G = { set(v) { G.val = v; bs.forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); } };
  G.set(val); return G;
}
function toggle(host, o) {
  const tg = h('button', { class: 'tg', type: 'button', 'aria-pressed': String(!!o.get()) });
  if (o.svg) tg.append(h('span', { html: ICON[o.svg], style: 'display:grid;color:' + (o.col || 'var(--ink)') }));
  else if (o.icon) tg.append(h('span', { class: 'ms', text: o.icon, style: 'color:' + (o.col || 'var(--ink)') }));
  const tx = h('span', { class: 'txt' }, h('span', { text: T(o.key) }));
  if (o.sub) tx.append(h('small', { text: T(o.sub) }));
  tg.append(tx, h('span', { class: 'box' }));
  tg.addEventListener('click', () => { o.set(!o.get()); tg.setAttribute('aria-pressed', String(!!o.get())); });
  tg.sync = () => tg.setAttribute('aria-pressed', String(!!o.get()));
  if (o.feat) tg.dataset.f = o.feat;
  host.append(tg); return tg;
}
function numCtl(host, o) { // labelled number input with unit
  const inp = h('input', { class: 'numin', inputmode: 'decimal', id: o.id, value: fmtIn(o.get()) });
  inp.addEventListener('change', () => { const v = pnum(inp.value); if (isNum(v)) o.set(v); inp.value = fmtIn(o.get()); });
  const row = h('label', { class: 'nrow', for: o.id }, h('span', { class: 'nl', text: o.label }), inp, h('span', { class: 'unit', text: o.unit || '' }));
  host.append(row); inp.sync = () => { if (document.activeElement !== inp) inp.value = fmtIn(o.get()); };
  return inp;
}
function slider(host, o) {
  const lab = h('label', { for: o.id }, h('span', { text: o.label }), h('b'));
  const inp = h('input', { type: 'range', id: o.id, min: o.min, max: o.max, step: o.step, value: o.get() });
  const box = h('div', { class: 'ctl' }, lab, inp);
  const out = lab.querySelector('b'), sync = () => { inp.value = o.get(); out.textContent = o.fmt(o.get()); };
  inp.addEventListener('input', () => { o.set(+inp.value); out.textContent = o.fmt(o.get()); });
  host.append(box); sync(); box.sync = sync; return box;
}
const toastEl = $('#toast'); let toastT = 0;
function toast(msg, ms = 2600) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms); }

/* ================================================================ sections panel */
const secList = $('#secList');
const QN = () => S.Q;
const kindLabel = k => ({ s: QN() + '(t)', v: 'v(t)', a: 'a(t)', u: T('k_u_short') }[k]);
function kindOptions(cur) {
  return ['s', 'v', 'a', 'u'].filter(k => f({ s: 'kS', v: 'kV', a: 'kA', u: 'kU' }[k]) || k === cur)
    .map(k => ({ v: k, text: kindLabel(k), title: T('k_' + k) }));
}
function eqRow(i, field, lab, value, o = {}) {
  const row = h('div', { class: 'eq' });
  row.append(h('label', { for: `sec-${i}-${field}`, text: lab }));
  if (o.inh) row.append(h('button', { class: 'mini' + (o.inh.on ? ' on' : ''), type: 'button', title: T('inherit_t'), 'aria-label': T('inherit_t'), 'aria-pressed': String(o.inh.on), html: ICON.inherit, 'data-inh': field, 'data-i': i }));
  const inp = h('input', { id: `sec-${i}-${field}`, 'data-i': i, 'data-field': field, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', class: o.short ? 'short' : null, inputmode: o.short ? 'decimal' : null });
  inp.value = value;
  if (o.inh && o.inh.on) inp.disabled = true;
  row.append(inp);
  if (o.unit) row.append(h('span', { class: 'unit', text: o.unit }));
  return row;
}
function renderSections() {
  secList.innerHTML = '';
  S.secs.forEach((s, i) => {
    if (i > 0) {
      const j = h('div', { class: 'joint', 'data-j': i });
      j.append(h('span', { class: 'st' }, h('span', { class: 'ji', style: 'display:grid' }), h('span', { class: 'jt' })), h('small', { class: 'jd' }), h('span', { class: 'sp' }));
      const b = h('button', { class: 'mini' + (s.blend ? ' on' : ''), type: 'button', 'data-blend': i, title: T('blend_t'), 'aria-label': T('blend_t'), html: ICON.blend });
      if (!f('joints')) b.hidden = true;
      j.append(b);
      secList.append(j);
    }
    const card = h('div', { class: 'sec', 'data-sec': i });
    const head = h('div', { class: 'sh' }, h('span', { class: 'badge', text: String(i + 1) }));
    const ks = h('div', { class: 'seg small' });
    seg(ks, kindOptions(s.kind), s.kind, k => changeKind(i, k));
    head.append(ks, h('span', { class: 'grow' }));
    if (S.secs.length > 1) head.append(h('button', { class: 'mini', type: 'button', title: T('del_sec'), 'aria-label': T('del_sec'), onclick: () => delSection(i) }, msIcon('delete')));
    card.append(head);
    if (s.kind !== 'u') card.append(eqRow(i, 'f', (s.kind === 's' ? QN() : s.kind) + '(t) =', s.f));
    if (s.kind !== 's') card.append(eqRow(i, 's0', pretty(QN() + '0') + ' =', s.s0.e, { inh: i > 0 ? { on: s.s0.inh } : null, unit: 'm' }));
    if (s.kind === 'a' || s.kind === 'u') card.append(eqRow(i, 'v0', 'v₀ =', s.v0.e, { inh: i > 0 ? { on: s.v0.inh } : null, unit: 'm/s' }));
    if (s.kind === 'u' && (f('uA') || String(s.a).trim() !== '0')) card.append(eqRow(i, 'a', 'a =', s.a, { unit: 'm/s²' }));
    const ivr = eqRow(i, 'end', 't:', s.end, { short: true, unit: 's' });
    ivr.insertBefore(h('span', { class: 'from', 'data-from': i }), ivr.querySelector('input'));
    card.append(ivr);
    card.append(h('div', { class: 'prev', 'data-prev': i }), h('div', { class: 'err', 'data-err': i }));
    secList.append(card);
  });
  showSecErrors(); refreshSections(); applyFeatures();
}
function changeKind(i, k) {
  const s = S.secs[i]; if (s.kind === k) return;
  s.kind = k;
  s.f = k === 's' ? (i === 0 ? '2t' : fmtIn(MEQ ? MEQ.S(MEQ.t0[i] ?? 0) : 0) || '0') : k === 'v' ? '1' : k === 'a' ? '0' : '';
  if (k === 'u' && !f('uA')) s.a = '0';
  renderSections(); recompile();
}
function delSection(i) {
  if (S.secs.length < 2) return;
  if (i === 0 && MEQ) {
    const n = S.secs[1];
    if (n.s0.inh) { n.s0.inh = false; n.s0.e = fmtIn(MEQ.joints[0].L[0]); }
    if (n.v0.inh) { n.v0.inh = false; n.v0.e = fmtIn(MEQ.joints[0].L[1]); }
  }
  S.secs.splice(i, 1); renderSections(); recompile();
}
function addSection() {
  const last = S.secs[S.secs.length - 1], endV = MEQ ? MEQ.T : 4;
  const kind = f('kU') ? 'u' : last.kind;
  S.secs.push({ kind, f: kind === 's' ? fmtIn(MEQ ? MEQ.S(MEQ.T) : 0) : kind === 'v' ? '0' : kind === 'a' ? '0' : '', end: String(r3(endV + 2)), s0: { inh: true, e: '0' }, v0: { inh: true, e: '0' }, a: '0', blend: false });
  renderSections(); recompile();
  secList.lastElementChild?.scrollIntoView({ block: 'nearest' });
}
secList.addEventListener('input', e => {
  const inp = e.target; if (!inp.dataset.field) return;
  const s = S.secs[+inp.dataset.i], fd = inp.dataset.field;
  if (fd === 'f') s.f = inp.value; else if (fd === 'end') s.end = inp.value; else if (fd === 's0') s.s0.e = inp.value; else if (fd === 'v0') s.v0.e = inp.value; else if (fd === 'a') s.a = inp.value;
  S.preset = 'custom'; recompile();
});
secList.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.inh) {
    const s = S.secs[+b.dataset.i], o = b.dataset.inh === 's0' ? s.s0 : s.v0;
    if (o.inh) { const J = MEQ && MEQ.joints[+b.dataset.i - 1]; if (J) o.e = fmtIn(b.dataset.inh === 's0' ? J.L[0] : J.L[1]); }
    o.inh = !o.inh; renderSections(); recompile();
  } else if (b.dataset.blend) {
    const s = S.secs[+b.dataset.blend]; s.blend = !s.blend; b.classList.toggle('on', s.blend); rebuild();
  }
});
function showSecErrors() {
  $$('input.bad', secList).forEach(x => x.classList.remove('bad'));
  $$('[data-err]', secList).forEach(x => { x.textContent = ''; });
  for (const e of [...(CMP ? CMP.errs : []), ...errsEq]) {
    const inp = $(`#sec-${e.i}-${e.field}`); if (inp) inp.classList.add('bad');
    const box = $(`[data-err="${e.i}"]`, secList); if (box && !box.textContent) box.textContent = e.msg;
  }
}
const jointText = (J, Q) => (J.status === 'jump' ? 'Δ' + Q + ' = ' + fx(J.dS) + ' m' : J.status === 'kink' || J.status === 'coll' ? 'Δv = ' + fx(J.dV) + ' m/s' : J.status === 'acorner' ? 'Δa = ' + fx(J.dA) + ' m/s²' : '');
function tauText(t0) { return S.useTau ? 'τ' : t0 === 0 ? 't' : '(t − ' + fx(t0) + ')'; }
function signed(v) { return (v < 0 ? ' − ' : ' + ') + fx(Math.abs(v)); }
function refreshSections() {
  const M = MEQ; if (!M) return;
  S.secs.forEach((s, i) => {
    const from = $(`[data-from="${i}"]`, secList); if (from) from.textContent = fx(M.t0[i] ?? 0) + ' →';
    const J = M.joints[i - 1];
    if (J) {
      const si = $(`#sec-${i}-s0`); if (si && s.s0.inh) si.value = fmtIn(J.L[0]);
      const vi = $(`#sec-${i}-v0`); if (vi && s.v0.inh) vi.value = fmtIn(J.L[1]);
      const el = $(`[data-j="${i}"]`, secList);
      if (el) { el.className = 'joint ' + J.status; $('.ji', el).innerHTML = ICON['j_' + J.status] || ICON.j_kink; $('.jt', el).textContent = T('js_' + J.status); $('.jd', el).textContent = jointText(J, QN()); }
    }
    const pv = $(`[data-prev="${i}"]`, secList);
    if (pv) {
      if (s.kind === 'u' && M.t0[i] !== undefined) {
        const t0 = M.t0[i], r = M.joints[i - 1] ? M.joints[i - 1].R : M.at(t0), tt = tauText(t0);
        const [s0, v0, a] = r;
        pv.textContent = QN() + '(t) = ' + fx(s0) + signed(v0) + '·' + tt + (a !== 0 ? signed(a / 2) + '·' + tt + '²' : '') + '   v(t) = ' + fx(v0) + (a !== 0 ? signed(a) + '·' + tt : '');
      } else if (S.useTau && i > 0) pv.textContent = T('tau_hint', fx(M.t0[i]));
      else pv.textContent = '';
    }
  });
}

/* ---------------- parameters */
function renderParams() {
  const host = $('#params'); host.innerHTML = '';
  const names = allVars().sort();
  $('#paramBox').hidden = !names.length || !f('params') || ffActive();
  for (const n of names) {
    const p = S.params[n]; if (!p) continue;
    const box = h('div', { class: 'prm' });
    const val = h('input', { class: 'pv', value: fmtIn(p.v), inputmode: 'decimal', 'aria-label': n });
    const rg = h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: p.v, 'aria-label': n });
    const mn = h('input', { value: fmtIn(p.min), inputmode: 'decimal', 'aria-label': T('min') }), mx = h('input', { value: fmtIn(p.max), inputmode: 'decimal', 'aria-label': T('max') });
    const rng = h('div', { class: 'rng', hidden: true }, h('span', { text: T('min') }), mn, h('span', { text: T('max') }), mx);
    const more = h('button', { class: 'mini', type: 'button', title: T('range_t'), 'aria-label': T('range_t') }, msIcon('tune'));
    more.onclick = () => { rng.hidden = !rng.hidden; more.classList.toggle('on', !rng.hidden); };
    box.append(h('div', { class: 'ph' }, h('span', { class: 'pn', text: pretty(n) }), val, h('span', { class: 'grow' }), more), rg, rng);
    rg.addEventListener('input', () => { p.v = +rg.value; val.value = fmtIn(p.v); S.preset = 'custom'; rebuild(); });
    val.addEventListener('change', () => { const v = pnum(val.value); if (isNum(v)) { p.v = v; if (v < p.min) p.min = v; if (v > p.max) p.max = v; rg.min = p.min; rg.max = p.max; rg.value = v; rebuild(); } val.value = fmtIn(p.v); });
    const setR = () => { const a = pnum(mn.value), b = pnum(mx.value); if (isNum(a) && isNum(b) && b > a) { p.min = a; p.max = b; p.step = (b - a) >= 100 ? 0.5 : 0.01; rg.min = a; rg.max = b; rg.step = p.step; p.v = clamp(p.v, a, b); rg.value = p.v; val.value = fmtIn(p.v); rebuild(); } };
    mn.addEventListener('change', setR); mx.addEventListener('change', setR);
    host.append(box);
  }
}

/* ---------------- free fall panel */
const ffUI = {};
function buildFF() {
  const host = $('#ffBox'); host.innerHTML = '';
  ffUI.tg = toggle(host, { key: 'ff', sub: 'ff_s', icon: 'south', get: () => S.ff.on, set: v => { S.ff.on = v; rebuildFF(); syncSrcPanels(); onModelChange(); save(); } });
  const form = h('div', { id: 'ffForm' }); host.append(form);
  const ffSet = (k, v) => { S.ff[k] = v; S.preset = 'custom'; rebuildFF(); onModelChange(); save(); };
  ffUI.y0 = numCtl(form, { id: 'ffY0', label: '', unit: 'm', get: () => toV(S.ff.w0), set: v => ffSet('w0', toW(v)) });
  ffUI.v0 = numCtl(form, { id: 'ffV0', label: 'v₀ =', unit: 'm/s', get: () => toV(S.ff.v0, 'v'), set: v => ffSet('v0', toW(v, 'v')) });
  ffUI.g = slider(form, { id: 'ffG', label: 'g', min: 0.5, max: 25, step: 0.01, get: () => S.ff.g, set: v => ffSet('g', v), fmt: v => num(v, 3) + ' m/s²' });
  const planets = h('div', { class: 'row', style: 'margin:-4px 0 6px' });
  for (const [k, g] of [['earth', 9.81], ['moon', 1.62], ['mars', 3.71], ['jupiter', 24.79]])
    planets.append(h('button', { class: 'chip', type: 'button', text: T('pl_' + k), onclick: () => { ffSet('g', g); ffUI.g.sync(); renderFF(); } }));
  form.append(planets);
  ffUI.a = h('p', { class: 'note' }); form.append(ffUI.a);
  ffUI.floor = toggle(form, { key: 'floor', sub: 'floor_s', icon: 'horizontal_rule', get: () => S.ff.floor, set: v => ffSet('floor', v) });
  ffUI.e = slider(form, { id: 'ffE', label: T('rest_e'), min: 0, max: 1, step: 0.01, get: () => S.ff.e, set: v => ffSet('e', v), fmt: v => num(v, 2) + (v === 0 ? ' · ' + T('stops') : '') });
  ffUI.T = numCtl(form, { id: 'ffT', label: T('duration'), unit: 's', get: () => S.ff.T, set: v => ffSet('T', clamp(v, 0.5, 60)) });
  renderFF();
}
function renderFF() {
  if (!ffUI.y0) return;
  ffUI.y0.closest('label').querySelector('.nl').textContent = pretty(S.Q + '0') + ' =';
  ffUI.y0.sync(); ffUI.v0.sync(); ffUI.T.sync(); ffUI.g.sync(); ffUI.e.sync(); ffUI.tg.sync(); ffUI.floor.sync();
  ffUI.e.hidden = !S.ff.floor;
  const ga = toV(-S.ff.g, 'a');
  ffUI.a.innerHTML = T('ff_a', (ga < 0 ? '−g' : '+g'), fx(ga), S.frame.dir > 0 ? T('axis_up') : T('axis_down'));
  $('#ffForm').hidden = !S.ff.on;
}
function syncSrcPanels() {
  const ffOn = ffActive();
  if ($('#dragFF')) { $('#dragFF').hidden = !(S.frame.vert && f('ff')); $('#throwNote').hidden = S.frame.vert || !f('ff'); dragFFtg && dragFFtg.sync(); }
  $('#ffBox').hidden = !(S.frame.vert && f('ff'));
  $('#paramBox').hidden = ffOn || !allVars().length || !f('params');
  $('#eqSecs').hidden = ffOn;
  const er = editingRec();
  $('#drawTools').hidden = !!er; $('#recTools').hidden = !er;
  $('#drClear').hidden = !!er;
}

/* ---------------- drawing panel */
const drUI = {};
let undo = [];
function buildDraw() {
  drUI.q = seg($('#drQ'), [{ v: 's', text: S.Q + '-t', feat: null }, { v: 'v', text: 'v-t', feat: 'gV' }, { v: 'a', text: 'a-t', feat: 'gA' }], S.draw.q, q => { S.draw.q = q; undo = []; rebuildDraw(); renderDraw(); renderMotions(); onModelChange(); save(); });
  drUI.tool = seg($('#drTool'), [{ v: 'pen', icon: 'gesture', title: T('tool_pen'), text: T('tool_pen_s') }, { v: 'line', svg: 'line', title: T('tool_line'), text: T('tool_line_s') }, { v: 'para', svg: 'para', title: T('tool_para'), text: T('tool_para_s') }, { v: 'move', icon: 'open_with', title: T('tool_move'), text: T('tool_move_s') }], S.draw.tool, v => { S.draw.tool = v; renderDraw(); dirty = true; save(); });
  const sn = $('#drSnap'); sn.innerHTML = '';
  drUI.snap = toggle(sn, { key: 'snap', sub: 'snap_s', svg: 'inherit', get: () => S.draw.snap, set: v => { S.draw.snap = v; save(); } });
  const ic = $('#drIC'); ic.innerHTML = '';
  drUI.s0 = numCtl(ic, { id: 'drS0', label: '', unit: 'm', get: () => toV(S.draw.s0), set: v => { S.draw.s0 = toW(v); rebuildDraw(); onModelChange(); save(); } });
  drUI.v0 = numCtl(ic, { id: 'drV0', label: 'v₀ =', unit: 'm/s', get: () => toV(S.draw.v0, 'v'), set: v => { S.draw.v0 = toW(v, 'v'); rebuildDraw(); onModelChange(); save(); } });
  drUI.T = numCtl(ic, { id: 'drT', label: T('t_max'), unit: 's', get: () => S.draw.Tmax, set: v => { S.draw.Tmax = clamp(v, 1, 60); dirty = true; save(); } });
  const dr = $('#drRad'); dr.innerHTML = '';
  drUI.rad = slider(dr, { id: 'drR', label: T('rt_radius'), min: 0, max: 30, step: 1, get: () => S.draw.radius, set: v => { S.draw.radius = v; recUI.rad && recUI.rad.sync(); save(); }, fmt: v => (v === 0 ? T('rt_single') : '± ' + v + ' ' + T('samples')) });
  renderDraw();
}
function renderDraw() {
  if (!drUI.q) return;
  drUI.q.set(S.draw.q);
  $$('#drQ button')[0].querySelector('span').textContent = S.Q + '-t';
  drUI.tool.set(S.draw.tool); drUI.snap.sync();
  $('#drRad').hidden = S.draw.tool !== 'move'; $('#drMoveNote').hidden = S.draw.tool !== 'move'; drUI.rad.sync();
  drUI.s0.closest('label').querySelector('.nl').textContent = pretty(S.Q + '0') + ' =';
  drUI.s0.closest('label').hidden = S.draw.q === 's'; drUI.v0.closest('label').hidden = S.draw.q !== 'a';
  drUI.s0.sync(); drUI.v0.sync(); drUI.T.sync();
  refreshDrawJoints();
}
function refreshDrawJoints() {
  const host = $('#drJoints'); if (!host) return;
  host.innerHTML = '';
  const segs = S.draw.segs[S.draw.q];
  $('#drEmpty').hidden = segs.length > 0;
  if (!MDR) return;
  const Mv = viewOf(MDR);
  Mv.joints.forEach((J, k) => {
    const b = h('button', { class: 'mini' + (segs[k + 1] && segs[k + 1].blend ? ' on' : ''), type: 'button', title: T('blend_t'), 'aria-label': T('blend_t'), html: ICON.blend, 'data-f': 'joints' });
    b.onclick = () => { segs[k + 1].blend = !segs[k + 1].blend; rebuildDraw(); onModelChange(); save(); };
    host.append(h('div', { class: 'joint ' + J.status }, h('span', { class: 'st' }, h('span', { html: ICON['j_' + J.status] || ICON.j_kink, style: 'display:grid' }), h('span', { text: 't = ' + fx(J.t) + ' s · ' + T('js_' + J.status) })), h('small', { text: jointText(J, S.Q) }), h('span', { class: 'sp' }), f('joints') ? b : null));
  });
}
function pushUndo() { if (editingRec()) return; undo.push(clone(S.draw.segs[S.draw.q])); if (undo.length > 40) undo.shift(); }
$('#drUndo').onclick = () => {
  if (!undo.length) return;
  const er = editingRec();
  if (er) { const u = undo.pop(); if (u instanceof Float64Array) { er.data.s = u; touchRec(er); } }
  else S.draw.segs[S.draw.q] = undo.pop();
  rebuildDraw(); onModelChange(); renderMotions(); save();
};
$('#drClear').onclick = () => { if (editingRec()) return; pushUndo(); S.draw.segs[S.draw.q] = []; rebuildDraw(); onModelChange(); save(); };
$('#drGal').onclick = () => openGallery('plots');

/* ---------------- gallery (equations and plots) */
const galDlg = $('#galDlg');
let galModels = null;
function presetModel(p) {
  if (p.ff) return freeFallModel({ ...DEF_FF, ...p.ff, on: true });
  const Cc = compileSections(p.secs, T); if (!Cc.ok) return null;
  const env = Object.create(null); for (const n in p.p) env[n] = p.p[n][0];
  for (const n of Cc.vars) if (!(n in env)) env[n] = 1;
  const M = buildEqModel(Cc, env, { blendW: 0.4 }); return M.ok ? M : null;
}
const gqs = () => ['s', ...(f('gV') ? ['v'] : []), ...(f('gA') ? ['a'] : [])];
function openGallery(kind = 'eq') {
  const host = $('#galCards'); host.innerHTML = '';
  $('#galTitle').textContent = T(kind === 'eq' ? 'gallery' : 'plot_gallery');
  $('#galNote').textContent = T(kind === 'eq' ? 'gal_note' : 'plot_gal_note');
  const cards = [];
  if (kind === 'eq') {
    if (!galModels) galModels = new Map(PRESETS.map(p => [p.id, presetModel(p)]));
    for (const p of PRESETS) {
      const nd = p.ff ? new Set(['ff', 'kU']) : needs(p.secs); if ([...nd].some(k => !f(k))) continue;
      cards.push({ on: S.preset === p.id, name: T('g_' + p.id), desc: T('gd_' + p.id), M: galModels.get(p.id), qs: gqs(), hi: null, go: () => loadPreset(p) });
    }
  } else {
    for (const p of PLOTS) {
      if ((p.q === 'v' && !f('gV')) || (p.q === 'a' && !f('gA'))) continue;
      cards.push({ on: false, name: T(p.id), desc: T('plot_on', p.q === 's' ? S.Q : p.q), M: drawModel(p.segs, p.q, p.s0 ?? 0, p.v0 ?? 0), qs: gqs(), hi: p.q, go: () => loadPlot(p) });
    }
  }
  for (const cd of cards) {
    const cv = h('canvas');
    const card = h('button', { class: 'gcard' + (cd.on ? ' on' : ''), type: 'button' }, cv, h('b', { text: cd.name }), h('small', { text: cd.desc }));
    card.onclick = () => { cd.go(); galDlg.close(); };
    card._draw = () => drawMini(cv, cd.M, cd.qs, cd.hi, S.Q);
    host.append(card);
  }
  galDlg.showModal();
  requestAnimationFrame(() => $$('.gcard', host).forEach(c => c._draw && c._draw()));
}
function loadPreset(p) {
  S.preset = p.id;
  if (p.ff) {
    S.ff = { ...DEF_FF, ...p.ff, on: true };
    if (!S.frame.vert) setVert(true);
    rebuildFF(); renderFF(); setSrc('eq'); syncSrcPanels();
  } else {
    S.ff.on = false;
    S.secs = clone(p.secs);
    for (const n in p.p) { const [v, min, max, step] = p.p[n]; S.params[n] = { v, min, max, step: step || 0.01 }; }
    setSrc('eq'); renderSections(); recompile(); renderFF(); syncSrcPanels();
  }
  renderMotions();
  const M = model();
  if (M) { S.an.t1 = r3(M.T * 0.2); S.an.t2 = r3(M.T * 0.65); }
  S.t = 0; S.playing = false; statsKey = ''; syncAnalysis(); dirty = true; save();
}
function loadPlot(p) {
  if (editingRec()) { addMotion('draw'); undo = []; }
  S.draw.q = p.q; pushUndo();
  S.draw.segs[p.q] = clone(p.segs); S.draw.tool = 'move'; S.draw.s0 = p.s0 ?? 0; S.draw.v0 = p.v0 ?? 0; S.draw.Tmax = Math.max(S.draw.Tmax, 6);
  setSrc('draw'); rebuildDraw(); renderDraw(); onModelChange(); save();
}

/* ---------------- recordings and targets */
function renderTargets() {
  const host = $('#targets'); host.innerHTML = '';
  if (CH.custom) {
    const cv = h('canvas'), card = h('button', { class: 'gcard' + (S.chal.id === 'custom' ? ' on' : ''), type: 'button' }, cv, h('b', { text: T('c_custom', CH.custom.L) }), h('small', { text: T('match_s', S.Q) }));
    card.onclick = () => setTarget('custom'); host.append(card);
    const M = viewOf(CH.custom.M); requestAnimationFrame(() => drawMini(cv, M, ['s'], 's', S.Q));
  }
  for (const tg of TARGETS) {
    if (tg.q === 'v' && !f('gV')) continue;
    const cv = h('canvas'), best = S.chal.best[tg.id];
    const card = h('button', { class: 'gcard' + (S.chal.id === tg.id ? ' on' : ''), type: 'button' }, cv,
      h('b', { text: T('c_' + tg.id) }), h('small', { text: T(tg.q === 's' ? 'match_s' : 'match_v', S.Q) }),
      best != null ? h('span', { class: 'score', text: T('best', best) }) : null);
    card.onclick = () => setTarget(tg.id);
    host.append(card);
    const M = viewOf(targetModel(tg.id).M);
    requestAnimationFrame(() => drawMini(cv, M, [tg.q], tg.q, S.Q));
  }
  const sb = $('#scoreBox');
  sb.hidden = CH.score == null;
  if (CH.score != null) { $('#scoreVal').textContent = CH.score + '%'; $('#scoreTxt').textContent = T(CH.score >= 85 ? 'sc_great' : CH.score >= 60 ? 'sc_good' : 'sc_try'); }
  $('#keepAttempt').hidden = !CH.attemptS;
}
function scoreAttempt() {
  const M = CH.attempt, TM = CH.TM; if (!M || !TM) return;
  const q = CH.tq, N = 200; let e2 = 0;
  for (let k = 0; k <= N; k++) { const t = TM.T * k / N, d = (q === 's' ? M.S(t) - TM.S(t) : M.V(t) - TM.V(t)); e2 += d * d; }
  const err = Math.sqrt(e2 / (N + 1)), kk = q === 's' ? 0.8 : 0.6;
  CH.score = Math.round(100 * Math.exp(-((err / kk) ** 2)));
  const id = S.chal.id; S.chal.best[id] = Math.max(S.chal.best[id] ?? 0, CH.score);
  renderTargets(); toast(T('score_toast', CH.score)); save();
}

/* ================================================================ recording and throwing */
const recBtn = $('#recBtn');
function startRec() {
  if (REC.on) return;
  REC.on = true; REC.raw = [[0, ball]]; REC.t0 = performance.now(); REC.lastT = 0; REC.live = null; REC.thrown = false; REC.restSince = 0; S.playing = false;
  REC.grabbed = trkDrag || PH.free; // otherwise the clock restarts when the cart is grabbed, so the jump to the finger is not recorded
  recBtn.classList.add('recording'); $('#recIcon').textContent = 'stop';
  if (S.src === 'chal') { CH.attempt = null; CH.attemptS = null; }
}
function stopRec(cancel) {
  if (!REC.on) return;
  REC.on = false; recBtn.classList.remove('recording'); $('#recIcon').textContent = 'fiber_manual_record';
  const s = resample(REC.raw);
  if (cancel || !s || s.length < 12) { REC.live = null; dirty = true; return; }
  if (S.src === 'drag') { addMotion('rec', { s }); renderMotions(); save(); } else if (S.src === 'chal') { CH.attemptS = s; CH.attempt = buildRecModel(s, S.smooth); scoreAttempt(); }
  REC.live = null; S.t = 0; ballFree = false; onModelChange();
}
function recTick() {
  // performance.now(), not the frame timestamp: on iOS the frame time can precede the start of the recording
  const t = Math.max(REC.lastT, (performance.now() - REC.t0) / 1000);
  REC.lastT = t;
  REC.raw.push([t, ball]);
  const lim = S.src === 'chal' && CH.TM ? CH.TM.T : 30;
  const s = resample(REC.raw);
  if (s && s.length >= 3) { REC.live = buildRecModel(s, S.smooth); S.t = REC.live.T; }
  if (t >= lim) stopRec(false);
  else if (S.src === 'drag' && REC.thrown && !PH.free && !trkDrag) {
    if (!REC.restSince) REC.restSince = t; else if (t - REC.restSince > 0.6) stopRec(false);
  }
}
const throwable = () => S.frame.vert && S.thr.on && f('ff') && (S.src === 'drag' || S.src === 'chal');
function physTick(dt) {
  if (!PH.free) return;
  const g = S.thr.g;
  PH.v -= g * dt; ball += PH.v * dt;
  if (S.thr.floor && ball <= 0) {
    ball = 0; PH.v = -S.thr.e * PH.v;
    if (PH.v < 0.35) { PH.v = 0; PH.free = false; }
  }
  if (ball < -20 || ball > 60) { PH.free = false; PH.v = 0; ball = clamp(ball, -20, 60); }
  dirty = true;
}
recBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (S.src === 'chal') {
    if (REC.on || CH.count) { CH.count = 0; $('#count').hidden = true; stopRec(true); return; }
    CH.count = 3; CH.countEnd = performance.now() + 3000; return;
  }
  if (REC.on) { stopRec(false); REC.hold = false; return; }
  startRec(); REC.hold = true; REC.startedAt = performance.now();
});
recBtn.addEventListener('pointerup', () => { if (REC.hold && REC.on && performance.now() - REC.startedAt > 450) stopRec(false); REC.hold = false; });
recBtn.addEventListener('contextmenu', e => e.preventDefault());

/* ================================================================ canvases and interaction */
const trk = $('#trk');
const plots = { s: new Plot($('#gS')), v: new Plot($('#gV')), a: new Plot($('#gA')) };
const VS = { trackInv: null, originPx: null };
const canDrag = () => S.src === 'drag' || S.src === 'chal';
function trkXY(e) { const r = trk.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function ballFromEvent(e) {
  if (!VS.trackInv) return;
  const [x, y] = trkXY(e);
  ball = r3(clamp(VS.trackInv(x, y), throwable() && S.thr.floor ? 0 : -2, 12));
  PH.hist.push([performance.now() / 1000, ball]); if (PH.hist.length > 30) PH.hist.shift();
  if (REC.on && !REC.grabbed && S.src === 'drag') { REC.grabbed = true; REC.raw = [[0, ball]]; REC.t0 = performance.now(); REC.lastT = 0; }
  dirty = true;
}
trk.addEventListener('pointerdown', e => {
  if (PK.armed) { e.preventDefault(); arm(false); firePick({ type: 't' }, e); return; }
  const [x, y] = trkXY(e);
  if (VS.originPx && Math.hypot(x - VS.originPx[0], y - VS.originPx[1]) < 16 && f('frame') && !REC.on) {
    originDrag = true; trk.setPointerCapture(e.pointerId); return;
  }
  if (!canDrag()) { if (e.button === 0) lpStart({ type: 't' }, e); return; }
  trkDrag = true; ballFree = true; S.playing = false; PH.free = false; PH.hist = [];
  trk.setPointerCapture(e.pointerId); ballFromEvent(e);
});
trk.addEventListener('pointermove', e => {
  lpMove(e);
  if (originDrag) { const [x, y] = trkXY(e); setFrame(Math.round(VS.trackInv(x, y) * 10) / 10, S.frame.dir); return; }
  if (trkDrag) ballFromEvent(e);
});
const endTrk = () => {
  if (trkDrag && throwable()) {
    const now = performance.now() / 1000, hs = PH.hist.filter(p => now - p[0] < 0.12);
    const v = hs.length > 1 ? (hs[hs.length - 1][1] - hs[0][1]) / Math.max(0.02, hs[hs.length - 1][0] - hs[0][0]) : 0;
    PH.free = true; PH.v = clamp(v, -40, 40);
    if (REC.on) REC.thrown = true;
  }
  trkDrag = false; originDrag = false; dirty = true;
};
trk.addEventListener('pointerup', () => { lpEnd(); endTrk(); }); trk.addEventListener('pointercancel', () => { lpEnd(); endTrk(); });
trk.addEventListener('contextmenu', e => { if (canDrag() && !PK.armed) { e.preventDefault(); return; } onCtx({ type: 't' }, e); });

/* graphs: scrub, move t₁ and t₂, draw, edit samples, predict */
const drawQ = () => (editingRec() ? 's' : S.draw.q);
let gGrab = null, stroke = null, frozenY = null, lastNode = null;
function delNode(q, hd) {
  const r = deleteNode(S.draw.segs[q], hd);
  if (!r) { toast(T('node_keep')); return; }
  pushUndo(); S.draw.segs[q] = r; lastNode = null;
  rebuildDraw(); onModelChange(); renderMotions(); save(); toast(T('node_del'));
}
function graphPointer(q, e, down) {
  const P = plots[q]; if (!P.xb) return;
  const r = P.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const M = model(), t = clamp(P.invX(x), 0, P.xb), yv = P.invY(y);
  if (down) {
    gGrab = 'cur';
    if (predicting() && S.pred.q === q) gGrab = 'pred';
    else if (S.src === 'draw' && editingRec() && !REC.on) { frozenY = { q, r: [P.ya, P.yb] }; gGrab = 'rec'; recEditDown(q, t, yv); }
    else if (S.src === 'draw' && S.draw.q === q && !REC.on) {
      frozenY = { q, r: [P.ya, P.yb] };
      if (S.draw.tool === 'move') {
        let best = null, bd = 18;
        for (const hd of handles(S.draw.segs[q])) { const d = Math.hypot(P.X(hd.t) - x, P.Yc(toV(hd.y, q)) - y); if (d < bd) { bd = d; best = hd; } }
        const segs = S.draw.segs[q], fi = segs.findIndex(g => g.type === 'free' && t >= g.ta && t <= g.tb && Math.abs(P.Yc(toV(segValue(g, t), q)) - y) < 22);
        if (best) {
          // a double tap on a node deletes it
          const now = performance.now(), L = lastNode;
          lastNode = { i: best.i, end: best.end, q, time: now };
          if (L && L.i === best.i && L.end === best.end && L.q === q && now - L.time < 380) { lastNode = null; frozenY = null; gGrab = null; delNode(q, best); return; }
          gGrab = 'handle'; stroke = { h: best }; pushUndo();
        }
        else if (fi >= 0) { // freehand samples move like recorded ones, with the same radius
          pushUndo(); const g = segs[fi];
          gGrab = 'free'; stroke = { i: fi, k: clamp(Math.round((t - g.ta) / FREE_DT), 0, g.ys.length - 1), y0: toW(yv, q), base: g.ys.slice() };
        } else frozenY = null;
      } else { gGrab = 'draw'; startStroke(q, t, yv); }
    } else if (effAn().iv) {
      const d1 = Math.abs(x - P.X(S.an.t1)), d2 = Math.abs(x - P.X(S.an.t2));
      if (Math.min(d1, d2) < 14) gGrab = d1 <= d2 ? 't1' : 't2';
    }
  }
  const Tm = M ? M.T : P.xb;
  if (gGrab === 'cur') { if (!REC.on) { S.t = Math.min(t, Tm); S.playing = false; ballFree = false; } }
  else if (gGrab === 't1') S.an.t1 = r3(Math.min(Math.min(t, Tm), S.an.t2 - 0.02));
  else if (gGrab === 't2') S.an.t2 = r3(Math.max(Math.min(t, Tm), S.an.t1 + 0.02));
  else if (gGrab === 'pred') predPoint(t, yv, down);
  else if (gGrab === 'draw') moveStroke(t, yv);
  else if (gGrab === 'rec' && !down) recEditMove(t, yv, false);
  else if (gGrab === 'handle') {
    const segs = S.draw.segs[q], hd = stroke.h;
    S.draw.segs[q] = moveHandle(segs, hd, t, toW(yv, q), S.draw.Tmax);
    const g = S.draw.segs[q][hd.i]; stroke.h = { ...hd, t: hd.end === 'a' ? g.ta : hd.end === 'b' ? g.tb : (g.ta + g.tb) / 2 };
    rebuildDraw();
  } else if (gGrab === 'free' && !down) {
    const segs = S.draw.segs[q], g = { ...segs[stroke.i] }, n = g.ys.length, d = toW(yv, q) - stroke.y0, R = S.draw.radius, c = stroke.k;
    g.ys = stroke.base.slice();
    for (let j = Math.max(0, c - R); j <= Math.min(n - 1, c + R); j++) { const u = R ? Math.abs(j - c) / (R + 1) : 0; g.ys[j] += d * (R ? (1 - u * u) ** 2 : 1); }
    g.ya = g.ys[0]; g.yb = g.ys[n - 1];
    segs[stroke.i] = g; rebuildDraw();
  }
  if (gGrab === 't1' || gGrab === 't2') syncIntervalInputs();
  dirty = true;
}
function graphUp() {
  if (gGrab === 'draw') endStroke();
  if (gGrab === 'handle' || gGrab === 'rec' || gGrab === 'free') { onModelChange(); renderMotions(); save(); }
  recGrab = null;
  if (gGrab === 't1' || gGrab === 't2' || gGrab === 'pred') save();
  gGrab = null; stroke = null; frozenY = null; dirty = true;
}
for (const q of ['s', 'v', 'a']) {
  const cv = plots[q].cv;
  cv.addEventListener('pointerdown', e => {
    if (PK.armed) { e.preventDefault(); arm(false); firePick({ type: 'g', q }, e); return; }
    cv.setPointerCapture(e.pointerId); graphPointer(q, e, true);
    if (e.button === 0 && ['cur', 't1', 't2'].includes(gGrab)) lpStart({ type: 'g', q }, e);
  });
  cv.addEventListener('pointermove', e => { lpMove(e); if (gGrab) graphPointer(q, e, false); });
  cv.addEventListener('pointerup', () => { lpEnd(); graphUp(); }); cv.addEventListener('pointercancel', () => { lpEnd(); graphUp(); });
  cv.addEventListener('contextmenu', e => onCtx({ type: 'g', q }, e));
}
/* drawing tools: values are kept in world coordinates */
function startStroke(q, t, yv) {
  const segs = S.draw.segs[q], tEnd = endT(segs);
  const ta = segs.length ? (t < tEnd - 0.05 ? t : tEnd) : 0;
  const prev = segs.length ? (valueAt(segs, ta, 'left') ?? valueAt(segs, ta, 'right')) : null;
  const yw = toW(yv, q);
  const ya = S.draw.snap && prev !== null ? prev : yw;
  const m0 = S.draw.snap && segs.length && ta > 0 ? slopeLeft(segs, ta) : 0;
  stroke = { q, ta, ya, m0, pts: [[ta, ya]], tb: ta, yb: ya };
}
function moveStroke(t, yv) {
  const st = stroke; if (!st) return;
  const yw = toW(yv, st.q), tt = Math.min(t, S.draw.Tmax);
  if (S.draw.tool === 'pen') { if (tt > st.pts[st.pts.length - 1][0] + 0.004) st.pts.push([tt, yw]); }
  else { st.tb = Math.max(st.ta + 0.05, tt); st.yb = yw; }
}
function strokeSeg() {
  const st = stroke; if (!st) return null;
  if (S.draw.tool === 'pen') return st.pts.length >= 3 && st.pts[st.pts.length - 1][0] - st.ta > 0.1 ? freeSeg(st.pts) : null;
  if (!(st.tb > st.ta + 0.04)) return null;
  return S.draw.tool === 'line' ? { type: 'line', ta: st.ta, tb: st.tb, ya: st.ya, yb: st.yb, blend: false } : { type: 'para', ta: st.ta, tb: st.tb, ya: st.ya, yb: st.yb, m0: st.m0, blend: false };
}
function endStroke() {
  const g = strokeSeg(); if (!g) return;
  pushUndo();
  const q = stroke.q;
  S.draw.segs[q] = splice(S.draw.segs[q], g, S.draw.snap);
  rebuildDraw(); onModelChange(); save();
}
function previewPts() {
  if (gGrab !== 'draw' || !stroke) return null;
  const q = stroke.q;
  if (S.draw.tool === 'pen') return stroke.pts.map(([t, y]) => [t, toV(y, q)]);
  const g = strokeSeg(); if (!g) return null;
  const out = []; for (let k = 0; k <= 40; k++) { const t = g.ta + (g.tb - g.ta) * k / 40; out.push([t, toV(segValue(g, t), q)]); }
  return out;
}
/* prediction strokes: a grid over the visible time span */
const PRED_N = 241;
let predLast = null;
function predPoint(t, y, down) {
  const P = S.pred, span = plots[P.q].xb;
  if (!P.ys.length || Math.abs(P.tspan - span) > 1e-9) { P.ys = new Array(PRED_N).fill(NaN); P.tspan = span; }
  const k = Math.round(t / span * (PRED_N - 1));
  if (down || !predLast) { P.ys[k] = y; predLast = [k, y]; return; }
  const [k0, y0] = predLast, dk = k - k0;
  for (let j = Math.min(k0, k); j <= Math.max(k0, k); j++) P.ys[j] = dk === 0 ? y : y0 + (y - y0) * (j - k0) / dk;
  predLast = [k, y];
}
function predScore() {
  const P = S.pred, M = model(); if (!M || !P.ys.length) return null;
  let e2 = 0, n = 0;
  const [lo, hi] = M.range[P.q], span = Math.max(1, hi - lo);
  P.ys.forEach((y, k) => { const t = P.tspan * k / (PRED_N - 1); if (isFinite(y) && t <= M.T) { const d = y - M.at(t)[{ s: 0, v: 1, a: 2 }[P.q]]; e2 += d * d; n++; } });
  if (n < 5) return null;
  return Math.round(100 * Math.exp(-((Math.sqrt(e2 / n) / (0.18 * span)) ** 2)));
}

/* ================================================================ render loop */
let dirty = true, last = performance.now();
function timeSpan(M) {
  if (S.src === 'chal' && CH.TM) return CH.TM.T;
  if (REC.on) return Math.max(5, (M ? M.T : 0) * 1.15);
  if (S.src === 'draw') return Math.max(S.draw.Tmax, M ? M.T : 0);
  return M ? M.T : 5;
}
function yRange(q, M, TMv) {
  let lo = Infinity, hi = -Infinity;
  const add = r => { if (r) { lo = Math.min(lo, r[0]); hi = Math.max(hi, r[1]); } };
  if (frozenY && frozenY.q === q) return frozenY.r;
  if (M) add(M.range[q]);
  if (TMv) add(TMv.range[q]);
  if (q === 's' && canDrag()) { const a = toV(0), b = toV(10); add([Math.min(a, b), Math.max(a, b)]); }
  if (S.src === 'draw' && drawQ() === q && !editingRec()) { if (q === 's') { const a = toV(0), b = toV(10); add([Math.min(a, b), Math.max(a, b)]); } else add([-3, 3]); }
  if (predicting() && S.pred.q === q) for (const y of S.pred.ys) if (isFinite(y)) add([y, y]);
  if (!isFinite(lo)) { lo = 0; hi = q === 's' ? 10 : 1; }
  return niceRange(lo, hi, 0.1, 1, true);
}
let wrCache = { key: '', r: [0, 10] };
function worldRange(Mw, others) {
  if (canDrag()) return [0, 10];
  const key = (Mw ? Mw.uid : 'x') + '|' + others.map(o => o.Mw.uid).join(',') + '|' + S.frame.o;
  if (wrCache.key !== key) {
    let lo = Mw ? Mw.range.s[0] : Infinity, hi = Mw ? Mw.range.s[1] : -Infinity;
    for (const o of others) { lo = Math.min(lo, o.Mw.range.s[0]); hi = Math.max(hi, o.Mw.range.s[1]); }
    if (!isFinite(lo)) { lo = 0; hi = 10; }
    lo = Math.min(lo, S.frame.o); hi = Math.max(hi, S.frame.o);
    wrCache = { key, r: niceRange(lo, hi, 0.06, 2, true) };
  }
  return wrCache.r;
}
function frame(now) {
  try {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (CH.count) {
      const tn = performance.now(), left = Math.ceil((CH.countEnd - tn) / 1000);
      const ce = $('#count'); ce.hidden = false; ce.textContent = left > 0 ? String(left) : T('go');
      if (tn >= CH.countEnd) { CH.count = 0; ce.hidden = true; startRec(); }
      dirty = true;
    }
    physTick(dt);
    if (REC.on) { recTick(); dirty = true; }
    const mm = models(), Mv = mm.Mv, Tend = Math.max(Mv ? Mv.T : 0, ...mm.others.map(o => o.Mv.T));
    if (S.playing && Tend > 0 && !REC.on) {
      S.t += dt * S.speed;
      if (S.t >= Tend) { S.t = Tend; S.playing = false; }
      dirty = true;
    }
    if (dirty && !(PDC && PDC.isOpen())) { dirty = false; render(mm); }
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
const TMvOr = others => (S.src === 'chal' ? viewOf(CH.TM) : others.length ? { range: mergeRanges(others.map(o => o.Mv)) } : null);
function mergeRanges(Ms) {
  const r = { s: [Infinity, -Infinity], v: [Infinity, -Infinity], a: [Infinity, -Infinity] };
  for (const M of Ms) for (const q of ['s', 'v', 'a']) { r[q][0] = Math.min(r[q][0], M.range[q][0]); r[q][1] = Math.max(r[q][1], M.range[q][1]); }
  return r;
}
function render(mm) {
  const { Mw, Mv: M, others } = mm;
  const oT = Math.max(0, ...others.map(o => o.Mv.T)), ref = TMvOr(others);
  const an = effAn();
  updateStats(REC.on ? null : M, an);
  const TMv = S.src === 'chal' ? viewOf(CH.TM) : null;
  let cartW = NaN, cartVw = NaN, cartAw = NaN;
  if (canDrag() && (REC.on || trkDrag || ballFree || PH.free || !Mw)) { cartW = ball; if (REC.on && Mw) { cartVw = Mw.V(Mw.T); cartAw = Mw.A(Mw.T); } }
  else if (Mw && !allHid(mm.am)) { const r = Mw.at(S.t); cartW = r[0]; cartVw = r[1]; cartAw = r[2]; }
  const pr = S.pred.on && f('pred') && S.pred.ys.length ? { q: S.pred.q, revealed: S.pred.revealed, ys: S.pred.ys, tspan: S.pred.tspan } : (predicting() ? { q: S.pred.q, revealed: false, ys: [], tspan: 1 } : null);
  const drawing = S.src === 'draw', visO = others.filter(o => !allHid(o.m));
  const V = {
    M, others: others.map(o => ({ M: o.Mv, L: o.L, hid: o.hid })), hideA: (mm.am && mm.am.hid) || {}, La: others.length ? mm.L : '', meet: visO.length && !allHid(mm.am) ? meetings(M, visO, mm.L) : [], TM: TMv, tq: S.src === 'chal' ? CH.tq : null, t: S.t, tSpan: Math.max(timeSpan(M), oT), an, st: ST && !REC.on ? ST : null, rs: RS,
    rawBig: !!editingRec() && S.src === 'draw', dec: S.dec, editable: !!editingRec() && S.src === 'draw' && !REC.on ? T('editable') : '',
    Q: S.Q, show: S.show, f, raw: S.show.raw && f('drag') && !(editingRec() && S.src === 'draw'), pred: pr, collTxt: T('coll'),
    drawQ: drawing && !editingRec() ? S.draw.q : null, drawTag: drawing && !editingRec() && !REC.on ? T(S.draw.tool === 'move' ? 'editable' : 'drawable') : '', preview: drawing ? previewPts() : null,
    dots: drawing && !editingRec() && S.draw.tool === 'move' ? S.draw.segs[S.draw.q].filter(g => g.type === 'free').flatMap(g => g.ys.map((y, k) => [g.ta + k * FREE_DT, toV(y, S.draw.q)])) : null,
    recDots: !!editingRec() && drawing, editPrev: recGrab && recGrab.pts ? { q: recGrab.q, pts: recGrab.pts } : null,
    handles: drawing && !editingRec() && S.draw.tool === 'move' ? handles(S.draw.segs[S.draw.q]).map(hd => ({ t: hd.t, y: toV(hd.y, S.draw.q) })) : null,
    yr: { s: yRange('s', M, ref), v: yRange('v', M, ref), a: yRange('a', M, ref) }
  };
  const TV = {
    vert: S.frame.vert, wr: worldRange(Mw, others), frame: S.frame, Q: S.Q, Mw, t: S.t, show: S.show, f,
    diagram: S.show.diagram && f('diagram'), floor: canDrag() ? throwable() && S.thr.floor : ffActive() && S.ff.floor,
    cartW, cartVw, cartAw, dragging: trkDrag, La: others.length ? mm.L : '', carts: others.filter(o => !allHid(o.m)).map(o => ({ w: o.Mw.S(Math.min(S.t, o.Mw.T)), L: o.L })),
    vmax: Mw ? Math.max(Math.abs(Mw.range.v[0]), Math.abs(Mw.range.v[1])) : 1,
    amax: Mw ? Math.max(Math.abs(Mw.range.a[0]), Math.abs(Mw.range.a[1])) : 1,
    fab: canDrag(), lefty: S.hand === 'l', trackMsg: canDrag() && !REC.on && !Mw && !trkDrag ? T(throwable() ? 'throw_hint' : 'drag_hint') : ''
  };
  // one left margin for all graphs, as narrow as the tick labels allow, so the time axes line up
  const shown = gq();
  V.ml = Math.max(26, ...shown.map(q => plots[q].tickWidth(...V.yr[q]))) + 10;
  drawTrack(trk, TV); VS.trackInv = TV.trackInv; VS.originPx = TV.originPx; VS.trackPt = TV.trackPt; VS.cartW = cartW;
  for (const q of shown) drawGraph(plots[q], q, V);
  const msg = $('#gmsg');
  const showMsg = !M && !(S.src === 'chal' && CH.TM) && !drawing;
  const hidAct = !!M && allHid(mm.am) && !REC.on;
  msg.hidden = !showMsg && !hidAct; if (showMsg) msg.textContent = S.src === 'eq' ? T('fix_eq') : T('no_motion'); else if (hidAct) msg.textContent = T('act_hidden', mm.L);
  $('#editDone').hidden = !(editingRec() && S.src === 'draw' && !REC.on);
  const dm = $('#drawMsg'); dm.hidden = !(drawing && !editingRec() && !S.draw.segs[S.draw.q].length && !stroke);
  if (!dm.hidden) dm.textContent = T('draw_hint', S.draw.q === 's' ? S.Q : S.draw.q);
  // time strip
  const tR = $('#tRange'), span = Math.max(M ? M.T : 0, oT) || 1;
  tR.max = String(span); if (document.activeElement !== tR) tR.value = String(S.t);
  tR.disabled = (!M && !others.length) || REC.on;
  $('#tLbl').textContent = 't = ' + fx(S.t) + ' s';
  renderVT(mm);
  const pl = $('#playLbl'), lab = S.playing ? T('pause') : T('play');
  if (pl.textContent !== lab) pl.textContent = lab;
  $('#playIcon').textContent = S.playing ? 'pause' : 'play_arrow';
}
/* values table: rows are objects, columns quantities; header, row and cell buttons switch graphs and curves */
let vtKey = '';
const QU = { s: 'm', v: 'm/s', a: 'm/s²' };
function renderVT(mm) {
  const tb = $('#vt'), qs = ['s', 'v', 'a'].filter(q => q === 's' || f(q === 'v' ? 'gV' : 'gA'));
  const rows = [...(mm.am && mm.Mv ? [{ m: mm.am, M: mm.Mv, act: true }] : []), ...mm.others.map(o => ({ m: o.m, M: o.Mv, act: false }))];
  if (!rows.length && mm.Mv) rows.push({ m: null, M: mm.Mv, act: true });
  const key = [qs.join(''), rows.map(r => (r.m ? r.m.id : 'x') + JSON.stringify(r.m && r.m.hid || {})).join(','), JSON.stringify(S.gshow), S.Q, LANG, predicting() ? S.pred.q : ''].join('|');
  if (key !== vtKey) {
    vtKey = key; tb.innerHTML = '';
    const col = { s: C().cs, v: C().cv, a: C().ca };
    const head = h('tr', null, h('th'));
    for (const q of qs) {
      const b = h('button', { type: 'button', class: S.gshow[q] ? '' : 'off', title: T('vt_graph', q === 's' ? S.Q : q), 'aria-pressed': String(S.gshow[q]) }, h('i', { style: 'background:' + col[q] }), h('span', { text: (q === 's' ? S.Q : q) + ' (' + QU[q] + ')' }));
      b.onclick = () => { const on = !S.gshow[q]; if (!on && gq().length < 2) return; S.gshow[q] = on; vtKey = ''; syncGraphs(); save(); };
      head.append(h('th', null, b));
    }
    tb.append(h('thead', null, head));
    const body = h('tbody');
    for (const r of rows) {
      const hid = (r.m && r.m.hid) || {}, allOff = qs.every(q => hid[q]);
      const lb = h('button', { type: 'button', class: allOff ? 'off' : '', title: T('vt_obj') }, h('span', { class: 'ltr' + (r.act ? ' act' : ''), text: r.m ? letterOf(r.m) : '·' }));
      lb.onclick = () => { if (!r.m) return; const rc = lb.getBoundingClientRect(); openPick(r.m, rc.left + rc.width / 2, rc.top); };
      const tr = h('tr', null, h('th', null, lb));
      for (const q of qs) {
        const hideV = predicting() && S.pred.q === q && r.act;
        const cb = h('button', { type: 'button', class: hid[q] || !S.gshow[q] ? 'off' : '', 'data-vt': (r.m ? r.m.id : 'x') + q, title: T('vt_cell'), 'aria-pressed': String(!hid[q]) }, h('span', { class: 'v', text: hideV ? '?' : '' }), h('span', { class: 'u', text: QU[q] }));
        cb.onclick = () => { if (!r.m) return; r.m.hid = { ...(r.m.hid || {}), [q]: !hid[q] }; vtKey = ''; dirty = true; save(); };
        tr.append(h('td', null, cb));
      }
      body.append(tr);
    }
    tb.append(body);
  }
  for (const r of rows) {
    const vals = r.M && S.t <= r.M.T + 1e-9 ? r.M.at(S.t) : [NaN, NaN, NaN];
    qs.forEach((q, i) => {
      const el = tb.querySelector(`[data-vt="${(r.m ? r.m.id : 'x') + q}"] .v`);
      if (el && el.textContent !== '?') el.textContent = isNum(vals[i]) ? fx(vals[i]) : '–';
    });
  }
}
function onModelChange() { statsKey = ''; const M = model(); if (M) clampInterval(M.T); syncIntervalInputs(); syncPred(); dirty = true; }

/* ================================================================ analysis panel */
const anUI = {};
function buildAnalysis() {
  const pr = $('#anPred'); pr.innerHTML = '';
  anUI.predTg = toggle(pr, { key: 'pred', sub: 'pred_s', icon: 'psychology', col: 'var(--accent)', get: () => S.pred.on, set: v => { S.pred.on = v; S.pred.revealed = false; S.pred.ys = []; syncPred(); changedAn(); } });
  anUI.predQ = seg($('#predQ'), [{ v: 's', text: S.Q + '-t' }, { v: 'v', text: 'v-t', feat: 'gV' }, { v: 'a', text: 'a-t', feat: 'gA' }], S.pred.q, q => { S.pred.q = q; S.pred.ys = []; S.pred.revealed = false; syncPred(); changedAn(); });
  const sl = $('#anSlope'); sl.innerHTML = '';
  anUI.tan = toggle(sl, { key: 'tan', sub: 'tan_s', svg: 'tan', col: 'var(--cv)', feat: 'tan', get: () => S.an.tan, set: v => { S.an.tan = v; changedAn(); } });
  anUI.sec = toggle(sl, { key: 'sec', sub: 'sec_s', svg: 'sec', col: 'var(--cv)', feat: 'sec', get: () => S.an.sec, set: v => { S.an.sec = v; changedAn(); } });
  const ar = $('#anArea'); ar.innerHTML = '';
  anUI.areaV = toggle(ar, { key: 'areaV', sub: 'areaV_s', svg: 'area', col: 'var(--cv)', feat: 'areaV', get: () => S.an.areaV, set: v => { S.an.areaV = v; changedAn(); } });
  anUI.areaA = toggle(ar, { key: 'areaA', sub: 'areaA_s', svg: 'area', col: 'var(--ca)', feat: 'areaA', get: () => S.an.areaA, set: v => { S.an.areaA = v; changedAn(); } });
  const av = $('#anAvg'); av.innerHTML = '';
  anUI.avg = toggle(av, { key: 'avg', sub: 'avg_s', svg: 'avg', col: 'var(--accent)', feat: 'avg', get: () => S.an.avg, set: v => { S.an.avg = v; changedAn(); } });
  anUI.method = seg($('#methodSeg'), ['true', 'left', 'mid', 'right', 'trap'].map(m => ({ v: m, svg: 'r_' + m, title: T('m_' + m) })), S.an.method, m => { S.an.method = m; changedAn(); });
  $('#nR').oninput = () => { S.an.n = +$('#nR').value; changedAn(); };
  const qt = $('#qtools'); qt.innerHTML = '';
  for (const [k, ic, feat] of [['tan', 'tan', 'tan'], ['sec', 'sec', 'sec'], ['area', 'area', 'areaV'], ['avg', 'avg', 'avg']]) {
    const b = h('button', { class: 'qt', type: 'button', 'data-q': k, 'data-f': feat, title: T(k === 'area' ? 'area_q' : k), 'aria-label': T(k === 'area' ? 'area_q' : k), html: ICON[ic] });
    b.onclick = () => {
      if (k === 'area') { const on = !(S.an.areaV || S.an.areaA); S.an.areaV = on; S.an.areaA = on && f('gA'); }
      else S.an[k] = !S.an[k];
      changedAn();
    };
    qt.append(b);
  }
  syncAnalysis();
}
function syncAnalysis() {
  for (const k of ['tan', 'sec', 'areaV', 'areaA', 'avg', 'predTg']) anUI[k] && anUI[k].sync();
  anUI.method && anUI.method.set(S.an.method);
  $('#methodL').textContent = T('m_' + S.an.method);
  $('#nCtl').hidden = S.an.method === 'true';
  $('#nL').textContent = String(S.an.n); $('#nR').value = S.an.n;
  $$('#qtools .qt').forEach(b => b.classList.toggle('on', b.dataset.q === 'area' ? (S.an.areaV || S.an.areaA) : !!S.an[b.dataset.q]));
  const iv = effAn().iv;
  $('#ivHead').hidden = !iv; $('#ivRow').hidden = !iv;
  syncIntervalInputs(); syncPred();
}
function syncPred() {
  if (!anUI.predQ) return;
  const P = S.pred;
  anUI.predQ.set(P.q); $$('#predQ button')[0].querySelector('span').textContent = S.Q + '-t';
  $('#predCtl').hidden = !P.on;
  $('#predReveal').hidden = !P.on || P.revealed; $('#predRetry').hidden = !P.on || !P.revealed;
  const sc = P.revealed ? predScore() : null;
  $('#predNote').textContent = !P.on ? '' : P.revealed ? (sc != null ? T('pred_score', sc) : T('pred_none')) : T('pred_draw', P.q === 's' ? S.Q : P.q);
}
$('#predReveal').onclick = () => { S.pred.revealed = true; syncPred(); changedAn(); };
$('#predRetry').onclick = () => { S.pred.revealed = false; S.pred.ys = []; syncPred(); changedAn(); };
function changedAn() { syncAnalysis(); statsKey = ''; dirty = true; save(); }
function syncIntervalInputs() {
  const a = $('#t1In'), b = $('#t2In');
  if (document.activeElement !== a) a.value = fmtIn(S.an.t1);
  if (document.activeElement !== b) b.value = fmtIn(S.an.t2);
}
for (const [id, k] of [['#t1In', 't1'], ['#t2In', 't2']]) {
  $(id).addEventListener('change', e => {
    const v = pnum(e.target.value);
    if (isNum(v)) { S.an[k] = r3(Math.max(0, v)); if (S.an.t2 <= S.an.t1) { if (k === 't1') S.an.t2 = r3(S.an.t1 + 0.5); else S.an.t1 = r3(Math.max(0, S.an.t2 - 0.5)); } const M = model(); if (M) clampInterval(M.T); }
    syncIntervalInputs(); statsKey = ''; dirty = true; save();
  });
}
function renderStats() {
  const tb = $('#stats'), fl = $('#flags'); tb.innerHTML = ''; fl.innerHTML = '';
  const st = ST; if (!st) return;
  const an = effAn(), Q = S.Q, col = C(), rows = [];
  const row = (k, v, sub, color) => rows.push(`<tr><td>${k}${sub ? `<small>${sub}</small>` : ''}</td><td${color ? ` style="color:${color}"` : ''}>${v}</td></tr>`);
  rows.push(`<tr class="hd"><td>[t₁, t₂]</td><td>[${fx(st.t1)}; ${fx(st.t2)}] s</td></tr>`);
  row('Δt', fx(st.dt) + ' s');
  row('Δ' + Q + ' = ' + Q + '₂ − ' + Q + '₁', fx(st.ds) + ' m', null, col.cs);
  if (f('gV')) {
    const exact = fx(st.intV) + ' m';
    if (an.areaV && an.method !== 'true' && RS.v) row(T('area_v') + ' · ' + T('m_' + an.method), fx(RS.v.sum) + ' m', T('err_vs', num(RS.v.sum - st.intV, 2), exact));
    else row(T('area_v'), exact, T('area_v_s'));
    if (Math.abs(st.dist - Math.abs(st.intV)) > 1e-3 * (1 + st.dist)) row(T('dist'), fx(st.dist) + ' m', T('dist_s'));
    row(T('vbar'), fx(st.vbar) + ' m/s', 'Δ' + Q + ' / Δt', col.cv);
    if (Math.abs(st.spd - Math.abs(st.vbar)) > 1e-3 * (1 + st.spd)) row(T('spd'), fx(st.spd) + ' m/s', T('spd_s'));
  }
  if (f('gA')) {
    row('Δv = v₂ − v₁', fx(st.dv) + ' m/s', null, col.cv);
    const exact = fx(st.intA) + ' m/s';
    if (an.areaA && an.method !== 'true' && RS.a) row(T('area_a') + ' · ' + T('m_' + an.method), fx(RS.a.sum) + ' m/s', T('err_vs', num(RS.a.sum - st.intA, 2), exact));
    else row(T('area_a'), exact, T('area_a_s'));
    row(T('abar'), fx(st.abar) + ' m/s²', 'Δv / Δt', col.ca);
  }
  tb.innerHTML = rows.join('');
  if (st.jS) fl.append(h('div', { class: 'flag', text: T('flag_jump', fx(st.jS), Q) }));
  if (st.jV && f('gA')) fl.append(h('div', { class: 'flag w', text: T('flag_kink', fx(st.jV)) }));
}

/* ================================================================ settings panel */
let levelSeg, qSeg, tauSeg, orientSeg, showTgs = [], frameUI = {};
function buildQSeg() {
  const opts = S.frame.vert ? ['s', 'y', 'h'] : ['s', 'x', 'r'];
  if (!opts.includes(S.Q)) S.Q = 's';
  qSeg = seg($('#qSeg'), opts.map(q => ({ v: q, text: q })), S.Q, q => { S.Q = q; renderSections(); renderTargets(); renderFF(); renderDraw(); syncAnalysis(); statsKey = ''; dirty = true; save(); });
}
function buildSettings() {
  levelSeg = seg($('#levelSeg'), [1, 2, 3, 4].map(n => ({ v: n, text: n + ' · ' + T('lv' + n + '_short') })), S.level, n => setLevel(n));
  buildQSeg();
  tauSeg = seg($('#tauSeg'), [{ v: 'g', text: 't', title: T('tau_g') }, { v: 'l', text: 'τ', title: T('tau_l') }], S.useTau ? 'l' : 'g', v => { S.useTau = v === 'l'; refreshSections(); save(); });
  orientSeg = seg($('#orientSeg'), [{ v: 'h', icon: 'swap_horiz', text: T('horiz'), title: T('horiz') }, { v: 'v', icon: 'swap_vert', text: T('vert'), title: T('vert') }], S.frame.vert ? 'v' : 'h', v => setVert(v === 'v'));
  const fh = $('#frameBox'); fh.innerHTML = '';
  frameUI.o = numCtl(fh, { id: 'frO', label: T('origin'), unit: 'm', get: () => S.frame.o, set: v => setFrame(v, S.frame.dir) });
  frameUI.flip = h('button', { class: 'btn', type: 'button', id: 'flipBtn' }, msIcon('swap_horiz'), h('span', { text: T('flip') }));
  frameUI.flip.onclick = () => setFrame(S.frame.o, -S.frame.dir);
  fh.append(h('div', { class: 'row', style: 'margin-top:8px' }, frameUI.flip), h('p', { class: 'note', text: T('frame_note') }));
  seg($('#handSeg'), [{ v: 'r', icon: 'front_hand', text: T('hand_r'), title: T('hand_t') }, { v: 'l', icon: 'back_hand', text: T('hand_l'), title: T('hand_t') }], S.hand, v => { S.hand = v; store.set('motus1d.hand', v); applyHand(); });
  seg($('#decSeg'), [0, 1, 2, 3].map(d => ({ v: d, text: d === 0 ? '0' : '0,' + '0'.repeat(d) })), S.dec, d => { S.dec = d; setDec(d); statsKey = ''; dirty = true; renderMotions(); refreshSections(); save(); });
  const sh = $('#showList'); sh.innerHTML = ''; showTgs = [];
  for (const [k, feat] of [['vel', null], ['acc', 'gA'], ['strobe', null], ['diagram', 'diagram'], ['raw', 'drag']])
    showTgs.push(toggle(sh, { key: 'sh_' + k, sub: 'sh_' + k + '_s', feat, get: () => S.show[k], set: v => { S.show[k] = v; dirty = true; save(); } }));
  syncSettings();
}
function syncFrameUI() {
  if (!frameUI.o) return;
  frameUI.o.sync(); orientSeg.set(S.frame.vert ? 'v' : 'h');
  frameUI.flip.querySelector('.ms').textContent = S.frame.vert ? 'swap_vert' : 'swap_horiz';
  $('#arena').classList.toggle('vert', S.frame.vert); applyHand();
  syncSrcPanels();
}
function syncSettings() {
  levelSeg.set(S.custom ? null : S.level);
  $$('#levelSeg button').forEach(b => { b.disabled = S.locked; });
  $('#lockIcon').hidden = !S.locked;
  $('#levelNote').textContent = (S.custom ? T('custom_lv') : T('lv' + S.level)) + (S.locked ? ' ' + T('locked') : '');
  qSeg.set(S.Q); tauSeg.set(S.useTau ? 'l' : 'g');
  showTgs.forEach(t => t.sync()); syncFrameUI();
}
function setLevel(n) {
  if (S.locked) return;
  S.level = n; S.custom = null; setF();
  if (!f({ drag: 'drag', chal: 'chal', draw: 'draw', eq: 'kS' }[S.src])) setSrc('eq');
  if ([...needs(S.secs)].some(k => !f(k))) { const p = PRESETS.find(pp => pp.secs && [...needs(pp.secs)].every(k => f(k))); if (p) loadPreset(p); }
  if (S.draw.q === 'a' && !f('gA')) S.draw.q = f('gV') ? 'v' : 's';
  if (S.draw.q === 'v' && !f('gV')) S.draw.q = 's';
  if (S.pred.q === 'a' && !f('gA')) S.pred.q = f('gV') ? 'v' : 's';
  if (S.pred.q === 'v' && !f('gV')) S.pred.q = 's';
  renderAll(); save();
}
/* graphs on screen: allowed by the level and switched on in the table */
const gq = () => ['s', 'v', 'a'].filter(q => (q === 's' || f(q === 'v' ? 'gV' : 'gA')) && S.gshow[q]);
function syncGraphs() { for (const q of ['s', 'v', 'a']) $('#w' + q.toUpperCase()).hidden = !gq().includes(q); dirty = true; }
function applyFeatures() {
  $$('[data-f]').forEach(el => { el.hidden = !f(el.dataset.f); });
  syncGraphs();
  syncSrcPanels();
}

/* ================================================================ source, toolbar */
let srcSeg, speeds = [0.25, 0.5, 1, 2];
function setSrc(v) {
  if (REC.on) stopRec(true);
  CH.count = 0; $('#count').hidden = true; PH.free = false;
  S.src = v; srcSeg && srcSeg.set(v);
  if (v === 'eq' && !curM('eq', false)) { addMotion('eq'); renderSections(); recompile(); rebuildFF(); renderFF(); } // an empty list: the equations start a new motion
  for (const [k, id] of [['eq', '#srcEq'], ['draw', '#srcDraw'], ['drag', '#srcDrag'], ['chal', '#srcChal']]) $(id).hidden = v !== k;
  recBtn.hidden = !(v === 'drag' || v === 'chal');
  recBtn.title = T(v === 'chal' ? 'rec_chal' : 'rec_t'); recBtn.setAttribute('aria-label', recBtn.title);
  trk.classList.toggle('grab', v === 'drag' || v === 'chal');
  if (v === 'chal') { if (!CH.TM) setTarget(S.chal.id); else renderTargets(); }
  if (v === 'draw') { rebuildDraw(); renderDraw(); }
  syncSrcPanels(); renderMotions(); renderMeet();
  ballFree = false; S.playing = false; S.t = 0;
  onModelChange(); save();
}
function buildToolbar() {
  srcSeg = seg($('#srcSeg'), [
    { v: 'eq', icon: 'function', text: T('src_eq'), title: T('src_eq_t'), feat: 'kS' },
    { v: 'draw', icon: 'draw', text: T('src_draw'), title: T('src_draw_t'), feat: 'draw' },
    { v: 'drag', icon: 'touch_app', text: T('src_drag'), title: T('src_drag_t'), feat: 'drag' },
    { v: 'chal', icon: 'sports_score', text: T('src_chal'), title: T('src_chal_t'), feat: 'chal' }
  ], S.src, setSrc);
  seg($('#speedSeg'), speeds.map(v => ({ v, text: speedTxt(v) })), S.speed, v => { S.speed = v; syncSpeed(); });
  syncSpeed();
}
const speedTxt = v => (v === 0.25 ? '¼×' : v === 0.5 ? '½×' : v + '×');
function syncSpeed() { $('#speedBtn').textContent = speedTxt(S.speed); $$('#speedSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === S.speed)); }
$('#speedBtn').onclick = () => { S.speed = speeds[(speeds.indexOf(S.speed) + 1) % speeds.length]; syncSpeed(); };
$('#playBtn').onclick = () => { const M = model(); if (!M) return; if (S.t >= M.T - 1e-9) S.t = 0; S.playing = !S.playing; ballFree = false; PH.free = false; dirty = true; };
$('#stepBtn').onclick = () => { const M = model(); if (!M) return; S.playing = false; ballFree = false; S.t = Math.min(M.T, S.t + 1 / 30); dirty = true; };
$('#resetBtn').onclick = () => { S.playing = false; S.t = 0; ballFree = false; dirty = true; };
$('#tRange').addEventListener('input', e => { S.t = +e.target.value; S.playing = false; ballFree = false; dirty = true; });
$('#galBtn').onclick = () => openGallery('eq');
$('#addSec').onclick = addSection;
$('#blendR').addEventListener('input', e => { S.blendW = +e.target.value; $('#blendL').textContent = num(S.blendW, 2) + ' s'; rebuild(); });
for (const id of ['#smR', '#smR2']) $(id).addEventListener('input', e => {
  S.smooth = +e.target.value; syncSmooth();
  if (S.src === 'chal' && CH.attemptS) { CH.attempt = buildRecModel(CH.attemptS, S.smooth); scoreAttempt(); }
  onModelChange(); save();
});
function syncSmooth() { for (const [r, l] of [['#smR', '#smL'], ['#smR2', '#smL2']]) { $(r).value = S.smooth; $(l).textContent = '± ' + S.smooth + ' · ' + num(S.smooth * 2 * REC_DT, 2) + ' s'; } }
$('#keepAttempt').onclick = () => { if (!CH.attemptS) return; const m = addMotion('rec', { s: Float64Array.from(CH.attemptS) }, false); toast(T('kept', letterOf(m))); renderMotions(); save(); };
$('#clearRecs').onclick = () => { S.motions = S.motions.filter(m => m.type !== 'rec'); S.cur.rec = null; if (editingRec()) S.cur.draw = null; renderMotions(); onModelChange(); save(); };
$$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
function setTab(t) { S.tab = t; $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); for (const k of ['motion', 'analysis', 'settings']) $('#pane-' + k).hidden = k !== t; save(); }
$$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('#taskClose').onclick = () => { $('#task').hidden = true; };
let wipeArm = 0;
function wipe(noteEl) {
  if (Date.now() - wipeArm > 4000) { wipeArm = Date.now(); noteEl.hidden = false; noteEl.textContent = T('wipe_confirm'); return false; }
  for (const sc of SC.list) store.del(SKEY(sc.id));
  store.del(IDX); store.del(KEY);
  location.hash = ''; location.reload(); return true;
}
$('#wipeBtn').onclick = () => wipe($('#wipeNote'));

/* theme, language and the phone menu */
const THEME_ICON = { auto: 'contrast', light: 'light_mode', dark: 'dark_mode' };
function applyTheme() {
  const r = document.documentElement;
  if (S.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.theme;
  $('#themeIcon').textContent = THEME_ICON[S.theme]; $('#mThemeIcon').textContent = THEME_ICON[S.theme];
  $('#mThemeVal').textContent = T('th_' + S.theme);
  resetColors(); dirty = true; if (PDC) PDC.redraw();
  requestAnimationFrame(() => renderTargets());
}
const cycleTheme = () => { S.theme = S.theme === 'auto' ? 'light' : S.theme === 'light' ? 'dark' : 'auto'; store.set('motus1d.theme', S.theme); applyTheme(); save(); };
const switchLang = () => { setLang(LANG === 'it' ? 'en' : 'it'); renderAll(); };
$('#themeBtn').onclick = cycleTheme;
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { resetColors(); dirty = true; }); } catch (e) { /* old browsers */ }
$('#langBtn').onclick = switchLang;
const menu = $('#menu');
$('#menuBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#menuBtn').setAttribute('aria-expanded', String(!menu.hidden)); };
document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); } });
$('#mTheme').onclick = () => { cycleTheme(); };
$('#mLang').onclick = () => { switchLang(); menu.hidden = true; };
$('#mShare').onclick = () => { menu.hidden = true; openShare('make'); };
$('#mImport').onclick = () => { menu.hidden = true; openShare('import'); };
$('#mHelp').onclick = () => { menu.hidden = true; $('#helpDlg').showModal(); };
$('#mExport').onclick = () => { menu.hidden = true; openExport(); };
$('#mWipe').onclick = e => { e.stopPropagation(); if (!wipe($('#mWipeVal'))) $('#mWipeVal').hidden = false; };


/* ---------------- the list of motions */
let dragFFtg = null;
const TYPE_ICON = { eq: 'function', draw: 'draw', rec: 'fiber_manual_record' };
function motDesc(m) {
  if (m.type === 'eq') return m.data.ff.on && S.frame.vert && f('ff') ? T('mt_ff') : T(m.data.secs.length === 1 ? 'mt_eq1' : 'mt_eq', m.data.secs.length);
  if (m.type === 'draw') return T('mt_draw', m.data.q === 's' ? S.Q : m.data.q);
  return T('mt_rec', fx((m.data.s.length - 1) * REC_DT)) + (m.edited ? ' · ' + T('mt_edited') : '');
}
/* leave sample editing: back to the drag view, the edited recording stays active */
function exitEdit() {
  const m = editingRec(); if (!m) return;
  S.cur.draw = null; S.cur.rec = m.id; undo = [];
  setSrc(f('drag') ? 'drag' : 'eq'); syncSrcPanels(); renderMotions(); onModelChange(); save();
}
$('#editDone').onclick = exitEdit;
function activate(m) {
  if (m.type === 'eq') { S.cur.eq = m.id; setSrc('eq'); renderSections(); recompile(); rebuildFF(); renderFF(); syncSrcPanels(); }
  else if (m.type === 'draw') { S.cur.draw = m.id; undo = []; setSrc('draw'); rebuildDraw(); renderDraw(); }
  else if (S.src === 'draw') { S.cur.draw = m.id; undo = []; rebuildDraw(); renderDraw(); syncSrcPanels(); onModelChange(); }
  else { S.cur.rec = m.id; setSrc('drag'); }
  renderMotions(); save();
}
function removeMotion(m) {
  const wasActive = m === activeMotion(), idx = S.motions.indexOf(m);
  S.motions.splice(idx, 1);
  for (const k of ['eq', 'draw', 'rec']) if (S.cur[k] === m.id) S.cur[k] = null;
  undo = []; meetKey = ''; m._M = m._RM = null;
  if (!S.motions.length) {
    S.cur = { eq: null, draw: null, rec: null };
    if (f('drag')) { setSrc('drag'); return null; } // nothing left: the cart alone, ready to record
    const n = addMotion('eq'); activate(n); return n;
  }
  if (wasActive) { activate(S.motions[Math.max(0, idx - 1)]); return null; }
  renderMotions(); onModelChange(); save(); return null;
}
function duplicate(m) {
  const data = m.type === 'rec' ? { s: Float64Array.from(m.data.s) } : clone(m.data);
  const n = addMotion(m.type, data, false); n.edited = m.edited;
  activate(n);
}
function renderMotions() {
  const host = $('#motBox'); if (!host) return;
  host.innerHTML = '';
  host.hidden = S.src === 'chal';
  const am = activeMotion();
  const list = h('div', { class: 'motlist', role: 'list' });
  for (const m of S.motions) {
    const on = m === am;
    const main = h('button', { class: 'motmain', type: 'button', 'aria-current': on ? 'true' : null },
      h('span', { class: 'mletter', text: letterOf(m) }), msIcon(TYPE_ICON[m.type]), h('span', { class: 'mname', text: motDesc(m) }));
    main.onclick = () => activate(m);
    const row = h('div', { class: 'mot' + (on ? ' on' : ''), role: 'listitem' }, main);
    // icons, always in the same columns: show/hide · duplicate · edit (✓ while editing) · convert · delete
    const mi = (icon, key, fn, cls) => { const b = h('button', { class: 'mini' + (cls ? ' ' + cls : ''), type: 'button', title: T(key), 'aria-label': T(key) }, msIcon(icon)); b.onclick = fn; row.append(b); return b; };
    const gap = () => row.append(h('span', { class: 'mini ghost', 'aria-hidden': 'true' }));
    if (f('two')) {
      const off = allHid(m), eye = mi(off ? 'visibility_off' : 'visibility', off ? 'pk_show' : 'pk_hide', () => { setHidAll(m, !off); renderMotions(); }, off ? '' : 'on'); eye.setAttribute('aria-pressed', String(!off));
    }
    mi('content_copy', 'mot_dup_t', () => duplicate(m));
    if (m.type === 'rec' && editingRec() === m && S.src === 'draw') mi('check', 'edit_done_t', exitEdit, 'ok');
    else if (m.type === 'rec' && f('draw')) mi('edit', 'mot_edit_rec_t', () => editRec(m));
    else if (m.type === 'draw') mi('edit', 'pk_edit', () => editMotion(m));
    else gap();
    if (m.type === 'eq' && f('draw')) mi('draw', 'mot_to_draw_t', () => convertToDraw(m));
    else if (m.type === 'draw') mi('function', 'mot_to_eq_t', () => convertToEq(m));
    else gap();
    // delete at once: a slip of the finger is undone from the bar that appears
    const del = h('button', { class: 'mini del', type: 'button', title: T('mot_del_t'), 'aria-label': T('mot_del_t') }, msIcon('delete'));
    del.onclick = () => deleteWithUndo(m);
    row.append(del);
    list.append(row);
  }
  host.append(list);
  const acts = h('div', { class: 'motacts' });
  const btn = (icon, key, fn, feat) => { const b = h('button', { class: 'btn small', type: 'button', title: T(key + '_t'), 'data-f': feat || null }, msIcon(icon), h('span', { text: T(key) })); b.onclick = fn; if (feat && !f(feat)) b.hidden = true; acts.append(b); return b; };
  btn('add', 'mot_new_eq', () => { const m = addMotion('eq'); activate(m); });
  btn('add', 'mot_new_draw', () => { const m = addMotion('draw', { ...defData('draw'), q: f('gV') ? 'v' : 's' }); activate(m); }, 'draw');
  if (am) btn('sports_score', 'mot_target', () => useAsTarget(am), 'chal');
  host.append(acts);
  if (S.motions.length > 5) host.append(h('p', { class: 'note warnnote', text: T('mot_many', S.motions.length) }));
}

/* ---------------- picking a motion where it is drawn.
   Long press (or right click) on a curve or a cart, the pointer tool (the next tap picks), or a letter of the values table.
   A row of icons opens next to it: approve edits, hide, make active, edit, duplicate, delete (with undo). */
const QI = { s: 0, v: 1, a: 2 };
const shownQs = () => ['s', 'v', 'a'].filter(q => q === 's' || f(q === 'v' ? 'gV' : 'gA'));
const allHid = m => !!m && shownQs().every(q => m.hid && m.hid[q]);
function setHidAll(m, on) { m.hid = { s: on, v: on, a: on }; vtKey = ''; meetKey = ''; dirty = true; save(); }
function editRec(m) { S.cur.draw = m.id; undo = []; setSrc('draw'); rebuildDraw(); renderDraw(); syncSrcPanels(); renderMotions(); }
function editMotion(m) {
  if (m !== activeMotion()) activate(m);
  if (m.type === 'draw') { S.draw.tool = 'move'; if (drUI.tool) drUI.tool.set('move'); renderDraw(); dirty = true; }
  setTab('motion');
}
const PK = { armed: false, last: null, timer: 0, start: null, firedAt: 0 };
const pickEl = $('#pick'), pickBtn = $('#pickBtn');
function arm(on) {
  PK.armed = on; pickBtn.classList.toggle('armed', on); pickBtn.setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('picking', on);
  if (on) toast(T('pick_go'));
}
pickBtn.onclick = () => { closePick(); arm(!PK.armed); };
function pickCandidates(src, cx, cy, touch) {
  const mm = models(), tol = touch ? 24 : 15, out = [];
  if (src.type === 'g') {
    const q = src.q, P = plots[q]; if (!P.xb) return out;
    const list = [...(mm.am && mm.Mv && !REC.on ? [{ m: mm.am, M: mm.Mv }] : []), ...mm.others.map(o => ({ m: o.m, M: o.Mv }))];
    for (const it of list) {
      if (it.m.hid && it.m.hid[q]) continue;
      let best = Infinity;
      for (let dx = -tol; dx <= tol; dx += 1.5) {
        const t = P.invX(cx + dx); if (t < 0 || t > it.M.T) continue;
        const y = it.M.at(t)[QI[q]]; if (!isFinite(y)) continue;
        best = Math.min(best, Math.hypot(dx, P.Yc(y) - cy));
      }
      if (best <= tol) out.push({ m: it.m, d: best });
    }
  } else if (VS.trackPt) {
    const list = [...(mm.am && isFinite(VS.cartW) ? [{ m: mm.am, w: VS.cartW }] : []), ...mm.others.filter(o => !allHid(o.m)).map(o => ({ m: o.m, w: o.Mw.S(Math.min(S.t, o.Mw.T)) }))];
    for (const it of list) { if (!isFinite(it.w)) continue; const [x, y] = VS.trackPt(it.w); const d = Math.hypot(x - cx, y - cy); if (d <= tol + 8) out.push({ m: it.m, d }); }
  }
  return out.sort((a, b) => a.d - b.d);
}
function firePick(src, e) {
  clearTimeout(PK.timer); PK.start = null; PK.firedAt = performance.now();
  if (src.type === 'g') { gGrab = null; stroke = null; frozenY = null; } else { trkDrag = false; }
  const el = src.type === 'g' ? plots[src.q].cv : trk, r = el.getBoundingClientRect();
  const c = pickCandidates(src, e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch');
  if (!c.length) { toast(T('pick_none')); return; }
  // pressing again on the same spot goes to the next curve there
  let k = 0; const L = PK.last;
  if (L && c.length > 1 && Math.hypot(L.x - e.clientX, L.y - e.clientY) < 14 && performance.now() - L.time < 5000) k = (c.findIndex(x => x.m === L.m) + 1) % c.length;
  PK.last = { x: e.clientX, y: e.clientY, time: performance.now(), m: c[k].m };
  openPick(c[k].m, e.clientX, e.clientY);
}
/* long press: only while the press would just move the time cursor, so drawing and editing are never interrupted */
function lpStart(src, e) {
  clearTimeout(PK.timer);
  PK.start = { x: e.clientX, y: e.clientY };
  const ev = { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType };
  PK.timer = setTimeout(() => { if (PK.start) firePick(src, ev); }, 520);
}
function lpMove(e) { if (PK.start && Math.hypot(e.clientX - PK.start.x, e.clientY - PK.start.y) > 8) { clearTimeout(PK.timer); PK.start = null; } }
function lpEnd() { clearTimeout(PK.timer); PK.start = null; }
function onCtx(src, e) {
  e.preventDefault();
  if (performance.now() - PK.firedAt < 900) return; // the long press already opened it
  firePick(src, e);
}
function openPick(m, x, y) {
  pickEl.innerHTML = '';
  const am = activeMotion(), editing = editingRec() === m && S.src === 'draw';
  const ib = (icon, key, fn, cls) => {
    const b = h('button', { class: 'mini' + (cls ? ' ' + cls : ''), type: 'button', title: T(key), 'aria-label': T(key) }, msIcon(icon));
    b.onclick = () => { closePick(); fn(); }; pickEl.append(b);
  };
  pickEl.append(h('span', { class: 'ltr' + (m === am ? ' act' : ''), text: letterOf(m) }));
  if (editing) ib('check', 'edit_done_t', exitEdit, 'ok');
  const off = allHid(m);
  ib(off ? 'visibility' : 'visibility_off', off ? 'pk_show' : 'pk_hide', () => setHidAll(m, !off));
  if (m !== am) ib('radio_button_checked', 'pk_act', () => activate(m));
  if (m.type === 'rec') { if (f('draw') && !editing) ib('edit', 'mot_edit_rec_t', () => editRec(m)); }
  else ib('edit', 'pk_edit', () => editMotion(m));
  ib('content_copy', 'mot_dup_t', () => duplicate(m));
  ib('delete', 'mot_del_t', () => deleteWithUndo(m), 'del');
  pickEl.hidden = false;
  const w = pickEl.offsetWidth, ht = pickEl.offsetHeight;
  pickEl.style.left = clamp(x - w / 2, 8, Math.max(8, innerWidth - w - 8)) + 'px';
  pickEl.style.top = (y - ht - 20 < 8 ? y + 20 : y - ht - 20) + 'px';
}
function closePick() { pickEl.hidden = true; }
document.addEventListener('pointerdown', e => { if (!pickEl.hidden && !pickEl.contains(e.target)) closePick(); }, true);
addEventListener('resize', closePick);
document.addEventListener('scroll', closePick, true);
/* delete at once; the bar at the bottom brings it back for a few seconds */
const undoBar = $('#undoBar'); let undoT = 0, undoFn = null;
function deleteWithUndo(m) {
  const idx = S.motions.indexOf(m); if (idx < 0) return;
  const snap = { idx, cur: { ...S.cur }, src: S.src, wasActive: m === activeMotion(), L: letterOf(m) };
  const filler = removeMotion(m);
  undoFn = () => {
    if (filler && !filler.ver && S.motions.includes(filler)) S.motions.splice(S.motions.indexOf(filler), 1);
    S.motions.splice(Math.min(snap.idx, S.motions.length), 0, m);
    S.cur = { ...snap.cur }; meetKey = ''; vtKey = '';
    if (snap.wasActive && m.type === 'rec' && snap.src === 'draw') editRec(m);
    else if (snap.wasActive) activate(m);
    else { renderMotions(); onModelChange(); save(); }
  };
  $('#undoTxt').textContent = T('del_done', snap.L);
  undoBar.hidden = false; clearTimeout(undoT); undoT = setTimeout(() => { undoBar.hidden = true; undoFn = null; }, 6000);
}
$('#undoBtn').onclick = () => { clearTimeout(undoT); undoBar.hidden = true; const fn = undoFn; undoFn = null; if (fn) fn(); };

/* ---------------- conversions between equations and drawings, and challenge targets */
const worldOfMotion = m => (m === activeMotion() ? models().Mw : motionWorld(m));
function convertToDraw(m) {
  const W = worldOfMotion(m); if (!W || !W.t0) { toast(T('conv_fail')); return; }
  const segs = [];
  for (let i = 0; i < W.t0.length; i++) {
    const ta = W.t0[i], tb = W.t1[i], L = tb - ta, e = 1e-7 * (1 + tb);
    const [s0, v0, a0] = W.at(ta + e), quad = t => s0 + v0 * (t - ta) + 0.5 * a0 * (t - ta) ** 2;
    const exact = [0.25, 0.5, 0.75, 1].every(fr => { const t = fr === 1 ? tb - e : ta + L * fr, y = W.S(t); return Math.abs(y - quad(t)) < 1e-4 * (1 + Math.abs(y)); });
    if (exact) segs.push(Math.abs(a0) < 1e-9 ? { type: 'line', ta, tb, ya: s0, yb: quad(tb), blend: false } : { type: 'para', ta, tb, ya: s0, yb: quad(tb), m0: v0, blend: false });
    else { // not a polynomial of degree ≤ 2: sampled, still editable as a freehand piece
      const n = Math.max(2, Math.round(L / FREE_DT) + 1), ys = [];
      for (let k = 0; k < n; k++) ys.push(W.S(Math.min(tb - e, ta + k * FREE_DT)));
      segs.push({ type: 'free', ta, tb: ta + (n - 1) * FREE_DT, ya: ys[0], yb: ys[n - 1], ys, blend: false });
    }
  }
  const n = addMotion('draw', { q: 's', segs: { s: segs, v: [], a: [] }, s0: 0, v0: 0 }, false);
  toast(T('conv_done', letterOf(n))); activate(n);
}
function convertToEq(m) {
  const d = m.data, q = d.q, segs = d.segs[q];
  if (!segs.length) { toast(T('conv_empty')); return; }
  if (segs.some(g => g.type === 'free')) { toast(T('conv_free')); return; }
  const n3 = v => fmtIn(r3(v)), sv = (v, k) => n3(toV(v, k));
  const poly = (c0, c1, c2, ta) => { // c0 + c1 (t − ta) + c2 (t − ta)², in readable form
    const tt = ta === 0 ? 't' : '(t − ' + n3(ta) + ')';
    let out = n3(c0);
    const term = (c, p) => { if (Math.abs(c) < 1e-12) return; out += (c < 0 ? ' − ' : ' + ') + n3(Math.abs(c)) + ' ' + tt + p; };
    term(c1, ''); term(c2, '^2');
    return out;
  };
  let prevEnd = null, prevSlope = null;
  const secs = segs.map((g, i) => {
    const L = g.tb - g.ta, m1 = g.type === 'para' ? g.m0 : (g.yb - g.ya) / L, c2 = g.type === 'para' ? (g.yb - g.ya - g.m0 * L) / (L * L) : 0;
    const contY = i > 0 && Math.abs(g.ya - prevEnd) < 1e-9, contM = i > 0 && Math.abs(m1 - prevSlope) < 1e-9;
    const sec = { kind: 'u', f: '', end: n3(g.tb), s0: { inh: true, e: '0' }, v0: { inh: true, e: '0' }, a: '0', blend: !!g.blend };
    if (q === 's') {
      sec.s0 = { inh: contY, e: sv(g.ya) }; sec.v0 = { inh: contM && contY, e: sv(m1, 'v') }; sec.a = sv(2 * c2, 'a');
    } else if (q === 'v') {
      sec.s0 = { inh: i > 0, e: sv(d.s0) };
      if (c2 === 0) { sec.v0 = { inh: contY, e: sv(g.ya, 'v') }; sec.a = sv(m1, 'a'); }
      else { sec.kind = 'v'; sec.f = poly(toV(g.ya, 'v'), toV(m1, 'v'), toV(c2, 'v'), g.ta); }
    } else {
      sec.s0 = { inh: i > 0, e: sv(d.s0) }; sec.v0 = { inh: i > 0, e: sv(d.v0, 'v') };
      if (c2 === 0 && Math.abs(m1) < 1e-12) sec.a = sv(g.ya, 'a');
      else { sec.kind = 'a'; sec.f = poly(toV(g.ya, 'a'), toV(m1, 'a'), toV(c2, 'a'), g.ta); }
    }
    prevEnd = g.yb; prevSlope = g.type === 'para' ? m1 + 2 * c2 * L : m1;
    return sec;
  });
  const n = addMotion('eq', { secs, ff: { ...DEF_FF } }, false);
  toast(T('conv_done', letterOf(n))); activate(n);
}
function useAsTarget(m) {
  const W = worldOfMotion(m); if (!W) return;
  CH.custom = { M: W, q: 's', L: letterOf(m) };
  setSrc('chal'); setTarget('custom'); renderTargets();
}
function renderMeet() {
  const box = $('#meetBox'); if (!box) return;
  const am = activeMotion(), show = f('two') && S.src !== 'chal' && S.motions.some(m => m !== am && !allHid(m)) && !allHid(am);
  box.hidden = !show;
  $('#meetList').textContent = !MEET.length ? T('meet_none') : MEET.map(m => T('meet_at', m.L, fx(m.t), S.Q, fx(m.s))).join('\n');
}
function buildDragFF() {
  const host = $('#dragFF'); host.innerHTML = '';
  dragFFtg = toggle(host, { key: 'throw', sub: 'throw_s', icon: 'sports_handball', get: () => S.thr.on, set: v => { S.thr.on = v; dirty = true; save(); } });
}

/* ---------------- editing the samples of a recording, in the drawing panel */
const recUI = {};
function buildRecTools() {
  recUI.tool = seg($('#rtTool'), [{ v: 'nudge', icon: 'swap_vert', text: T('rt_nudge'), title: T('rt_nudge_t') }, { v: 'pen', icon: 'gesture', text: T('rt_pen'), title: T('rt_pen_t') }], S.draw.rtool, v => { S.draw.rtool = v; save(); });
  const host = $('#rtRad'); host.innerHTML = '';
  recUI.rad = slider(host, { id: 'rtR', label: T('rt_radius'), min: 0, max: 30, step: 1, get: () => S.draw.radius, set: v => { S.draw.radius = v; drUI.rad && drUI.rad.sync(); save(); }, fmt: v => (v === 0 ? T('rt_single') : '± ' + v + ' · ' + fx(v * REC_DT) + ' s') });
}
let recBase = null, recGrab = null;
/* s is edited directly; an edit of v or a is integrated, so the positions after it follow */
function recEditDown(q, t, yv) {
  const m = editingRec(); if (!m) return;
  undo.push(Float64Array.from(m.data.s)); if (undo.length > 40) undo.shift();
  const n = m.data.s.length, k = clamp(Math.round(t / REC_DT), 0, n - 1);
  const M = recModel(m), pc = M.pieces[0];
  recBase = Float64Array.from(m.data.s);
  recGrab = { q, k, y0: toW(yv, q), last: k, baseQ: q === 's' ? recBase : Float64Array.from(pc[q]), D: new Float64Array(n) };
  if (S.draw.rtool === 'pen') recEditMove(t, yv, true);
}
function recEditMove(t, yv, first) {
  const m = editingRec(), G = recGrab; if (!m || !G) return;
  const s = m.data.s, n = s.length, k = clamp(Math.round(t / REC_DT), 0, n - 1), y = toW(yv, G.q), D = G.D;
  if (S.draw.rtool === 'nudge') {
    const d = y - G.y0, R = S.draw.radius, c = G.k;
    D.fill(0);
    for (let j = Math.max(0, c - R); j <= Math.min(n - 1, c + R); j++) { const u = R ? Math.abs(j - c) / (R + 1) : 0; D[j] = d * (R ? (1 - u * u) ** 2 : 1); }
    applyD(m, G);
  } else { // redraw: the samples under the pointer take its value
    if (!G.tgt) { G.tgt = new Float64Array(n).fill(NaN); G.pts = []; }
    const a = first ? k : G.last, ya = first ? y : G.lastY;
    for (let j = Math.min(a, k); j <= Math.max(a, k); j++) G.tgt[j] = a === k ? y : ya + (y - ya) * (j - a) / (k - a);
    G.last = k; G.lastY = y; G.pts.push([t, yv]);
    for (let j = 0; j < n; j++) if (isFinite(G.tgt[j])) D[j] = G.tgt[j] - G.baseQ[j];
    applyD(m, G);
    if (G.q !== 's') { // v and a are read through the smoothing: correct twice so the curve lands on the stroke
      for (let it = 0; it < 2; it++) {
        const Q = recModel(m).pieces[0][G.q];
        for (let j = 0; j < n; j++) if (isFinite(G.tgt[j])) D[j] += G.tgt[j] - Q[j];
        applyD(m, G);
      }
    }
  }
}
/* s changes by D directly; v by D integrated once, a twice, so everything after the edit follows */
function applyD(m, G) {
  const s = m.data.s, n = s.length, D = G.D;
  if (G.q === 's') for (let j = 0; j < n; j++) s[j] = recBase[j] + D[j];
  else {
    let dv = D;
    if (G.q === 'a') { dv = new Float64Array(n); for (let j = 1; j < n; j++) dv[j] = dv[j - 1] + 0.5 * (D[j - 1] + D[j]) * REC_DT; }
    let ds = 0; s[0] = recBase[0];
    for (let j = 1; j < n; j++) { ds += 0.5 * (dv[j - 1] + dv[j]) * REC_DT; s[j] = recBase[j] + ds; }
  }
  touchRec(m);
}
function touchRec(m) { m.ver++; m.edited = true; statsKey = ''; meetKey = ''; dirty = true; }

/* ---------------- export */
const expDlg = $('#expDlg');
const inSandbox = () => !/^https?:$/.test(location.protocol) || /claude/.test(location.hostname);
function csvText() {
  const mm = models(), list = [...(mm.Mv ? [{ M: mm.Mv, L: mm.L }] : []), ...mm.others.map(o => ({ M: o.Mv, L: o.L }))];
  const Tm = Math.max(0, ...list.map(o => o.M.T)), dt = Tm <= 12 ? 0.05 : 0.1, many = list.length > 1;
  const sep = LANG === 'it' ? ';' : ',', f4 = v => (isNum(v) ? (LANG === 'it' ? v.toFixed(4).replace('.', ',') : v.toFixed(4)) : '');
  const head = ['t (s)'];
  for (const o of list) { const sfx = many ? '_' + o.L : ''; head.push(S.Q + sfx + ' (m)', 'v' + sfx + ' (m/s)', 'a' + sfx + ' (m/s²)'); }
  const rows = [head.join(sep)];
  for (let t = 0; t <= Tm + 1e-9; t += dt) {
    const r = [f4(t)];
    for (const o of list) { const q = t <= o.M.T + 1e-9 ? o.M.at(t) : [NaN, NaN, NaN]; r.push(f4(q[0]), f4(q[1]), f4(q[2])); }
    rows.push(r.join(sep));
  }
  return rows.join('\n');
}
function pngCanvas() {
  const parts = [trk, plots.s.cv, ...(f('gV') ? [plots.v.cv] : []), ...(f('gA') ? [plots.a.cv] : [])].filter(c => c.width && c.offsetParent);
  const W = Math.max(...parts.map(c => c.width)), gap = 12, H = parts.reduce((a, c) => a + c.height + gap, gap);
  const out = document.createElement('canvas'); out.width = W + 2 * gap; out.height = H;
  const c = out.getContext('2d'); c.fillStyle = C().surface; c.fillRect(0, 0, out.width, out.height);
  let y = gap; for (const p of parts) { c.drawImage(p, gap, y); y += p.height + gap; }
  return out;
}
function openExport() {
  if (!model() && !models().others.length) { toast(T('no_motion')); return; }
  $('#csvOut2').value = csvText();
  const cv = pngCanvas(); $('#pngOut').src = cv.toDataURL('image/png'); $('#pngOut')._cv = cv;
  $$('.dl', expDlg).forEach(b => { b.hidden = inSandbox(); });
  expDlg.showModal();
}
$('#expBtn').onclick = openExport;
$('#copyCsv').onclick = () => { const ta = $('#csvOut2'); try { navigator.clipboard.writeText(ta.value).then(() => toast(T('copied')), () => { ta.select(); toast(T('copy_manual')); }); } catch (e) { ta.select(); toast(T('copy_manual')); } };
$('#copyPng').onclick = () => {
  const cv = $('#pngOut')._cv; if (!cv) return;
  cv.toBlob(b => { try { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => toast(T('copied')), () => toast(T('png_manual'))); } catch (e) { toast(T('png_manual')); } });
};
function download(name, href) { const a = h('a', { href, download: name }); document.body.append(a); a.click(); a.remove(); }
$('#dlCsv').onclick = () => download('motus1d-lab.csv', URL.createObjectURL(new Blob([csvText()], { type: 'text/csv' })));
$('#dlPng').onclick = () => download('motus1d-lab.png', $('#pngOut').src);

/* ---------------- authoring: which features a shared link offers, and its QR code */
let shareFeats = null;
function shareCustom() {
  if (!shareFeats) return null;
  const lv = featsFor(S.level);
  return ALL.every(k => lv.has(k) === shareFeats.has(k)) ? null : [...shareFeats];
}
function buildFeatBox() {
  shareFeats = new Set(F);
  const host = $('#featBox'); host.innerHTML = '';
  for (const [g, keys] of FEAT_GROUPS) {
    host.append(h('p', { class: 'note', text: T(g) }));
    const wrap = h('div', { class: 'fchips' });
    for (const k of keys) {
      const b = h('button', { class: 'chip' + (shareFeats.has(k) ? ' on' : ''), type: 'button', text: T('ft_' + k), 'aria-pressed': String(shareFeats.has(k)) });
      b.onclick = () => { if (shareFeats.has(k)) shareFeats.delete(k); else shareFeats.add(k); b.classList.toggle('on', shareFeats.has(k)); b.setAttribute('aria-pressed', String(shareFeats.has(k))); };
      wrap.append(b);
    }
    host.append(wrap);
  }
}
function drawQR(cv, text, px) {
  let q;
  try { q = qrcode(0, 'L'); q.addData(text); q.make(); } catch (e) { return 0; }
  const n = q.getModuleCount(), quiet = 4, size = n + 2 * quiet, k = Math.max(1, Math.floor(px / size));
  cv.width = cv.height = size * k;
  const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) c.fillRect((col + quiet) * k, (r + quiet) * k, k, k);
  return n;
}
$('#qrBig').onclick = () => {
  const link = $('#linkOut').value; if (!link) return;
  drawQR($('#qrCvBig'), link, Math.min(innerWidth, innerHeight) * 0.8);
  $('#qrTask').textContent = $('#taskIn').value.trim();
  $('#qrDlg').showModal();
};

/* ---------------- scenes dialog */
const dateTxt = ts => new Date(ts).toLocaleString(LANG === 'it' ? 'it-IT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function renderScenes() {
  const host = $('#sceneList'); if (!host) return;
  host.innerHTML = '';
  $('#sceneCur').textContent = sceneName(curScene());
  const ni = $('#sceneName'); if (document.activeElement !== ni) { ni.value = curScene().name || ''; ni.placeholder = sceneName(curScene()); }
  for (const sc of [...SC.list].sort((a, b) => b.updated - a.updated)) {
    const on = sc.id === SC.cur;
    const main = h('button', { class: 'motmain', type: 'button', 'aria-current': on ? 'true' : null }, msIcon(on ? 'folder_open' : 'folder'),
      h('span', { class: 'mname', text: sceneName(sc) }), h('small', { class: 'mdate', text: T('scene_meta', sc.n ?? '–', dateTxt(sc.updated)) }));
    main.onclick = () => { if (!on) { openScene(sc.id); $('#sceneDlg').close(); } };
    const del = h('button', { class: 'mini del', type: 'button', title: T('scene_del'), 'aria-label': T('scene_del') }, msIcon('delete'));
    del.onclick = () => {
      if (del.classList.contains('arm')) { deleteScene(sc.id); return; }
      del.classList.add('arm'); del.firstChild.textContent = 'delete_forever';
      setTimeout(() => { del.classList.remove('arm'); del.firstChild.textContent = 'delete'; }, 3000);
    };
    host.append(h('div', { class: 'mot' + (on ? ' on' : '') }, main, del));
  }
  $('#sceneMax').hidden = SC.list.length < MAX_SCENES - 5;
  $('#sceneMax').textContent = T('scenes_max', MAX_SCENES);
}
function openScenes() { doSave(); renderScenes(); $('#sceneDlg').showModal(); }
$('#scenesBtn').onclick = openScenes;
$('#scenesBtn2').onclick = openScenes;
$('#mScenes').onclick = () => { menu.hidden = true; openScenes(); };
$('#sceneNew').onclick = () => { newScene(false); $('#sceneDlg').close(); };
$('#sceneDup').onclick = () => { newScene(true); $('#sceneDlg').close(); };
$('#sceneName').addEventListener('input', e => { curScene().name = e.target.value.slice(0, 60); saveIndex(); renderScenes(); });

/* ================================================================ share */
const shareDlg = $('#shareDlg');
/* links point to the page they were made on; localStorage 'motus1d.base' can force another address */
function getBase() {
  try { const b = localStorage.getItem('motus1d.base'); if (b) return b; } catch (e) { /* */ }
  return location.href.split('#')[0];
}
let shareLock = false;
function snapshot() {
  const o = {
    v: 2, level: S.level, locked: shareLock, task: $('#taskIn').value.trim(), src: S.src === 'chal' ? 'eq' : S.src, motions: S.motions.map(m => packMotion(m, true)), cur: S.cur,
    custom: shareCustom(), useTau: S.useTau, blendW: S.blendW, dec: S.dec,
    params: {}, an: S.an, show: S.show, Q: S.Q, smooth: S.smooth, chal: { id: S.chal.id === 'custom' ? 'c1' : S.chal.id }, frame: S.frame, thr: S.thr,
    pred: { on: S.pred.on, q: S.pred.q }, draw: { tool: S.draw.tool, snap: S.draw.snap, Tmax: S.draw.Tmax }
  };
  for (const n of allVars()) if (S.params[n]) o.params[n] = S.params[n];
  // leave out what this setup does not use, so the link (and its QR code) stays short
  if (!S.thr.on) delete o.thr;
  if (!S.frame.vert && S.frame.o === 0 && S.frame.dir === 1) delete o.frame;
  if (o.custom) { const lv = featsFor(S.level); o.cx = { m: ALL.filter(k => lv.has(k) && !o.custom.includes(k)), p: o.custom.filter(k => !lv.has(k)) }; }
  delete o.custom;
  if (!o.task) delete o.task;
  if (!S.pred.on) delete o.pred;
  return o;
}
function openShare(mode) {
  $('#shareMake').hidden = mode !== 'make'; $('#shareImport').hidden = mode !== 'import';
  $('#shareOut').hidden = true; $('#importErr').textContent = '';
  if (mode === 'make') {
    $('#taskIn').value = S.task || ''; $('#baseIn').value = getBase();
    const host = $('#lockTg'); host.innerHTML = '';
    toggle(host, { key: 'lock', sub: 'lock_s', get: () => shareLock, set: v => { shareLock = v; } });
    buildFeatBox();
  }
  shareDlg.showModal();
}
$('#shareBtn').onclick = () => openShare('make');
$('#shareBtn2').onclick = () => openShare('make');
$('#importBtn').onclick = () => openShare('import');
$('#mkLink').onclick = async () => {
  const base = $('#baseIn').value.trim() || location.href.split('#')[0];
  try { localStorage.setItem('motus1d.base', base); } catch (e) { /* */ }
  try {
    const code = await encodeState(snapshot());
    const link = base.split('#')[0] + '#' + code;
    $('#linkOut').value = link; $('#shareOut').hidden = false;
    $('#linkLen').textContent = T('link_len', link.length);
    const n = drawQR($('#qrCv'), link, 220);
    $('#qrCv').hidden = !n; $('#qrBig').hidden = !n; $('#qrNote').textContent = !n ? T('qr_long') : n > 81 ? T('qr_dense') : T('qr_ok');
  } catch (e) { toast(T('share_fail')); }
};
$('#copyLink').onclick = () => {
  const inp = $('#linkOut');
  const fallback = () => { inp.focus(); inp.select(); toast(T('copy_manual')); };
  try { navigator.clipboard.writeText(inp.value).then(() => toast(T('copied')), fallback); } catch (e) { fallback(); }
};
$('#doImport').onclick = async () => {
  try { const o = await decodeState($('#importIn').value); applyShared(o); shareDlg.close(); toast(T('imported')); }
  catch (e) { $('#importErr').textContent = T('import_bad'); }
};
function applyShared(o) {
  if (o && o.act) { if (PDC) PDC.fromLink(o.act); return; } // a link to an activity opens it
  if (o.draw && o.draw.halved && o.draw.segs) for (const q in o.draw.segs) for (const g of o.draw.segs[q] || []) if (g && g.type === 'free') g.half = true; // links from the first version
  applyState(o, true);
  S.t = 0; S.playing = false; CH.TM = null;
  renderAll();
  $('#task').hidden = !S.task; $('#taskTxt').textContent = S.task;
  save();
}

function applyHand() { $('#arena').classList.toggle('lefty', S.hand === 'l'); dirty = true; }
/* ================================================================ help */
function renderHelp() {
  const b = $('#helpBody'); b.innerHTML = '';
  const p = k => h('p', { text: T(k) });
  const leg = rows => { const g = h('div', { class: 'legend' }); for (const [ic, k, isSvg] of rows) g.append(h('span', { class: 'k', html: isSvg ? ICON[ic] : `<span class="ms">${ic}</span>` }), h('span', { text: T(k) })); return g; };
  b.append(h('h2', { text: T('h_title') }), p('h_intro'),
    h('h3', { text: T('h_src') }), leg([['function', 'src_eq_t'], ['draw', 'src_draw_t'], ['touch_app', 'src_drag_t'], ['sports_score', 'src_chal_t'], ['grid_view', 'h_gal']]),
    h('h3', { text: T('h_secs') }), p('h_secs_p'), leg([['inherit', 'inherit_t', 1], ['j_smooth', 'js_smooth_l', 1], ['j_acorner', 'js_acorner_l', 1], ['j_kink', 'js_kink_l', 1], ['j_jump', 'js_jump_l', 1], ['j_coll', 'js_coll_l', 1], ['blend', 'blend_l', 1]]),
    h('h3', { text: T('h_expr') }), p('h_expr_p'),
    h('h3', { text: T('h_draw') }), p('h_draw_p'), leg([['gesture', 'tool_pen'], ['line', 'tool_line', 1], ['para', 'tool_para', 1], ['open_with', 'tool_move']]),
    h('h3', { text: T('h_tools') }), leg([['tan', 'tan_l', 1], ['sec', 'sec_l', 1], ['area', 'area_l', 1], ['avg', 'avg_l', 1], ['r_true', 'm_true', 1], ['r_left', 'm_left', 1], ['r_mid', 'm_mid', 1], ['r_right', 'm_right', 1], ['r_trap', 'm_trap', 1], ['psychology', 'pred_l']]),
    p('h_handles'),
    h('h3', { text: T('h_pick') }), p('h_pick_p'), leg([['arrow_selector_tool', 'pick_t'], ['check', 'edit_done_t'], ['visibility_off', 'pk_hide'], ['radio_button_checked', 'pk_act'], ['edit', 'pk_edit'], ['content_copy', 'mot_dup_t'], ['delete', 'mot_del_t']]),
    h('h3', { text: T('h_pdc') }), p('h_pdc_p'),
    h('h3', { text: T('h_frame') }), p('h_frame_p'),
    h('h3', { text: T('h_drag') }), p('h_drag_p'),
    h('h3', { text: T('h_share') }), p('h_share_p'),
    h('h3', { text: T('h_keys') }), h('p', { html: T('h_keys_p') }));
}
$('#helpBtn').onclick = () => $('#helpDlg').showModal();

/* ================================================================ keys */
addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,[contenteditable]')) return; // text fields keep their own undo
  if ((e.metaKey || e.ctrlKey) && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); histGo(e.shiftKey ? 1 : -1); }
    else if (k === 'y' && e.ctrlKey) { e.preventDefault(); histGo(1); }
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); $('#playBtn').click(); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const M = model(); if (!M) return; S.playing = false; ballFree = false; S.t = clamp(S.t + (e.key === 'ArrowRight' ? 1 : -1) / 30, 0, M.T); dirty = true; }
  else if ((e.key === 'r' || e.key === 'R') && !e.repeat && S.src === 'drag') { if (REC.on) stopRec(false); else { startRec(); REC.keyHold = true; REC.startedAt = performance.now(); } }
  else if ((e.key === 'z' || e.key === 'Z') && S.src === 'draw') $('#drUndo').click();
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.src === 'draw' && S.draw.tool === 'move' && lastNode && !editingRec()) { e.preventDefault(); const hd = handles(S.draw.segs[lastNode.q]).find(x => x.i === lastNode.i && x.end === lastNode.end); if (hd) delNode(lastNode.q, hd); }
  else if (e.key === 'Escape') { if (!pickEl.hidden) closePick(); else if (PK.armed) arm(false); else if (editingRec() && S.src === 'draw') exitEdit(); }
});
addEventListener('keyup', e => { if ((e.key === 'r' || e.key === 'R') && REC.keyHold) { REC.keyHold = false; if (REC.on && performance.now() - REC.startedAt > 450) stopRec(false); } });
addEventListener('resize', () => { dirty = true; });

/* ================================================================ boot */
function renderAll() {
  applyI18n(document);
  $('#langBtn').textContent = LANG.toUpperCase(); $('#mLangVal').textContent = LANG === 'it' ? 'Italiano' : 'English';
  setDec(S.dec);
  buildToolbar(); buildAnalysis(); buildSettings(); buildFF(); buildDraw(); buildRecTools(); buildDragFF();
  setSrc(S.src); setTab(S.tab);
  renderSections(); recompile(); rebuildFF(); rebuildDraw(); renderMotions(); renderTargets(); renderHelp(); syncSmooth(); renderScenes();
  $('#blendR').value = S.blendW; $('#blendL').textContent = num(S.blendW, 2) + ' s';
  applyFeatures(); syncSettings(); syncAnalysis(); applyTheme();
  statsKey = ''; dirty = true;
  if (PDC) PDC.refresh();
}
window.motus = { S, REC, CH, plots, models, get ball() { return ball; } }; // for checks from the console
async function boot() {
  load();
  PDC = initPDC({ toast, getBase, onClose: () => { dirty = true; } });
  $('#actBtn').onclick = () => PDC.home();
  $('#mAct').onclick = () => { menu.hidden = true; PDC.home(); };
  const hash = location.hash.slice(1);
  renderAll();
  if (/^m1[zj]/i.test(hash)) {
    try { applyShared(await decodeState(hash)); } catch (e) { toast(T('import_bad')); }
  } else if (S.task) { $('#task').hidden = false; $('#taskTxt').textContent = S.task; }
  clearTimeout(saveT); saveT = 0; histReset();
  requestAnimationFrame(frame);
  // canvases draw text too: redraw once the fonts have arrived
  if (document.fonts) { document.fonts.ready.then(() => { dirty = true; vtKey = ''; }); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { dirty = true; }); }
}
boot();
