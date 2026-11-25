"use client";

import { SaveStatus } from "@/components/plans/save-status";
import { Download, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { BlockHeading, PeriodHeading } from "@/components/plans/block-heading";
import { hxCsv, linkWarnings, type HxSlot } from "@/lib/hyrox";
import { BAKKEN_HARD, DAYS, QUALITY, type BakkenSlot } from "@/lib/settings";
import { HyroxSettingsCard } from "./hyrox-settings";
import { WeakStations } from "./weak-stations";
import { HyroxTemplateCard } from "./hyrox-template";
import { HyroxChart } from "./hyrox-chart";
import { HyroxWeekCard } from "./hyrox-week-card";
import { hxSendable, useHxSend } from "./use-hx-send";

/** HYROX station program: settings, weak stations, template, chart, then the weeks. Runs stay in the run plan. */
export function HyroxScreen() {
  const { hyrox, settings, calendar, plan } = useApp();
  const { sendIcu, busy } = useHxSend();
  const h = settings.hyrox;
  const runHard = settings.runMethod === "bakken" ? settings.bakkenTemplate.map((t) => (BAKKEN_HARD.includes(t) ? "short" : "easy")) : settings.template;
  // Norwegian Method: sessions move week to week around the doubles, so check the built weeks.
  const warns = settings.runMethod === "bakken" && plan
    ? [...new Set(hyrox.weeks.flatMap((wk, w) => {
        const run = plan.weeks[w]?.days.map((d) => (BAKKEN_HARD.includes(d.type as BakkenSlot) ? "short" : "easy"));
        return run ? linkWarnings(wk.days.map((d) => d.type as HxSlot), run, QUALITY, DAYS) : [];
      }))]
    : linkWarnings(h.template, runHard, QUALITY, DAYS);
  if (!h.template.some((s) => s !== "off")) warns.unshift("Your template has no station sessions. Pick at least one day.");
  const all = hyrox.weeks.flatMap(hxSendable);

  function csv() {
    const blob = new Blob([hxCsv(hyrox)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hyrox-plan.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[2rem] leading-10 font-black md:text-display">HYROX Stations</h1>
        <p className="max-w-[65ch] text-muted-foreground">
          {hyrox.weeks.length} weeks of station and strength work in 12-week periods of three blocks: strength, station build, then race specific, with absorb weeks and a taper before each race. Running stays in your run plan, on the same dates. Set dates, races and time off on Profile.
        </p>
        <SaveStatus />
      </section>

      <HyroxSettingsCard />
      <WeakStations />
      <HyroxTemplateCard />

      {warns.map((w) => <Alert key={w} variant="destructive"><AlertDescription>{w}</AlertDescription></Alert>)}

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6">
        <h2 className="font-black">Weekly Volume</h2>
        <HyroxChart />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-black">Weeks</h2>
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
