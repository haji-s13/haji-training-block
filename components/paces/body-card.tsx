"use client";

import { useEffect, useRef, useState } from "react";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/plans/collapsible-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app-provider";
import { useBodyWeight } from "@/components/nutrition/use-body-weight";
import { ACTIVITY_LABELS, GEARS, GOAL_KCAL, fromInches, toInches, type Activity, type Goal, type NutritionSettings, type Sex, fmtPerLb } from "@/lib/nutrition";
import { fmtWeight, KG_PER_LB } from "@/lib/weight";

const GOALS: { value: Goal; label: string }[] = [
  { value: "lose", label: "Lose" },
  { value: "maintain", label: "Maintain" },
  { value: "gain", label: "Gain" },
];

/** A number typed as text, or undefined when empty; null when it isn't a valid number. */
function parse(text: string): number | undefined | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

const fmt = (v: number | undefined, digits: number) => (v === undefined ? "" : digits ? v.toFixed(digits) : String(v));

/** A number field that may be empty while typing. Saves only values inside [min, max]; shows the saved value again on blur. */
function NumField({ id, value, digits = 0, min, max, onSave, required, ...rest }: {
  id: string; value: number | undefined; digits?: number; min: number; max: number;
  onSave: (v: number | undefined) => void; required?: boolean;
  "aria-label"?: string; "aria-describedby"?: string; placeholder?: string;
}) {
  const [draft, setDraft] = useState(fmt(value, digits));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(fmt(value, digits)); }, [value, digits]);
  const p = parse(draft);
  const invalid = p === null || (p !== undefined && (p < min || p > max)) || (required && p === undefined);
  return (
    <Input id={id} className="num" type="text" inputMode={digits ? "decimal" : "numeric"} autoComplete="off" enterKeyHint="done"
      value={draft} aria-invalid={invalid || undefined} {...rest}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDraft(fmt(value, digits)); }}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = parse(e.target.value);
        if (v === null) return;
        if (v === undefined) { if (!required) onSave(undefined); return; }
        if (v < min || v > max) return;
        const f = 10 ** digits;
        onSave(Math.round(v * f) / f);
      }} />
  );
}

