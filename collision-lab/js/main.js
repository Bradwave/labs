// Collision Lab · main.js
// Entry point: kit set-up, settings and controls, the simulation loop (fixed physics step, rendering at display
// rate), dragging on the table, and the refresh of the balance and graph panels.
import { initKit, t, icon, readColors, onTheme, onLang, fmtNum, store, toast } from "../../kit/kit.js";
import { toHTML } from "../../kit/mathtext.js";
import STRINGS from "./strings.js";
import { createWorld, cloneWorld, step, explode, totals, states } from "./physics.js";
import { TABLE, sceneById } from "./scenes.js";
import { toHash, parseLink, SHOW_KEYS } from "./state.js";
import { createStage, EXTRA_COLORS, lineOf, fillOf } from "./render.js";
import { drawMomentum, fillTables, drawEnergy, drawGraph, buildCsv } from "./panels.js";
import { DEFAULT_QUANTITY, axisLabel, extraKind, valueOf, extraOf } from "./quantities.js";

export const VERSION = "0.1.0";
const PHYS_STEP = 1 / 240; // s
const SAMPLE = 0.02; // s between recorded samples (graphs, trails, CSV)
const T_MAX = 15; // s: the run stops here
const OUT = 0.25; // m beyond the table edge: a disc this far out has left the table

