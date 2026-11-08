// Labs · tools/lib.mjs
// Shared helpers for the tools: paths, the app registry, colour maths.
// Paths: REPO root = this repository (kit/, apps.json, VERSION, template/); each lab is a folder of the root.
// LABS_ROOT (env) points the tools at another folder of labs, e.g. a scratch copy for tests.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LABS_ROOT = process.env.LABS_ROOT ? resolve(process.env.LABS_ROOT) : KIT_ROOT;
export const KIT_VERSION = readFileSync(join(KIT_ROOT, "VERSION"), "utf8").trim();

export function loadApps() {
  return JSON.parse(readFileSync(join(KIT_ROOT, "apps.json"), "utf8")).apps;
}
export function appDir(slug) {
  return join(LABS_ROOT, slug);
}
// Pick apps from command-line slugs; "--all" or no slugs = every app (filter decides).
export function pickApps(args, filter = () => true) {
  const apps = loadApps();
  const slugs = args.filter((a) => !a.startsWith("--"));
  if (slugs.length) {
    const out = slugs.map((s) => apps.find((a) => a.slug === s) || { slug: s, missing: true });
    for (const a of out) if (a.missing) console.error(`unknown app: ${a.slug} (add it to apps.json)`);
    return out.filter((a) => !a.missing);
  }
  return apps.filter(filter);
}
export function exists(slug, rel) {
  return existsSync(join(appDir(slug), rel));
}

// ---------- colour ----------
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl(hex) {
  return rgbToHsl(hexToRgb(hex));
}
function lum(hex) {
  const c = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------- template ----------
// Copies template/ to dest, filling the placeholders from an apps.json entry (DESIGN.md §18).
export function renderTemplate(app, dest) {
  const p = app.palette;
  const topic = app.name.replace(/ Lab( XR)?$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const roles = ["a", "", "b", "", "k", ""];
  const tiles = [...topic].map((ch, i) => `<span${roles[i % roles.length] ? ` class="${roles[i % roles.length]}"` : ""}>${ch}</span>`).join("");
  const vars = {
    __SLUG__: app.slug, __NAME__: app.name, __PORT__: String(app.port || 8000),
    __DESC_IT__: app.description.it, __DESC_EN__: app.description.en,
    __TILES__: tiles, __LETTER__: topic[0].toUpperCase(),
    __BG_DARK__: p.dark.bg, __SURFACE_DARK__: p.dark.surface, __INK_DARK__: p.dark.ink, __ACCENT_DARK__: p.dark.accent, __TILE2_DARK__: p.dark.tile2,
    __BG__: p.light.bg, __SURFACE__: p.light.surface, __INK__: p.light.ink, __ACCENT__: p.light.accent, __TILE2__: p.light.tile2,
  };
  const fill = (s) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);
  const copyDir = (src, dst) => {
    mkdirSync(dst, { recursive: true });
    for (const name of readdirSync(src)) {
      const s = join(src, name), d = join(dst, name);
      if (statSync(s).isDirectory()) copyDir(s, d);
      else if (name === "single-file.html") continue;
      else if (/\.(html|css|js|mjs|md|json|svg)$/.test(name)) writeFileSync(d, fill(readFileSync(s, "utf8")));
      else copyFileSync(s, d);
    }
  };
  copyDir(join(KIT_ROOT, "template"), dest);
  writeFileSync(join(dest, "LICENSE"), readFileSync(join(KIT_ROOT, "LICENSE"), "utf8").replace(/\(c\) \d{4}(-\d{4})?/, `(c) ${new Date().getFullYear()}`));
}
