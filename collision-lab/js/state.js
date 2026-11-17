// Collision Lab · state.js
// The shareable settings (scene, its parameters, restitution, stick, bumpers, frame) and their URL hash form.
// Pure: no DOM, so the tests can read and write links.
import { SCENES, sceneById, defaults, sanitize } from "./scenes.js";

export function initialSettings() {
  return {
    scene: "headon",
    params: Object.fromEntries(SCENES.map((s) => [s.id, defaults(s)])),
    e: 1,
    sticky: false,
    walls: false,
    frame: "lab", // "lab" | "cm"
  };
}

const short = (v) => String(+(+v).toFixed(4));

// "#s=glancing&m1=0.25&…&e=1&st=0&w=0&f=lab": only the current scene's parameters travel in the link
export function toHash(st) {
  const p = st.params[st.scene];
  const parts = [`s=${st.scene}`, ...Object.entries(p).map(([k, v]) => `${k}=${short(v)}`)];
  parts.push(`e=${short(st.e)}`, `st=${st.sticky ? 1 : 0}`, `w=${st.walls ? 1 : 0}`, `f=${st.frame}`);
  return "#" + parts.join("&");
}

// Reads a hash defensively: unknown keys are ignored, numbers are kept inside their ranges.
export function fromHash(hash, base = initialSettings()) {
  const st = structuredClone(base);
  const q = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (!q.has("s")) return st;
  const scene = sceneById(q.get("s"));
  st.scene = scene.id;
  const raw = {};
  for (const par of scene.params) raw[par.k] = q.has(par.k) ? q.get(par.k) : st.params[scene.id][par.k];
  st.params[scene.id] = sanitize(scene, raw);
  const e = Number(q.get("e"));
  if (q.has("e") && Number.isFinite(e)) st.e = Math.min(1, Math.max(0, e));
  if (q.has("st")) st.sticky = q.get("st") === "1";
  if (q.has("w")) st.walls = q.get("w") === "1";
  if (q.get("f") === "cm" || q.get("f") === "lab") st.frame = q.get("f");
  return st;
}
