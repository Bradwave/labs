// Impulse Lab · tests/strings.test.mjs
// Strings: same keys in Italian and English, none empty, and every key used in the code exists. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import STRINGS from "../js/strings.js";

const root = new URL("../", import.meta.url);
test("Italian and English strings have the same keys", () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
});
test("no string is empty", () => {
  for (const lang of ["it", "en"]) for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(String(v).trim(), `${lang}.${k}`);
});
test("every key used in the markup and code is defined", () => {
  const files = [new URL("index.html", root), ...readdirSync(new URL("js/", root)).filter((f) => /^0\d.*\.js$|boot\.js$/.test(f)).map((f) => new URL("js/" + f, root))];
  const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const used = new Set();
  for (const re of [/data-i18n(?:-title|-aria|-html)?="([^"]+)"/g, /data-i18n(?:-title)?':\s*'([^']+)'/g, /\bT\('([^']+)'/g, /\bkey:\s*'([^']+)'/g, /\bhintKey:\s*'([^']+)'/g, /\bsub:\s*'([^']+)'/g, /\blabel:\s*"([^"]+)"/g])
    for (const m of src.matchAll(re)) used.add(m[1]);
  const missing = [...used].filter((k) => !(k in STRINGS.it) && !k.startsWith("kit.") && !/^(ly_|prof_)/.test(k) && !/_$/.test(k));
  assert.deepEqual(missing, []);
});
