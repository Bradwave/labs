// Side panel, readout and control wiring.
import { S, H, MAX_MAPS } from './state.js';
import { PRESETS, linear, mathMatrix, analyze, newMap, equalWeights, areaWeights, normalizeWeights, randomMaps } from './ifs.js';
import { maxLevel } from './engine.js';
import { setTarget, targetBounds } from './challenge.js';
import { zoomToMap, zoomBy, fitView } from './view.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const PI = Math.PI;
const wrapDeg = d => ((((d + 180) % 360) + 360) % 360) - 180;

const FIELDS = [
  { k: 'p', label: 'Weight p', min: 0, max: 1, step: 0.005, get: m => m.p, set: (m, v) => (m.p = v), fmt: v => v.toFixed(3) },
  { k: 'w', label: 'Width', min: 0.02, max: 1.5, step: 0.005, get: m => m.w, set: (m, v) => (m.w = v), fmt: v => v.toFixed(3) },
  { k: 'h', label: 'Height', min: 0.02, max: 1.5, step: 0.005, get: m => m.h, set: (m, v) => (m.h = v), fmt: v => v.toFixed(3) },
  { k: 'rot', label: 'Rotation', min: -180, max: 180, step: 1, get: m => wrapDeg((m.rot * 180) / PI), set: (m, v) => (m.rot = (v * PI) / 180), fmt: v => Math.round(v) + '°' },
  { k: 'x', label: 'x', min: -1, max: 2, step: 0.005, get: m => m.x, set: (m, v) => (m.x = v), fmt: v => v.toFixed(3) },
  { k: 'y', label: 'y', min: -1, max: 2, step: 0.005, get: m => m.y, set: (m, v) => (m.y = v), fmt: v => v.toFixed(3) },
];

const fmtN = n => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k' : String(n));
const sgn = v => (v < 0 ? '−' : '+') + ' ' + Math.abs(v).toFixed(3);
const pointsFromIdx = i => Math.max(1000, Math.round(Math.pow(10, 3 + (3 * i) / 100) / 1000) * 1000);
const idxFromPoints = p => Math.round(((Math.log10(p) - 3) / 3) * 100);
const alphaLabel = a => (a * 100).toFixed(0) + '%';

let toastT;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---- maps list ------------------------------------------------------------------------
function bodyHTML(i) {
  const one = f => `<div class="ctl"><label for="f_${f.k}">${f.label} <b data-out="${f.k}"></b></label><input type="range" id="f_${f.k}" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}"></div>`;
  const [p, w, h, rot, x, y] = FIELDS.map(one);
  return `<div class="mbody">${p}<div class="pair">${w}${h}</div>${rot}<div class="pair">${x}${y}</div>
    <div class="row">
      <button class="lg" data-act="fx"><span class="ms">flip</span>Mirror ↔</button>
      <button class="lg" data-act="fy"><span class="ms">flip</span>Mirror ↕</button>
      <input type="color" data-color aria-label="Map colour">
    </div>
    <div class="mx" data-mx></div>
    <div class="row">
      <button class="btn small" data-act="zoom"><span class="ms">zoom_in</span>Zoom here</button>
      <button class="btn small" data-act="dup"><span class="ms">content_copy</span>Copy</button>
      <button class="btn small" data-act="del"><span class="ms">delete</span>Remove</button>
    </div></div>`;
}

export function renderMaps() {
  const list = $('#mapList');
  list.innerHTML = '';
  S.maps.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'mcard' + (i === S.sel ? ' on' : '');
    card.dataset.i = i;
    card.innerHTML = `<button class="mhead"><i class="sw" style="background:${m.color}"></i><b>Map ${i + 1}</b><span class="share"></span><span class="ok"></span></button>` + (i === S.sel ? bodyHTML(i) : '');
    list.appendChild(card);
  });
  syncMaps(true);
}

