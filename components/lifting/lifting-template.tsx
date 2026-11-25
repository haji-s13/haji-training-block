"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app-provider";
import { LIFT_LABELS, type LiftSlot } from "@/lib/lifting";
import { BAKKEN_LABELS, DAYS, SESSION_LABELS } from "@/lib/settings";

const OPEN_KEY = "htb-lift-template-collapsed";

/** Which gym session goes on which day, with the run plan's session for that day underneath. */
export function LiftingTemplateCard() {
  const { settings, updateLifting } = useApp();
  const t = settings.lifting.template;
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) !== "1"); } catch { /* ignore */ } }, []);
  const toggle = (o: boolean) => { setOpen(o); try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ } };
  const set = (i: number, v: LiftSlot) => { const n = t.slice(); n[i] = v; updateLifting({ template: n }); };

  return (
    <Collapsible open={open} onOpenChange={toggle} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <span className="flex items-center gap-2 font-black">
          <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden /> Weekly Template
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-4 md:p-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-4">
          {DAYS.map((d, i) => (
            <div key={d} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-2 lg:flex lg:flex-col lg:items-stretch lg:gap-2">
              <Label htmlFor={`lift-tmpl-${i}`} className="text-meta uppercase text-muted-foreground">{d}</Label>
              <Select value={t[i]} onValueChange={(v) => set(i, v as LiftSlot)}>
                <SelectTrigger id={`lift-tmpl-${i}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LIFT_LABELS) as LiftSlot[]).map((k) => <SelectItem key={k} value={k}>{LIFT_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="col-start-2 truncate text-meta text-muted-foreground">Run: {settings.runMethod === "bakken" ? BAKKEN_LABELS[settings.bakkenTemplate[i]].replace(/ \(.*\)/, "") : SESSION_LABELS[settings.template[i]].replace(/ \(.*\)/, "")}</p>
            </div>
          ))}
        </div>
        <p className="font-extralight text-muted-foreground">Push, legs, pull and upper. Legs go on the double threshold day, 30-60 min after the PM run. Upper-body days go on easy days, and there&apos;s no gym on the second double day or the X day.</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
