import { isoDate } from "./format";
import { BUILTIN_SESSIONS, type LibKind, type LibPhase, type LibSession } from "./session-library";
import { prettyText } from "./hx-format";
import { type Calendar, type CalBlock, type CalWeek, type Race } from "./calendar";

/* HYROX station program (no running: that lives in the run plan).
 * Built from the coach's year of programming: strength first, then station build,
 * then race-specific work, with lighter "absorb" weeks and the Saturday race-week taper. */

export type Station = "ski" | "push" | "pull" | "bbj" | "row" | "farmers" | "lunges" | "wb";
export type Division = "open-w" | "open-m" | "pro-w" | "pro-m";
export type HxSlot = "off" | "aerobic" | "lower" | "upper" | "quality" | "quality_short";
export type HxDayType = HxSlot | "test" | "race" | "rest" | "vacation";
export type WeightUnit = "kg" | "lb";

/** Race order, race distance and the unit we count volume in. */
export const STATIONS: { key: Station; label: string; short: string; race: number; unit: "m" | "reps" }[] = [
  { key: "ski", label: "SkiErg", short: "Ski", race: 1000, unit: "m" },
  { key: "push", label: "Sled push", short: "Push", race: 50, unit: "m" },
  { key: "pull", label: "Sled pull", short: "Pull", race: 50, unit: "m" },
  { key: "bbj", label: "Burpee broad jumps", short: "BBJ", race: 80, unit: "m" },
  { key: "row", label: "Row", short: "Row", race: 1000, unit: "m" },
  { key: "farmers", label: "Farmers carry", short: "Farmers", race: 200, unit: "m" },
  { key: "lunges", label: "Sandbag lunges", short: "Lunges", race: 100, unit: "m" },
  { key: "wb", label: "Wall balls", short: "WB", race: 100, unit: "reps" },
];
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.key, s])) as Record<Station, (typeof STATIONS)[number]>;

/** Race weights in kg (sleds include the sled). Doubles and relay use the same weights as their division. */
export const DIVISIONS: Record<Division, { label: string; push: number; pull: number; farmers: number; lunges: number; wb: number; target: string }> = {
  "open-w": { label: "Open women", push: 102, pull: 78, farmers: 16, lunges: 10, wb: 4, target: "2.7 m" },
  "open-m": { label: "Open men", push: 152, pull: 103, farmers: 24, lunges: 20, wb: 6, target: "3 m" },
  "pro-w": { label: "Pro women", push: 152, pull: 103, farmers: 24, lunges: 20, wb: 6, target: "2.7 m" },
  "pro-m": { label: "Pro men", push: 202, pull: 153, farmers: 32, lunges: 30, wb: 9, target: "3 m" },
};

export const SLOT_LABELS: Record<HxSlot, string> = {
  off: "No station session",
  aerobic: "Aerobic stations",
  lower: "Lower + lunges + WB",
  upper: "Upper + sled",
  quality: "HYROX Quality (long)",
  quality_short: "HYROX Quality (short)",
};

export interface HyroxSettings {
  division: Division;
  weightUnit: WeightUnit;
  strength: "maintain" | "build";     // in-season maintenance cycle or off-season strength waves
  weaknesses: Station[];
  /** Weak stations per 12-week period; a period without an entry uses `weaknesses`. */
  weakByPeriod?: (Station[] | null)[];
  emphasis: "moderate" | "high";       // +25% or +50% on weak stations
  template: HxSlot[];
  deloads: boolean;                    // absorb weeks 4 and 8
  benchmarks: boolean;                 // tests in week 1, repeated in week 11
  finalWeek: "race" | "test" | "normal"; // last week when no race falls in it ("race" is legacy, same as "test")
  runLegs: boolean;                    // short compromised runs inside HYROX Quality, or BikeErg instead
  /** Library sessions switched off for this plan. */
  disabledSessions?: string[];
}

export function defaultHyrox(): HyroxSettings {
  return {
    division: "pro-m",
    weightUnit: "kg",
    strength: "maintain",
    weaknesses: ["wb", "lunges", "push"],
    emphasis: "moderate",
    template: ["aerobic", "lower", "off", "upper", "off", "quality", "off"],
    deloads: true,
    benchmarks: true,
    finalWeek: "test",
    runLegs: false,
  };
}

export function normalizeHyrox(raw: unknown): HyroxSettings {
  const d = defaultHyrox();
  const h = { ...d, ...(raw && typeof raw === "object" ? raw : {}) } as HyroxSettings;
  if (!Array.isArray(h.template) || h.template.length !== 7) h.template = d.template.slice();
  if (!Array.isArray(h.weaknesses)) h.weaknesses = d.weaknesses.slice();
  h.weaknesses = h.weaknesses.filter((w) => w in STATION);
  if (Array.isArray(h.weakByPeriod)) h.weakByPeriod = h.weakByPeriod.map((l) => (Array.isArray(l) ? l.filter((w) => w in STATION) : null));
  if (!(h.division in DIVISIONS)) h.division = d.division;
  if (h.finalWeek === "race") h.finalWeek = "test";
  return h;
}

/** Weak stations for a 12-week period (its own list, or the default). */
export function weakFor(h: HyroxSettings, period: number): Station[] {
  return h.weakByPeriod?.[period] ?? h.weaknesses;
}

export const WEAK_FACTOR = { moderate: 1.25, high: 1.5 } as const;

/* ---------- Plan shapes ---------- */

/** `weak`: a top-up block for a weak station. `acc`: accessory gym work. `boost`: weak stations whose sets or rounds this block scaled up.
 *  `was`: for a boosted block, the text it would have with no weak stations (to show what changed). */
export interface HxBlock { label: string; text: string; min: number; weak?: Station; acc?: Station; boost?: Station[]; was?: string }
export interface HxDay {
  type: HxDayType;
  title: string;
  blocks: HxBlock[];
  min: number;
  vol: Partial<Record<Station, number>>;
  /** Library session this day came from. */
  libId?: string;
}
export type HxKind = "bench" | "strength" | "absorb" | "build" | "peak" | "sharpen" | "race" | "test" | "vacation";
export interface HxWeek {
  n: number;
  phase: string;
  phaseKey: "base" | "build" | "peak" | "trial";
  kind: HxKind;
  light: boolean;
  step: number;
  days: HxDay[];
  weekStart: Date;
  totalMin: number;
  sessions: number;
  vol: Partial<Record<Station, number>>;
  block: number;
  pos: number;
  raceNames: string[];
  /** The weak stations this week's period targets. */
  weak: Station[];
  /** Extra volume on weak stations, in percent (25 or 50). */
  weakPct?: number;
  /** Shown in exported text, e.g. "Lifting". Defaults to HYROX. */
  program?: string;
}
export interface HxPlan { weeks: HxWeek[]; vol: Partial<Record<Station, number>>; totalMin: number; blocks: CalBlock[] }

export const hxDayDate = (wk: HxWeek, i: number) => {
  const d = new Date(wk.weekStart);
  d.setDate(d.getDate() + i);
  return d;
};

/* ---------- Periodisation ---------- */

interface WeekSpec { w: number; benchRepeat: boolean; phase: string; phaseKey: HxWeek["phaseKey"]; kind: HxKind; light: boolean; step: number; vol: number }

/** One week's job, from the shared calendar: race, taper, vacation, benchmark, absorb, or a phase week. */
function weekSpec(cw: CalWeek, h: HyroxSettings): WeekSpec {
  const base = { w: cw.i, benchRepeat: false };
  const name = { base: "Strength", build: "Station build", peak: "Race specific" }[cw.phase];
  const kindOf = { base: "strength", build: "build", peak: "peak" } as const;
  const bump = Math.min(0.15, cw.phaseRepeat * 0.05); // later periods go a little bigger
  if (cw.role === "vacation") return { ...base, phase: "Vacation", phaseKey: cw.phase, kind: "vacation", light: true, step: 0, vol: 0 };
  if (cw.role === "race") return { ...base, phase: "Race week", phaseKey: "trial", kind: "race", light: true, step: 0, vol: 0.5 };
  if (cw.role === "taper") return { ...base, benchRepeat: h.benchmarks && cw.finalSharpen, phase: "Sharpen", phaseKey: cw.phase, kind: "sharpen", light: false, step: 2, vol: 0.85 };
  if (cw.i === 0 && h.benchmarks) return { ...base, phase: "Benchmark", phaseKey: cw.phase, kind: "bench", light: false, step: 0, vol: 0.8 };
  if (cw.last && h.finalWeek !== "normal") return { ...base, phase: "Benchmark", phaseKey: "trial", kind: "test", light: true, step: 0, vol: 0.6 };
  if (h.deloads && cw.pos === 3) return { ...base, phase: "Absorb", phaseKey: cw.phase, kind: "absorb", light: true, step: 0, vol: 0.65 };
  const step = cw.phase === "peak" ? cw.pos % 2 : Math.min(cw.pos, 2);
  const vols = { base: [0.9, 1, 1.1], build: [1, 1.1, 1.2], peak: [1.15, 1.25] }[cw.phase];
  return { ...base, phase: name, phaseKey: cw.phase, kind: kindOf[cw.phase], light: false, step, vol: vols[step] + bump };
}