export function syncMaps(setValues) {
  const an = analyze(S.maps);
  $$('#mapList .mcard').forEach(card => {
    const i = +card.dataset.i, m = S.maps[i];
    if (!m) return;
    card.querySelector('.share').textContent = an.sumP > 0 ? Math.round((100 * m.p) / an.sumP) + '%' : '–';
    const ok = card.querySelector('.ok'), good = an.per[i].max < 1;
    ok.textContent = good ? '✓' : 'expands'; ok.className = 'ok ' + (good ? 'good' : 'bad');
    card.querySelector('.sw').style.background = m.color;
    if (i !== S.sel) return;
    for (const f of FIELDS) {
      const inp = card.querySelector(`[data-k="${f.k}"]`), v = f.get(m);
      if (setValues) inp.value = v;
      card.querySelector(`[data-out="${f.k}"]`).textContent = f.fmt(v);
    }
    card.querySelector('[data-act="fx"]').classList.toggle('on', m.fx);
    card.querySelector('[data-act="fy"]').classList.toggle('on', m.fy);
    card.querySelectorAll('[data-act="fx"],[data-act="fy"]').forEach(b => b.style.opacity = b.classList.contains('on') ? 1 : 0.45);
    const col = card.querySelector('[data-color]');
    if (setValues) col.value = m.color;
    const M = mathMatrix(linear(m));
    card.querySelector('[data-mx]').textContent = `x′ = ${M.A.toFixed(3).padStart(7)}·x ${sgn(M.B)}·y ${sgn(M.E)}\ny′ = ${M.C.toFixed(3).padStart(7)}·x ${sgn(M.D)}·y ${sgn(M.F)}`;
  });
}

export function analysis() {
  const an = analyze(S.maps), box = $('#analysis');
  const rows = [['Maps', S.maps.length], ['Sum of weights', an.sumP.toFixed(3)]];
  let dimTxt = 'a map expands';
  if (an.dim !== null) dimTxt = '≈ ' + an.dim.toFixed(3) + (an.exact ? '' : ' (estimate)');
  rows.push(['Dimension', dimTxt]);
  let html = rows.map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('');
  if (an.expanding.length) html += `<p class="note ok bad">Map ${an.expanding.map(i => i + 1).join(', ')} stretch${an.expanding.length === 1 ? 'es' : ''} distances. Shrink ${an.expanding.length === 1 ? 'it' : 'them'} below the frame size, otherwise points may escape to infinity.</p>`;
  else html += `<p class="note ok good">All maps are contractions, so the chaos game converges to a unique attractor.</p>`;
  if (an.dim !== null && an.dim > 2.0001) html += `<p class="note">A dimension above 2 means the copies overlap a lot; the formula assumes they barely do.</p>`;
  else if (an.dim !== null && !an.exact) html += `<p class="note">Maps that stretch more in one direction than another: the geometric mean of the stretches is used, so this is only a guide.</p>`;
  box.innerHTML = html;
}

// ---- canvas readout ---------------------------------------------------------------------
export function readout() {
  const an = analyze(S.maps), r = $('#readout'), o = S.o;
  const rows = [];
  if (o.method === 'levels') rows.push(['Level', `<b>${Math.min(o.level, maxLevel())}</b>`], ['Copies', `<b>${fmtN(Math.pow(S.maps.length, Math.min(o.level, maxLevel())))}</b>`]);
  else rows.push(['Points', `<b>${fmtN(S.total)}</b>`]);
  rows.push(['Maps', `<b>${S.maps.length}</b>`]);
  if (an.dim !== null) rows.push(['Dim', `<b>${an.exact ? '' : '≈ '}${an.dim.toFixed(2)}</b>`, true]);
  if (S.view.z !== 1) rows.push(['Zoom', `<b>${S.view.z >= 10 ? Math.round(S.view.z) : S.view.z.toFixed(1)}×</b>`]);
  let html = rows.map(([a, b, w]) => `<span${w ? ' class="wide"' : ''}>${a}</span>${w ? b.replace('<b>', '<b class="wide">') : b}`).join('');
  if (an.expanding.length) html += `<span class="full warn">Map ${an.expanding.map(i => i + 1).join(', ')} expands</span>`;
  else if (S.trace && o.method === 'chaos' && o.rate !== 'max') html += `<span class="full">${S.trace.burning ? 'burn-in · ' : ''}roll ${S.trace.roll.toFixed(2)} → map ${S.trace.j + 1}</span>`;
  r.innerHTML = html;
}

// ---- presets / targets / controls ----------------------------------------------------------
export function renderPresets() {
  const el = $('#presets');
  if (!el.children.length) {
    el.innerHTML = PRESETS.map(p => `<button class="lg" data-key="${p.key}">${p.name}</button>`).join('');
  }
  el.querySelectorAll('.lg').forEach(b => b.classList.toggle('on', b.dataset.key === S.presetKey));
  const p = PRESETS.find(q => q.key === S.presetKey);
  $('#presetNote').textContent = p ? p.blurb : 'Your own system. Drag the rectangles on the canvas, or use the sliders below.';
}

