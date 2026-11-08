import { CFG, FEATURES, LEVEL_MAX } from './config.js';
import { World } from './physics.js';
import { Recorder, trueReadings, instrumentValue, buildSeries, hiddenMasses, scaleReading } from './sensors.js';
import { polyfit } from './fit.js';
import { Scene } from './scene.js';
import { Graphs } from './graphs.js';
import { ic, mountIcons } from './icons.js';
import { t, setLang, getLang } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const store = {
  get(k, d) { try { const v = localStorage.getItem('cartslab.' + k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cartslab.' + k, v); } catch { /* ignora */ } },
};

// ---------------------------------------------------------------- stato
const world = new World();
const S = {
  f: 30, T: 5, noise: 0.5, inv: [false, false], speed: 1,
  runs: [], activeId: null, runCount: 0, fits: [], nextFit: 1, nextId: 1,
  tab: 'setup', launchV: [0.4, 0], selSensors: [true, true],
  showVec: false, showTruth: false, align: false, joined: store.get('joined', '1') === '1',
  replayOn: false,
  level: 3, trig: { on: false, thr: CFG.TRIG_DEFAULT_MM },
  hidden: false, revealed: false, seed: 1 + Math.floor(Math.random() * 9999), weighs: [], lastW: null,
};
const has = (f) => S.level >= (FEATURES[f] ?? 1);
let armed = null;           // trigger armato: distanze di partenza dei sensori
let rec = null;             // registrazione in corso
let dirty = true;
const pending = [];         // azioni programmate nel tempo del mondo
const schedule = (delay, fn) => pending.push({ at: world.time + delay, fn });

// ---------------------------------------------------------------- oggetti principali
const scene = new Scene({
  canvas: $('#scene'), world,
  onGrab: () => { exitReplay(); },
  onRelease: (id) => { const c = world.carts[id]; if (!rec && Math.abs(c.v) < 0.03) world.home[id] = c.x; },
});
const graphs = new Graphs({
  canvasX: $('#gx'), canvasV: $('#gv'),
  onCursor: () => { if (!rec) enterReplay(); updateReadout(); },
  onSelection: () => { updateSelBars(); },
  onView: () => {},
});
graphs.joined = S.joined;

// ---------------------------------------------------------------- dati derivati
const activeRun = () => S.runs.find((r) => r.id === S.activeId) || null;
function series(run) {
  const key = S.inv.join();
  if (run._k !== key) { run._ser = buildSeries(run, S.inv); run._k = key; run._tr = null; }
  return run._ser;
}
function truthSeries(run) {
  series(run);
  if (!run._tr) {
    const T = run.truth, sg = S.inv.map((i) => (i ? -1 : 1));
    run._tr = {
      t: T.t,
      x: [T.dT[0].map((q) => sg[0] * q), T.dT[1].map((q) => sg[1] * q)],
      v: [T.vT[0].map((q) => sg[0] * q), T.vT[1].map((q) => sg[1] * q)],
    };
  }
  return run._tr;
}
function offsetOf(run) {
  if (!S.align) return 0;
  const first = run.crop ? (run.t.find((q) => q >= run.crop[0] - 1e-9) ?? 0) : (run.t[0] ?? 0);
  return -first;
}
const signs = () => S.inv.map((i) => (i ? -1 : 1));

function buildVM() {
  const vm = [], sg = signs();
  for (const run of S.runs) {
    if (!run.visible && run.id !== S.activeId) continue;
    if (!run.visible) continue;
    const ser = series(run);
    vm.push({
      id: run.id, t: run.t, x: [ser[0].x, ser[1].x], v: [ser[0].v, ser[1].v], crop: run.crop, offset: offsetOf(run),
      active: run.id === S.activeId && !rec, truth: run.id === S.activeId && S.showTruth ? truthSeries(run) : null,
      deadLine: [sg[0] * CFG.DEAD, sg[1] * CFG.DEAD],
    });
  }
  if (rec) {
    const ser = buildSeries({ t: rec.t, d: rec.d }, S.inv);
    vm.push({ id: 'live', t: rec.t, x: [ser[0].x, ser[1].x], v: [ser[0].v, ser[1].v], crop: null, offset: 0, active: true, truth: null, fixedT: [0, rec.T], deadLine: [sg[0] * CFG.DEAD, sg[1] * CFG.DEAD] });
  }
  return vm;
}

function fitLabel(f, fit) {
  const c = fit.coef;
  if (f.graph === 'x') return f.deg === 1 ? `v = ${fmt(c[1])} m/s` : `a = ${fmt(2 * c[2])} m/s²`;
  if (f.deg === 0) return `v = ${fmt(c[0])} m/s`;
  return `a = ${fmt(c[1])} m/s²`;
}
function computeFits() {
  const run = activeRun();
  if (!run || rec) return [];
  const ser = series(run), off = offsetOf(run), out = [];
  for (const f of S.fits) {
    if (f.runId !== run.id) continue;
    const arr = f.graph === 'x' ? ser[f.sensor].x : ser[f.sensor].v;
    const fit = polyfit(run.t, arr, f.deg, f.t0, f.t1);
    if (!fit) continue;
    out.push({ id: f.id, graph: f.graph, sensor: f.sensor, fit, offset: off, label: fitLabel(f, fit), def: f });
  }
  return out;
}
let fitCache = [];

function refreshGraphs() {
  fitCache = computeFits();
  graphs.emptyMsg = armed ? t('graph_armed') : t('graph_empty');
  graphs.setModel(buildVM(), fitCache);
  graphs.draw();
  $('#uncropBtn').hidden = !(activeRun()?.crop);
  updateReadout(); updateSelBars();
}

// ---------------------------------------------------------------- masse nascoste e bilancia
function applyMasses() {
  const m = S.hidden ? hiddenMasses(S.seed) : { A: CFG.BASE_MASS.A, B: CFG.BASE_MASS.B };
  world.setBase('A', m.A); world.setBase('B', m.B);
  world.hideMass = S.hidden && !S.revealed;
}
function resetWeighs() { S.weighs = []; S.lastW = null; }
function weigh(id) {
  const c = world.carts[id], m = world.mass(c);
  const g = scaleReading(m, Math.random);
  const ex = [world.extra.m1 === id ? '+1 kg' : '', world.extra.m05 === id ? '+0.5 kg' : ''].filter(Boolean).join(' ');
  S.lastW = { id, g, ex };
  S.weighs.push(S.lastW); if (S.weighs.length > 12) S.weighs.shift();
}

// ---------------------------------------------------------------- registrazione
function startRecording() {
  if (rec) return;
  exitReplay();
  rec = new Recorder({ f: S.f, T: S.T, sigma: S.noise / 1000, seed: (Math.random() * 2 ** 31) | 0 });
  rec.begin(world);
  graphs.cursorA = graphs.cursorB = null; graphs.sel = null; graphs.auto = true;
  dirty = true; syncToolbar();
}
function finishRecording() {
  if (!rec) return;
  const r = rec; rec = null; pending.length = 0;
  S.runCount++;
  const run = r.toRun(S.nextId++, t('run') + ' ' + S.runCount);
  if (r.t.length) run.T = r.t[r.t.length - 1];
  S.runs.push(run); S.activeId = run.id;
  while (S.runs.length > 8) { const old = S.runs.find((q) => q.id !== S.activeId); S.runs.splice(S.runs.indexOf(old), 1); S.fits = S.fits.filter((f) => f.runId !== old.id); }
  graphs.auto = true; dirty = true; syncToolbar(); renderPane();
}
function arm() {
  exitReplay();
  const r = trueReadings(world);
  armed = { d0: [r.d[0], r.d[1]] };
  graphs.cursorA = graphs.cursorB = null; graphs.sel = null;
  dirty = true; syncToolbar(); toast(t('armed_toast'));
}
function disarm() { if (!armed) return; armed = null; dirty = true; syncToolbar(); }
function checkTrigger() {
  const r = trueReadings(world);
  for (const s of [0, 1]) {
    if (Math.abs(r.d[s] - armed.d0[s]) * 1000 > S.trig.thr) { armed = null; startRecording(); return; }
  }
}
function stopOrStart() {
  if (rec) finishRecording();
  else if (armed) disarm();
  else if (S.trig.on && has('trigger')) arm();
  else startRecording();
}

function doLaunch() {
  const go = () => { for (const slot of [0, 1]) { const v = S.launchV[slot]; if (v) world.launch(world.order[slot], v); } };
  if (rec) go();
  else if (S.trig.on && has('trigger')) { if (!armed) arm(); go(); }
  else { startRecording(); schedule(0.3, go); }
}
function doFire() {
  const go = () => { for (const id of ['A', 'B']) world.fire(id); };
  if (rec) go();
  else if (S.trig.on && has('trigger')) { if (!armed) arm(); go(); }
  else { startRecording(); schedule(0.3, go); }
}
function doHome() { disarm(); world.restore(); pending.length = 0; exitReplay(); dirty = true; }

// ---------------------------------------------------------------- replay: i cursori muovono i carrelli
function nearestIdx(arr, x) { let b = 0, bd = Infinity; for (let i = 0; i < arr.length; i++) { const d = Math.abs(arr[i] - x); if (d < bd) { bd = d; b = i; } } return b; }
function enterReplay() {
  const run = activeRun();
  if (!run || rec || graphs.cursorA == null) return;
  const T = run.truth, tr = graphs.cursorA - offsetOf(run);
  const i = clamp(Math.round(tr / CFG.TRUTH_DT), 0, T.t.length - 1);
  scene.replay = { t: tr, x: { A: T.cx.A[i], B: T.cx.B[i] }, der: { A: T.cd.A[i], B: T.cd.B[i] } };
  S.replayOn = true; $('#liveBtn').hidden = false;
}
function exitReplay() { if (!S.replayOn) return; S.replayOn = false; scene.replay = null; $('#liveBtn').hidden = true; }

// ---------------------------------------------------------------- UI: barra, grafici, tabella
function syncToolbar() {
  const busy = !!rec || !!armed;
  $('#recBtn').classList.toggle('on', busy);
  $('#recIcon').innerHTML = ic(busy ? 'stop' : S.trig.on && has('trigger') ? 'bolt' : 'rec');
  $('#recLbl').textContent = rec ? t('stop') : armed ? t('armed') : S.trig.on && has('trigger') ? t('arm') : t('record');
  $$('[data-feat]').forEach((el) => { el.hidden = !has(el.dataset.feat); });
  $('#lvlBtn').textContent = 'L' + S.level;
  $('#lvlBtn').title = `${t('lvl_t')}: ${t('lvl_' + S.level)}`;
  $('#fSel').value = String(S.f); $('#TSel').value = String(S.T);
  $$('#speedSeg button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === S.speed));
  $$('#toolSeg button').forEach((b) => b.classList.toggle('on', b.dataset.tool === graphs.tool));
  $$('#viewSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.view === 'joined') === graphs.joined));
  $('#gstack').dataset.tool = graphs.tool;
  $('#bBtn').classList.toggle('on', graphs.useB);
  $('#truthBtn').classList.toggle('on', S.showTruth);
}
function updateSelBars() {
  const show = !!graphs.sel && !rec && !!activeRun();
  $('#barx').hidden = !show; $('#barv').hidden = !show;
  $$('.selbar [data-sens]').forEach((b) => b.classList.toggle('on', S.selSensors[Number(b.dataset.sens)]));
}
function updateReadout() {
  const el = $('#readout'), e = graphs.active();
  if (!e || graphs.cursorA == null) { el.innerHTML = `<p class="hint">${t('readout_hint')}</p>`; return; }
  const iA = graphs._nearestIdx(e, graphs.cursorA), hasB = graphs.useB && graphs.cursorB != null;
  const iB = hasB ? graphs._nearestIdx(e, graphs.cursorB) : 0;
  const rows = [['x', 0, 'm', 'm/s'], ['x', 1, 'm', 'm/s'], ['v', 0, 'm/s', 'm/s²'], ['v', 1, 'm/s', 'm/s²']];
  const tA = e.t[iA] + e.offset, tB = hasB ? e.t[iB] + e.offset : 0;
  let h = `<table class="rt"><tr><th></th><th>A · t=${fmt(tA)} s</th>`;
  if (hasB) h += `<th>B · t=${fmt(tB)} s</th><th>Δ</th><th>Δ/Δt</th>`;
  h += '</tr>';
  for (const [k, s, u, us] of rows) {
    const a = e[k][s][iA];
    h += `<tr><td class="h"><i style="background:var(--s${s + 1})"></i>${k === 'x' ? 'x' : 'v'} · S${s + 1}</td><td>${Number.isFinite(a) ? fmt(a) + ' ' + u : '<span class="nodata">–</span>'}</td>`;
    if (hasB) {
      const b = e[k][s][iB], d = b - a, dt = tB - tA;
      h += `<td>${Number.isFinite(b) ? fmt(b) + ' ' + u : '–'}</td><td>${Number.isFinite(d) ? fmt(d) + ' ' + u : '–'}</td><td>${Number.isFinite(d) && Math.abs(dt) > 1e-9 ? fmt(d / dt) + ' ' + us : '–'}</td>`;
    }
    h += '</tr>';
  }
  el.innerHTML = h + '</table>';
}
function sensorTexts() {
  const sg = signs();
  if (scene.replay) {
    const run = activeRun(); if (!run) return ['', ''];
    const i = nearestIdx(run.t, scene.replay.t);
    return [0, 1].map((s) => (Number.isFinite(run.d[s][i]) ? fmt(sg[s] * run.d[s][i], 3) + ' m' : '—'));
  }
  const tr = trueReadings(world);
  return [0, 1].map((s) => { const v = instrumentValue(tr.d[s], 0, null); return Number.isFinite(v) ? fmt(sg[s] * v, 3) + ' m' : '—'; });
}

// ---------------------------------------------------------------- pannello
const faceBadge = (face, id) => {
  if (face === 'spring') return ic('spring') + `<span>${t('f_spring')}</span>`;
  const pole = face === 'magnet' ? 'N' : (id === 'A' ? 'N' : 'S');
  return ic(face === 'velcro' ? 'velcro' : 'magnet') + `<span class="pole ${pole}">${pole}</span><span>${t(face === 'velcro' ? 'f_velcro' : 'f_magnet')}</span>`;
};
const seg = (items, cur, act, extra = '') =>
  `<div class="seg sm">${items.map(([v, label]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" data-act="${act}" ${extra} data-val="${v}">${label}</button>`).join('')}</div>`;

const tglBtn = (act, on, label, small, icon) => `<button class="tg" data-act="${act}" aria-pressed="${on}"><span class="txt">${ic(icon)}<span>${label}<small>${small}</small></span></span><span class="sw"></span></button>`;
const massTxt = (id) => (world.hideMass ? '?' : fmt(world.mass(world.carts[id]), 2));
function paneScale() {
  let h = `<h3 class="grp">${ic('scale')}${t('g_scale')}</h3>`;
  if (has('hidden')) {
    h += tglBtn('hidden', S.hidden, t('hidden_on'), t('hidden_s'), 'mass');
    if (S.hidden) {
      h += `<div class="row" style="margin:8px 0"><span class="grow">${t('seed')}</span><input class="numin" id="inSeed" type="number" min="1" max="9999" step="1" value="${S.seed}" data-in="seed" inputmode="numeric" title="${t('seed_t')}"><button class="mini" data-act="reseed" title="${t('seed_t')}">${ic('dice')}</button></div>`;
    }
  }
  const lw = S.lastW;
  h += `<div class="scalebox"><div class="lcd">${lw ? lw.g : '—'}<small>g</small></div><div style="display:flex;flex-direction:column;gap:6px">
    <button class="btn small" data-act="weigh" data-id="A">${ic('scale')}${t('weigh')} A</button>
    <button class="btn small" data-act="weigh" data-id="B">${ic('scale')}${t('weigh')} B</button></div></div>`;
  h += `<div class="wh">${S.weighs.length ? S.weighs.map((w) => `<span>${w.id} ${w.g} g${w.ex ? ' (' + w.ex + ')' : ''}</span>`).join('') : `<span class="nodata" style="border-style:dashed;font-weight:400">${t('no_weigh')}</span>`}</div>`;
  h += `<div class="row" style="margin:6px 0;gap:6px">${S.weighs.length ? `<button class="btn small" data-act="clearw">${ic('trash')}${t('clear_w')}</button>` : ''}${S.hidden ? `<button class="btn small" data-act="reveal">${ic(S.revealed ? 'eyeoff' : 'eye')}${t(S.revealed ? 'unreveal' : 'reveal')}</button>` : ''}</div>`;
  if (S.hidden && S.revealed) h += `<p class="note">m<sub>A</sub> = <b>${fmt(world.mass(world.carts.A), 3)}</b> kg · m<sub>B</sub> = <b>${fmt(world.mass(world.carts.B), 3)}</b> kg</p>`;
  return h + `<p class="note">${t('scale_note')}</p>`;
}
function paneSetup() {
  const pt = world.pairType();
  const typeLabel = { rep: t('pair_rep'), stick: t('pair_stick'), spring: t('pair_spring') }[pt.type];
  let h = `<h3 class="grp">${ic('cart')}${t('g_quick')}</h3><div class="presets">
    <button class="btn" data-act="preset" data-val="elastic">${ic('magnet')}${t('p_elastic')}</button>
    <button class="btn" data-act="preset" data-val="sticky">${ic('velcro')}${t('p_sticky')}</button>
    ${has('presets2') ? `<button class="btn" data-act="preset" data-val="spring">${ic('spring')}${t('p_spring')}</button>
    <button class="btn" data-act="preset" data-val="explosion">${ic('fire')}${t('p_explosion')}</button>` : ''}</div>
    <p class="note">${t('facing')}: <b>${typeLabel}</b></p>`;
  h += `<h3 class="grp">${ic('cart')}${t('g_carts')}</h3><div class="row" style="margin-bottom:8px"><button class="btn small" data-act="swap">${ic('swap')}${t('swap')}</button></div>`;
  for (const slot of [0, 1]) {
    const c = world.cartAt(slot), [fl, fr] = world.faces(c);
    h += `<div class="cart"><div class="hd"><span class="tile s${slot + 1}">${c.id}</span><b>${t(slot ? 'right' : 'left')}</b>
      <span class="grow"></span><button class="btn small" data-act="flip" data-id="${c.id}">${ic('flip')}${t('flip')}</button></div>
      <div class="faces" style="margin-top:6px">${faceBadge(fl, c.id)}<span>⟷</span>${faceBadge(fr, c.id)}</div>`;
    if (c.id === 'A' && has('plunger')) {
      h += `<div class="ctl"><div class="lbl"><span class="t">${ic('spring')}${t('plunger')}</span></div>
        ${seg([['blocked', t('pl_blocked')], ['active', t('pl_active')], ['loaded', t('pl_loaded')]], c.plungerMode, 'plunger', `data-id="A"`)}</div>`;
      if (c.plungerMode === 'loaded') h += `<div class="ctl"><div class="lbl"><span class="t">${t('level')}</span></div>${seg([[1, '1'], [2, '2'], [3, '3']], c.level, 'level', `data-id="A"`)}</div>`;
    }
    h += '</div>';
  }
  if (has('masses')) {
    h += `<h3 class="grp">${ic('mass')}${t('g_masses')}</h3>`;
    for (const [which, label] of [['m1', '+1 kg'], ['m05', '+0.5 kg']]) {
      h += `<div class="ctl"><div class="lbl"><span class="t">${label}</span></div>${seg([['', '—'], ['A', 'A'], ['B', 'B']], world.extra[which] || '', 'extra', `data-which="${which}"`)}</div>`;
    }
  }
  h += `<p class="note">m<sub>A</sub> = <b>${massTxt('A')}</b> kg · m<sub>B</sub> = <b>${massTxt('B')}</b> kg${world.hideMass ? ' · ' + t('mass_unknown') : ''}</p>`;
  if (has('scale')) h += paneScale();
  h += `<h3 class="grp">${ic('launch')}${t('g_launch')}</h3><p class="note">${t('launch_note')}</p>`;
  for (const slot of [0, 1]) {
    const c = world.cartAt(slot);
    h += `<div class="row" style="margin:6px 0"><span class="tile s${slot + 1}">${c.id}</span><span class="grow">${t(slot ? 'right' : 'left')}</span><input class="numin" id="vl${slot}" type="number" step="0.05" min="-1.5" max="1.5" value="${S.launchV[slot]}" data-in="vl${slot}" inputmode="decimal"> <span>m/s</span></div>`;
  }
  const dh = world.tiltMm, th = world.tiltDeg();
  if (has('rail') || has('tilt') || has('friction')) h += `<h3 class="grp">${ic('ruler')}${t('g_rail')}</h3>`;
  if (has('rail')) h += `<div class="ctl"><label for="inLen"><span class="t">${ic('ruler')}${t('length')}</span><b id="lbLen">${fmt(world.L, 2)} m</b></label><input id="inLen" type="range" min="0.6" max="2" step="0.05" value="${world.L}" data-in="len"></div>`;
  if (has('tilt')) h += `<div class="ctl"><label for="inTilt"><span class="t">${ic('tilt')}${t('tilt')}</span><b id="lbTilt">${dh > 0 ? '+' : ''}${dh} mm · ${fmt(th, 2)}°</b></label><input id="inTilt" type="range" min="-60" max="60" step="1" value="${dh}" data-in="tilt"></div>
    <p class="note">${t('tilt_note')}</p>`;
  if (has('friction')) h += `<div class="ctl"><label for="inMu"><span class="t">${ic('friction')}${t('friction')}</span><b id="lbMu">μ = ${fmt(world.mu, 4)} · a ≈ ${fmt(world.mu * CFG.G * 100, 1)} cm/s²</b></label><input id="inMu" type="range" min="0" max="30" step="0.5" value="${world.mu * 1000}" data-in="mu"></div>
    <p class="note">${t('friction_note')}</p>`;
  return h;
}
function paneSensors() {
  const tg = (s) => `<button class="tg" data-act="inv" data-s="${s}" aria-pressed="${S.inv[s]}"><span class="txt"><span class="dot s${s + 1}"></span>${ic('invert')}<span>${t('invert')} S${s + 1}<small>${t(S.inv[s] ? 'inv_on' : 'inv_off')}</small></span></span><span class="sw"></span></button>`;
  let h = '';
  if (has('invert')) h += `<h3 class="grp">${ic('invert')}${t('g_reference')}</h3>${tg(0)}${tg(1)}<p class="note">${t('invert_note')}</p>`;
  if (has('noise')) h += `<h3 class="grp">${ic('wave')}${t('g_noise')}</h3>
    <div class="ctl"><label for="inNoise"><span class="t">σ<sub>x</sub></span><b id="lbNoise">${fmt(S.noise, 1)} mm</b></label><input id="inNoise" type="range" min="0" max="3" step="0.1" value="${S.noise}" data-in="noise"></div>
    <p class="note">${t('noise_note')}</p>`;
  if (has('trigger')) h += `<h3 class="grp">${ic('bolt')}${t('g_trigger')}</h3>
    ${tglBtn('trig', S.trig.on, t('trig_on'), t('trig_on_s'), 'bolt')}
    <div class="ctl"><label for="inTrig"><span class="t">${t('trig_thr')}</span><b id="lbTrig">${S.trig.thr} mm</b></label><input id="inTrig" type="range" min="2" max="50" step="1" value="${S.trig.thr}" data-in="trigthr"></div>
    <p class="note">${t('trig_note')}</p>`;
  return h + `<h3 class="grp">${ic('sensor')}${t('g_sensor')}</h3>
    <p class="note">${t('sensor_note')}</p>`;
}
function describeFit(f, fit) {
  const c = fit.coef, se = fit.se || [], pm = (i, k = 1, d = 3) => (se[i] != null ? ` ± ${fmt(se[i] * k, d)}` : '');
  const L = [];
  if (f.graph === 'x') {
    L.push(['x(t₀)', `${fmt(c[0])} m`]);
    if (f.deg === 1) L.push(['v', `<b class="big">${fmt(c[1])}${pm(1)} m/s</b>`]);
    else { L.push(['v(t₀)', `${fmt(c[1])} m/s`]); L.push(['a', `<b class="big">${fmt(2 * c[2])}${pm(2, 2)} m/s²</b>`]); }
  } else if (f.deg === 0) L.push(['v̄', `<b class="big">${fmt(c[0])}${pm(0)} m/s</b>`]);
  else {
    L.push(['v(t₀)', `${fmt(c[0])} m/s`]);
    L.push([f.deg === 1 ? 'a' : 'a(t₀)', `<b class="big">${fmt(c[1])}${pm(1)} m/s²</b>`]);
    if (f.deg === 2) L.push(['c₂', `${fmt(c[2])} m/s³`]);
  }
  L.push(['R² · n', `${fmt(fit.r2, 4)} · ${fit.n}`]);
  return L;
}
function paneData() {
  let h = `<h3 class="grp">${ic('run')}${t('g_runs')}</h3><div class="list">`;
  if (!S.runs.length) h += `<p class="note">${t('no_runs')}</p>`;
  for (const r of S.runs) {
    h += `<div class="item ${r.id === S.activeId ? 'on' : ''}" data-act="runsel" data-id="${r.id}"><span class="sp">${r.name}<br><small>${r.f} Hz · ${fmt(r.T, 1)} s${r.crop ? ' · ' + t('cropped') : ''}</small></span>
      <button class="mini" data-act="runeye" data-id="${r.id}" title="${t('hide')}">${ic(r.visible ? 'eye' : 'eyeoff')}</button>
      <button class="mini" data-act="rundel" data-id="${r.id}" title="${t('delete')}">${ic('trash')}</button></div>`;
  }
  h += '</div>';
  if (has('select')) h += `<h3 class="grp">${ic('fitlin')}${t('g_fits')}</h3>`;
  const fits = has('select') ? S.fits.filter((f) => f.runId === S.activeId) : [];
  if (has('select') && !fits.length) h += `<p class="note">${t('no_fits')}</p>`;
  for (const f of fits) {
    const run = S.runs.find((r) => r.id === f.runId), ser = run && series(run);
    if (!ser) continue;
    const arr = f.graph === 'x' ? ser[f.sensor].x : ser[f.sensor].v, fit = polyfit(run.t, arr, f.deg, f.t0, f.t1);
    const mname = f.deg === 0 ? t('fit_const') : f.deg === 1 ? t('fit_lin') : t('fit_quad');
    h += `<div class="fitcard"><div class="hd"><span class="dot s${f.sensor + 1}"></span><span class="sp">S${f.sensor + 1} · ${f.graph}(t) · ${mname}</span>
      <button class="mini" data-act="fitdel" data-id="${f.id}" title="${t('delete')}">${ic('trash')}</button></div>
      <div class="ln"><span>t₀ … t₁</span><span>${fmt(f.t0 + offsetOf(run), 2)} … ${fmt(f.t1 + offsetOf(run), 2)} s</span></div>`;
    if (fit) for (const [a, b] of describeFit(f, fit)) h += `<div class="ln"><span>${a}</span><span>${b}</span></div>`;
    h += '</div>';
  }
  const tgl = (act, on, label, small, icon) => `<button class="tg" data-act="${act}" aria-pressed="${on}"><span class="txt">${ic(icon)}<span>${label}<small>${small}</small></span></span><span class="sw"></span></button>`;
  const disp = (has('align') ? tgl('align', S.align, t('align'), t('align_s'), 'align') : '')
    + (has('vectors') ? tgl('vec', S.showVec, t('vectors'), t('vectors_s'), 'vec') : '')
    + (has('truth') ? tgl('truth', S.showTruth, t('truth_full'), t('truth_s'), 'truth') : '');
  if (disp) h += `<h3 class="grp">${ic('align')}${t('g_display')}</h3>` + disp;
  return h;
}
// Su telefono in verticale i grafici stanno in una tab del pannello; altrove restano sotto la barra.
const mqPhone = window.matchMedia('(max-width:920px) and (orientation:portrait)');
function placeGraphs() {
  const g = $('.graphs'), panel = $('.panel'), tabs = $('.tabs');
  if (mqPhone.matches) {
    if (g.parentElement !== panel) panel.insertBefore(g, $('#pane'));
    if (!S.phoneInit) { S.phoneInit = true; S.tab = 'graphs'; }
  } else {
    if (S.tab === 'graphs') S.tab = 'setup';
    if (g.parentElement !== $('.stage')) $('.stage').appendChild(g);
  }
  panel.classList.toggle('gmode', mqPhone.matches && S.tab === 'graphs');
  return tabs;
}
mqPhone.addEventListener('change', () => { if (mqPhone.matches) S.tab = 'graphs'; renderPane(); dirty = true; });
function renderPane() {
  placeGraphs();
  const pane = $('#pane');
  pane.innerHTML = S.tab === 'setup' ? paneSetup() : S.tab === 'sensors' ? paneSensors() : S.tab === 'graphs' ? '' : paneData();
  $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  syncToolbar();
}

// ---------------------------------------------------------------- eventi
$('#pane').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, val = b.dataset.val, id = b.dataset.id;
  if (!['weigh', 'clearw', 'reveal', 'trig'].includes(act)) disarm();
  if (act === 'weigh') weigh(id);
  else if (act === 'clearw') resetWeighs();
  else if (act === 'reveal') { S.revealed = !S.revealed; applyMasses(); }
  else if (act === 'hidden') { S.hidden = !S.hidden; S.revealed = false; resetWeighs(); applyMasses(); }
  else if (act === 'reseed') { S.seed = 1 + Math.floor(Math.random() * 9999); S.revealed = false; resetWeighs(); applyMasses(); }
  else if (act === 'trig') { S.trig.on = !S.trig.on; if (!S.trig.on) disarm(); }
  else if (act === 'preset') { world.preset(val); pending.length = 0; exitReplay(); }
  else if (act === 'flip') { world.flip(id); world.restore(); }
  else if (act === 'swap') { world.swap(); exitReplay(); }
  else if (act === 'plunger') { world.setPlunger(id, val); }
  else if (act === 'level') { world.setLevel(id, Number(val)); }
  else if (act === 'extra') { world.setExtra(b.dataset.which, val || null); }
  else if (act === 'inv') { S.inv[Number(b.dataset.s)] = !S.inv[Number(b.dataset.s)]; graphs.autoscale(); }
  else if (act === 'runsel') { if (!ev.target.closest('.mini')) { S.activeId = Number(id); graphs.autoscale(); } }
  else if (act === 'runeye') { const r = S.runs.find((q) => q.id === Number(id)); r.visible = !r.visible; ev.stopPropagation(); graphs.autoscale(); }
  else if (act === 'rundel') {
    const n = Number(id); S.runs = S.runs.filter((q) => q.id !== n); S.fits = S.fits.filter((f) => f.runId !== n);
    if (S.activeId === n) S.activeId = S.runs.length ? S.runs[S.runs.length - 1].id : null;
    graphs.cursorA = graphs.cursorB = null; graphs.sel = null; exitReplay(); graphs.autoscale();
  }
  else if (act === 'fitdel') { S.fits = S.fits.filter((f) => f.id !== Number(id)); }
  else if (act === 'align') { S.align = !S.align; graphs.autoscale(); }
  else if (act === 'vec') { S.showVec = !S.showVec; scene.showVec = S.showVec; }
  else if (act === 'truth') { S.showTruth = !S.showTruth; }
  dirty = true; renderPane();
});
$('#pane').addEventListener('input', (ev) => {
  const k = ev.target.dataset.in; if (!k) return;
  const v = Number(ev.target.value);
  if (k === 'len') { world.setRail(v); $('#lbLen').textContent = fmt(v, 2) + ' m'; }
  else if (k === 'tilt') { world.tiltMm = v; $('#lbTilt').textContent = `${v > 0 ? '+' : ''}${v} mm · ${fmt(world.tiltDeg(), 2)}°`; }
  else if (k === 'mu') { world.mu = v / 1000; $('#lbMu').textContent = `μ = ${fmt(world.mu, 4)} · a ≈ ${fmt(world.mu * CFG.G * 100, 1)} cm/s²`; }
  else if (k === 'trigthr') { S.trig.thr = v; $('#lbTrig').textContent = v + ' mm'; }
  else if (k === 'noise') { S.noise = v; $('#lbNoise').textContent = fmt(v, 1) + ' mm'; }
  else if (k === 'vl0' || k === 'vl1') { S.launchV[k === 'vl0' ? 0 : 1] = Number.isFinite(v) ? clamp(v, -1.5, 1.5) : 0; }
});
$('#pane').addEventListener('change', (ev) => {
  if (ev.target.dataset.in !== 'seed') return;
  disarm();
  S.seed = clamp(Math.round(Number(ev.target.value)) || 1, 1, 9999); S.revealed = false; resetWeighs(); applyMasses(); renderPane();
});
$$('.tab').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; renderPane(); dirty = true; }));

$('#recBtn').addEventListener('click', stopOrStart);
$('#launchBtn').addEventListener('click', doLaunch);
$('#fireBtn').addEventListener('click', doFire);
$('#homeBtn').addEventListener('click', doHome);
$('#liveBtn').addEventListener('click', () => { exitReplay(); graphs.cursorA = graphs.cursorB = null; dirty = true; });
$('#fSel').addEventListener('change', (e) => { S.f = Number(e.target.value); });
$('#TSel').addEventListener('change', (e) => { S.T = Number(e.target.value); });
$('#speedSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  // su telefono resta visibile solo la velocità attiva: un tocco passa alla successiva
  if (mqPhone.matches) { const v = [1, 0.5, 0.25]; S.speed = v[(v.indexOf(S.speed) + 1) % v.length]; }
  else S.speed = Number(b.dataset.v);
  syncToolbar();
});
$('#toolSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { graphs.tool = b.dataset.tool; syncToolbar(); } });
$('#viewSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { graphs.joined = b.dataset.view === 'joined'; S.joined = graphs.joined; store.set('joined', S.joined ? '1' : '0'); syncToolbar(); dirty = true; } });
$('#autoBtn').addEventListener('click', () => { graphs.autoscale(); graphs.draw(); });
$('#bBtn').addEventListener('click', () => {
  graphs.useB = !graphs.useB;
  if (graphs.useB && graphs.cursorB == null) {
    const e = graphs.active(), v = graphs.view;
    graphs.cursorB = graphs.snap(graphs.cursorA != null ? Math.min(v.t1, graphs.cursorA + (v.t1 - v.t0) * 0.15) : (v.t0 + v.t1) / 2);
    if (graphs.cursorA == null) graphs.cursorA = graphs.snap(v.t0 + (v.t1 - v.t0) * 0.3);
    if (e && !rec) enterReplay();
  }
  syncToolbar(); dirty = true;
});
$('#truthBtn').addEventListener('click', () => { S.showTruth = !S.showTruth; syncToolbar(); dirty = true; if (S.tab === 'data') renderPane(); });
$('#uncropBtn').addEventListener('click', () => { const r = activeRun(); if (r) { r.crop = null; graphs.autoscale(); dirty = true; renderPane(); } });
$$('.selbar').forEach((bar) => bar.addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.sens != null) { const s = Number(b.dataset.sens); S.selSensors[s] = !S.selSensors[s]; if (!S.selSensors[0] && !S.selSensors[1]) S.selSensors[1 - s] = true; updateSelBars(); return; }
  if (b.dataset.fit) {
    const [g, d] = b.dataset.fit.split(':'), run = activeRun(), sel = graphs.sel;
    if (!run || !sel) return;
    const off = offsetOf(run);
    for (const s of [0, 1]) if (S.selSensors[s]) S.fits.push({ id: S.nextFit++, runId: run.id, sensor: s, graph: g, deg: Number(d), t0: sel.t0 - off, t1: sel.t1 - off });
    dirty = true; if (S.tab === 'data') renderPane(); return;
  }
  if (b.id === 'cropBtn') { const run = activeRun(), sel = graphs.sel; if (run && sel) { const off = offsetOf(run); run.crop = [sel.t0 - off, sel.t1 - off]; graphs.sel = null; graphs.autoscale(); dirty = true; renderPane(); } return; }
  if (b.id === 'selClear') { graphs.sel = null; dirty = true; }
}));

// livelli di funzioni
function levelFromHash() { const m = /^#?(?:livello|level)-([1-3])$/.exec(location.hash); return m ? Number(m[1]) : null; }
function setHash() {
  const h = (getLang() === 'en' ? '#level-' : '#livello-') + S.level;
  try { if (location.hash !== h) history.replaceState(null, '', h); } catch { try { location.hash = h; } catch { /* ignora */ } }
}
function applyLevel(l) {
  const prev = S.level;
  S.level = clamp(Math.round(l) || 1, 1, LEVEL_MAX);
  store.set('level', String(S.level));
  if (S.level < prev) {
    if (!has('select')) { if (graphs.tool === 'select') graphs.tool = 'probe'; graphs.sel = null; S.fits = []; S.runs.forEach((r) => { r.crop = null; }); }
    if (!has('truth')) S.showTruth = false;
    if (!has('vectors')) { S.showVec = false; scene.showVec = false; }
    if (!has('align')) S.align = false;
    if (!has('invert')) S.inv = [false, false];
    if (!has('noise')) S.noise = CFG.SIGMA_DEFAULT * 1000;
    if (!has('rail')) world.setRail(CFG.RAIL_DEFAULT);
    if (!has('tilt')) world.tiltMm = 0;
    if (!has('friction')) world.mu = CFG.MU_DEFAULT;
    if (!has('presets2')) world.preset('elastic');
    if (!has('masses')) world.extra = { m1: null, m05: null };
    if (!has('plunger')) for (const id of ['A', 'B']) { world.setPlunger(id, 'active'); world.setLevel(id, 1); }
    if (!has('hidden')) { S.hidden = false; S.revealed = false; resetWeighs(); applyMasses(); }
    if (!has('trigger')) { S.trig.on = false; disarm(); }
    world.restore(); pending.length = 0; exitReplay();
  }
  setHash(); dirty = true; syncToolbar(); renderPane();
}
$('#lvlBtn').addEventListener('click', () => { applyLevel(S.level % LEVEL_MAX + 1); toast(`${t('lvl_word')} ${S.level} · ${t('lvl_' + S.level)}`); });
window.addEventListener('hashchange', () => { const l = levelFromHash(); if (l && l !== S.level) applyLevel(l); });

// tema, lingua, guida
function currentTheme() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function applyTheme(th) {
  if (th) document.documentElement.dataset.theme = th;
  scene.refreshColors(); graphs.refreshColors(); dirty = true;
}
$('#themeBtn').addEventListener('click', () => { const n = currentTheme() === 'dark' ? 'light' : 'dark'; store.set('theme', n); applyTheme(n); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
function applyI18n() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
  $('#langBtn').textContent = getLang().toUpperCase();
  $('#helpBody').innerHTML = t('help_html');
  document.documentElement.lang = getLang();
  $('#speedSeg').innerHTML = [[1, '1×'], [0.5, '½×'], [0.25, '¼×']].map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('');
  const fSel = $('#fSel'); fSel.innerHTML = [10, 15, 20, 25, 30, 35, 40].map((v) => `<option value="${v}">${v} Hz</option>`).join('');
  const TSel = $('#TSel'); TSel.innerHTML = [2, 3, 5, 8, 10, 15, 20, 30].map((v) => `<option value="${v}">${v} s</option>`).join('');
  renderPane();
}
$('#langBtn').addEventListener('click', () => { const n = getLang() === 'it' ? 'en' : 'it'; setLang(n); store.set('lang', n); applyI18n(); setHash(); dirty = true; });
$('#helpBtn').addEventListener('click', () => $('#help').showModal());
$('#helpClose').addEventListener('click', () => $('#help').close());

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input,select,textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); stopOrStart(); }
  else if (e.key === 'a') { graphs.autoscale(); dirty = true; }
});

// ---------------------------------------------------------------- esempio iniziale
function exampleRun() {
  const w = new World();
  w.preset('elastic');
  const r = new Recorder({ f: 30, T: 2.4, sigma: 0.0005, seed: 12345 });
  r.begin(w);
  const n = Math.round(2.6 / CFG.DT);
  for (let i = 0; i < n && !r.done; i++) {
    if (i === Math.round(0.4 / CFG.DT)) w.launch(w.order[0], 0.35);
    w.step(); r.tick(w);
  }
  const run = r.toRun(S.nextId++, t('example'));
  run.example = true;
  return run;
}

// ---------------------------------------------------------------- ciclo
let last = performance.now(), acc = 0, toastT = 0;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }
function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.05, (now - last) / 1000); last = now;
  if (!S.replayOn) {
    acc += dtReal * S.speed;
    let n = Math.floor(acc / CFG.DT); acc -= n * CFG.DT; n = Math.min(n, 5000);
    for (let i = 0; i < n; i++) {
      world.step();
      if (pending.length) for (let j = pending.length - 1; j >= 0; j--) if (pending[j].at <= world.time) { const p = pending.splice(j, 1)[0]; p.fn(); }
      if (armed && (i % 10 === 0)) checkTrigger();
      if (rec) { rec.tick(world); if (rec.done) { finishRecording(); toast(t('saved')); break; } }
    }
  }
  scene.sensorText = sensorTexts();
  scene.draw(now);
  const loaded = world.carts.A.plunger === 'loaded' || world.carts.B.plunger === 'loaded';
  $('#fireBtn').hidden = !loaded;
  if (rec) {
    $('#recBadge').hidden = false;
    $('#recTxt').textContent = `${fmt(Math.min(world.time - rec.t0, rec.T), 1)} / ${rec.T} s`;
    refreshGraphs();
  } else if (armed) {
    $('#recBadge').hidden = false; $('#recTxt').textContent = t('waiting');
    if (dirty) { refreshGraphs(); dirty = false; }
  } else {
    $('#recBadge').hidden = true;
    if (dirty) { refreshGraphs(); dirty = false; }
  }
}

// ---------------------------------------------------------------- avvio
setLang(store.get('lang', (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'));
const savedTheme = store.get('theme', null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
mountIcons();
S.level = clamp(levelFromHash() ?? (Number(store.get('level', '3')) || 3), 1, LEVEL_MAX);
applyMasses();
const ex = exampleRun();
S.runs.push(ex); S.activeId = ex.id; S.runCount = 0;
applyI18n();
scene.refreshColors(); graphs.refreshColors();
graphs.resize(); scene.resize();
graphs.autoscale();
syncToolbar(); setHash();
requestAnimationFrame(frame);
window.__carts = { world, S, graphs, scene, startRecording, finishRecording, applyLevel, weigh, arm, disarm, applyMasses, hiddenMasses, isArmed: () => !!armed, isRec: () => !!rec };
