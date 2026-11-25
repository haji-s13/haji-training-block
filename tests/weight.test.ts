import test from "node:test";
import assert from "node:assert/strict";
import { fmtWeight, fmtWeightChange, summarize, weighIns } from "../lib/weight";

test("weighIns keeps rows with a weight, oldest first", () => {
  const list = weighIns([{ id: "2026-11-03", weight: 80 }, { id: "2026-11-01", weight: 81 }, { id: "2026-11-02", weight: null }, { id: "2026-11-04" }]);
  assert.deepEqual(list, [{ date: "2026-11-01", kg: 81 }, { date: "2026-11-03", kg: 80 }]);
});

test("summarize: latest, 7-day average and change vs the week before", () => {
  const s = summarize(weighIns([
    { id: "2026-11-10", weight: 82 }, { id: "2026-11-12", weight: 81 },  // previous 7 days (avg 81.5)
    { id: "2026-11-18", weight: 80.5 }, { id: "2026-11-20", weight: 79.5 }, // this week (avg 80)
  ]))!;
  assert.equal(s.latest.kg, 79.5);
  assert.equal(s.avg7, 80);
  assert.equal(s.weekChange, -1.5);
});

test("summarize: no previous week → no change; empty → null", () => {
  assert.equal(summarize(weighIns([{ id: "2026-11-20", weight: 80 }]))!.weekChange, null);
  assert.equal(summarize([]), null);
});

test("units", () => {
  assert.equal(fmtWeight(80, "km"), "80.0 kg");
  assert.equal(fmtWeight(80, "mi"), "176.4 lb");
  assert.equal(fmtWeightChange(-1.5, "km"), "−1.5 kg");
  assert.equal(fmtWeightChange(0.02, "km"), "±0.0 kg");
});
