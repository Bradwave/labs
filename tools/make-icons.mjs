#!/usr/bin/env node
// Labs · tools/make-icons.mjs
// Renders the PWA icons of an app from its favicon.svg (DESIGN.md §2), with macOS's built-in `sips`:
//   icon-192.png, icon-512.png, apple-touch-icon.png (180 px, on the palette background),
//   icon-maskable-512.png (favicon at 66 % on the palette background, inside the safe zone).
// Usage: node tools/make-icons.mjs <slug> [more slugs]
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { appDir, pickApps } from "./lib.mjs";

if (process.platform !== "darwin") {
  console.error("make-icons uses macOS sips; on other systems export the PNGs from favicon.svg by hand.");
  process.exit(1);
}
const apps = pickApps(process.argv.slice(2), () => false);
if (!apps.length) console.error("Usage: node tools/make-icons.mjs <slug> [more slugs]");

for (const app of apps) {
  const dir = appDir(app.slug);
  const fav = join(dir, "favicon.svg");
  if (!existsSync(fav)) {
    console.error(`${app.slug}: no favicon.svg`);
    continue;
  }
  const svg = readFileSync(fav, "utf8");
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const vb = (svg.match(/viewBox="([^"]+)"/) || [, "0 0 32 32"])[1].split(/\s+/).map(Number);
  const bg = app.palette?.light?.bg || (app.sharesPaletteWith ? pickApps([app.sharesPaletteWith])[0]?.palette?.light?.bg : null) || "#ffffff";
  const tmp = mkdtempSync(join(tmpdir(), "lab-icons-"));
  // padded square on the palette background: k = share of the side taken by the favicon
  const padded = (k) => {
    const [x, y, w, h] = vb,
      side = Math.max(w, h) / k,
      ox = x - (side - w) / 2,
      oy = y - (side - h) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${side} ${side}"><rect x="${ox}" y="${oy}" width="${side}" height="${side}" fill="${bg}"/>${inner}</svg>`;
  };
  const jobs = [
    ["icon-192.png", 192, svg],
    ["icon-512.png", 512, svg],
    ["apple-touch-icon.png", 180, padded(0.86)],
    ["icon-maskable-512.png", 512, padded(0.66)],
  ];
  for (const [name, size, source] of jobs) {
    const s = join(tmp, name + ".svg");
    writeFileSync(s, source);
    execFileSync("sips", ["-s", "format", "png", "-z", String(size), String(size), s, "--out", join(dir, name)], { stdio: "ignore" });
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${app.slug}: ${jobs.map((j) => j[0]).join(", ")}`);
}
