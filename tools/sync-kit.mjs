#!/usr/bin/env node
// Labs · tools/sync-kit.mjs
// Regenerates each migrated lab's PWA files (DESIGN.md §1, §15). The kit itself is shared (kit/ at the
// repository root) and is not copied, except for labs that pin a frozen copy ("kitCopy": "<version>" in apps.json).
//   <lab>/manifest.webmanifest   from apps.json
//   <lab>/sw.js                  from kit/sw.template.js: precache list (lab files + shared kit files) and a
//                                cache name that changes whenever any of them changes
//   <lab>/kit/                   only for labs with "kitCopy": a frozen copy of the kit
// Usage: node tools/sync-kit.mjs                 every lab with "kit": true in apps.json
//        node tools/sync-kit.mjs pendulum-lab     one or more labs by slug
//        node tools/sync-kit.mjs --dry            show what would change
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { KIT_ROOT, KIT_VERSION, appDir, pickApps } from "./lib.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const apps = pickApps(args, (a) => a.kit === true);
if (!apps.length) console.log('No labs to sync: mark migrated labs with "kit": true in apps.json, or pass slugs.');

const KIT_DIR = join(KIT_ROOT, "kit");
// files of the shared kit that a lab page uses at run time
const KIT_RUNTIME = ["kit.css", "kit.js", "mathtext.js", ...readdirSync(join(KIT_DIR, "fonts")).filter((f) => f.endsWith(".woff2")).map((f) => "fonts/" + f)];
const SKIP_DIRS = new Set([".git", ".github", ".claude", "node_modules", "tests", "test", "docs", "tools", "dist"]);
const SKIP_FILES = new Set(["sw.js", ".gitignore", ".nojekyll", "CNAME", "LICENSE", "package.json", "package-lock.json", ".DS_Store"]);

function write(path, content) {
  const old = existsSync(path) ? readFileSync(path) : null;
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (old && old.equals(buf)) return false;
  if (!dry) writeFileSync(path, buf);
  return true;
}

function walk(dir, root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith(".")) walk(p, root, out);
    } else if (!SKIP_FILES.has(name) && !name.endsWith(".md") && !name.endsWith(".txt") && !name.startsWith(".")) {
      out.push(relative(root, p).split("\\").join("/"));
    }
  }
  return out;
}

function manifest(app, dir) {
  const p = app.palette || {};
  const icons = [];
  if (existsSync(join(dir, "favicon.svg"))) icons.push({ src: "favicon.svg", sizes: "any", type: "image/svg+xml" });
  for (const [file, size, purpose] of [
    ["icon-192.png", "192x192", "any"],
    ["icon-512.png", "512x512", "any"],
    ["icon-maskable-512.png", "512x512", "maskable"],
  ])
    if (existsSync(join(dir, file))) icons.push({ src: file, sizes: size, type: "image/png", purpose });
  const m = {
    name: app.name,
    short_name: app.name.replace(/ Lab( XR)?$/, "$1").trim() || app.name,
    description: app.description?.en || "",
    lang: "it",
    id: "./",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: p.light?.bg || "#ffffff",
    theme_color: p.light?.bg || "#ffffff",
    icons,
  };
  return JSON.stringify(m, null, 2) + "\n";
}

for (const app of apps) {
  const dir = appDir(app.slug);
  if (!existsSync(dir)) {
    console.error(`${app.slug}: folder not found at ${dir}`);
    continue;
  }
  const changed = [];
  const frozen = app.kitCopy || null;
  if (frozen) {
    // escape hatch: a frozen copy inside the lab, refreshed only when the pinned version matches the kit
    if (frozen === KIT_VERSION) {
      if (!dry) mkdirSync(join(dir, "kit", "fonts"), { recursive: true });
      for (const f of KIT_RUNTIME) if (write(join(dir, "kit", f), readFileSync(join(KIT_DIR, f)))) changed.push(`kit/${f}`);
      if (write(join(dir, "kit", "VERSION"), KIT_VERSION + "\n")) changed.push("kit/VERSION");
    } else console.log(`${app.slug}: keeps its frozen kit ${frozen} (current kit is ${KIT_VERSION})`);
  }
  if (write(join(dir, "manifest.webmanifest"), manifest(app, dir))) changed.push("manifest.webmanifest");

  // service worker: precache every served file of the lab and the shared kit files it loads
  const files = walk(dir, dir).filter((f) => f !== "sw.js");
  const kitFiles = frozen ? [] : KIT_RUNTIME;
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update(readFileSync(join(dir, f)));
  for (const f of kitFiles) hash.update("kit/" + f).update(readFileSync(join(KIT_DIR, f)));
  const cache = `${app.slug}-${hash.digest("hex").slice(0, 10)}`;
  const list = ["./", ...files.map((f) => "./" + f), ...kitFiles.map((f) => "../kit/" + f)];
  const sw = readFileSync(join(KIT_DIR, "sw.template.js"), "utf8")
    .replaceAll("__NAME__", app.name)
    .replaceAll("__SLUG__", app.slug)
    .replace("__CACHE__", cache)
    .replace("__FILES__", JSON.stringify(list, null, 2));
  if (write(join(dir, "sw.js"), sw)) changed.push(`sw.js (${cache}, ${list.length} files)`);

  console.log(`${app.slug}: ${changed.length ? (dry ? "would update " : "updated ") + changed.join(", ") : "up to date"}`);
}