initKit({
  slug: "collision-lab",
  name: "Collision Lab",
  version: VERSION,
  strings: STRINGS,
  menu: [
    { icon: "link", label: "menu.share", onClick: () => navigator.clipboard?.writeText(location.href).then(() => toast(t("copied"))) },
    {
      icon: "reset",
      label: "menu.reset",
      onClick: () => {
        store.remove("state");
        store.remove("show");
        history.replaceState(null, "", location.pathname);
        location.reload();
      },
    },
  ],
});

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
for (const b of $$("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));

// ---------- settings ----------
// st: physical settings; pres: presentation given by the link (show, tab, g, hide, lock); preset: its id or null.
// A link with presentation keys sets them for this session only: the saved preferences are left alone.
const linkHash = location.hash.length > 2 ? location.hash : "";
let st, pres, preset;
function loadLink(hash) {
  ({ st, pres, preset } = parseLink(hash || store.get("state") || ""));
}
loadLink(linkHash);
const SHOW_DEFAULT = { mom: true, vel: false, cm: true, trail: false, strobe: true };
const show = {};
function applyShow() {
  const saved = Object.assign({}, SHOW_DEFAULT, store.getJSON("show", {}));
  for (const k of SHOW_KEYS) show[k] = pres.show ? pres.show.includes(k) : !!saved[k];
}
applyShow();
let speed = 1;
// a link that hides or locks something is a prepared scene: it does not replace the user's own saved scene
const prepared = () => pres.hide.length > 0 || pres.lock || !!preset;
function save() {
  if (!prepared()) store.set("state", toHash(st));
  history.replaceState(null, "", toHash(st, pres, preset));
}

// ---------- simulation state ----------
let world, world0, T0, rec, nextSample, handles, split, splitDone, ended;
let playing = false, dirty = true, hover = null, drag = null;
const P = () => st.params[st.scene];

function rebuild() {
  const sc = sceneById(st.scene);
  const bodies = sc.build(P()).map((b, i) => ({ ...b, label: String.fromCharCode(65 + i) }));
  world = createWorld(bodies, { e: st.e, sticky: st.sticky, walls: st.walls ? TABLE : null });
  world0 = cloneWorld(world);
  T0 = totals(world0);
  handles = sc.handles(P(), bodies).map((h) => ({ ...h, r: bodies[h.body].r }));
  split = sc.split ? sc.split(P()) : null;
  splitDone = false;
  ended = false;
  rec = [];
  nextSample = 0;
  record();
  nextSample = SAMPLE;
  dirty = true;
}
function record() {
  const T = totals(world);
  rec.push({ t: world.t, p: states(world), X: T.X, Y: T.Y, Vx: T.Vx, Vy: T.Vy });
}

function advance(dt) {
  let rem = dt;
  while (rem > 1e-9 && !ended) {
    let h = Math.min(rem, PHYS_STEP);
    if (split && !splitDone && world.t + h >= split.at - 1e-12) {
      h = Math.max(0, split.at - world.t);
      step(world, h);
      explode(world, 0, split.E);
      splitDone = true;
    } else step(world, h);
    rem -= h;
    while (world.t >= nextSample - 1e-9) {
      record();
      nextSample += SAMPLE;
    }
    if (world.t >= T_MAX - 1e-9) ended = true;
    else if (!st.walls && world.t > 0.6) {
      const out = states(world).every((s) => s.x < -OUT || s.x > TABLE.W + OUT || s.y < -OUT || s.y > TABLE.H + OUT);
      const still = states(world).every((s) => Math.hypot(s.vx, s.vy) < 1e-6);
      if (out || still) ended = true;
    }
  }
  if (ended) {
    if (playing) toast(t("toast.end"));
    setPlaying(false);
  }
  dirty = true;
}

// ---------- controls ----------
function setPlaying(v) {
  playing = v;
  $("playIc").innerHTML = icon(v ? "pause" : "play");
  $("playLbl").textContent = t(v ? "pause" : "play");
  $("playBtn").setAttribute("aria-label", t(v ? "pause" : "play"));
}
function togglePlay() {
  if (!playing && ended) rebuild();
  setPlaying(!playing);
}
function doStep() {
  setPlaying(false);
  if (ended) rebuild();
  advance(1 / 30);
}
function doReset() {
  setPlaying(false);
  rebuild();
}
$("playBtn").addEventListener("click", togglePlay);
$("stepBtn").addEventListener("click", doStep);
$("resetBtn").addEventListener("click", doReset);

function segSync(seg, value) {
  for (const b of seg.querySelectorAll("button")) {
    const on = b.dataset.v === String(value);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
}
$("speedSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  speed = +b.dataset.v;
  segSync($("speedSeg"), b.dataset.v);
});
function setFrame(f) {
  st.frame = f;
  segSync($("frameSeg"), f);
  save();
  dirty = true;
}
$("frameSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) setFrame(b.dataset.v);
});

// scene and its parameters
const sceneSel = $("sceneSel");
sceneSel.addEventListener("change", () => {
  st.scene = sceneSel.value;
  setPlaying(false);
  rebuild();
  buildParams();
  save();
});
const fmtParam = (q, v) => (q.unit === "°" ? `${fmtNum(v, 0)}°` : fmtNum(v, q.digits, q.unit));
function buildParams() {
  const sc = sceneById(st.scene);
  sceneSel.value = sc.id;
  $("sceneNote").innerHTML = t("note." + sc.id);
  const box = $("params");
  box.innerHTML = "";
  for (const q of sc.params) {
    if (q.hidden) continue;
    const id = "par-" + q.k;
    const div = document.createElement("div");
    div.className = "ctl";
    div.innerHTML = `<label for="${id}"><span>${t(q.label)}</span> <b id="${id}-v"></b></label><input type="range" id="${id}" min="${q.min}" max="${q.max}" step="${q.step}">`;
    box.append(div);
    const input = div.querySelector("input");
    input.value = P()[q.k];
    input.addEventListener("input", () => {
      P()[q.k] = +input.value;
      $(id + "-v").textContent = fmtParam(q, +input.value);
      setPlaying(false);
      rebuild();
      save();
    });
  }
  syncParams();
}
function syncParams() {
  for (const q of sceneById(st.scene).params) {
    if (q.hidden) continue;
    const input = $("par-" + q.k);
    if (!input) continue;
    input.value = P()[q.k];
    $("par-" + q.k + "-v").textContent = fmtParam(q, P()[q.k]);
  }
}

// restitution, stick, bumpers
function syncCollision() {
  $("eR").value = st.e;
  $("eL").textContent = fmtNum(st.e, 2);
  segSync($("eSeg"), st.e);
  $("eR").disabled = st.sticky;
  $("eSeg").classList.toggle("dim", st.sticky);
  $("tgStick").setAttribute("aria-pressed", String(st.sticky));
  $("tgWalls").setAttribute("aria-pressed", String(st.walls));
}
function changed() {
  syncCollision();
  setPlaying(false);
  rebuild();
  save();
}
$("eR").addEventListener("input", () => {
  st.e = +$("eR").value;
  changed();
});
$("eSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || st.sticky) return;
  st.e = +b.dataset.v;
  changed();
});
$("tgStick").addEventListener("click", () => {
  st.sticky = !st.sticky;
  changed();
});
$("tgWalls").addEventListener("click", () => {
  st.walls = !st.walls;
  changed();
});
function syncShow() {
  for (const b of $$("[data-show]")) b.setAttribute("aria-pressed", String(!!show[b.dataset.show]));
}
for (const b of $$("[data-show]")) {
  b.addEventListener("click", () => {
    show[b.dataset.show] = !show[b.dataset.show];
    b.setAttribute("aria-pressed", String(show[b.dataset.show]));
    if (pres.show) {
      pres.show = SHOW_KEYS.filter((k) => show[k]);
      save();
    } else store.setJSON("show", show);
    dirty = true;
  });
}

