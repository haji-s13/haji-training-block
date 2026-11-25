"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleCard } from "@/components/plans/collapsible-card";
import { useApp } from "@/components/app-provider";
import { addDays } from "@/lib/calendar";
import { fmtShortDate } from "@/lib/format";
import { buildModel } from "@/lib/vdot";
import { cn } from "@/lib/utils";

/** One 5k time trial per finished period; the next period's paces use it. */
export function PaceTestsCard() {
  const { settings, update, calendar, currentPeriod, testWeeks } = useApp();
  const periods = calendar.periods;
  const setTest = (period: number, time: string) =>
    update((cur) => {
      const rest = (cur.paceTests || []).filter((t) => t.period !== period);
      return { paceTests: time.trim() ? [...rest, { period, time }] : rest };
    });

  return (
    <CollapsibleCard id="pace-tests" storageKey="pace-tests" title="5k Tests">
        {periods.length < 2 ? (
          <p className="max-w-[65ch] text-muted-foreground">
            Your season is one 12-week period. Add a later end date in Season to get a 5k test at the end of each period.
          </p>
        ) : (
          <>
            <p className="max-w-[65ch] text-muted-foreground">
              At the end of each 12-week period, run the 5k test in your plan and enter the time. The next period&apos;s paces use it.
            </p>
            <ul className="divide-y">
              {periods.slice(0, -1).map((p) => {
                const lastWeek = calendar.weeks[p.weeks[p.weeks.length - 1]];
                const entry = (settings.paceTests || []).find((t) => t.period === p.i);
                const value = entry?.time ?? "";
                const m = value.trim() ? buildModel("5000", value, settings.paceAdjust) : null;
                const invalid = value.trim() !== "" && buildModel("5000", value, 0) === null;
                const scheduled = !!testWeeks[p.i];
                const future = p.i >= currentPeriod;
                return (
                  <li key={p.i} className={cn("grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center sm:gap-x-8", future && !value && "text-muted-foreground")}>
                    <div className="min-w-0">
                      <Label htmlFor={`pace-test-${p.i}`} className="font-black">After Period {p.i + 1}</Label>
                      <p className="num text-muted-foreground">{fmtShortDate(lastWeek.start)} – {fmtShortDate(addDays(lastWeek.start, 6))}</p>
                      <p className="font-extralight text-muted-foreground">
                        Sets Period {p.i + 2} paces{m ? <> · <span className="num font-black text-signal">VDOT {m.vdot.toFixed(1)}</span></> : null}
                      </p>
                      {!scheduled && <p className="font-extralight text-muted-foreground">No 5k test this period (race, taper or time off in week 12)</p>}
                      {invalid && <p className="font-extralight text-destructive">Enter a 5k time like 19:45</p>}
                    </div>
                    <Input id={`pace-test-${p.i}`} className="num" type="text" inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                      enterKeyHint="done" value={value} placeholder="19:45" aria-invalid={invalid}
                      onChange={(e) => setTest(p.i, e.target.value)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
    </CollapsibleCard>
  );
}
