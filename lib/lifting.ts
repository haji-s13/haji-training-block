import type { Calendar, CalWeek } from "./calendar";
import type { HxBlock, HxDay, HxPlan, HxWeek } from "./hyrox";

/* 4-day lifting routine (one leg day) for a Norwegian double-threshold week.
 * Source: research/lifting-4-day-norwegian-doubles.md (v2, 16-18 upper-body sets per muscle).
 * Push Mon, Legs Tue after both threshold sessions, Pull Wed, Upper Fri. No gym Thu or Sat.
 * The plan reuses the HYROX plan's week/day shapes, so the week cards, dashboard and
 * intervals.icu export work unchanged. */

export type LiftSlot = "off" | "push" | "legs" | "pull" | "upper";
export type Muscle = "chest" | "back" | "sideDelts" | "rearDelts" | "biceps" | "triceps" | "quads" | "glutes" | "hamstrings" | "calves";

export const MUSCLES: { key: Muscle; label: string; target?: [number, number] }[] = [
  { key: "chest", label: "Chest", target: [16, 18] },
  { key: "back", label: "Back", target: [16, 18] },
  { key: "sideDelts", label: "Side delts", target: [16, 18] },
  { key: "biceps", label: "Biceps", target: [16, 18] },
  { key: "triceps", label: "Triceps", target: [16, 18] },
  { key: "rearDelts", label: "Rear delts" },
  { key: "quads", label: "Quads" },
  { key: "glutes", label: "Glutes" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "calves", label: "Calves" },
];

export const LIFT_LABELS: Record<LiftSlot, string> = {
  off: "No gym",
  push: "Push",
  legs: "Legs",
  pull: "Pull",
  upper: "Upper",
};

export interface LiftSettings { template: LiftSlot[] }

export const defaultLifting = (): LiftSettings => ({ template: ["push", "legs", "pull", "off", "upper", "off", "off"] });

export function normalizeLifting(raw: unknown): LiftSettings {
  const d = defaultLifting();
  const t = (raw as Partial<LiftSettings> | undefined)?.template;
  const ok = Array.isArray(t) && t.length === 7 && t.every((x) => x in LIFT_LABELS);
  return { template: ok ? (t as LiftSlot[]).slice() : d.template };
}

/** One exercise. `sets` is the full prescription; `muscles` counts direct work as 1 and indirect as 0.5. */
interface Ex { name: string; sets: number; reps: string; rir: string; cue?: string; muscles: Partial<Record<Muscle, number>>; legs?: boolean }
/** A block is one exercise or an antagonist superset (do one, rest ~60 s, do the other). */
type Item = Ex | { superset: Ex[] };
interface Session { title: string; min: number; items: Item[]; optional?: Item[] }

const PRESS = { triceps: 0.5 };
const PULL = { biceps: 0.5 };

