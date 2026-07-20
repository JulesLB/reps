-- REPS: one row per user holding the whole app blob.
-- Paste this into Supabase → SQL Editor → New query → Run.

create table if not exists app_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

-- A user can only ever see or touch their own row.
drop policy if exists "own row select" on app_data;
create policy "own row select" on app_data
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on app_data;
create policy "own row insert" on app_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on app_data;
create policy "own row update" on app_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at honest so last-write-wins can be reasoned about.
create or replace function touch_app_data() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_data_touch on app_data;
create trigger app_data_touch before update on app_data
  for each row execute function touch_app_data();
