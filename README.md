# Haji Training Block

Sub-threshold pace ranges from a 5k or 10k PB, a 12-week Norwegian Singles run plan, a 12-week
HYROX station program, and one-click sending to COROS or intervals.icu. Built with Next.js (App Router, static export), Tailwind CSS v4
and shadcn/ui. Design rules are in [DESIGN.md](DESIGN.md).

## What it does

- **Home**: sign in, create an account or continue as a guest.
- **Dashboard**: pick a day and see its run and HYROX session, or the next 3 or 7 days.
- **Run**: Norwegian Singles run plan, or Marius Bakken's Norwegian Method (two double threshold days, an X session, flat weeks, race-week checks; rules in [research/norwegian-method-bakken.md](research/norwegian-method-bakken.md)).
  - Weeks in 4-week blocks, three blocks to a 12-week period.
  - Mileage ramps (at most 5% a week) only in the periods you pick; other periods hold steady.
  - Lighter last week of each block, a taper week before each race and a race week, time off respected.
  - Sub-T rep counts sized from each week's volume, warm-up and cool-down, strides, estimated time.
  - Weekly volume chart (12 weeks at a time), Copy (Strava text), CSV, intervals.icu and COROS.
- **HYROX**: station and strength program (no running; that's the run plan), built from a coach's year of programming.
  - Each period: strength, station build, then race specific, with absorb weeks, benchmarks and the coach's race-week taper.
  - Box squat, bench and deadlift on the maintenance cycle (3×15 → 4×10 → 5×5) or off-season waves; other formats rotate week to week.
  - Weak stations per period get more volume, a phase-matched extra block and muscle-specific accessory work.
  - Workouts shown as lettered blocks with steps and cues. Copy, CSV and intervals.icu (as strength workouts).
- **Fuel**: daily carbs, protein, fat and calories that follow the day's training (carb "gears": rest 1.81, easy 2.49, hard 3.40, double threshold 4.08 g/lb; protein 0.73–0.91 g/lb; fat 25% of energy; every weight and rate is shown in pounds), a refuelling window on double threshold days, and a log of what you actually ate with the week against its targets. Rules in [research/nutrition-endurance-runner.md](research/nutrition-endurance-runner.md). Weight comes from Health Connect (7-day average) or Profile.
- **Profile**: PB and paces (VDOT), **Body & nutrition** (sex, birth year, height in ft/in, weight in lb, body fat %, protein, activity, goal), the shared **Season** (start and end, races, time off), and **Connections** (COROS, intervals.icu and Google Health Connect).
- **Weight and sleep**: the Dashboard shows your latest weigh-in (Renpho, in lb), 7-day average and weekly change, and last night's sleep with stages, sent from Android Health Connect by the HC Webhook app to the `health` Supabase Edge Function (setup in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)).
- **Accounts**: signed-in users' settings (profile, season, both plans) save to their account automatically and are private to them (Supabase, row-level security). Signed-in users' food logs save to their own `nutrition_logs` rows. Guests' plans and logs aren't saved.

## Develop

```sh
npm install
NEXT_PUBLIC_BASE_PATH="" npm run dev     # http://localhost:3000
npm run typecheck
```

## Build and deploy

`npm run build` writes a static site to `out/`. It's served under `/haji-training-block` by default; set
`NEXT_PUBLIC_BASE_PATH=""` to serve it from a root.

GitHub Pages deploys from `.github/workflows/deploy.yml` on every push to `main`. One-time
setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Accounts

Supabase project details live in `lib/supabase.ts`. You can override them with
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY`. The publishable key is meant to be
public: row-level security keeps each person's plans private. Setup steps and SQL are in
[SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Layout

```
app/            layout, page, fonts, globals.css (design tokens + Tailwind theme)
components/ui/  shadcn/ui primitives
components/     site-header, home-screen, app-provider, auth/, paces/, builder/, plans/, connections/
lib/            vdot, plan, settings, format, workout-text, intervals, coros, supabase
```

## The previous static site (kept for rollback)

`index.html`, `styles.css`, `app.js`, `config.js` and `vendor/` at the repo root are the previous
plain HTML/CSS/JS version. They're kept on purpose so you can switch back at any time:

- **Use the Next.js app:** Settings → Pages → Source: **GitHub Actions** (built by `deploy.yml`).
- **Go back to the old site:** Settings → Pages → Source: **Deploy from a branch**, branch `main`,
  folder `/ (root)`. GitHub then serves the root `index.html` again. The workflow keeps running on
  pushes but doesn't change what's live while Pages is set to deploy from a branch.

Both versions share saved settings in the browser and the same Supabase plans table.