/* ---------- Builders ---------- */

const KG_PER_LB = 0.45359237;

class Ctx {
  vol: Partial<Record<Station, number>> = {};
  /** Weak stations scaled up in the day being built. */
  boosted = new Set<Station>();
  constructor(public h: HyroxSettings, public spec: WeekSpec, public weak: Station[] = h.weaknesses, public lib: LibSession[] = BUILTIN_SESSIONS) {}
  get div() { return DIVISIONS[this.h.division]; }
  isWeak(st?: Station) { return !!st && this.weak.includes(st); }
  /** Benchmark weeks stay as written: no weakness scaling. */
  get scalesWeak() { return this.spec.kind !== "bench" && this.spec.kind !== "test"; }
  /** Rounds or sets scaled by the week's volume and, for weak stations, the weakness factor. Tags the station only if the count grew. */
  n(base: number, st?: Station, min = 1) {
    const out = Math.max(min, Math.round(base * this.spec.vol * this.weakF(st)));
    if (st && out !== this.plainN(base, min)) this.boosted.add(st);
    return out;
  }
  /** The same count without the weakness factor. */
  plainN(base: number, min = 1) { return Math.max(min, Math.round(base * this.spec.vol)); }
  /** After a caller caps or shifts a scaled count: untag the station if the result matches the unboosted one. */
  settle(st: Station, value: number, plain: number) {
    if (value === plain) this.boosted.delete(st);
    return value;
  }
  /** The weakness factor alone (1 for a station that isn't weak, or in a benchmark week). */
  weakF(st?: Station) { return this.isWeak(st) && this.scalesWeak ? WEAK_FACTOR[this.h.emphasis] : 1; }
  /** A fixed count scaled only by weakness (the week's volume doesn't change it). */
  weakN(base: number, st: Station) {
    const out = Math.round(base * this.weakF(st));
    if (out !== base) this.boosted.add(st);
    return out;
  }
  add(st: Station, amount: number) { this.vol[st] = (this.vol[st] || 0) + amount; }
  /** A weight in the chosen unit; pounds round to 5. */
  w(kg: number) {
    if (this.h.weightUnit === "lb") return `${Math.round(kg / KG_PER_LB / 5) * 5} lb`;
    return `${Number.isInteger(kg) ? kg : Math.round(kg / 2.5) * 2.5} kg`;
  }
  /** "+5 kg" / "+10 lb". */
  inc(kg: number) { return this.h.weightUnit === "lb" ? `${Math.round(kg / KG_PER_LB / 5) * 5} lb` : `${kg} kg`; }
  /** A run leg, or the BikeErg equivalent when run legs are off. */
  leg(m: number, effort: string) {
    if (this.h.runLegs) return `${m >= 1000 ? `${m / 1000} km` : `${m} m`} run @ ${effort}`;
    const min = Math.max(1, Math.round((m / 1000) * 4 * 2) / 2);
    return `${min} min BikeErg @ ${effort}`;
  }
}

const WARMUP: HxBlock = { label: "Warm-up", text: "10 min easy bike + mobility", min: 10 };

/* Extra work for a weak station, by training intent. From the coach's formats. */
function weakBlock(c: Ctx, st: Station): HxBlock | null {
  const { kind, step } = c.spec;
  const d = c.div;
  const intent = kind === "strength" || kind === "absorb" ? "strength" : kind === "build" ? "capacity" : "race";
  const label = `Weak station · ${STATION[st].label}`;
  const light = kind === "absorb";
  let n: number;
  switch (st) {
    case "ski": case "row": {
      const name = st === "ski" ? "SkiErg" : "Row";
      if (intent === "strength") { n = c.n(light ? 3 : 4, st); c.add(st, 500 * n); return { label, weak: st, min: n * 3.5, text: `${n} × 500 m ${name} @ 2k pace + 8 s, 90 s rest` }; }
      if (intent === "capacity") { n = c.n(3, st); c.add(st, 1000 * n); return { label, weak: st, min: n * 6, text: `${n} × 1000 m ${name} @ race pace, 2 min rest` }; }
      n = c.n(3, st); c.add(st, 1000 * n); c.add("wb", 20 * n);
      return { label, weak: st, min: n * 7, text: `${n} × (1000 m ${name} @ race pace + 20 WB @ race weight), 2 min rest` };
    }
    case "push": {
      if (intent === "strength") {
        n = Math.min(6, c.n(light ? 3 : 4, st)); c.add(st, 20 * n);
        return { label, weak: st, min: n * 3, text: `Heavy sled push E3MOM ${n} × 20 m from ${c.w(d.push + 20)}, adding ${c.inc(10)} a round (finish ${c.w(d.push + 20 + 10 * (n - 1))} if form holds)` };
      }
      if (intent === "capacity") { n = c.n(4, st); c.add(st, 25 * n); c.add("ski", 500 * n); return { label, weak: st, min: n * 5, text: `${n} × (500 m ski @ 2k pace + 25 m sled push @ ${c.w(d.push)}), rest 1:1. Break only at 5–6 m.` }; }
      n = c.n(4, st); c.add(st, 25 * n);
      return { label, weak: st, min: n * 2.5, text: `${n} × 25 m @ ${c.w(d.push * 0.65)} (30–40% light), move fast under fatigue` };
    }
    case "pull": {
      if (intent === "strength") { n = c.n(light ? 3 : 4, st); c.add(st, 12.5 * n); return { label, weak: st, min: n * 2.5, text: `${n} × 12.5 m sled pull @ ${c.w(d.pull + 10)}. Big strong pulls, arms and hip drive.` }; }
      if (intent === "capacity") { n = c.n(5, st); c.add(st, 25 * n); return { label, weak: st, min: n * 6, text: `${n} × (4 min easy bike + 2 min sled pulls @ ${c.w(d.pull)})` }; }
      n = c.n(4, st); c.add(st, 25 * n); c.add("row", 250 * n);
      return { label, weak: st, min: n * 3.5, text: `${n} × (250 m row hard + 25 m sled pull @ ${c.w(d.pull)}), 90 s rest` };
    }
    case "bbj": {
      if (intent === "strength") { n = c.n(light ? 6 : 10, st); c.add(st, 10 * n); return { label, weak: st, min: n, text: `EMOM ${n}: 5 burpee broad jumps, longest jump you can repeat` }; }
      if (intent === "capacity") { n = c.n(10, st); c.add(st, 16 * n); return { label, weak: st, min: n, text: `EMOM ${n}: 8 burpee broad jumps (about 16 m)` }; }
      n = c.n(3, st); c.add(st, 40 * n); c.add("row", 500 * n);
      return { label, weak: st, min: n * 5, text: `${n} × (40 m BBJ @ race pace + 500 m row), 2 min rest` };
    }
    case "farmers": {
      if (intent === "strength") { n = c.n(light ? 3 : 4, st); c.add(st, 50 * n); return { label, weak: st, min: n * 2, text: `${n} × 50 m heavy farmers carry @ ${c.w(d.farmers + 8)} per hand, full rest` }; }
      if (intent === "capacity") { n = c.n(4, st); c.add(st, 100 * n); return { label, weak: st, min: n * 6.5, text: `${n} × (5 min bike + 100 m farmers carry @ ${c.w(d.farmers)} per hand)` }; }
      n = c.n(3, st); c.add(st, 100 * n); c.add("row", 500 * n);
      return { label, weak: st, min: n * 4, text: `${n} × (500 m row + 100 m farmers @ ${c.w(d.farmers)} unbroken)` };
    }
    case "lunges": {
      if (intent === "strength") {
        n = c.n(light ? 3 : 4, st); c.add(st, 20 * n);
        return { label, weak: st, min: n * 3, text: `Barbell walking lunges ${n} × 20 m @ ${c.w(d.lunges * 1.5)} (50% over race weight)` };
      }
      if (intent === "capacity") {
        n = Math.min(5, c.n(3 + Math.min(step, 1), st)); c.add(st, 60 * n);
        const loads = [`${c.w(d.lunges - 10)}`, `${c.w(d.lunges - 5)}`, c.w(d.lunges), c.w(d.lunges + 5), c.w(d.lunges + 10)];
        return { label, weak: st, min: n * 4, text: `Lunge Specificity, ${n} rounds: 40 walking lunges ramping ${loads.slice(0, Math.min(n, 5)).join(" → ")} + 20 fast bodyweight lunges, rest 1:1` };
      }
      n = c.n(3, st); c.add(st, 30 * n); c.add("wb", 30 * n);
      return { label, weak: st, min: n * 5, text: `Lunges into wall balls: ${n} × (30 m lunges @ ${c.w(d.lunges)} + 30 WB @ ${c.w(d.wb)}), 2 min rest. Transition immediately.` };
    }
    case "wb": {
      const heavy = c.w(d.wb + (d.wb >= 9 ? 3 : 2));
      if (intent === "strength") {
        const sets = Math.min(10, c.n(light ? 6 : [8, 9, 10][step] ?? 8, st)); const reps = light ? 8 : [8, 8, 10][step] ?? 8;
        c.add(st, sets * reps);
        return { label, weak: st, min: sets, text: `Heavy ball EMOM ${sets} × ${reps} with ${heavy} to ${d.target}, best possible form` };
      }
      if (intent === "capacity") {
        const total = Math.round(([150, 175, 200][step] ?? 150) * c.weakF("wb") / 25) * 25;
        c.add(st, total);
        return { label, weak: st, min: Math.ceil(total / 10 / 2), text: `10 unbroken WB every 30 s to ${total} @ ${c.w(d.wb)}` };
      }
      n = c.n(2, st, 2); c.add(st, 40 * n);
      return { label, weak: st, min: n * 3, text: `Max unbroken WB @ ${c.w(d.wb)}, rest 2 min, ${n} sets. Start conservative and build.` };
    }
  }
}

