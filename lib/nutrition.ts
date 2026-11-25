/* Daily fuel targets that follow the training plan.
 * Source: the nutrition report in research/nutrition-endurance-runner.md (ACSM/AND/DC 2016 joint
 * position, ISSN protein and nutrient-timing stands, IOC REDs 2023).
 * Carbs are set per kg of body weight by the day's "gear" (rest, easy, hard, double threshold),
 * protein is steady per kg, fat is a quarter of energy, and calories come from the three. */

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
  /** Lose: kcal taken off rest and easy days. Default 500. */
  deficit?: number;
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
    deficit: num(r.deficit, MIN_DEFICIT, MAX_DEFICIT),
  };
}

export const GEARS: Record<Gear, { label: string; carbs: number; protein: number }> = {
  rest: { label: "Rest", carbs: 4, protein: 0 },
  easy: { label: "Easy", carbs: 5.5, protein: 0 },
  hard: { label: "Hard", carbs: 7.5, protein: 1.8 },
  double: { label: "Double threshold", carbs: 9, protein: 2.0 },
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  low: "Mostly sitting",
  moderate: "Some walking most days",
  high: "On my feet all day",
};
/** Multipliers on resting energy for life outside training. */
const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.3, moderate: 1.45, high: 1.6 };

export const FAT_SHARE = 0.25;
export const MIN_FAT_SHARE = 0.2;
/** Calories "gain" adds to every day, as carbs. */
export const GOAL_KCAL = 300;
/** Default and allowed range for the "lose" deficit on rest and easy days. */
export const DEFAULT_DEFICIT = 500;
export const MIN_DEFICIT = 100;
export const MAX_DEFICIT = 1000;
export const deficitOf = (n: Pick<NutritionSettings, "deficit">) => n.deficit ?? DEFAULT_DEFICIT;

/** The day's gear from the run plan's session type. Lifting doesn't change it. */
export function gearFor(runType: string | undefined): Gear {
  if (!runType || runType === "rest") return "rest";
  if (runType === "double") return "double";
  if (runType === "easy") return "easy";
  return "hard"; // single, x, longrun, race, sub-T sessions, hills
}

export interface Targets { gear: Gear; carbs: number; protein: number; fat: number; kcal: number }

/** Calories in grams of carbs, protein and fat. */
export const kcalOf = (c: number, p: number, f: number) => c * 4 + p * 4 + f * 9;

export function dayTargets(gear: Gear, kg: number, n: Pick<NutritionSettings, "proteinPerKg" | "goal" | "deficit">): Targets {
  const g = GEARS[gear];
  let carbs = g.carbs * kg;
  const protein = Math.max(n.proteinPerKg, g.protein) * kg;
  // Fat is a quarter of the energy: kcal = (4C + 4P) / (1 - share).
  let kcal = (carbs * 4 + protein * 4) / (1 - FAT_SHARE);
  let fat = (kcal * FAT_SHARE) / 9;
  const light = gear === "rest" || gear === "easy";
  if (n.goal === "lose" && light) {
    // Off fat first, down to 20% of the new total, then off carbs. Hard days stay fully fuelled.
    const cut = deficitOf(n);
    const newKcal = kcal - cut;
    const minFat = (newKcal * MIN_FAT_SHARE) / 9;
    const fromFat = Math.min(cut / 9, Math.max(0, fat - minFat));
    fat -= fromFat;
    carbs = Math.max(0, carbs - (cut - fromFat * 9) / 4);
    kcal = carbs > 0 ? newKcal : kcalOf(carbs, protein, fat);
  } else if (n.goal === "gain") {
    carbs += GOAL_KCAL / 4;
    kcal += GOAL_KCAL;
  }
  return { gear, carbs: Math.round(carbs), protein: Math.round(protein), fat: Math.round(fat), kcal: Math.round(kcal / 10) * 10 };
}

export const lbToKg = (lb: number) => lb * KG_PER_LB;
/** A per-kg rate (g/kg) as per pound (g/lb). The app shows every rate per lb. */
export const perLb = (perKg: number) => perKg * KG_PER_LB;
/** "0.73": a per-lb rate to two decimals. */
export const fmtPerLb = (perKg: number) => perLb(perKg).toFixed(2);

/** Height from feet and inches. */
export const toInches = (ft: number, inch: number) => ft * 12 + inch;
export const fromInches = (h: number) => { const r = Math.round(h); return { ft: Math.floor(r / 12), inch: r % 12 }; };

/** Resting energy: Katch-McArdle with body fat, else Mifflin-St Jeor with sex, age and height; null if neither is possible. */
export function restingKcal(kg: number, n: NutritionSettings, year = new Date().getFullYear()): number | null {
  if (n.bodyFat) return 370 + 21.6 * kg * (1 - n.bodyFat / 100);
  if (!n.sex || !n.birthYear || !n.heightIn) return null;
  const cm = n.heightIn * 2.54;
  return 10 * kg + 6.25 * cm - 5 * (year - n.birthYear) + (n.sex === "male" ? 5 : -161);
}

/** Rough training energy: about 1 kcal per kg per km run, and MET 5 for lifting. */
export const trainingKcal = (kg: number, runKm: number, liftMin: number) => kg * runKm + 5 * kg * (liftMin / 60);

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
