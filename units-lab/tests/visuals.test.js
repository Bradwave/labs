// Units Lab: Tests for visuals.js (they must build for every exercise and carry the right numbers).
import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "../js/generator.js";
import { visualsFor, commaPlan, lineVisual, powerVisual, factorsVisual, figuresHtml } from "../js/visuals.js";
import { parseNumber } from "../js/decimal.js";

test("visuals build for every exercise in every module, in both languages", () => {
  for (const loc of ["it", "en"]) {
    for (let m = 1; m <= 7; m++) {
      for (let seed = 1; seed <= 150; seed++) {
        const p = generate(m, seed);
        const v = visualsFor(p, loc);
        assert.ok(Array.isArray(v));
        for (const html of v) assert.ok(typeof html === "string" && html.length > 20 && !html.includes("undefined") && !html.includes("NaN"), `module ${m} seed ${seed}: ${html.slice(0, 120)}`);
      }
    }
  }
});

test("the comma plan agrees with the answer", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const p = generate(1, seed);
    if (p.variant === "format") continue;
    const plan = commaPlan(p);
    assert.ok(plan, `seed ${seed}`);
    if (p.ask.form === "decimal") assert.equal(plan.xEnd, 0);
    else assert.equal(plan.iEnd, 1);
  }
});

test("module 3 gets an exponent line, module 4 a power substitution, module 5 a factor chain", () => {
  let line = 0;
  let power = 0;
  let chain = 0;
  for (let seed = 1; seed <= 100; seed++) {
    if (lineVisual(generate(3, seed))) line++;
    if (powerVisual(generate(4, seed))) power++;
    if (factorsVisual(generate(5, seed), "it").includes("chain")) chain++;
  }
  assert.ok(line > 60, `line ${line}`);
  assert.ok(power > 60, `power ${power}`);
  assert.equal(chain, 100);
});

test("the factor chain states km/h → m/s as 10³ m over 1 km and 1 h over 3600 s", () => {
  const p = { module: 5, kind: "convert", data: parseNumber("36").dec, dataForm: "decimal", fromUnit: "km/h", toUnit: "m/s", expected: parseNumber("1,0e1").dec, ask: { form: "times" } };
  const html = factorsVisual(p, "it");
  assert.match(html, /10<sup>3<\/sup> m/);
  assert.match(html, /3600 s/);
});

test("filler zeros are greyed out", () => {
  assert.equal(figuresHtml(parseNumber("0,0042").dec, "it"), '<span class="zf">0</span><span class="zf">,00</span>42');
  assert.equal(figuresHtml(parseNumber("5200").dec, "it"), '52<span class="zf">00</span>');
  assert.equal(figuresHtml(parseNumber("3,25").dec, "en"), "3.25");
});
