"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { buildModel, type Model } from "@/lib/vdot";
import { buildPlan, type Plan, type Week } from "@/lib/plan";
import { type HyroxSettings } from "@/lib/hyrox";
import { buildLifting, type LiftPlan, type LiftSettings } from "@/lib/lifting";
import { buildCalendar, type Calendar } from "@/lib/calendar";
import { normalizeSettings, STORAGE_KEY, testForPeriod, type Settings } from "@/lib/settings";
import { accountError, fetchSessions, latestSavedPlan, loadAccountSettings, saveAccountSettings, supabase } from "@/lib/supabase";
import { BUILTIN_SESSIONS, type LibSession } from "@/lib/session-library";
import { COROS_SERVER, corosConnected, corosHandleRedirect, directCoros, type CorosClient } from "@/lib/coros";

export type Screen = "dashboard" | "builder" | "hyrox" | "paces";
type Entry = "guest" | "account" | null;
export type SaveState = "guest" | "loading" | "saving" | "saved" | "error";

interface AppState {
  ready: boolean;
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => void;
  replaceSettings: (s: Settings) => void;
  model: Model | null;
  /** One pace model per calendar period (later periods use the 5k test before them). */
  models: (Model | null)[];
  currentPeriod: number;
  currentModel: Model | null;
  /** Finished periods whose 5k test week has started and has no time entered. */
  testsDue: number[];
  /** Per period: its scheduled 5k test week, or null when the plan has none. */
  testWeeks: (Week | null)[];
  plan: Plan | null;
  /** The Lifting plan (named hyrox for the shared week cards and dashboard). */
  hyrox: LiftPlan;
  updateLifting: (patch: Partial<LiftSettings>) => void;
  calendar: Calendar;
  /** HYROX session library: from Supabase when set up, else the built-in copy. */
  library: LibSession[];
  librarySource: "database" | "builtin";
  refreshLibrary: () => Promise<void>;
  updateHyrox: (patch: Partial<HyroxSettings>) => void;
  screen: Screen;
  setScreen: (s: Screen) => void;
  entry: Entry;
  enterAsGuest: () => void;
  goHome: () => void;
  user: User | null;
  recovering: boolean;            // opened a password-reset link
  finishRecovery: () => void;
  signOut: () => Promise<void>;
  /** Guests: nothing is saved. Signed in: settings save to the account automatically. */
  saveState: SaveState;
  saveError: string | null;
  coros: { client: CorosClient | null; source: "direct" | "connector" | null; server: string };
  refreshCoros: () => void;
  sentVersion: number;
  bumpSent: () => void;
}

const Ctx = createContext<AppState | null>(null);
export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
};

const ENTRY_KEY = "htb-entry";
const readEntry = (): Entry => { try { return (localStorage.getItem(ENTRY_KEY) as Entry) || null; } catch { return null; } };
const writeEntry = (v: Entry) => { try { if (v) localStorage.setItem(ENTRY_KEY, v); else localStorage.removeItem(ENTRY_KEY); } catch { /* ignore */ } };

