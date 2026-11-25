import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendar } from "../lib/calendar";
import { buildLifting, defaultLifting, MUSCLES } from "../lib/lifting";

const plan = buildLifting(defaultLifting(), buildCalendar("2026-11-30", "2027-04-30", [], []));
const full = plan.weeks.find((w) => w.phase === "Full sets")!;

test("a full week hits 20+ sets for every upper-body muscle; legs stay light", () => {
  for (const k of ["chest", "back", "sideDelts", "rearDelts", "biceps", "triceps"] as const) assert.ok((full.sets[k] ?? 0) >= 20, `${k}: ${full.sets[k]}`);
  for (const k of ["quads", "glutes", "hamstrings", "calves"] as const) assert.ok((full.sets[k] ?? 0) <= 6, `${k}: ${full.sets[k]}`);
  assert.ok(MUSCLES.filter((m) => m.target).every((m) => m.target![0] === 20));
});

test("no exercise is prescribed more than 4 sets", () => {
  for (const w of plan.weeks) for (const d of w.days) for (const b of d.blocks) {
    for (const m of b.text.matchAll(/(\d+) × /g)) assert.ok(Number(m[1]) <= 4, `${w.phase} ${d.title}: ${b.text}`);
  }
});
