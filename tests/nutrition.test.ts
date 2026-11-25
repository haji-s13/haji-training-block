import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROTEIN_PER_KG, burnKcal, dayTargets, defaultNutrition, fromInches, gearFor, kcalOf, normalizeNutrition, refuel, restingKcal, toInches, underFuelled } from "../lib/nutrition";
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
  const low = { ...n, proteinPerKg: 1.6 };
  const easy = dayTargets("easy", kg, low), hard = dayTargets("hard", kg, low), dbl = dayTargets("double", kg, low);
  assert.equal(easy.carbs, 440);   // 5.5 g/kg
  assert.equal(hard.carbs, 600);   // 7.5 g/kg
  assert.equal(dbl.carbs, 720);    // 9 g/kg
  assert.equal(easy.protein, 128); // 1.6 g/kg
  assert.equal(hard.protein, 144); // at least 1.8 g/kg
  assert.equal(dbl.protein, 160);  // at least 2.0 g/kg
  assert.ok(easy.kcal < hard.kcal && hard.kcal < dbl.kcal);
});


test("a higher protein setting wins over the gear minimum", () => {
  assert.equal(dayTargets("double", 80, { ...n, proteinPerKg: 2.2 }).protein, 176);
});



test("height converts between ft/in and inches", () => {
  assert.equal(toInches(5, 10), 70);
  assert.deepEqual(fromInches(70), { ft: 5, inch: 10 });
  assert.deepEqual(fromInches(72), { ft: 6, inch: 0 });
});

