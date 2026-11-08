// Relative Motion Lab: Application state, units and loading a scenario.
import { $ } from "./dom.js";
import { PRESETS } from "./presets.js";
import { refit } from "./layout.js";
import { buildSetup } from "./setup.js";
import { endPredict } from "./predict.js";
import { syncUI } from "./controls.js";

export const ui = { dirty: true, last: 0, dpr: 1 };
export const st = {
  id: "walk",
  t: 0,
  playing: false,
  speed: 1,
  view: "both",
  show: { dr: true, v: true, a: false, frame: true, grid: true, same: false },
  trail: "line",
  vq: "v",
  gq: "x",
  tab: "vec",
  edited: false,
  pred: { on: false, panel: "S", strokes: [] },
};
export const clone = (o) => JSON.parse(JSON.stringify(o));
export function loadPreset(id) {
  const P = PRESETS[id] || PRESETS.walk;
  st.id = PRESETS[id] ? id : "walk";
  st.names = P.names.slice();
  st.units = (P.units || ["m", "s"]).slice();
  st.T = P.T;
  st.rate = P.rate;
  st.frame = clone(P.frame);
  st.obj = clone(P.obj);
  st.rot = clone(P.rot || { Om: 0, th0: 0 });
  st.ground = clone(P.ground || []);
  st.bodiesS = clone(P.bodiesS || []);
  st.bodiesP = clone(P.bodiesP || []);
  st.note = P.note;
  st.t = 0;
  st.playing = false;
  st.edited = false;
  endPredict(true);
  $("#presetSel").value = st.id;
  try {
    history.replaceState(null, "", "#" + st.id);
  } catch (e) {}
  syncUI();
  buildSetup();
  refit();
}
export const U = (k) => {
  const [L, T] = st.units;
  return { L, V: L + "/" + T, A: L + "/" + T + "²", W: "rad/" + T, D: "°", T }[k];
};
