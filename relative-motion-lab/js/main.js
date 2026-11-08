// Relative Motion Lab: Animation loop, resizing and start-up.
import { $$ } from "./dom.js";
import { PRESETS } from "./presets.js";
import { ui, st, loadPreset } from "./state.js";
import { readColors, initCanvas } from "./canvas.js";
import { resizeAll } from "./layout.js";
import { drawPanel } from "./panels.js";
import { drawVec } from "./vectors.js";
import { drawGraph } from "./graphs.js";
import { updateTable } from "./compare.js";
import { updatePlay, updateScrub, initControls } from "./controls.js";
import { initSetup } from "./setup.js";
import { initPredict } from "./predict.js";

export function frame(ts) {
  if (st.playing) {
    if (ui.last) {
      st.t += Math.min(0.1, (ts - ui.last) / 1000) * st.rate * st.speed;
      if (st.t >= st.T) {
        st.t = st.T;
        st.playing = false;
        updatePlay();
      }
    }
    ui.last = ts;
    ui.dirty = true;
  } else ui.last = 0;
  if (ui.dirty) {
    ui.dirty = false;
    drawPanel("S");
    drawPanel("P");
    if (st.tab === "vec") drawVec();
    else if (st.tab === "gr") drawGraph();
    else if (st.tab === "cmp") updateTable();
    updateScrub();
  }
  requestAnimationFrame(frame);
}
export const ro = new ResizeObserver(() => resizeAll());
export const h0 = location.hash.slice(1);
// start-up
initCanvas();
initSetup();
initPredict();
initControls();
$$(".cv,.vcv,.gcv").forEach((el) => ro.observe(el));
addEventListener("resize", () => requestAnimationFrame(resizeAll));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  readColors();
  ui.dirty = true;
});
new MutationObserver(() => {
  readColors();
  ui.dirty = true;
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (PRESETS[h] && h !== st.id) loadPreset(h);
});
readColors();
loadPreset(PRESETS[h0] ? h0 : "walk");
resizeAll();
if (document.fonts)
  document.fonts.ready.then(() => {
    ui.dirty = true;
  });
requestAnimationFrame(frame);
