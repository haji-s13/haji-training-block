import test from "node:test";
import assert from "node:assert/strict";
import { isDone, normalizeCompleted, toggleDone } from "../lib/completed";
import { normalizeSettings } from "../lib/settings";

test("toggleDone switches a session on and off without touching others", () => {
  let c = toggleDone(undefined, "2026-12-02", "run");
  assert.deepEqual(c, { "2026-12-02": ["run"] });
  c = toggleDone(c, "2026-12-02", "lift");
  assert.equal(isDone(c, "2026-12-02", "lift"), true);
  const before = c;
  c = toggleDone(c, "2026-12-02", "run");
  assert.deepEqual(c, { "2026-12-02": ["lift"] });
  assert.deepEqual(before, { "2026-12-02": ["run", "lift"] }); // not mutated
  c = toggleDone(c, "2026-12-02", "lift");
  assert.deepEqual(c, {});
});

test("normalizeCompleted keeps valid dates and kinds only; settings carry it", () => {
  assert.deepEqual(normalizeCompleted({ "2026-12-02": ["run", "swim"], nope: ["run"], "2026-12-03": "run", "2026-12-04": [] }), { "2026-12-02": ["run"] });
  assert.deepEqual(normalizeCompleted(null), {});
  assert.deepEqual(normalizeSettings({ completed: { "2026-12-02": ["lift"] } }).completed, { "2026-12-02": ["lift"] });
});
