import { S, H, LIMIT, RATES } from './state.js';
import { fromPreset, toJSON, fromJSON, encodeHash, decodeHash } from './ifs.js';
import { B, alloc, clearBuf, ensureColorBuffer, runBatch, traceStep, present, drawLevels, maxLevel, refreshColors } from './engine.js';
import { initView, drawOverlay, fitView } from './view.js';
import { setTarget, updateScore } from './challenge.js';
import { initUI, renderMaps, renderPresets, renderTarget, syncMaps, syncControls, analysis, readout, toast } from './ui.js';

const $ = s => document.querySelector(s);
const cv = $('#cv'), ov = $('#ov'), wrap = $('#wrap');
const KEY = 'attractor-lab.v2', THEME_KEY = 'attractor-lab.theme';

// ---- persistence ----------------------------------------------------------------------------
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      const { points, alpha, burn, color, night, maps, glyph, frame, method, rate, level, seed } = S.o;
      localStorage.setItem(KEY, JSON.stringify({ maps: toJSON(S.maps), o: { points, alpha, burn, color, night, maps, glyph, frame, method, rate, level, seed }, target: S.target ? S.target.key : null }));
    } catch (e) { /* storage unavailable */ }
  }, 300);
}
function restore() {
  const fromHash = decodeHash(location.hash);
  if (fromHash) { S.maps = fromHash; return; }
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!d) return;
    S.maps = fromJSON(d.maps);
    const ok = { points: v => v >= 1000 && v <= 1e6, alpha: v => v >= 0.02 && v <= 1, burn: v => v >= 0 && v <= 100, level: v => v >= 0 && v <= 12,
      color: v => ['ink', 'map', 'blend'].includes(v), method: v => ['chaos', 'levels'].includes(v), rate: v => ['slow', 'med', 'fast', 'max'].includes(v), seed: v => ['F', 'square', 'triangle'].includes(v),
      night: v => typeof v === 'boolean', maps: v => typeof v === 'boolean', glyph: v => typeof v === 'boolean', frame: v => typeof v === 'boolean' };
    for (const k in ok) if (d.o && k in d.o && ok[k](d.o[k])) S.o[k] = d.o[k];
    if (d.target) setTarget(d.target);
  } catch (e) { /* ignore a corrupt save */ }
}

// ---- rendering state ----------------------------------------------------------------------
function regen() {
  if (S.o.method === 'levels') { B.dirty = true; S.ovDirty = true; return; }
  clearBuf();
  if (S.live && S.o.rate === 'max') runBatch(Math.min(S.o.points, 300000));
}
let scoreT;
function scheduleScore() {
  if (!S.target) return;
  clearTimeout(scoreT);
  scoreT = setTimeout(() => { updateScore(); renderTarget(); }, 80);
}

H.edit = fromCanvas => {
  if (S.presetKey) { S.presetKey = null; renderPresets(); }
  regen(); syncMaps(!!fromCanvas); analysis(); syncControls(); scheduleScore(); save(); S.ovDirty = true;
};
H.structure = () => {
  S.presetKey = S.presetKey || null;
  renderMaps(); renderPresets(); H.edit(true);
};
H.select = () => { renderMaps(); S.ovDirty = true; };
H.view = () => { regen(); S.ovDirty = true; };
H.commit = save;
H.loadPreset = key => {
  S.maps = fromPreset(key); S.sel = 0;
  H.structure(); S.presetKey = key; renderPresets(); S.live = true;
  fitView();
};
// soft: slider drags (ink, level) that only need a repaint, not a new simulation
H.settings = soft => {
  if (soft) { B.dirty = true; syncControls(); save(); return; }
  ensureColorBuffer();
  if (S.o.night !== B._night) { B._night = S.o.night; refreshColors(); }
  regen(); syncControls(); S.ovDirty = true; save();
};

// ---- layout ------------------------------------------------------------------------------------
function layout() {
  const r = wrap.getBoundingClientRect();
  S.size = { w: Math.max(50, r.width), h: Math.max(50, r.height) };
  alloc(S.size.w, S.size.h, cv.getContext('2d'));
  cv.width = ov.width = B.W; cv.height = ov.height = B.H;
  regen(); S.ovDirty = true;
}
let rafLayout;
new ResizeObserver(() => { cancelAnimationFrame(rafLayout); rafLayout = requestAnimationFrame(layout); }).observe(wrap);

