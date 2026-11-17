// lab-kit · tests/kit.test.mjs
// Number parsing and formatting, ticks, strings parity, mathtext. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNum, fmtNum, fmtSci, niceTicks, _test } from "../kit/kit.js";
import { toHTML, plain } from "../kit/mathtext.js";

test("parseNum accepts Italian and English input", () => {
  assert.equal(parseNum("0,5"), 0.5);
  assert.equal(parseNum("0.5"), 0.5);
  assert.equal(parseNum("−2,25"), -2.25);
  assert.equal(parseNum(" 1 250,5 "), 1250.5);
  assert.equal(parseNum("1.250,5"), 1250.5);
  assert.equal(parseNum("1,250.5"), 1250.5);
  assert.equal(parseNum("3,2×10^-4"), 0.00032);
  assert.equal(parseNum("3.2e-4"), 0.00032);
  assert.equal(parseNum(".5"), 0.5);
  assert.equal(parseNum("+7"), 7);
});
test("parseNum rejects junk", () => {
  for (const s of ["", "abc", "1,2,3", "2..5", "1-2", "--3"]) assert.ok(Number.isNaN(parseNum(s)), s);
});
test("fmtNum follows the language", () => {
  _test.setLangForTest("it");
  assert.equal(fmtNum(-1.5, 2), "−1,50");
  assert.equal(fmtNum(3.14159, 2, "m/s"), "3,14 m/s");
  assert.equal(fmtNum(-0.0001, 2), "0,00");
  assert.equal(fmtNum(NaN), "—");
  _test.setLangForTest("en");
  assert.equal(fmtNum(-1.5, 2), "−1.50");
  assert.equal(fmtSci(3.2e-4, 1), "3.2 × 10⁻⁴");
  _test.setLangForTest("it");
});
test("niceTicks gives round steps", () => {
  assert.deepEqual(niceTicks(0, 2, 6), [0, 0.5, 1, 1.5, 2]);
  assert.deepEqual(niceTicks(0, 19.62, 5), [0, 5, 10, 15]);
  assert.deepEqual(niceTicks(-1, 1, 4), [-1, -0.5, 0, 0.5, 1]);
});
test("kit strings have the same keys in Italian and English", () => {
  const it = Object.keys(_test.KIT_STRINGS.it).sort(),
    en = Object.keys(_test.KIT_STRINGS.en).sort();
  assert.deepEqual(it, en);
});
test("mathtext renders subscripts, superscripts and Greek", () => {
  assert.equal(toHTML("v_x"), "v<sub>x</sub>");
  assert.equal(toHTML("m/s^2"), "m/s<sup>2</sup>");
  assert.equal(toHTML("\\Delta s"), "Δ s");
  assert.equal(plain("a_{max}"), "a_max");
});

// ---------- qr.js ----------
import { qrMatrix, qrSVG, _test as qr } from "../kit/qr.js";
test("QR: Reed–Solomon matches the textbook example (HELLO WORLD, 1-M)", () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(qr.rsRemainder(data, qr.rsDivisor(10)), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});
test("QR: alignment positions", () => {
  assert.deepEqual(qr.alignmentPositions(1), []);
  assert.deepEqual(qr.alignmentPositions(2), [6, 18]);
  assert.deepEqual(qr.alignmentPositions(7), [6, 22, 38]);
  assert.deepEqual(qr.alignmentPositions(13), [6, 34, 62]);
});
test("QR: versions grow with the text, finders in the corners, SVG out", () => {
  const a = qrMatrix("https://labs.matephis.com/collision-lab/#p=urti/s4");
  assert.equal(a.ecl, "M");
  assert.equal(a.size, a.version * 4 + 17);
  // the three finder patterns: dark 7 × 7 ring corners and centre
  for (const [x, y] of [[0, 0], [a.size - 7, 0], [0, a.size - 7]]) {
    assert.equal(a.modules[y][x], true);
    assert.equal(a.modules[y + 3][x + 3], true);
    assert.equal(a.modules[y + 1][x + 1], false);
  }
  const long = qrMatrix("https://labs.matephis.com/collision-lab/#" + "x".repeat(180));
  assert.ok(long.version >= 10);
  assert.throws(() => qrMatrix("x".repeat(430)));
  const svg = qrSVG("hello", { title: "a < b" });
  assert.match(svg, /^<svg[^>]+viewBox="0 0 29 29"/);
  assert.match(svg, /<title>a &lt; b<\/title>/);
});
