# HC Webhook: forwarding Health Connect nutrition

- Date: 2026-11-25
- Question: Can the HC Webhook Android app (`com.hcwebhook.app`) read Health Connect `NutritionRecord`s
  and forward them to our `health` Edge Function? If so: is it a selectable type, which permission,
  the exact JSON shape and units, and the sync/history limits? Secondary: does MyFitnessPal write
  `NutritionRecord`s to Health Connect (per meal / per food / daily; free vs Premium)?

## Answer

Yes. Nutrition is one of HC Webhook's supported data types [1], the app declares
`android.permission.health.READ_NUTRITION` [2], and it is picked like any other type in the
Grant Permissions flow [3]. It arrives as a top-level `nutrition` array of interval records
(`start_time`, `end_time`), with energy in kcal (`calories`) and macros in grams
(`protein_grams`, `carbs_grams`, `fat_grams`, ...), optional `name` and `meal_type`, and a nested
`metadata` object carrying the Health Connect record id [4]. Background/manual syncs read a rolling
48-hour window, minimum interval 15 minutes [3][4].

MyFitnessPal (Android 10+, app 22.22.0+) does write to Health Connect as **meal summaries** (one
entry per meal, not per food, not a daily total), starting from the day the accounts are linked
[5][6]. No source found says Health Connect sync needs Premium. The only Premium-gated item found
is per-food names inside meal summaries, and that is documented for the Fitbit / Google Health app
connection, not for Health Connect [7]. See caveats below: the MyFitnessPal help pages could not be
opened directly from this session, so MyFitnessPal claims rest on search-result extracts.

## Details

### HC Webhook (primary: the project's own repo docs and manifest)

- Supported types include "Nutrition (calories, protein, carbs, fat, sugar, sodium, fiber, name)" [1].
- Manifest declares `android.permission.health.READ_NUTRITION`, plus
  `READ_HEALTH_DATA_IN_BACKGROUND` and `READ_HEALTH_DATA_HISTORY` [2].
- Setup: "tap **Grant Permissions**, pick the data types you want, and approve them in Health
  Connect" [3]. Nutrition must be ticked there; it is not sent unless granted.

Payload (from `docs/webhook.md` [4]):

- Root object: `timestamp` (when the payload was built, not the record range), `app_version`,
  `timezone` (`UTC` or the phone zone, e.g. `Asia/Kolkata`), one array per enabled type that has
  records, and optional `deleted`. "Arrays are never empty: if a type has no data for this sync, the
  key is omitted entirely." [4]
- `nutrition[]` fields [4]:

| Field | Type | Notes |
|---|---|---|
| `start_time` | string, required | ISO-8601, interval start |
| `end_time` | string, required | ISO-8601, interval end |
| `calories` | number, optional | kilocalories |
| `protein_grams`, `carbs_grams`, `fat_grams`, `sugar_grams`, `sodium_grams`, `dietary_fiber_grams` | number, optional | grams (note sodium is grams, not mg) |
| `energy_from_fat_calories` | number, optional | kcal |
| `name` | string, optional | meal or item label if the source app set one |
| `meal_type` | string, optional | `breakfast` / `lunch` / `dinner` / `snack`; omitted for unknown meal types and for merged (bucketed or daily) records |
| further nutrients (saturated fat, vitamins, minerals ... `chloride_grams`) | number, optional | grams, only when the writing app set them |
| `metadata` | object | `id` (Health Connect record id, "use it to deduplicate and to apply edits and `deleted`"), `client_record_id`, `data_origin` (package name of the writing app), `last_modified_time` |

- Illustrative example given by the doc (values invented by the doc author) [4]:

```json
{ "nutrition": [ { "start_time": "2026-05-09T12:00:00Z", "end_time": "2026-05-09T12:30:00Z",
  "calories": 520, "protein_grams": 25, "name": "Lunch", "meal_type": "lunch" } ] }
```