// ---------- tabs ----------
const tabs = $$(".tab");
let tabIndex = 0;
function showTab(i) {
  tabIndex = i;
  tabs.forEach((b, j) => {
    b.setAttribute("aria-selected", String(i === j));
    b.tabIndex = i === j ? 0 : -1;
    $(b.getAttribute("aria-controls")).hidden = i !== j;
  });
  if (pres.tab != null) {
    if (pres.tab !== i) (pres.tab = i), save();
  } else store.set("tab", String(i));
  dirty = true;
}
tabs.forEach((b, i) => {
  b.addEventListener("click", () => showTab(i));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    e.stopPropagation();
    const n = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    showTab(n);
    tabs[n].focus();
  });
});

// ---------- keyboard (DESIGN.md §12) ----------
addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
  if (e.target.closest("input, select, textarea, [role=tab], .menu")) return;
  if (e.key === " ") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    doStep();
  } else if (e.key === "r" || e.key === "R") doReset();
  else if (e.key === "c" || e.key === "C") setFrame(st.frame === "cm" ? "lab" : "cm");
});

// ---------- dragging on the table ----------
const cv = $("cv");
const stage = createStage(cv);
const atStart = () => world.t === 0;
const canDrag = () => atStart() && st.frame === "lab";
function localXY(e) {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
cv.addEventListener("pointerdown", (e) => {
  const [x, y] = localXY(e);
  if (!canDrag()) {
    if (!atStart()) {
      const w = stage.toWorld(x, y);
      if (states(world).some((s, i) => Math.hypot(s.x - w.x, s.y - w.y) < world.discs[i].r + 0.03)) toast(t("toast.locked"));
    }
    return;
  }
  const h = stage.pick(handles, x, y, e.pointerType === "touch");
  if (!h) return;
  drag = { body: h.body, kind: h.kind };
  cv.setPointerCapture(e.pointerId);
  cv.classList.add("held");
  e.preventDefault();
});
cv.addEventListener("pointermove", (e) => {
  const [x, y] = localXY(e);
  if (drag) {
    const h = handles.find((k) => k.body === drag.body && k.kind === drag.kind);
    const w = stage.toWorld(x, y);
    h.set(P(), w.x, w.y, h);
    rebuild();
    syncParams();
    return;
  }
  if (e.pointerType === "touch") return;
  const h = canDrag() ? stage.pick(handles, x, y, false) : null;
  if (h !== hover) {
    hover = h;
    dirty = true;
  }
  cv.classList.toggle("setup", !!h);
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  cv.classList.remove("held");
  save();
};
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("pointerleave", () => {
  if (hover && !drag) {
    hover = null;
    dirty = true;
  }
});

// ---------- graphs: quantity and series chips ----------
let gq = DEFAULT_QUANTITY;
const hiddenSeries = new Set();
function setQuantity(q, fromUser = true) {
  gq = q;
  $("gq").value = q;
  if (fromUser && pres.g) (pres.g = q), save();
  dirty = true;
}
$("gq").addEventListener("change", () => setQuantity($("gq").value));
function buildChips() {
  const box = $("gchips");
  const extra = extraKind(gq) === "cm" ? ["tot", t("g.cm"), C.ink] : ["tot", t("b.total"), gq === "K" ? C.ek : gq.startsWith("v") ? C.vel : C.mom];
  const items = world.discs.map((d, i) => [d.label, d.label, fillOf(C, i)]).concat([extra]);
  box.innerHTML = items
    .map(([k, name, col]) => `<button type="button" class="lg${hiddenSeries.has(k) ? "" : " on"}" data-k="${k}" aria-pressed="${!hiddenSeries.has(k)}"><i style="background:${col}"></i>${name}</button>`)
    .join("");
}
$("gchips").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const k = b.dataset.k;
  hiddenSeries.has(k) ? hiddenSeries.delete(k) : hiddenSeries.add(k);
  dirty = true;
});
$("csvBtn").addEventListener("click", () => {
  const csv = buildCsv(world.discs, rec);
  const out = $("csvOut");
  out.value = csv;
  out.hidden = false;
  navigator.clipboard?.writeText(csv).then(
    () => toast(t("csv.copied")),
    () => out.select(),
  );
});