function screenFromHash(): Screen {
  const h = typeof location === "undefined" ? "" : location.hash.slice(1);
  if (h === "builder") return "builder";
  if (h === "hyrox") return "hyrox";
  if (h === "paces" || h === "profile" || h === "connections" || h === "intervals") return "paces";
  return "dashboard";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings({}));
  const [screen, setScreenState] = useState<Screen>("dashboard");
  const [entry, setEntryState] = useState<Entry>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("guest");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncedUser, setSyncedUser] = useState<string | null>(null); // account whose settings are loaded
  const lastSaved = useRef<string>("");
  const legacy = useRef<Settings | null>(null);                          // settings an older version kept in this browser
  const current = useRef<Settings>(settings);
  current.current = settings;
  const [coros, setCoros] = useState<AppState["coros"]>({ client: null, source: null, server: COROS_SERVER });
  const [sentVersion, setSentVersion] = useState(0);
  const [library, setLibrary] = useState<LibSession[]>(BUILTIN_SESSIONS);
  const [librarySource, setLibrarySource] = useState<"database" | "builtin">("builtin");
  const refreshLibrary = useCallback(async () => {
    const rows = await fetchSessions().catch(() => null);
    if (rows && rows.length) { setLibrary(rows); setLibrarySource("database"); }
    else { setLibrary(BUILTIN_SESSIONS); setLibrarySource("builtin"); }
  }, []);
  // Load the library at start and again when the signed-in user changes (their own sessions).
  useEffect(() => { refreshLibrary(); }, [refreshLibrary, user?.id]);

  const refreshCoros = useCallback(() => {
    setCoros((c) => (c.source === "connector" ? c
      : corosConnected() ? { client: directCoros, source: "direct", server: COROS_SERVER }
      : { client: null, source: null, server: COROS_SERVER }));
  }, []);

  // Load per-device state once in the browser.
  useEffect(() => {
    // Opened from a password-reset email (we add ?reset=1 to its return address).
    if (new URLSearchParams(location.search).get("reset") === "1" || /type=recovery/.test(location.hash)) setRecovering(true);
    // Workouts are never kept in the browser: guests start fresh, accounts load from the database.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { legacy.current = normalizeSettings(JSON.parse(raw)); localStorage.removeItem(STORAGE_KEY); }
    } catch { /* ignore */ }
    setScreenState(screenFromHash());
    if (/^#(connections|intervals)$/.test(location.hash)) setTimeout(() => document.getElementById("connections")?.scrollIntoView(), 300);
    setEntryState(readEntry());
    refreshCoros();
    setReady(true);
    const onHash = () => setScreenState(screenFromHash());
    window.addEventListener("hashchange", onHash);

    corosHandleRedirect().then((r) => {
      if (!r) return;
      setScreenState("paces");
      setTimeout(() => document.getElementById("connections")?.scrollIntoView(), 300);
      if (r.ok) toast.success(r.message); else toast.error(r.message);
      refreshCoros();
    });

    // On claude.ai the page can use the viewer's Claude NSM connector instead.
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<CorosClient | null> } }).claude;
    c?.use?.("mcp").then((m) => { if (m) setCoros({ client: m, source: "connector", server: COROS_SERVER }); }).catch(() => {});

    return () => window.removeEventListener("hashchange", onHash);
  }, [refreshCoros]);

  // Accounts.
  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { if (data.session) setUser(data.session.user); });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (event === "PASSWORD_RECOVERY") setRecovering(true);
        setUser(session?.user ?? null);
        if (session?.user) { writeEntry("account"); setEntryState("account"); }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const update = useCallback((patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => {
    setSettings((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);
  const updateHyrox = useCallback((patch: Partial<HyroxSettings>) => {
    setSettings((s) => ({ ...s, hyrox: { ...s.hyrox, ...patch } }));
  }, []);
  const replaceSettings = useCallback((s: Settings) => { setSettings(normalizeSettings(s)); }, []);

  // Signed in: load this account's settings (or start it from an older saved plan), then keep them saved.
  useEffect(() => {
    if (!user) { setSyncedUser(null); setSaveState("guest"); setSaveError(null); lastSaved.current = ""; setSettings(normalizeSettings({})); return; }
    let cancelled = false;
    setSaveState("loading");
    (async () => {
      try {
        let s = await loadAccountSettings();
        if (!s) {
          s = (await latestSavedPlan()) ?? legacy.current ?? current.current;
          s = normalizeSettings(s);
          await saveAccountSettings(user.id, s);
        }
        if (cancelled) return;
        const n = normalizeSettings(s);
        lastSaved.current = JSON.stringify(n);
        setSettings(n); setSyncedUser(user.id); setSaveState("saved"); setSaveError(null);
      } catch (e) {
        if (cancelled) return;
        setSaveState("error"); setSaveError(accountError(e));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || syncedUser !== user.id) return;
    const json = JSON.stringify(settings);
    if (json === lastSaved.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try { await saveAccountSettings(user.id, settings); lastSaved.current = json; setSaveState("saved"); setSaveError(null); }
      catch (e) { setSaveState("error"); setSaveError(accountError(e)); }
    }, 800);
    return () => clearTimeout(t);
  }, [settings, syncedUser, user]);

  const setScreen = useCallback((s: Screen) => {
    setScreenState(s);
    history.replaceState(null, "", `#${s}`);
    window.scrollTo({ top: 0 });
  }, []);

  const model = useMemo(() => buildModel(settings.pbDistance, settings.pbTime, settings.paceAdjust), [settings.pbDistance, settings.pbTime, settings.paceAdjust]);
  const calendar = useMemo(() => buildCalendar(settings.startDate, settings.endDate, settings.races, settings.vacations),
    [settings.startDate, settings.endDate, settings.races, settings.vacations]);
  const periodCount = calendar.periods.length;
  const models = useMemo<(Model | null)[]>(() => {
    const out: (Model | null)[] = [];
    for (let p = 0; p < periodCount; p++) {
      const t = p > 0 ? testForPeriod(settings, p) : null;
      out.push((t && buildModel("5000", t.time, settings.paceAdjust)) || model);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, settings.paceTests, settings.paceAdjust, periodCount]);
  const plan = useMemo(() => (model ? buildPlan(settings, model, calendar, models) : null), [settings, model, calendar, models]);
  const testWeeks = useMemo<(Week | null)[]>(
    () => calendar.periods.map((p) => plan?.weeks.find((w) => w.period === p.i && w.testWeek) ?? null),
    [calendar, plan],
  );
  const { currentPeriod, testsDue } = useMemo(() => {
    const now = new Date(); now.setHours(12, 0, 0, 0);
    let cur = 0;
    calendar.periods.forEach((p, i) => { if (now >= calendar.weeks[p.weeks[0]].start) cur = i; });
    const due: number[] = [];
    testWeeks.forEach((tw, i) => {
      if (!tw) return;
      const has = (settings.paceTests || []).some((t) => t.period === i && buildModel("5000", t.time, 0) !== null);
      if (now >= tw.weekStart && !has) due.push(i);
    });
    return { currentPeriod: cur, testsDue: due };
  }, [calendar, settings.paceTests, testWeeks]);
  const currentModel = models[currentPeriod] ?? model;
  // The Lifting tab replaces the HYROX station program: same week/day shapes, built from the 4-day routine.
  const hyrox = useMemo(() => buildLifting(settings.lifting, calendar), [settings.lifting, calendar]);
  const updateLifting = useCallback((patch: Partial<LiftSettings>) => {
    setSettings((s) => ({ ...s, lifting: { ...s.lifting, ...patch } }));
  }, []);

  const value: AppState = {
    ready, settings, update, replaceSettings, model, models, currentPeriod, currentModel, testsDue, testWeeks, plan, hyrox, calendar, library, librarySource, refreshLibrary, updateHyrox, updateLifting, screen, setScreen,
    entry: user ? "account" : entry,
    enterAsGuest: () => { writeEntry("guest"); setEntryState("guest"); },
    goHome: () => { writeEntry(null); setEntryState(null); },
    user,
    recovering,
    finishRecovery: () => { setRecovering(false); history.replaceState(null, "", location.pathname + "#paces"); setScreenState("paces"); },
    signOut: async () => {
      await supabase()?.auth.signOut();
      setUser(null); writeEntry(null); setEntryState(null);
    },
    saveState, saveError,
    coros, refreshCoros,
    sentVersion, bumpSent: () => setSentVersion((v) => v + 1),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
