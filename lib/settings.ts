import { nextMonday, type Units } from "./format";
import { defaultHyrox, normalizeHyrox, type HyroxSettings } from "./hyrox";
import { defaultLifting, normalizeLifting, type LiftSettings } from "./lifting";
import { defaultNutrition, normalizeNutrition, type NutritionSettings } from "./nutrition";
import { normalizeCompleted, type Completed } from "./completed";
import { addDays, defaultEnd, mondayOf, newId, type Race, type Vacation } from "./calendar";
import { isoDate, parseDate } from "./format";
import { buildModel } from "./vdot";

export type SessionType = "rest" | "easy" | "short" | "medium" | "long" | "hills" | "longrun";
export type RepFormat = "distance" | "time" | "mixed";
/** Run plan method: Norwegian Singles, or Marius Bakken's Norwegian Method (double threshold + X day). */
export type RunMethod = "singles" | "bakken";
export type BakkenSlot = "rest" | "easy" | "double" | "single" | "x" | "longrun";
/** Last week when no race falls in it ("race" is from older saves and means the same as "test"). */
export type FinalWeek = "race" | "test" | "normal";

/** Everything a plan is built from. Same shape and storage key as the original site,
 *  so guest settings and plans saved to Supabase carry over unchanged. */
export interface Settings {
  pbDistance: "5000" | "10000";
  pbTime: string;
  units: Units;
  paceAdjust: number;
  startDate: string;
  /** Last day of the build (any day; the plan runs to the end of that week). */
  endDate: string;
  races: Race[];
  vacations: Vacation[];
  startVolume: number;    // display unit per week (period 1)
  peakVolume: number;     // display unit per week (period 1)
  /** Per period: ramp up or hold, and the volumes. Period 1's numbers stay in startVolume/peakVolume. */
  periodVolumes?: ({ ramp?: boolean; start?: number; peak?: number } | null)[];
  subtShare: number;      // % of weekly volume
  subtWarmupKm: number;   // always km
  subtCooldownKm: number; // always km
  repFormat: RepFormat;
  finalWeek: FinalWeek;
  deloads: boolean;
  /** Norwegian Method: lighter 4th week. Off by default; Bakken kept weeks flat. */
  bakkenDeloads: boolean;
  template: SessionType[];
  runMethod: RunMethod;
  /** Bakken weekly template. */
  bakkenTemplate: BakkenSlot[];
  /** Bakken: below this weekly volume (display units) only the first double day stays double. */
  lowMileage: number;
  icuAthlete?: string;
  /** Body weight unit on the Dashboard. Default lb. */
  weightUnit?: "lb" | "kg";
  /** Private key the phone uses to send Health Connect weight and sleep (the `health` Edge Function). */
  healthKey?: string;
  /** 5k test results, each recorded at the end of `period` (0-based); they set the paces of later periods. */
  paceTests?: { period: number; time: string }[];
  /** HYROX station program. Shares startDate with the run plan and saves with it. */
  hyrox: HyroxSettings;
  /** 4-day lifting routine (the Lifting tab). */
  lifting: LiftSettings;
  /** Body details and goal for the Fuel tab. */
  nutrition: NutritionSettings;
  /** Sessions marked complete on the Dashboard. */
  completed?: Completed;
}

export const SESSION_LABELS: Record<SessionType, string> = {
  rest: "Rest",
  easy: "Easy",
  short: "Sub-T short (1k / 3 min)",
  medium: "Sub-T medium (2k / 6 min)",
  long: "Sub-T long (3k / 10 min)",
  hills: "400s / hills",
  longrun: "Long run",
};

export const QUALITY: SessionType[] = ["short", "medium", "long", "hills"];

export const BAKKEN_LABELS: Record<BakkenSlot, string> = {
  rest: "Rest",
  easy: "Easy",
  double: "Double threshold (AM + PM)",
  single: "Threshold (single)",
  x: "X session",
  longrun: "Long run",
};
/** Bakken days that count as hard (for warnings and the HYROX link). */
export const BAKKEN_HARD: BakkenSlot[] = ["double", "single", "x"];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function defaultSettings(): Settings {
  const start = nextMonday();
  return {
    endDate: defaultEnd(start),
    races: [{ id: newId(), date: isoDate(addDays(mondayOf(parseDate(start)!), 11 * 7 + 5)), name: "HYROX race", kind: "hyrox" }],
    vacations: [],
    pbDistance: "5000",
    pbTime: "19:45",
    units: "km",
    paceAdjust: 0,
    startDate: start,
    startVolume: 55,
    peakVolume: 75,
    subtShare: 25,
    subtWarmupKm: 2,
    subtCooldownKm: 1.5,
    repFormat: "distance",
    finalWeek: "test",
    deloads: true,
    bakkenDeloads: false,
    template: ["easy", "short", "easy", "medium", "easy", "long", "longrun"],
    runMethod: "singles",
    bakkenTemplate: ["easy", "double", "easy", "double", "easy", "x", "longrun"],
    lowMileage: 50,
    hyrox: defaultHyrox(),
    lifting: defaultLifting(),
    nutrition: defaultNutrition(),
  };
}

