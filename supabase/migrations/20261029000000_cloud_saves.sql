-- v2.1.0 tek kişilik: optional cloud backup of a single-player save (one row per account).
-- Written only when the player presses "Buluta yedekle"; never touches world_state.
create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data text not null check (length(data) < 6000000), -- gzip + base64 of the save JSON
  day int not null default 0,
  name text not null default '',
  game text not null default '',
  size int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.cloud_saves enable row level security;
drop policy if exists "cloud_saves own select" on public.cloud_saves;
drop policy if exists "cloud_saves own insert" on public.cloud_saves;
drop policy if exists "cloud_saves own update" on public.cloud_saves;
drop policy if exists "cloud_saves own delete" on public.cloud_saves;
create policy "cloud_saves own select" on public.cloud_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "cloud_saves own insert" on public.cloud_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cloud_saves own update" on public.cloud_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cloud_saves own delete" on public.cloud_saves for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.cloud_saves from anon;
grant select, insert, update, delete on public.cloud_saves to authenticated;