/** Gym work for the muscles each weak station leans on. Added to a strength day. */
export const ACCESSORY: Record<Station, { day: "lower" | "upper"; muscles: string; work: [(n: number) => string, (n: number) => string] }> = {
  ski: { day: "upper", muscles: "Lats, triceps and core", work: [
    (n) => `straight-arm cable pulldown ${n} × 12, close-grip bench or dips ${n} × 8, cable crunch ${n} × 12`,
    (n) => `lat pulldown ${n} × 10, rope triceps pushdown ${n} × 15, hanging knee raise ${n} × 12`] },
  push: { day: "lower", muscles: "Quads, glutes and calves", work: [
    (n) => `leg press or hack squat ${n} × 10, single-leg calf raise ${n} × 15 per leg, wall sit in sled-push position ${n} × 40 s`,
    (n) => `heels-elevated goblet squat ${n} × 12, sled-position plank on a wall ${n} × 30 s, seated calf raise ${n} × 20`] },
  pull: { day: "upper", muscles: "Upper back, biceps and grip", work: [
    (n) => `chest-supported row ${n} × 10, hammer curl ${n} × 10, towel or rope hang ${n} × max`,
    (n) => `single-arm DB row ${n} × 10 per side, face pull ${n} × 15, fat-grip or towel row ${n} × 12`] },
  bbj: { day: "lower", muscles: "Hips, chest and power", work: [
    (n) => `box jump ${n} × 5, standing broad jump ${n} × 3, push-up ${n} × 12–15`,
    (n) => `KB swing ${n} × 15, hip-flexor march ${n} × 10 per leg, hand-release push-up ${n} × 10`] },
  row: { day: "upper", muscles: "Posterior chain and upper back", work: [
    (n) => `Romanian deadlift ${n} × 8, seated cable row ${n} × 10, back extension ${n} × 12`,
    (n) => `good morning ${n} × 10, inverted row ${n} × 10, dead bug ${n} × 10 per side`] },
  farmers: { day: "upper", muscles: "Grip, traps and trunk", work: [
    (n) => `suitcase carry ${n} × 20 m per side, barbell shrug ${n} × 12, plate pinch hold ${n} × 30 s`,
    (n) => `trap-bar holds ${n} × 30 s heavy, wrist roller ${n} × 2 trips, Pallof press ${n} × 10 per side`] },
  lunges: { day: "lower", muscles: "Quads, glutes and adductors", work: [
    (n) => `deficit reverse lunge ${n} × 8 per leg, step-up ${n} × 10 per leg, Copenhagen plank ${n} × 20 s per side`,
    (n) => `split squat ${n} × 10 per leg @ lunge weight, single-leg hip thrust ${n} × 10, cossack squat ${n} × 6 per side`] },
  wb: { day: "lower", muscles: "Quads, shoulders and core", work: [
    (n) => `front squat ${n} × 6 @ 70%, push press ${n} × 6, thruster ${n} × 10 with the race ball`,
    (n) => `goblet squat ${n} × 12, DB overhead press ${n} × 10, med-ball sit-up throw ${n} × 15`] },
};
function accessoryBlock(spec: WeekSpec, st: Station): HxBlock | null {
  const v = spec.w % 2;
  if (spec.kind === "bench" || spec.kind === "test" || spec.kind === "race" || spec.kind === "absorb") return null;
  const n = spec.kind === "strength" || spec.kind === "build" ? 3 : 2;
  const a = ACCESSORY[st];
  return { label: `Accessory · ${STATION[st].label}`, acc: st, min: n * 3, text: `${a.muscles}: ${a.work[v](n)}` };
}

/** Where each weak station's extra work goes, in order of preference. */
const HOST: Record<Station, HxSlot[]> = {
  lunges: ["lower", "quality", "upper", "aerobic"],
  wb: ["lower", "quality", "upper", "aerobic"],
  push: ["upper", "quality", "lower", "aerobic"],
  pull: ["upper", "quality", "lower", "aerobic"],
  farmers: ["upper", "aerobic", "quality", "lower"],
  ski: ["aerobic", "quality", "upper", "lower"],
  row: ["aerobic", "quality", "upper", "lower"],
  bbj: ["quality", "upper", "lower", "aerobic"],
};

/* ---------- Variety ----------
 * Every session type rotates through the coach's formats from the year review, so no two
 * weeks in a row repeat. The periodisation (phase, volume, intensity) stays the same. */

const pick = <T,>(a: readonly T[], i: number): T => a[((i % a.length) + a.length) % a.length];
/** 0 = weeks 1–4, 1 = weeks 5–8, 2 = weeks 9–12. */
const blockOf = (c: Ctx) => (c.spec.w < 4 ? 0 : c.spec.w < 8 ? 1 : 2);
/** Which of a phase's formats this week uses. */
const turn = (c: Ctx) => (c.spec.kind === "absorb" ? Math.floor(c.spec.w / 4) % 2 : c.spec.step);

/** The main lifts stay the same all 12 weeks, as in the coach's cycles; only sets, reps and load change. */
const LIFTS = { squat: "Box squat", bench: "Bench press", deadlift: "Deadlift" } as const;
const liftName = (_c: Ctx, l: keyof typeof LIFTS) => LIFTS[l];

/** Main lifts: the in-season maintenance cycle (3×15 → 4×10 → 5×5) or the off-season waves, adding load each time through. */
function lift(c: Ctx, l: keyof typeof LIFTS): string {
  const { kind, step } = c.spec;
  const name = liftName(c, l);
  const waves = ["65/75/85% × 5, 5, 5+", "70/80/90% × 3, 3, 3+", "75/85/95% × 5, 3, 1+"];
  const maint = ["3 × 15 @ 45–65%", "4 × 10 @ 50–70%", "5 × 5 @ 60–80%"];
  if (kind === "absorb") return c.h.strength === "build" ? `${name} 40/50/60% × 5` : `${name} 3 × 8 @ 45–65%`;
  if (kind === "sharpen" || kind === "race") return `${name} 2 × 5 @ 60%, fast`;
  if (kind === "peak") return `${name} ${pick(["3 × 5 @ 70–80%, crisp", "4 × 4 @ 75%, fast up"], step)}`;
  const more = blockOf(c) > 0 ? `, ${c.h.weightUnit === "lb" ? "5–10 lb" : "2.5–5 kg"} more than last cycle` : "";
  return `${name} ${c.h.strength === "build" ? waves[step] : maint[step]}${more}`;
}

