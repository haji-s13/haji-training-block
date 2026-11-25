"use client";

import { Fragment } from "react";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { dist, fmtShortDate } from "@/lib/format";
import { dayKm } from "@/lib/plan";
import { hxDayDate, hxDayText, numChanges, numParts, STATION, type HxDayType, type HxWeek } from "@/lib/hyrox";
import { DAYS } from "@/lib/settings";
import { copyText } from "@/lib/workout-text";
import { cn } from "@/lib/utils";
import { prettyBlock, type HxPretty } from "@/lib/hx-format";
import type { HxBlock } from "@/lib/hyrox";

/** Same tints as the run plan: easy green for aerobic, blue for strength, orange for quality, red for tests and races. */
export const HX_CARD: Record<HxDayType, string> = {
  off: "bg-session-rest", rest: "bg-session-rest", vacation: "bg-muted",
  aerobic: "bg-session-easy",
  lower: "bg-session-long", upper: "bg-session-long",
  quality: "bg-session-subt", quality_short: "bg-session-subt",
  test: "bg-session-race", race: "bg-session-race",
};
const HX_INK: Record<HxDayType, string> = {
  off: "text-session-rest-ink", rest: "text-session-rest-ink", vacation: "text-muted-foreground",
  aerobic: "text-session-easy-ink",
  lower: "text-session-long-ink", upper: "text-session-long-ink",
  quality: "text-session-subt-ink", quality_short: "text-session-subt-ink",
  test: "text-session-race-ink", race: "text-session-race-ink",
};

