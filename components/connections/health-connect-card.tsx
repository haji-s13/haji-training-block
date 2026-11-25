"use client";

import { useState } from "react";
import { Copy, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { healthUrl, newHealthKey } from "@/lib/health";
import { useHealthKey } from "@/components/connections/use-health-key";
import { cn } from "@/lib/utils";

const HC_WEBHOOK = "https://play.google.com/store/apps/details?id=com.hcwebhook.app";

function CopyField({ id, label, value, secret }: { id: string; label: string; value: string; secret?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} readOnly value={value} type={secret ? "password" : "text"} className="num" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={async () => {
          try { await navigator.clipboard.writeText(value); toast.success(`${label} copied.`); } catch { toast.error("Couldn't copy. Select the text and copy it instead."); }
        }}><Copy aria-hidden /></Button>
      </div>
    </div>
  );
}

/** Google Health Connect: the phone sends weight (from Renpho) and sleep here through the HC Webhook app. */
export function HealthConnectCard() {
  const { key, setKey, ready } = useHealthKey();
  const [confirmNew, setConfirmNew] = useState(false);
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6">
      <div className="flex items-center gap-2">
        <HeartPulse className="size-5" aria-hidden />
        <h2 className="font-black">Google Health Connect</h2>
        <span className={cn("ml-auto text-meta uppercase", key ? "text-status-ok" : "text-muted-foreground")}>{key ? "Set up" : "Not set up"}</span>
      </div>
      <p className="max-w-[65ch] text-muted-foreground">
        Shows your weight (from your Renpho scale) and sleep on the Dashboard. Your phone sends them from Health Connect, so the Renpho app stays signed in.
      </p>

      {!key ? (
        <div><Button disabled={!ready} onClick={() => setKey(newHealthKey())}>Set up</Button></div>
      ) : (
        <>
          <ol className="flex max-w-[65ch] list-decimal flex-col gap-2 pl-5">
            <li>In the Renpho app, turn on Health Connect and allow it to write weight.</li>
            <li>Install <a className="underline" href={HC_WEBHOOK} target="_blank" rel="noreferrer">HC Webhook</a> from Google Play and allow it to read Weight and Sleep.</li>
            <li>In HC Webhook, add a webhook with the URL below, and a header named <span className="num font-black">X-Health-Key</span> with your key.</li>
            <li>Turn on Weight and Sleep, set sync to every 15 minutes, then tap Sync now.</li>
          </ol>
          <div className="grid gap-4">
            <CopyField id="hc-url" label="Webhook URL" value={healthUrl()} />
            <CopyField id="hc-key" label="Your key" value={key} secret />
          </div>
          <div>
            {confirmNew ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" onClick={() => { setKey(newHealthKey()); setConfirmNew(false); }}>Replace key</Button>
                <Button variant="ghost" onClick={() => setConfirmNew(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirmNew(true)}>Make a new key</Button>
            )}
          </div>
          <p className="font-extralight text-muted-foreground">Keep the key private: anyone with it can see your weight and sleep. A new key stops the old one; paste the new one into HC Webhook. Data from the old key isn&apos;t carried over.</p>
        </>
      )}

    </section>
  );
}
