// __NAME__ · tests/app.test.mjs
// Put tests for the pure physics and maths modules here. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import STRINGS from "../js/strings.js";

test("Italian and English strings have the same keys", () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
});
