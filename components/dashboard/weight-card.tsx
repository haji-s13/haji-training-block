"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { addDays } from "@/lib/calendar";
import { isoDate, parseDate } from "@/lib/format";
import { icuKey, icuWellness } from "@/lib/intervals";
import { fmtWeight, fmtWeightChange, summarize, weighIns, type WeightSummary } from "@/lib/weight";

/** How often the card checks intervals.icu for a new weigh-in while the page is open. */
const POLL_MS = 5 * 60 * 1000;

function dayLabel(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const days = Math.round((parseDate(isoDate(new Date()))!.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Latest body weight from intervals.icu (where the Renpho scale's weigh-ins arrive), refreshed live. */
export function WeightCard() {
  const { settings } = useApp();
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null until the first check
  const [summary, setSummary] = useState<WeightSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Date | null>(null);

  const last = useRef(0);
  const seq = useRef(0); // only the newest request may update the card

  /** `auto` checks (timer, tab shown again) skip if one ran in the last 30 s; the button always checks. */
  const load = useCallback(async (auto = false) => {
    const key = !!icuKey();
    setHasKey(key);
    if (!key || (auto && Date.now() - last.current < 30000)) return;
    last.current = Date.now();
    const id = ++seq.current;
    setBusy(true);
    try {
      const now = new Date();
      // 44 days: the last 30, plus two weeks before for the averages.
      const rows = await icuWellness(settings.icuAthlete, isoDate(addDays(now, -44)), isoDate(now));
      if (id !== seq.current) return;
      setSummary(summarize(weighIns(rows)));
      setError("");
      setChecked(new Date());
    } catch (e) {
      if (id !== seq.current) return;
      setSummary(null);
      setError((e as Error).message);
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, [settings.icuAthlete]);

  useEffect(() => {
    load();
    const onShow = () => { if (document.visibilityState === "visible") load(true); };
    const timer = setInterval(onShow, POLL_MS);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { seq.current++; last.current = 0; clearInterval(timer); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, [load]);

  const u = settings.units;
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="size-5" aria-hidden />
          <h2 className="font-black">Weight</h2>
        </div>
        {hasKey && (
          <Button size="icon" variant="ghost" disabled={busy} onClick={() => load()} aria-label="Check for a new weigh-in">
            <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden />
          </Button>
        )}
      </div>

      {hasKey === null ? null : !hasKey ? (
        <p className="max-w-[65ch] text-muted-foreground">
          Add your intervals.icu API key under Connections on Profile. Weigh-ins from your Renpho scale show here once they reach intervals.icu.
        </p>
      ) : error ? (
        <p className="max-w-[65ch] text-muted-foreground">{error}</p>
      ) : !summary ? (
        <p className="max-w-[65ch] text-muted-foreground">
          {busy ? "Checking intervals.icu…" : "No weigh-ins in intervals.icu in the last 6 weeks. Check that your Renpho weight is syncing there."}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex flex-col">
            <span className="num font-display text-display">{fmtWeight(summary.latest.kg, u)}</span>
            <span className="text-meta uppercase text-muted-foreground">Weighed {dayLabel(summary.latest.date)}</span>
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
      {hasKey && checked && !error && (
        <p className="text-meta text-muted-foreground">
          Checked <span className="num">{checked.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span> · updates every 5 min
        </p>
      )}
    </section>
  );
}
