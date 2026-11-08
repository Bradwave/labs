// Orbit Lab · tools/build-single-file.mjs
// Builds dist/orbit-lab.html: index.html with the CSS and all JavaScript modules inlined.
// Usage: node tools/build-single-file.mjs     (Node 18 or newer, no dependencies)
//
// The modules share one flat namespace (every top-level name is unique), so bundling is
// "put the files in dependency order, drop the import and export keywords". The script
// checks for duplicate names and stops if it finds one.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(root, p), 'utf8');

// 1. modules in dependency order (depth-first, dependencies first)
const order = [], seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = read(file);
  for (const m of src.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)) {
    visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
  }
  order.push(file);
}
visit('js/main.js');

// 2. strip imports and exports, check for duplicate top-level names
const names = new Map();
let code = '';
for (const file of order) {
  let src = read(file);
  src = src.replace(/^import\s[^;]*?;[ \t]*\r?\n?/gm, '');
  src = src.replace(/^export\s+(?=(?:const|let|function|class)\b)/gm, '');
  for (const m of src.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) {
    const prev = names.get(m[1]);
    if (prev) throw new Error(`Duplicate top-level name "${m[1]}" in ${file} and ${prev}`);
    names.set(m[1], file);
  }
  code += `/* ---------- ${file} ---------- */\n${src.trim()}\n\n`;
}
code = code.replace(/<\/script/gi, '<\\/script');

// 3. inline CSS and JS into the page
let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) => `<style>\n${read(href).trim()}\n</style>`);
html = html.replace(/<script type="module" src="js\/main\.js"><\/script>\n?/, () => '');
html = html.replace('</body>', () => `<script>\n'use strict';\n${code}</script>\n</body>`); // function form: the code contains "$$"

mkdirSync(path.join(root, 'dist'), { recursive: true });
writeFileSync(path.join(root, 'dist/orbit-lab.html'), html);
console.log(`dist/orbit-lab.html written (${(html.length / 1024).toFixed(0)} KB, ${order.length} modules)`);