/** Profile inputs the Fuel tab needs: body measures, protein, activity and goal. */
export function BodyCard() {
  const { settings, update } = useApp();
  const n = settings.nutrition;
  const body = useBodyWeight();
  const set = (patch: Partial<NutritionSettings>) => update((s) => ({ nutrition: { ...s.nutrition, ...patch } }));

  // Feet and inches are typed separately; the height is saved once both make sense.
  const h = n.heightIn !== undefined ? fromInches(n.heightIn) : undefined;
  const [ft, setFt] = useState<number | undefined>(h?.ft);
  const [inch, setInch] = useState<number | undefined>(h?.inch);
  const typed = ft === undefined ? undefined : toInches(ft, inch ?? 0);
  // Follow the saved height when it changes elsewhere (e.g. settings loaded after sign-in), not while it matches what's typed.
  useEffect(() => {
    if (n.heightIn !== typed) { setFt(h?.ft); setInch(h?.inch); }
  }, [n.heightIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveHeight = (f: number | undefined, i: number | undefined) => {
    if (f === undefined) { set({ heightIn: undefined }); return; }
    const total = toInches(f, i ?? 0);
    if (total >= 36 && total <= 96) set({ heightIn: total });
  };

  const avg7 = body.synced?.avg7;
  const kg = body.kg;
  const protein = n.proteinPerKg;
  const lb = kg ? (kg / KG_PER_LB).toFixed(1) : null;

  return (
    <CollapsibleCard storageKey="body" title="Body & Nutrition"
      summary={[lb ? `${lb} lb` : null, n.bodyFat ? `${n.bodyFat}% body fat` : null, `${n.goal[0].toUpperCase()}${n.goal.slice(1)}`].filter(Boolean).join(" · ")}>
        <p className="max-w-[65ch] font-extralight text-muted-foreground">
          Fuel targets come from your weight and the day&apos;s training. Body fat, height, age and sex only feed the estimated daily burn shown on Fuel.
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="body-sex">Sex</Label>
            <Select value={n.sex ?? ""} onValueChange={(v) => set({ sex: v as Sex })}>
              <SelectTrigger id="body-sex" className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="body-birth-year">Birth year</Label>
            <NumField id="body-birth-year" value={n.birthYear} min={1900} max={new Date().getFullYear()} onSave={(v) => set({ birthYear: v })} placeholder="1994" />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="body-height-ft">Height</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <NumField id="body-height-ft" aria-label="Height, feet" value={ft} min={3} max={8} placeholder="5"
                  onSave={(v) => { setFt(v); saveHeight(v, inch); }} />
                <span className="text-muted-foreground">ft</span>
              </div>
              <div className="flex items-center gap-2">
                <NumField id="body-height-in" aria-label="Height, inches" value={inch} min={0} max={11} placeholder="10"
                  onSave={(v) => { setInch(v); saveHeight(ft, v); }} />
                <span className="text-muted-foreground">in</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="body-weight">Weight (lb)</Label>
            <NumField id="body-weight" value={n.weightLb} digits={1} min={60} max={600} aria-describedby="body-weight-note" placeholder="174.6"
              onSave={(v) => set({ weightLb: v })} />
            <p id="body-weight-note" className="font-extralight text-muted-foreground">
              {avg7 !== undefined ? (
                <><HeartPulse className="mr-1 inline size-4 align-[-2px]" aria-hidden />Fuel uses your Health Connect 7-day average: <span className="num">{fmtWeight(avg7, "lb")}</span></>
              ) : "Used for your Fuel targets. Connect Health Connect below to fill it in automatically."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="body-fat">Body fat (%)</Label>
            <NumField id="body-fat" value={n.bodyFat} digits={1} min={3} max={60} aria-describedby="body-fat-note" placeholder="14.0"
              onSave={(v) => set({ bodyFat: v })} />
            <p id="body-fat-note" className="text-meta uppercase text-muted-foreground">You enter this</p>
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="body-protein">Protein (g per lb of body weight)</Label>
            <NumField id="body-protein" value={Number(fmtPerLb(protein))} digits={2} min={Number(fmtPerLb(1))} max={Number(fmtPerLb(3))} required aria-describedby="body-protein-note"
              onSave={(v) => { if (v !== undefined) set({ proteinPerKg: Math.round((v / KG_PER_LB) * 100) / 100 }); }} />
            <p id="body-protein-note" className="max-w-[65ch] font-extralight text-muted-foreground">
              {kg && lb ? (
                <><span className="num">{fmtPerLb(protein)}</span> g/lb = <span className="num">{Math.round(protein * kg)}</span> g a day at <span className="num">{lb}</span> lb. </>
              ) : <><span className="num">{fmtPerLb(protein)}</span> g per lb of body weight. </>}
              Hard days go up to <span className="num">{fmtPerLb(GEARS.hard.protein)}</span>, double threshold days to <span className="num">{fmtPerLb(GEARS.double.protein)}</span>.
            </p>
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="body-activity">Day-to-day activity (outside training)</Label>
            <Select value={n.activity} onValueChange={(v) => set({ activity: v as Activity })}>
              <SelectTrigger id="body-activity" className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => <SelectItem key={a} value={a}>{ACTIVITY_LABELS[a]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <span id="body-goal" className="text-sm leading-none font-medium select-none">Goal</span>
            <div role="group" aria-labelledby="body-goal" className="grid grid-cols-3 gap-2">
              {GOALS.map((g) => (
                <Button key={g.value} type="button" variant={n.goal === g.value ? "default" : "outline"} aria-pressed={n.goal === g.value}
                  onClick={() => set({ goal: g.value })}>{g.label}</Button>
              ))}
            </div>
            <p className="max-w-[65ch] font-extralight text-muted-foreground">
              Lose takes <span className="num">{GOAL_KCAL}</span> kcal off rest and easy days only; hard and double threshold days stay fully fuelled. Gain adds <span className="num">{GOAL_KCAL}</span> kcal of carbs every day.
            </p>
          </div>
        </div>
    </CollapsibleCard>
  );
}