- Times: ISO-8601 following the in-app **Payload timestamps** setting. "New installs default to
  **Local time**" (e.g. `2026-05-09T18:04:56.789+05:30`); older installs keep UTC (`...Z`) [4].
  `Date.parse` handles both.
- `deleted[]`: `{ type, id }` where `type` is the payload key (e.g. `nutrition`) and `id` matches
  `metadata.id` of the record sent earlier [4].
- The doc mentions "merged (bucketed or daily)" nutrition records that sum nutrients, but does not
  document a nutrition resolution setting or whether merged records keep `metadata.id` [4].
  Unconfirmed.

Limits [3][4]:

- Interval sync minimum 15 minutes ("30–60 min suits most cases"); or scheduled times (defaults 08:00 and 21:00) [3].
- Background and manual syncs read a rolling 48-hour window and send only records new/changed since
  the last successful sync per type; the first sync has no watermark, so everything in the 48 h
  window can appear [4]. Change reads look back at most 31 days per type per sync [4].
- No documented first-sync backfill beyond 48 h. An "explicit range" (chosen start/end, or the local
  HTTP server's `?days=N`) reads the full requested window without change tracking; no maximum is
  documented [3][4].
- Failed posts retry a few times with backoff, then are kept in an on-device outbox (up to 16 MB per
  webhook) and sent first on the next sync with `syncType` `outbox` [4].
- A second trigger within a minute of the last accepted one is ignored [1].

### MyFitnessPal -> Health Connect (secondary question)

- Requirements: Android 10+ and MyFitnessPal Android 22.22.0+; not on iOS [5]. (From MyFitnessPal's
  Health Connect FAQ, seen as a search extract; page could not be opened here.)
- Granularity: "meal summaries will sync starting on the day the two accounts are linked" [5].
  Custom meal names do not sync; foods under a custom heading appear under "Other" as one sync [5].
  So expect one `NutritionRecord` per meal (Breakfast/Lunch/Dinner/Snacks), not per food and not a
  daily total. Not confirmed from the HC side how the record's time is set; MyFitnessPal's Apple
  Health FAQ says timestamps do not sync there [8], so meal times may be fixed placeholder times
  rather than when you ate. Unconfirmed for Health Connect.
- Fields: a third-party vendor (Sahha, secondary) says MyFitnessPal writes calories, protein, carbs,
  fat, fiber, sugar, plus sodium and cholesterol where logged [6].
- Sync timing: periodically through the day, or force via More > Sync [5].
- Free vs Premium: no source found that gates Health Connect sync behind Premium; the Premium
  features page lists, from 26 May 2026, syncing individual food names within meal summaries to
  Fitbit and the Google Health app for Premium/Premium+ [7]. That is a different connection.
  Treat "Health Connect nutrition sync is free" as likely but unconfirmed.
- Google's help centre notes some apps, including MyFitnessPal, can report the same meal through
  more than one connection (search extract, not opened) [9]. Relevant if the user also links MFP
  to Fitbit/Google Health: duplicates can land in Health Connect from two `data_origin`s.

## Impact on the app

- `supabase/functions/health/index.ts:38` `Row.kind` is `"weight" | "sleep"`; add `"nutrition"`.
- `supabase/health_records.sql:8` check constraint `kind in ('weight','sleep')` must allow
  `'nutrition'` (migration needed, otherwise inserts fail with a storage error).
- `supabase/functions/health/index.ts:42-67` `rowsFrom()` ignores `body.nutrition`. Add a loop:
  `at = iso(n.start_time)`, store `{ end: iso(n.end_time), kcal: n.calories, protein_g:
  n.protein_grams, carbs_g: n.carbs_grams, fat_g: n.fat_grams, meal: n.meal_type, name: n.name,
  id: n.metadata?.id, origin: n.metadata?.data_origin }`, with sanity bounds (e.g. kcal 0-10000).
- Primary key `(key_hash, kind, at)` (`supabase/health_records.sql:13`) and the dedupe map at
  `index.ts:65` key on time. Two meals with the same `start_time` (likely if MFP uses fixed meal
  times, or two apps write the same meal) would overwrite each other. Options: put `metadata.id`
  into the key (e.g. dedupe nutrition on `id` and store `at` = start_time + a separate `rid` column),
  or aggregate per (day, meal_type, origin). Needs a decision.
- `deleted[]` is ignored today (`index.ts` has no handler). For nutrition this matters: editing a meal
  in MFP can delete and rewrite the record. Handling `deleted` with `type: "nutrition"` needs the
  record id stored (see previous point).
- Edits: a changed meal is re-sent with the same `metadata.id` [4]; upsert by id handles it, upsert by
  time only works if the time didn't change.
- `index.ts:84-95` `read()` returns only weight and sleep; add `q("nutrition", N)` and include it in
  `lastSync`.
- `lib/health.ts:5` `HealthData` needs a `nutrition` field (e.g. `{ start, end, kcal, protein_g,
  carbs_g, fat_g, meal?, origin? }[]`), and `lib/health.ts:26` `healthRead()` must pass it through.
  Daily totals should be summed client-side by local date (payload times may be UTC or local offset).
- `MAX_ROWS` 2000 / `MAX_BODY` 2 MB are ample for a 48 h nutrition window (a handful of meal records).
- Matches today: auth via custom header (`X-Health-Key`) works the same; ISO-8601 parsing via
  `iso()` handles both UTC and offset timestamps; unknown keys like `nutrition` are already ignored
  safely, so enabling Nutrition in the phone app before the code change does no harm.
- Units: no conversion needed for display in kcal/g; note `sodium_grams` is grams (x1000 for mg).

## Open questions

- How MyFitnessPal sets `startTime`/`endTime` and `mealType` on its Health Connect records (actual
  times vs fixed slots). Best checked from a real payload once Nutrition is enabled.
- Whether MFP Health Connect nutrition is free-tier (likely; not stated by an opened primary source).
- How HC Webhook's "merged (bucketed or daily)" nutrition records are produced and whether they keep
  `metadata.id` [4].
- support.myfitnesspal.com, support.google.com and sahha.ai could not be fetched from this session
  (DNS blocked); those claims come from search extracts and should be re-checked if those domains
  are allowed.

## Sources

1. HC Webhook features, mcnaveen/health-connect-webhook `docs/features.md`, accessed 2026-11-25, https://raw.githubusercontent.com/mcnaveen/health-connect-webhook/main/docs/features.md
2. HC Webhook AndroidManifest.xml, accessed 2026-11-25, https://raw.githubusercontent.com/mcnaveen/health-connect-webhook/main/app/src/main/AndroidManifest.xml
3. HC Webhook usage, `docs/usage.md`, accessed 2026-11-25, https://raw.githubusercontent.com/mcnaveen/health-connect-webhook/main/docs/usage.md
4. HC Webhook payload reference, `docs/webhook.md` (and `docs/api-reference.md`), accessed 2026-11-25, https://raw.githubusercontent.com/mcnaveen/health-connect-webhook/main/docs/webhook.md
5. Health Connect FAQ and Troubleshooting, MyFitnessPal Help (search extract only), https://support.myfitnesspal.com/hc/en-us/articles/10553948248973-Health-Connect-FAQ-and-Troubleshooting
6. MyFitnessPal Integration, Sahha (secondary, vendor; search extract only), https://sahha.ai/integrations/myfitnesspal/
7. What are the features of MyFitnessPal Premium, MyFitnessPal Help (search extract only), https://support.myfitnesspal.com/hc/en-us/articles/360032625951-what-are-the-features-of-myfitnesspal-premium
8. Apple Health connection and syncing, MyFitnessPal Help (search extract only), https://support.myfitnesspal.com/hc/en-us/articles/360032271092-Apple-Health-FAQ-and-Troubleshooting
9. Connect third-party devices & apps to the Google Health app, Google Health Help (search extract only), https://support.google.com/googlehealth/answer/14236613?hl=en