function aerobic(c: Ctx): HxBlock[] {
  const d = c.div;
  const k = c.spec.kind;
  if (k === "absorb") {
    c.add("ski", 1000); c.add("row", 1000);
    return [{ label: "Main", min: 30, text: "Hybrid z2: 3 × (5 min bike + 5 min ski or row), easy" }];
  }
  const base = k === "strength" ? 4 : 5;
  switch (c.spec.w % 4) {
    case 0: {
      const n = c.weakN(base, "farmers");
      c.add("farmers", 100 * n);
      return [{ label: "Main", min: n * 6.5, text: `${n} × (5 min bike @ 60% FTP + 100 m farmers carry @ ${c.w(d.farmers)} per hand)` }];
    }
    case 1:
      c.add("row", 3 * 1100); c.add("ski", 3 * 1000);
      return [{ label: "Main", min: 48, text: `Recovery machines 3 × (5 min bike, 5 min row, 5 min ski) relaxed, with 5 weighted pull-ups after each round, not heavy` }];
    case 2: {
      const n = c.weakN(4, "farmers");
      c.add("farmers", 100 * n); c.add("wb", 40); c.add("lunges", 50);
      return [
        { label: "A", min: n * 6.5, text: `${n} × (5 min bike @ 60% FTP + 100 m farmers carry @ ${c.w(d.farmers)})` },
        { label: "B", min: 10, text: `EMOM 10, alternating 8 heavy WB (${c.w(d.wb + (d.wb >= 9 ? 3 : 2))}) and 10 walking lunges @ ${c.w(d.lunges)}` },
      ];
    }
    default:
      c.add("ski", 2 * 1000); c.add("row", 2 * 1100);
      return [{ label: "Main", min: 40, text: `Bike fartlek 20 min (4 × 4 min easy @ 50% FTP + 1 min hard), then 2 × (5 min ski + 5 min row) easy` }];
  }
}

function lower(c: Ctx): HxBlock[] {
  const d = c.div;
  const k = c.spec.kind;
  const t = turn(c);
  if (k === "absorb") {
    if (t === 0) {
      c.add("push", 20); c.add("lunges", 30); c.add("wb", 30); c.add("pull", 25);
      return [
        { label: "A", min: 15, text: lift(c, "squat") },
        { label: "B", min: 28, text: `Aerobic sandwich, 4 rounds: 4 min easy bike + one station @ race weight, rotating 20 m push / 30 m lunges / 30 WB / 25 m pull. Controlled.` },
      ];
    }
    c.add("lunges", 30); c.add("wb", 30); c.add("push", 36);
    return [
      { label: "A", min: 15, text: lift(c, "squat") },
      { label: "B", min: 20, text: `Station touch, 3 rounds: 10 walking lunges + 10 WB + 12 m sled push @ race weight, full recovery. Just feel the weight.` },
    ];
  }
  if (k === "sharpen") {
    c.add("lunges", 120); c.add("push", 150); c.add("wb", 150);
    return [
      { label: "A", min: 15, text: `Barbell walking lunges 4 × 30 m: ${c.w(d.lunges + 10)}, ${c.w(d.lunges + 15)}, ${c.w(d.lunges + 20)}, then ${c.w(d.lunges)} fast` },
      { label: "B", min: 30, text: `3 rounds: ${c.leg(800, "easy to moderate")} + 50 m sled push @ race effort + ${c.leg(800, "moderate")} + 50 WB @ race effort` },
    ];
  }
  const wbBase = k === "strength" ? 3 : 4;
  const lunge = c.n(3, "lunges"), wbSets = c.n(wbBase, "wb");
  const lunge0 = c.plainN(3), wb0 = c.plainN(wbBase); // the same counts without the weakness factor
  const A: HxBlock = { label: "A", min: 18, text: lift(c, "squat") };
  let B: HxBlock, C: HxBlock;
  if (k === "peak") {
    if (t === 0) { c.add("lunges", 25 * lunge); B = { label: "B", min: 12, text: `Walking lunges ${lunge} × 25 m @ ${c.w(d.lunges)}, rest 1:1. Prioritise speed: quick turnover, stay tall, keep driving forward.` }; }
    else { const s = c.settle("lunges", Math.min(4, lunge), Math.min(4, lunge0)); c.add("lunges", 50 * s); B = { label: "B", min: 14, text: `Lunges for speed: ${s} × 50 m @ ${c.w(d.lunges - 10)} (race weight minus 10 kg), 2 min rest` }; }
    if (t === 0) { c.add("wb", wbSets * 30); C = { label: "C", min: wbSets * 2, text: `Wall balls ${wbSets} × 30 unbroken @ ${c.w(d.wb)}, 60 s rest. Find a machine pace that lets you avoid breaks.` }; }
    else { const r = c.settle("wb", Math.max(3, wbSets - 1), Math.max(3, wb0 - 1)); c.add("wb", 35 * r); c.add("ski", 400 * r); C = { label: "C", min: r * 4, text: `${r} × (400 m ski @ 2k pace + 35 unbroken WB @ ${c.w(d.wb)}), 90 s rest` }; }
    return [A, B, C];
  }
  switch (c.spec.w % 3) {
    case 0: c.add("lunges", 20 * lunge); B = { label: "B", min: 12, text: `Bulgarian split squats ${c.weakN(3, "lunges")} × 8 per leg @ lunge weight or heavier, then walking lunges ${lunge} × 20 m @ ${c.w(d.lunges)}` }; break;
    case 1: c.add("lunges", 20 * lunge); B = { label: "B", min: 12, text: `Reverse lunges ${c.weakN(3, "lunges")} × 10 per leg, then DB goblet walking lunges ${lunge} × 20 m @ ${c.w(d.lunges)}, rest 1:1` }; break;
    default: c.add("lunges", 25 * lunge); B = { label: "B", min: 14, text: `Step-ups ${c.weakN(3, "lunges")} × 8 per leg, then walking lunges ${lunge} × 25 m @ ${c.w(d.lunges + 5)}. Expect the legs to burn.` };
  }
  switch ((c.spec.w + 1) % 3) {
    case 0: c.add("wb", wbSets * 20); C = { label: "C", min: wbSets * 1.5, text: `Wall balls ${wbSets} × 20 unbroken @ ${c.w(d.wb)}, 45 s rest` }; break;
    case 1: { const top = 10 * c.settle("wb", Math.min(3, wbSets), Math.min(3, wb0)); const ladder = [] as number[]; for (let r = 10; r <= top; r += 10) ladder.push(r); for (let r = top - 10; r >= 10; r -= 10) ladder.push(r);
      const total = ladder.reduce((a, b) => a + b, 0); c.add("wb", total); c.add("row", 250 * (ladder.length - 1));
      C = { label: "C", min: Math.round(total / 12 + ladder.length * 1.5), text: `WB ladder ${ladder.join("-")} @ ${c.w(d.wb)}, 250 m row between sets` }; break; }
    default: { const r = c.settle("wb", Math.max(2, wbSets - 1), Math.max(2, wb0 - 1)); c.add("wb", 30 * r); c.add("row", 500 * r);
      C = { label: "C", min: r * 4, text: `${r} × (500 m row @ 2k pace + 30 unbroken WB @ ${c.w(d.wb)}), 2 min rest` }; }
  }
  return [A, B, C];
}

/** Upper/posterior E4MOM supersets at 65–80%, with the rep range and pairing changing each week. */
function upperA(c: Ctx): string {
  const bench = liftName(c, "bench"), dl = liftName(c, "deadlift");
  if (c.h.strength === "build" && c.spec.kind !== "peak") return `${lift(c, "bench")}; ${lift(c, "deadlift")}`;
  const u = pick([
    { b: "8 @ 65%", p: "pull-ups 8", d: "4 @ 75–80%", h: "DB RDL 10" },
    { b: "6 @ 70%", p: "bent-over row 8", d: "5 @ 70–75%", h: "KB swing 15" },
    { b: "5 @ 75–80%", p: "weighted chin-ups 5", d: "3 @ 80%", h: "hip thrust 10" },
  ], c.spec.kind === "peak" ? c.spec.step + 1 : c.spec.step);
  return `E4MOM × 3: ${bench} ${u.b} + ${u.p}; ${dl} ${u.d} + ${u.h}`;
}

