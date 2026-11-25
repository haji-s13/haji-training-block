"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { TestPrompt } from "@/components/plans/test-prompt";
import { DayCell } from "@/components/builder/day-cell";
import { HyroxDayRow } from "@/components/hyrox/hyrox-day-row";
import { useHxSend } from "@/components/hyrox/use-hx-send";
import { addDays, mondayOf } from "@/lib/calendar";
import { dist, fmtDuration, isoDate, parseDate } from "@/lib/format";
import { dayKm, daySec } from "@/lib/plan";
import { cn } from "@/lib/utils";

const VIEWS = [1, 3, 7] as const;
type View = (typeof VIEWS)[number];
const VIEW_KEY = "htb-dash-view";

const RUN_DOT: Record<string, string> = {
  easy: "bg-session-easy-ink", longrun: "bg-session-long-ink", race: "bg-session-race-ink",
  short: "bg-session-subt-ink", medium: "bg-session-subt-ink", long: "bg-session-subt-ink", hills: "bg-session-subt-ink",
  double: "bg-session-subt-ink", single: "bg-session-subt-ink", x: "bg-session-long-ink",
};
const HX_DOT: Record<string, string> = {
  aerobic: "bg-session-easy-ink", lower: "bg-session-long-ink", upper: "bg-session-long-ink",
  quality: "bg-session-subt-ink", quality_short: "bg-session-subt-ink", test: "bg-session-race-ink", race: "bg-session-race-ink",
};

const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const sameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b);

