# Accounts and saved plans (Supabase)

The planner's sign-in and saved plans use a free [Supabase](https://supabase.com) project.
Until it's configured, the home page offers **Continue as guest** only.

## 1. Create the project

1. Sign up at supabase.com and create a new project (the free plan is enough).
2. Wait for it to finish setting up.

## 2. Create the plans table

Open **SQL Editor → New query**, paste this, and click **Run**:

```sql
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "Read own plans"   on public.plans for select using (auth.uid() = user_id);
create policy "Add own plans"    on public.plans for insert with check (auth.uid() = user_id);
create policy "Edit own plans"   on public.plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own plans" on public.plans for delete using (auth.uid() = user_id);

create index if not exists plans_user_updated on public.plans (user_id, updated_at desc);

-- Let signed-in users use the table through the API (row-level security still limits them to their own rows).
grant select, insert, update, delete on public.plans to authenticated;
```

Row-level security means each signed-in person can only see and change their own plans. Visitors who aren't signed in get no access at all.

If you created the table before the `grant` line was added to this guide, run just that line on its own.

## 3. Set the site address

Open **Authentication → URL Configuration**:

- **Site URL**: `https://haji-s13.github.io/haji-training-block/`
- **Redirect URLs**: add `https://haji-s13.github.io/haji-training-block/**`
  (the `**` also covers `?reset=1`, which password-reset links use)

This is where the "confirm your email" and "reset password" links send people.
If a reset link opens the planner's home page instead of **Set a new password**, this
redirect URL is missing.

## 4. Connect the planner

Open **Project Settings → API** (or **Data API**) and copy:

- **Project URL** (for example `https://abcd1234.supabase.co`)
- **anon public** key (or the **publishable** key)

Put them in `config.js`:

```js
window.NSM_CONFIG = {
  supabaseUrl: "https://abcd1234.supabase.co",
  supabaseAnonKey: "eyJ...",
};
```

Never use the **service_role** / secret key here: it bypasses row-level security.

Commit and push, and the home page shows sign-in and create-account.

## HYROX session library

The HYROX plan picks its Quality (long and short) and aerobic sessions from a library. The app
ships with a built-in copy, so it works before this step. To keep the library in your database
and let signed-in users add their own sessions:

1. Open **SQL Editor → New query**.
2. Paste the contents of [`supabase/hyrox_sessions.sql`](supabase/hyrox_sessions.sql) and click **Run**.

It creates the `hyrox_sessions` table with row-level security (everyone can read the built-in
sessions; each signed-in person can add, edit and delete only their own) and loads the built-in
sessions from the coach's year review. It's safe to run again: built-in sessions are updated,
your own sessions are kept.

If you change `lib/session-library.ts`, regenerate the file with `npx tsx scripts/gen-session-sql.ts`
and run it again.

## Account settings (required for saving)

Signed-in users' profile, season, run plan and HYROX plan save to their account automatically.
Guests' plans are not saved anywhere. Run [`supabase/user_settings.sql`](supabase/user_settings.sql)
once (SQL Editor → New query → paste → Run). It creates `user_settings`, one row per account,
with row-level security so only the owner can read or change it; guests have no access.

The first time someone signs in after this, their newest plan from the old "My plans" list is
copied into their account settings. The old `plans` table is no longer used by the app and can
be kept or dropped.

## Weight and sleep from Health Connect (Edge Function)

The Dashboard's Weight and Sleep cards read from the `health` Edge Function
(`supabase/functions/health`). The phone's HC Webhook app posts Health Connect data to it with a
private key (header `X-Health-Key`); only a SHA-256 hash of the key is stored, in the
`health_records` table (`supabase/health_records.sql`), which browsers can't read directly.

The **Supabase functions** GitHub workflow creates the table and deploys the function on every push to
`main` that touches them (repo secret `SUPABASE_ACCESS_TOKEN` from supabase.com → Account → Access
Tokens). By hand: run `supabase/health_records.sql` in the SQL Editor, then
`npx supabase functions deploy health --no-verify-jwt --project-ref ykfkgmoltgpxjonvomgw`.

## Food logs (Fuel tab)

What signed-in users eat each day saves to `nutrition_logs` (`supabase/nutrition_logs.sql`): one
row per user per day, readable and editable only by its owner (row-level security); guests have no
access. The **Supabase functions** workflow creates it along with `health_records`. By hand: run
`supabase/nutrition_logs.sql` in the SQL Editor.

The older `renpho` function (direct Renpho login) is no longer used; delete it from the Supabase
dashboard if you like.
