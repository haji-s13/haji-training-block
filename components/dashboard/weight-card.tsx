"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { isoDate, parseDate } from "@/lib/format";
import { renphoSession, renphoWeights, setRenphoSession, renphoRemembered } from "@/lib/renpho";
import { dailyWeighIns, fmtWeight, fmtWeightChange, summarize, type WeightSummary } from "@/lib/weight";

/** How often the card checks Renpho for a new weigh-in while the page is open. */
const POLL_MS = 5 * 60 * 1000;

function whenLabel(iso: string, ts?: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const days = Math.round((parseDate(isoDate(new Date()))!.getTime() - d.getTime()) / 86400000);
  const day = days === 0 ? "today" : days === 1 ? "yesterday" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return ts && days <= 1 ? `${day} ${new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
}

/** Latest body weight from the Renpho scale, refreshed live. */
export function WeightCard() {
  const { settings } = useApp();
  const [connected, setConnected] = useState<boolean | null>(null); // null until the first check
  const [summary, setSummary] = useState<WeightSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Date | null>(null);
  const last = useRef(0);
  const seq = useRef(0); // only the newest request may update the card

  /** `auto` checks (timer, tab shown again) skip if one ran in the last 60 s; the button always checks. */
  const load = useCallback(async (auto = false) => {
    const s = renphoSession();
    setConnected(!!s);
    if (!s || (auto && Date.now() - last.current < 60000)) return;
    last.current = Date.now();
    const id = ++seq.current;
    setBusy(true);
    try {
      const list = await renphoWeights(s);
      if (id !== seq.current) return;
      setSummary(summarize(dailyWeighIns(list)));
      setError("");
      setChecked(new Date());
    } catch (e) {
      if (id !== seq.current) return;
      if ((e as { status?: number }).status === 401) { setRenphoSession(null, renphoRemembered()); setConnected(false); }
      setSummary(null);
      setError((e as Error).message);
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onShow = () => { if (document.visibilityState === "visible") load(true); };
    const timer = setInterval(onShow, POLL_MS);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { seq.current++; last.current = 0; clearInterval(timer); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, [load]);

  const u = settings.weightUnit || "lb";
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="size-5" aria-hidden />
          <h2 className="font-black">Weight</h2>
        </div>
        {connected && (
          <Button size="icon" variant="ghost" disabled={busy} onClick={() => load()} aria-label="Check for a new weigh-in">
            <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden />
          </Button>
        )}
      </div>

      {connected === null ? null : error ? (
        <p className="max-w-[65ch] text-muted-foreground">{error}</p>
      ) : !connected ? (
        <p className="max-w-[65ch] text-muted-foreground">Sign in to Renpho under Connections on Profile to see your weight here.</p>
      ) : !summary ? (
        <p className="max-w-[65ch] text-muted-foreground">{busy ? "Checking Renpho…" : "No weigh-ins found in your Renpho account yet."}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex flex-col">
            <span className="num font-display text-display">{fmtWeight(summary.latest.kg, u)}</span>
            <span className="text-meta uppercase text-muted-foreground">Weighed {whenLabel(summary.latest.date, summary.latest.ts)}</span>
          </div>
          <div className="flex flex-col">
            <span className="num font-black">{fmtWeight(summary.avg7, u)}</span>
            <span className="text-meta uppercase text-muted-foreground">7-day average</span>
          </div>
          {summary.weekChange !== null && (
            <div className="flex flex-col">
              <span className="num font-black">{fmtWeightChange(summary.weekChange, u)}</span>
              <span className="text-meta uppercase text-muted-foreground">vs previous 7 days</span>
            </div>
          )}
        </div>
      )}
      {connected && checked && !error && (
        <p className="text-meta text-muted-foreground">
          From Renpho · checked <span className="num">{checked.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span> · updates every 5 min
        </p>
      )}
    </section>
  );
}
