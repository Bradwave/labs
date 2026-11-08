// Units Lab: Tests for generator.js (properties that must hold for every seed).
import test from "node:test";
import assert from "node:assert/strict";
import { generate, shown, oomOf } from "../js/generator.js";
import { check } from "../js/checker.js";
import { fmt, decimalString } from "../js/format.js";
import { parseNumber, eq, sciExp, cmp, mulRatio } from "../js/decimal.js";
import { parseUnit, ratio } from "../js/units.js";

const SEEDS = 400;

test("same seed, same exercise", () => {
  for (const m of [1, 2, 3, 4, 5, 6, 7]) {
    const a = generate(m, 12345);
    const b = generate(m, 12345);
    assert.equal(JSON.stringify(a, (k, v) => (typeof v === "bigint" ? v.toString() : v)), JSON.stringify(b, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  }
});

test("modules 1, 3-5: the right answer, written in the asked form, is always marked correct", () => {
  for (const m of [1, 3, 4, 5]) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generate(m, seed);
      const loc = seed % 2 ? "it" : "en";
      const answer = fmt(p.expected, loc, p.ask.form);
      const r = check(p, answer, { locale: loc });
      assert.equal(r.status, "correct", `module ${m} seed ${seed}: "${answer}" ${JSON.stringify(r.codes)}`);
    }
  }
});

test("the statement parses back to the data it came from", () => {
  for (const m of [1, 3, 4, 5]) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generate(m, seed);
      const t = shown(p, "it");
      const back = parseNumber(t);
      assert.ok(back.ok, `module ${m} seed ${seed}: "${t}"`);
      assert.ok(eq(back.dec, p.data), `module ${m} seed ${seed}: "${t}"`);
      if (p.dataForm !== "decimal") assert.equal(back.dec.sf, p.data.sf, `sf ${t}`);
    }
  }
});

test("conversions: expected equals the exact conversion and keeps the figures of the data", () => {
  for (const m of [3, 4, 5]) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generate(m, seed);
      const r = ratio(parseUnit(p.fromUnit), parseUnit(p.toUnit));
      const e = mulRatio(p.data, r.n, r.d, r.p, { sf: p.data.sf }).dec;
      assert.ok(eq(e, p.expected));
      assert.equal(p.expected.sf, p.data.sf);
      assert.notEqual(p.fromUnit, p.toUnit);
    }
  }
});

test("magnitudes stay readable", () => {
  for (const m of [1, 3, 4, 5]) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generate(m, seed);
      if (p.dataForm === "decimal") assert.ok(decimalString(p.data, "it").length <= 11, `data ${decimalString(p.data, "it")}`);
      if (p.ask.form === "decimal") assert.ok(decimalString(p.expected, "it").length <= 9, `answer ${decimalString(p.expected, "it")}`);
      assert.ok(Math.abs(sciExp(p.expected)) <= 15);
    }
  }
});

test("module 1 uses all four variants and both notations", () => {
  const variants = new Set();
  const forms = new Set();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const p = generate(1, seed);
    variants.add(p.variant);
    forms.add(p.dataForm);
    forms.add(p.ask.form);
  }
  assert.deepEqual([...variants].sort(), ["format", "normalize", "toDecimal", "toSci"]);
  assert.ok(forms.has("times") && forms.has("e") && forms.has("decimal"));
});

test("modules 3-5 draw from many different contexts and mix data forms", () => {
  for (const m of [3, 4, 5]) {
    const ctx = new Set();
    const forms = new Set();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generate(m, seed);
      ctx.add(p.ctx);
      forms.add(p.dataForm);
    }
    assert.ok(ctx.size >= 10, `module ${m}: ${ctx.size} contexts`);
    assert.ok(forms.has("decimal") && (forms.has("times") || forms.has("e")), `module ${m} forms`);
  }
});

test("tier limit keeps advanced units out", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const p = generate(5, seed, { maxTier: 1 });
    assert.ok(!/eV|cal|Wh|mmHg|bar|atm/.test(p.fromUnit + p.toUnit), `${p.fromUnit} → ${p.toUnit}`);
  }
});

