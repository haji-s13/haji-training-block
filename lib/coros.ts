import { isoDate, type Range } from "./format";
import { dayDate, type Session, type Week } from "./plan";
import type { Paces } from "./vdot";
import { workoutText } from "./workout-text";
import type { Units } from "./format";

/* ---------------------------------------------------------------- course mapping */
const clampPace = (sec: number) => Math.min(1499, Math.max(120, Math.round(sec)));
const paceTarget = (r: Range) => ({ intensityType: 2, intensityValueStart: clampPace(r.lo), intensityValueEnd: clampPace(r.hi) });
const onePace = (sec: number) => ({ intensityType: 2, intensityValueStart: clampPace(sec), intensityValueEnd: clampPace(sec) });
const metres = (km: number) => Math.max(1, Math.round(km * 1000));

/** createScheduledWorkout input for one planner day. */
export function corosCourse(wk: Week, d: Session, u: Units, p: Paces) {
  const easy = paceTarget(p.easy);
  const sections: Record<string, unknown>[] = [];
  if (d.type === "easy" || d.type === "longrun") {
    sections.push({ sectionType: 2, targetType: 1, targetValue: metres(d.km), ...easy });
    if (d.strides) {
      sections.push({ intervalGroup: true, repeats: 6, sets: [
        { sectionType: 2, targetType: 2, targetValue: 20, ...onePace(p.hills.lo - 15) },
        { sectionType: 3, targetType: 2, targetValue: 60, ...easy },
      ] });
    }
  } else {
    if (d.wu && d.wu > 0) sections.push({ sectionType: 1, targetType: 1, targetValue: metres(d.wu), ...easy });
    if (d.type === "race") {
      sections.push({ sectionType: 2, targetType: 1, targetValue: metres(d.raceKm!), ...onePace(d.racePace!) });
    } else if (d.reps) for (const r of [d.reps, d.reps2]) {
      if (!r) continue;
      const work = r.stepKm
        ? { sectionType: 2, targetType: 1, targetValue: metres(r.stepKm), ...paceTarget(r.pace) }
        : { sectionType: 2, targetType: 2, targetValue: r.stepMin * 60, ...paceTarget(r.pace) };
      const rec = { sectionType: 3, targetType: 2, targetValue: r.recS, ...easy };
      for (let left = r.n; left > 0; left -= 20) sections.push({ intervalGroup: true, repeats: Math.min(20, left), sets: [work, rec] });
    }
    if (d.cd && d.cd > 0) sections.push({ sectionType: 4, targetType: 1, targetValue: metres(d.cd), ...easy });
  }
  return {
    sportType: 1,
    courseName: `${d.title} · Week ${wk.n}`.slice(0, 100),
    courseDescription: `${workoutText(wk, d, u, p)}\nTargets are pace ranges per km.`,
    sections,
  };
}

export const ymd = (date: Date) => isoDate(date).replace(/-/g, "");

/** COROS accepts dates from today to 90 days ahead. */
export function inCorosWindow(date: Date): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last = new Date(today); last.setDate(last.getDate() + 90);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return d >= today && d <= last;
}

/* ---------------------------------------------------------------- sent tracking (per device) */
const SENT_KEY = "htb-coros-sent";
export function corosSent(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || "{}"); } catch { return {}; }
}
export function markCorosSent(dateKey: string) {
  try { const m = corosSent(); m[dateKey] = Date.now(); localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- errors */
export interface CorosError { code?: string; message?: string }
export function corosErrorMessage(err: CorosError, source: "direct" | "connector" | null): string {
  switch (err?.code) {
    case "server_not_connected":
    case "server_not_found":
      return source === "direct"
        ? "COROS isn't connected on this device. Connect it under Connections on Profile."
        : "The Claude NSM connector isn't connected. Add it in claude.ai Settings → Connectors.";
    case "needs_reauth":
      return source === "direct"
        ? "Your COROS sign-in has expired. Reconnect COROS under Connections on Profile."
        : "Your Claude NSM connector needs reconnecting in claude.ai Settings → Connectors.";
    case "session_unreadable":
      return "COROS needs a session ID this site isn't allowed to read, so direct sending can't work here.";
    case "approval_required":
      return "Sending to COROS needs your approval. Try again and choose Allow.";
    case "not_in_manifest":
      return "COROS isn't allowed for this page. Turn it on from the page's Permissions menu.";
    case "tool_error":
      return `COROS refused the workout: ${(err.message || "").slice(0, 200)}`;
    default:
      return "COROS didn't confirm. Check your COROS schedule before sending again, so you don't get a duplicate.";
  }
}

/* ---------------------------------------------------------------- direct sign-in (OAuth + PKCE) */
const DISCOVERY = "https://mcp.coros.com/.well-known/oauth-protected-resource/mcp";
const CD_KEY = "htb-coros-direct";
const CD_PENDING = "htb-coros-pending";
const SCOPE = "openid mcp.tools offline_access";
const MCP_VERSION = "2025-06-18";

interface DirectConfig {
  resource: string;
  as: { authorization_endpoint: string; token_endpoint: string; registration_endpoint: string };
  clientId?: string;
  redirectUri?: string;
  access?: string | null;
  refresh?: string | null;
  expiresAt?: number;
}

const load = (): DirectConfig | null => { try { return JSON.parse(localStorage.getItem(CD_KEY) || "null"); } catch { return null; } };
const store = (v: DirectConfig | null) => { try { if (v) localStorage.setItem(CD_KEY, JSON.stringify(v)); else localStorage.removeItem(CD_KEY); } catch { /* ignore */ } };
export const corosConnected = () => { const c = load(); return !!(c && (c.access || c.refresh)); };
const redirectUri = () => location.origin + location.pathname;

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const randomString = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); };
async function challenge(v: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));
}

