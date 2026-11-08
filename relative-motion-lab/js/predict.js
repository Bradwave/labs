// Relative Motion Lab: Predict, then reveal: sketching the expected path.
import { $, $$ } from "./dom.js";
import { ui, st } from "./state.js";
import { pan } from "./canvas.js";
import { resizeAll } from "./layout.js";
import { updatePlay } from "./controls.js";

export const pov = $("#pov");
export function startPredict() {
  st.pred.on = true;
  st.pred.panel = st.obj.in === "S" ? "P" : "S";
  st.pred.strokes = [];
  st.t = 0;
  st.playing = false;
  if (st.view !== "both") {
    st.view = "both";
    $$("#viewSeg button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === "both"));
    $("#panels").dataset.view = "both";
  }
  const cv = pan[st.pred.panel].cv.parentElement;
  cv.appendChild(pov);
  cv.classList.add("drawing");
  $("#pmsg").textContent =
    "Draw the path you expect, seen from " +
    (st.id === "custom" ? (st.pred.panel === "S" ? "S" : "S′") : st.names[st.pred.panel === "S" ? 0 : 1]) +
    ".";
  updPredUI();
  requestAnimationFrame(resizeAll);
}
export function endPredict(clear) {
  st.pred.on = false;
  if (clear) st.pred.strokes = [];
  $$(".cv").forEach((c) => c.classList.remove("drawing"));
  updPredUI();
  ui.dirty = true;
}
export function updPredUI() {
  pov.hidden = !st.pred.on;
  $("#predBtn").setAttribute("aria-pressed", st.pred.on);
  $("#clrPred").hidden = st.pred.on || !st.pred.strokes.length;
  $("#pReveal").disabled = !st.pred.strokes.length;
  $("#pReveal").style.opacity = st.pred.strokes.length ? 1 : 0.45;
}
export let drawingStroke = null;
export function initPredict() {
  $("#predBtn").addEventListener("click", () => {
    if (st.pred.on) endPredict(true);
    else startPredict();
  });
  $("#pClear").addEventListener("click", () => {
    st.pred.strokes = [];
    updPredUI();
    ui.dirty = true;
  });
  $("#pReveal").addEventListener("click", () => {
    if (!st.pred.strokes.length) return;
    endPredict(false);
    st.t = 0;
    st.playing = true;
    ui.last = 0;
    updatePlay();
  });
  $("#clrPred").addEventListener("click", () => {
    st.pred.strokes = [];
    updPredUI();
    ui.dirty = true;
  });
  for (const key of ["S", "P"]) {
    const cv = pan[key].cv;
    const toW = (e) => {
      const r = cv.getBoundingClientRect(),
        f = pan[key].f,
        o = pan[key];
      return [f.cx + (e.clientX - r.left - o.w / 2) / f.s, f.cy - (e.clientY - r.top - o.h / 2) / f.s];
    };
    cv.addEventListener("pointerdown", (e) => {
      if (!st.pred.on || st.pred.panel !== key) return;
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      drawingStroke = { panel: key, pts: [toW(e)] };
      st.pred.strokes.push(drawingStroke);
      updPredUI();
      ui.dirty = true;
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drawingStroke) return;
      const p = toW(e),
        l = drawingStroke.pts[drawingStroke.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) * pan[key].f.s < 3) return;
      drawingStroke.pts.push(p);
      ui.dirty = true;
    });
    const end = () => {
      if (drawingStroke && drawingStroke.pts.length < 2) {
        st.pred.strokes.pop();
        updPredUI();
      }
      drawingStroke = null;
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
  }
}
