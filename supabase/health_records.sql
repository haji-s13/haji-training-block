-- Weight, sleep and nutrition sent from the phone (Health Connect → HC Webhook app → the `health` Edge Function).
-- Rows are keyed by a SHA-256 hash of the person's private sync key, never the key itself.
-- Only the Edge Function (service role) reads or writes; browsers have no direct access.
-- Applied by the "Supabase functions" workflow; safe to run again.

create table if not exists public.health_records (
  key_hash text not null,
  kind text not null check (kind in ('weight', 'sleep')),
  -- weight: the weigh-in time; sleep: when the session ended (wake-up)
  at timestamptz not null,
  data jsonb not null,
  received_at timestamptz not null default now(),
  primary key (key_hash, kind, at)
);

alter table public.health_records enable row level security;
revoke all on public.health_records from anon, authenticated;
grant select, insert, update, delete on public.health_records to service_role;

-- Nutrition from Health Connect (e.g. MyFitnessPal meal summaries): one row per Health Connect record,
-- keyed by its record id so edits replace it and deletions remove it. Read back as daily totals.
create table if not exists public.health_nutrition (
  key_hash text not null,
  record_id text not null,
  -- when the meal (record) starts
  at timestamptz not null,
  -- { kcal, carbs, protein, fat } in kcal and grams, plus meal and source app when known
  data jsonb not null,
  received_at timestamptz not null default now(),
  primary key (key_hash, record_id)
);
create index if not exists health_nutrition_key_at on public.health_nutrition (key_hash, at);

alter table public.health_nutrition enable row level security;
revoke all on public.health_nutrition from anon, authenticated;
grant select, insert, update, delete on public.health_nutrition to service_role;
