// Series Lab · main.js
// Entry point: kit setup, state, controls, animation loop, canvas interaction.
import { initKit, t, icon, readColors, onTheme, onLang, getLang, fmtNum, fmtSci, parseNum, store, toast } from "../../kit/kit.js";
import { toHTML, plain } from "../../kit/mathtext.js";
import STRINGS from "./strings.js";
import { compile, ExprError } from "./expr.js";
import { computeSeries, limitEstimate, PRESETS, LIMITS, encodeState, decodeState, toCSV } from "./series.js";
import { drawPlane, drawParts, drawMod, drawField, paintFieldImage, plotRect, MARGIN } from "./render.js";
import { Field } from "./field.js";

const VERSION = "0.1.0";
const RATE = 5; // terms per second at 1×
const $ = (id) => document.getElementById(id);

// ---------- state ----------
const DEFAULTS = {
  expr: PRESETS[0].expr,
  n0: PRESETS[0].n0,
  z: [...PRESETS[0].z],
  nMax: PRESETS[0].nMax,
  view: "plane",
  fmode: "sum",
  cols: 56,
  frame: "follow",
  speed: 4,
  opts: { line: true, dots: true, term: true, limit: true, log: true },
  legend: { re: true, im: true, a: true, s: true },
};
const saved = store.getJSON("state", {}) || {};
const fromHash = decodeState(location.hash);
const S = {
  ...structuredClone(DEFAULTS),
  ...pick(saved, ["expr", "n0", "z", "nMax", "view", "frame", "speed", "fmode", "cols"]),
  opts: { ...DEFAULTS.opts, ...(saved.opts || {}) },
  legend: { ...DEFAULTS.legend },
  ...pick(fromHash, ["expr", "n0", "z", "nMax"]),
  k: 0,
  running: false,
  acc: 0,
  V: { cx: 0, cy: 0, s: 1 },
  F: { cx: 0, cy: 0, s: null }, // window of the field view (s = pixels per unit, null: fit |z| ≤ 2.2)
  hover: null,
  series: null,
  prog: null,
};
if (!["plane", "parts", "mod", "field"].includes(S.view)) S.view = "plane";
if (!["sum", "term"].includes(S.fmode)) S.fmode = "sum";
S.cols = Math.min(120, Math.max(16, Math.round(+S.cols) || 56));
if (!["follow", "all"].includes(S.frame)) S.frame = "follow";
function pick(o, keys) {
  const r = {};
  for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k];
  return r;
}

initKit({
  slug: "series-lab",
  name: "Series Lab",
  version: VERSION,
  strings: STRINGS,
  menu: [
    { icon: "link", label: "menu.share", onClick: share },
    { icon: "download", label: "menu.csv", onClick: exportCSV },
    { icon: "reset", label: "menu.reset", onClick: () => { store.remove("state"); history.replaceState(null, "", location.pathname); location.reload(); } },
  ],
});
for (const b of document.querySelectorAll("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));

// ---------- formatting ----------
function fmtSig(x, sig = 4) {
  if (x === 0 || Math.abs(x) < 1e-300) return fmtNum(0, 0);
  const a = Math.abs(x);
  if (a >= 1e6 || a < 1e-3) return fmtSci(x, sig - 1);
  return fmtNum(x, Math.min(8, Math.max(0, sig - 1 - Math.floor(Math.log10(a)))));
}
const fmtC = (re, im, sig = 4) => `${fmtSig(re, sig)} ${im < 0 ? "−" : "+"} ${fmtSig(Math.abs(im), sig)} i`;
const fmtPlain = (v) => {
  const s = String(+Number(v).toFixed(6)).replace("-", "−");
  return getLang() === "it" ? s.replace(".", ",") : s;
};

// ---------- tabs (arrow keys move between them) ----------
const tabs = [...document.querySelectorAll(".tab")];
function showTab(i, focus) {
  tabs.forEach((b, j) => {
    b.setAttribute("aria-selected", String(i === j));
    b.tabIndex = i === j ? 0 : -1;
    $(b.getAttribute("aria-controls")).hidden = i !== j;
  });
  if (focus) tabs[i].focus();
  refreshTable();
}
tabs.forEach((b, i) => {
  b.addEventListener("click", () => showTab(i));
  b.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      showTab((i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true);
    }
  });
});
showTab(0);