function upper(c: Ctx): HxBlock[] {
  const d = c.div;
  const k = c.spec.kind;
  if (k === "absorb") {
    c.add("pull", 100);
    if (turn(c) === 0) return [
      { label: "A", min: 12, text: `E4MOM × 3: Bench press 8 @ 65% + pull-ups 8` },
      { label: "B", min: 30, text: `Sled pull 5 × (4 min easy bike + 2 min pulls @ ${c.w(d.pull)})` },
    ];
    c.add("wb", 64);
    return [
      { label: "A", min: 12, text: `E4MOM × 3: Bench press 8 @ 65% + pull-ups 8` },
      { label: "B", min: 8, text: `Heavy ball EMOM 8 × 8 with ${c.w(d.wb + (d.wb >= 9 ? 3 : 2))}, best possible form` },
      { label: "C", min: 30, text: `Sled pull 5 × (4 min easy bike + 2 min pulls @ ${c.w(d.pull)})` },
    ];
  }
  if (k === "sharpen") {
    c.add("ski", 750); c.add("push", 45); c.add("bbj", 30); c.add("row", 750); c.add("farmers", 150); c.add("lunges", 45);
    return [{ label: "Main", min: 40, text: `E2MOM 1:20 on / 0:40 off × 3: ski, sled push, BBJ, row, farmers carry, lunges, then 5 min easy bike between rounds` }];
  }
  const A: HxBlock = { label: "A", min: 14, text: upperA(c) };
  let B: HxBlock, C: HxBlock;
  if (k === "peak") {
    const n = c.n(6, "push");
    if (c.spec.step === 0) { c.add("push", 12 * n); B = { label: "B", min: n * 2, text: `Sled push ${n} × 12 m @ ${c.w(d.push)}. Break every 5–6 m, don't push until you're ready.` }; }
    else { c.add("push", 12.5 * n); B = { label: "B", min: n * 2, text: `Sled push ramp ${n} × 12.5 m: start @ ${c.w(d.push - 20)}, race weight by set 4, ${c.w(d.push + 20)} by the finish` }; }
  } else {
    switch (c.spec.w % 3) {
      case 0: { const n = c.n(6, "push"); c.add("push", 12 * n); B = { label: "B", min: n * 2, text: `Sled push E2MOM ${n} × 12 m from ${c.w(d.push)}, adding ${c.inc(5)} a round` }; break; }
      case 1: { const n = c.n(4, "push"); c.add("push", 25 * n); B = { label: "B", min: n * 4, text: `Sled push E4MOM ${n} × 25 m from ${c.w(d.push)}, adding ${c.inc(10)} a round. Increase the weight from last time.` }; break; }
      default: { const n = c.n(5, "push"); c.add("push", 20 * n); c.add("ski", 200 * n); B = { label: "B", min: n * 3, text: `${n} × (200 m ski + 20 m sled push @ ${c.w(d.push + 20)}), rest 1:1` }; }
    }
  }
  const pull = c.n(4, "pull"), carry = c.n(3, "farmers");
  switch ((c.spec.w + 2) % 3) {
    case 0: c.add("pull", 12.5 * pull); c.add("farmers", 50 * carry);
      C = { label: "C", min: pull * 2 + carry * 1.5, text: `Sled pull ${pull} × 12.5 m @ ${c.w(d.pull + 10)}; farmers carry ${carry} × 50 m @ ${c.w(d.farmers)}` }; break;
    case 1: c.add("pull", 12.5 * pull); c.add("farmers", 30 * carry);
      C = { label: "C", min: pull * 2 + carry * 1.5, text: `Sled pull E2MOM ${pull} × 12.5 m from ${c.w(d.pull)}, adding ${c.inc(5)} a round; heavy farmers ${carry} × 30 m @ ${c.w(d.farmers + 8)}` }; break;
    default: { const lp = c.settle("pull", Math.max(2, pull - 1), Math.max(2, c.plainN(4) - 1)), lc = c.settle("farmers", Math.max(2, carry - 1), Math.max(2, c.plainN(3) - 1));
      c.add("pull", 25 * lp); c.add("farmers", 100 * lc);
      C = { label: "C", min: lp * 3 + 4, text: `Sled pull ${lp} × 25 m @ ${c.w(d.pull)} (big strong pulls, arms and hip drive only); farmers ${lc} × 100 m unbroken @ ${c.w(d.farmers)}` }; }
  }
  return [A, B, C];
}

function quality(c: Ctx): HxBlock[] {
  const d = c.div;
  const k = c.spec.kind;
  if (k === "absorb") {
    if (turn(c) === 0) {
      c.add("ski", 1000); c.add("row", 1000); c.add("bbj", 25); c.add("farmers", 50);
      return [{ label: "Main", min: 45, text: `Easy AMRAP 45 min: 1 km ski, 1 km row, 25 burpees, 50 m farmers carry. RPE 4 out of 10.` }];
    }
    c.add("bbj", 40); c.add("lunges", 40); c.add("wb", 20); c.add("push", 48); c.add("pull", 48); c.add("farmers", 200);
    return [{ label: "Main", min: 45, text: `Station touch, easy: 2 rounds (5 BBJ + 10 walking lunges, 5 BBJ + 10 WB), 4 × 12 m push, 4 × 12 m pull, 2 × 100 m farmers. Not a suffer fest.` }];
  }
  if (k === "strength") {
    switch (c.spec.step) {
      case 0: {
        const r = c.n(3);
        c.add("ski", 250 * 5); c.add("push", 12.5 * 5);
        if (r >= 2) { c.add("bbj", 16 * 5); c.add("row", 250 * 5); }
        if (r >= 3) { c.add("farmers", 50 * 5); c.add("wb", 15 * 5); }
        return [{ label: "Main", min: r * 20, text: `${r} × (${c.leg(2000, "threshold")} + 10 min EMOM alternating). Round 1: 15 cal ski / 12.5 m sled push. Round 2: 8 BBJ / 15 cal row. Round 3: 50 m farmers / 15 WB. Transitions under 30 s.` }];
      }
      case 1: {
        const r = c.n(3); // ~3 rounds of each AMRAP
        c.add("row", 500 * r * 2); c.add("bbj", 20 * r * 2); c.add("push", 25 * r * 2); c.add("lunges", 20 * r * 2);
        return [{ label: "Main", min: r * 11, text: `Station AMRAPs: ${r} × AMRAP 8 min (500 m row, 20 m BBJ, 25 m sled push @ ${c.w(d.push)}, 20 walking lunges @ ${c.w(d.lunges)}), 3 min easy bike between. Push hard on the stations, use the bike to reset.` }];
      }
      default: {
        const r = c.n(4);
        c.add("wb", 25 * r);
        return [{ label: "Main", min: r * 11, text: `Threshold endurance: ${r} × (${c.leg(1000, "threshold")} + 25 WB @ ${c.w(d.wb)} + 5 min easy bike)` }];
      }
    }
  }
  if (k === "build") {
    switch (c.spec.step) {
      case 0: {
        const r = c.n(4);
        c.add("row", 400 * r); c.add("farmers", 100 * r); c.add("lunges", 20 * r); c.add("pull", 12 * r); c.add("ski", 400 * r); c.add("wb", 20 * r);
        return [
          { label: "A", min: r * 5, text: `${r} × (400 m row, 100 m farmers @ ${c.w(d.farmers)}, 20 m lunges @ ${c.w(d.lunges + 5)}, 12 m sled pull from ${c.w(d.pull)} adding ${c.inc(5)} a round)` },
          { label: "B", min: r * 4, text: `${r} × (20 cal bike, 400 m ski, 20 WB)` },
        ];
      }
      case 1: {
        c.add("row", 1500); c.add("lunges", 75); c.add("wb", 75);
        return [{ label: "Main", min: 45, text: `Descending ladder: ${c.leg(2000, "threshold")}, 1 km row, 50 m lunges @ ${c.w(d.lunges)}, 50 WB; rest 3 min; then ${c.leg(1000, "threshold")}, 500 m row, 25 m lunges, 25 WB. Transition immediately.` }];
      }
      default: {
        const r = c.n(5);
        const st = ["400 m ski", "40 m BBJ", "25 WB", "25 m sled push", "50 m farmers"];
        for (let i = 0; i < r; i++) {
          const s = st[i % 5];
          if (s.includes("ski")) c.add("ski", 400); else if (s.includes("BBJ")) c.add("bbj", 40); else if (s.includes("WB")) c.add("wb", 25); else if (s.includes("push")) c.add("push", 25); else c.add("farmers", 50);
        }
        c.add("wb", 60);
        return [
          { label: "A", min: r * 5, text: `${r} × (${c.leg(600, "threshold")} + one station @ race weight: ${st.slice(0, Math.min(r, 5)).join(" / ")}), 75 s rest` },
          { label: "B", min: 10, text: `EMOM 10: odd 30 s bike @ RPE 8, even 12 WB, best form` },
        ];
      }
    }
  }
  if (k === "sharpen" && c.spec.benchRepeat) {
    c.add("ski", 2000); c.add("push", 100); c.add("pull", 100); c.add("lunges", 100); c.add("wb", 100);
    return [
      { label: "A", min: 25, text: `2 × (${c.leg(1000, "race pace")} + 1 km ski + 50 m sled push + 50 m sled pull)` },
      { label: "Benchmark", min: 15, text: `Repeat the week 1 benchmark: ${c.leg(1000, "race effort")}, then 100 m lunges @ ${c.w(d.lunges)} for time, then 100 WB for time. Compare times and breaks.` },
    ];
  }
  if (k === "peak" && c.spec.step === 1) {
    c.add("ski", 1000); c.add("push", 50); c.add("pull", 50); c.add("bbj", 80); c.add("wb", 100);
    return [
      { label: "A", min: 30, text: `First half race simulation: ${c.leg(1000, "race pace")} + 1 km ski, ${c.leg(1000, "race pace")} + 50 m push, ${c.leg(1000, "race pace")} + 50 m pull, ${c.leg(1000, "race pace")} + 80 m BBJ` },
      { label: "B", min: 16, text: `Then 4 × (${c.leg(400, "threshold")} + 25 WB @ ${c.w(d.wb)}): 100 WB for time after 400s` },
    ];
  }
  const r = c.n(3);
  c.add("ski", 2000); c.add("push", 100); c.add("pull", 100); c.add("lunges", 30 * r); c.add("wb", 30 * r);
  return [
    { label: "A", min: 25, text: `2 × (${c.leg(1000, "race pace")} + 1 km ski + 50 m sled push + 50 m sled pull)` },
    { label: "B", min: r * 5, text: `Lunge into WB brick: ${r} × (${c.leg(400, "threshold")} + 30 m lunges @ ${c.w(d.lunges)} + 30 WB), 2 min rest` },
  ];
}

