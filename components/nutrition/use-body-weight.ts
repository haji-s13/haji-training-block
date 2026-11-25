"use client";

import { useApp } from "@/components/app-provider";
import { useHealthKey } from "@/components/connections/use-health-key";
import { useHealth } from "@/components/dashboard/use-health";
import { lbToKg } from "@/lib/nutrition";
import { dailyWeighIns, summarize } from "@/lib/weight";

/** The weight the Fuel targets use: Health Connect's 7-day average, else the weight typed on Profile. */
export function useBodyWeight() {
  const { settings } = useApp();
  const { key } = useHealthKey();
  const health = useHealth(key || undefined);
  const synced = health.data ? summarize(dailyWeighIns(health.data.weight)) : null;
  const manualKg = settings.nutrition.weightLb ? lbToKg(settings.nutrition.weightLb) : null;
  const kg = synced?.avg7 ?? manualKg;
  return {
    kg,
    source: synced ? ("health" as const) : manualKg ? ("manual" as const) : null,
    synced,
    connected: !!key,
    busy: health.busy,
    error: health.error,
    reload: health.reload,
    lastSync: health.data?.lastSync ?? null,
  };
}
