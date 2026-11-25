"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app-provider";
import { BAKKEN_LABELS, DAYS, SESSION_LABELS, type BakkenSlot, type SessionType } from "@/lib/settings";

/** Which session goes on which day. */
export function WeekTemplate() {
  const { settings, update } = useApp();
  const bakken = settings.runMethod === "bakken";
  const current: string[] = bakken ? settings.bakkenTemplate : settings.template;
  const labels: Record<string, string> = bakken ? BAKKEN_LABELS : SESSION_LABELS;
  const set = (i: number, v: string) => {
    if (bakken) { const t = settings.bakkenTemplate.slice(); t[i] = v as BakkenSlot; update({ bakkenTemplate: t }); }
    else { const t = settings.template.slice(); t[i] = v as SessionType; update({ template: t }); }
  };
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-4">
      {DAYS.map((d, i) => (
        <div key={d} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2 lg:flex lg:flex-col lg:items-stretch">
          <Label htmlFor={`tmpl-${i}`} className="text-meta uppercase text-muted-foreground">{d}</Label>
          <Select value={current[i]} onValueChange={(v) => set(i, v)}>
            <SelectTrigger id={`tmpl-${i}`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(labels).map((k) => (
                <SelectItem key={k} value={k}>{labels[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

const OPEN_KEY = "htb-template-collapsed";

/** Weekly template in a collapsible card. */
export function WeekTemplateCard() {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) !== "1"); } catch { /* ignore */ } }, []);
  const toggle = (o: boolean) => { setOpen(o); try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ } };
  return (
    <Collapsible open={open} onOpenChange={toggle} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <span className="flex items-center gap-2 font-black">
          <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden /> Weekly Template
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-4 md:p-6">
        <WeekTemplate />
        <p className="font-extralight text-muted-foreground">{useApp().settings.runMethod === "bakken"
          ? "Double threshold days run a controlled morning session and a slightly faster afternoon one. Keep easy days between hard days; most of your volume is easy running."
          : "Put an easy day between sub-threshold sessions. Most of your volume should be easy running."}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