// ---------- series ----------
let compiled = null;
function setExpr(src) {
  // returns true when the expression is valid and now in use
  try {
    compiled = compile(src);
    S.expr = src;
    $("expr").setAttribute("aria-invalid", "false");
    if (S.series) syncHint();
    return true;
  } catch (e) {
    if (!(e instanceof ExprError)) throw e;
    $("expr").setAttribute("aria-invalid", "true");
    $("exprErr").textContent = t("err." + e.code, e.params);
    return false;
  }
}
const kMax = () => S.nMax - S.n0; // last cursor position: the cursor also runs past a series that stops early (field view)
function recompute(keepK = false) {
  S.series = computeSeries(compiled.fn, S.n0, S.nMax, S.z);
  const s = S.series;
  S.k = keepK ? Math.min(S.k, kMax()) : kMax();
  $("nSlider").max = kMax();
  $("exprErr").textContent = s.stoppedAt != null ? t("err.stopped", { n: s.stoppedAt }) : "";
  syncUI();
}
function applyPreset(p) {
  S.running = false;
  S.n0 = p.n0;
  S.z = [...p.z];
  S.nMax = p.nMax;
  setExpr(p.expr);
  fillFields();
  recompute();
  S.frame = S.frame === "free" ? "follow" : S.frame;
  persist();
}
function persist() {
  store.setJSON("state", { expr: S.expr, n0: S.n0, z: S.z, nMax: S.nMax, view: S.view, frame: S.frame === "free" ? "follow" : S.frame, speed: S.speed, fmode: S.fmode, cols: S.cols, opts: S.opts });
}

// ---------- fields ----------
function fillFields() {
  $("expr").value = S.expr;
  $("n0").value = fmtPlain(S.n0);
  $("nMax").value = fmtPlain(S.nMax);
  $("zRe").value = fmtPlain(S.z[0]);
  $("zIm").value = fmtPlain(S.z[1]);
  for (const id of ["n0", "nMax", "zRe", "zIm"]) $(id).setAttribute("aria-invalid", "false");
  syncPreset();
}
function buildPresets() {
  $("preset").innerHTML =
    PRESETS.map((p) => `<option value="${p.id}">${t("preset." + p.id)} · ${p.expr}</option>`).join("") + `<option value="custom">${t("p.custom")}</option>`;
  syncPreset();
}
function syncPreset() {
  const p = PRESETS.find((p) => p.expr.replace(/\s/g, "") === S.expr.replace(/\s/g, ""));
  $("preset").value = p ? p.id : "custom";
}
$("preset").addEventListener("change", (e) => {
  const p = PRESETS.find((p) => p.id === e.target.value);
  if (p) applyPreset(p);
});
$("expr").addEventListener("input", (e) => {
  const v = e.target.value;
  $("exprErr").textContent = "";
  if (!v.trim()) {
    $("expr").setAttribute("aria-invalid", "true");
    $("exprErr").textContent = t("err.empty");
    return;
  }
  if (setExpr(v)) {
    S.running = false;
    recompute();
    syncPreset();
    persist();
    draw();
  }
});
function readInt(id, lo, hi) {
  const v = parseNum($(id).value);
  return Number.isInteger(v) && v >= lo && v <= hi ? v : null;
}
function onRange() {
  const n0 = readInt("n0", -1000, 1000),
    nMax = readInt("nMax", 1, LIMITS.nMax);
  if (n0 === null || nMax === null || n0 > nMax) {
    toast(t("err.badIndex"));
    for (const id of ["n0", "nMax"]) $(id).setAttribute("aria-invalid", "true");
    return;
  }
  S.n0 = n0;
  S.nMax = nMax;
  for (const id of ["n0", "nMax"]) $(id).setAttribute("aria-invalid", "false");
  S.running = false;
  recompute();
  persist();
  draw();
}
$("n0").addEventListener("change", onRange);
$("nMax").addEventListener("change", onRange);
function onZ() {
  const re = parseNum($("zRe").value),
    im = parseNum($("zIm").value);
  if (Number.isNaN(re) || Number.isNaN(im)) return; // the kit already marks the field and shows a toast
  S.z = [re, im];
  recompute(true);
  syncPreset();
  persist();
  draw();
}
$("zRe").addEventListener("change", onZ);
$("zIm").addEventListener("change", onZ);

