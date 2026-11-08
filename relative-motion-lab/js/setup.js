// Relative Motion Lab: Set-up panel: frame motion, rotation, object motion and duration.
import { $, $$ } from "./dom.js";
import { TYPES, DEF, LAB, rotating } from "./motion.js";
import { st, loadPreset, U } from "./state.js";
import { refit } from "./layout.js";
import { updateFrameMsg } from "./compare.js";
import { updPredUI } from "./predict.js";

export function typeOptions(sel) {
  sel.innerHTML = Object.entries(TYPES)
    .map(([k, v]) => `<option value="${k}">${v.name}</option>`)
    .join("");
}
export function fieldsHTML(keys, p, isFrame) {
  return keys
    .map((k) => {
      const [lo, up, u] = LAB[k];
      return `<label class="fld"><span><span>${isFrame ? up : lo}</span> <em>${U(u)}</em></span><input type="number" step="any" inputmode="decimal" data-k="${k}" value="${+(+p[k]).toPrecision(6)}"></label>`;
    })
    .join("");
}
export function buildSetup() {
  $("#fType").value = st.frame.type;
  $("#oType").value = st.obj.type;
  $("#fFields").innerHTML = fieldsHTML(TYPES[st.frame.type].keys, st.frame.p, true);
  $("#oFields").innerHTML = fieldsHTML(TYPES[st.obj.type].keys, st.obj.p, false);
  $("#rFields").innerHTML = fieldsHTML(["Om", "th0"], st.rot, true);
  $("#rotBox").open = rotating();
  $$("#inSeg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.in === st.obj.in));
  $("#durIn").value = +st.T.toPrecision(6);
  $("#tUnit").textContent = st.units[1];
  $("#edited").hidden = !st.edited;
}
export function changed() {
  st.edited = true;
  $("#edited").hidden = false;
  if (st.pred.strokes.length && !st.pred.on) {
    st.pred.strokes = [];
    updPredUI();
  }
  refit();
  updateFrameMsg();
}
export function setType(m, type) {
  m.type = type;
  for (const k of TYPES[type].keys) if (m.p[k] === undefined) m.p[k] = DEF[k];
}
export const onField = (get) => (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const v = parseFloat(e.target.value);
  if (!isFinite(v)) return;
  get()[k] = v;
  changed();
};
export function initSetup() {
  typeOptions($("#fType"));
  typeOptions($("#oType"));
  $("#fType").addEventListener("change", (e) => {
    setType(st.frame, e.target.value);
    $("#fFields").innerHTML = fieldsHTML(TYPES[st.frame.type].keys, st.frame.p, true);
    changed();
  });
  $("#oType").addEventListener("change", (e) => {
    setType(st.obj, e.target.value);
    $("#oFields").innerHTML = fieldsHTML(TYPES[st.obj.type].keys, st.obj.p, false);
    changed();
  });
  $("#fFields").addEventListener(
    "input",
    onField(() => st.frame.p),
  );
  $("#oFields").addEventListener(
    "input",
    onField(() => st.obj.p),
  );
  $("#rFields").addEventListener(
    "input",
    onField(() => st.rot),
  );
  $("#inSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.dataset.in === st.obj.in) return;
    st.obj.in = b.dataset.in;
    $$("#inSeg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    changed();
  });
  $("#durIn").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    if (!(v >= 0.1)) return;
    st.T = v;
    changed();
  });
  $("#restoreBtn").addEventListener("click", () => loadPreset(st.id));
}
