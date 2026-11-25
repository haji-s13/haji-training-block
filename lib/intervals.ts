import { fmtTime, isoDate, KM_PER_MI, type Range, type Units } from "./format";
import { dayDate, type Session, type Week } from "./plan";
import type { Paces } from "./vdot";

const ICU_BASE = "https://intervals.icu/api/v1/athlete/";
const KEY_STORE = "htb-icu-key";
let keyMemory = "";

export function icuKey(): string {
  if (keyMemory) return keyMemory;
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}
export function setIcuKey(key: string, remember: boolean) {
  keyMemory = key;
  try {
    if (remember && key) localStorage.setItem(KEY_STORE, key);
    else localStorage.removeItem(KEY_STORE);
  } catch { /* ignore */ }
}
export const icuKeyRemembered = () => { try { return !!localStorage.getItem(KEY_STORE); } catch { return false; } };

const icuPace = (secPerKm: number, u: Units) => `${fmtTime(u === "mi" ? secPerKm * KM_PER_MI : secPerKm)}/${u === "mi" ? "mi" : "km"}`;
const icuRange = (r: Range, u: Units) => `${icuPace(r.lo, u)}-${icuPace(r.hi, u)} Pace`;
const icuKm = (km: number) => `${Math.round(km * 10) / 10}km`;

/** Workout text in intervals.icu workout-builder syntax. */
export function icuDescription(wk: Week, d: Session, u: Units, p: Paces): string {
  const easy = icuRange(p.easy, u);
  const out = [`${wk.method === "bakken" ? "Norwegian Method" : "Norwegian Singles"} · Week ${wk.n} (${wk.phase})`, ""];
  if (d.mainText) out.push(d.mainText, "");
  if (d.type === "easy" || d.type === "longrun") {
    out.push(`- ${d.type === "longrun" ? "Long run" : "Easy"} ${icuKm(d.km)} ${easy}`);
    if (d.strides) out.push("", "Strides 6x", `- Stride 20s ${icuPace(p.hills.lo - 15, u)} Pace`, `- Walk/jog 60s ${easy}`, "");
    return out.join("\n");
  }
  if (d.wu) out.push(`- Warmup ${icuKm(d.wu)} ${easy}`, "");
  if (d.type === "race") out.push(`- ${d.title} ${icuKm(d.raceKm!)} ${icuPace(d.racePace!, u)} Pace`, "");
  else if (d.reps) {
    for (const r of [d.reps, d.reps2]) {
      if (!r) continue;
      const step = r.stepKm ? (r.stepKm < 1 ? `${Math.round(r.stepKm * 1000)}mtr` : `${r.stepKm}km`) : r.stepMin < 1 ? `${Math.round(r.stepMin * 60)}s` : `${r.stepMin}m`;
      out.push(`${r === d.reps ? "Main Set" : "Second Set"} ${r.n}x`, `- ${step} ${icuRange(r.pace, u)}`, `- ${r.recLabel} ${r.recS}s ${easy}`, "");
    }
  }
  if (d.cd) out.push(`- Cooldown ${icuKm(d.cd)} ${easy}`);
  return out.join("\n");
}

export interface IcuEvent {
  category: "WORKOUT"; type: "Run" | "WeightTraining"; start_date_local: string; name: string;
  description: string; external_id: string; moving_time: number;
}

export function icuEvent(wk: Week, i: number, u: Units, p: Paces): IcuEvent {
  const d = wk.days[i];
  const day = isoDate(dayDate(wk, i));
  const main = d.pm ? { ...d, pm: undefined, title: "AM threshold" } : d;
  return {
    category: "WORKOUT", type: "Run", start_date_local: `${day}T${d.pm ? "07" : "00"}:00:00`, name: main.title,
    description: icuDescription(wk, main, u, p), external_id: `htb-${day}`, moving_time: Math.round(main.sec),
  };
}

/** A day's workouts: one, or two on a double threshold day (the afternoon gets its own ID). */
export function icuEvents(wk: Week, i: number, u: Units, p: Paces): IcuEvent[] {
  const d = wk.days[i];
  const out = [icuEvent(wk, i, u, p)];
  if (d.pm) {
    const day = isoDate(dayDate(wk, i));
    out.push({ category: "WORKOUT", type: "Run", start_date_local: `${day}T17:00:00`, name: d.pm.title,
      description: icuDescription(wk, d.pm, u, p), external_id: `htb-${day}-pm`, moving_time: Math.round(d.pm.sec) });
  }
  return out;
}

async function icuCall(athleteId: string | undefined, path: string, method: string, body?: unknown) {
  const key = icuKey();
  if (!key) throw new Error("Add your intervals.icu API key under Connections on Profile first.");
  const athlete = encodeURIComponent((athleteId || "").trim() || "0");
  const headers: Record<string, string> = { Authorization: "Basic " + btoa("API_KEY:" + key) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(ICU_BASE + athlete + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach intervals.icu. Check your connection and try again.");
  }
  if (res.status === 401 || res.status === 403) throw new Error("intervals.icu rejected the API key or athlete ID. Check them under Connections on Profile.");
  if (res.status === 404) throw new Error("intervals.icu couldn't find that athlete ID. Leave it blank to use your own account.");
  if (!res.ok) throw new Error(`intervals.icu returned an error (${res.status}).`);
  return res;
}

export async function icuCheck(athleteId?: string): Promise<string> {
  const res = await icuCall(athleteId, "", "GET");
  const data = await res.json().catch(() => ({}));
  return data.name || [data.firstname, data.lastname].filter(Boolean).join(" ") || data.id || "";
}

/** Replaces this planner's workouts on those dates, then creates them. */
export async function icuPush(athleteId: string | undefined, events: IcuEvent[]): Promise<number> {
  await icuCall(athleteId, "/events/bulk-delete", "PUT", events.map((e) => ({ external_id: e.external_id })));
  await icuCall(athleteId, "/events/bulk", "POST", events);
  return events.length;
}

/** Wellness rows (date id + metric fields such as weight in kg) from oldest to newest, both ISO dates. */
export async function icuWellness(athleteId: string | undefined, oldest: string, newest: string): Promise<{ id?: string; weight?: number | null }[]> {
  const q = `?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`;
  const res = await icuCall(athleteId, "/wellness" + q, "GET");
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}
