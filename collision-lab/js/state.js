// Collision Lab · state.js
// The settings that travel in the URL hash, pure (no DOM) so the tests can read and write links.
// Two parts: physical settings (scene, its parameters, restitution, stick, bumpers, frame), which were in the
// hash from the start, and presentation settings (show, tab, g, hide, lock), which only change what is shown.
import { SCENES, sceneById, defaults, sanitize } from "./scenes.js";

export const SHOW_KEYS = ["mom", "vel", "cm", "trail", "strobe"];
export const HIDE_KEYS = ["e", "bal", "gr", "num", "vec"];
export const GRAPH_KEYS = ["px", "py", "K", "x", "y", "vx", "vy"];
export const TAB_COUNT = 3;

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
// null = not given by the link: the app uses its own default or the saved preference
export function initialPresentation() {
  return { show: null, tab: null, g: null, hide: [], lock: false };
}

const short = (v) => String(+(+v).toFixed(4));
// a subset of `allowed` from "a,b,c", in the order of `allowed`, unknown names dropped
const subset = (raw, allowed) => {
  const got = new Set(String(raw).split(",").map((x) => x.trim()));
  return allowed.filter((k) => got.has(k));
};

// ---------- reading ----------
// Applies the keys of q (URLSearchParams) to st and pres. Physical keys count only once a scene is known:
// from "s" in q, or because a preset already set one (physOk). Returns whether a scene is now known.
export function applyKeys(st, pres, q, physOk = false) {
  if (q.has("s")) {
    const scene = sceneById(q.get("s"));
    st.scene = scene.id;
    const raw = {};
    for (const par of scene.params) raw[par.k] = q.has(par.k) ? q.get(par.k) : st.params[scene.id][par.k];
    st.params[scene.id] = sanitize(scene, raw);
    physOk = true;
  } else if (physOk) {
    const scene = sceneById(st.scene);
    const raw = { ...st.params[scene.id] };
    for (const par of scene.params) if (q.has(par.k)) raw[par.k] = q.get(par.k);
    st.params[scene.id] = sanitize(scene, raw);
  }
  if (physOk) {
    const e = Number(q.get("e"));
    if (q.has("e") && Number.isFinite(e)) st.e = Math.min(1, Math.max(0, e));
    if (q.has("st")) st.sticky = q.get("st") === "1";
    if (q.has("w")) st.walls = q.get("w") === "1";
    if (q.get("f") === "cm" || q.get("f") === "lab") st.frame = q.get("f");
  }
  if (q.has("show")) pres.show = subset(q.get("show"), SHOW_KEYS);
  if (q.has("tab")) {
    const n = Number(q.get("tab"));
    if (Number.isInteger(n) && n >= 0 && n < TAB_COUNT) pres.tab = n;
  }
  if (q.has("g") && GRAPH_KEYS.includes(q.get("g"))) pres.g = q.get("g");
  if (q.has("hide")) pres.hide = subset(q.get("hide"), HIDE_KEYS);
  if (q.has("lock")) pres.lock = q.get("lock") === "1";
  return physOk;
}

// The whole link: { st, pres, preset }. `presets` maps an id to { settings } (see presets.js); the order is
// defaults → preset → the keys written in the hash.
export function parseLink(hash, presets = null, base = initialSettings()) {
  const st = structuredClone(base);
  const pres = initialPresentation();
  const q = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  let preset = null, physOk = false;
  if (q.has("p") && presets) {
    preset = presets.get?.(q.get("p")) ?? null;
    if (preset) physOk = applyKeys(st, pres, new URLSearchParams(preset.settings));
  }
  applyKeys(st, pres, q, physOk);
  return { st, pres, preset: preset ? preset.id : null };
}

// Only the physical settings, as before (kept for links and storage written by earlier versions).
export function fromHash(hash, base = initialSettings()) {
  return parseLink(hash, null, base).st;
}

// ---------- writing ----------
function physPairs(st) {
  const p = st.params[st.scene];
  return [["s", st.scene], ...Object.entries(p).map(([k, v]) => [k, short(v)]), ["e", short(st.e)], ["st", st.sticky ? "1" : "0"], ["w", st.walls ? "1" : "0"], ["f", st.frame]];
}
function presPairs(pres) {
  const out = [];
  if (pres.show) out.push(["show", SHOW_KEYS.filter((k) => pres.show.includes(k)).join(",")]);
  if (pres.tab != null) out.push(["tab", String(pres.tab)]);
  if (pres.g) out.push(["g", pres.g]);
  if (pres.hide?.length) out.push(["hide", HIDE_KEYS.filter((k) => pres.hide.includes(k)).join(",")]);
  if (pres.lock) out.push(["lock", "1"]);
  return out;
}
const join = (pairs) => "#" + pairs.map(([k, v]) => `${k}=${v}`).join("&");

// "#s=glancing&m1=0.25&…&e=1&st=0&w=0&f=lab" plus the presentation keys that differ from the default.
// With a preset: "#p=<id>" plus only the keys that differ from what the preset gives, so a link that was
// opened unchanged is rewritten unchanged (and values the preset hides, such as e, stay out of the URL).
export function toHash(st, pres = initialPresentation(), preset = null, presets = null) {
  if (!preset || !presets?.get?.(preset)) return join([...physPairs(st), ...presPairs(pres)]);
  const ref = parseLink("#p=" + preset, presets);
  const refPhys = new Map(physPairs(ref.st)), refPres = new Map(presPairs(ref.pres));
  const pairs = [["p", preset]];
  const mine = physPairs(st);
  // another scene: write it with all its parameters (the preset's values belong to its own scene)
  const sceneKeys = new Set(["s", ...Object.keys(st.params[st.scene])]);
  const sceneChanged = st.scene !== ref.st.scene;
  for (const [k, v] of mine) if ((sceneChanged && sceneKeys.has(k)) || refPhys.get(k) !== v) pairs.push([k, v]);
  const myPres = presPairs(pres), myKeys = new Set(myPres.map(([k]) => k));
  for (const [k, v] of myPres) if (refPres.get(k) !== v) pairs.push([k, v]);
  // a key the preset sets but the current presentation dropped: write its neutral value
  for (const [k] of refPres) if (!myKeys.has(k)) pairs.push([k, k === "lock" ? "0" : k === "show" ? "" : k === "hide" ? "" : String(ref.pres[k])]);
  return join(pairs);
}
