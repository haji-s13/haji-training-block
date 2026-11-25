"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { isoDate } from "@/lib/format";
import { hxDayDate, hxDayText, type HxWeek } from "@/lib/hyrox";
import { icuPush, type IcuEvent } from "@/lib/intervals";

/** HYROX sessions go to intervals.icu as strength workouts. Their IDs differ from the run plan's, so runs on the same date stay. */
export function hxIcuEvent(wk: HxWeek, i: number): IcuEvent {
  const d = wk.days[i];
  const day = isoDate(hxDayDate(wk, i));
  return {
    category: "WORKOUT", type: "WeightTraining", start_date_local: `${day}T00:00:00`, name: `HYROX · ${d.title}`,
    description: hxDayText(wk, d), external_id: `htb-hx-${day}`, moving_time: Math.round(d.min * 60),
  };
}

export function useHxSend() {
  const { settings } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const sendIcu = useCallback(async (key: string, items: { wk: HxWeek; i: number }[], label: string) => {
    if (!items.length) return;
    setBusy(key);
    try {
      const n = await icuPush(settings.icuAthlete, items.map(({ wk, i }) => hxIcuEvent(wk, i)));
      toast.success(`Sent ${n} HYROX session${n === 1 ? "" : "s"} (${label}) to intervals.icu.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [settings.icuAthlete]);
  return { sendIcu, busy };
}

/** Days worth sending: station sessions, tests and the race. */
export const hxSendable = (wk: HxWeek) => wk.days.map((d, i) => ({ wk, i, d })).filter(({ d }) => d.type !== "off" && d.type !== "rest" && d.blocks.length).map(({ wk, i }) => ({ wk, i }));
