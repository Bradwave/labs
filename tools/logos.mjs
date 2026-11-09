#!/usr/bin/env node
// Labs · tools/logos.mjs
// Each lab's logo.svg is its animated logo (DESIGN.md §2). Its still frame (the SVG without its <style>, so no
// animation) becomes the lab's favicon.svg; then the PNG icons are rendered from it (tools/make-icons.mjs).
// Usage: node tools/logos.mjs                 every lab with a logo.svg
//        node tools/logos.mjs pendulum-lab     one or more labs
//        node tools/logos.mjs --no-png         favicon.svg only
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { KIT_ROOT, appDir, pickApps } from "./lib.mjs";

const args = process.argv.slice(2);
const apps = pickApps(args).filter((a) => existsSync(join(appDir(a.slug), "logo.svg")));
const done = [];
for (const app of apps) {
  const logo = readFileSync(join(appDir(app.slug), "logo.svg"), "utf8");
  const still = logo
    .replace(/<style>[\s\S]*?<\/style>\s*/g, "")
    .replace(/ class="[^"]*"/g, "")
    .replace(/ style="[^"]*"/g, "")
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/ role="img" aria-label="[^"]*"/, "");
  writeFileSync(join(appDir(app.slug), "favicon.svg"), still);
  done.push(app.slug);
}
console.log(`favicon.svg from logo.svg: ${done.join(", ") || "none"}`);
if (done.length && !args.includes("--no-png") && process.platform === "darwin")
  execFileSync(process.execPath, [join(KIT_ROOT, "tools", "make-icons.mjs"), ...done], { stdio: "inherit" });