export function renderTarget() {
  const el = $('#targets');
  if (!el.children.length) {
    el.innerHTML = `<button class="lg" data-key="">None</button>` + PRESETS.map(p => `<button class="lg" data-key="${p.key}">${p.name}</button>`).join('');
  }
  el.querySelectorAll('.lg').forEach(b => b.classList.toggle('on', b.dataset.key === (S.target ? S.target.key : '')));
  const info = $('#targetInfo'), t = S.target;
  if (!t) { info.innerHTML = '<p class="note">No target. Choose one above to see its ghost on the canvas.</p>'; return; }
  const sc = S.score || 0, done = sc >= 90;
  info.innerHTML = `<div class="scoreval">${sc.toFixed(0)}%</div>
    <div class="scorebar"><i style="width:${sc}%"></i></div>
    <p class="note">${done ? 'Excellent: your collage reproduces the target.' : 'Overlap with the ghost of the ' + t.name + '. It can be built with ' + t.n + ' maps.'}</p>
    <div class="row">
      <button class="btn small" data-act="tstart"><span class="ms">auto_awesome</span>Start with ${t.n} maps</button>
      <button class="btn small" data-act="treveal"><span class="ms">visibility</span>Reveal answer</button>
      <button class="btn small" data-act="tghost"><span class="ms">${S.ghost ? 'visibility_off' : 'visibility'}</span>${S.ghost ? 'Hide' : 'Show'} ghost</button>
    </div>`;
}

