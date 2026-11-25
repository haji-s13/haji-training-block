"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { useApp } from "@/components/app-provider";
import { fmtDuration } from "@/lib/format";
import { MUSCLES, type LiftWeek } from "@/lib/lifting";
import { cn } from "@/lib/utils";
import { useChartWindow } from "@/components/plans/chart-window";

const config = {
  base: { label: "Intro", color: "var(--phase-base)" },
  build: { label: "Full sets", color: "var(--phase-build)" },
  peak: { label: "Add load", color: "var(--phase-peak)" },
  trial: { label: "Race week", color: "var(--phase-trial)" },
} satisfies ChartConfig;

function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

interface Row { label: string; value: number; wk: LiftWeek }

/** Hard sets per week by phase, then average weekly sets per muscle against the 16-18 target. */
export function LiftingChart() {
  const { hyrox } = useApp();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const win = useChartWindow(hyrox.weeks);
  const shown = hyrox.weeks.slice(win.start, win.end);
  const rows: Row[] = shown.map((wk) => ({ label: `W${wk.n}`, value: wk.totalSets, wk }));
  const showTrial = shown.some((w) => w.phaseKey === "trial");
  const lifting = shown.filter((w) => w.sessions > 0);
  const nL = Math.max(1, lifting.length);
  const avg = MUSCLES.map((m) => ({ m, v: lifting.reduce((t, w) => t + (w.sets[m.key] || 0), 0) / nL }));
  const maxV = Math.max(18, ...avg.map((a) => a.v));
  const totalMin = shown.reduce((t, w) => t + w.totalMin, 0);
  const totalSets = shown.reduce((t, w) => t + w.totalSets, 0);
  const nW = Math.max(1, shown.length);

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground" aria-label="Legend">
        {(["base", "build", "peak", ...(showTrial ? ["trial"] : [])] as (keyof typeof config)[]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: config[k].color }} aria-hidden />{config[k].label}
          </li>
        ))}
        <li className="flex items-center gap-2"><span className="hatch size-3 rounded-sm border border-muted-foreground" aria-hidden />Deload or race week</li>
      </ul>

      {win.controls}
      <ChartContainer config={config} className="aspect-auto h-56 w-full md:h-64">
        <BarChart data={rows} margin={{ top: 24, right: 8, left: -16, bottom: 0 }} accessibilityLayer>
          <defs>
            <pattern id="hatch-lift" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--card)" strokeWidth="2.5" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <YAxis tickLine={false} axisLine={false} width={40} className="num" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0}
            tickFormatter={(v: string, i: number) => (narrow ? String(rows[i]?.wk.n ?? i + 1) : v)} className="text-meta" />
          <ChartTooltip cursor={{ fill: "var(--accent)" }} content={({ active, payload }) => {
            const r = active && payload?.[0]?.payload as Row | undefined;
            if (!r) return null;
            return (
              <div className="rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
                <p className="font-black">Week {r.wk.n} · {r.wk.phase}</p>
                <p className="num">{r.wk.totalSets} sets · ~{fmtDuration(r.wk.totalMin * 60)} · {r.wk.sessions} sessions</p>
              </div>
            );
          }} />
          <Bar dataKey="value" isAnimationActive={false}
            shape={(props: unknown) => {
              const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: Row };
              if (!height || height <= 0) return <g />;
              const d = barPath(x, y, width, height);
              return (
                <g>
                  <path d={d} fill={`var(--phase-${payload.wk.phaseKey})`} />
                  {payload.wk.light && <path d={d} fill="url(#hatch-lift)" />}
                </g>
              );
            }}>
            <LabelList dataKey="value" position="top" className="num fill-foreground" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartContainer>

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-meta uppercase text-muted-foreground">Sets Per Muscle · Weekly Average</h3>
          <p className="text-meta text-muted-foreground">indirect work counts half · target 16-18</p>
        </div>
        <ul className="flex flex-col gap-2">
          {avg.map(({ m, v }) => {
            const inTarget = m.target && v >= m.target[0] - 0.5 && v <= m.target[1] + 0.5;
            return (
              <li key={m.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[180px_minmax(0,1fr)_120px]">
                <span className="min-w-0 truncate">{m.label}</span>
                <span className="num text-right text-muted-foreground md:order-3"><span className="text-foreground">{v.toFixed(1)}</span> sets</span>
                <span className="relative col-span-2 h-2 rounded-full bg-muted md:order-2 md:col-span-1" aria-hidden>
                  {m.target && <span className="absolute inset-y-0 rounded-full bg-primary/15" style={{ left: `${(m.target[0] / maxV) * 100}%`, width: `${((m.target[1] - m.target[0]) / maxV) * 100}%` }} />}
                  <span className={cn("relative block h-2 rounded-full", inTarget ? "bg-signal" : "bg-primary")} style={{ width: `${(v / maxV) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
        {[
          [`${shown.length}-week total`, fmtDuration(totalMin * 60)],
          ["Avg time / week", fmtDuration((totalMin * 60) / nW)],
          ["Sessions", String(shown.reduce((t, w) => t + w.sessions, 0))],
          ["Avg sets / week", String(Math.round(totalSets / nW))],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-meta uppercase text-muted-foreground">{k}</dt>
            <dd className="num text-[1.25rem] leading-8 font-black">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
