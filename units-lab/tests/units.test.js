// Units Lab: Tests for units.js and the context catalogue.
import test from "node:test";
import assert from "node:assert/strict";
import { parseUnit, ratio, dimOf, sameDim, unitLabel } from "../js/units.js";
import { mulRatio, parseNumber, eq } from "../js/decimal.js";
import { fmt } from "../js/format.js";
import { CONTEXTS } from "../data/contexts.js";

const conv = (value, from, to) => {
  const r = ratio(parseUnit(from), parseUnit(to));
  return mulRatio(parseNumber(value).dec, r.n, r.d, r.p);
};
const text = (res) => fmt(res.dec, "it", "e");

test("symbols resolve: exact unit first, then prefix + unit", () => {
  assert.equal(parseUnit("min").terms[0].unit.sym, "min");
  assert.equal(parseUnit("mm").terms[0].px.sym, "m");
  assert.equal(parseUnit("kg").terms[0].unit.sym, "g");
  assert.equal(parseUnit("dam").terms[0].px.sym, "da");
  assert.equal(parseUnit("hPa").terms[0].unit.sym, "Pa");
  assert.equal(parseUnit("kWh").terms[0].unit.sym, "Wh");
  assert.equal(parseUnit("ha").terms[0].unit.sym, "ha");
  assert.equal(parseUnit("cal").terms[0].unit.sym, "cal");
  assert.equal(parseUnit("kcal").terms[0].px.sym, "k");
  assert.throws(() => parseUnit("xyz"));
  assert.throws(() => parseUnit("kmin")); // min does not take prefixes
});

test("linear conversions", () => {
  assert.equal(text(conv("655", "nm", "m")), "6,55e−7");
  assert.equal(text(conv("5,2", "km", "cm")), "5,2e5");
  assert.equal(text(conv("2,5", "kg", "g")), "2,5e3");
  assert.equal(text(conv("200", "mg", "kg")), "2e−4"); // trailing zeros of an integer are not significant
});

test("powers multiply the prefix exponent", () => {
  assert.equal(text(conv("3,0", "cm2", "m2")), "3,0e−4");
  assert.equal(text(conv("1,0", "cm3", "m3")), "1,0e−6");
  assert.equal(text(conv("5", "km2", "m2")), "5e6");
  assert.equal(text(conv("2,0", "m3", "cm3")), "2,0e6");
});

test("litre bridges", () => {
  assert.equal(text(conv("1,5", "L", "dm3")), "1,5e0");
  assert.equal(text(conv("330", "mL", "cm3")), "3,3e2");
  assert.equal(text(conv("2,0", "m3", "L")), "2,0e3");
});

test("time is not decimal", () => {
  assert.equal(text(conv("2,0", "h", "s")), "7,2e3");
  assert.equal(text(conv("90,0", "min", "h")), "1,50e0");
  assert.equal(text(conv("3,0", "d", "h")), "7,2e1");
});

test("composite units", () => {
  assert.equal(text(conv("36", "km/h", "m/s")), "1,0e1");
  assert.equal(text(conv("1,0", "m/s", "km/h")), "3,6e0");
  assert.equal(text(conv("1,00", "g/cm3", "kg/m3")), "1,00e3");
  assert.equal(text(conv("1,0", "L/min", "m3/s")), "1,7e−5");
  assert.equal(text(conv("2,2", "N/cm2", "Pa")), "2,2e4");
  assert.equal(text(conv("8,96", "g/cm3", "kg/m3")), "8,96e3");
});

test("non-decimal units with exact factors", () => {
  assert.equal(text(conv("1", "atm", "Pa")), "1e5");
  assert.equal(text(conv("1,00", "atm", "Pa")), "1,01e5");
  assert.equal(text(conv("1,0", "kWh", "MJ")), "3,6e0");
  assert.equal(text(conv("1,0", "eV", "J")), "1,6e−19");
  assert.equal(text(conv("1,0", "kcal", "kJ")), "4,2e0");
});

test("dimensions", () => {
  assert.deepEqual(dimOf(parseUnit("N/cm2")), dimOf(parseUnit("Pa")));
  assert.ok(sameDim(parseUnit("kWh"), parseUnit("J")));
  assert.ok(!sameDim(parseUnit("m"), parseUnit("m2")));
});

test("labels", () => {
  assert.equal(unitLabel(parseUnit("km/h")), "km/h");
  assert.equal(unitLabel(parseUnit("g/cm3")), "g/cm³");
  assert.equal(unitLabel(parseUnit("m3"), true), "m<sup>3</sup>");
  assert.equal(unitLabel(parseUnit("kg/m3")), "kg/m³");
});

test("every context: units parse, same dimension, fixed values parse, ranges are sane", () => {
  const ids = new Set();
  for (const c of CONTEXTS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    const nat = parseUnit(c.unit);
    assert.ok(c.alts.length >= 1, `${c.id}: needs alternatives`);
    for (const a of c.alts) assert.ok(sameDim(nat, parseUnit(a)), `${c.id}: ${a} vs ${c.unit}`);
    if (c.fixed) assert.ok(parseNumber(c.fixed).ok, `${c.id}: fixed value`);
    else assert.ok(c.lo > 0 && c.hi > c.lo, `${c.id}: range`);
    assert.ok([3, 4, 5].includes(c.m), `${c.id}: module`);
    assert.ok(c.it.length > 5);
  }
  assert.ok(CONTEXTS.length >= 55);
  for (const m of [3, 4, 5]) assert.ok(CONTEXTS.filter((c) => c.m === m).length >= 10, `module ${m} needs variety`);
});