const SESSIONS: Record<Exclude<LiftSlot, "off">, Session> = {
  push: {
    title: "Push", min: 70, items: [
      { name: "Barbell or dumbbell bench press", sets: 4, reps: "6-8", rir: "1-2", muscles: { chest: 1, ...PRESS } },
      { name: "Seated dumbbell overhead press", sets: 4, reps: "8-10", rir: "1-2", muscles: { chest: 0.5, sideDelts: 0.5, ...PRESS } },
      { name: "Incline dumbbell press", sets: 4, reps: "8-10", rir: "1", muscles: { chest: 1, ...PRESS } },
      { superset: [
        { name: "Cable lateral raise", sets: 5, reps: "12-20", rir: "0-1", muscles: { sideDelts: 1 } },
        { name: "Overhead cable triceps extension", sets: 4, reps: "10-15", rir: "0-1", muscles: { triceps: 1 } },
      ] },
    ],
  },
  legs: {
    title: "Legs", min: 40, items: [
      { name: "Bulgarian split squat", sets: 3, reps: "5-6 per leg", rir: "2-3", cue: "Heavy. Controlled down, fast up", muscles: { quads: 1, glutes: 1 }, legs: true },
      { name: "Romanian deadlift", sets: 2, reps: "6-8", rir: "2-3", cue: "Bar to mid-shin", muscles: { glutes: 1, hamstrings: 1 }, legs: true },
      { name: "Seated leg curl", sets: 3, reps: "8-12", rir: "1-2", cue: "Nordic curl 3 × 4-6 as a swap", muscles: { hamstrings: 1 }, legs: true },
      { name: "Seated (bent-knee) calf raise", sets: 2, reps: "8-12", rir: "1-2", cue: "2 s pause in the stretch", muscles: { calves: 1 }, legs: true },
      { name: "Standing (straight-knee) calf raise", sets: 2, reps: "10-15", rir: "1", cue: "Full range", muscles: { calves: 1 }, legs: true },
    ],
  },
  pull: {
    title: "Pull", min: 75, items: [
      { name: "Pull-ups, weighted if able", sets: 4, reps: "6-10", rir: "1-2", muscles: { back: 1, ...PULL } },
      { name: "Chest-supported row", sets: 4, reps: "8-10", rir: "1", muscles: { back: 1, rearDelts: 0.5, ...PULL } },
      { name: "Lat pulldown", sets: 3, reps: "10-12", rir: "1", muscles: { back: 1, ...PULL } },
      { superset: [
        { name: "Rear-delt fly", sets: 4, reps: "12-20", rir: "0-1", muscles: { rearDelts: 1 } },
        { name: "Dumbbell lateral raise", sets: 4, reps: "12-20", rir: "0-1", muscles: { sideDelts: 1 } },
      ] },
      { superset: [
        { name: "Incline dumbbell curl", sets: 4, reps: "10-15", rir: "0-1", muscles: { biceps: 1 } },
        { name: "Hammer curl", sets: 2, reps: "10-15", rir: "0-1", muscles: { biceps: 1 } },
      ] },
    ],
  },
  upper: {
    title: "Upper", min: 75, items: [
      { superset: [
        { name: "Machine chest press or dips", sets: 4, reps: "8-12", rir: "1", muscles: { chest: 1, ...PRESS } },
        { name: "Seated cable row", sets: 4, reps: "10-12", rir: "1", muscles: { back: 1, rearDelts: 0.5, ...PULL } },
      ] },
      { superset: [
        { name: "Machine or Smith incline press", sets: 3, reps: "8-12", rir: "1", muscles: { chest: 1, ...PRESS } },
        { name: "Single-arm cable pulldown", sets: 3, reps: "10-15", rir: "1", muscles: { back: 1, ...PULL } },
      ] },
      { name: "Dumbbell lateral raise", sets: 5, reps: "12-20", rir: "0-1", muscles: { sideDelts: 1 } },
      { superset: [
        { name: "EZ-bar curl", sets: 3, reps: "10-15", rir: "0-1", muscles: { biceps: 1 } },
        { name: "Triceps pushdown", sets: 3, reps: "10-15", rir: "0-1", muscles: { triceps: 1 } },
      ] },
    ],
    optional: [
      { superset: [
        { name: "Seated leg curl", sets: 2, reps: "8-12", rir: "2", muscles: { hamstrings: 1 }, legs: true },
        { name: "Standing calf raise", sets: 2, reps: "10-15", rir: "2", muscles: { calves: 1 }, legs: true },
      ] },
    ],
  },
};

/* ---------- Progression ----------
 * First cycle (the research build-up): weeks 1-2 one set fewer per exercise and legs at 3 RIR,
 * weeks 3-4 full sets, weeks 5-6 hold sets and add load or reps, week 7 deload at half sets.
 * After that: six weeks of full sets adding load or reps, then a deload week, repeating. */

type LiftKind = "intro" | "full" | "progress" | "deload" | "race" | "vacation";
interface Spec { kind: LiftKind; phase: string; phaseKey: HxWeek["phaseKey"]; light: boolean; note: string }

const SPECS: Record<LiftKind, Omit<Spec, "kind">> = {
  intro: { phase: "Intro", phaseKey: "base", light: false, note: "Build-up: one set fewer on every exercise, legs at 3 RIR." },
  full: { phase: "Full sets", phaseKey: "build", light: false, note: "Full sets: 16-18 hard sets per upper-body muscle this week." },
  progress: { phase: "Add load", phaseKey: "peak", light: false, note: "Hold the sets. Add load or reps, not more sets." },
  deload: { phase: "Deload", phaseKey: "build", light: true, note: "Deload: half the sets, same loads." },
  race: { phase: "Race week", phaseKey: "trial", light: true, note: "Race week: upper body at half sets, no legs session." },
  vacation: { phase: "Vacation", phaseKey: "base", light: true, note: "" },
};

function specFor(cw: CalWeek): Spec {
  const pick = (k: LiftKind): Spec => ({ kind: k, ...SPECS[k] });
  if (cw.role === "vacation") return pick("vacation");
  if (cw.role === "race") return pick("race");
  const i = cw.i;
  if (i < 7) return pick(i < 2 ? "intro" : i < 4 ? "full" : i < 6 ? "progress" : "deload");
  return pick((i - 7) % 7 === 6 ? "deload" : "progress");
}

function setsFor(ex: Ex, k: LiftKind): number {
  if (k === "intro") return Math.max(1, ex.sets - 1);
  if (k === "deload" || k === "race") return Math.max(1, Math.ceil(ex.sets / 2));
  return ex.sets;
}
const rirFor = (ex: Ex, k: LiftKind) => (k === "intro" && ex.legs ? "3" : ex.rir);
const exLine = (ex: Ex, k: LiftKind) => `${ex.name} ${setsFor(ex, k)} × ${ex.reps} @ RIR ${rirFor(ex, k)}`;

const WARMUP: HxBlock = { label: "Warm-up", min: 0, text: "5-10 min easy cardio, then 2-3 ramp-up sets on the first lift" };
const LETTERS = "ABCDEFGH";

