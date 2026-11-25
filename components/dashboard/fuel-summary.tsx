"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useBodyWeight } from "@/components/nutrition/use-body-weight";
import { useFoodLogs } from "@/components/nutrition/use-food-logs";
import { openFuelOn } from "@/components/nutrition/fuel-screen";
import { isoDate } from "@/lib/format";
import { fuelDay } from "@/lib/fuel-day";
import { GEARS, kcalOf } from "@/lib/nutrition";

const MACROS = [
  { k: "carbs", label: "Carbs", color: "var(--phase-trial)" },
  { k: "protein", label: "Protein", color: "var(--phase-base)" },
  { k: "fat", label: "Fat", color: "var(--phase-peak)" },
] as const;
const n = (x: number) => Math.round(x).toLocaleString("en-US");

/** Compact Fuel summary for one day: calories and macros needed against what was eaten. Opens the Fuel tab. */
export function FuelSummary({ date }: { date: Date }) {
  const { plan, hyrox, calendar, settings, setScreen } = useApp();
  const { kg } = useBodyWeight();
  const iso = isoDate(date);
  const food = useFoodLogs(iso, iso);
  const day = useMemo(() => fuelDay(date, calendar, plan, hyrox, kg, settings.nutrition), [date, calendar, plan, hyrox, kg, settings.nutrition]);
  const log = food.logs[iso];
  const t = day.targets;
  const eaten = log ? kcalOf(log.carbs, log.protein, log.fat) : null;

  return (
    <button type="button" onClick={() => { openFuelOn(iso); setScreen("fuel"); }} aria-label={log ? "Open Fuel" : "Open Fuel to log what you ate"}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-meta uppercase text-muted-foreground">Fuel · {GEARS[day.gear].label}{t && !log ? " · Target" : ""}</span>
        {t ? (
          <span className="num flex items-center gap-1">
            <span>
              {eaten !== null && <><span className="font-black">{n(eaten)}</span><span className="text-muted-foreground">/</span></>}
              <span className={eaten === null ? "font-black" : "text-muted-foreground"}>{n(t.kcal)} kcal</span>
            </span>
            <ChevronRight className="size-4 self-center text-muted-foreground" aria-hidden />
          </span>
        ) : <ChevronRight className="size-4 self-center text-muted-foreground" aria-hidden />}
      </span>
      {t ? (
        <span className="grid grid-cols-3 gap-4">
          {MACROS.map((m) => {
            const got = log ? log[m.k] : 0;
            const need = t[m.k];
            return (
              <span key={m.k} className="flex min-w-0 flex-col gap-1">
                <span className="text-meta uppercase text-muted-foreground">{m.label}</span>
                <span className="num truncate">
                  {log ? <><span className="font-black">{n(got)}</span><span className="text-muted-foreground">/{n(need)} g</span></>
                    : <span className="font-black">{n(need)} g</span>}
                </span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${need > 0 ? Math.min(100, (got / need) * 100) : 0}%`, background: m.color }} />
                </span>
              </span>
            );
          })}
        </span>
      ) : (
        <span className="text-muted-foreground">Add your weight on Profile to see what to eat.</span>
      )}
    </button>
  );
}