async function getJson(url: string, opts?: RequestInit) {
  let res: Response;
  try { res = await fetch(url, opts); } catch {
    throw { code: "network", message: "Couldn't reach COROS. Check your connection and try again." };
  }
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const why = body && (body.error_description || body.error);
    throw { code: "http", message: why ? String(why) : `COROS returned an error (${res.status}).` };
  }
  return body as Record<string, unknown>;
}

async function discover(): Promise<DirectConfig> {
  const pr = await getJson(DISCOVERY);
  const asBase = String((pr.authorization_servers as string[])[0]).replace(/\/$/, "");
  const as = await getJson(asBase + "/.well-known/oauth-authorization-server");
  return {
    resource: String(pr.resource),
    as: {
      authorization_endpoint: String(as.authorization_endpoint),
      token_endpoint: String(as.token_endpoint),
      registration_endpoint: String(as.registration_endpoint),
    },
  };
}

/** Registers the site with COROS (once) and sends the viewer to sign in. */
export async function corosConnect(): Promise<void> {
  const cfg = await discover();
  const prev = load();
  let clientId = prev && prev.redirectUri === redirectUri() && prev.resource === cfg.resource ? prev.clientId : undefined;
  if (!clientId) {
    let reg: Record<string, unknown>;
    try {
      reg = await getJson(cfg.as.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Haji Training Block", redirect_uris: [redirectUri()],
          grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
          token_endpoint_auth_method: "none", scope: SCOPE,
        }),
      });
    } catch (e) {
      throw new Error(`COROS didn't accept this site for sign-in (${(e as CorosError).message}).`);
    }
    clientId = reg?.client_id as string | undefined;
    if (!clientId) throw new Error("COROS didn't return an app ID for this site.");
  }
  store({ ...cfg, clientId, redirectUri: redirectUri() });
  const verifier = randomString(48);
  const state = randomString(16);
  try { localStorage.setItem(CD_PENDING, JSON.stringify({ verifier, state })); } catch { /* ignore */ }
  const url = new URL(cfg.as.authorization_endpoint);
  const params: Record<string, string> = {
    response_type: "code", client_id: clientId, redirect_uri: redirectUri(), scope: SCOPE, state,
    code_challenge: await challenge(verifier), code_challenge_method: "S256", resource: cfg.resource,
  };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  location.assign(url.toString());
}