// quick insert chips
const INSERTS = [["n"], ["z"], ["i"], ["π"], ["^"], ["(", ")"], ["exp(", ")"], ["ln(", ")"], ["sin(", ")"], ["cos(", ")"], ["sqrt(", ")"], ["!"]];
$("insert").innerHTML = INSERTS.map((x, i) => `<button class="lg on" type="button" data-i="${i}">${x[0]}${x[1] ? x[1] : ""}</button>`).join("");
$("insert").addEventListener("mousedown", (e) => e.preventDefault()); // keep the caret in the field
$("insert").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const [open, close = ""] = INSERTS[+b.dataset.i];
  const el = $("expr"),
    a = el.selectionStart ?? el.value.length,
    z = el.selectionEnd ?? a;
  const inner = close ? el.value.slice(a, z) : "";
  el.setRangeText(open + inner + close, a, z, "end");
  if (close) el.setSelectionRange(a + open.length + inner.length, a + open.length + inner.length);
  el.focus();
  el.dispatchEvent(new Event("input", { bubbles: true }));
});

// ---------- view options ----------
function syncSeg(id, attr, val) {
  for (const b of $(id).querySelectorAll("button")) b.classList.toggle("on", b.dataset[attr] === String(val));
}
function buildLegend() {
  const defs = {
    parts: [["re", "pos", "lg.re"], ["im", "acc", "lg.im"]],
    mod: [["a", "force", "lg.a"], ["s", "pos", "lg.s"]],
  }[S.view] || [];
  $("legend").innerHTML = defs
    .map(([k, col, key]) => `<button class="lg${S.legend[k] ? " on" : ""}" type="button" data-k="${k}" style="color:var(--${col})"><i class="sw"></i>${toHTML(t(key))}</button>`)
    .join("");
  $("legend").hidden = !defs.length;
}
$("legend").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  S.legend[b.dataset.k] = !S.legend[b.dataset.k];
  b.classList.toggle("on", S.legend[b.dataset.k]);
  draw();
});
function syncHint() {
  const noZ = S.view === "field" && compiled && !compiled.names.has("z");
  $("hint").textContent = t(noZ ? "hint.fieldNoZ" : { plane: "hint.plane", field: "hint.field" }[S.view] || "hint.plot");
}
function syncFieldNote() {
  $("fieldNote").textContent = t(S.fmode === "sum" ? "field.noteSum" : "field.noteTerm");
  $("colsOut").textContent = `${S.cols} × ${Math.ceil((S.cols * (cv.getBoundingClientRect().height || 1)) / Math.max(1, cv.getBoundingClientRect().width))}`;
}
function setView(v) {
  S.view = v;
  syncSeg("viewSeg", "view", v);
  syncHint();
  buildLegend();
  persist();
  draw();
}
$("viewSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) setView(b.dataset.view);
});
function setFrame(f) {
  S.frame = f;
  syncSeg("frameSeg", "frame", f);
  persist();
  draw();
}
$("frameSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) setFrame(b.dataset.frame);
});
for (const b of document.querySelectorAll("[data-opt]")) {
  b.setAttribute("aria-pressed", String(!!S.opts[b.dataset.opt]));
  b.addEventListener("click", () => {
    S.opts[b.dataset.opt] = !S.opts[b.dataset.opt];
    b.setAttribute("aria-pressed", String(S.opts[b.dataset.opt]));
    persist();
    draw();
  });
}
$("fieldSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  S.fmode = b.dataset.fmode;
  syncSeg("fieldSeg", "fmode", S.fmode);
  syncFieldNote();
  persist();
  fieldShown = null;
  draw();
});
$("cols").value = S.cols;
$("cols").addEventListener("input", (e) => {
  S.cols = +e.target.value;
  syncFieldNote();
  persist();
  draw();
});
$("fieldReset").addEventListener("click", () => {
  S.F = { cx: 0, cy: 0, s: null };
  draw();
});
$("speedSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  S.speed = +b.dataset.speed;
  syncSeg("speedSeg", "speed", S.speed);
  persist();
});