// ---- toolbar -----------------------------------------------------------------------------------
function step() {
  if (S.o.method === 'levels') { S.o.level = Math.min(S.o.level + 1, maxLevel()); B.dirty = true; }
  else if (S.o.rate === 'max') { S.live = true; runBatch(S.o.points); }
  else { S.live = true; traceStep(); }
  syncControls();
}
function clear() {
  S.playing = false;
  if (S.o.method === 'levels') { S.o.level = 0; B.dirty = true; }
  else { S.live = false; clearBuf(); }
  syncControls();
}
function togglePlay() {
  S.playing = !S.playing;
  if (S.playing && S.o.method === 'chaos') S.live = true;
  syncControls();
}
$('#playBtn').addEventListener('click', togglePlay);
$('#stepBtn').addEventListener('click', step);
$('#clearBtn').addEventListener('click', clear);

// ---- files, links, image ------------------------------------------------------------------------
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#saveBtn').addEventListener('click', () => download(new Blob([JSON.stringify(toJSON(S.maps), null, 2)], { type: 'application/json' }), 'ifs_attractor.json'));
$('#loadBtn').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { S.maps = fromJSON(JSON.parse(rd.result)); S.sel = 0; S.presetKey = null; H.structure(); toast(`Loaded ${S.maps.length} maps`); }
    catch (err) { toast('That file is not a valid IFS file'); }
  };
  rd.readAsText(f);
  e.target.value = '';
});
$('#linkBtn').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#' + encodeHash(S.maps);
  history.replaceState(null, '', '#' + encodeHash(S.maps));
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (e) { toast('Link is in the address bar'); }
});
$('#pngBtn').addEventListener('click', () => {
  if (B.dirty) (S.o.method === 'levels' ? drawLevels : present)();
  const t = document.createElement('canvas');
  t.width = B.W; t.height = B.H;
  const c = t.getContext('2d');
  c.drawImage(cv, 0, 0); if (S.o.maps) c.drawImage(ov, 0, 0);
  t.toBlob(b => b && download(b, 'attractor.png'));
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Reset the maps and all settings?')) return;
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  history.replaceState(null, '', location.pathname);
  Object.assign(S.o, { points: 200000, alpha: 0.35, burn: 20, color: 'ink', night: false, maps: true, glyph: true, frame: true, method: 'chaos', rate: 'max', level: 3, seed: 'F' });
  setTarget(null); renderTarget(); S.playing = false; refreshColors(); B._night = false;
  H.loadPreset('sierpinski'); syncControls();
});

// ---- theme --------------------------------------------------------------------------------------
$('#themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  root.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch (e) { /* ignore */ }
  refreshColors();
});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', refreshColors);
try { const t = localStorage.getItem(THEME_KEY); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }

// ---- keyboard -----------------------------------------------------------------------------------
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey || $('#help').open) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); togglePlay(); }
  else if (k === 's') step();
  else if (k === 'c') clear();
  else if (k === 'm') { S.o.maps = !S.o.maps; H.settings(); }
  else if (k === 'n') $('#addMap').click();
  else if (k === '0') $('#zFit').click();
  else if (k === 'delete' || k === 'backspace') { const b = document.querySelector('.mcard.on [data-act="del"]'); if (b) b.click(); }
});

// ---- main loop ----------------------------------------------------------------------------------
let last = performance.now(), acc = 0, lvlT = 0, roT = 0;
function frame(t) {
  const dt = Math.min(100, t - last); last = t;
  if (S.playing) {
    if (S.o.method === 'levels') {
      lvlT += dt;
      if (lvlT > 900) { lvlT = 0; S.o.level = S.o.level >= maxLevel() ? 0 : S.o.level + 1; B.dirty = true; syncControls(); }
    } else if (S.o.rate === 'max') {
      if (S.total >= LIMIT) { S.playing = false; syncControls(); } else runBatch(S.o.points);
    } else {
      acc = Math.min(acc + (dt / 1000) * RATES[S.o.rate], 6);
      for (let n = 0; acc >= 1 && n < 6; n++, acc--) traceStep();
    }
  }
  if (B.dirty) (S.o.method === 'levels' ? drawLevels : present)();
  if (S.ovDirty) drawOverlay();
  if (t - roT > 120) { readout(); roT = t; }
  requestAnimationFrame(frame);
}

// ---- start --------------------------------------------------------------------------------------
S.maps = fromPreset('sierpinski');
S.presetKey = 'sierpinski';
restore();
if (decodeHash(location.hash) || localStorage.getItem(KEY)) S.presetKey = null;
B._night = S.o.night;
initUI(); initView(ov);
renderMaps(); renderPresets(); renderTarget(); analysis(); syncControls(); updateScore(); renderTarget();
layout();
requestAnimationFrame(frame);
