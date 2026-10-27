-- İmparatorluk v1 schema. Clients can only READ; every write goes through the `game` Edge Function
-- (service role), which runs the authoritative simulation (src/sim, bundled) and commits with
-- optimistic locking via commit_world(). Player emails live only in auth.users and are never exposed.
create extension if not exists pgcrypto;

create table public.game_config (
  id int primary key default 1 check (id = 1),
  access_hash text not null,               -- bcrypt of the founder-set entry password
  founder_user uuid references auth.users(id)
);
-- initial entry password: "imparator" (change it from the admin panel right away)
insert into public.game_config (id, access_hash) values (1, crypt('imparator', gen_salt('bf')));

create table public.world_state (
  id int primary key default 1 check (id = 1),
  state jsonb not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.world_snapshots (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  day int not null,
  state jsonb not null
);

create table public.players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id text not null,
  display_name text not null,
  is_founder boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigserial primary key,
  from_user uuid not null references auth.users(id) on delete cascade,
  from_person text not null,
  from_name text not null,
  to_person text,                    -- null = Meydan (public)
  text text not null check (char_length(text) <= 280),
  created_at timestamptz not null default now()
);
create index on public.messages (created_at desc);

-- ---------- RLS ----------
alter table public.game_config enable row level security;      -- no policies: service role only
alter table public.world_snapshots enable row level security;  -- service role only
alter table public.world_state enable row level security;
alter table public.players enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_active_player() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where user_id = auth.uid() and not banned);
$$;

create policy "players read the world" on public.world_state for select to authenticated using (public.is_active_player());
create policy "own player row" on public.players for select to authenticated using (user_id = auth.uid());
create policy "meydan + my DMs" on public.messages for select to authenticated using (
  public.is_active_player() and (
    to_person is null or from_user = auth.uid()
    or to_person = (select person_id from players where user_id = auth.uid())
  )
);

-- ---------- functions ----------
create or replace function public.check_access(pw text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from game_config where access_hash = crypt(pw, access_hash));
$$;
revoke all on function public.check_access(text) from public, anon, authenticated;

create or replace function public.set_access_password(pw text) returns void
language sql security definer set search_path = public, extensions as $$
  update game_config set access_hash = crypt(pw, gen_salt('bf')) where id = 1;
$$;
revoke all on function public.set_access_password(text) from public, anon, authenticated;

-- Optimistic-lock commit: succeeds only if nobody else committed since `expected` was read.
-- This makes the tick idempotent and safe under concurrent heartbeats (the sim itself only
-- processes whole game hours elapsed since state.lastTickAt).
create or replace function public.commit_world(new_state jsonb, expected bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update world_state set state = new_state, version = version + 1, updated_at = now()
   where id = 1 and version = expected;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.commit_world(jsonb, bigint) from public, anon, authenticated;

-- Snapshot every 3 real days, keep the last 8.
create or replace function public.snapshot_world(force boolean default false) returns boolean
language plpgsql security definer set search_path = public as $$
declare last timestamptz;
begin
  select max(created_at) into last from world_snapshots;
  if not force and last is not null and last > now() - interval '3 days' then return false; end if;
  insert into world_snapshots (day, state) select (state->>'day')::int, state from world_state where id = 1;
  delete from world_snapshots where id not in (select id from world_snapshots order by created_at desc limit 8);
  return true;
end $$;
revoke all on function public.snapshot_world(boolean) from public, anon, authenticated;

-- Live chat to clients
alter publication supabase_realtime add table public.messages;
