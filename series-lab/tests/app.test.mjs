// Series Lab · tests/app.test.mjs
// Parser, partial sums, Aitken, URL state, CSV and strings. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import STRINGS from "../js/strings.js";
import { Field } from "../js/field.js";
import { compile, ExprError } from "../js/expr.js";
import { computeSeries, aitken, limitEstimate, PRESETS, encodeState, decodeState, toCSV } from "../js/series.js";

const ev = (src, n = 0, z = [0, 0]) => compile(src).fn(n, z);
const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol, `${a} ≠ ${b}`);

test("Italian and English strings have the same keys", () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
});
test("every preset compiles and has a name in both languages", () => {
  for (const p of PRESETS) {
    compile(p.expr);
    assert.ok(STRINGS.it["preset." + p.id] && STRINGS.en["preset." + p.id], p.id);
  }
});
test("arithmetic and precedence", () => {
  close(ev("1+2*3"), [7, 0]);
  close(ev("-2^2"), [-4, 0]);
  close(ev("2^3^2"), [512, 0]);
  close(ev("2^-1"), [0.5, 0]);
  close(ev("(1+i)(1-i)"), [2, 0]);
  close(ev("1/i"), [0, -1]);
  close(ev("2n+1", 3), [7, 0]);
  close(ev("n(n+1)", 3), [12, 0]);
  close(ev("0,5+1.5"), [2, 0]);
  close(ev("3·2−1"), [5, 0]);
});
test("complex functions and constants", () => {
  close(ev("exp(i*pi)"), [-1, 0]);
  close(ev("sqrt(-4)"), [0, 2]);
  close(ev("abs(3+4i)"), [5, 0]);
  close(ev("conj(1+2i)"), [1, -2]);
  close(ev("ln(e)"), [1, 0]);
  close(ev("sin(i)"), [0, Math.sinh(1)]);
  close(ev("i^2"), [-1, 0]);
  close(ev("(-1)^n", 5), [-1, 0], 1e-15);
  close(ev("i^n", 3), [0, -1], 1e-15);
  close(ev("z^n", 2, [0, 1]), [-1, 0]);
  close(ev("fact(5)"), [120, 0]);
  close(ev("n!", 4), [24, 0]);
  close(ev("1e-3*2"), [0.002, 0]);
});
test("errors carry a code for the interface", () => {
  const code = (s) => {
    try {
      compile(s);
    } catch (e) {
      assert.ok(e instanceof ExprError);
      return e.code;
    }
  };
  assert.equal(code(""), "empty");
  assert.equal(code("1+"), "unexpectedEnd");
  assert.equal(code("(1+2"), "unexpectedEnd");
  assert.equal(code("1 $ 2"), "char");
  assert.equal(code("foo(2)"), "unknown");
  assert.equal(code("sin 2"), "needParens");
  assert.equal(code("1+*2"), "unexpected");
  assert.equal(code("2)"), "unexpected");
});
test("geometric series: partial sums and exact Aitken limit", () => {
  const z = [0.5, 0.25];
  const s = computeSeries(compile("z^n").fn, 0, 30, z);
  assert.equal(s.count, 31);
  const exact = [1, 0].map(() => 0);
  // 1/(1−z)
  const d = (1 - z[0]) ** 2 + z[1] ** 2;
  exact[0] = (1 - z[0]) / d;
  exact[1] = z[1] / d;
  close(aitken(s, 10), exact, 1e-9);
  assert.ok(Math.abs(s.sRe[30] - exact[0]) < 1e-3);
});
test("alternating harmonic tends to −ln 2, harmonic series grows like ln n", () => {
  const a = computeSeries(compile("(-1)^n/n").fn, 1, 2000, [0, 0]);
  assert.ok(Math.abs(a.sRe[1999] + Math.LN2) < 1e-3);
  const h = computeSeries(compile("1/n").fn, 1, 1000, [0, 0]);
  assert.ok(Math.abs(h.sRe[999] - (Math.log(1000) + 0.5772156649)) < 1e-3);
});
test("a non-finite term stops the sum", () => {
  const s = computeSeries(compile("1/(n-3)").fn, 0, 10, [0, 0]);
  assert.equal(s.stoppedAt, 3);
  assert.equal(s.count, 3);
  const e = computeSeries(compile("z^n/n!").fn, 0, 400, [3, 0]);
  assert.ok(e.count > 100 && Math.abs(e.sRe[e.count - 1] - Math.exp(3)) < 1e-9);
});
test("URL state round-trips and rejects bad input", () => {
  const st = { expr: "z^n/n!", n0: 0, z: [1.5, -2], nMax: 50, N: 12 };
  assert.deepEqual(decodeState("#" + encodeState(st)), st);
  assert.deepEqual(decodeState("#e=1%2B&n0=abc&M=999999&z=1,x"), {});
  assert.deepEqual(decodeState(""), {});
});
test("CSV uses ; and a decimal comma in Italian", () => {
  const s = computeSeries(compile("1/n").fn, 1, 3, [0, 0]);
  const it = toCSV(s, "it", 2).split("\n");
  assert.equal(it[0], "n;Re(a_n);Im(a_n);Re(S_n);Im(S_n)");
  assert.equal(it[2], "2;0,5;0;1,5;0");
  assert.equal(it.length, 4);
  assert.equal(toCSV(s, "en", 1).split("\n")[1], "1,1,0,1,0");
});
test("limit estimate: shown for convergent series, hidden for divergent ones", () => {
  const est = (src, n0, z, nMax) => {
    const s = computeSeries(compile(src).fn, n0, nMax, z);
    return limitEstimate(s, s.count - 1);
  };
  assert.ok(est("z^n", 0, [0.5, 0.25], 60));
  assert.ok(est("(-1)^n/n", 1, [0, 0], 300));
  assert.ok(est("i^n/n", 1, [0, 0], 300));
  assert.equal(est("1/n", 1, [0, 0], 300), null);
  assert.equal(est("n", 1, [0, 0], 100), null);
  assert.equal(est("z^n", 0, [1.1, 0.2], 60), null);
});

