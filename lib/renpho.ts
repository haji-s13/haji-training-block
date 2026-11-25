import { supabaseUrl } from "./supabase";

/** Renpho session from the `renpho` Supabase Edge Function. Only the token is kept, never the password. */
export interface RenphoSession { token: string; userId: string; email: string }

const STORE = "htb-renpho";
let memory: RenphoSession | null = null;

export function renphoSession(): RenphoSession | null {
  if (memory) return memory;
  try { const s = JSON.parse(localStorage.getItem(STORE) || "null"); return s?.token && s?.userId ? s : null; } catch { return null; }
}
export function setRenphoSession(s: RenphoSession | null, remember: boolean) {
  memory = s;
  try {
    if (s && remember) localStorage.setItem(STORE, JSON.stringify(s));
    else localStorage.removeItem(STORE);
  } catch { /* ignore */ }
}
export const renphoRemembered = () => { try { return !!localStorage.getItem(STORE); } catch { return false; } };

async function fn(body: Record<string, string>) {
  const base = supabaseUrl();
  if (!base) throw new Error("Renpho needs the app's Supabase project, which isn't set up.");
  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/renpho`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach the Renpho connection. Check your internet connection and try again.");
  }
  if (res.status === 404) throw new Error("The Renpho connection isn't deployed yet (Supabase function \"renpho\").");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Renpho connection error (${res.status}).`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Signs in to Renpho. Note: this can sign the Renpho phone app out, like signing in on a second phone. */
export async function renphoLogin(email: string, password: string, areaCode: string): Promise<RenphoSession> {
  const d = await fn({ action: "login", email, password, areaCode });
  return { token: d.token, userId: d.userId, email };
}

/** Recent weigh-ins (time in ms, weight in kg), newest first. Throws with status 401 when the session has expired. */
export async function renphoWeights(s: RenphoSession): Promise<{ ts: number; kg: number }[]> {
  const d = await fn({ action: "weights", token: s.token, userId: s.userId });
  return Array.isArray(d.weights) ? d.weights : [];
}
