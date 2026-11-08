// Relative Motion Lab: Toolbar, view switch, tabs, transport and keyboard.
import { $, $$ } from "./dom.js";
import { PRESETS } from "./presets.js";
import { ui, st, loadPreset } from "./state.js";
import { layout, resizeAll } from "./layout.js";
import { f2 } from "./panels.js";
import { updateFrameMsg } from "./compare.js";

export const presetSel = $("#presetSel");
export function syncUI() {
  const [n1, n2] = st.names,
    cu = st.id === "custom";
  $("#tS").textContent = cu ? "Seen from S" : "Seen from " + n1;
  $("#tP").textContent = cu ? "Seen from S′" : "Seen from " + n2;
  $("#note").innerHTML = "<b>Look closely.</b> " + st.note;
  $('#inSeg button[data-in="S"]').textContent = cu ? "S" : "S, " + n1.replace(/^the /, "");
  $('#inSeg button[data-in="P"]').textContent = cu ? "S′" : "S′, " + n2.replace(/^the /, "");
  updateFrameMsg();
  updatePlay();
  updateScrub();
}
export function updatePlay() {
  $("#playIcon").textContent = st.playing ? "pause" : "play_arrow";
  $("#playBtn").setAttribute("aria-label", st.playing ? "Pause" : "Play");
}
export function updateScrub() {
  $("#scrub").value = Math.round((st.t / st.T) * 1000);
  $("#tRead").textContent = `t = ${f2(st.t)} ${st.units[1]}`;
}
export function togglePlay() {
  if (!st.playing && st.t >= st.T - 1e-9) st.t = 0;
  st.playing = !st.playing;
  ui.last = 0;
  updatePlay();
  ui.dirty = true;
}
export function stepT(d) {
  st.playing = false;
  updatePlay();
  st.t = Math.min(st.T, Math.max(0, st.t + (d * st.T) / 100));
  ui.dirty = true;
}
export function initControls() {
  presetSel.innerHTML = Object.entries(PRESETS)
    .map(([k, v]) => `<option value="${k}">${v.title}</option>`)
    .join("");
  presetSel.addEventListener("change", (e) => loadPreset(e.target.value));
  $("#tokens").innerHTML = Object.keys(PRESETS)
    .map((k) => `<code>#${k}</code>`)
    .join(", ");
  $("#legend2").innerHTML = $("#legend").innerHTML;
  $("#note").addEventListener("click", (e) => e.currentTarget.classList.toggle("open"));
  $("#viewSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || st.pred.on) return;
    st.view = b.dataset.v;
    $$("#viewSeg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $("#panels").dataset.view = st.view;
    requestAnimationFrame(resizeAll);
  });
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip[data-k]");
    if (!b) return;
    const k = b.dataset.k;
    st.show[k] = !st.show[k];
    b.setAttribute("aria-pressed", st.show[k]);
    if (k === "same") layout();
    ui.dirty = true;
  });
  $("#trailSel").addEventListener("change", (e) => {
    st.trail = e.target.value;
    ui.dirty = true;
  });
  $("#vecSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    st.vq = b.dataset.q;
    $$("#vecSeg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    ui.dirty = true;
  });
  $("#grSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    st.gq = b.dataset.g;
    $$("#grSeg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    ui.dirty = true;
  });
  $$(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      st.tab = t.dataset.tab;
      $$(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
      $$(".pane").forEach((p) => (p.hidden = p.dataset.pane !== st.tab));
      requestAnimationFrame(resizeAll);
    }),
  );
  $("#speedSel").addEventListener("change", (e) => {
    st.speed = +e.target.value;
  });
  $("#playBtn").addEventListener("click", togglePlay);
  $("#backBtn").addEventListener("click", () => stepT(-1));
  $("#fwdBtn").addEventListener("click", () => stepT(1));
  $("#resetBtn").addEventListener("click", () => {
    st.playing = false;
    st.t = 0;
    updatePlay();
    ui.dirty = true;
  });
  $("#scrub").addEventListener("input", (e) => {
    st.playing = false;
    updatePlay();
    st.t = (+e.target.value / 1000) * st.T;
    ui.dirty = true;
  });
  document.addEventListener("keydown", (e) => {
    if ($("#help").open || e.target.matches("input,select,textarea")) return;
    if (e.key === " ") {
      if (e.target.closest("button")) return;
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepT(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepT(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      st.playing = false;
      st.t = 0;
      updatePlay();
      ui.dirty = true;
    }
  });
  $$("[data-help]").forEach((b) => b.addEventListener("click", () => $("#help").showModal()));
  $("#helpClose").addEventListener("click", () => $("#help").close());
}
