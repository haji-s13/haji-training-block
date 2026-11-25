import test from "node:test";
import assert from "node:assert/strict";
import { dailyWeighIns, fmtWeight, fmtWeightChange, summarize } from "../lib/weight";

const at = (day: string, h: number) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00`).getTime();

test("dailyWeighIns keeps the last weigh-in of each day, oldest first", () => {
  const list = dailyWeighIns([
    { ts: at("2026-11-03", 7), kg: 80 }, { ts: at("2026-11-03", 21), kg: 81 },
    { ts: at("2026-11-01", 7), kg: 82 }, { ts: at("2026-11-02", 7), kg: 0 },
  ]);
  assert.deepEqual(list.map((w) => [w.date, w.kg]), [["2026-11-01", 82], ["2026-11-03", 81]]);
});

test("summarize: latest, 7-day average and change vs the week before", () => {
  const s = summarize(dailyWeighIns([
    { ts: at("2026-11-10", 7), kg: 82 }, { ts: at("2026-11-12", 7), kg: 81 },   // previous 7 days (avg 81.5)
    { ts: at("2026-11-18", 7), kg: 80.5 }, { ts: at("2026-11-20", 7), kg: 79.5 }, // this week (avg 80)
  ]))!;
  assert.equal(s.latest.kg, 79.5);
  assert.equal(s.avg7, 80);
  assert.equal(s.weekChange, -1.5);
});

test("summarize: no previous week → no change; empty → null", () => {
  assert.equal(summarize(dailyWeighIns([{ ts: at("2026-11-20", 7), kg: 80 }]))!.weekChange, null);
  assert.equal(summarize([]), null);
});

test("units", () => {
  assert.equal(fmtWeight(80, "kg"), "80.0 kg");
  assert.equal(fmtWeight(80, "lb"), "176.4 lb");
  assert.equal(fmtWeightChange(-1.5, "kg"), "−1.5 kg");
  assert.equal(fmtWeightChange(-1.5, "lb"), "−3.3 lb");
});
