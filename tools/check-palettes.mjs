#!/usr/bin/env node
// Labs · tools/check-palettes.mjs
// Compares the light backgrounds of every lab and reports clashes (DESIGN.md §2) and weak contrast (§8).
// Usage: node tools/check-palettes.mjs            current palettes
//        node tools/check-palettes.mjs --proposed  with the proposed backgrounds applied
import { loadApps, hsl, hueDistance, contrast } from "./lib.mjs";

const useProposed = process.argv.includes("--proposed");
const apps = loadApps();
const byslug = Object.fromEntries(apps.map((a) => [a.slug, a]));
const rows = apps
  .filter((a) => !a.sharesPaletteWith && a.palette)
  .map((a) => {
    const p = a.palette;
    const bg = useProposed && p.proposed ? p.proposed.bg : p.light.bg;
    const [h, s, l] = hsl(bg);
    return { slug: a.slug, bg, h, s, l, light: p.light, dark: p.dark };
  })
  .sort((a, b) => a.h - b.h);

console.log(`Backgrounds by hue${useProposed ? " (proposed applied)" : ""}:\n`);
for (const r of rows) console.log(`  ${r.bg}  hue ${r.h.toFixed(0).padStart(3)}°  sat ${(r.s * 100).toFixed(0).padStart(3)}%  light ${(r.l * 100).toFixed(0).padStart(3)}%  ${r.slug}`);

const clashes = [];
for (let i = 0; i < rows.length; i++)
  for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i],
      b = rows[j];
    const dh = hueDistance(a.h, b.h),
      dl = Math.abs(a.l - b.l);
    const grey = a.s < 0.15 || b.s < 0.15;
    if (!grey && dh < 18 && dl < 0.2) clashes.push(`${a.slug} ${a.bg} ↔ ${b.slug} ${b.bg}: hue ${dh.toFixed(0)}° apart, lightness ${(dl * 100).toFixed(0)} points apart`);
  }
console.log(clashes.length ? `\nClashes (${clashes.length}):\n  ${clashes.join("\n  ")}` : "\nNo clashes.");

const weak = [];
for (const r of rows) {
  if (useProposed && byslug[r.slug].palette.proposed) continue; // proposed palettes have no surface/ink yet
  for (const [mode, p] of [["light", r.light], ["dark", r.dark]]) {
    const ts = contrast(p.ink, p.surface),
      ib = contrast(p.ink, p.bg),
      as = contrast(p.accent, p.surface);
    if (ts < 4.5) weak.push(`${r.slug} ${mode}: ink on surface ${ts.toFixed(2)} (needs 4.5)`);
    if (ib < 3) weak.push(`${r.slug} ${mode}: ink on bg ${ib.toFixed(2)} (needs 3)`);
    if (as < 3) weak.push(`${r.slug} ${mode}: accent on surface ${as.toFixed(2)} (needs 3)`);
  }
}
console.log(weak.length ? `\nContrast to fix (${weak.length}):\n  ${weak.join("\n  ")}` : "\nContrast OK.");
process.exitCode = clashes.length ? 1 : 0;
