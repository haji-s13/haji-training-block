-- What a signed-in person ate each day (the Fuel tab): grams of carbs, protein and fat.
-- One row per person per day. Only the owner can read or change their rows; guests (anon) have no access.
-- Applied by the "Supabase functions" workflow; you can also paste it into SQL Editor. Safe to run again.

create table if not exists public.nutrition_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  carbs numeric not null check (carbs >= 0 and carbs < 5000),
  protein numeric not null check (protein >= 0 and protein < 2000),
  fat numeric not null check (fat >= 0 and fat < 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.nutrition_logs enable row level security;

drop policy if exists "Read own food logs" on public.nutrition_logs;
drop policy if exists "Add own food logs" on public.nutrition_logs;
drop policy if exists "Edit own food logs" on public.nutrition_logs;
drop policy if exists "Delete own food logs" on public.nutrition_logs;
create policy "Read own food logs"   on public.nutrition_logs for select using (auth.uid() = user_id);
create policy "Add own food logs"    on public.nutrition_logs for insert with check (auth.uid() = user_id);
create policy "Edit own food logs"   on public.nutrition_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own food logs" on public.nutrition_logs for delete using (auth.uid() = user_id);

revoke all on public.nutrition_logs from anon;
grant select, insert, update, delete on public.nutrition_logs to authenticated;
