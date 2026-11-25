# CLAUDE.md

Guidance for Claude Code in this repo.

## Project

Haji Training Block: a HYROX + Norwegian Singles Method planner (a copy of haji-s13/NSM). Next.js (App Router, static export), Tailwind v4,
shadcn/ui, Supabase for accounts. See [README.md](README.md) for features and
[DESIGN.md](DESIGN.md) for UI rules (DESIGN.md wins over defaults; the user's words win over DESIGN.md).

- `lib/vdot.ts` paces from a PB (VDOT) · `lib/plan.ts` Norwegian Singles run plan ·
  `lib/lifting.ts` 4-day lifting routine (the Lifting tab, from `research/lifting-4-day-norwegian-doubles.md`) · `lib/hyrox.ts` HYROX station program (no longer shown) · `lib/coros.ts`, `lib/intervals.ts` device/platform export ·
  `lib/supabase.ts`, `supabase/*.sql` accounts and session library.
- Root `index.html`, `app.js`, `styles.css`, `config.js`, `vendor/` are the old static site, kept for
  rollback. Don't edit them unless asked.

## Commands

```sh
npm install
NEXT_PUBLIC_BASE_PATH="" npm run dev   # http://localhost:3000
npm run typecheck                      # run before every commit
npm run build                          # static site in out/
```

## Research agent

A `researcher` subagent lives in `.claude/agents/researcher.md`. Use it (or ask "use the
researcher agent to …") before changing training logic or integrations when the right answer
depends on outside facts, e.g.:

- Norwegian Singles / sub-threshold rules: rep lengths, paces, weekly structure, volume ramps.
- VDOT / Daniels pace formulas, race-time equivalence.
- HYROX: stations, standards, divisions, weights, race format changes.
- COROS and intervals.icu APIs: endpoints, workout formats, auth, limits.

Research rules (also apply when researching without the subagent):

1. Prefer primary sources: original coach writing (e.g. Marius Bakken, sirpoc84 / the Norwegian
   Singles threads), Jack Daniels' Running Formula, official HYROX rulebooks, official API docs.
2. Cite every claim with a link. Mark anything unsourced or disputed as such.
3. Compare findings with what the code does today and name the file and line where they differ.
4. Save lasting findings to `research/<topic>.md` (date, question, answer, sources, impact on code).
   Check `research/` first so work isn't repeated.
5. Research doesn't change code. Code changes happen after the findings are reviewed.

## Conventions

- TypeScript, functional React components, shadcn/ui primitives from `components/ui/`.
- Tabular numerals on every pace, time and distance.
- Keep plan logic in `lib/` pure and UI-free.

## Swarm workflow

Four more subagents live in `.claude/agents/`: `explorer` (Haiku, read-only), `implementer`
(Opus 5.5), `tester` (Sonnet) and `reviewer` (Opus, read-only). How they're set up and tuned:
[.claude/SWARM.md](.claude/SWARM.md).

You are the lead. For any task bigger than a small single-file fix, delegate:

1. **Explore:** send `explorer` subagents in parallel, one per area of the code you need to understand. If the change depends on outside facts, send `researcher` too (see above).
2. **Plan:** write a short plan yourself and split it into independent changes.
3. **Build:** give each change to an `implementer` with the exact files, the goal and the checks (`npm run typecheck`, `npm run build`). Run implementers in parallel only when they touch different files.
4. **Test:** there's no test framework yet, so only use `tester` when the task asks for tests. Adding one (for example Vitest) is a dependency change: confirm it with the user first.
5. **Review:** ask `reviewer` to check the full diff. Verify each finding yourself before fixing it.
6. **Finish:** summarise what changed and the final typecheck and build results.

Subagents do not see this conversation, so every task you hand off must include the file paths,
the goal, constraints (DESIGN.md for UI work, the conventions above) and the check commands.
Do small tasks yourself; delegating has overhead.
