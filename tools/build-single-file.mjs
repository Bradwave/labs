#!/usr/bin/env node
// Labs · tools/build-single-file.mjs
// Packs a lab into one self-contained HTML file: kit and app CSS inlined, fonts as data URLs,
// kit.js + mathtext.js + strings.js + main.js merged into one module script.
// Used for the Cowork starter (DESIGN.md §18) and for sharing a prototype as a single file.
// Usage: node tools/build-single-file.mjs                       → template/single-file.html (starter, "New Lab")
//        node tools/build-single-file.mjs <app-folder> <out.html>  any app that follows the template layout
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { KIT_ROOT, renderTemplate } from "./lib.mjs";
import { execFileSync } from "node:child_process";

const [srcArg, outArg] = process.argv.slice(2);
let src = srcArg ? resolve(srcArg) : null;
let tmp = null;
if (!src) {
  // starter: the template filled with a neutral palette and a placeholder name
  tmp = mkdtempSync(join(tmpdir(), "lab-starter-"));
  src = join(tmp, "new-lab");
  renderTemplate(
    {
      slug: "new-lab",
      name: "New Lab",
      port: 8000,
      description: { it: "Descrivi qui il laboratorio in una frase.", en: "Describe the lab here in one sentence." },
      palette: {
        light: { bg: "#C9D3DD", surface: "#F7F9FB", ink: "#14202B", accent: "#E8553D", tile2: "#FFD23F" },
        dark: { bg: "#111A22", surface: "#1B2731", ink: "#E8EEF3", accent: "#FF7A5C", tile2: "#E9B92A" },
      },
    },
    src,
  );
}
const out = outArg ? resolve(outArg) : join(KIT_ROOT, "template", "single-file.html");
const kitDir = existsSync(join(src, "kit", "kit.js")) ? join(src, "kit") : join(KIT_ROOT, "kit");
const read = (p) => readFileSync(p, "utf8");

// CSS: kit (fonts as data URLs) + app
let kitCss = read(join(kitDir, "kit.css")).replace(/url\(fonts\/([^)]+)\)/g, (m, f) => {
  const b64 = readFileSync(join(kitDir, "fonts", f)).toString("base64");
  return `url(data:font/woff2;base64,${b64})`;
});
const appCss = existsSync(join(src, "css", "app.css")) ? read(join(src, "css", "app.css")) : "";

// JS: strip imports and the export keyword, rename the strings default export
const strip = (code) =>
  code
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
    .replace(/^export\s+(const|let|function|class|async function)/gm, "$1");
const kitJs = strip(read(join(kitDir, "kit.js")));
const mathJs = strip(read(join(kitDir, "mathtext.js")));
const stringsJs = existsSync(join(src, "js", "strings.js")) ? read(join(src, "js", "strings.js")).replace(/export default/, "const STRINGS =") : "const STRINGS = { it: {}, en: {} };";
const mainJs = strip(read(join(src, "js", "main.js"))).replace(/initKit\(\{/, "initKit({ sw: false,"); // prototypes: no service worker
const script = [
  "// ===== kit/kit.js =====", kitJs,
  "// ===== kit/mathtext.js =====", mathJs,
  "// ===== js/strings.js =====", stringsJs,
  "// ===== js/main.js =====", mainJs,
].join("\n");

let html = read(join(src, "index.html"))
  .replace(/<link rel="stylesheet" href="(\.\.\/)?kit\/kit.css">\s*/, "")
  .replace(/<link rel="stylesheet" href="css\/app.css">/, `<style>\n${kitCss}\n${appCss}\n</style>`)
  .replace(/<link rel="manifest"[^>]*>\s*/, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, "")
  .replace(/<link rel="icon"[^>]*>/, () => {
    const fav = existsSync(join(src, "favicon.svg")) ? read(join(src, "favicon.svg")) : "";
    return fav ? `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(fav)}">` : "";
  })
  .replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script type="module">\n${script.replace(/<\/script>/g, "<\\/script>")}\n</script>`);
html = html.replace("<head>", "<head>\n<!-- Single-file build of a lab (lab-kit/tools/build-single-file.mjs). Prototype freely; follow lab-kit/DESIGN.md. -->");
writeFileSync(out, html);
if (tmp) rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB)`);
