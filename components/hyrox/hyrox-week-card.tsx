"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { fmtDuration, fmtShortDate } from "@/lib/format";
import { fmtVol, STATION, type HxWeek } from "@/lib/hyrox";
import { cn } from "@/lib/utils";
import { HyroxDayRow } from "./hyrox-day-row";
import { hxSendable, useHxSend } from "./use-hx-send";

const PHASE_DOT: Record<HxWeek["phaseKey"], string> = {
  base: "bg-phase-base", build: "bg-phase-build", peak: "bg-phase-peak", trial: "bg-phase-trial",
};

/** One HYROX week: header, grey week-total band, then the seven days. */
export function HyroxWeekCard({ wk }: { wk: HxWeek }) {
  const { settings } = useApp();
  const { sendIcu, busy } = useHxSend();
  const [open, setOpen] = useState(wk.n <= 1);
  const weak = wk.weak;
  const items = hxSendable(wk);

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className={cn("size-2 shrink-0 self-center rounded-full", PHASE_DOT[wk.phaseKey])} aria-hidden />
          <span className="font-black whitespace-nowrap">Week {wk.n}</span>
          <span className="font-extralight text-muted-foreground">{fmtShortDate(wk.weekStart)} · {wk.phase}{wk.light && wk.kind === "absorb" && !wk.program ? " · lighter" : ""}{wk.raceNames.length ? ` · ${wk.raceNames.join(", ")}` : ""}</span>
        </span>
      </button>
      {open && (
        <div className="border-t">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-muted px-4 py-2 md:px-6">
            <div className="min-w-0">
              <p className="text-meta uppercase text-muted-foreground">Week total</p>
              {"note" in wk && typeof wk.note === "string" && wk.note && <p className="font-extralight">{wk.note}</p>}
              <p className="num font-extralight text-muted-foreground">
                <span className="font-black text-foreground">~{fmtDuration(wk.totalMin * 60)}</span> · {wk.sessions} session{wk.sessions === 1 ? "" : "s"}
                {"totalSets" in wk && typeof wk.totalSets === "number" && <> · {wk.totalSets} sets</>}
                {weak.length > 0 && <> · {weak.map((st) => `${STATION[st].short} ${fmtVol(st, wk.vol[st] || 0)}`).join(" · ")}</>}
              </p>
            </div>
            <Button size="sm" variant="ghost" disabled={busy === `hx-week-${wk.n}` || !items.length} onClick={() => sendIcu(`hx-week-${wk.n}`, items, `week ${wk.n}`)}>
              <Send aria-hidden /> Week to icu
            </Button>
          </div>
          <div className="grid gap-0.5 bg-card">
            {wk.days.map((_, i) => (
              <HyroxDayRow key={i} wk={wk} i={i} busy={busy === `hx-${wk.n}-${i}`} onIcu={() => sendIcu(`hx-${wk.n}-${i}`, [{ wk, i }], `week ${wk.n}`)} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
