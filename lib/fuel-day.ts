import type { Calendar } from "./calendar";
import { isoDate } from "./format";
import type { LiftPlan } from "./lifting";
import { addDays } from "./calendar";
import { gearFor, weekTargets, type Gear, type NutritionSettings, type Targets, type WeekSummary } from "./nutrition";
import { dayKm, type Plan } from "./plan";

/** One day as the Fuel tab and the Dashboard see it: its gear, what's planned and its targets. */
export interface FuelDay {
  date: Date;
  iso: string;
  inPlan: boolean;
  gear: Gear;
  runTitle: string | null;
  runKm: number;
  lift: { title: string; min: number } | null;
  /** Null without a body weight. */
  targets: Targets | null;
}

/** A day's plan without targets. `date` should be local noon. */
function planDay(date: Date, cal: Calendar, plan: Plan | null, lifting: LiftPlan): Omit<FuelDay, "targets"> {
  const start = cal.weeks[0].start;
  const off = Math.round((date.getTime() - start.getTime()) / 86400000);
  const at = off >= 0 && off < cal.weeks.length * 7 ? { w: Math.floor(off / 7), i: off % 7 } : null;
  const run = at ? plan?.weeks[at.w]?.days[at.i] : undefined;
  const hx = at ? lifting.weeks[at.w]?.days[at.i] : undefined;
  return {
    date, iso: isoDate(date), inPlan: !!at, gear: gearFor(run?.type),
    runTitle: run ? run.title : null,
    runKm: run ? dayKm(run) : 0,
    lift: hx && (hx.type === "upper" || hx.type === "lower") ? { title: hx.title, min: hx.min } : null,
  };
}

/** The seven days from `monday` (local noon) with targets that spread the goal over the week. */
export function fuelWeek(monday: Date, cal: Calendar, plan: Plan | null, lifting: LiftPlan, kg: number | null, n: NutritionSettings, year?: number): { days: FuelDay[]; summary: WeekSummary | null } {
  const days = Array.from({ length: 7 }, (_, k) => planDay(addDays(monday, k), cal, plan, lifting));
  if (!kg) return { days: days.map((d) => ({ ...d, targets: null })), summary: null };
  const w = weekTargets(days.map((d) => ({ gear: d.gear, lift: !!d.lift, runKm: d.runKm, liftMin: d.lift?.min ?? 0 })), kg, n, year);
  return { days: days.map((d, i) => ({ ...d, targets: w.days[i] })), summary: w.summary };
}
