"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/components/app-provider";
import { KM_PER_MI, dist, fmtShortDate, unitDist } from "@/lib/format";
import { periodVolume } from "@/lib/settings";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPEN_KEY = "htb-settings-collapsed";

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

/** Collapsible settings with a one-line summary when closed. */
export function PlanSettings() {
  const { settings: s, update, plan, calendar } = useApp();
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem(OPEN_KEY) !== "1"); } catch { /* ignore */ } }, []);
  const toggle = (o: boolean) => { setOpen(o); try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* ignore */ } };
  const u = s.units;
  const f = u === "mi" ? 1 / KM_PER_MI : 1;
  const show = (km: number) => Math.round(km * f * 10) / 10;
  const toKm = (v: string) => Math.max(0, Number(v) || 0) / f;
  const num = (v: string) => Number(v) || 0;

  return (
    <Collapsible open={open} onOpenChange={toggle} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <span className="flex items-center gap-2 font-black">
          <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden /> Plan Settings
        </span>
        {!open && (
          <span className="num font-extralight text-muted-foreground">
            {calendar.periods.map((p) => { const v = periodVolume(s, p.i); return v.ramp ? `${v.start}→${v.peak}` : `${v.start}`; }).join(" · ")} {unitDist(u)} · {s.subtShare}% {s.runMethod === "bakken" ? "threshold" : "sub-T"} · WU {dist(s.subtWarmupKm, u)} · CD {dist(s.subtCooldownKm, u)}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-6 border-t p-4 md:p-6">
        <MileageByPeriod />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field id="subt-share" label={s.runMethod === "bakken" ? "Threshold share" : "Sub-T share"} hint="% of volume">
            <Input id="subt-share" className="num" type="number" inputMode="numeric" min={10} max={35} value={s.subtShare} onChange={(e) => update({ subtShare: num(e.target.value) })} />
          </Field>
          <Field id="warmup" label="Warm-up" hint={`${unitDist(u)} · ${s.runMethod === "bakken" ? "threshold" : "sub-T"} sessions`}>
            <Input id="warmup" className="num" type="number" inputMode="decimal" min={0} max={10} step={0.5} value={show(s.subtWarmupKm)} onChange={(e) => update({ subtWarmupKm: toKm(e.target.value) })} />
          </Field>
          <Field id="cooldown" label="Cool-down" hint={`${unitDist(u)} · ${s.runMethod === "bakken" ? "threshold" : "sub-T"} sessions`}>
            <Input id="cooldown" className="num" type="number" inputMode="decimal" min={0} max={10} step={0.5} value={show(s.subtCooldownKm)} onChange={(e) => update({ subtCooldownKm: toKm(e.target.value) })} />
          </Field>
          {s.runMethod === "bakken" ? (
            <Field id="low-mileage" label="Low mileage" hint={`below ${unitDist(u)}/wk`}>
              <Input id="low-mileage" className="num" type="number" inputMode="numeric" min={0} max={250} value={s.lowMileage} onChange={(e) => update({ lowMileage: num(e.target.value) })} />
            </Field>
          ) : (
          <Field id="rep-format" label="Rep format">
            <Select value={s.repFormat} onValueChange={(v) => update({ repFormat: v as typeof s.repFormat })}>
              <SelectTrigger id="rep-format" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Distance (1k / 2k / 3k)</SelectItem>
                <SelectItem value="time">Time (3 / 6 / 10 min)</SelectItem>
                <SelectItem value="mixed">Alternate each week</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          )}
          <Field id="final-week" label="Last week" hint="if no race">
            <Select value={s.finalWeek === "race" ? "test" : s.finalWeek} onValueChange={(v) => update({ finalWeek: v as typeof s.finalWeek })}>
              <SelectTrigger id="final-week" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Taper + time trial</SelectItem>
                <SelectItem value="normal">Normal week</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {s.runMethod === "bakken" ? (
          <label htmlFor="deloads" className="flex min-h-12 items-center gap-4">
            <Switch id="deloads" checked={s.bakkenDeloads} onCheckedChange={(v) => update({ bakkenDeloads: v })} />
            <span>Lighter week at the end of each 4-week block (off: flat weeks, as Bakken trained)</span>
          </label>
        ) : (
          <label htmlFor="deloads" className="flex min-h-12 items-center gap-4">
            <Switch id="deloads" checked={s.deloads} onCheckedChange={(v) => update({ deloads: v })} />
            <span>Lighter week at the end of each 4-week block</span>
          </label>
        )}
        {plan && (
          <p className="max-w-[65ch] font-extralight text-muted-foreground">
            {s.runMethod === "bakken" && `Below ${s.lowMileage} ${unitDist(u)} a week, only the first double threshold day stays double; the other becomes a single session. Lighter and taper weeks also drop one afternoon session. The long run stays at or under ${u === "mi" ? "11 mi" : "18 km"}. Race weeks get 1000s + 300s four days out and a short threshold run two days out. `}{`${s.runMethod === "bakken" ? "Threshold" : "Sub-T"} work stays within the share: sessions get fewer reps first, and if that's not enough ${s.runMethod === "bakken" ? "a double day becomes a single, then " : ""}a session becomes an easy run. `}Volume rises at most 5% a week over the last full week; lighter weeks drop to 80%, the week before a race to 85% and race weeks to 65%. The first week back from a vacation holds instead of rising.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Condensed mileage: only ramping periods get inputs; runs of holding periods share one line. */
function MileageByPeriod() {
  const { settings: s, update, plan, calendar } = useApp();
  const u = s.units;
  const num = (v: string) => Number(v) || 0;
  const vols = calendar.periods.map((p) => periodVolume(s, p.i));
  const [pick, setPick] = useState<string>("");

  // Built from the latest settings, so quick edits can't overwrite each other.
  const setP = (i: number, patch: { ramp?: boolean; start?: number; peak?: number }) => update((cur) => {
    const pv = (cur.periodVolumes || []).slice();
    if (i === 0) {
      if (patch.ramp !== undefined) pv[0] = { ...(pv[0] || {}), ramp: patch.ramp };
      return { periodVolumes: pv, ...(patch.start !== undefined && { startVolume: patch.start }), ...(patch.peak !== undefined && { peakVolume: patch.peak }) };
    }
    if (patch.ramp === false) { pv[i] = { ramp: false }; return { periodVolumes: pv }; }
    const now = periodVolume(cur, i);
    pv[i] = { ...(pv[i] || {}), ...(patch.ramp && { ramp: true, start: now.ramp ? now.start : Math.round(now.peak * 0.85), peak: now.ramp ? now.peak : Math.round(now.peak * 1.1) }),
      ...(patch.start !== undefined && { start: patch.start }), ...(patch.peak !== undefined && { peak: patch.peak }) };
    return { periodVolumes: pv };
  });

  // Group consecutive holding periods at the same volume.
  type Row = { kind: "ramp"; i: number } | { kind: "hold"; from: number; to: number; at: number };
  const rows: Row[] = [];
  calendar.periods.forEach((p) => {
    const v = vols[p.i];
    const last = rows[rows.length - 1];
    if (v.ramp) rows.push({ kind: "ramp", i: p.i });
    else if (last?.kind === "hold" && last.at === v.start && last.to === p.i - 1) last.to = p.i;
    else rows.push({ kind: "hold", from: p.i, to: p.i, at: v.start });
  });
  const holding = calendar.periods.filter((p) => !vols[p.i].ramp);
  const span = (a: number, b: number) => `${fmtShortDate(calendar.periods[a].start)} – ${fmtShortDate(calendar.periods[b].end)}`;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-black">Mileage</h3>
        <p className="text-meta text-muted-foreground">ramps rise at most 5% a week</p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => r.kind === "ramp" ? (
          <li key={`r${r.i}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2 md:px-3">
            <p className="min-w-0 flex-1 basis-40">
              <span className="font-black">Period {r.i + 1}</span>{" "}
              <span className="num font-extralight text-muted-foreground">{span(r.i, r.i)}</span>
              <span className="block text-meta text-muted-foreground">
                {plan?.periods[r.i]?.peakWeek ? `Ramp · peak in week ${plan.periods[r.i]!.peakWeek}` : `Ramp · reaches ${dist(plan?.periods[r.i]?.maxKm || 0, u, 0)}`}
              </span>
            </p>
            <span className="flex items-center gap-2">
              <Input aria-label={`Period ${r.i + 1} start`} id={`pv-start-${r.i}`} className="num w-20 px-2 text-center" type="number" inputMode="numeric" min={10} max={250} value={vols[r.i].start} onChange={(e) => setP(r.i, { start: num(e.target.value) })} />
              <span aria-hidden>→</span>
              <Input aria-label={`Period ${r.i + 1} peak`} id={`pv-peak-${r.i}`} className="num w-20 px-2 text-center" type="number" inputMode="numeric" min={15} max={250} value={vols[r.i].peak} onChange={(e) => setP(r.i, { peak: num(e.target.value) })} />
              <span className="text-muted-foreground">{unitDist(u)}/wk</span>
              <Button size="icon" variant="ghost" onClick={() => setP(r.i, { ramp: false })} aria-label={`Stop ramping period ${r.i + 1}`}><X aria-hidden /></Button>
            </span>
          </li>
        ) : (
          <li key={`h${r.from}`} className="flex flex-wrap items-baseline gap-x-2 p-2 text-muted-foreground md:px-3">
            <span className="font-black text-foreground">{r.from === r.to ? `Period ${r.from + 1}` : `Periods ${r.from + 1}–${r.to + 1}`}</span>
            <span className="num font-extralight">{span(r.from, r.to)}</span>
            <span>holds <span className="num text-foreground">{r.at} {unitDist(u)}/wk</span></span>
          </li>
        ))}
      </ul>
      {holding.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger aria-label="Period to ramp up" className="w-48"><SelectValue placeholder="Ramp up a period…" /></SelectTrigger>
            <SelectContent>
              {holding.map((p) => <SelectItem key={p.i} value={String(p.i)}>Period {p.i + 1} · {span(p.i, p.i)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={pick === ""} onClick={() => { setP(Number(pick), { ramp: true }); setPick(""); }}><Plus aria-hidden /> Add ramp</Button>
        </div>
      )}
    </section>
  );
}