// ---------- drawing ----------
let C = readColors(EXTRA_COLORS);
function frameV(T) {
  return st.frame === "cm" ? { vx: T.Vx, vy: T.Vy } : null;
}
function joints() {
  const out = [];
  for (const c of world.clusters)
    for (let a = 0; a < c.members.length; a++)
      for (let b = a + 1; b < c.members.length; b++) {
        const i = c.members[a].d, j = c.members[b].d;
        const s = states(world), R = world.discs[i].r + world.discs[j].r;
        if (Math.abs(Math.hypot(s[j].x - s[i].x, s[j].y - s[i].y) - R) < 1e-4) out.push([i, j]);
      }
  return out;
}
let panelClock = 0, chipsKey = "";
function render(now) {
  const Tlab = totals(world);
  const cm = st.frame === "cm";
  const T = totals(world, frameV(Tlab));
  const S = T.per.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
  stage.draw({
    C, S, T, show, handles, hover, joints: joints(),
    discs: world.discs,
    shift: cm ? { x: Tlab.X - T0.X, y: Tlab.Y - T0.Y } : { x: 0, y: 0 },
    cmFrame: cm, X0: T0.X, Y0: T0.Y,
    history: rec, strobeEvery: Math.round(0.1 / SAMPLE),
    setup: canDrag(), walls: st.walls,
  });
  $("clock").textContent = `t = ${fmtNum(world.t, 2, "s")}`;
  $("readout").innerHTML =
    `<span>${toHTML("P_x")}</span><b>${fmtNum(T.Px, 3, "kg·m/s")}</b><span>${toHTML("P_y")}</span><b>${fmtNum(T.Py, 3, "kg·m/s")}</b>` +
    `<span>K</span><b>${fmtNum(T.K, 3, "J")}</b>` + (cm ? `<span class="tag">${t("ro.cm")}</span>` : "");
  $("hint").textContent = canDrag() ? t("hint.setup") : cm ? t("hint.cm") : atStart() ? "" : t("hint.running");
  cv.classList.toggle("setup", canDrag() && !!hover);

  // panels: at most ~12 times a second while running
  if (playing && now - panelClock < 80) return;
  panelClock = now;
  const T0f = totals(world0, frameV(T0));
  if (tabIndex === 0) {
    drawMomentum($("pcv"), C, world.discs, T0f, T);
    fillTables($("ptab"), $("ktab"), C, world.discs, T0f, T);
    drawEnergy($("kcv"), C, T0f, T);
    $("verdict").innerHTML = verdict(Tlab);
    $("frameNote").textContent = t(cm ? "b.frameCm" : "b.frameLab");
  } else if (tabIndex === 1) {
    const key = world.discs.length + gq + hiddenSeries.size + st.scene;
    if (key !== chipsKey) buildChips(), (chipsKey = key);
    graph();
  }
}
function verdict(Tlab) {
  if (atStart()) return t("v.waiting");
  const hits = world.events.filter((e) => e.kind !== "wall");
  let s;
  if (splitDone) s = t("v.split", { E: fmtNum(split.E, 2, "J") });
  else if (!hits.length) return t("v.waiting");
  else if (world.clusters.length === 1 || (Tlab.Kint < 1e-9 && T0.Kint > 1e-6)) s = t("v.perfect");
  else if (T0.K - Tlab.K < 1e-9 * Math.max(1, T0.K)) s = t("v.elastic");
  else s = t("v.inelastic", { pct: fmtNum((100 * (T0.K - Tlab.K)) / T0.K, 1) });
  if (Math.hypot(world.ext.x, world.ext.y) > 1e-9) s += " " + t("v.walls", { jx: fmtNum(world.ext.x, 3), jy: fmtNum(world.ext.y, 3) });
  else s += " " + t("v.pkept");
  return s;
}
function graph() {
  const series = [];
  const cm = st.frame === "cm";
  world.discs.forEach((d, i) => {
    if (hiddenSeries.has(d.label)) return;
    series.push({ data: rec.map((s) => [s.t, valueOf(gq, s, d, i, cm)]), color: lineOf(C, i), width: 2 });
  });
  if (!hiddenSeries.has("tot")) {
    const kind = extraKind(gq);
    const color = kind === "cm" ? C.ink : gq === "K" ? C.ek : gq.startsWith("v") ? C.vel : C.mom;
    series.push({ data: rec.map((s) => [s.t, extraOf(gq, s, world.discs, cm)]), color, width: kind === "cm" ? 2 : 3, dash: kind === "cm" ? [6, 4] : null });
  }
  const events = [];
  for (const e of world.events) if (!events.length || e.t - events[events.length - 1] > 0.05) events.push(e.t);
  drawGraph($("gcv"), C, { series, tmax: Math.max(2, Math.ceil(world.t)), cursor: world.t, events, ylabel: axisLabel(gq) });
}