export function syncControls() {
  const o = S.o;
  $$('[data-opt]').forEach(b => { b.classList.toggle('on', !!o[b.dataset.opt]); b.setAttribute('aria-pressed', !!o[b.dataset.opt]); });
  const setSeg = (id, v) => $$(id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
  setSeg('#rateSeg', o.rate); setSeg('#methodSeg', o.method); setSeg('#colorSeg', o.color); setSeg('#colorSeg2', o.color === 'blend' ? 'map' : o.color); setSeg('#seedSeg', o.seed);
  const levels = o.method === 'levels';
  $('#chaosBox').hidden = levels; $('#levelBox').hidden = !levels; $('#rateSeg').hidden = levels;
  $('#methodNote').textContent = levels
    ? 'Deterministic: draw the starting shape, then replace every copy by its images under all maps.'
    : 'Random: pick a map by its weight, jump to its image, plot the point, repeat.';
  const ml = maxLevel(), lv = Math.min(o.level, ml);
  const lr = $('#lvlR'); lr.max = ml; lr.value = lv; $('#lvlL').textContent = `${lv} · ${fmtN(Math.pow(S.maps.length, lv))} copies`;
  $('#ptsR').value = idxFromPoints(o.points); $('#ptsL').textContent = fmtN(o.points);
  $('#alphaR').value = o.alpha; $('#alphaL').textContent = alphaLabel(o.alpha);
  $('#burnR').value = o.burn; $('#burnL').textContent = o.burn;
  $('#playIcon').textContent = S.playing ? 'pause' : 'play_arrow';
  $('#playLbl').textContent = S.playing ? 'Pause' : 'Play';
  $('#playBtn').setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
  $('#stepLbl').textContent = levels ? 'Level +1' : 'Step';
  $('#hint').textContent = o.maps ? 'Drag a rectangle · corners resize · round handle rotates · scroll to zoom' : 'Scroll or pinch to zoom · drag to pan';
}

export function initUI() {
  // tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('on', x === t));
    ['maps', 'build', 'target', 'view'].forEach(n => ($('#pane-' + n).hidden = n !== t.dataset.tab));
  }));

  // map list (delegated)
  const list = $('#mapList');
  list.addEventListener('click', e => {
    const card = e.target.closest('.mcard');
    if (!card) return;
    const i = +card.dataset.i;
    const act = e.target.closest('[data-act]');
    if (!act) { if (e.target.closest('.mhead') && i !== S.sel) { S.sel = i; H.select(); } return; }
    const m = S.maps[i];
    switch (act.dataset.act) {
      case 'fx': m.fx = !m.fx; H.edit(true); break;
      case 'fy': m.fy = !m.fy; H.edit(true); break;
      case 'zoom': zoomToMap(i); break;
      case 'dup':
        if (S.maps.length >= MAX_MAPS) return toast(`At most ${MAX_MAPS} maps`);
        S.maps.splice(i + 1, 0, { ...m, x: m.x + 0.05, y: m.y + 0.05 }); S.sel = i + 1; H.structure(); break;
      case 'del':
        if (S.maps.length < 2) return toast('Keep at least one map');
        S.maps.splice(i, 1); S.sel = Math.min(S.sel, S.maps.length - 1); H.structure(); break;
    }
  });
  list.addEventListener('input', e => {
    const m = S.maps[S.sel];
    if (e.target.matches('[data-k]')) {
      const f = FIELDS.find(q => q.k === e.target.dataset.k);
      f.set(m, +e.target.value); H.edit(false);
    } else if (e.target.matches('[data-color]')) { m.color = e.target.value; H.edit(false); }
  });
  list.addEventListener('change', () => H.commit());

  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b) H.loadPreset(b.dataset.key); });
  $('#targets').addEventListener('click', e => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    setTarget(b.dataset.key || null); renderTarget(); if (S.target) fitView(targetBounds()); S.ovDirty = true; H.commit();
  });
  $('#targetInfo').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !S.target) return;
    if (b.dataset.act === 'tghost') { S.ghost = !S.ghost; S.ovDirty = true; renderTarget(); }
    if (b.dataset.act === 'treveal') H.loadPreset(S.target.key);
    if (b.dataset.act === 'tstart') {
      const n = S.target.n;
      S.maps = Array.from({ length: n }, (_, i) => {
        const a = (2 * PI * i) / n;
        return newMap(i, { x: 0.5 + 0.18 * Math.cos(a) - 0.22, y: 0.5 + 0.18 * Math.sin(a) - 0.22, w: 0.44, h: 0.44, p: 1 / n });
      });
      S.sel = 0; H.structure();
    }
  });

  $('#addMap').addEventListener('click', () => {
    if (S.maps.length >= MAX_MAPS) return toast(`At most ${MAX_MAPS} maps`);
    const n = S.maps.length;
    S.maps.push(newMap(n, { x: 0.3, y: 0.3, w: 0.4, h: 0.4, p: 1 / (n + 1) }));
    normalizeWeights(S.maps); S.sel = n; H.structure();
  });
  $('#randBtn').addEventListener('click', () => { S.maps = randomMaps(); equalWeights(S.maps); S.sel = 0; H.structure(); });
  $('#wEqual').addEventListener('click', () => { equalWeights(S.maps); H.edit(true); });
  $('#wArea').addEventListener('click', () => { areaWeights(S.maps); H.edit(true); });
  $('#wNorm').addEventListener('click', () => { normalizeWeights(S.maps); H.edit(true); });

  // options
  $$('[data-opt]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.opt; S.o[k] = !S.o[k]; H.settings(); }));
  const seg = (id, key) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.o[key] = b.dataset.v; H.settings(); });
  seg('#rateSeg', 'rate'); seg('#methodSeg', 'method'); seg('#colorSeg', 'color'); seg('#colorSeg2', 'color'); seg('#seedSeg', 'seed');
  $('#ptsR').addEventListener('input', e => { S.o.points = pointsFromIdx(+e.target.value); syncControls(); H.settings(true); });
  $('#alphaR').addEventListener('input', e => { S.o.alpha = +e.target.value; H.settings(true); });
  $('#burnR').addEventListener('input', e => { S.o.burn = +e.target.value; H.settings(); });
  $('#lvlR').addEventListener('input', e => { S.o.level = +e.target.value; H.settings(true); });

  $('#zIn').addEventListener('click', () => zoomBy(1.6));
  $('#zOut').addEventListener('click', () => zoomBy(1 / 1.6));
  $('#zFit').addEventListener('click', fitView);

  // dialog
  const help = $('#help');
  ['#helpBtn', '#helpBtn2', '#helpBtn3'].forEach(id => $(id).addEventListener('click', () => help.showModal()));
  $('#helpClose').addEventListener('click', () => help.close());
  help.addEventListener('click', e => { if (e.target === help) help.close(); });
}
