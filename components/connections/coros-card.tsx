"use client";

import { CollapsibleCard } from "@/components/plans/collapsible-card";
import { useState } from "react";
import { Link2, Unlink, Watch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { corosConnect, corosDisconnect } from "@/lib/coros";

/** Connect COROS directly (hosted site) or via the Claude NSM connector (claude.ai). */
export function CorosCard() {
  const { coros, refreshCoros } = useApp();
  const [busy, setBusy] = useState(false);
  const connected = !!coros.client;
  return (
    <CollapsibleCard storageKey="coros" title="COROS" icon={<Watch className="size-5 shrink-0" aria-hidden />}
      status={<span className={connected ? "text-meta uppercase text-status-ok" : "text-meta uppercase text-muted-foreground"}>{connected ? "Connected" : "Not connected"}</span>}>
      <p className="max-w-[65ch] text-muted-foreground">
        {coros.source === "connector"
          ? "Using your Claude NSM connector on claude.ai."
          : "Send structured workouts with pace ranges straight to your COROS training schedule."}
      </p>
      {coros.source !== "connector" && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            try { await corosConnect(); } catch (e) { toast.error((e as Error).message || "Couldn't start COROS sign-in."); setBusy(false); }
          }}>
            <Link2 aria-hidden /> {connected ? "Reconnect COROS" : "Connect COROS"}
          </Button>
          {connected && (
            <Button variant="outline" onClick={() => { corosDisconnect(); refreshCoros(); toast("Disconnected from COROS on this device."); }}>
              <Unlink aria-hidden /> Disconnect
            </Button>
          )}
        </div>
      )}
      <ul className="flex max-w-[65ch] list-disc flex-col gap-0 pl-6 font-extralight text-muted-foreground">
        <li>Then use COROS on a day, a week, or All to COROS on the plan.</li>
        <li>COROS accepts workouts from today up to 90 days ahead.</li>
        <li>Sending a day again adds a second copy, so delete the old one in the COROS app first.</li>
        <li>Your COROS sign-in stays in this browser only.</li>
      </ul>
    </CollapsibleCard>
  );
}
