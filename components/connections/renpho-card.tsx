"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app-provider";
import { renphoLogin, renphoRemembered, renphoSession, setRenphoSession, type RenphoSession } from "@/lib/renpho";
import { cn } from "@/lib/utils";

const AREAS: [string, string][] = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["IE", "Ireland"], ["AU", "Australia"], ["NZ", "New Zealand"],
  ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["ES", "Spain"], ["IT", "Italy"], ["SE", "Sweden"], ["NO", "Norway"],
  ["DK", "Denmark"], ["FI", "Finland"], ["JP", "Japan"], ["SG", "Singapore"], ["AE", "UAE"], ["IN", "India"], ["MX", "Mexico"], ["BR", "Brazil"],
];

/** Renpho scale sign-in: the password goes to Renpho once and only the session token is kept. */
export function RenphoCard() {
  const { settings, update } = useApp();
  const [session, setSession] = useState<RenphoSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const s = renphoSession(); setSession(s); if (s) { setEmail(s.email); setRemember(renphoRemembered()); } }, []);
  const unit = settings.weightUnit || "lb";

  const signIn = async () => {
    setBusy(true);
    try {
      const s = await renphoLogin(email.trim(), password, settings.renphoArea || "US");
      setRenphoSession(s, remember);
      setSession(s);
      setPassword("");
      toast.success("Connected to Renpho. Your weight now shows on the Dashboard.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Scale className="size-5" aria-hidden />
        <h2 className="font-black">Renpho</h2>
        <span className={cn("ml-auto text-meta uppercase", session ? "text-status-ok" : "text-muted-foreground")}>{session ? "Connected" : "Not connected"}</span>
      </div>
      <p className="max-w-[65ch] text-muted-foreground">Shows your latest weigh-in from your Renpho scale on the Dashboard.</p>

      {session ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="min-w-0 break-all">{session.email}</span>
          <Button variant="outline" onClick={() => { setRenphoSession(null, false); setSession(null); }}>Sign out</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (!busy) signIn(); }}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="renpho-email">Renpho email</Label>
              <Input id="renpho-email" type="email" autoComplete="username" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="renpho-password">Password</Label>
              <Input id="renpho-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="renpho-area">Account region</Label>
              <Select value={settings.renphoArea || "US"} onValueChange={(v) => update({ renphoArea: v })}>
                <SelectTrigger id="renpho-area" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{AREAS.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label htmlFor="renpho-remember" className="flex min-h-12 items-center gap-4">
            <Switch id="renpho-remember" checked={remember} onCheckedChange={setRemember} />
            <span>Stay connected on this device</span>
          </label>
          <div><Button type="submit" disabled={busy || !email.trim() || !password}>{busy ? "Signing in…" : "Sign in to Renpho"}</Button></div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <span>Show weight in</span>
        <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Weight unit">
          {(["lb", "kg"] as const).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => update({ weightUnit: u })}
              className={cn("h-10 min-w-16 rounded-md px-3 md:h-8", unit === u ? "bg-card font-black text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <p className="font-extralight text-muted-foreground">
        Your password goes to Renpho once to sign in and isn&apos;t saved; only the sign-in token stays on this device. Renpho has no official API, so this uses the same connection as the Renpho app, and signing in here may sign the Renpho phone app out once.
      </p>
    </section>
  );
}
