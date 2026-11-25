"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/components/app-provider";
import { DIVISIONS, type Division, type HyroxSettings } from "@/lib/hyrox";

const OPEN_KEY = "htb-hx-settings-collapsed";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2">
        {label}{hint && <span className="font-extralight text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

function Pick<T extends string>({ id, value, onChange, options }: { id: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/** HYROX program settings. The start date is the run plan's, so both plans line up. */
export function HyroxSettingsCard() {
  const { settings, update, updateHyrox } = useApp();
  const h = settings.hyrox;
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) !== "1"); } catch { /* ignore */ } }, []);
  const toggle = (o: boolean) => { setOpen(o); try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ } };
  const set = <K extends keyof HyroxSettings>(k: K) => (v: HyroxSettings[K]) => updateHyrox({ [k]: v } as Partial<HyroxSettings>);
  const div = DIVISIONS[h.division];

  return (
    <Collapsible open={open} onOpenChange={toggle} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <span className="flex items-center gap-2 font-black">
          <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden /> Program Settings
        </span>
        {!open && (
          <span className="font-extralight text-muted-foreground">
            {div.label} · {h.strength === "build" ? "strength block" : "maintenance"}{h.weakByPeriod?.some(Boolean) ? " · weak stations by period" : h.weaknesses.length ? ` · ${h.weaknesses.length} weak station${h.weaknesses.length > 1 ? "s" : ""}` : ""}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-6 border-t p-4 md:p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field id="hx-division" label="Division">
            <Pick id="hx-division" value={h.division} onChange={set("division")}
              options={(Object.keys(DIVISIONS) as Division[]).map((k) => [k, DIVISIONS[k].label])} />
          </Field>
          <Field id="hx-unit" label="Weights in">
            <Pick id="hx-unit" value={h.weightUnit} onChange={set("weightUnit")} options={[["kg", "kg"], ["lb", "lb"]]} />
          </Field>
          <Field id="hx-strength" label="Strength">
            <Pick id="hx-strength" value={h.strength} onChange={set("strength")}
              options={[["maintain", "Maintain (in season)"], ["build", "Build (off season)"]]} />
          </Field>
          <Field id="hx-final" label="Last week" hint="if no race">
            <Pick id="hx-final" value={h.finalWeek === "race" ? "test" : h.finalWeek} onChange={set("finalWeek")}
              options={[["test", "Benchmark tests"], ["normal", "Normal week"]]} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="hx-deloads" className="flex min-h-12 items-center gap-4">
            <Switch id="hx-deloads" checked={h.deloads} onCheckedChange={set("deloads")} />
            <span>Absorb week at the end of each 4-week block (about 65% volume)</span>
          </label>
          <label htmlFor="hx-bench" className="flex min-h-12 items-center gap-4">
            <Switch id="hx-bench" checked={h.benchmarks} onCheckedChange={set("benchmarks")} />
            <span>Benchmark tests in week 1, repeated in the taper week before your last race</span>
          </label>
          <label htmlFor="hx-runs" className="flex min-h-12 items-center gap-4">
            <Switch id="hx-runs" checked={h.runLegs} onCheckedChange={set("runLegs")} />
            <span>Short run legs in HYROX Quality <span className="font-extralight text-muted-foreground">(off: BikeErg instead)</span></span>
          </label>
        </div>
        <p className="max-w-[65ch] font-extralight text-muted-foreground">
          Race weights for {div.label.toLowerCase()}: sled push {div.push} kg, sled pull {div.pull} kg, farmers {div.farmers} kg per hand, lunges {div.lunges} kg, wall ball {div.wb} kg to {div.target}. Doubles use the same weights. Check them against the current HYROX rulebook.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
