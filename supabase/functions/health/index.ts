// Supabase Edge Function: receives weight, sleep and nutrition from the phone and serves them to the app.
//
// Phone side: the HC Webhook Android app reads Health Connect (where Renpho writes weight and your
// watch or phone writes sleep, MyFitnessPal writes meals) and POSTs JSON here, with the person's private sync key in the
// X-Health-Key header (header only, so it stays out of URLs and logs). The Dashboard reads it back with {"action":"read","key":...}.
// Only a SHA-256 hash of the key is stored. Tables: supabase/health_records.sql (health_records, health_nutrition).
//
// Deploy: npx supabase functions deploy health --no-verify-jwt (or the "Supabase functions" workflow).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGINS = ["https://haji-s13.github.io", "http://localhost:3000"];
const MAX_BODY = 2_000_000; // bytes
const MAX_ROWS = 2000;

class Fail extends Error { constructor(msg: string, public status = 400) { super(msg); } }

/** Pasted keys often pick up spaces, line breaks or quotes; drop them. */
const cleanKey = (k: string) => k.replace(/[\s"'`]/g, "");

async function hashKey(raw: string) {
  const key = cleanKey(raw);
  if (!key) throw new Fail("No key received. Add a header named X-Health-Key with your key.", 401);
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(key)) throw new Fail("That key doesn't look right. Copy it again from Profile → Connections.", 401);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Fail(`Storage error (${res.status}): ${(await res.text()).slice(0, 200)}`, 500);
  return res;
}

type Row = { key_hash: string; kind: "weight" | "sleep"; at: string; data: unknown; received_at?: string };
const iso = (v: unknown) => { const t = Date.parse(String(v ?? "")); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** HC Webhook payload → rows. weight: [{kilograms, time}]; sleep: [{session_end_time, duration_seconds, stages: [...]}]. */
function rowsFrom(body: Record<string, unknown>, keyHash: string): Row[] {
  const rows: Row[] = [];
  for (const w of Array.isArray(body.weight) ? body.weight : []) {
    const kg = Number(w?.kilograms ?? w?.weight ?? w?.value);
    const at = iso(w?.time ?? w?.timestamp);
    if (at && kg > 0 && kg < 500) rows.push({ key_hash: keyHash, kind: "weight", at, data: { kg } });
  }
  for (const s of Array.isArray(body.sleep) ? body.sleep : []) {
    const stages = (Array.isArray(s?.stages) ? s.stages : [])
      .map((x: Record<string, unknown>) => {
        const start = iso(x?.start_time), end = iso(x?.end_time);
        const sec = Number(x?.duration_seconds) || (start && end ? (Date.parse(end) - Date.parse(start)) / 1000 : 0);
        return { stage: String(x?.stage ?? ""), start, end, sec };
      })
      .filter((x: { start: string | null; end: string | null }) => x.start && x.end)
      .slice(0, 500);
    const end = iso(s?.session_end_time ?? s?.end_time) ?? stages.reduce((m: string | null, x: { end: string }) => (!m || x.end > m ? x.end : m), null);
    const sec = Number(s?.duration_seconds) || (iso(s?.start_time) && end ? (Date.parse(end) - Date.parse(iso(s.start_time)!)) / 1000 : 0);
    const start = iso(s?.start_time ?? s?.session_start_time) ?? (end && sec ? new Date(Date.parse(end) - sec * 1000).toISOString() : null);
    if (end && sec > 0 && sec < 86400) rows.push({ key_hash: keyHash, kind: "sleep", at: end, data: { start, sec, stages } });
  }
  // One row per (kind, time): Postgres rejects an upsert batch that touches a row twice.
  const now = new Date().toISOString();
  const unique = new Map(rows.map((r) => [`${r.kind}|${r.at}`, { ...r, received_at: now }]));
  return [...unique.values()].slice(0, MAX_ROWS);
}

type NutritionRow = { key_hash: string; record_id: string; at: string; data: Record<string, unknown>; received_at: string };
const grams = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && x < 5000 ? Math.round(x * 10) / 10 : 0; };

/** nutrition: [{start_time, end_time, calories, protein_grams, carbs_grams, fat_grams, meal_type?, name?, metadata: {id, data_origin}}]. */
function nutritionFrom(body: Record<string, unknown>, keyHash: string): NutritionRow[] {
  const now = new Date().toISOString();
  const rows: NutritionRow[] = [];
  for (const r of Array.isArray(body.nutrition) ? body.nutrition : []) {
    const at = iso(r?.start_time ?? r?.time);
    if (!at || Date.parse(at) > Date.now() + 86400000) continue; // nothing from the future
    const meta = (r?.metadata ?? {}) as Record<string, unknown>;
    const data = {
      kcal: grams(r?.calories ?? r?.energy_kcal), carbs: grams(r?.carbs_grams), protein: grams(r?.protein_grams), fat: grams(r?.fat_grams),
      meal: typeof r?.meal_type === "string" ? r.meal_type.slice(0, 20) : null,
      source: typeof meta.data_origin === "string" ? meta.data_origin.slice(0, 100) : null,
    };
    if (!data.kcal && !data.carbs && !data.protein && !data.fat) continue;
    // Records without an id (shouldn't happen) get one from their time and meal.
    const id = typeof meta.id === "string" && meta.id ? meta.id.slice(0, 200) : `${at}|${data.meal ?? ""}|${String(r?.name ?? "").slice(0, 50)}`;
    rows.push({ key_hash: keyHash, record_id: id, at, data, received_at: now });
  }
  return [...new Map(rows.map((r) => [r.record_id, r])).values()].slice(0, MAX_ROWS);
}

/** Record ids HC Webhook says were deleted in Health Connect (deleted: [{type, id}]). */
function deletedNutrition(body: Record<string, unknown>): string[] {
  return (Array.isArray(body.deleted) ? body.deleted : [])
    .filter((d: Record<string, unknown>) => /nutrition/i.test(String(d?.type ?? "")) && typeof d?.id === "string" && d.id)
    .map((d: Record<string, unknown>) => String(d.id).slice(0, 200))
    .slice(0, MAX_ROWS);
}

const inList = (ids: string[]) => `(${ids.map((id) => `"${id.replace(/["\\]/g, "")}"`).join(",")})`;

