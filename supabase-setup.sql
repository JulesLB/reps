-- REPS: one row per user holding the whole app blob.
-- Paste this into Supabase → SQL Editor → New query → Run.

create table if not exists app_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Cap the blob so no account can eat the database quota. 5 MB is roughly
-- a decade of daily sessions; a legitimate blob is tens of KB.
alter table app_data drop constraint if exists app_data_size_cap;
alter table app_data add constraint app_data_size_cap
  check (pg_column_size(data) < 5242880);

alter table app_data enable row level security;

-- A user can only ever see or touch their own row. auth.uid() is wrapped in
-- a subselect so Postgres evaluates it once per query, not once per row.
drop policy if exists "own row select" on app_data;
create policy "own row select" on app_data
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own row insert" on app_data;
create policy "own row insert" on app_data
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "own row update" on app_data;
create policy "own row update" on app_data
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
