/* Daily fuel targets that follow the training plan.
 * Sources: research/nutrition-endurance-runner.md (ACSM/AND/DC 2016 joint position, ISSN protein and
 * nutrient-timing stands, IOC REDs 2023) and research/nutrition-plan-comparison.md (maintenance,
 * loss and gain checked against published guidance).
 * Carbs are set per kg of body weight by the day's "gear" (rest, easy, hard, double threshold) plus a
 * bump on lift days, protein is steady per kg, fat is 25% of energy on rest and easy days and 20% on
 * hard and double days, and calories come from the three. Lose and gain work on the whole week:
 * a target rate (% of body weight a week) becomes a weekly kcal budget spread over the right days. */

import { KG_PER_LB } from "./weight";
import { isoDate } from "./format";

export type Sex = "male" | "female";
export type Activity = "low" | "moderate" | "high";
export type Goal = "lose" | "maintain" | "gain";
export type Gear = "rest" | "easy" | "hard" | "double";

export interface NutritionSettings {
  sex?: Sex;
  birthYear?: number;
  /** Height in inches. */
  heightIn?: number;
  /** Body weight in lb, typed by hand. Used when Health Connect has no weigh-in. */
  weightLb?: number;
  /** Body fat %, typed by hand. */
  bodyFat?: number;
  /** Daily protein, g per kg (shown per lb). Default 1 g/lb. Hard days use at least 1.8 g/kg, double days 2.0. */
  proteinPerKg: number;
  /** Day-to-day activity outside training. */
  activity: Activity;
  goal: Goal;
  /** Lose: target loss, % of body weight a week (0.25–1, default 0.5). */
  loseRate?: number;
  /** Gain: target gain, % of body weight a week (0.1–0.5, default 0.25). */
  gainRate?: number;
}

/** 1 g of protein per lb of body weight, in g/kg (about 2.2). */
export const DEFAULT_PROTEIN_PER_KG = 1 / KG_PER_LB;
/** The first default (1.6 g/kg); saves that still hold it move to the new default. Typed values are never exactly 1.6. */
const OLD_DEFAULT_PROTEIN = 1.6;

export const defaultNutrition = (): NutritionSettings => ({ proteinPerKg: DEFAULT_PROTEIN_PER_KG, activity: "moderate", goal: "maintain" });

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);

export function normalizeNutrition(raw: unknown): NutritionSettings {
  const d = defaultNutrition();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<NutritionSettings>;
  return {
    sex: r.sex === "male" || r.sex === "female" ? r.sex : undefined,
    birthYear: num(r.birthYear, 1900, 2100),
    heightIn: num(r.heightIn, 36, 96),
    weightLb: num(r.weightLb, 60, 600),
    bodyFat: num(r.bodyFat, 3, 60),
    proteinPerKg: r.proteinPerKg === OLD_DEFAULT_PROTEIN ? d.proteinPerKg : num(r.proteinPerKg, 1, 3) ?? d.proteinPerKg,
    activity: r.activity === "low" || r.activity === "high" ? r.activity : d.activity,
    goal: r.goal === "lose" || r.goal === "gain" ? r.goal : d.goal,
    loseRate: num(r.loseRate, LOSE_RATE.min, LOSE_RATE.max),
    gainRate: num(r.gainRate, GAIN_RATE.min, GAIN_RATE.max),
  };
}

/** Carbs g/kg per gear, the lowest a cut may take it to (bottom of the report's band), and protein floors. */
export const GEARS: Record<Gear, { label: string; carbs: number; minCarbs: number; protein: number }> = {
  rest: { label: "Rest", carbs: 4, minCarbs: 3, protein: 0 },
  easy: { label: "Easy", carbs: 5.5, minCarbs: 3, protein: 0 },
  hard: { label: "Hard", carbs: 7.5, minCarbs: 7, protein: 1.8 },
  double: { label: "Double threshold", carbs: 9, minCarbs: 8, protein: 2.0 },
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  low: "Mostly sitting",
  moderate: "Some walking most days",
  high: "On my feet all day",
};
/** Multipliers on resting energy for life outside training. */
const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.3, moderate: 1.45, high: 1.6 };

