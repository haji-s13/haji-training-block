"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RefreshCw, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/components/app-provider";
import { useBodyWeight } from "@/components/nutrition/use-body-weight";
import { useFoodLogs } from "@/components/nutrition/use-food-logs";
import { addDays, mondayOf } from "@/lib/calendar";
import { dist, isoDate, parseDate } from "@/lib/format";
import { fuelWeek, type FuelDay } from "@/lib/fuel-day";
import { burnKcal, dailyFromMeals, GEARS, kcalOf, mergeEaten, type SyncedDay, refuel, underFuelled, type FoodLog, type Gear, fmtPerLb, ASSUMED_BODY_FAT, EA_FLOOR, EA_WARN, gainRateOf, loseRateOf, type WeekSummary, MAX_DAY_SURPLUS } from "@/lib/nutrition";
import { fmtWeight, KG_PER_LB } from "@/lib/weight";
import { cn } from "@/lib/utils";

const SHORT: Record<Gear, string> = { rest: "Rest", easy: "Easy", hard: "Hard", double: "2×T" };
const MACRO_COLOR = { carbs: "var(--phase-trial)", protein: "var(--phase-base)", fat: "var(--phase-peak)" };

const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const n = (x: number) => Math.round(x).toLocaleString("en-US");
/** 5.5 → "5.5", 9.0 → "9". */

function Bar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** A day for the Fuel tab to open on next time it mounts (set by the Dashboard summary). */
let pendingDay: string | null = null;
export function openFuelOn(iso: string) { pendingDay = iso; }