// ---------- transport ----------
function setRunning(on) {
  S.running = on;
  if (on) {
    if (S.k >= kMax()) S.k = 0;
    S.acc = 0;
    last = 0;
    requestAnimationFrame(loop);
  }
  syncUI();
}
function step(n = 1) {
  S.k = Math.min(kMax(), S.k + n);
  if (S.k >= kMax()) S.running = false;
  syncUI();
  draw();
}
$("playBtn").addEventListener("click", () => setRunning(!S.running));
$("stepBtn").addEventListener("click", () => {
  S.running = false;
  if (S.k >= kMax()) S.k = 0;
  else S.k++;
  syncUI();
  draw();
});
$("resetBtn").addEventListener("click", () => {
  S.running = false;
  S.k = 0;
  syncUI();
  draw();
});
$("nSlider").addEventListener("input", (e) => {
  S.running = false;
  S.k = +e.target.value;
  syncUI();
  draw();
});
let last = 0;
function loop(now) {
  if (!S.running) return;
  if (last) {
    S.acc += Math.min(0.1, (now - last) / 1000) * RATE * S.speed;
    const n = Math.floor(S.acc);
    if (n) {
      S.acc -= n;
      step(n);
    }
  }
  last = now;
  if (S.running) requestAnimationFrame(loop);
}
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " " && !e.target.closest("button")) (e.preventDefault(), setRunning(!S.running));
  else if (e.key === "ArrowRight" && !e.target.closest("[role=tab]")) $("stepBtn").click();
  else if (e.key === "r" || e.key === "R") $("resetBtn").click();
});

// ---------- readout, table, text ----------
function current() {
  const s = S.series,
    k = Math.max(0, Math.min(S.k, s.count - 1));
  return { s, k, n: s.n0 + k };
}
function syncUI() {
  const { s, k, n } = current();
  $("playBtn").querySelector(".lbl").textContent = t(S.running ? "pause" : "play");
  const ic = $("playBtn").querySelector("svg");
  if (ic) ic.outerHTML = icon(S.running ? "pause" : "play");
  $("clock").textContent = `n = ${S.n0 + S.k}`;
  $("nSlider").value = S.k;
  $("nOut").textContent = String(S.k + 1);
  const est = S.opts.limit ? limitEstimate(s, k) : null;
  const rows = [
    ...(S.view === "field" ? [["ro.z", fmtC(S.z[0], S.z[1])]] : []),
    ["ro.n", String(n)],
    ["ro.a", fmtC(s.aRe[k], s.aIm[k]), 1],
    ["ro.s", fmtC(s.sRe[k], s.sIm[k])],
    ["ro.abs", fmtSig(Math.hypot(s.sRe[k], s.sIm[k])), 1],
  ];
  if (S.opts.limit) rows.push(["ro.lim", est ? fmtC(est[0], est[1]) : "—"]);
  $("readout").innerHTML = rows.map(([key, v, opt]) => `<span${opt ? ' class="opt"' : ""}>${toHTML(t(key))}</span><b${opt ? ' class="opt"' : ""}>${v}</b>`).join("");
  $("cv").setAttribute("aria-label", `${t("stage")}: n = ${n}, ${plain(t("ro.s"))} = ${fmtC(s.sRe[k], s.sIm[k])}`);
  refreshTable();
}
function refreshTable() {
  if ($("pane-values").hidden || !S.series) return;
  const { s, k } = current();
  $("thead").innerHTML = `<tr>${["n", "Re a_n", "Im a_n", "Re S_n", "Im S_n"].map((x) => `<th>${toHTML(x)}</th>`).join("")}</tr>`;
  let h = "";
  for (let i = Math.max(0, k - 13); i <= k; i++)
    h += `<tr${i === k ? ' class="cur"' : ""}><td>${s.n0 + i}</td><td>${fmtSig(s.aRe[i])}</td><td>${fmtSig(s.aIm[i])}</td><td>${fmtSig(s.sRe[i])}</td><td>${fmtSig(s.sIm[i])}</td></tr>`;
  $("tbody").innerHTML = h;
}