function tokenRequest(cfg: DirectConfig, params: Record<string, string>) {
  return getJson(cfg.as.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}
function storeTokens(cfg: DirectConfig, tok: Record<string, unknown>) {
  store({
    ...cfg,
    access: String(tok.access_token),
    refresh: (tok.refresh_token as string) || cfg.refresh || null,
    expiresAt: Date.now() + Math.max(60, (Number(tok.expires_in) || 3600) - 60) * 1000,
  });
}

/** Finishes sign-in when COROS returns with ?code=… Returns a status message, or null if there was nothing to do. */
export async function corosHandleRedirect(): Promise<{ ok: boolean; message: string } | null> {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return null;
  // Only handle returns from a COROS sign-in we started (Supabase links use ?code= too).
  let pending: { verifier: string; state: string } | null = null;
  try { pending = JSON.parse(localStorage.getItem(CD_PENDING) || "null"); } catch { /* ignore */ }
  if (!pending || !q.has("state")) return null;
  try { localStorage.removeItem(CD_PENDING); } catch { /* ignore */ }
  history.replaceState(null, "", location.pathname + "#connections");
  if (q.has("error")) return { ok: false, message: `COROS sign-in didn't complete: ${q.get("error_description") || q.get("error")}.` };
  const cfg = load();
  if (!cfg || pending.state !== q.get("state")) {
    return { ok: false, message: "COROS sign-in couldn't be verified. Try Connect COROS again." };
  }
  try {
    const tok = await tokenRequest(cfg, {
      grant_type: "authorization_code", code: q.get("code")!, redirect_uri: cfg.redirectUri!,
      client_id: cfg.clientId!, code_verifier: pending.verifier, resource: cfg.resource,
    });
    storeTokens(cfg, tok);
    return { ok: true, message: "Connected to COROS." };
  } catch (e) {
    return { ok: false, message: `COROS sign-in failed: ${(e as CorosError).message}` };
  }
}

export function corosDisconnect() {
  const cfg = load();
  if (cfg) store({ ...cfg, access: null, refresh: null, expiresAt: 0 });
  session = null;
}

async function accessToken(): Promise<string> {
  const cfg = load();
  if (!cfg || !(cfg.access || cfg.refresh)) throw { code: "server_not_connected" };
  if (cfg.access && Date.now() < (cfg.expiresAt || 0)) return cfg.access;
  if (!cfg.refresh) throw { code: "needs_reauth" };
  try {
    const tok = await tokenRequest(cfg, { grant_type: "refresh_token", refresh_token: cfg.refresh, client_id: cfg.clientId!, resource: cfg.resource });
    storeTokens(cfg, tok);
    return String(tok.access_token);
  } catch (e) {
    throw { code: (e as CorosError).code === "network" ? "upstream_error" : "needs_reauth" };
  }
}

/* ---------------------------------------------------------------- MCP over Streamable HTTP */
let session: { id: string | null } | null = null;
let rpcId = 10;

async function mcpPost(token: string, body: { id?: number; method: string; [k: string]: unknown }, sessionId?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json", Accept: "application/json, text/event-stream",
    Authorization: "Bearer " + token, "MCP-Protocol-Version": MCP_VERSION,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  let res: Response;
  try { res = await fetch(load()!.resource, { method: "POST", headers, body: JSON.stringify(body) }); } catch {
    throw { code: "upstream_error" };
  }
  if (res.status === 401) throw { code: "needs_reauth" };
  if (res.status === 202) return { res, msg: null };
  if (res.status === 404 && sessionId) throw { code: "session_expired" };
  if (res.status === 400 && !sessionId && body.method === "tools/call") throw { code: "session_unreadable" };
  if (!res.ok) throw { code: "upstream_error", message: `COROS returned an error (${res.status}).` };
  const text = await res.text();
  let msg: Record<string, unknown> | null = null;
  if ((res.headers.get("content-type") || "").includes("text/event-stream")) {
    text.split(/\r?\n/).forEach((line) => {
      if (!line.startsWith("data:")) return;
      try { const j = JSON.parse(line.slice(5).trim()); if (j && j.id === body.id) msg = j; } catch { /* skip */ }
    });
  } else if (text) {
    try { msg = JSON.parse(text); } catch { /* not JSON */ }
  }
  return { res, msg: msg as Record<string, unknown> | null };
}

async function ensureSession(token: string) {
  if (session) return session;
  const { res, msg } = await mcpPost(token, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: MCP_VERSION, capabilities: {}, clientInfo: { name: "norwegian-singles-planner", version: "2.0" } },
  });
  if (!msg || msg.error) throw { code: "upstream_error", message: "COROS didn't start a session." };
  const id = res.headers.get("mcp-session-id");
  await mcpPost(token, { jsonrpc: "2.0", method: "notifications/initialized" }, id);
  session = { id };
  return session;
}

export interface CorosClient { callTool(server: string, tool: string, input: unknown): Promise<unknown> }

export const directCoros: CorosClient = {
  async callTool(_server, tool, input) {
    const token = await accessToken();
    for (let attempt = 0; ; attempt++) {
      const sess = await ensureSession(token);
      try {
        const { msg } = await mcpPost(token, { jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: tool, arguments: input } }, sess.id);
        if (!msg) throw { code: "upstream_error" };
        if (msg.error) throw { code: "tool_error", message: (msg.error as { message?: string }).message || "COROS reported an error." };
        const r = (msg.result || {}) as { isError?: boolean; content?: { text?: string }[]; structuredContent?: unknown };
        if (r.isError) throw { code: "tool_error", message: (r.content || []).map((c) => c.text || "").join(" ").trim() };
        return r.structuredContent || r;
      } catch (e) {
        if ((e as CorosError).code === "session_expired" && attempt === 0) { session = null; continue; } // refused before running
        throw e;
      }
    }
  },
};

export const COROS_SERVER = "Claude NSM";
export const COROS_TOOL = "createScheduledWorkout";

/** One day to send, with its date. */
export interface CorosItem { wk: Week; i: number; date: Date; pm?: boolean }
export const dayItems = (wk: Week): CorosItem[] =>
  wk.days.flatMap((d, i): CorosItem[] => d.type === "rest" ? [] : d.pm ? [{ wk, i, date: dayDate(wk, i) }, { wk, i, date: dayDate(wk, i), pm: true }] : [{ wk, i, date: dayDate(wk, i) }]);
export const dateKey = (d: Date) => isoDate(d);
/** Sent-tracking key: the date, plus "-pm" for a double day's afternoon session. */
export const itemKey = (it: CorosItem) => dateKey(it.date) + (it.pm ? "-pm" : "");
