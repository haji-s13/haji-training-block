// Supabase Edge Function: a narrow proxy to the Renpho Health cloud, which browsers can't call
// directly. It never stores anything: the email and password are only passed through to Renpho
// once to get a session token, and the app keeps that token on the device.
//
// Unofficial protocol (no public Renpho API), per research/renpho-weight.md:
// every call is POST https://cloud.renpho.com/<path> with {"encryptData": AES-128-ECB(JSON)}.
//
// Deploy: npx supabase functions deploy renpho --no-verify-jwt --project-ref <ref>
// (or the "Supabase functions" GitHub workflow).
import CryptoJS from "npm:crypto-js@4.2.0";

const BASE = "https://cloud.renpho.com/";
const KEY = CryptoJS.enc.Utf8.parse("ed*wijdi$h6fe3ew"); // the app's public AES key
const APP_VERSION = "6.6.0";
const SUCCESS = new Set(["0", "101", "200", "20000"]);
// Body scale device types the Renpho app sends at login (0x01-0x14).
const DEVICE_TYPES = Array.from({ length: 20 }, (_, i) => (i + 1).toString(16).toUpperCase().padStart(2, "0"));

const ORIGINS = ["https://haji-s13.github.io", "http://localhost:3000"];
const AREAS = new Set(["US", "CA", "GB", "IE", "AU", "NZ", "DE", "FR", "NL", "ES", "IT", "SE", "NO", "DK", "FI", "JP", "SG", "AE", "IN", "MX", "BR"]);

const encrypt = (obj: unknown) =>
  CryptoJS.AES.encrypt(JSON.stringify(obj), KEY, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }).toString();
const decrypt = (b64: string) =>
  JSON.parse(CryptoJS.AES.decrypt(b64, KEY, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8));

class Fail extends Error { constructor(msg: string, public status = 502) { super(msg); } }

async function call(path: string, payload: unknown, auth?: { token: string; userId: string }) {
  const headers: Record<string, string> = { "Content-Type": "application/json", appVersion: APP_VERSION, platform: "android" };
  if (auth) { headers.token = auth.token; headers.userId = auth.userId; }
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify({ encryptData: encrypt(payload) }) });
  } catch { throw new Fail("Couldn't reach Renpho."); }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new Fail(`Renpho returned an error (${res.status}).`);
  const code = String(json.code ?? "");
  if (!SUCCESS.has(code)) {
    // Expired or replaced session (for example after signing in again on the phone).
    if (auth) throw new Fail("Your Renpho sign-in has expired. Sign in again under Connections on Profile.", 401);
    throw new Fail(json.msg ? `Renpho: ${json.msg}` : "Renpho didn't accept that email and password.", 401);
  }
  const data = json.data;
  if (typeof data === "string" && data) { try { return decrypt(data); } catch { /* fall through */ } }
  return data;
}

async function login(email: string, password: string, areaCode: string) {
  const user = await call("renpho-aggregation/user/login", {
    questionnaire: {},
    login: { password, areaCode, appRevision: APP_VERSION, cellphoneType: "HajiTrainingBlock", systemType: "11", email, platform: "android" },
    bindingList: { deviceTypes: DEVICE_TYPES },
  });
  const token = user?.login?.token, id = user?.login?.id;
  if (!token || id === undefined) throw new Fail("Renpho didn't return a session.", 401);
  return { token: String(token), userId: String(id) };
}

type Row = Record<string, unknown>;
const listOf = (d: unknown): Row[] => {
  if (Array.isArray(d)) return d as Row[];
  if (d && typeof d === "object") for (const k of ["list", "data", "records", "measurements"]) {
    const v = (d as Row)[k];
    if (Array.isArray(v)) return v as Row[];
  }
  return [];
};

/** Weigh-ins as {ts (ms), kg}, newest first, at most `max`. */
async function weights(token: string, userId: string, max = 100) {
  const auth = { token, userId };
  // Each account's measurements live in table measurements_info_<userId mod 24>.
  const table = `measurements_info_${Number(BigInt(userId) % 24n)}`;
  const pageSize = 50;
  const rows: Row[] = [];
  for (const path of ["RenphoHealth/scale/queryBodyCompositionMeasureData", "RenphoHealth/scale/queryAllMeasureDataList"]) {
    for (let page = 1; page <= Math.ceil(max / pageSize); page++) {
      const list = listOf(await call(path, { pageNum: page, pageSize, userIds: [userId], tableName: table }, auth));
      rows.push(...list);
      if (list.length < pageSize) break;
    }
    if (rows.length) break;
  }
  return rows
    .map((r) => {
      const t = Number(r.timeStamp ?? r.timestamp ?? r.time_stamp);
      return { ts: t > 1e12 ? t : t * 1000, kg: Number(r.weight) };
    })
    .filter((w) => Number.isFinite(w.ts) && w.ts > 0 && Number.isFinite(w.kg) && w.kg > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, max);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST only." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "login") {
      const email = String(body.email || "").trim(), password = String(body.password || "");
      const area = String(body.areaCode || "US").toUpperCase();
      if (!email || !password) throw new Fail("Enter your Renpho email and password.", 400);
      return reply(await login(email, password, AREAS.has(area) ? area : "US"));
    }
    if (body.action === "weights") {
      const token = String(body.token || ""), userId = String(body.userId || "");
      if (!token || !/^\d{1,25}$/.test(userId)) throw new Fail("Sign in to Renpho under Connections on Profile.", 401);
      return reply({ weights: await weights(token, userId) });
    }
    throw new Fail("Unknown action.", 400);
  } catch (e) {
    const f = e instanceof Fail ? e : new Fail("Something went wrong talking to Renpho.");
    return reply({ error: f.message }, f.status);
  }
});
