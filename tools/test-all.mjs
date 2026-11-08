#!/usr/bin/env node
// Labs · tools/test-all.mjs
// Runs the kit tests and every lab's tests (the "test" command of each lab in apps.json, run from the lab folder),
// then the conformance check of every migrated lab ("kit": true). Used by CI before deploying.
// Usage: node tools/test-all.mjs
import { execSync } from "node:child_process";
import { KIT_ROOT, appDir, loadApps } from "./lib.mjs";

let failed = 0;
function run(label, cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: "pipe" });
    console.log(`✔ ${label}`);
  } catch (e) {
    failed++;
    console.log(`✖ ${label}\n${String(e.stdout || "")}${String(e.stderr || "")}`.trimEnd());
  }
}

run("kit tests", "node --test tests/", KIT_ROOT);
const apps = loadApps();
for (const a of apps) if (a.test) run(`${a.slug} tests`, a.test, appDir(a.slug));
const migrated = apps.filter((a) => a.kit === true).map((a) => a.slug);
if (migrated.length) run(`check-app ${migrated.join(" ")}`, `node tools/check-app.mjs ${migrated.join(" ")}`, KIT_ROOT);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exitCode = failed ? 1 : 0;