/** Daily fuel targets that follow the run and lifting plans, and a log of what was eaten. */
export function FuelScreen() {
  const { plan, hyrox, calendar, settings, setScreen } = useApp();
  const { kg, meals } = useBodyWeight();
  const [sel, setSel] = useState(() => pendingDay ?? isoDate(today()));
  useEffect(() => { pendingDay = null; }, []);
  const selDate = parseDate(sel) || today();
  const weekStart = mondayOf(selDate);
  const from = isoDate(weekStart);
  const to = isoDate(addDays(weekStart, 6));
  const food = useFoodLogs(from, to);
  const synced = useMemo(() => dailyFromMeals(meals), [meals]);
  const eaten = useMemo(() => mergeEaten(food.logs, synced), [food.logs, synced]);

  const week = useMemo(() => fuelWeek(parseDate(from) || today(), calendar, plan, hyrox, kg, settings.nutrition),
    [from, calendar, plan, hyrox, kg, settings.nutrition]);
  const days = week.days;

  const day = days.find((d) => d.iso === sel) ?? days[0];
  const isToday = sel === isoDate(today());
  const dayName = selDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const shortName = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

  // Keep the selected day visible in the scrolling strip.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>("[aria-pressed=true]");
    const box = stripRef.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.offsetLeft;
    // Scroll only when the selected day is cut off.
    if (left < box.scrollLeft + 16) box.scrollTo({ left: Math.max(0, left - 16) });
    else if (left + el.offsetWidth > box.scrollLeft + box.clientWidth - 16) box.scrollTo({ left: left + el.offsetWidth - box.clientWidth + 16 });
  }, [sel]);

  const shiftWeek = (by: number) => setSel(isoDate(addDays(selDate, by * 7)));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="text-meta uppercase text-muted-foreground">{dayName}</p>
        <h1 className="font-display text-[2rem] leading-10 font-black md:text-display">Fuel</h1>
        <p className="max-w-[65ch] text-muted-foreground">Carbs follow the day&apos;s training. Protein stays steady. Fat fills the rest.</p>
      </section>

      {!plan && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle className="font-black">No run plan yet</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-4">
            <p>Every day counts as a rest day until your run plan exists, so targets will be low. Enter a valid PB on Profile.</p>
            <Button variant="outline" onClick={() => setScreen("paces")}>Open Profile</Button>
          </AlertDescription>
        </Alert>
      )}

      {!kg ? (
        <Alert>
          <UserRound aria-hidden />
          <AlertTitle className="font-black">Add your weight first</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-4">
            <p>Targets are set per pound of body weight. Add your weight on Profile, or connect Health Connect so it syncs.</p>
            <Button variant="outline" onClick={() => setScreen("paces")}>Open Profile</Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-meta uppercase text-muted-foreground">
                {weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – {addDays(weekStart, 6).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </p>
              <span className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Previous week"><ChevronLeft aria-hidden /></Button>
                <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Next week"><ChevronRight aria-hidden /></Button>
              </span>
            </div>
            <div ref={stripRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
              {days.map((d) => {
                const selected = d.iso === sel;
                return (
                  <button key={d.iso} type="button" onClick={() => setSel(d.iso)} aria-pressed={selected}
                    aria-label={`${d.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${GEARS[d.gear].label}`}
                    className={cn("flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg border py-2 focus-visible:outline-2 focus-visible:outline-ring md:w-auto",
                      selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent/60",
                      !d.inPlan && !selected && "opacity-40")}>
                    <span className="text-meta uppercase opacity-80">{d.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="num font-black">{d.date.getDate()}</span>
                    <span className="text-meta uppercase opacity-80">{SHORT[d.gear]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <DayTargets day={day} kg={kg} isToday={isToday} log={eaten[day.iso]} />

          <LogCard key={day.iso} day={day} label={shortName(day.date)} log={food.logs[day.iso]} synced={synced[day.iso]} saving={food.saving}
            signedIn={food.signedIn} onSave={food.save} onDelete={food.remove} />

          <WeekList days={days} kg={kg} logs={eaten} summary={week.summary} />
        </>
      )}
    </div>
  );
}

function DayTargets({ day, kg, isToday, log }: { day: FuelDay; kg: number; isToday: boolean; log?: FoodLog }) {
  const { settings } = useApp();
  const t = day.targets!;
  const eaten = log ? kcalOf(log.carbs, log.protein, log.fat) : null;
  const burn = burnKcal(kg, settings.nutrition, day.runKm, day.lift?.min ?? 0);
  const proteinKg = Math.max(settings.nutrition.proteinPerKg, GEARS[day.gear].protein);
  const r = refuel(kg);
  const macros = [
    { k: "Carbs", eaten: log?.carbs, target: t.carbs, color: MACRO_COLOR.carbs, note: `${fmtPerLb(t.carbs / kg)} g/lb · ${GEARS[day.gear].label} gear` },
    { k: "Protein", eaten: log?.protein, target: t.protein, color: MACRO_COLOR.protein, note: `${fmtPerLb(proteinKg)} g/lb · 20–40 g every 3–4 h` },
    { k: "Fat", eaten: log?.fat, target: t.fat, color: MACRO_COLOR.fat, note: `${Math.round(((t.fat * 9) / t.kcal) * 100)}% of energy · never under 20%` },
  ];
  const training = [
    day.runKm > 0 ? `Run ${dist(day.runKm, settings.units)}` : "No run",
    day.lift ? `${day.lift.title} ${day.lift.min} min` : "no gym",
  ].join(" · ");

  return (
    <>
      <section className="flex flex-col gap-2">
        <p className="text-meta uppercase text-muted-foreground">{isToday ? "Today's target" : "Target"}</p>
        <div className="flex items-end gap-2">
          <span className="num text-[6rem] leading-[6rem] font-extralight text-signal md:text-hero">{n(t.kcal)}</span>
          <span className="pb-4 text-muted-foreground">kcal</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Badge variant="outline">{GEARS[day.gear].label} day</Badge>
          {day.lift && <Badge variant="outline">+ {day.lift.title}</Badge>}
          {eaten !== null && <span className="num">{n(eaten)} eaten · {eaten > t.kcal ? `${n(eaten - t.kcal)} over` : `${n(t.kcal - eaten)} left`}</span>}
        </div>
      </section>

      <Card className="gap-4 py-6">
        <CardHeader className="px-4 md:px-6"><CardTitle className="text-meta uppercase">Macros · <span className="num">{fmtWeight(kg, "lb")}</span></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-6 px-4 md:px-6">
          {macros.map((m) => (
            <div key={m.k} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex items-center gap-2 font-black"><span className="size-2 rounded-full" style={{ background: m.color }} aria-hidden />{m.k}</span>
                <span className="num">
                  <span className="font-black">{m.eaten ?? "–"}</span><span className="text-muted-foreground"> / {m.target} g</span>
                </span>
              </div>
              <Bar value={m.eaten ?? 0} target={m.target} color={m.color} />
              <span className="num text-meta uppercase text-muted-foreground">{m.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {day.gear === "double" && (
        <Card className="gap-4 py-6">
          <CardHeader className="px-4 md:px-6"><CardTitle className="text-meta uppercase">Between your two sessions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 px-4 md:px-6">
            <p className="max-w-[65ch] text-muted-foreground">Sessions under 8 hours apart: refuel fast for the first 4 hours after the morning run.</p>
            {[
              ["Before AM", "Snack, never fasted", `${r.beforeAm[0]}–${r.beforeAm[1]} g carbs`],
              ["0–4 h after AM", `${fmtPerLb(1)}–${fmtPerLb(1.2)} g/lb an hour, low fibre`, `${r.perHourAfterAm[0]}–${r.perHourAfterAm[1]} g/h`],
              ["After PM", `Carbs + ${fmtPerLb(0.3)} g/lb protein`, `${r.proteinAfterPm} g protein`],
            ].map(([a, b, c]) => (
              <div key={a} className="flex items-start justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
                <div className="flex flex-col"><span className="font-black">{a}</span><span className="font-extralight text-muted-foreground">{b}</span></div>
                <span className="num shrink-0 font-black">{c}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-1">
        <p className="text-meta uppercase text-muted-foreground">Why this target</p>
        <p className="tabular-nums">{day.inPlan ? training : "Outside your plan dates"}</p>
        <p className="font-extralight text-muted-foreground">
          {burn !== null
            ? <>Estimated burn about <span className="num">{n(burn)}</span> kcal.</>
            : "Add sex, birth year and height (or body fat) on Profile to see your estimated burn."}
        </p>
      </section>
    </>
  );
}

/** Highest grams the nutrition_logs table accepts per macro. */
const MAX_G = { carbs: 4999, protein: 1999, fat: 1999 } as const;
const parseG = (v: string, max: number) => { const x = Number(v); return Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x) : null; };

function LogCard({ day, label, log, synced, saving, signedIn, onSave, onDelete }: {
  day: FuelDay; label: string; log?: FoodLog; synced?: SyncedDay; saving: boolean; signedIn: boolean;
  onSave: (l: FoodLog) => Promise<boolean>; onDelete: (date: string) => Promise<boolean>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [vals, setVals] = useState({ carbs: "", protein: "", fat: "" });
  const touched = useRef(false);
  // Fill in the saved log when it arrives (or changes after a save), unless the user is already typing.
  useEffect(() => {
    if (touched.current) return;
    const v = log ?? synced;
    setVals(v ? { carbs: String(v.carbs), protein: String(v.protein), fat: String(v.fat) } : { carbs: "", protein: "", fat: "" });
  }, [log, synced]);
  const g = { carbs: parseG(vals.carbs || "0", MAX_G.carbs), protein: parseG(vals.protein || "0", MAX_G.protein), fat: parseG(vals.fat || "0", MAX_G.fat) };
  const valid = g.carbs !== null && g.protein !== null && g.fat !== null;
  const empty = !vals.carbs && !vals.protein && !vals.fat;
  const kcal = valid ? kcalOf(g.carbs!, g.protein!, g.fat!) : null;
  const shown = log ?? synced;
  const unchanged = !!shown && valid && shown.carbs === g.carbs && shown.protein === g.protein && shown.fat === g.fat;
  const from = synced?.apps.length ? synced.apps.join(", ") : "Health Connect";
  const fields = [["carbs", "Carbs"], ["protein", "Protein"], ["fat", "Fat"]] as const;
  const del = async () => { touched.current = false; await onDelete(day.iso); };

  return (
    <Card className="gap-4 py-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 md:px-6">
        <CardTitle className="text-meta uppercase">What you ate · {label}</CardTitle>
        {unchanged && (log
          ? <Badge variant="outline" className="gap-1"><Check className="size-3" aria-hidden />Saved</Badge>
          : <Badge variant="outline" className="gap-1"><RefreshCw className="size-3" aria-hidden />Synced</Badge>)}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4 md:px-6">
        <div className="grid grid-cols-3 gap-4">
          {fields.map(([k, name]) => (
            <div key={k} className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={`fuel-${k}`}>{name} (g)</Label>
              <Input id={`fuel-${k}`} className="num" type="number" inputMode="numeric" min={0} step={1} placeholder="0"
                value={vals[k]} onChange={(e) => { touched.current = true; setVals((v) => ({ ...v, [k]: e.target.value })); }}
                aria-invalid={parseG(vals[k] || "0", MAX_G[k]) === null || undefined} />
            </div>
          ))}
        </div>
        <div className="flex items-baseline justify-between gap-4 rounded-lg bg-muted px-4 py-2">
          <span className="text-meta uppercase text-muted-foreground">Calories from macros</span>
          <span className="num font-black">{kcal === null ? "–" : `${n(kcal)} kcal`}</span>
        </div>
        <Button className="w-full" disabled={!valid || empty || saving || unchanged}
          onClick={() => valid && onSave({ date: day.iso, carbs: g.carbs!, protein: g.protein!, fat: g.fat! })}>
          {saving ? "Saving…" : "Save day"}
        </Button>
        {log && (
          <Button variant="outline" className="w-full" disabled={saving} onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden />Delete this day
          </Button>
        )}
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes what you typed for this day{signedIn ? " from your account" : ""}.{synced ? " The totals synced from your phone come back." : ""} Your targets stay the same, and you can log the day again afterwards.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={del}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {synced && !log && (
          <p className="font-extralight text-muted-foreground">Synced from {from}. Change a number and save to override this day.</p>
        )}
        {synced && log && (
          <p className="font-extralight text-muted-foreground">You typed this day, so it replaces the <span className="num">{n(kcalOf(synced.carbs, synced.protein, synced.fat))}</span> kcal synced from {from}. Delete it to go back to the synced totals.</p>
        )}
        {!signedIn && (
          <p className="font-extralight text-muted-foreground">Guest logs aren&apos;t saved: they&apos;re gone when you reload. Sign in to keep them.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** The week's plan against estimated burn, the goal's expected change, and energy availability. */
function WeekPlan({ s, kg }: { s: WeekSummary; kg: number }) {
  const { settings } = useApp();
  const nut = settings.nutrition;
  const lb = (k: number) => `${k > 0 ? "+" : k < 0 ? "−" : ""}${Math.abs(k / KG_PER_LB).toFixed(1)} lb`;
  const goalLine = nut.goal === "lose"
    ? <>Goal: lose <span className="num">{loseRateOf(nut)}%</span> a week (<span className="num">{lb(-(loseRateOf(nut) / 100) * kg)}</span>). This week&apos;s plan: <span className="num font-black">{lb(s.kgPerWeek)}</span>.</>
    : nut.goal === "gain"
      ? <>Goal: gain <span className="num">{gainRateOf(nut)}%</span> a week (<span className="num">{lb((gainRateOf(nut) / 100) * kg)}</span>). This week&apos;s plan: <span className="num font-black">{lb(s.kgPerWeek)}</span>.</>
      : <>Goal: maintain.</>;
  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-meta uppercase text-muted-foreground">Planned</p><p className="num font-black">{n(s.intake)} kcal</p></div>
        <div><p className="text-meta uppercase text-muted-foreground">Est. burn</p><p className="num font-black">{s.burn === null ? "–" : `${n(s.burn)} kcal`}</p></div>
      </div>
      <p className="text-muted-foreground">{goalLine}{s.burn === null
        ? <> Add sex, birth year and height (or body fat) on Profile to aim this at your estimated burn instead of the maintenance targets.</>
        : <> Measured against your estimated burn.</>}</p>
      {s.short && nut.goal === "lose" && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle className="font-black">This week can&apos;t reach the goal</AlertTitle>
          <AlertDescription>
            Keeping every day fuelled (at least {EA_FLOOR} kcal per kg of lean mass, enough carbs and your protein) and hard days within their carb band, this week comes to about <span className="num">{lb(s.kgPerWeek)}</span>. To lose faster, add a rest day or ease the volume. The burn is an estimate, so let your weight trend decide.
          </AlertDescription>
        </Alert>
      )}
      {s.short && nut.goal === "gain" && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle className="font-black">This week can&apos;t reach the goal</AlertTitle>
          <AlertDescription>
            At most <span className="num">{MAX_DAY_SURPLUS}</span> kcal is added to a day (more mostly adds fat), so this week comes to about <span className="num">{lb(s.kgPerWeek)}</span>. Lower the target, or let your weight trend show whether it&apos;s enough.
          </AlertDescription>
        </Alert>
      )}
      <p className={cn("font-extralight text-muted-foreground", s.eaAvg < EA_WARN && "font-black text-foreground")}>
        Energy availability: <span className="num">{Math.round(s.eaAvg)}</span> kcal/kg lean mass on average, lowest day <span className="num">{Math.round(s.eaMin)}</span>
        {s.eaAvg < EA_WARN ? ". That's low: watch for tiredness, illness or niggles, and eat more if they show up." : "."}
        {s.leanAssumed && <> Body fat assumed {ASSUMED_BODY_FAT}%; add yours on Profile.</>}
      </p>
      <p className="font-extralight text-muted-foreground">These are estimates. Your weight trend is the real check: adjust the goal if it doesn&apos;t move as planned.</p>
    </div>
  );
}

function WeekList({ days, kg, logs, summary }: { days: FuelDay[]; kg: number; logs: Record<string, FoodLog>; summary: WeekSummary | null }) {
  const { settings } = useApp();
  const unit = settings.units;
  const logged = days
    .filter((d) => logs[d.iso] && d.targets)
    .map((d) => ({ eaten: kcalOf(logs[d.iso].carbs, logs[d.iso].protein, logs[d.iso].fat), target: d.targets!.kcal }));
  const warn = underFuelled(logged);

  return (
    <Card className="gap-4 py-6">
      <CardHeader className="px-4 md:px-6"><CardTitle className="text-meta uppercase">This week</CardTitle></CardHeader>
      <CardContent className="flex flex-col px-4 md:px-6">
        {summary && <WeekPlan s={summary} kg={kg} />}
        {days.map((d) => {
          const t = d.targets!;
          const log = logs[d.iso];
          const eaten = log ? kcalOf(log.carbs, log.protein, log.fat) : null;
          const what = !d.inPlan ? "Outside your plan"
            : [d.runTitle && (d.runKm > 0 ? `${d.runTitle} ${dist(d.runKm, unit, 0)}` : d.runTitle), d.lift?.title].filter(Boolean).join(" + ") || "Rest";
          return (
            <div key={d.iso} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 border-b py-2 last:border-0">
              <span className="text-meta uppercase text-muted-foreground">{d.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate">{GEARS[d.gear].label}</span>
                <span className="truncate font-extralight text-muted-foreground">{what}</span>
                <span className="num text-meta text-muted-foreground">{fmtPerLb(t.carbs / kg)} g/lb carbs</span>
                {eaten !== null && <Bar value={eaten} target={t.kcal} color="var(--primary)" />}
              </div>
              <span className="num text-right">
                <span className="font-black">{n(t.kcal)}</span>
                <span className="block text-meta text-muted-foreground">{eaten === null ? "not logged" : `${Math.round((eaten / t.kcal) * 100)}% eaten`}</span>
              </span>
            </div>
          );
        })}
        {warn ? (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert aria-hidden />
            <AlertTitle className="font-black">Eat more</AlertTitle>
            <AlertDescription>Your last 3 logged days were all under 90% of target. Low energy availability raises injury risk.</AlertDescription>
          </Alert>
        ) : (
          <p className="pt-4 font-extralight text-muted-foreground">Under 90% of target for 3 days in a row? Eat more: low energy availability raises injury risk.</p>
        )}
      </CardContent>
    </Card>
  );
}