/** Fills gaps in saved or older settings with defaults. */
export function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const s = { ...d, ...(raw && typeof raw === "object" ? raw : {}) } as Settings;
  if (!Array.isArray(s.template) || s.template.length !== 7) s.template = d.template.slice();
  if (s.runMethod !== "bakken") s.runMethod = "singles";
  if (!Array.isArray(s.bakkenTemplate) || s.bakkenTemplate.length !== 7) s.bakkenTemplate = d.bakkenTemplate.slice();
  if (!(Number(s.lowMileage) >= 0)) s.lowMileage = d.lowMileage;
  if (typeof s.bakkenDeloads !== "boolean") s.bakkenDeloads = d.bakkenDeloads;
  s.hyrox = normalizeHyrox(s.hyrox);
  s.lifting = normalizeLifting(s.lifting);
  s.nutrition = normalizeNutrition(s.nutrition);
  s.completed = normalizeCompleted(s.completed);
  // Older saves were always 12 weeks with the race in week 12.
  const raw0 = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings> & { hyrox?: { finalWeek?: string; raceDay?: number } };
  if (!raw0.endDate) s.endDate = defaultEnd(s.startDate);
  if (!Array.isArray(raw0.races)) {
    const wk12 = mondayOf(parseDate(s.startDate) || new Date());
    s.races = raw0.hyrox?.finalWeek === "race" || raw0.finalWeek === "race" || !raw0.hyrox
      ? [{ id: newId(), date: isoDate(addDays(wk12, 11 * 7 + (raw0.hyrox?.raceDay ?? 5))), name: raw0.hyrox ? "HYROX race" : "Race", kind: raw0.hyrox ? "hyrox" : "run" }]
      : [];
    if (s.finalWeek === "race") s.finalWeek = "test";
  }
  if (!Array.isArray(s.vacations)) s.vacations = [];
  if (s.paceTests !== undefined) {
    s.paceTests = Array.isArray(s.paceTests)
      ? s.paceTests.filter((t) => t && typeof t.period === "number" && Number.isFinite(t.period) && typeof t.time === "string")
      : [];
  }
  return s;
}

/** The latest 5k test finished before period `p` starts, or null. */
export function testForPeriod(s: Settings, p: number): { period: number; time: string } | null {
  let best: { period: number; time: string } | null = null;
  for (const t of s.paceTests || []) {
    if (t.period < p && buildModel("5000", t.time, 0) !== null && (!best || t.period > best.period)) best = t;
  }
  return best;
}

/** Where an older version kept settings in the browser; read once to carry them into an account, then removed. */
export const STORAGE_KEY = "htb-planner-v1";

export function templateWarnings(t: SessionType[]): string[] {
  const warns: string[] = [];
  const q = t.map((x) => QUALITY.includes(x));
  const nQ = q.filter(Boolean).length;
  if (nQ === 0) warns.push("Your template has no sub-threshold sessions.");
  if (nQ > 3) warns.push("More than 3 sub-threshold sessions a week is more than the method calls for. Keep it to 2–3.");
  for (let i = 0; i < 7; i++) {
    if (q[i] && q[(i + 1) % 7]) {
      warns.push(`${DAYS[i]} and ${DAYS[(i + 1) % 7]} are back-to-back quality days. The method puts an easy day between sessions.`);
    }
  }
  if (t.filter((x) => x === "longrun").length > 1) warns.push("More than one long run per week.");
  return warns;
}

/** Weekly volume (display units) for a 12-week period. A ramping period builds from start to peak;
 *  any other period holds one steady volume (start = peak). Period 1 ramps unless switched off;
 *  later periods hold at the previous period's peak unless you switch ramping on. */
export function periodVolume(s: Settings, p: number): { ramp: boolean; start: number; peak: number } {
  const set = s.periodVolumes?.[p] || {};
  if (p <= 0) {
    const ramp = set.ramp ?? true;
    return { ramp, start: s.startVolume, peak: ramp ? s.peakVolume : s.startVolume };
  }
  const prev = periodVolume(s, p - 1);
  const ramp = set.ramp ?? false;
  if (ramp) return { ramp, start: set.start ?? Math.round(prev.peak * 0.85), peak: set.peak ?? prev.peak };
  const hold = set.start ?? prev.peak;
  return { ramp, start: hold, peak: hold };
}

export function bakkenWarnings(t: BakkenSlot[]): string[] {
  const warns: string[] = [];
  const hard = t.map((x) => BAKKEN_HARD.includes(x));
  if (!t.includes("double") && !t.includes("single")) warns.push("Your template has no threshold days. The Norwegian Method is built on two double threshold days a week.");
  if (t.filter((x) => x === "x").length > 1) warns.push("More than one X session a week. The method uses one.");
  for (let i = 0; i < 7; i++) {
    if (hard[i] && hard[(i + 1) % 7]) warns.push(`${DAYS[i]} and ${DAYS[(i + 1) % 7]} are back-to-back hard days. The method puts an easy day between them.`);
  }
  return warns;
}