// ---------- share and export ----------
function share() {
  const hash = encodeState({ expr: S.expr, n0: S.n0, z: S.z, nMax: S.nMax, N: S.series.n0 + S.k });
  const url = `${location.origin}${location.pathname}#${hash}`;
  navigator.clipboard?.writeText(url).then(() => toast(t("copied")), () => {});
}
function exportCSV() {
  const { s, n } = current();
  const blob = new Blob([toCSV(s, getLang(), n)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "series-lab.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t("csvDone"));
}

// ---------- drawing ----------
const cv = $("cv");
let C = readColors();
let pending = false;
function draw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    paint();
  });
}
function paint() {
  const r = cv.getBoundingClientRect(),
    dpr = devicePixelRatio || 1;
  if (!r.width || !r.height || !S.series) return;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) {
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
  }
  const hint = $("hint");
  MARGIN.b = getComputedStyle(hint).display === "none" ? 28 : 46;
  const compact = r.height < 330,
    tiny = r.height < 190;
  $("readout").hidden = tiny;
  $("readout").classList.toggle("compact", compact);
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  const { s, k, n } = current();
  if (S.view === "field") return paintFieldView(ctx, r, P0(r));
  const m = { s, k, n, V: S.V, frame: S.frame, opts: S.opts, legend: S.legend, hover: S.view === "plane" ? S.hover : null, est: S.opts.limit ? limitEstimate(s, k) : null };
  (S.view === "plane" ? drawPlane : S.view === "parts" ? drawParts : drawMod)(ctx, r.width, r.height, C, m);
}
// field view: the grid advances in time-budgeted slices; the last complete image stays on screen meanwhile
const field = new Field();
let fieldShown = null;
const P0 = (r) => plotRect(r.width, r.height);
function paintFieldView(ctx, r, P) {
  const pw = P.x1 - P.x0,
    ph = P.y1 - P.y0;
  if (!S.F.s) S.F.s = ph / 4.4;
  const cellPx = pw / S.cols,
    rows = Math.ceil(ph / cellPx);
  const geo = { cols: S.cols, rows, cx: S.F.cx, cy: S.F.cy, dx: cellPx / S.F.s };
  field.configure(compiled.fn, S.n0, geo, [S.expr, S.n0, S.cols, rows, geo.cx, geo.cy, geo.dx].join("|"));
  const done = field.advance(Math.min(S.k, kMax()), 8);
  if (!field.fromReset && field.kDone >= 0 && (!fieldShown || fieldShown.k !== field.kDone || fieldShown.sig !== field.sig)) {
    fieldShown = { ...paintFieldImage(field, S.fmode, C), k: field.kDone, sig: field.sig };
  }
  drawField(ctx, r.width, r.height, C, { F: S.F, shown: fieldShown, z: S.z, hover: S.hover, field, fmtC });
  if (!done) draw();
}
new ResizeObserver(draw).observe(cv);
onTheme(() => { C = readColors(); fieldShown = null; draw(); });
onLang(() => { buildPresets(); buildLegend(); fillFields(); syncHint(); syncFieldNote(); syncUI(); draw(); });