const TITLES: Record<HxDayType, string> = {
  off: "No station session", aerobic: "Aerobic stations", lower: "Lower + lunges + WB", upper: "Upper + sled",
  quality: "HYROX Quality", quality_short: "HYROX Quality (short)", test: "Benchmark", race: "Race", rest: "Rest", vacation: "Vacation",
};

function bench(c: Ctx, slot: HxSlot): HxDay | null {
  const d = c.div;
  const mk = (title: string, blocks: HxBlock[]): HxDay => ({ type: "test", title, blocks: [WARMUP, ...blocks], min: 10 + blocks.reduce((t, b) => t + b.min, 0), vol: {} });
  if (slot === "lower") { c.add("row", 2000); c.add("push", 50); return mk("Test 1", [{ label: "Test", min: 30, text: `2k row time trial. 20 min later, 50 m sled push for time @ ${c.w(d.push)}. Record the time and number of breaks.` }]); }
  if (slot === "upper") { c.add("ski", 2000); c.add("wb", 120); return mk("Test 2", [{ label: "Test", min: 30, text: `2k ski time trial. Then max unbroken WB @ ${c.w(d.wb)}, rest 2 min, max unbroken again. Record both.` }]); }
  if (slot === "quality") { c.add("lunges", 100); c.add("wb", 100); return mk("Weak station test", [{ label: "Test", min: 25, text: `${c.leg(1000, "race effort")}, then 100 m sandbag lunges @ ${c.w(d.lunges)} for time, then 100 WB @ ${c.w(d.wb)} for time. Record lunge time, WB time and breaks.` }]); }
  return null;
}

/** The coach's race-week template, placed around the first race of the week. Extra races that week are race days too. */
function raceWeek(c: Ctx, races: { day: number; race: Race }[]): HxDay[] {
  const d = c.div;
  const mk = (type: HxDayType, title: string, blocks: HxBlock[], warm = true): HxDay => ({
    type, title, blocks: warm ? [WARMUP, ...blocks] : blocks, min: (warm ? 10 : 0) + blocks.reduce((t, b) => t + b.min, 0), vol: {},
  });
  const days: HxDay[] = Array.from({ length: 7 }, () => mk("off", TITLES.off, [], false));
  const first = Math.min(...races.map((r) => r.day));
  const at = (off: number, day: HxDay) => { const i = first + off; if (i >= 0 && i < 7) days[i] = day; };
  const multi = races.length > 1;
  at(-5, mk("aerobic", "Recovery machines", [{ label: "Main", min: 45, text: "3 × (5 min bike, 5 min row, 5 min ski), relaxed" }], false));
  at(-4, mk("aerobic", "Easy aerobic", [{ label: "Main", min: 30, text: "30 min machine z2, or uphill walk" }], false));
  if (multi) at(-3, mk("aerobic", "Easy aerobic", [{ label: "Main", min: 25, text: "Easy aerobic + light weighted pull-ups. No station sharpener in a multi-race week." }], false));
  else at(-3, mk("quality", "Race-week sharpener", [
    { label: "A", min: 20, text: `4 × (${c.leg(400, "threshold")} + 400 m ski or row @ 2k pace + 8 s), 90 s rest. Last set: + 30–40 unbroken WB.` },
    { label: "B", min: 10, text: `10 min reset, then E2MOM × 3: 10 m push + 10 m BBJ / 10 m pull + 10 walking lunges + 50 m farmers, all @ race weight. Just feel the weight.` },
  ]));
  at(-2, mk("aerobic", "Hybrid z2", [{ label: "Main", min: 30, text: "3 × (5 min bike + 5 min ski or row), easy" }], false));
  at(-1, mk("aerobic", "Primer", [{ label: "Main", min: 25, text: `20 min bike z2 + EMOM 9: 10 WB, 10 box step-downs, 5 box jumps. Nothing here should create fatigue.` }], false));
  const last = Math.max(...races.map((r) => r.day));
  if (last + 1 < 7) days[last + 1] = mk("rest", "Rest", [{ label: "Recover", min: 0, text: "Take 1–2 full rest days after the race, then easy strength circuits and 30–60 min easy aerobic." }], false);
  for (let i = first + 1; i < last; i++) days[i] = mk("aerobic", "Between races", [{ label: "Main", min: 25, text: "Rest completely, or 20–30 min of easy movement." }], false);
  for (const { day, race } of races) {
    days[day] = race.kind === "hyrox"
      ? mk("race", race.name || "HYROX race", [
        { label: "Warm-up", min: 45, text: `45–50 min, finishing 5–10 min before the start: easy bike ~50% FTP, mobility, then touch the stations: sled push 3–4 × 5 m (one slightly heavier), 3–4 sled pulls, BBJ 3–4 × 4, 20 m farmers, 8–10 lunges, 8–10 WB @ ${c.w(d.wb)}.` },
        { label: "Race", min: 0, text: "Pace the first run. Lunges in 2–3 short breaks at most; wall balls in sets of 15–20 with breaks under 5 s." },
      ], false)
      : mk("race", race.name || "Run race", [{ label: "Race", min: 0, text: "Run race: see your run plan for the warm-up and pacing. No station work today." }], false);
  }
  if (races.some((r) => r.race.kind === "hyrox")) { c.add("wb", 40); c.add("push", 30); c.add("pull", 30); c.add("bbj", 20); c.add("lunges", 10); c.add("farmers", 50); }
  return days;
}

