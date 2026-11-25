/* Sessions marked complete on the Dashboard: which days' run and lifting session are done. */

export type DoneKind = "run" | "lift";
/** ISO date → the sessions done that day. */
export type Completed = Record<string, DoneKind[]>;

const KINDS: DoneKind[] = ["run", "lift"];

/** Keeps valid dates and kinds only. */
export function normalizeCompleted(raw: unknown): Completed {
  const out: Completed = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [day, kinds] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(kinds)) continue;
    const k = KINDS.filter((x) => kinds.includes(x));
    if (k.length) out[day] = k;
  }
  return out;
}

export const isDone = (c: Completed | undefined, day: string, kind: DoneKind) => !!c?.[day]?.includes(kind);

/** A copy with `kind` on `day` switched on or off. */
export function toggleDone(c: Completed | undefined, day: string, kind: DoneKind): Completed {
  const next: Completed = { ...(c ?? {}) };
  const has = isDone(next, day, kind);
  const kinds = has ? next[day].filter((k) => k !== kind) : [...(next[day] ?? []), kind];
  if (kinds.length) next[day] = kinds; else delete next[day];
  return next;
}