/** Pick a day, see that day's run and lifting session (or the next 3 or 7 days). */
export function DashboardScreen() {
  const { plan, hyrox, calendar, settings } = useApp();
  const { sendIcu, busy } = useHxSend();
  const start = calendar.weeks[0].start;
  const planEnd = addDays(calendar.weeks[calendar.weeks.length - 1].start, 6);
  const [view, setView] = useState<View>(1);
  const [sel, setSel] = useState(() => isoDate(today()));
  useEffect(() => {
    try { const v = Number(localStorage.getItem(VIEW_KEY)); if (VIEWS.includes(v as View)) setView(v as View); } catch { /* ignore */ }
  }, []);
  const pickView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, String(v)); } catch { /* ignore */ } };

  const selDate = parseDate(sel) || today();
  const stripStart = mondayOf(selDate);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));
  const shown = useMemo(() => Array.from({ length: view }, (_, i) => addDays(parseDate(sel) || today(), i)), [sel, view]);

  /** Week index and day index of a date in the plan, or null outside it. */
  const locate = (d: Date) => {
    const n = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (n < 0 || n >= calendar.weeks.length * 7) return null;
    return { w: Math.floor(n / 7), i: n % 7 };
  };

  const totals = shown.reduce((t, d) => {
    const at = locate(d);
    if (!at) return t;
    const run = plan?.weeks[at.w]?.days[at.i];
    const hx = hyrox.weeks[at.w]?.days[at.i];
    return { km: t.km + (run ? dayKm(run) : 0), runSec: t.runSec + (run ? daySec(run) : 0), hxMin: t.hxMin + (hx && hx.type !== "race" ? hx.min : 0) };
  }, { km: 0, runSec: 0, hxMin: 0 });

  const isToday = sameDay(selDate, today());
  const label = view === 1
    ? (isToday ? "Today" : selDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))
    : `${selDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${shown[shown.length - 1].toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  const atSel = locate(selDate);

  return (
    <div className="flex flex-col gap-8">
      <TestPrompt />
      <section className="flex flex-col gap-2">
        <p className="text-meta uppercase text-signal">
          {atSel ? `Week ${atSel.w + 1} · Period ${calendar.weeks[atSel.w].period + 1} · Block ${calendar.weeks[atSel.w].blockInPeriod + 1}` : selDate < start ? "Before your plan starts" : "After your plan ends"}
        </p>
        <h1 className="font-display text-[2rem] leading-10 font-black md:text-display">{label}</h1>
        <p className="num text-muted-foreground">
          Run <span className="font-black text-foreground">{dist(totals.km, settings.units)}</span> · ~{fmtDuration(totals.runSec)} · Lifting <span className="font-black text-foreground">~{fmtDuration(totals.hxMin * 60)}</span>
        </p>
      </section>

      {/* View length and day picker. */}
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Days to show">
            {VIEWS.map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => pickView(v)}
                className={cn("h-10 min-w-16 rounded-md px-3 md:h-8", view === v ? "bg-card font-black text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {v} day{v > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          {!isToday && <Button size="sm" variant="outline" onClick={() => setSel(isoDate(today()))}>Today</Button>}
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setSel(isoDate(addDays(selDate, -7)))} aria-label="Previous week"><ChevronLeft aria-hidden /></Button>
          <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
            {strip.map((d) => {
              const at = locate(d);
              const run = at && plan?.weeks[at.w]?.days[at.i];
              const hx = at && hyrox.weeks[at.w]?.days[at.i];
              const inView = shown.some((x) => sameDay(x, d));
              const selected = sameDay(d, selDate);
              const race = at && calendar.weeks[at.w].races.some((r) => r.day === at.i);
              const off = at && calendar.weeks[at.w].off[at.i];
              return (
                <button key={isoDate(d)} type="button" onClick={() => setSel(isoDate(d))} aria-pressed={selected}
                  aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                  className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-0 py-2 focus-visible:outline-2 focus-visible:outline-ring",
                    selected ? "border-signal bg-signal text-signal-foreground" : inView ? "border-signal bg-signal-soft" : "hover:bg-accent/60",
                    !at && "opacity-40")}>
                  <span className={cn("text-meta uppercase", selected ? "" : "text-muted-foreground")}>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                  <span className={cn("num leading-5 font-black", sameDay(d, today()) && !selected && "text-signal")}>{d.getDate()}</span>
                  <span className="flex h-2 items-center gap-0.5" aria-hidden>
                    {race ? <Flag className="size-3" /> : off ? <Palmtree className="size-3" /> : <>
                      {run && run.km > 0 && <span className={cn("size-1.5 rounded-full", selected ? "bg-signal-foreground" : RUN_DOT[run.type])} />}
                      {hx && HX_DOT[hx.type] && hx.blocks.length > 0 && <span className={cn("size-1.5 rounded-sm", selected ? "bg-signal-foreground" : HX_DOT[hx.type])} />}
                    </>}
                  </span>
                </button>
              );
            })}
          </div>
          <Button size="icon" variant="ghost" onClick={() => setSel(isoDate(addDays(selDate, 7)))} aria-label="Next week"><ChevronRight aria-hidden /></Button>
        </div>
        <p className="text-meta text-muted-foreground">
          <span className="mr-1 inline-block size-1.5 rounded-full bg-muted-foreground align-middle" aria-hidden /> run
          <span className="mr-1 ml-4 inline-block size-1.5 rounded-sm bg-muted-foreground align-middle" aria-hidden /> Lifting
          <span className="ml-4">Plan {start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – {planEnd.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
        </p>
      </section>

      <section className="flex flex-col gap-6">
        {shown.map((d) => {
          const at = locate(d);
          const wk = at && plan?.weeks[at.w];
          const hw = at && hyrox.weeks[at.w];
          return (
            <article key={isoDate(d)} className="overflow-hidden rounded-lg border bg-card">
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 bg-muted px-4 py-2 md:px-6">
                <h2 className="font-black">
                  {sameDay(d, today()) ? "Today · " : ""}{d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                </h2>
                {at && <span className="text-meta uppercase text-muted-foreground">Week {at.w + 1} · {(wk || hw)?.phase}</span>}
              </header>
              {!at ? (
                <p className="p-4 text-muted-foreground md:px-6">Outside your plan dates. Change them on Profile.</p>
              ) : (
                <div className="grid gap-0.5">
                  <p className="px-4 pt-4 text-meta uppercase text-muted-foreground md:px-6">Run</p>
                  {wk ? <DayCell wk={wk} i={at.i} /> : <p className="px-4 pb-4 text-muted-foreground md:px-6">Enter your PB on Profile to see runs.</p>}
                  <p className="px-4 pt-4 text-meta uppercase text-muted-foreground md:px-6">Lifting</p>
                  {hw && <HyroxDayRow hideRun wk={hw} i={at.i} busy={busy === `dash-${at.w}-${at.i}`} onIcu={() => sendIcu(`dash-${at.w}-${at.i}`, [{ wk: hw, i: at.i }], `week ${hw.n}`)} />}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
