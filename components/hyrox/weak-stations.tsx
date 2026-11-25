"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app-provider";
import { STATION, STATIONS, weakFor, type Station } from "@/lib/hyrox";
import { fmtShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const OPEN_KEY = "htb-hx-weak-collapsed";

/** Pick weak stations: each gets more volume and one extra block a week. Runs are left to the run plan. */
export function WeakStations() {
  const { settings, updateHyrox, calendar } = useApp();
  const h = settings.hyrox;
  const periods = calendar.periods;
  const [selRaw, setSel] = useState(0);
  const sel = Math.min(selRaw, periods.length - 1);
  const multi = periods.length > 1;
  const current = weakFor(h, sel);
  const ordered = (list: Station[]) => STATIONS.map((s) => s.key).filter((k) => list.includes(k));
  const setFor = (p: number, list: Station[]) => {
    if (!multi) return updateHyrox({ weaknesses: list });
    const by = (h.weakByPeriod || []).slice();
    for (let i = 0; i < periods.length; i++) if (by[i] == null) by[i] = h.weaknesses.slice(); // keep the others as they were
    by[p] = list;
    updateHyrox({ weakByPeriod: by });
  };
  const toggle = (st: Station) => setFor(sel, ordered(current.includes(st) ? current.filter((x) => x !== st) : [...current, st]));
  const copyToAll = () => updateHyrox({ weaknesses: current.slice(), weakByPeriod: periods.map(() => current.slice()) });
  const names = (list: Station[]) => (list.length ? list.map((k) => STATION[k].short).join(", ") : "None");
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) !== "1"); } catch { /* ignore */ } }, []);
  const openChange = (o: boolean) => { setOpen(o); try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ } };
  return (
    <Collapsible open={open} onOpenChange={openChange} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-2 p-4 text-left font-black hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden /> Weak Stations
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="max-w-[65ch] font-extralight text-muted-foreground">
          Each one you pick gets more sets and rounds (+25% or +50%) in the sessions that already train it, a top-up block only in weeks that don't, and gym work for the muscles it relies on.
        </p>
      </div>
      {multi && (
        <div className="flex flex-col gap-2">
          <p className="text-meta uppercase text-muted-foreground">Choose a period, then its weak stations</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
            {periods.map((p) => {
              const list = weakFor(h, p.i);
              return (
                <button key={p.i} type="button" aria-pressed={sel === p.i} onClick={() => setSel(p.i)}
                  className={cn("flex min-h-12 flex-col items-start justify-center rounded-lg border px-3 py-1 text-left md:min-h-10",
                    sel === p.i ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent/60")}>
                  <span className="font-black">Period {p.i + 1}</span>
                  <span className={cn("text-meta", sel === p.i ? "opacity-80" : "text-muted-foreground")}>{list.length ? `${list.length} weak` : "none"} · {fmtShortDate(p.start)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={multi ? `Weak stations for period ${sel + 1}` : "Weak stations"}>
        {STATIONS.map((s, i) => {
          const on = current.includes(s.key);
          return (
            <button key={s.key} type="button" aria-pressed={on} onClick={() => toggle(s.key)}
              className={cn("flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-ring md:min-h-10",
                on ? "border-signal bg-signal-soft text-foreground" : "hover:bg-accent/60")}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-sm border", on ? "border-signal bg-signal text-signal-foreground" : "border-muted-foreground")}>
                {on && <Check className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0"><span className="num mr-1 text-muted-foreground">{i + 1}</span>{s.label}</span>
            </button>
          );
        })}
      </div>
      {multi && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col divide-y rounded-lg border">
            {periods.map((p) => (
              <li key={p.i} className="flex flex-wrap items-baseline gap-x-2 p-2 md:px-3">
                <span className="font-black">Period {p.i + 1}</span>
                <span className="num font-extralight text-muted-foreground">{fmtShortDate(p.start)} – {fmtShortDate(p.end)}</span>
                <span className={weakFor(h, p.i).length ? "text-signal" : "text-muted-foreground"}>{names(weakFor(h, p.i))}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="self-start" onClick={copyToAll}><Copy aria-hidden /> Use period {sel + 1}&apos;s stations for all periods</Button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label htmlFor="hx-emphasis">Extra volume on weak stations</Label>
        <Select value={h.emphasis} onValueChange={(v) => updateHyrox({ emphasis: v as typeof h.emphasis })}>
          <SelectTrigger id="hx-emphasis" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="moderate">Moderate (+25%)</SelectItem>
            <SelectItem value="high">High (+50%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