function sessionDay(slot: Exclude<LiftSlot, "off">, k: LiftKind, sets: Partial<Record<Muscle, number>>): HxDay {
  const s = SESSIONS[slot];
  const blocks: HxBlock[] = [WARMUP];
  let full = 0, now = 0;
  const add = (ex: Ex) => {
    const n = setsFor(ex, k);
    full += ex.sets; now += n;
    for (const [m, w] of Object.entries(ex.muscles) as [Muscle, number][]) sets[m] = (sets[m] || 0) + n * w;
  };
  s.items.forEach((it, j) => {
    const label = LETTERS[j];
    if ("superset" in it) {
      it.superset.forEach(add);
      blocks.push({ label, min: 0, text: `Superset, ~60 s rest between: ${it.superset.map((ex) => exLine(ex, k)).join(" + ")}` });
    } else {
      add(it);
      const cue = it.cue ? `. ${it.cue}` : "";
      blocks.push({ label, min: 0, text: `${it.name}: ${setsFor(it, k)} × ${it.reps} @ RIR ${rirFor(it, k)}${cue}` });
    }
  });
  // Optional Friday top-up for the legs: only in full weeks, and never counted in the totals.
  if (s.optional && (k === "full" || k === "progress")) {
    for (const it of s.optional) {
      const exs = "superset" in it ? it.superset : [it];
      blocks.push({ label: "Optional", min: 0, text: `Low-soreness legs top-up: ${exs.map((ex) => exLine(ex, k)).join(" + ")}. Skip it if Saturday's hills feel heavy` });
    }
  }
  const min = Math.round((s.min * now) / full / 5) * 5;
  return { type: slot === "legs" ? "lower" : "upper", title: s.title, blocks, min, vol: {} };
}

const offDay = (): HxDay => ({ type: "off", title: "No gym", blocks: [], min: 0, vol: {} });

/** Hard sets per muscle for a week (indirect work counts half). */
export type MuscleSets = Partial<Record<Muscle, number>>;
export interface LiftWeek extends HxWeek { sets: MuscleSets; totalSets: number; note: string }

export type LiftPlan = Omit<HxPlan, "weeks"> & { weeks: LiftWeek[] };

export function buildLifting(l: LiftSettings, cal: Calendar): LiftPlan {
  const weeks: LiftWeek[] = cal.weeks.map((cw) => {
    const spec = specFor(cw);
    const sets: MuscleSets = {};
    let days: HxDay[];
    if (spec.kind === "vacation") days = Array.from({ length: 7 }, offDay);
    else {
      days = l.template.map((slot, i) => {
        if (slot === "off" || cw.off[i]) return offDay();
        // Race week: no legs, and nothing on race day or the 2 days before.
        if (spec.kind === "race" && (slot === "legs" || cw.races.some((r) => r.day >= i && r.day - i <= 2))) return offDay();
        return sessionDay(slot, spec.kind, sets);
      });
      for (const r of cw.races) days[r.day] = { type: "race", title: "Race", blocks: [{ label: "Race", min: 0, text: r.race.name || "Race day" }], min: 0, vol: {} };
    }
    if (cw.afterRace && days[0].type !== "race") days[0] = { type: "rest", title: "Rest", blocks: [{ label: "Recover", min: 0, text: "Recovery after yesterday's race: no gym today." }], min: 0, vol: {} };
    cw.off.forEach((off, i) => { if (off && days[i].type !== "race") days[i] = { type: "vacation", title: "Vacation", blocks: [], min: 0, vol: {} }; });
    const totalSets = Math.round(Object.values(sets).reduce((t, v) => t + (v || 0), 0));
    return {
      n: cw.i + 1, phase: spec.phase, phaseKey: spec.phaseKey, kind: spec.kind === "deload" ? "absorb" : spec.kind === "race" ? "race" : "build",
      light: spec.light, step: 0, days, weekStart: cw.start,
      totalMin: days.reduce((t, d) => t + d.min, 0),
      sessions: days.filter((d) => d.type === "upper" || d.type === "lower").length,
      vol: {}, block: cw.block, pos: cw.pos, raceNames: cw.races.map((r) => r.race.name || "Race"), weak: [],
      program: "Lifting", sets, totalSets, note: spec.note,
    };
  });
  return { weeks, vol: {}, totalMin: weeks.reduce((t, w) => t + w.totalMin, 0), blocks: cal.blocks };
}

/** Run-plan conflicts for the template: legs belong on a hard run day (ideally the double), not the day before one. */
export function liftWarnings(t: LiftSlot[], runHard: boolean[], days: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (t[i] !== "legs") continue;
    const next = (i + 1) % 7;
    if (runHard[next]) out.push(`Legs on ${days[i]} is the day before a hard run on ${days[next]}. Put legs on the double threshold day itself, after the PM run.`);
  }
  const legs = t.filter((s) => s === "legs").length;
  if (legs > 1) out.push("Your template has more than one legs day. The routine keeps all leg work on one hard day.");
  return out;
}