test("resting energy: Cunningham with body fat, Mifflin-St Jeor without, null when unknown", () => {
  assert.equal(Math.round(restingKcal(80, { ...n, bodyFat: 15 })!), Math.round(500 + 22 * 68));
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
  assert.deepEqual(r, { sex: undefined, birthYear: undefined, heightIn: 70, weightLb: undefined, bodyFat: undefined, proteinPerKg: DEFAULT_PROTEIN_PER_KG, activity: "moderate", goal: "lose", loseRate: undefined, gainRate: undefined });
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

test("default protein is 1 g per lb on every day, and the old 1.6 g/kg default moves to it", async () => {
  const { fmtPerLb } = await import("../lib/nutrition");
  assert.equal(fmtPerLb(defaultNutrition().proteinPerKg), "1.00");
  const lb = 185.8, kg = lb * 0.45359237;
  for (const g of ["rest", "easy", "hard", "double"] as const) assert.equal(dayTargets(g, kg, n).protein, Math.round(lb));
  assert.equal(normalizeNutrition({ proteinPerKg: 1.6 }).proteinPerKg, DEFAULT_PROTEIN_PER_KG);
  assert.equal(normalizeNutrition({ proteinPerKg: 1.61 }).proteinPerKg, 1.61); // a typed 0.73 g/lb stays
});

test("dailyFromMeals sums synced meals by local day and names the app", async () => {
  const { dailyFromMeals } = await import("../lib/nutrition");
  const at = (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, "0")}:30:00`).toISOString();
  const days = dailyFromMeals([
    { at: at("2026-11-24", 8), carbs: 80.4, protein: 30.2, fat: 10, source: "com.myfitnesspal.android" },
    { at: at("2026-11-24", 19), carbs: 120, protein: 50, fat: 25.6, source: "com.myfitnesspal.android" },
    { at: at("2026-11-25", 7), carbs: 60, protein: 20, fat: 5 },
    { at: "not a date", carbs: 999, protein: 999, fat: 999 },
  ]);
  assert.deepEqual(days["2026-11-24"], { date: "2026-11-24", carbs: 200, protein: 80, fat: 36, apps: ["MyFitnessPal"] });
  assert.deepEqual(days["2026-11-25"], { date: "2026-11-25", carbs: 60, protein: 20, fat: 5, apps: [] });
  assert.equal(Object.keys(days).length, 2);
});

test("mergeEaten: a day typed by hand wins over the synced total", async () => {
  const { mergeEaten } = await import("../lib/nutrition");
  const synced = { "2026-11-24": { date: "2026-11-24", carbs: 200, protein: 80, fat: 36 }, "2026-11-25": { date: "2026-11-25", carbs: 60, protein: 20, fat: 5 } };
  const manual = { "2026-11-24": { date: "2026-11-24", carbs: 300, protein: 150, fat: 70 } };
  const out = mergeEaten(manual, synced);
  assert.equal(out["2026-11-24"].carbs, 300);
  assert.equal(out["2026-11-24"].source, "manual");
  assert.equal(out["2026-11-25"].source, "synced");
});


test("calories-only synced records don't create an empty day", async () => {
  const { dailyFromMeals } = await import("../lib/nutrition");
  assert.deepEqual(dailyFromMeals([{ at: new Date(2026, 10, 24, 12).toISOString(), carbs: 0, protein: 0, fat: 0 }]), {});
});


// ---- Week-level targets (research/nutrition-plan-comparison.md) ----
import { EA_FLOOR, FAT_SHARE, KCAL_PER_KG, LIFT_CARBS, leanMass, trainingKcal, weekTargets, type WeekDayIn } from "../lib/nutrition";

const KG = 84.3;
const WEEK: WeekDayIn[] = [
  { gear: "easy", lift: true, runKm: 10, liftMin: 70 }, { gear: "double", lift: true, runKm: 20, liftMin: 40 },
  { gear: "easy", lift: true, runKm: 10, liftMin: 75 }, { gear: "double", lift: false, runKm: 20, liftMin: 0 },
  { gear: "easy", lift: true, runKm: 8, liftMin: 75 }, { gear: "hard", lift: false, runKm: 14, liftMin: 0 },
  { gear: "hard", lift: false, runKm: 18, liftMin: 0 },
];
const P = { ...n, sex: "male" as const, birthYear: 1994, heightIn: 70 };
const share = (t: { carbs: number; protein: number; fat: number }) => (t.fat * 9) / kcalOf(t.carbs, t.protein, t.fat);

test("fat is 25% on rest and easy days, 20% on hard and double days; macros add up", () => {
  for (const g of ["rest", "easy", "hard", "double"] as const) {
    const t = dayTargets(g, 72, n);
    assert.ok(Math.abs(share(t) - FAT_SHARE[g]) < 0.01, g);
    assert.ok(Math.abs(kcalOf(t.carbs, t.protein, t.fat) - t.kcal) <= 10);
  }
});

test("a lift adds carbs to the day", () => {
  assert.equal(dayTargets("easy", 80, n, true).carbs - dayTargets("easy", 80, n).carbs, LIFT_CARBS * 80);
});

test("maintain: the week is close to the estimated burn and has no adjustment", () => {
  const { summary } = weekTargets(WEEK, KG, { ...P, goal: "maintain" }, 2026);
  assert.equal(summary.adjust, 0);
  assert.ok(Math.abs(summary.intake - summary.burn!) / summary.burn! < 0.05, `${summary.intake} vs ${summary.burn}`);
});

test("lose: cuts rest and easy days first, keeps every day above the energy floor, reports a shortfall", () => {
  const base = weekTargets(WEEK, KG, { ...P, goal: "maintain" }, 2026).days;
  const { days, summary } = weekTargets(WEEK, KG, { ...P, goal: "lose", loseRate: 0.5 }, 2026);
  const lean = leanMass(KG, P).kg;
  days.forEach((t, i) => {
    assert.ok(t.kcal <= base[i].kcal);
    assert.ok((t.kcal - trainingKcal(KG, WEEK[i].runKm, WEEK[i].liftMin)) / lean >= EA_FLOOR - 0.5, `day ${i}`);
    assert.ok(share(t) >= 0.195, `fat day ${i}`);
    assert.equal(t.protein, base[i].protein);
  });
  // Hard and double days never drop below the bottom of their carb band.
  days.forEach((t, i) => { if (WEEK[i].gear === "hard") assert.ok(t.carbs >= 7 * KG - 1); if (WEEK[i].gear === "double") assert.ok(t.carbs >= 8 * KG - 1); });
  assert.ok(summary.adjust < 0);
  assert.equal(summary.wanted, Math.round(-0.005 * KG * KCAL_PER_KG));
  assert.equal(summary.short, true); // this training load can't reach 0.5%/week
});

test("lose: with rest days and lighter training a modest rate fits fully", () => {
  const light: WeekDayIn[] = [
    { gear: "rest", lift: false, runKm: 0, liftMin: 0 }, { gear: "easy", lift: false, runKm: 6, liftMin: 0 },
    { gear: "hard", lift: false, runKm: 10, liftMin: 0 }, { gear: "rest", lift: false, runKm: 0, liftMin: 0 },
    { gear: "easy", lift: false, runKm: 6, liftMin: 0 }, { gear: "easy", lift: false, runKm: 6, liftMin: 0 },
    { gear: "hard", lift: false, runKm: 14, liftMin: 0 },
  ];
  // Rates below the Profile minimum are allowed here to find what this week fits fully.
  const quarter = weekTargets(light, KG, { ...P, goal: "lose", loseRate: 0.2 }, 2026).summary;
  assert.equal(quarter.short, false);
  assert.ok(Math.abs(quarter.pctPerWeek + 0.2) < 0.02, `${quarter.pctPerWeek}`);
  // At 0.5% the energy floor binds, but a light week still cuts more than the heavy one.
  const half = weekTargets(light, KG, { ...P, goal: "lose", loseRate: 0.5 }, 2026).summary;
  const heavy = weekTargets(WEEK, KG, { ...P, goal: "lose", loseRate: 0.5 }, 2026).summary;
  assert.ok(half.pctPerWeek < heavy.pctPerWeek);
  assert.ok(half.eaMin >= EA_FLOOR - 0.5);
});

test("gain: reaches the rate, light days first, at most 500 kcal added to a day", () => {
  const base = weekTargets(WEEK, KG, { ...P, goal: "maintain" }, 2026).days;
  const { days, summary } = weekTargets(WEEK, KG, { ...P, goal: "gain", gainRate: 0.25 }, 2026);
  assert.equal(summary.short, false);
  assert.ok(Math.abs(summary.pctPerWeek - 0.25) < 0.01);
  days.forEach((t, i) => assert.ok(t.kcal - base[i].kcal <= 510));
  const lightAdd = days.reduce((a, t, i) => a + (WEEK[i].gear === "easy" ? t.kcal - base[i].kcal : 0), 0);
  assert.ok(lightAdd > 0, `${lightAdd}`);
  // With only 1622 kcal to place and 3 easy days of 500 room, hard days get just the remainder.
  const hardAdd = days.reduce((a, t, i) => a + (WEEK[i].gear !== "easy" ? t.kcal - base[i].kcal : 0), 0);
  assert.ok(hardAdd < 200, `${hardAdd}`);
});

test("rates are kept in range; old deficit saves are ignored", () => {
  assert.equal(normalizeNutrition({ loseRate: 2 }).loseRate, undefined);
  assert.equal(normalizeNutrition({ loseRate: 0.75 }).loseRate, 0.75);
  assert.equal(normalizeNutrition({ gainRate: 0.05 }).gainRate, undefined);
  assert.equal((normalizeNutrition({ deficit: 500 }) as unknown as Record<string, unknown>).deficit, undefined);
});

test("energy availability uses lean mass from body fat, or an assumed 15%", () => {
  assert.deepEqual(leanMass(80, {}), { kg: 68, assumed: true });
  assert.deepEqual(leanMass(80, { bodyFat: 10 }), { kg: 72, assumed: false });
});

test("goals never overshoot: a week already past the goal moves back towards it", () => {
  // A small, light person: maintenance targets sit well below burn, so "lose 0.25%" must add food back.
  const rest: WeekDayIn[] = Array.from({ length: 7 }, () => ({ gear: "rest", lift: false, runKm: 0, liftMin: 0 }));
  const small = { ...P, goal: "lose" as const, loseRate: 0.25, heightIn: 70 };
  const maint = weekTargets(rest, 50, { ...small, goal: "maintain" }, 2026).summary;
  const lose = weekTargets(rest, 50, small, 2026).summary;
  assert.ok(maint.pctPerWeek < -0.5, `${maint.pctPerWeek}`);
  assert.ok(lose.adjust > 0, "adds food back");
  assert.ok(Math.abs(lose.pctPerWeek + 0.25) < 0.05, `${lose.pctPerWeek}`);
  // A heavy week where maintenance already gains more than asked: "gain" trims.
  const big = weekTargets(WEEK, KG, { ...P, goal: "gain", gainRate: 0.1 }, 2026).summary;
  assert.ok(Math.abs(big.pctPerWeek - 0.1) < 0.05, `${big.pctPerWeek}`);
});

test("gain is short when it needs more than 500 kcal a day", () => {
  const rest: WeekDayIn[] = Array.from({ length: 7 }, () => ({ gear: "rest", lift: false, runKm: 0, liftMin: 0 }));
  const { summary } = weekTargets(rest, 140, { ...defaultNutrition(), goal: "gain", gainRate: 0.5 }); // no burn: +5,390 wanted, cap 3,500
  assert.equal(summary.short, true);
  assert.ok(summary.adjust <= 7 * 500 + 1);
});

test("rounding alone doesn't flag a shortfall", () => {
  const { summary } = weekTargets(WEEK, KG, { ...P, goal: "gain", gainRate: 0.25 }, 2026);
  assert.equal(summary.short, false);
});
