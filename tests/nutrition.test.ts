import test from "node:test";
import assert from "node:assert/strict";
import { burnKcal, dayTargets, defaultNutrition, fromInches, gearFor, kcalOf, normalizeNutrition, refuel, restingKcal, toInches, underFuelled } from "../lib/nutrition";
import { normalizeSettings } from "../lib/settings";

const n = defaultNutrition();

test("gearFor maps run sessions to carb gears", () => {
  assert.equal(gearFor(undefined), "rest");
  assert.equal(gearFor("rest"), "rest");
  assert.equal(gearFor("easy"), "easy");
  assert.equal(gearFor("double"), "double");
  for (const t of ["single", "x", "longrun", "race", "short", "medium", "long", "hills"]) assert.equal(gearFor(t), "hard");
});

test("dayTargets follows the report's g/kg ranges", () => {
  const kg = 80;
  const easy = dayTargets("easy", kg, n), hard = dayTargets("hard", kg, n), dbl = dayTargets("double", kg, n);
  assert.equal(easy.carbs, 440);   // 5.5 g/kg
  assert.equal(hard.carbs, 600);   // 7.5 g/kg
  assert.equal(dbl.carbs, 720);    // 9 g/kg
  assert.equal(easy.protein, 128); // 1.6 g/kg
  assert.equal(hard.protein, 144); // at least 1.8 g/kg
  assert.equal(dbl.protein, 160);  // at least 2.0 g/kg
  assert.ok(easy.kcal < hard.kcal && hard.kcal < dbl.kcal);
});

test("fat is a quarter of energy and macros add up to the calories", () => {
  for (const g of ["rest", "easy", "hard", "double"] as const) {
    const t = dayTargets(g, 72, n);
    const fromMacros = kcalOf(t.carbs, t.protein, t.fat);
    assert.ok(Math.abs(fromMacros - t.kcal) <= 15, `${g}: ${fromMacros} vs ${t.kcal}`);
    assert.ok(Math.abs((t.fat * 9) / fromMacros - 0.25) < 0.01);
  }
});

test("a higher protein setting wins over the gear minimum", () => {
  assert.equal(dayTargets("double", 80, { ...n, proteinPerKg: 2.2 }).protein, 176);
});

test("lose takes 300 kcal off rest and easy days only, keeping fat at 20% or more", () => {
  const lose = { ...n, goal: "lose" as const };
  for (const g of ["rest", "easy"] as const) {
    const a = dayTargets(g, 80, n), b = dayTargets(g, 80, lose);
    assert.ok(Math.abs(a.kcal - b.kcal - 300) <= 10);
    assert.ok((b.fat * 9) / kcalOf(b.carbs, b.protein, b.fat) >= 0.195);
    assert.equal(b.protein, a.protein);
  }
  assert.deepEqual(dayTargets("hard", 80, lose), dayTargets("hard", 80, n));
  assert.deepEqual(dayTargets("double", 80, lose), dayTargets("double", 80, n));
});

test("gain adds 300 kcal of carbs every day", () => {
  const a = dayTargets("hard", 80, n), b = dayTargets("hard", 80, { ...n, goal: "gain" });
  assert.equal(b.kcal - a.kcal, 300);
  assert.equal(b.carbs - a.carbs, 75);
  assert.equal(b.fat, a.fat);
});

test("height converts between ft/in and inches", () => {
  assert.equal(toInches(5, 10), 70);
  assert.deepEqual(fromInches(70), { ft: 5, inch: 10 });
  assert.deepEqual(fromInches(72), { ft: 6, inch: 0 });
});

test("resting energy: Katch-McArdle with body fat, Mifflin-St Jeor without, null when unknown", () => {
  assert.equal(Math.round(restingKcal(80, { ...n, bodyFat: 15 })!), Math.round(370 + 21.6 * 68));
  assert.equal(restingKcal(80, n), null);
  const m = restingKcal(80, { ...n, sex: "male", birthYear: 1996, heightIn: 70 }, 2026)!;
  assert.equal(Math.round(m), Math.round(800 + 6.25 * 177.8 - 150 + 5));
  assert.equal(burnKcal(80, n, 10, 60), null);
  assert.ok(burnKcal(80, { ...n, bodyFat: 15 }, 10, 60)! > burnKcal(80, { ...n, bodyFat: 15 }, 0, 0)!);
});

test("refuel window scales with weight", () => {
  assert.deepEqual(refuel(80), { beforeAm: [40, 80], perHourAfterAm: [80, 96], proteinAfterPm: 24 });
});

test("underFuelled needs the last 3 logged days all under 90%", () => {
  const d = (eaten: number) => ({ eaten, target: 3000 });
  assert.equal(underFuelled([d(2000), d(2000)]), false);
  assert.equal(underFuelled([d(2000), d(2600), d(2600)]), true);
  assert.equal(underFuelled([d(2600), d(2600), d(2800)]), false);
});

test("normalizeNutrition drops bad values and fills defaults; settings carry it", () => {
  const r = normalizeNutrition({ sex: "x", birthYear: "1990", heightIn: 70, bodyFat: 99, proteinPerKg: 0, goal: "lose" });
  assert.deepEqual(r, { sex: undefined, birthYear: undefined, heightIn: 70, weightLb: undefined, bodyFat: undefined, proteinPerKg: 1.6, activity: "moderate", goal: "lose" });
  assert.deepEqual(normalizeSettings({}).nutrition, normalizeNutrition(undefined));
});

test("fromInches rounds decimal heights to a whole inch", () => {
  assert.deepEqual(fromInches(71.6), { ft: 6, inch: 0 });
  assert.deepEqual(fromInches(69.4), { ft: 5, inch: 9 });
});

test("rates show per pound", async () => {
  const { fmtPerLb } = await import("../lib/nutrition");
  assert.equal(fmtPerLb(1.6), "0.73");
  assert.equal(fmtPerLb(9), "4.08");
  assert.equal(fmtPerLb(2.0), "0.91");
});
