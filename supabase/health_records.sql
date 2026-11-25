-- Weight and sleep sent from the phone (Health Connect → HC Webhook app → the `health` Edge Function).
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