/** Stores meals and applies deletions. Its own errors are reported, never allowed to block weight and sleep. */
async function ingestNutrition(body: Record<string, unknown>, keyHash: string) {
  const food = nutritionFrom(body, keyHash);
  const gone = deletedNutrition(body);
  if (food.length) {
    await rest("health_nutrition?on_conflict=key_hash,record_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(food) });
    await rest(`health_nutrition?key_hash=eq.${keyHash}&at=lt.${encodeURIComponent(new Date(Date.now() - 400 * 86400000).toISOString())}`, { method: "DELETE" });
  }
  for (let i = 0; i < gone.length; i += 100) {
    await rest(`health_nutrition?key_hash=eq.${keyHash}&record_id=in.${encodeURIComponent(inList(gone.slice(i, i + 100)))}`, { method: "DELETE" });
  }
  return { nutrition: food.length, deleted: gone.length };
}

async function ingest(body: Record<string, unknown>, keyHash: string) {
  const rows = rowsFrom(body, keyHash);
  if (rows.length) {
    await rest("health_records?on_conflict=key_hash,kind,at", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    // Keep about a year per key so the table can't grow without end.
    await rest(`health_records?key_hash=eq.${keyHash}&at=lt.${encodeURIComponent(new Date(Date.now() - 400 * 86400000).toISOString())}`, { method: "DELETE" });
  } else {
    // Nothing new for weight or sleep: still record that the phone checked in.
    await rest(`health_records?key_hash=eq.${keyHash}&at=gte.${encodeURIComponent(new Date(Date.now() - 2 * 86400000).toISOString())}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ received_at: new Date().toISOString() }),
    });
  }
  // Weight and sleep are saved first; a nutrition problem only shows up in the reply.
  const food = await ingestNutrition(body, keyHash).catch((e) => ({ nutrition: 0, deleted: 0, nutritionError: e instanceof Error ? e.message : "failed" }));
  return { stored: rows.length, ...food };
}

async function read(keyHash: string) {
  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  type Stored = { at: string; data: Record<string, unknown>; received_at: string };
  const q = (kind: string, days: number): Promise<Stored[]> =>
    rest(`health_records?select=at,data,received_at&key_hash=eq.${keyHash}&kind=eq.${kind}&at=gte.${encodeURIComponent(since(days))}&order=at.desc&limit=1000`).then((r) => r.json()).then((rows: Stored[]) => rows.reverse());
  const meals = rest(`health_nutrition?select=at,data,received_at&key_hash=eq.${keyHash}&at=gte.${encodeURIComponent(since(60))}&order=at.desc&limit=2000`)
    .then((r) => r.json()).then((rows: Stored[]) => rows.reverse()).catch((): Stored[] => []);
  const [weight, sleep, nutrition] = await Promise.all([q("weight", 60), q("sleep", 30), meals]);
  return {
    weight: weight.map((r) => ({ ts: Date.parse(r.at), kg: Number(r.data.kg) })),
    sleep: sleep.map((r) => ({ end: r.at, ...r.data })),
    nutrition: nutrition.map((r) => ({ at: r.at, ...r.data })),
    lastSync: [...weight, ...sleep, ...nutrition].reduce<string | null>((m, r) => (!m || r.received_at > m ? r.received_at : m), null),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, x-health-key, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST only." }, 405);

  try {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new Fail("Too much data in one sync.", 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text || "{}"); } catch { throw new Fail("Body must be JSON."); }
    if (body.action === "read") return reply(await read(await hashKey(String(body.key || ""))));
    // X-Health-Key is the documented header; also accept a Bearer token or x-api-key, in case the app's header form differs.
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const key = req.headers.get("X-Health-Key") || req.headers.get("x-api-key") || bearer || "";
    return reply(await ingest(body, await hashKey(key)));
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail("Something went wrong.", 500);
    return reply({ error: f.message }, f.status);
  }
});
