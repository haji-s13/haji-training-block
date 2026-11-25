"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { isoDate, parseDate } from "@/lib/format";
import { healthRead, type HealthData } from "@/lib/health";
import { avgAsleep, fmtSleep, nights, STAGE_LABEL, type StageKind } from "@/lib/sleep";
import { dailyWeighIns, fmtWeight, fmtWeightChange, summarize } from "@/lib/weight";
import { cn } from "@/lib/utils";
import { useHealthKey } from "@/components/connections/use-health-key";

/** How often the cards check for new data while the page is open (the phone sends every 15 min or more). */
const POLL_MS = 5 * 60 * 1000;

function dayLabel(d: Date, withTime: boolean): string {
  const days = Math.round((parseDate(isoDate(new Date()))!.getTime() - parseDate(isoDate(d))!.getTime()) / 86400000);
  const day = days === 0 ? "today" : days === 1 ? "yesterday" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return withTime && days <= 1 ? `${day} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
}
const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Loads Health Connect data for the Weight and Sleep cards, and keeps it fresh. */
function useHealth(key: string | undefined) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const seq = useRef(0); // only the newest request may update the cards

  const load = useCallback(async (auto = false) => {
    if (!key || (auto && Date.now() - last.current < 60000)) return;
    last.current = Date.now();
    const id = ++seq.current;
    setBusy(true);
    try {
      const d = await healthRead(key);
      if (id === seq.current) { setData(d); setError(""); }
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, [key]);

  useEffect(() => {
    setData(null); setError("");
    load();
    const onShow = () => { if (document.visibilityState === "visible") load(true); };
    const timer = setInterval(onShow, POLL_MS);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { seq.current++; last.current = 0; clearInterval(timer); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, [load]);

  return { data, error, busy, reload: () => load() };
}

function Card({ icon: Icon, title, busy, onRefresh, children }: { icon: typeof Scale; title: string; busy?: boolean; onRefresh?: () => void; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Icon className="size-5" aria-hidden /><h2 className="font-black">{title}</h2></div>
        {onRefresh && (
          <Button size="icon" variant="ghost" disabled={busy} onClick={onRefresh} aria-label={`Check for new ${title.toLowerCase()} data`}>
            <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden />
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="max-w-[65ch] text-muted-foreground">{children}</p>;
const Stat = ({ value, label, big }: { value: string; label: string; big?: boolean }) => (
  <div className="flex flex-col">
    <span className={cn("num", big ? "font-display text-display" : "font-black")}>{value}</span>
    <span className="text-meta uppercase text-muted-foreground">{label}</span>
  </div>
);

const STAGE_ORDER: StageKind[] = ["deep", "rem", "light", "asleep", "awake"];
const STAGE_BAR: Record<StageKind, string> = {
  deep: "bg-session-subt-ink", rem: "bg-session-long-ink", light: "bg-session-easy-ink", asleep: "bg-session-easy-ink", awake: "bg-muted-foreground/40",
};

/** Weight (from Renpho via Health Connect) and Sleep, each in its own card. */
export function HealthCards() {
  const { settings } = useApp();
  const { key } = useHealthKey();
  const { data, error, busy, reload } = useHealth(key || undefined);
  const setup = <Note>Connect Google Health Connect under Connections on Profile to see this here.</Note>;
  const synced = data?.lastSync ? <p className="text-meta text-muted-foreground">Last sent from your phone <span className="num">{dayLabel(new Date(data.lastSync), true)}</span> · checks every 5 min</p> : null;

  // Weight
  const u = settings.weightUnit || "lb";
  const w = data && summarize(dailyWeighIns(data.weight));
  // Sleep
  const ns = data ? nights(data.sleep) : [];
  const night = ns[ns.length - 1];
  const avg = avgAsleep(ns);
  const staged = night ? STAGE_ORDER.filter((k) => (night.stages[k] || 0) > 0) : [];
  const stageTotal = staged.reduce((a, k) => a + (night!.stages[k] || 0), 0);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card icon={Scale} title="Weight" busy={busy} onRefresh={key ? reload : undefined}>
        {!key ? setup : error ? <Note>{error}</Note> : !data ? <Note>Checking…</Note> : !w ? (
          <Note>No weigh-ins yet. Step on your Renpho scale, open the Renpho app so it saves to Health Connect, then sync HC Webhook.</Note>
        ) : (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <Stat big value={fmtWeight(w.latest.kg, u)} label={`Weighed ${dayLabel(new Date(w.latest.ts ?? parseDate(w.latest.date)!.getTime()), !!w.latest.ts)}`} />
            <Stat value={fmtWeight(w.avg7, u)} label="7-day average" />
            {w.weekChange !== null && <Stat value={fmtWeightChange(w.weekChange, u)} label="vs previous 7 days" />}
          </div>
        )}
        {key && !error && synced}
      </Card>

      <Card icon={Moon} title="Sleep" busy={busy} onRefresh={key ? reload : undefined}>
        {!key ? setup : error ? <Note>{error}</Note> : !data ? <Note>Checking…</Note> : !night ? (
          <Note>No sleep yet. It shows here once a sleep session reaches Health Connect (from your watch or phone) and HC Webhook syncs.</Note>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <Stat big value={fmtSleep(night.asleep)} label={`Asleep · woke ${dayLabel(night.end, true)}`} />
              {night.start && <Stat value={`${clock(night.start)}–${clock(night.end)}`} label="In bed" />}
              {avg !== null && ns.length > 1 && <Stat value={fmtSleep(avg)} label={`${Math.min(7, ns.length)}-night average`} />}
            </div>
            {stageTotal > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img"
                  aria-label={staged.map((k) => `${STAGE_LABEL[k]} ${fmtSleep(night.stages[k]!)}`).join(", ")}>
                  {staged.map((k) => <span key={k} className={STAGE_BAR[k]} style={{ width: `${(night.stages[k]! / stageTotal) * 100}%` }} />)}
                </div>
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-meta text-muted-foreground">
                  {staged.map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <span className={cn("inline-block size-2 rounded-full", STAGE_BAR[k])} aria-hidden />
                      <span className="uppercase">{STAGE_LABEL[k]}</span> <span className="num text-foreground">{fmtSleep(night.stages[k]!)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {key && !error && synced}
      </Card>
    </div>
  );
}