/** One day: when, what (block by block), how long, the linked run, and actions. */
export function HyroxDayRow({ wk, i, onIcu, busy, hideRun = false }: { wk: HxWeek; i: number; onIcu: () => void; busy: boolean; hideRun?: boolean }) {
  const { plan, settings } = useApp();
  const d = wk.days[i];
  const run = plan?.weeks[wk.n - 1]?.days[i];
  const runLine = !hideRun && run && run.type !== "rest" && run.km > 0 ? `${run.type === "easy" ? (run.strides ? "Easy + strides" : "Easy") : run.title} ${dist(dayKm(run), settings.units)}` : null;
  const empty = d.type === "off" || !d.blocks.length;

  async function copy() {
    const ok = await copyText(hxDayText(wk, d));
    if (ok) toast.success("Copied. Paste it into your Strava description.");
    else toast.error("Couldn't copy. Select the text and copy it manually.");
  }

  return (
    <div className={cn("grid min-w-0 gap-2 p-4 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-start md:gap-6 md:px-6", HX_CARD[d.type])}>
      <div className="flex items-center justify-between gap-2 md:flex-col md:items-start">
        <p className="text-meta uppercase text-muted-foreground">
          {DAYS[i]} <span className="font-extralight normal-case tracking-normal">{fmtShortDate(hxDayDate(wk, i))}</span>
        </p>
        <span className={cn("rounded-full bg-card px-2 text-meta uppercase", HX_INK[d.type])}>{d.type === "vacation" ? "Vacation" : empty ? (wk.program ? "No gym" : "No stations") : d.title}</span>
      </div>
      {empty ? (
        <p className="text-muted-foreground md:col-span-2">{d.type === "vacation" ? "Time off. Enjoy it." : runLine ? <>Run plan: <span className="text-foreground">{runLine}</span></> : run?.off === "hyrox" && !wk.program ? "HYROX race day" : hideRun ? (wk.program ? "No gym session today" : "No station session today") : "Rest or run plan only"}</p>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-1">
            {d.blocks.filter((b) => b.label === "Warm-up").map((b, k) => (
              <p key={k} className="font-extralight text-muted-foreground">Warm-up · {b.text}</p>
            ))}
            <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-md border bg-card">
              {d.blocks.filter((b) => b.label !== "Warm-up").map((b, k) => <BlockView key={k} b={b} pct={wk.weakPct ?? 25} />)}
            </ol>
            <p className="num text-muted-foreground">{d.type === "race" ? "Race day" : `~${Math.round(d.min)} min`}</p>
            {runLine && <p className="text-meta uppercase text-muted-foreground">Run plan <span className="font-extralight normal-case tracking-normal text-foreground">{runLine}</span></p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy} aria-label={`Copy week ${wk.n} ${DAYS[i]} session`}><Copy aria-hidden /> Copy</Button>
            {d.type !== "rest" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={onIcu} aria-label="Send to intervals.icu"><Send aria-hidden /> icu</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Keep "30 s", "20 m", "× 10" together when lines wrap. */
const keepUnits = (s: string) => s.replace(/(\d)\s(?=(s|m|kg|lb|min|km|cal|reps|%)\b)/g, "$1\u00a0").replace(/×\s/g, "×\u00a0");

/** `now` with each number a weakness changed in bold signal, then the old value struck through.
 *  Plain text when there is no baseline or the two don't line up number for number. */
function Changed({ now, was }: { now: string; was?: string }) {
  if (was === undefined || was === now) return <>{now}</>;
  const a = numParts(was), b = numParts(now);
  if (a.length !== b.length) return <>{now}</>;
  return (
    <>
      {b.map((part, i) => (i % 2 && part !== a[i] ? (
        <Fragment key={i}>
          <span className="font-black tabular-nums text-signal">{part}</span>
          <s className="ml-0.5 text-meta font-extralight tabular-nums text-muted-foreground" aria-label={`was ${a[i]}`}>{a[i]}</s>
        </Fragment>
      ) : part))}
    </>
  );
}

/** The baseline formatted the same way, if it has the same shape (lines, steps, cues) as the block. */
function sameShape(p: HxPretty, q: HxPretty | null): HxPretty | null {
  if (!q || q.lines.length !== p.lines.length || q.notes.length !== p.notes.length) return null;
  return q.lines.every((l, i) => l.items.length === p.lines[i].items.length && !l.head === !p.lines[i].head) ? q : null;
}

/** One block: letter badge (A, B, C) or a tag (Weak, Accessory, Main), the work as a heading
 *  and a list of steps, then the coach's cues in small type. A block scaled up for weak
 *  stations keeps its badge and gets a "Weak · Lunges +25%" line, and each number it changed shows the old value. */
function BlockView({ b, pct }: { b: HxBlock; pct: number }) {
  const p = prettyBlock(keepUnits(b.text));
  const w = sameShape(p, b.was ? prettyBlock(keepUnits(b.was)) : null);
  const changes = b.was ? numChanges(b.was, b.text) : null;
  const one = changes?.length === 1 ? ` · ${changes[0][0]} → ${changes[0][1]}` : "";
  const letter = /^[A-Z]$/.test(b.label);
  const station = b.label.split("· ")[1];
  const tag = b.weak ? `Weak station · ${station}` : b.acc ? `Accessory · ${station}` : letter || b.label === "Main" ? null : b.label;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 p-3">
      <span className={cn("flex size-7 items-center justify-center rounded-md text-meta font-black",
        b.weak ? "bg-signal text-signal-foreground" : b.acc ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")} aria-hidden>
        {letter ? b.label : b.weak ? "W" : b.acc ? "+" : b.label === "Main" ? "•" : b.label[0]}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        {tag && <p className={cn("text-meta uppercase", b.weak ? "text-signal" : "text-muted-foreground")}>{tag}</p>}
        {!b.weak && b.boost?.length ? <p className="text-meta uppercase text-signal">Weak · {b.boost.map((st) => STATION[st].short).join(" · ")} +{pct}%{one}</p> : null}
        {p.lines.map((l, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {l.head && <p className="font-black break-words"><Changed now={l.head} was={w?.lines[i].head} /></p>}
            {l.items.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {l.items.map((it, j) => (
                  <li key={j} className="grid grid-cols-[12px_minmax(0,1fr)] items-baseline gap-x-1 break-words">
                    <span className={cn("size-1.5 translate-y-[-2px] rounded-full", b.weak ? "bg-signal" : "bg-muted-foreground")} aria-hidden /><span><Changed now={it} was={w?.lines[i].items[j]} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {p.notes.length > 0 && <p className="font-extralight text-muted-foreground"><Changed now={p.notes.join(". ")} was={w?.notes.join(". ")} />.</p>}
      </div>
    </li>
  );
}
