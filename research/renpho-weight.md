# Renpho scale weight in the app

**Date:** 25 Nov 2026
**Question:** How can weigh-ins from a Renpho smart scale reach the dashboard automatically?

## Answer

Renpho has no official public API, and it doesn't sync to intervals.icu or Garmin Connect directly.
The app already talks to intervals.icu with the user's API key, and intervals.icu stores daily
weight in its wellness data, so the dashboard reads weight from there. Getting Renpho into
intervals.icu takes one bridge, set up once on the phone:

| Route | Cost | Notes |
|---|---|---|
| Renpho → Apple Health → HealthFit → intervals.icu | HealthFit is a one-time paid app | Reported working on the intervals.icu forum. RunGap and BreakAway do the same. |
| Renpho → MyFitnessPal → Garmin Connect → intervals.icu | Free | Needs a Garmin Connect account. intervals.icu pulls Garmin weight ("bodyComps") when weight is ticked in its Garmin settings. |
| Renpho → Apple Health → Apple Shortcuts automation → intervals.icu API | Free | `PUT /api/v1/athlete/0/wellness-bulk` with `[{"id":"YYYY-MM-DD","weight":kg}]`. |
| Unofficial Renpho cloud API | Free | Rejected: undocumented, has changed before, needs the Renpho password stored on a server, and can't be called from a static site. |

## Sources

- Renpho → intervals.icu routes: https://forum.intervals.icu/t/integration-with-renpho/86197
- intervals.icu pulls Garmin weight automatically (staff reply): https://forum.intervals.icu/t/sync-weight-with-smart-scale/27162
- Renpho doesn't connect directly to Garmin Connect (vendor page, treat with care): https://weightsyncr.com/renpho-scale-garmin-connect-sync-guide
- Wellness read/write endpoints, metric units, API key with Basic auth: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090

## Impact on code

- `lib/intervals.ts` `icuWellness()` reads `/wellness?oldest=&newest=`.
- `lib/weight.ts` turns rows into weigh-ins, the 7-day average and the week-on-week change (kg, or lb when units are miles).
- `components/dashboard/weight-card.tsx` shows it on the Dashboard and checks again every 5 minutes and when the tab is shown.