let last = 0;
function loop(now) {
  if (playing && !drag) {
    if (last) advance(Math.min(0.05, (now - last) / 1000) * speed);
    last = now;
  } else last = 0;
  if (playing || dirty) {
    dirty = false;
    render(now);
  }
  requestAnimationFrame(loop);
}

// ---------- start ----------
function relabel() {
  buildParams();
  setPlaying(playing);
  chipsKey = "";
  dirty = true;
}
onLang(relabel);
onTheme(() => {
  C = readColors(EXTRA_COLORS);
  chipsKey = "";
  dirty = true;
});
const ro = new ResizeObserver(() => {
  stage.resize();
  dirty = true;
});
ro.observe(cv);
for (const id of ["pcv", "kcv", "gcv"]) ro.observe($(id));
document.fonts?.ready.then(() => (dirty = true));

// everything that depends on the link: also used by "back to the linked scene"
function applyAll() {
  applyShow();
  syncShow();
  setPlaying(false);
  rebuild();
  buildParams();
  syncCollision();
  segSync($("frameSeg"), st.frame);
  setQuantity(pres.g || DEFAULT_QUANTITY, false);
  showTab(pres.tab ?? Math.min(2, Math.max(0, +(store.get("tab") || 0))));
  save();
}
applyAll();
stage.resize();
requestAnimationFrame(loop);
