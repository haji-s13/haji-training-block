import { supabaseUrl } from "./supabase";

/** One night from Health Connect: wake-up time, session start, seconds asleep and stages. */
export interface SleepNight { end: string; start: string | null; sec: number; stages: { stage: string; start: string; end: string; sec: number }[] }
/** One meal (Health Connect nutrition record, e.g. a MyFitnessPal meal summary): start time, kcal and grams. */
export interface MealRecord { at: string; kcal: number; carbs: number; protein: number; fat: number; meal?: string | null; source?: string | null }
export interface HealthData { weight: { ts: number; kg: number }[]; sleep: SleepNight[]; nutrition: MealRecord[]; lastSync: string | null }

/** The `health` Edge Function: the phone (HC Webhook app) posts here, the Dashboard reads from here. */
export const healthUrl = () => `${supabaseUrl()}/functions/v1/health`;

/** A new private sync key (base64url, 32 random bytes). */
export function newHealthKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function healthRead(key: string): Promise<HealthData> {
  let res: Response;
  try {
    res = await fetch(healthUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", key }) });
  } catch {
    throw new Error("Couldn't reach your health data. Check your connection and try again.");
  }
  if (res.status === 404) throw new Error("The health data connection isn't deployed yet.");
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Health data error (${res.status}).`);
  return {
    weight: Array.isArray(d.weight) ? d.weight : [],
    sleep: Array.isArray(d.sleep) ? d.sleep : [],
    nutrition: Array.isArray(d.nutrition) ? d.nutrition : [],
    lastSync: d.lastSync ?? null,
  };
}

/** The sync key is also kept on this device, so guests keep it across reloads. */
const KEY_STORE = "htb-health-key";
export function localHealthKey(): string {
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}
export function saveLocalHealthKey(key: string) {
  try { if (key) localStorage.setItem(KEY_STORE, key); else localStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
}
