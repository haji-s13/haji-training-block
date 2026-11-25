# Renpho scale weight in the app

## Update 2 (25 Nov 2026): Health Connect, not Renpho login

The direct Renpho login (below) worked but signed Haji's Renpho phone app out, and the phone app
then invalidated the site's session: Renpho allows one session per account, and the phone app must
stay signed in for the scale to upload. Haji is on Android and asked for weight and sleep from
Google's health app instead.

- Google Fit REST APIs: no new sign-ups since 1 May 2024, supported "until the end of 2026"
  (https://developers.google.com/fit, https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq).
- Health Connect is on-device only; no web API. The Google Health API (https://developers.google.com/health)
  serves Fitbit/Pixel data, uses Restricted scopes needing a security review, and doesn't yet carry
  third-party Health Connect data such as Renpho's.
- Chosen: the open-source **HC Webhook** Android app (https://github.com/mcnaveen/health-connect-webhook,
  Play Store id `com.hcwebhook.app`) posts Health Connect data as JSON every 15+ minutes:
  `weight: [{kilograms, time}]`, `sleep: [{session_end_time, duration_seconds, stages: [{stage, start_time, end_time, duration_seconds}]}]`,
  with custom headers. The `health` Edge Function stores it; the Dashboard reads it.
- Stage names aren't documented ("enum toString()"); `lib/sleep.ts` accepts names or Health Connect's numbers.


**Date:** 25 Nov 2026
**Question:** How can weigh-ins from a Renpho smart scale reach the dashboard automatically?

## Update (25 Nov 2026): direct from Renpho

Haji asked for the weight straight from Renpho, in lb, with the login under Connections. The app
now uses Renpho's unofficial cloud API through a Supabase Edge Function
(`supabase/functions/renpho`), because Renpho's servers can't be called from a browser.

Protocol, from [ChocoTonic/renpho-py](https://github.com/ChocoTonic/renpho-py) (`constants.py`,
`crypto.py`, `client.py`) and [p1ranha/renpho-bridge](https://github.com/p1ranha/renpho-bridge):

- Every call: `POST https://cloud.renpho.com/<path>` with `{"encryptData": base64(AES-128-ECB(JSON))}`,
  PKCS7 padding, key `ed*wijdi$h6fe3ew`; responses carry `data` encrypted the same way.
  Headers `appVersion: 6.6.0`, `platform: android`; after login also `token` and `userId`.
- Login: `renpho-aggregation/user/login` → `data.login.token`, `data.login.id`. `areaCode` is the account region.
- Weights: `RenphoHealth/scale/queryBodyCompositionMeasureData` (falls back to
  `RenphoHealth/scale/queryAllMeasureDataList`), body `{pageNum, pageSize, userIds:[id], tableName:"measurements_info_<id mod 24>"}`.
  Records have `weight` (kg) and `timeStamp` (seconds; ms handled too).

Risks (renpho-bridge README): each login starts a new session and **can sign the Renpho phone app
out**; repeated failed logins **can lock the account**. So the app logs in only when the user
presses Sign in, keeps the token, and never retries a failed login. Unofficial, so it may break when
Renpho changes its app. Not yet tested against a live account.

## Earlier answer (intervals.icu route, replaced)

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
