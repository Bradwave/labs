// Pendulum Lab · tests/strings.test.mjs
// Italian and English strings must have the same keys (DESIGN.md §7). Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import STRINGS from "../js/strings.js";

test("Italian and English strings have the same keys", () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
});
test("no string is empty", () => {
  for (const lang of ["it", "en"]) for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(v.trim(), `${lang}.${k}`);
});
