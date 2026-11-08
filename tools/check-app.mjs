#!/usr/bin/env node
// Labs · tools/check-app.mjs
// Checks an app against DESIGN.md (the starred items of §19). Fails (✖) break the standard, warnings (⚠) need a look.
// Usage: node tools/check-app.mjs pendulum-lab [more slugs]   detailed report
//        node tools/check-app.mjs --all                       one line per app
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { KIT_ROOT, KIT_VERSION, appDir, pickApps } from "./lib.mjs";

const args = process.argv.slice(2);
const summary = args.includes("--all");
const apps = pickApps(args);

const SKIP = new Set([".git", "node_modules", "tests", "test", "docs", "dist", "kit", "tools", ".claude", ".github"]);
function sources(dir, root = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP.has(name)) sources(p, root, out);
    } else if ([".html", ".css", ".js", ".mjs"].includes(extname(name)) && !/three(\.min)?\.js$|vendor|qrcode/.test(p) && name !== "sw.js") {
      out.push({ rel: relative(root, p), text: readFileSync(p, "utf8") });
    }
  }
  return out;
}
const count = (s, re) => (s.match(re) || []).length;

async function check(app) {
  const dir = appDir(app.slug);
  const fails = [],
    warns = [];
  let passes = 0;
  const ok = (cond, msg, level = "fail") => {
    if (cond) passes++;
    else (level === "fail" ? fails : warns).push(msg);
  };
  const has = (rel) => existsSync(join(dir, rel));
  if (!existsSync(dir)) return { app, fails: ["folder not found"], warns, passes };
  const xr = app.kind === "xr";

  // ---- repository files (§16)
  const htmlPath = has("index.html") ? "index.html" : has("src/index.html") ? "src/index.html" : null;
  ok(htmlPath, "index.html missing");
  ok(has("README.md"), "README.md missing");
  const lic = has("LICENSE") ? readFileSync(join(dir, "LICENSE"), "utf8") : "";
  ok(/MIT License/.test(lic) && /Matteo Bramardi/.test(lic), "LICENSE must be MIT, Matteo Bramardi");
  ok(!has("test"), "rename test/ to tests/");
  ok(has("CLAUDE.md") && /\.\.\/DESIGN\.md/.test(readFileSync(join(dir, "CLAUDE.md"), "utf8")), "CLAUDE.md should point to ../DESIGN.md", "warn");
  ok(!has(".git") && !has(".github") && !has(".gitignore"), "repository files inside the lab (.git, .github, .gitignore): the repository root owns them", "warn");

  // ---- identity and PWA (§2, §15)
  ok(has("favicon.svg"), "favicon.svg missing");
  ok(has("icon-192.png") && has("icon-512.png"), "icon-192.png / icon-512.png missing");
  ok(has("icon-maskable-512.png"), "icon-maskable-512.png missing", "warn");
  ok(has("apple-touch-icon.png"), "apple-touch-icon.png missing");
  ok(has("manifest.webmanifest"), "manifest.webmanifest missing (run sync-kit)");
  ok(has("sw.js"), "sw.js missing (run sync-kit)");
  if (has("manifest.webmanifest")) {
    const m = JSON.parse(readFileSync(join(dir, "manifest.webmanifest"), "utf8"));
    ok(m.name === app.name, `manifest name "${m.name}" ≠ "${app.name}"`);
  }

  const html = htmlPath ? readFileSync(join(dir, htmlPath), "utf8") : "";
  if (html) {
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    ok(title.trim() === app.name, `<title> is "${title.trim()}", expected "${app.name}"`);
    ok(/<html[^>]+lang="(it|en)"/.test(html), '<html lang="…"> missing');
    ok(/<meta name="description"/.test(html), "meta description missing");
    ok(/<meta name="theme-color"/.test(html), "meta theme-color missing");
    ok(/rel="icon"/.test(html), "favicon link missing");
    ok(/rel="manifest"/.test(html), "manifest link missing");
    ok(/rel="apple-touch-icon"/.test(html), "apple-touch-icon link missing");
    ok(/viewport-fit=cover/.test(html), "viewport should include viewport-fit=cover", "warn");
    const h1 = (html.match(/<h1[^>]*class="word"[^>]*aria-label="([^"]*)"/) || [])[1];
    ok(h1 === app.name, `wordmark aria-label is "${h1 ?? "missing"}", expected "${app.name}"`, "warn");
    ok(/class="lab"/.test(html), "wordmark without the lab badge", app.coinedName ? "warn" : "warn");
  }

  // ---- kit (§1): the shared ../kit, or a frozen copy declared in apps.json ("kitCopy")
  let kv = null;
  if (app.kitCopy) {
    kv = has("kit/VERSION") ? readFileSync(join(dir, "kit/VERSION"), "utf8").trim() : null;
    ok(kv === app.kitCopy, `frozen kit copy should be ${app.kitCopy} (found ${kv ?? "none"})`);
    ok(/href="kit\/kit\.css"/.test(html), "a lab with a frozen kit loads kit/kit.css");
  } else if (!xr) {
    kv = /href="\.\.\/kit\/kit\.css"/.test(html) ? KIT_VERSION : null;
    ok(kv, "load the shared kit: <link rel=\"stylesheet\" href=\"../kit/kit.css\">");
    ok(!has("kit"), "kit/ copy inside the lab: delete it (or declare \"kitCopy\" in apps.json)", "warn");
  }

  // ---- sources
  const src = htmlPath ? sources(join(dir, htmlPath === "src/index.html" ? "src" : "")) : [];
  const all = src.map((s) => s.text).join("\n");

  // no external resources (§15)
  const ext = [];
  for (const s of src) {
    const re = /(<link[^>]+href="https?:|<script[^>]+src="https?:|url\(\s*["']?https?:|from\s+["']https?:|import\(\s*["']https?:|fonts\.googleapis|cdn\.jsdelivr|cdnjs\.cloudflare|unpkg\.com)/g;
    if (re.test(s.text)) ext.push(s.rel);
  }
  ok(!ext.length, `external resources in ${ext.join(", ")}`);

  if (!xr) {
    // header (§5)
    const header = (html.match(/<header[\s\S]*?<\/header>/) || [""])[0];
    ok(/id="infoBtn"/.test(html) && /id="settingsBtn"/.test(html), "header needs #infoBtn and #settingsBtn");
    ok(!/class="tag-line"/.test(html), "remove the tagline under the wordmark (.tag-line)");
    ok(count(header, /<button/g) <= 2, `header has ${count(header, /<button/g)} buttons; only info and settings belong there`);
    // components (§6)
    ok(!/type=["']number["']/.test(all), 'type="number" found: use type="text" inputmode="decimal" in .num');
    const selects = count(all, /<select/g),
      selWraps = count(all, /class="sel[" ]/g) + count(all, /className\s*=\s*["']sel["']/g);
    ok(selects <= selWraps, `${selects} <select>, ${selWraps} .sel wrappers: wrap every select in label.sel`);
    const checks = count(all, /type=["']checkbox["']/g),
      chkWraps = count(all, /class="chk[" ]/g);
    ok(checks <= chkWraps, `${checks} checkboxes, ${chkWraps} .chk wrappers: use .tg switches or label.chk`);
    ok(!/class="[^"]*\bx-|\.x-[a-z]/.test(all), "leftover x- classes (prototype proposals)", "warn");
  }

  // language (§7)
  if (has("js/strings.js")) {
    try {
      const mod = await import(pathToFileURL(join(dir, "js/strings.js")).href);
      const S = mod.default || mod.STRINGS || mod.strings;
      const it = Object.keys(S?.it || {}),
        en = Object.keys(S?.en || {});
      const onlyIt = it.filter((k) => !en.includes(k)),
        onlyEn = en.filter((k) => !it.includes(k));
      ok(it.length && en.length, "js/strings.js must export { it, en }");
      ok(!onlyIt.length && !onlyEn.length, `strings differ: only it [${onlyIt.slice(0, 5).join(", ")}${onlyIt.length > 5 ? "…" : ""}], only en [${onlyEn.slice(0, 5).join(", ")}${onlyEn.length > 5 ? "…" : ""}]`);
    } catch (e) {
      warns.push(`js/strings.js could not be loaded in Node: ${e.message.split("\n")[0]}`);
    }
  } else ok(false, "js/strings.js missing (Italian and English strings)", xr ? "warn" : "fail");
  ok(count(all, /data-i18n/g) > 0, "no data-i18n in markup", xr ? "warn" : "fail");

  // storage (§14)
  const keys = [...all.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]);
  const bad = [...new Set(keys.filter((k) => !k.startsWith(app.slug + ".")))];
  ok(!bad.length, `storage keys without the "${app.slug}." prefix: ${bad.join(", ")}`);
  ok(!/localStorage\./.test(all) || !kv, "use kit store instead of localStorage directly", "warn");

  return { app, fails, warns, passes };
}

const results = [];
for (const app of apps) results.push(await check(app));

if (summary) {
  console.log(`kit ${KIT_VERSION}\n`);
  console.log("app                    pass  fail  warn");
  for (const r of results) console.log(`${r.app.slug.padEnd(22)} ${String(r.passes).padStart(4)}  ${String(r.fails.length).padStart(4)}  ${String(r.warns.length).padStart(4)}`);
  console.log("\nDetails: node tools/check-app.mjs <slug>");
} else {
  for (const r of results) {
    console.log(`\n${r.app.name} (${r.app.slug}): ${r.passes} passed, ${r.fails.length} failed, ${r.warns.length} warnings`);
    for (const f of r.fails) console.log(`  ✖ ${f}`);
    for (const w of r.warns) console.log(`  ⚠ ${w}`);
  }
}
process.exitCode = results.some((r) => r.fails.length) ? 1 : 0;
