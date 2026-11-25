import { parseDate } from "./format";
import type { Units } from "./format";

/** One day's body weight in kg (intervals.icu wellness is metric). */
export interface WeighIn { date: string; kg: number }

export const KG_PER_LB = 0.45359237;

/** Weight in the user's units: kg for km, lb for miles. */
export function fmtWeight(kg: number, u: Units, digits = 1): string {
  return u === "mi" ? `${(kg / KG_PER_LB).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`;
}

/** Signed change, e.g. "+0.4 kg" or "−1.2 lb". */
export function fmtWeightChange(kg: number, u: Units): string {
  const v = u === "mi" ? kg / KG_PER_LB : kg;
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toFixed(1)} ${u === "mi" ? "lb" : "kg"}`;
}

/** Wellness rows → weigh-ins with a weight, oldest first. */
export function weighIns(rows: { id?: string; weight?: number | null }[]): WeighIn[] {
  return rows
    .filter((r) => typeof r.id === "string" && parseDate(r.id) !== null && typeof r.weight === "number" && r.weight > 0)
    .map((r) => ({ date: r.id as string, kg: r.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const DAY = 86400000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface WeightSummary {
  latest: WeighIn;
  /** Average of weigh-ins in the 7 days ending on the latest one. */
  avg7: number;
  /** avg7 minus the average of the 7 days before that; null without data in both weeks. */
  weekChange: number | null;
}

export function summarize(list: WeighIn[]): WeightSummary | null {
  const latest = list[list.length - 1];
  const end = latest && parseDate(latest.date);
  if (!end) return null;
  const within = (from: number, to: number) => list.filter((w) => {
    const ago = Math.round((end.getTime() - parseDate(w.date)!.getTime()) / DAY);
    return ago >= from && ago < to;
  }).map((w) => w.kg);
  const thisWeek = avg(within(0, 7))!;
  const lastWeek = avg(within(7, 14));
  return { latest, avg7: thisWeek, weekChange: lastWeek === null ? null : thisWeek - lastWeek };
}
