import test from "node:test";
import assert from "node:assert/strict";
import { avgAsleep, fmtSleep, nights, stageKind } from "../lib/sleep";

test("stageKind reads names and Health Connect numbers", () => {
  assert.equal(stageKind("STAGE_TYPE_DEEP"), "deep");
  assert.equal(stageKind("rem"), "rem");
  assert.equal(stageKind("LIGHT"), "light");
  assert.equal(stageKind("OUT_OF_BED"), "awake");
  assert.equal(stageKind("SLEEPING"), "asleep");
  assert.equal(stageKind("5"), "deep");
  assert.equal(stageKind("6"), "rem");
  assert.equal(stageKind("1"), "awake");
});

test("nights: stages minus awake, one entry per wake-up day", () => {
  const ns = nights([
    { end: "2026-11-24T06:30:00", start: "2026-11-23T22:30:00", sec: 28800, stages: [
      { stage: "DEEP", start: "", end: "", sec: 3600 }, { stage: "REM", start: "", end: "", sec: 5400 },
      { stage: "LIGHT", start: "", end: "", sec: 18000 }, { stage: "AWAKE", start: "", end: "", sec: 1800 } ] },
    { end: "2026-11-25T07:00:00", start: null, sec: 25200, stages: [] },
    { end: "2026-11-25T15:00:00", start: null, sec: 1800, stages: [] }, // nap
  ]);
  assert.equal(ns.length, 2);
  assert.equal(ns[0].asleep, 27000);
  assert.equal(ns[0].stages.deep, 3600);
  assert.equal(ns[1].asleep, 27000);
  assert.equal(avgAsleep(ns), 27000);
  assert.equal(fmtSleep(27000), "7 h 30 min");
});

test("nights: the same night from two apps counts once", () => {
  const a = { end: "2026-11-24T06:30:00", start: "2026-11-23T22:30:00", sec: 28000, stages: [] };
  const b = { end: "2026-11-24T06:25:00", start: "2026-11-23T22:40:00", sec: 27900, stages: [] };
  const ns = nights([a, b]);
  assert.equal(ns.length, 1);
  assert.equal(ns[0].asleep, 28000);
});