test("field: S_N(z) on a grid matches the closed form inside the disc, cells blow up outside", () => {
  const f = new Field();
  const geo = { cols: 5, rows: 3, cx: 0, cy: 0, dx: 0.2 };
  f.configure(compile("z^n").fn, 0, geo, "a");
  assert.ok(f.advance(60, 1e9));
  assert.equal(f.kDone, 60);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 5; i++) {
      const [re, im] = f.zOf(i, j),
        c = j * 5 + i,
        d = (1 - re) ** 2 + im ** 2;
      assert.ok(Math.abs(f.sRe[c] - (1 - re) / d) < 1e-9 && Math.abs(f.sIm[c] - im / d) < 1e-9);
    }
  assert.deepEqual(f.cellAt(...f.zOf(3, 1)), [3, 1]);
  assert.equal(f.cellAt(10, 10), null);
  // |z| > 1: finite but huge, then NaN once it overflows; the cell stays NaN
  const g = new Field();
  g.configure(compile("z^n").fn, 0, { cols: 1, rows: 1, cx: 3, cy: 0, dx: 1 }, "b");
  g.advance(700, 1e9);
  assert.ok(Number.isNaN(g.sRe[0]));
});
test("field: the time budget slices the work, going back restarts, same signature keeps the data", () => {
  const f = new Field();
  const geo = { cols: 4, rows: 4, cx: 0, cy: 0, dx: 0.1 };
  assert.equal(f.configure(compile("z^n").fn, 0, geo, "s"), true);
  let t = 0;
  const clock = () => (t += 1); // every call costs 1 ms
  assert.equal(f.advance(50, 3, clock), false);
  assert.ok(f.kDone >= 0 && f.kDone < 50);
  assert.equal(f.fromReset, true);
  while (!f.advance(50, 3, clock));
  assert.equal(f.fromReset, false);
  assert.equal(f.configure(compile("z^n").fn, 0, geo, "s"), false);
  const before = f.sRe[0];
  assert.equal(f.advance(10, 3, clock), false); // going back restarts from the first term
  assert.ok(f.kDone < 10);
  assert.equal(f.fromReset, true);
  f.advance(50, 1e9);
  assert.ok(Math.abs(f.sRe[0] - before) < 1e-12);
});
