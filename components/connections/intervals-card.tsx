"use client";

import { CollapsibleCard } from "@/components/plans/collapsible-card";
import { useEffect, useState } from "react";
import { PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/components/app-provider";
import { icuCheck, icuKey, icuKeyRemembered, setIcuKey } from "@/lib/intervals";

/** intervals.icu API key, athlete ID and a connection check. */
export function IntervalsCard() {
  const { settings, update } = useApp();
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setKey(icuKey()); setRemember(icuKeyRemembered()); }, []);
  const saveKey = (k: string, r: boolean) => { setKey(k); setRemember(r); setIcuKey(k.trim(), r); };

  return (
    <CollapsibleCard storageKey="intervals" title="intervals.icu" icon={<PlugZap className="size-5 shrink-0" aria-hidden />}>
      <p className="max-w-[65ch] text-muted-foreground">Sends workouts to your intervals.icu calendar, which syncs to COROS, Garmin and other watches you&apos;ve connected there.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="icu-key" className="flex flex-wrap gap-x-2">API key <span className="font-extralight text-muted-foreground">Settings → Developer</span></Label>
          <Input id="icu-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => saveKey(e.target.value, remember)} placeholder="Paste your API key" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="icu-athlete" className="flex flex-wrap gap-x-2">Athlete ID <span className="font-extralight text-muted-foreground">optional</span></Label>
          <Input id="icu-athlete" autoComplete="off" spellCheck={false} value={settings.icuAthlete || ""} onChange={(e) => update({ icuAthlete: e.target.value.trim() })} placeholder="Your own account" />
        </div>
      </div>
      <label htmlFor="icu-remember" className="flex min-h-12 items-center gap-4">
        <Switch id="icu-remember" checked={remember} onCheckedChange={(v) => saveKey(key, v)} />
        <span>Remember key on this device</span>
      </label>
      <div>
        <Button variant="outline" disabled={busy} onClick={async () => {
          setBusy(true);
          try { const who = await icuCheck(settings.icuAthlete); toast.success(`Connected${who ? ` as ${who}` : ""}.`); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>Check connection</Button>
      </div>
      <p className="font-extralight text-muted-foreground">Your key is only sent to intervals.icu. Sending a day again replaces it instead of adding a duplicate.</p>
    </CollapsibleCard>
  );
}
