#!/usr/bin/env node
// Labs · tools/new-app.mjs
// Creates a new lab from template/ (DESIGN.md §18). The app must already be in apps.json with a palette.
// Usage: node tools/new-app.mjs <slug>
// Then: start porting the prototype into the new folder.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { KIT_ROOT, appDir, loadApps, renderTemplate } from "./lib.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node tools/new-app.mjs <slug>");
  process.exit(1);
}
const app = loadApps().find((a) => a.slug === slug);
if (!app) {
  console.error(`${slug} is not in apps.json: add it first (name, kind, port, description it/en, palette light/dark).`);
  process.exit(1);
}
const dest = appDir(slug);
if (existsSync(dest)) {
  console.error(`${dest} already exists: nothing done.`);
  process.exit(1);
}
if (!app.palette?.light || !app.palette?.dark) {
  console.error("apps.json needs palette.light and palette.dark (bg, surface, ink, accent, tile2).");
  process.exit(1);
}

renderTemplate(app, dest);
execFileSync(process.execPath, [join(KIT_ROOT, "tools", "sync-kit.mjs"), slug], { stdio: "inherit" });
console.log(`\nCreated ${dest}.
Still to do: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png (from favicon.svg),
and set "kit": true in apps.json.`);
