import { isoDate, parseDate } from "./format";

/** One weigh-in: the day it was on, the weight in kg and (when known) the time in ms. */
export interface WeighIn { date: string; kg: number; ts?: number }
export type WeightUnit = "lb" | "kg";

export const KG_PER_LB = 0.45359237;

/** "176.4 lb" or "80.0 kg". */
export function fmtWeight(kg: number, u: WeightUnit, digits = 1): string {
  return u === "lb" ? `${(kg / KG_PER_LB).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`;
}

/** Signed change, e.g. "+0.4 kg" or "−1.2 lb". */
export function fmtWeightChange(kg: number, u: WeightUnit): string {
  const v = u === "lb" ? kg / KG_PER_LB : kg;
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toFixed(1)} ${u}`;
}

/** Timed weigh-ins → the last one of each local day, oldest first. */
export function dailyWeighIns(list: { ts: number; kg: number }[]): WeighIn[] {
  const byDay = new Map<string, WeighIn>();
  for (const w of list) {
    if (!(w.kg > 0) || !Number.isFinite(w.ts)) continue;
    const date = isoDate(new Date(w.ts));
    const cur = byDay.get(date);
    if (!cur || (cur.ts ?? 0) < w.ts) byDay.set(date, { date, kg: w.kg, ts: w.ts });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
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
    const d = parseDate(w.date);
    if (!d) return false;
    const ago = Math.round((end.getTime() - d.getTime()) / DAY);
    return ago >= from && ago < to;
  }).map((w) => w.kg);
  const thisWeek = avg(within(0, 7))!;
  const lastWeek = avg(within(7, 14));
  return { latest, avg7: thisWeek, weekChange: lastWeek === null ? null : thisWeek - lastWeek };
}