/** Fat share of energy: lower on hard and double days, where low-fat refuelling is advised (ACSM 2016). */
export const FAT_SHARE: Record<Gear, number> = { rest: 0.25, easy: 0.25, hard: 0.2, double: 0.2 };
/** Never below 20% of energy from fat (ACSM 2016). */
export const MIN_FAT_SHARE = 0.2;
/** Extra carbs on a day with a gym session, g/kg. The size is an estimate (research/nutrition-plan-comparison.md). */
export const LIFT_CARBS = 0.5;
/** Energy in a kg of body weight change, kcal (rule of thumb). */
export const KCAL_PER_KG = 7700;
/** Target rates, % of body weight a week (Helms 2014, Garthe 2011, Iraki 2019). */
export const LOSE_RATE = { min: 0.25, max: 1, default: 0.5 } as const;
export const GAIN_RATE = { min: 0.1, max: 0.5, default: 0.25 } as const;
/** Largest surplus added to any one day, kcal (Garthe 2013: about +500 built lean mass, more added fat). */
export const MAX_DAY_SURPLUS = 500;
/** Energy availability: a cut never takes a day below this, kcal per kg of lean mass (Loucks 2011). */
export const EA_FLOOR = 30;
/** Below this weekly average, warn (IOC 2023 doesn't diagnose from a number, so it's only a warning). */
export const EA_WARN = 35;
/** Body fat assumed for lean mass when none is entered, %. */
export const ASSUMED_BODY_FAT = 15;
export const loseRateOf = (n: Pick<NutritionSettings, "loseRate">) => n.loseRate ?? LOSE_RATE.default;
export const gainRateOf = (n: Pick<NutritionSettings, "gainRate">) => n.gainRate ?? GAIN_RATE.default;

/** The day's gear from the run plan's session type. Lifting adds LIFT_CARBS on top. */
export function gearFor(runType: string | undefined): Gear {
  if (!runType || runType === "rest") return "rest";
  if (runType === "double") return "double";
  if (runType === "easy") return "easy";
  return "hard"; // single, x, longrun, race, sub-T sessions, hills
}

export interface Targets { gear: Gear; carbs: number; protein: number; fat: number; kcal: number }

/** Calories in grams of carbs, protein and fat. */
export const kcalOf = (c: number, p: number, f: number) => c * 4 + p * 4 + f * 9;

interface Raw { carbs: number; protein: number; fat: number }
const rawKcal = (r: Raw) => kcalOf(r.carbs, r.protein, r.fat);

/** Maintenance targets before any goal, unrounded. */
function baseDay(gear: Gear, kg: number, n: Pick<NutritionSettings, "proteinPerKg">, lift: boolean): Raw {
  const g = GEARS[gear];
  const carbs = (g.carbs + (lift ? LIFT_CARBS : 0)) * kg;
  const protein = Math.max(n.proteinPerKg, g.protein) * kg;
  // Fat is a fixed share of the energy: kcal = (4C + 4P) / (1 - share).
  const share = FAT_SHARE[gear];
  const fat = (((carbs * 4 + protein * 4) / (1 - share)) * share) / 9;
  return { carbs, protein, fat };
}

const round = (gear: Gear, r: Raw): Targets => {
  const t = { carbs: Math.round(r.carbs), protein: Math.round(r.protein), fat: Math.round(r.fat) };
  return { gear, ...t, kcal: Math.round(kcalOf(t.carbs, t.protein, t.fat) / 10) * 10 };
};

/** Maintenance targets for one day (no goal applied). */
export function dayTargets(gear: Gear, kg: number, n: Pick<NutritionSettings, "proteinPerKg">, lift = false): Targets {
  return round(gear, baseDay(gear, kg, n, lift));
}

