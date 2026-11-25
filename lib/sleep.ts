import { isoDate } from "./format";
import type { SleepNight } from "./health";

export type StageKind = "deep" | "rem" | "light" | "awake" | "asleep";
export const STAGE_LABEL: Record<StageKind, string> = { deep: "Deep", rem: "REM", light: "Light", asleep: "Asleep", awake: "Awake" };

/** Health Connect stage, as a name ("STAGE_TYPE_DEEP", "deep") or number (1 awake, 2 sleeping, 3 out of bed, 4 light, 5 deep, 6 REM, 7 awake in bed). */
export function stageKind(s: string): StageKind {
  const t = s.trim().toLowerCase();
  const n = Number(t);
  if (t !== "" && Number.isFinite(n)) return n === 4 ? "light" : n === 5 ? "deep" : n === 6 ? "rem" : n === 2 || n === 0 ? "asleep" : "awake";
  if (t.includes("deep")) return "deep";
  if (t.includes("rem")) return "rem";
  if (t.includes("light")) return "light";
  if (t.includes("awake") || t.includes("out_of_bed") || t.includes("out of bed")) return "awake";
  return "asleep";
}

export interface NightSummary {
  /** Local date of waking up. */
  date: string;
  start: Date | null;
  end: Date;
  /** Seconds asleep (stages minus awake when stages exist, else the session length). */
  asleep: number;
  /** Seconds per stage; empty without stage data. */
  stages: Partial<Record<StageKind, number>>;
}

const span = (n: SleepNight) => { const e = Date.parse(n.end); return [n.start ? Date.parse(n.start) : e - n.sec * 1000, e] as const; };

/** Drops sessions that overlap a longer one (the same night written by two apps, e.g. watch and phone). */
export function dedupeSleep(list: SleepNight[]): SleepNight[] {
  const kept: SleepNight[] = [];
  for (const n of [...list].sort((a, b) => b.sec - a.sec)) {
    const [s, e] = span(n);
    if (!kept.some((k) => { const [ks, ke] = span(k); return s < ke && ks < e; })) kept.push(n);
  }
  return kept;
}

/** One summary per wake-up day (separate sessions that end the same day are added, e.g. a nap), oldest first. */
export function nights(list: SleepNight[]): NightSummary[] {
  const byDay = new Map<string, NightSummary>();
  for (const n of dedupeSleep(list)) {
    const end = new Date(n.end);
    if (!Number.isFinite(end.getTime()) || !(n.sec > 0)) continue;
    const stages: Partial<Record<StageKind, number>> = {};
    for (const s of n.stages || []) { const k = stageKind(s.stage); stages[k] = (stages[k] || 0) + (s.sec || 0); }
    const staged = Object.values(stages).reduce((a, b) => a + (b || 0), 0);
    const asleep = staged > 0 ? staged - (stages.awake || 0) : n.sec;
    const date = isoDate(end);
    const start = n.start ? new Date(n.start) : null;
    const cur = byDay.get(date);
    if (!cur) { byDay.set(date, { date, start, end, asleep, stages }); continue; }
    cur.asleep += asleep;
    for (const [k, v] of Object.entries(stages)) cur.stages[k as StageKind] = (cur.stages[k as StageKind] || 0) + (v || 0);
    if (start && (!cur.start || start < cur.start)) cur.start = start;
    if (end > cur.end) cur.end = end;
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Average seconds asleep over the last `n` nights recorded (null without any). */
export function avgAsleep(list: NightSummary[], n = 7): number | null {
  const last = list.slice(-n);
  return last.length ? last.reduce((a, x) => a + x.asleep, 0) / last.length : null;
}

/** 27000 → "7 h 30 min". */
export function fmtSleep(sec: number): string {
  const m = Math.round(sec / 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