test("module 5 produces periodic results that are rounded, and exact ones", () => {
  let exact = 0;
  let rounded = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const p = generate(5, seed);
    if (p.exact) exact++;
    else rounded++;
  }
  assert.ok(exact > 20 && rounded > 20, `exact ${exact}, rounded ${rounded}`);
});

test("module 6: ordering has a unique answer and the numbers alone do not give it away", () => {
  let seen = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const p = generate(6, seed);
    if (p.kind !== "order") continue;
    seen++;
    assert.equal(p.items.length, 4);
    const order = p.answer.map((i) => p.items[i].inBase);
    for (let i = 1; i < 4; i++) {
      const c = cmp(order[i - 1], order[i]);
      assert.ok(p.dir === "asc" ? c < 0 : c > 0);
    }
    const trueAsc = p.items.map((_, i) => i).sort((x, y) => cmp(p.items[x].inBase, p.items[y].inBase));
    const byNumber = p.items.map((_, i) => i).sort((x, y) => cmp(p.items[x].dec, p.items[y].dec));
    assert.notDeepEqual(byNumber, trueAsc, `seed ${seed}`);
  }
  assert.ok(seen > 50);
});

test("module 6: exactly one expression is not equivalent to the others", () => {
  let seen = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const p = generate(6, seed);
    if (p.kind !== "intruder") continue;
    seen++;
    const toBase = p.items.map((e) => {
      const r = ratio(parseUnit(e.unit), parseUnit(p.base));
      return mulRatio(e.dec, r.n, r.d, r.p, { sf: e.dec.sf }).dec;
    });
    const bad = p.answer;
    const others = toBase.filter((_, i) => i !== bad);
    for (const o of others) assert.ok(eq(o, others[0]), `seed ${seed}`);
    assert.ok(!eq(toBase[bad], others[0]), `seed ${seed}`);
  }
  assert.ok(seen > 50);
});

test("modules 2 and 7: typed answers are marked correct, wrong models are named, picks have one answer", () => {
  for (const m of [2, 7]) {
    const variants = new Set();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generate(m, seed);
      variants.add(p.variant);
      if (p.choice) {
        assert.ok(p.answer >= 0 && p.answer < p.items.length);
        assert.equal(new Set(p.items).size, p.items.length, `module ${m} seed ${seed}: duplicate options`);
        continue;
      }
      const answer = fmt(p.expected, seed % 2 ? "it" : "en", p.ask.form);
      const r = check(p, answer, { locale: seed % 2 ? "it" : "en" });
      assert.equal(r.status, "correct", `module ${m} seed ${seed} ${p.variant}: "${answer}" ${JSON.stringify(r.codes)}`);
      for (const mod of p.models ?? []) {
        const wrong = check(p, fmt(mod.value, "it", p.ask.form === "decimal" ? "decimal" : p.ask.form), { locale: "it" });
        assert.notEqual(wrong.status, "correct", `module ${m} seed ${seed} model ${mod.id}`);
        assert.ok(wrong.codes.includes(mod.id) || wrong.status === "partial", `module ${m} seed ${seed} ${p.variant}: model ${mod.id} → ${wrong.status} ${JSON.stringify(wrong.codes)}`);
      }
    }
    if (m === 2) assert.deepEqual([...variants].sort(), ["diff", "substitute", "swapBack", "toPower", "toPrefix"]);
    if (m === 7) assert.deepEqual([...variants].sort(), ["direct", "edge", "inUnit", "ratio"]);
  }
});

test("module 7: the mantissa 5 rounds up (class convention), not at √10", () => {
  const up = parseNumber("5,0e3").dec;
  const down = parseNumber("4,9e3").dec;
  const mid = parseNumber("3,5e3").dec;
  assert.equal(oomOf(up).order, 4);
  assert.equal(oomOf(down).order, 3);
  assert.equal(oomOf(mid).order, 3);
  assert.equal(oomOf(parseNumber("0,0049").dec).order, -3);
  assert.equal(oomOf(parseNumber("0,005").dec).order, -2);
});