/** One day of the week as weekTargets sees it. */
export interface WeekDayIn { gear: Gear; lift: boolean; runKm: number; liftMin: number }

export interface WeekSummary {
  /** Planned intake and, when Profile allows, estimated burn, kcal for the week. */
  intake: number;
  burn: number | null;
  /** The goal's change to the week against the maintenance targets, kcal (negative = deficit). */
  adjust: number;
  /** What the goal asked for, kcal for the week (negative = deficit). */
  wanted: number;
  /** Expected change: against estimated burn when known, else against maintenance; kg and % of body weight a week. */
  kgPerWeek: number;
  pctPerWeek: number;
  /** Intake minus estimated burn, as kg a week; null without a burn estimate. */
  burnKgPerWeek: number | null;
  /** Lean mass used for energy availability, and whether body fat was assumed. */
  leanKg: number;
  leanAssumed: boolean;
  /** Energy availability, kcal per kg lean mass: weekly average and lowest day. */
  eaAvg: number;
  eaMin: number;
  /** True when the plan can't land on the goal without breaking the floors (or the 500 kcal/day gain cap). */
  short: boolean;
}

/** Lean mass from body fat, or from ASSUMED_BODY_FAT when none is entered. */
export function leanMass(kg: number, n: Pick<NutritionSettings, "bodyFat">) {
  return { kg: kg * (1 - (n.bodyFat ?? ASSUMED_BODY_FAT) / 100), assumed: !n.bodyFat };
}

/** Spreads `total` over slots with the given capacities as evenly as possible. */
function spread(total: number, caps: number[]): number[] {
  const take = caps.map(() => 0);
  let left = total;
  let open = caps.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
  while (left > 0.5 && open.length) {
    const each = left / open.length;
    for (const i of open) { const t = Math.min(each, caps[i] - take[i]); take[i] += t; left -= t; }
    open = open.filter((i) => caps[i] - take[i] > 0.5);
  }
  return take;
}