function dayFor(c: Ctx, slot: HxSlot): HxDay {
  const k = c.spec.kind;
  if ((k === "bench" || k === "test") && slot !== "off") {
    const b = bench(c, slot);
    if (b) return b;
  }
  // Quality and aerobic days come from the session library when it has a match for this phase.
  const libKind: LibKind | null = slot === "aerobic" ? "aerobic" : slot === "quality" ? "quality_long" : slot === "quality_short" ? "quality_short" : null;
  const keepCode = slot === "quality" && k === "sharpen" && c.spec.benchRepeat; // the benchmark repeat stays as written
  const picked = libKind && !keepCode ? fromLibrary(c, libKind) : null;
  if (picked) return { type: slot, title: picked.name, blocks: picked.blocks, min: 0, vol: {}, libId: picked.id };
  const blocks = slot === "aerobic" ? aerobic(c) : slot === "lower" ? lower(c) : slot === "upper" ? upper(c) : slot === "quality" ? quality(c) : slot === "quality_short" ? shortFallback(c) : [];
  return { type: slot, title: TITLES[slot], blocks, min: 0, vol: {} };
}

/** Which library phase a week draws from. */
function libPhase(kind: HxKind): LibPhase | null {
  return kind === "strength" ? "strength" : kind === "build" ? "build" : kind === "peak" ? "peak" : kind === "sharpen" ? "sharpen" : kind === "absorb" ? "absorb" : null;
}

/** Fill the athlete-specific placeholders in a library session. */
function fillTemplate(c: Ctx, t: string, st?: Station): string {
  const d = c.div;
  return t.replace(/\{(\w+)(?::([^}]*))?\}/g, (all, key: string, arg = "") => {
    if (key === "w") {
      const m = /^(push|pull|farmers|lunges|wb|heavyball)\s*(?:([+\-*])\s*([\d.]+))?$/.exec(arg.trim());
      if (!m) return all;
      let kg = m[1] === "heavyball" ? d.wb + (d.wb >= 9 ? 3 : 2) : d[m[1] as "push" | "pull" | "farmers" | "lunges" | "wb"];
      const v = Number(m[3]);
      if (m[2] === "+") kg += v; else if (m[2] === "-") kg -= v; else if (m[2] === "*") kg *= v;
      return c.w(kg);
    }
    if (key === "leg") { const [m, effort] = arg.split(":"); return c.leg(Number(m) || 400, effort || "threshold"); }
    if (key === "n") return String(c.n(Number(arg) || 1, st));
    if (key === "inc") return c.inc(Number(arg) || 5);
    if (key === "target") return d.target;
    return all;
  });
}

const N_TOKEN = /\{n:[^}]*\}/;

/** How a block's text names each station, to tag the blocks a weakness scaled up. */
const STATION_RX: Record<Station, RegExp> = {
  wb: /\bWB\b|wall ball/i,
  lunges: /lunge/i,
  push: /sled push|\d+\s*m (sled )?push/i,
  pull: /sled pull|\bpull\b(?!-ups)/i,
  farmers: /farmers/i,
  ski: /\bski\b|SkiErg/i,
  row: /(?<!bent-over |cable |inverted )\brow\b/i,
  bbj: /\bBBJ\b|burpee/i,
};

/** Tag a regular block with the boosted stations its text mentions. */
function markBoost(b: HxBlock, boosted: Iterable<Station>) {
  if (b.label === "Warm-up" || b.acc || b.weak) return;
  const hit = [...boosted].filter((st) => STATION_RX[st].test(b.text));
  if (hit.length) b.boost = hit; else delete b.boost;
}

function fromLibrary(c: Ctx, kind: LibKind): { id: string; name: string; blocks: HxBlock[] } | null {
  const phase = libPhase(c.spec.kind);
  if (!phase) return null;
  const off = new Set(c.h.disabledSessions || []);
  const match = (p: LibPhase) => c.lib.filter((x) => x.kind === kind && x.phases.includes(p) && !off.has(x.id));
  let list = match(phase);
  if (!list.length && phase === "sharpen") list = match("peak");
  if (!list.length) return null;
  const s = list[c.spec.w % list.length];
  const vol = Object.entries(s.vol || {}) as [Station, number][];
  // Decided block by block: a block that names a weak station gets more rounds ({n:x} scales with the
  // weakness), more minutes, and the tag. A block with no {n:x}, or whose count doesn't change, stays as written.
  const per = s.minutes / Math.max(1, s.blocks.length);
  const f = WEAK_FACTOR[c.h.emphasis];
  const scaled: string[] = []; // raw text of the blocks that grew
  const blocks = s.blocks.map((b) => {
    const weakHere = N_TOKEN.test(b.text) && c.scalesWeak ? c.weak.filter((st) => STATION_RX[st].test(b.text)) : [];
    const plain = fillTemplate(c, b.text);
    const text = weakHere.length ? fillTemplate(c, b.text, weakHere[0]) : plain;
    const out: HxBlock = { label: b.label, text, min: per };
    if (text !== plain) {
      out.min = per * f;
      out.boost = weakHere;
      for (const st of weakHere) c.boosted.add(st);
      scaled.push(b.text);
    }
    return out;
  });
  // The volume follows: a station grows only if a scaled block trains it.
  for (const [st, v] of vol) c.add(st, v * c.spec.vol * (scaled.some((t) => STATION_RX[st].test(t)) ? f : 1));
  return { id: s.id, name: s.name, blocks };
}

/** Used only if the library has no short quality session for this phase. */
function shortFallback(c: Ctx): HxBlock[] {
  c.add("ski", 1600); c.add("wb", 35);
  return [{ label: "Main", min: 30, text: `4 × (${c.leg(400, "threshold")} + 400 m ski @ 2k pace + 8 s), 90 s rest. Last set: + 30–40 unbroken WB.` }];
}

/** A run-plan day as the HYROX plan sees it. */
export type RunDay = "double" | "hard" | "easy";

const FRESH: HxSlot[] = ["lower", "quality", "quality_short"];

/**
 * Moves station sessions off the run plan's double threshold days to the nearest free day (no
 * station session, no double, not blocked; the later day on a tie). Lower and HYROX Quality
 * sessions look for a day that doesn't follow a hard run (doubles count as hard), taking an
 * aerobic day's place if needed (the aerobic session then moves on); only if there is none do they
 * take the nearest free day. A session with nowhere to go is dropped.
 */
export function moveOffDoubles(template: HxSlot[], doubles: readonly boolean[], blocked: readonly boolean[] = [], hard: readonly boolean[] = doubles): HxSlot[] {
  const out = template.slice();
  const queue: { slot: HxSlot; from: number }[] = [];
  for (let i = 0; i < 7; i++) if (doubles[i] && out[i] !== "off") { queue.push({ slot: out[i], from: i }); out[i] = "off"; }
  queue.sort((x, y) => Number(FRESH.includes(y.slot)) - Number(FRESH.includes(x.slot)));
  const open = (j: number) => j >= 0 && j < 7 && !doubles[j] && !blocked[j];
  const rested = (j: number) => !hard[(j + 6) % 7] && !doubles[(j + 6) % 7];
  const near = (i: number) => [1, 2, 3, 4, 5, 6].flatMap((d) => [i + d, i - d]).filter(open);
  while (queue.length) {
    const { slot, from } = queue.shift()!;
    const days = near(from);
    let j = -1;
    if (FRESH.includes(slot)) {
      j = days.find((k) => rested(k) && (out[k] === "off" || out[k] === "aerobic")) ?? -1;
      if (j >= 0 && out[j] === "aerobic") queue.push({ slot: "aerobic", from: j });
    }
    if (j < 0) j = days.find((k) => out[k] === "off") ?? -1;
    if (j >= 0) out[j] = slot;
  }
  return out;
}