// ---------- pan, zoom, hover on the plane ----------
const ptrs = new Map();
let pinch = 0;
const win = () => (S.view === "field" ? S.F : S.V);
const interactive = () => S.view === "plane" || S.view === "field";
let down = null; // { x, y, moved }: tells a click from a drag in the field view
function toFree() {
  if (S.view !== "plane") return;
  if (S.frame !== "free") {
    S.frame = "free";
    syncSeg("frameSeg", "frame", "free");
  }
}
function zoomAt(px, py, f) {
  const r = cv.getBoundingClientRect(),
    P = plotRect(r.width, r.height),
    V = win();
  const mx = (P.x0 + P.x1) / 2,
    my = (P.y0 + P.y1) / 2;
  const re = V.cx + (px - mx) / V.s,
    im = V.cy - (py - my) / V.s;
  V.s = Math.min(1e12, Math.max(1e-12, V.s * f));
  V.cx = re - (px - mx) / V.s;
  V.cy = im + (py - my) / V.s;
}
const local = (e) => {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};
cv.addEventListener("pointerdown", (e) => {
  if (!interactive()) return;
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, local(e));
  down = ptrs.size === 1 ? { p: local(e), moved: false } : null;
  pinch = 0;
  S.hover = null;
});
cv.addEventListener("pointermove", (e) => {
  if (!interactive()) return;
  const p = local(e);
  if (!ptrs.has(e.pointerId)) {
    if (e.pointerType === "mouse") (S.hover = { x: p[0], y: p[1] }), draw();
    return;
  }
  if (down && !down.moved) {
    if (Math.hypot(p[0] - down.p[0], p[1] - down.p[1]) <= 4) return;
    down.moved = true;
  }
  const prev = ptrs.get(e.pointerId);
  ptrs.set(e.pointerId, p);
  toFree();
  const V = win();
  if (ptrs.size === 1) {
    V.cx -= (p[0] - prev[0]) / V.s;
    V.cy += (p[1] - prev[1]) / V.s;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch);
    pinch = d;
  }
  draw();
});
const endPtr = (e) => {
  ptrs.delete(e.pointerId);
  pinch = 0;
};
// a click in the field view picks the sample point z; its path is then in the Plane view
function pickZ(x, y) {
  const r = cv.getBoundingClientRect(),
    P = plotRect(r.width, r.height),
    F = S.F;
  S.z = [+(F.cx + (x - (P.x0 + P.x1) / 2) / F.s).toFixed(4), +(F.cy - (y - (P.y0 + P.y1) / 2) / F.s).toFixed(4)];
  fillFields();
  recompute(true);
  persist();
  draw();
}
cv.addEventListener("pointerup", (e) => {
  if (S.view === "field" && down && !down.moved && ptrs.size === 1 && e.type === "pointerup") pickZ(...local(e));
  down = null;
  endPtr(e);
});
cv.addEventListener("pointercancel", (e) => {
  down = null;
  endPtr(e);
});
cv.addEventListener("pointerleave", (e) => {
  if (e.pointerType === "mouse" && S.hover) (S.hover = null), draw();
});
cv.addEventListener("wheel", (e) => {
  if (!interactive()) return;
  e.preventDefault();
  toFree();
  const [x, y] = local(e);
  zoomAt(x, y, Math.exp(-e.deltaY * 0.0015));
  draw();
}, { passive: false });
cv.addEventListener("dblclick", () => {
  if (S.view === "plane") setFrame("follow");
  else if (S.view === "field") setView("plane");
});

// ---------- start ----------
if (!setExpr(S.expr)) setExpr(DEFAULTS.expr);
buildPresets();
fillFields();
recompute();
if (fromHash.N !== undefined) S.k = Math.max(0, Math.min(kMax(), fromHash.N - S.n0));
syncSeg("speedSeg", "speed", S.speed);
syncSeg("frameSeg", "frame", S.frame);
syncSeg("fieldSeg", "fmode", S.fmode);
syncFieldNote();
setView(S.view);
syncUI();