/** A week's targets with the goal applied across it, plus a summary. Days are Monday to Sunday. */
export function weekTargets(days: WeekDayIn[], kg: number, n: NutritionSettings, year?: number): { days: Targets[]; summary: WeekSummary } {
  const raw = days.map((d) => baseDay(d.gear, kg, n, d.lift));
  const lean = leanMass(kg, n);
  const train = days.map((d) => trainingKcal(kg, d.runKm, d.liftMin));
  const light = days.map((d) => d.gear === "rest" || d.gear === "easy");
  const burns = days.map((d) => burnKcal(kg, n, d.runKm, d.liftMin, year));
  const burn = burns.every((b) => b !== null) ? (burns as number[]).reduce((a, b) => a + b, 0) : null;
  const maintIntake = raw.reduce((a, r) => a + rawKcal(r), 0);
  // The goal is aimed at the estimated burn when Profile allows one, else at the maintenance targets.
  const gap = burn === null ? 0 : maintIntake - burn;
  let adjust = 0;
  const wanted = n.goal === "lose" ? -(loseRateOf(n) / 100) * kg * KCAL_PER_KG
    : n.goal === "gain" ? (gainRateOf(n) / 100) * kg * KCAL_PER_KG : 0;
  const eaFloor = (i: number) => EA_FLOOR * lean.kg + train[i];

  /** Takes `amount` kcal off the week: rest and easy days first, then hard-day carbs to the bottom of their band. */
  const cut = (amount: number) => {
    // 1. Rest and easy days: off fat (to 20% of energy), then carbs (to 3 g/kg of lean mass), keeping energy availability ≥ EA_FLOOR.
    const caps = raw.map((r, i) => {
      if (!light[i]) return 0;
      const floorMacros = (GEARS[days[i].gear].minCarbs * lean.kg * 4 + r.protein * 4) / (1 - MIN_FAT_SHARE);
      return Math.max(0, rawKcal(r) - Math.max(eaFloor(i), floorMacros));
    });
    let done = 0;
    spread(amount, caps).forEach((c, i) => {
      if (!c) return;
      const r = raw[i];
      const newKcal = rawKcal(r) - c;
      const fromFat = Math.min(c / 9, Math.max(0, r.fat - (newKcal * MIN_FAT_SHARE) / 9));
      r.fat -= fromFat;
      r.carbs -= (c - fromFat * 9) / 4;
      done += c;
    });
    // 2. Still short: hard and double days give carbs down to the bottom of their band (7 and 8 g/kg); their fat is already at 20%.
    if (amount - done > 0.5) {
      const caps2 = raw.map((r, i) => (light[i] ? 0 : Math.max(0, Math.min(
        (r.carbs - GEARS[days[i].gear].minCarbs * kg) * 4,
        rawKcal(r) - eaFloor(i),
      ))));
      spread(amount - done, caps2).forEach((c, i) => { if (c) { raw[i].carbs -= c / 4; done += c; } });
    }
    adjust -= done;
  };
  /** Adds `amount` kcal to the week: rest and easy days first, then hard and double days; at most MAX_DAY_SURPLUS a day, half carbs, half fat. */
  const add = (amount: number) => {
    const first = spread(amount, raw.map((_, i) => (light[i] ? MAX_DAY_SURPLUS : 0)));
    const placed = first.reduce((a, b) => a + b, 0);
    const second = spread(amount - placed, raw.map((_, i) => (light[i] ? 0 : MAX_DAY_SURPLUS)));
    raw.forEach((r, i) => {
      const k = first[i] + second[i];
      r.carbs += k / 2 / 4;
      r.fat += k / 2 / 9;
      adjust += k;
    });
  };

  if (n.goal !== "maintain") {
    // Move the maintenance week to the goal: aimed at the estimated burn when there is one (either way, so
    // a goal is never overshot), else a straight change to the maintenance week.
    const delta = wanted - gap;
    if (delta < 0) cut(-delta); else if (delta > 0) add(delta);
  }

  const out = raw.map((r, i) => round(days[i].gear, r));
  const intake = out.reduce((a, t) => a + t.kcal, 0);
  // Expected change: against the burn when there is one, else the goal's change to the maintenance week.
  const change = burn === null ? adjust : intake - burn;
  const ea = out.map((t, i) => (t.kcal - train[i]) / lean.kg);
  return {
    days: out,
    summary: {
      intake, burn, adjust: Math.round(adjust), wanted: Math.round(wanted),
      kgPerWeek: change / KCAL_PER_KG,
      pctPerWeek: (change / KCAL_PER_KG / kg) * 100,
      burnKgPerWeek: burn === null ? null : (intake - burn) / KCAL_PER_KG,
      leanKg: lean.kg, leanAssumed: lean.assumed,
      eaAvg: ea.reduce((a, b) => a + b, 0) / ea.length,
      eaMin: Math.min(...ea),
      // Off by more than rounding (about 90 kcal a week) and a tenth of the goal.
      short: n.goal !== "maintain" && Math.abs(change - wanted) > Math.max(150, 0.1 * Math.abs(wanted)),
    },
  };
}

export const lbToKg = (lb: number) => lb * KG_PER_LB;
/** A per-kg rate (g/kg) as per pound (g/lb). The app shows every rate per lb. */
export const perLb = (perKg: number) => perKg * KG_PER_LB;
/** "0.73": a per-lb rate to two decimals. */
export const fmtPerLb = (perKg: number) => perLb(perKg).toFixed(2);

/** Height from feet and inches. */
export const toInches = (ft: number, inch: number) => ft * 12 + inch;
export const fromInches = (h: number) => { const r = Math.round(h); return { ft: Math.floor(r / 12), inch: r % 12 }; };

