"use client";

import { Download, Send } from "lucide-react";
import { SaveStatus } from "@/components/plans/save-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { BlockHeading, PeriodHeading } from "@/components/plans/block-heading";
import { HyroxWeekCard } from "@/components/hyrox/hyrox-week-card";
import { hxSendable, useHxSend } from "@/components/hyrox/use-hx-send";
import { hxCsv } from "@/lib/hyrox";
import { liftWarnings } from "@/lib/lifting";
import { BAKKEN_HARD, DAYS, QUALITY } from "@/lib/settings";
import { LiftingTemplateCard } from "./lifting-template";
import { LiftingChart } from "./lifting-chart";

/** Lifting: weekly template, weekly volume, then the week-by-week schedule. Runs stay in the run plan. */
export function LiftingScreen() {
  const { hyrox, settings, calendar } = useApp();
  const { sendIcu, busy } = useHxSend();
  const runHard = settings.runMethod === "bakken"
    ? settings.bakkenTemplate.map((t) => BAKKEN_HARD.includes(t))
    : settings.template.map((t) => QUALITY.includes(t));
  const t = settings.lifting.template;
  const warns = liftWarnings(t, runHard, DAYS);
  if (!t.some((s) => s !== "off")) warns.unshift("Your template has no gym sessions. Pick at least one day.");
  const all = hyrox.weeks.flatMap(hxSendable);

  function csv() {
    const blob = new Blob([hxCsv(hyrox)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lifting-plan.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[2rem] leading-10 font-black md:text-display">Lifting</h1>
        <p className="max-w-[65ch] text-muted-foreground">
          {hyrox.weeks.length} weeks of a 4-day routine with one leg day: push, legs, pull and upper, at 16-18 hard sets per upper-body muscle a week. The first 6 weeks build up, then every 7th week is a deload. Running stays in your run plan, on the same dates.
        </p>
        <SaveStatus />
      </section>

      <LiftingTemplateCard />

      {warns.map((w) => <Alert key={w} variant="destructive"><AlertDescription>{w}</AlertDescription></Alert>)}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6">
        <h2 className="font-black">Weekly Volume</h2>
        <LiftingChart />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">Workout Schedule</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={csv}><Download aria-hidden /> CSV</Button>
            <Button variant="outline" size="sm" disabled={busy === "hx-all"} onClick={() => sendIcu("hx-all", all, "all weeks")}><Send aria-hidden /> All to icu</Button>
          </div>
        </div>
        {calendar.periods.map((p) => (
          <div key={p.i} className="flex flex-col gap-4">
            <PeriodHeading p={p} />
            {p.blocks.map((bi) => calendar.blocks[bi]).map((b) => (
              <div key={b.i} className="flex flex-col gap-4">
                <BlockHeading b={b} />
                {b.weeks.map((wi) => <HyroxWeekCard key={wi} wk={hyrox.weeks[wi]} />)}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
