import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Settings } from "./settings";
import type { LibSession } from "./session-library";
import type { FoodLog } from "./nutrition";

// Public values (the publishable key is designed to ship to browsers; row-level
// security keeps each person's plans private). Empty = guest-only.
const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykfkgmoltgpxjonvomgw.supabase.co")
  .trim().replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_aIdIBxFXoVGGO-aTi_mINA_MHQ-om93";

export const authEnabled = !!(URL && KEY);
/** Project URL, for calling Edge Functions. */
export const supabaseUrl = () => URL;

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!authEnabled || typeof window === "undefined") return null;
  client ??= createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

export interface PlanRow { id: string; name: string; updated_at: string }

export function planError(error: unknown): string {
  const m = String((error as { message?: string })?.message || "");
  if (/relation .*plans.* does not exist|could not find the table/i.test(m)) return "The plans table isn't set up yet. Run the SQL in SUPABASE_SETUP.md.";
  if (/permission denied for table plans/i.test(m)) return "Your account can't use the plans table yet. Run the grant line from SUPABASE_SETUP.md.";
  if (/JWT|expired|not authenticated/i.test(m)) return "Your sign-in has expired. Sign out and sign in again.";
  if (/fetch|network/i.test(m)) return "Couldn't reach your saved plans. Check your connection and try again.";
  return m || "Something went wrong with your saved plans.";
}

export async function listPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase()!.from("plans").select("id,name,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as PlanRow[];
}
export async function createPlan(name: string, settings: Settings): Promise<string> {
  const { data, error } = await supabase()!.from("plans").insert({ name, settings }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}
export async function updatePlan(id: string, name: string, settings: Settings) {
  const { error } = await supabase()!.from("plans").update({ name, settings, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function getPlan(id: string): Promise<{ id: string; name: string; settings: Settings }> {
  const { data, error } = await supabase()!.from("plans").select("id,name,settings").eq("id", id).single();
  if (error) throw error;
  return data as { id: string; name: string; settings: Settings };
}
export async function deletePlan(id: string) {
  const { error } = await supabase()!.from("plans").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- HYROX session library ---------- */

const SESSION_COLS = "id,user_id,kind,name,phases,minutes,blocks,vol,source,sort";

/** Built-in and (when signed in) your own sessions. Null if the table isn't set up or can't be reached. */
export async function fetchSessions(): Promise<LibSession[] | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from("hyrox_sessions").select(SESSION_COLS).order("sort").order("name");
  if (error) return null;
  return data as LibSession[];
}
export async function saveSession(s: LibSession, isNew: boolean): Promise<void> {
  const row = { kind: s.kind, name: s.name, phases: s.phases, minutes: s.minutes, blocks: s.blocks, vol: s.vol || {}, source: s.source || null, sort: s.sort ?? 1000, updated_at: new Date().toISOString() };
  const q = isNew ? supabase()!.from("hyrox_sessions").insert(row) : supabase()!.from("hyrox_sessions").update(row).eq("id", s.id);
  const { error } = await q;
  if (error) throw error;
}
export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase()!.from("hyrox_sessions").delete().eq("id", id);
  if (error) throw error;
}
export function sessionError(error: unknown): string {
  const m = String((error as { message?: string })?.message || "");
  if (/hyrox_sessions.* does not exist|could not find the table/i.test(m)) return "The session library table isn't set up yet. Run supabase/hyrox_sessions.sql in Supabase.";
  if (/permission denied/i.test(m)) return "Your account can't change the session library. Run the grant lines from supabase/hyrox_sessions.sql.";
  if (/JWT|expired|not authenticated/i.test(m)) return "Your sign-in has expired. Sign out and sign in again.";
  return m || "Something went wrong with the session library.";
}

/* ---------- Account settings: one private row per user (see supabase/user_settings.sql) ---------- */

export async function loadAccountSettings(): Promise<Settings | null> {
  // Row-level security returns only the signed-in user's row.
  const { data, error } = await supabase()!.from("user_settings").select("settings").limit(1);
  if (error) throw error;
  return (data as { settings: Settings }[])[0]?.settings ?? null;
}
export async function saveAccountSettings(userId: string, settings: Settings): Promise<void> {
  const { error } = await supabase()!.from("user_settings")
    .upsert({ user_id: userId, settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
/** The newest plan saved with the old "My plans" card, to carry over into the account. */
export async function latestSavedPlan(): Promise<Settings | null> {
  const { data, error } = await supabase()!.from("plans").select("settings").order("updated_at", { ascending: false }).limit(1);
  if (error) return null;
  return (data as { settings: Settings }[])[0]?.settings ?? null;
}
export function accountError(error: unknown): string {
  const m = String((error as { message?: string })?.message || "");
  if (/user_settings.* does not exist|could not find the table/i.test(m)) return "Account storage isn't set up yet. Run supabase/user_settings.sql in Supabase.";
  if (/permission denied/i.test(m)) return "Your account can't save yet. Run the grant line in supabase/user_settings.sql.";
  if (/JWT|expired|not authenticated/i.test(m)) return "Your sign-in has expired. Sign out and sign in again.";
  if (/fetch|network/i.test(m)) return "Couldn't reach your account. Changes will save when you're back online.";
  return m || "Couldn't save to your account.";
}

/* ---------- Food logs: one private row per user per day (see supabase/nutrition_logs.sql) ---------- */

/** The signed-in user's logs from `from` to `to` (ISO dates, inclusive). Row-level security limits them to their own. */
export async function loadFoodLogs(from: string, to: string): Promise<FoodLog[]> {
  const { data, error } = await supabase()!.from("nutrition_logs").select("day,carbs,protein,fat").gte("day", from).lte("day", to).order("day");
  if (error) throw error;
  return (data as { day: string; carbs: number; protein: number; fat: number }[])
    .map((r) => ({ date: r.day, carbs: Number(r.carbs), protein: Number(r.protein), fat: Number(r.fat) }));
}
export async function saveFoodLog(userId: string, log: FoodLog): Promise<void> {
  const { error } = await supabase()!.from("nutrition_logs")
    .upsert({ user_id: userId, day: log.date, carbs: log.carbs, protein: log.protein, fat: log.fat, updated_at: new Date().toISOString() }, { onConflict: "user_id,day" });
  if (error) throw error;
}
export function foodLogError(error: unknown): string {
  const m = String((error as { message?: string })?.message || "");
  if (/nutrition_logs.* does not exist|could not find the table/i.test(m)) return "Food logs aren't set up yet. Run supabase/nutrition_logs.sql in Supabase.";
  if (/JWT|expired|not authenticated/i.test(m)) return "Your sign-in has expired. Sign out and sign in again.";
  if (/fetch|network/i.test(m)) return "Couldn't reach your account. Check your connection and try again.";
  return m || "Couldn't save your food log.";
}