/** `runDays[week][day]`: that day in the run plan. Station sessions move off double threshold days. */
export function buildHyrox(h: HyroxSettings, cal: Calendar, lib: LibSession[] = BUILTIN_SESSIONS, runDays?: readonly (readonly RunDay[])[]): HxPlan {  const weeks: HxWeek[] = [];
  for (const cw of cal.weeks) {
    const spec = weekSpec(cw, h);
    const weak = weakFor(h, cw.period);
    const c = new Ctx(h, spec, weak, lib);
    let days: HxDay[];
    if (spec.kind === "race") days = raceWeek(c, cw.races);
    else if (spec.kind === "vacation") days = Array.from({ length: 7 }, (): HxDay => ({ type: "off", title: TITLES.off, blocks: [], min: 0, vol: {} }));
    else {
      const blocked = cw.off.map((off, i) => off || (i === 0 && cw.afterRace));
      const run = runDays?.[cw.i];
      const tmpl = run ? moveOffDoubles(h.template, run.map((r) => r === "double"), blocked, run.map((r) => r !== "easy")) : h.template;
      const weekBoosted = new Set<Station>(); // weak stations some session this week scaled up
      days = tmpl.map((slot0, i) => {
        const slot: HxSlot = cw.off[i] ? "off" : slot0;
        const before = { ...c.vol };
        c.boosted.clear();
        const day = dayFor(c, slot);
        day.vol = diff(c.vol, before);
        // Library days tag their own blocks (only the ones with scaled rounds).
        if (!day.libId && c.boosted.size) for (const b of day.blocks) markBoost(b, c.boosted);
        for (const st of c.boosted) weekBoosted.add(st);
        return day;
      });
      // What each boosted block would say with no weak stations: the same days built on a separate
      // context (its volume and tags are thrown away), matched by day and block label.
      if (weekBoosted.size) {
        const base = new Ctx(h, spec, [], lib);
        tmpl.forEach((slot0, i) => {
          const plain = dayFor(base, cw.off[i] ? "off" : slot0).blocks;
          for (const b of days[i].blocks) {
            if (!b.boost?.length) continue;
            const m = plain.find((x) => x.label === b.label);
            if (m && m.text !== b.text) b.was = m.text;
          }
        });
      }
      // A top-up block (at most one) for each weak station no session this week scaled up.
      // Absorb weeks get the light version. Not in benchmark weeks.
      if (spec.kind !== "bench" && spec.kind !== "test") {
        for (const st of new Set(weak)) {
          if (weekBoosted.has(st)) continue;
          // Skip Monday after a Sunday race: it becomes a rest day below and would lose the top-up.
          const host = HOST[st].map((s) => days.findIndex((d, i) => d.type === s && !(i === 0 && cw.afterRace))).find((i) => i >= 0);
          if (host === undefined) continue;
          const before = { ...c.vol };
          const b = weakBlock(c, st);
          if (!b) continue;
          days[host].blocks.push(b);
          const add = diff(c.vol, before);
          for (const k of Object.keys(add) as Station[]) days[host].vol[k] = (days[host].vol[k] || 0) + add[k]!;
        }
        // Muscle-specific gym work for each weak station, on its strength day (or the other one).
        for (const st of weak) {
          const pref = ACCESSORY[st].day;
          const accCount = (i: number) => days[i].blocks.filter((x) => x.acc).length;
          const host = [pref, pref === "lower" ? "upper" : "lower"].map((s) => days.findIndex((d) => d.type === s))
            .filter((i) => i >= 0).sort((a, b) => Number(accCount(a) >= 2) - Number(accCount(b) >= 2))[0];
          const b = accessoryBlock(spec, st);
          if (host !== undefined && b) days[host].blocks.push(b);
        }
      }
      for (const d of days) {
        if (d.type === "off" || d.type === "test" || !d.blocks.length) continue;
        d.blocks.unshift(WARMUP);
      }
    }
    if (cw.afterRace && days[0].type !== "race") days[0] = { type: "rest", title: "Rest", blocks: [{ label: "Recover", min: 0, text: "Recovery after yesterday's race: full rest or a 30 min light spin. Stay off the legs." }], min: 0, vol: {} };
    // Vacation days (never a race day).
    cw.off.forEach((off, i) => { if (off && days[i].type !== "race") days[i] = { type: "vacation", title: "Vacation", blocks: [], min: 0, vol: {} }; });
    for (const d of days) if (!d.min) d.min = d.blocks.reduce((t, b) => t + b.min, 0);
    if (spec.kind === "race") {
      // Race-week volume is mostly the race itself; attribute the touches to race day.
      const r = days.findIndex((d) => d.type === "race");
      if (r >= 0) days[r].vol = { ...c.vol };
    }
    const weekStart = cw.start;
    weeks.push({
      weak, weakPct: Math.round((WEAK_FACTOR[h.emphasis] - 1) * 100), block: cw.block, pos: cw.pos, raceNames: cw.races.map((r) => r.race.name || "Race"),
      n: cw.i + 1, phase: spec.phase, phaseKey: spec.phaseKey, kind: spec.kind, light: spec.light, step: spec.step,
      days, weekStart,
      totalMin: days.reduce((t, d) => t + (d.type === "race" ? 0 : d.min), 0),
      sessions: days.filter((d) => d.type !== "off" && d.type !== "rest" && d.type !== "vacation").length,
      vol: c.vol,
    });
  }
  const vol: Partial<Record<Station, number>> = {};
  for (const wk of weeks) for (const k of Object.keys(wk.vol) as Station[]) vol[k] = (vol[k] || 0) + wk.vol[k]!;
  return { weeks, vol, totalMin: weeks.reduce((t, w) => t + w.totalMin, 0), blocks: cal.blocks };
}

function diff(a: Partial<Record<Station, number>>, b: Partial<Record<Station, number>>) {
  const out: Partial<Record<Station, number>> = {};
  for (const k of Object.keys(a) as Station[]) { const v = (a[k] || 0) - (b[k] || 0); if (v) out[k] = v; }
  return out;
}

export const fmtVol = (st: Station, v: number) => `${Math.round(v).toLocaleString()}${STATION[st].unit === "reps" ? " reps" : " m"}`;

const NUM_RX = /\d+(?:\.\d+)?/g;

/** Splits text into alternating [text, number, text, number, …, text] parts. */
export function numParts(s: string): string[] {
  return s.split(/(\d+(?:\.\d+)?)/);
}

/** The numbers a weakness changed, as [was, now] pairs; null if the two texts don't line up number for number. */
export function numChanges(was: string, now: string): [string, string][] | null {
  const a = was.match(NUM_RX) ?? [], b = now.match(NUM_RX) ?? [];
  if (a.length !== b.length) return null;
  return a.flatMap((x, i): [string, string][] => (x === b[i] ? [] : [[x, b[i]]]));
}

/** Plain text for one day (Copy button, intervals.icu description). */
export function hxDayText(wk: HxWeek, d: HxDay): string {
  const lines = [`${d.title} – ${wk.program ?? "HYROX"} week ${wk.n} (${wk.phase})`];
  const pct = wk.weakPct ?? 25;
  for (const b of d.blocks) {
    if (b.label === "Warm-up") { lines.push(`Warm-up: ${b.text}`); continue; }
    const t = prettyText(b.label, b.text);
    if (!b.boost?.length) { lines.push(t); continue; }
    const [first, ...rest] = t.split("\n");
    // "B: …" can have an empty heading (the steps follow), so put the tag after the label, not after the heading.
    const ch = b.was ? numChanges(b.was, b.text) : null;
    const tag = `[weak station +${pct}%]${ch?.length ? ` (${ch.map(([x, y]) => `${x} → ${y}`).join(", ")})` : ""}`;
    const m = /^([^:]+):\s?(.*)$/.exec(first);
    lines.push([m ? `${m[1]}: ${tag}${m[2] ? ` ${m[2]}` : ""}` : `${tag} ${first}`, ...rest].join("\n"));
  }
  if (d.min && d.type !== "race") lines.push(`Est. time: ~${Math.round(d.min)} min`);
  return lines.join("\n");
}

export function hxCsv(p: HxPlan): string {
  const rows = [["Week", "Phase", "Date", "Day", "Session", "Est. minutes", "Details"]];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  p.weeks.forEach((wk) => wk.days.forEach((d, i) => {
    if (d.type === "off" || d.type === "vacation") return;
    rows.push([String(wk.n), wk.phase, isoDate(hxDayDate(wk, i)), DAYS[i], d.title, d.min ? String(Math.round(d.min)) : "", d.blocks.map((b) => `${b.label}: ${b.text}`).join(" | ")]);
  }));
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

/** Run-plan conflicts: the coach keeps hard runs off the day before lower and HYROX Quality sessions. */
export function linkWarnings(hx: HxSlot[], run: string[], quality: string[], days: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (hx[i] !== "lower" && hx[i] !== "quality" && hx[i] !== "quality_short") continue;
    const prev = (i + 6) % 7;
    if (quality.includes(run[prev])) out.push(`Your run plan has a hard run on ${days[prev]}, the day before ${SLOT_LABELS[hx[i]]} on ${days[i]}. Keep hard runs off the day before lower and HYROX Quality sessions.`);
  }
  return out;
}