/** Resting energy: Cunningham with body fat (best in athletes), else Mifflin-St Jeor with sex, age and height; null if neither is possible. */
export function restingKcal(kg: number, n: NutritionSettings, year = new Date().getFullYear()): number | null {
  if (n.bodyFat) return 500 + 22 * kg * (1 - n.bodyFat / 100);
  if (!n.sex || !n.birthYear || !n.heightIn) return null;
  const cm = n.heightIn * 2.54;
  return 10 * kg + 6.25 * cm - 5 * (year - n.birthYear) + (n.sex === "male" ? 5 : -161);
}

/** Training energy: about 1 kcal per kg per km run (the usual gross estimate), and net MET 4 (MET 5 − 1) for lifting. */
export const trainingKcal = (kg: number, runKm: number, liftMin: number) => kg * runKm + 4 * kg * (liftMin / 60);

/** Estimated burn for the day: resting × life outside training + training; null without enough profile data. */
export function burnKcal(kg: number, n: NutritionSettings, runKm: number, liftMin: number, year?: number): number | null {
  const r = restingKcal(kg, n, year);
  return r === null ? null : Math.round((r * ACTIVITY_FACTOR[n.activity] + trainingKcal(kg, runKm, liftMin)) / 10) * 10;
}

/** Between two sessions under 8 h apart (double threshold days), from the report's Finding 3. */
export function refuel(kg: number) {
  return {
    beforeAm: [Math.round(0.5 * kg), Math.round(1 * kg)] as const,
    perHourAfterAm: [Math.round(1 * kg), Math.round(1.2 * kg)] as const,
    proteinAfterPm: Math.round(0.3 * kg),
  };
}

/** What was eaten on one day. */
export interface FoodLog { date: string; carbs: number; protein: number; fat: number }

/** True when the last `days` logged days in a row (ending at the latest) were all under `share` of their target. */
export function underFuelled(logs: { eaten: number; target: number }[], days = 3, share = 0.9): boolean {
  if (logs.length < days) return false;
  return logs.slice(-days).every((d) => d.target > 0 && d.eaten < d.target * share);
}

/** A day's synced totals, with the apps that wrote its meals. */
export type SyncedDay = FoodLog & { apps: string[] };

/** Health Connect app ids people will recognise. */
const APP_NAMES: Record<string, string> = { "com.myfitnesspal.android": "MyFitnessPal" };
export const appName = (id: string) => APP_NAMES[id] ?? id;

/** Meals synced from Health Connect → daily totals by local date (grams rounded). Days with nothing eaten are left out. */
export function dailyFromMeals(meals: { at: string; carbs: number; protein: number; fat: number; source?: string | null }[]): Record<string, SyncedDay> {
  const out: Record<string, SyncedDay> = {};
  for (const m of meals) {
    const t = Date.parse(m.at);
    if (!Number.isFinite(t)) continue;
    const date = isoDate(new Date(t));
    const d = (out[date] ??= { date, carbs: 0, protein: 0, fat: 0, apps: [] });
    if (m.source && !d.apps.includes(appName(m.source))) d.apps.push(appName(m.source));
    d.carbs += Number(m.carbs) || 0; d.protein += Number(m.protein) || 0; d.fat += Number(m.fat) || 0;
  }
  for (const d of Object.values(out)) {
    d.carbs = Math.round(d.carbs); d.protein = Math.round(d.protein); d.fat = Math.round(d.fat);
    if (!d.carbs && !d.protein && !d.fat) delete out[d.date]; // calories only: no macros to show
  }
  return out;
}

/** What was eaten each day: a day typed by hand wins over the synced total for that day. */
export function mergeEaten(manual: Record<string, FoodLog>, synced: Record<string, FoodLog>): Record<string, FoodLog & { source: "manual" | "synced" }> {
  const out: Record<string, FoodLog & { source: "manual" | "synced" }> = {};
  for (const [k, v] of Object.entries(synced)) out[k] = { ...v, source: "synced" };
  for (const [k, v] of Object.entries(manual)) out[k] = { ...v, source: "manual" };
  return out;
}
