import type { Calendar } from "./calendar";
import { isoDate } from "./format";
import type { LiftPlan } from "./lifting";
import { dayTargets, gearFor, type Gear, type NutritionSettings, type Targets } from "./nutrition";
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

/** Builds a FuelDay from the run and lifting plans. `date` should be local noon. */
export function fuelDay(date: Date, cal: Calendar, plan: Plan | null, lifting: LiftPlan, kg: number | null, n: NutritionSettings): FuelDay {
  const start = cal.weeks[0].start;
  const off = Math.round((date.getTime() - start.getTime()) / 86400000);
  const at = off >= 0 && off < cal.weeks.length * 7 ? { w: Math.floor(off / 7), i: off % 7 } : null;
  const run = at ? plan?.weeks[at.w]?.days[at.i] : undefined;
  const hx = at ? lifting.weeks[at.w]?.days[at.i] : undefined;
  const gear = gearFor(run?.type);
  return {
    date, iso: isoDate(date), inPlan: !!at, gear,
    runTitle: run ? run.title : null,
    runKm: run ? dayKm(run) : 0,
    lift: hx && (hx.type === "upper" || hx.type === "lower") ? { title: hx.title, min: hx.min } : null,
    targets: kg ? dayTargets(gear, kg, n) : null,
  };
}
