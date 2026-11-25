"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Flag, Palmtree, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app-provider";
import { addDays, BLOCK_WEEKS, MAX_WEEKS, newId, type Race, type Vacation } from "@/lib/calendar";
import { fmtShortDate, isoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const OPEN_KEY = "htb-season-collapsed";

/** The season both plans share: build dates, races (each gets a taper) and time off. */
export function SeasonCard() {
  const { settings: s, update, calendar: cal } = useApp();
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) !== "1"); } catch { /* ignore */ } }, []);
  const toggle = (o: boolean) => { setOpen(o); try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ } };

  const n = cal.weeks.length;
  const first = cal.weeks[0].start;
  const lastDay = addDays(cal.weeks[n - 1].start, 6);
  const setRace = (id: string, patch: Partial<Race>) => update({ races: s.races.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const setVac = (id: string, patch: Partial<Vacation>) => update({ vacations: s.vacations.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  const addRace = () => update({ races: [...s.races, { id: newId(), date: isoDate(addDays(lastDay, -1)), name: "", kind: "hyrox" }] });
  const addVac = () => {
    const mid = cal.weeks[Math.min(n - 1, Math.floor(n / 2))].start;
    update({ vacations: [...s.vacations, { id: newId(), start: isoDate(mid), end: isoDate(addDays(mid, 6)) }] });
  };

  return (
    <Collapsible open={open} onOpenChange={toggle} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <span className="flex items-center gap-2 font-black">
          <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden /> Season
        </span>
        {!open && (
          <span className="font-extralight text-muted-foreground">
            {fmtShortDate(first)} – {fmtShortDate(lastDay)} · {n} weeks · {cal.periods.length} period{cal.periods.length === 1 ? "" : "s"} · {cal.races.length} race{cal.races.length === 1 ? "" : "s"}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-6 border-t p-4 md:p-6">
        <p className="max-w-[65ch] font-extralight text-muted-foreground">
          Shared by the run plan and the HYROX plan, and saved with them. Weeks run Monday to Sunday in blocks of {BLOCK_WEEKS}, and every three blocks make a 12-week period. Each race gets a taper week before it and a race week.
        </p>

        <div className="grid grid-cols-2 gap-4 md:max-w-xl">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="season-start" className="flex flex-wrap items-baseline gap-x-2">Start <span className="font-extralight text-muted-foreground">from its Monday</span></Label>
            <Input id="season-start" type="date" value={s.startDate} onChange={(e) => e.target.value && update({ startDate: e.target.value })} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="season-end" className="flex flex-wrap items-baseline gap-x-2">End <span className="font-extralight text-muted-foreground">to its Sunday</span></Label>
            <Input id="season-end" type="date" min={s.startDate} value={s.endDate} onChange={(e) => e.target.value && update({ endDate: e.target.value })} />
          </div>
        </div>

        {/* Block timeline: one cell per week, coloured by phase. */}
        <div className="flex flex-col gap-2">
          <p className="num text-muted-foreground">
            <span className="font-black text-foreground">{n} weeks</span> · {cal.periods.length} period{cal.periods.length === 1 ? "" : "s"} · {cal.blocks.length} block{cal.blocks.length === 1 ? "" : "s"} · {fmtShortDate(first)} – {fmtShortDate(lastDay)}
            {n === MAX_WEEKS && " (the most a plan can cover)"}
          </p>
          <div className="flex flex-col gap-4" aria-label="Periods and blocks">
            {cal.periods.map((p) => (
              <div key={p.i} className="flex flex-col gap-1">
                <span className="text-meta uppercase text-foreground">Period {p.i + 1} <span className="font-extralight normal-case tracking-normal text-muted-foreground">· {fmtShortDate(p.start)} – {fmtShortDate(p.end)}</span></span>
                <div className="flex flex-wrap gap-2">
                  {p.blocks.map((bi) => cal.blocks[bi]).map((b) => (
                    <div key={b.i} className="flex flex-col gap-1">
                      <span className="text-meta uppercase text-muted-foreground">Block {b.pos + 1}</span>
                      <div className="flex gap-0.5">
                        {b.weeks.map((wi) => {
                          const w = cal.weeks[wi];
                          return (
                            <span key={wi} title={`Week ${wi + 1}${w.role !== "load" ? ` · ${w.role}` : ""}`}
                              className={cn("flex h-6 w-6 items-center justify-center rounded-sm text-[10px] leading-none font-black text-white",
                                w.role === "vacation" ? "hatch bg-muted text-muted-foreground" : w.role === "race" ? "bg-phase-trial" : `bg-phase-${b.phase}`,
                                w.role === "taper" && "opacity-60")}>
                              {w.role === "race" ? <Flag className="size-3" aria-hidden /> : w.role === "vacation" ? <Palmtree className="size-3" aria-hidden /> : wi + 1}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black">Races</h3>
            <Button size="sm" variant="outline" onClick={addRace}><Plus aria-hidden /> Add race</Button>
          </div>
          {s.races.length === 0 && <p className="font-extralight text-muted-foreground">No races. The last week is a taper and test week instead.</p>}
          <ul className="flex flex-col gap-2">
            {s.races.map((r) => {
              const out = cal.outside.some((o) => o.id === r.id);
              return (
                <li key={r.id} className={cn("grid grid-cols-[minmax(0,1fr)_112px_auto] gap-2 rounded-lg border p-2 md:grid-cols-[170px_140px_minmax(0,1fr)_auto]", out && "border-destructive")}>
                  <Input aria-label="Race date" type="date" value={r.date} onChange={(e) => setRace(r.id, { date: e.target.value })} />
                  <Select value={r.kind} onValueChange={(v) => setRace(r.id, { kind: v as Race["kind"] })}>
                    <SelectTrigger aria-label="Race type" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hyrox">HYROX</SelectItem>
                      <SelectItem value="run">Run race</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="md:order-4" onClick={() => update({ races: s.races.filter((x) => x.id !== r.id) })} aria-label="Remove race"><Trash2 aria-hidden /></Button>
                  <Input aria-label="Race name" className="col-span-3 md:col-span-1" placeholder={r.kind === "hyrox" ? "HYROX Chicago, Pro Doubles" : "Spring 10k"} maxLength={60}
                    value={r.name} onChange={(e) => setRace(r.id, { name: e.target.value })} />
                  {out && <p className="col-span-3 text-meta text-destructive md:col-span-4">Outside your build dates, so it's not in the plan.</p>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black">Time Off</h3>
            <Button size="sm" variant="outline" onClick={addVac}><Plus aria-hidden /> Add time off</Button>
          </div>
          <p className="font-extralight text-muted-foreground">Block single days or whole weeks. Five or more days off makes it a vacation week: volume pauses, and the week after holds instead of rising.</p>
          <ul className="flex flex-col gap-2">
            {s.vacations.map((v) => (
              <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1 rounded-lg border p-2 md:max-w-xl md:gap-2">
                <Input aria-label="First day off" className="px-2" type="date" value={v.start} onChange={(e) => setVac(v.id, { start: e.target.value, end: v.end < e.target.value ? e.target.value : v.end })} />
                <Input aria-label="Last day off" className="px-2" type="date" min={v.start} value={v.end} onChange={(e) => setVac(v.id, { end: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => update({ vacations: s.vacations.filter((x) => x.id !== v.id) })} aria-label="Remove time off"><Trash2 aria-hidden /></Button>
              </li>
            ))}
          </ul>
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
