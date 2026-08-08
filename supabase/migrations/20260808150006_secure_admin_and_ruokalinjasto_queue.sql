-- Secure application roles. The client may read its role but never assign one.
update public.users
set role = 'user'
where role is null;

alter table public.users
  alter column role set default 'user',
  alter column role set not null;

alter table public.users
  add constraint users_role_allowed
  check (role in ('user', 'admin'));

revoke insert, update, delete, truncate, references, trigger
  on table public.users from anon, authenticated;
grant insert (id, email, name, class, color, code, updated_at)
  on table public.users to authenticated;
grant update (email, name, class, color, code, updated_at)
  on table public.users to authenticated;

drop policy if exists "Users can insert their own profile" on public.users;
drop policy if exists "Enable insert for users based on user_id" on public.users;
create policy "Enable insert for users based on user_id"
  on public.users
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Enable update for users based on user_id" on public.users;
create policy "Enable update for users based on user_id"
  on public.users
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select users.role = 'admin'
      from public.users users
      where users.id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

drop policy if exists "AA4A" on public.beacons;
create policy "AA4A"
  on public.beacons
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Enable ALL access for amdin users" on public.buildings;
create policy "Enable ALL access for amdin users"
  on public.buildings
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Allow ALL for admins" on public.features;
create policy "Allow ALL for admins"
  on public.features
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "AA4A" on public.locations;
create policy "AA4A"
  on public.locations
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Allow ALL for admins" on public.rooms;
create policy "Allow ALL for admins"
  on public.rooms
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Allow ALL for Admins" on public.users;
create policy "Allow ALL for Admins"
  on public.users
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop function public.is_admin(uuid);

-- Queue configuration is database-managed. Start with Ruokalinjasto only.
create table public.queue_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  room_id uuid not null unique references public.rooms(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.queue_areas enable row level security;

create policy "Authenticated users can read active queue areas"
  on public.queue_areas
  for select
  to authenticated
  using (active or (select private.is_admin()));

revoke all on table public.queue_areas from anon, authenticated;
grant select on table public.queue_areas to authenticated;
grant all on table public.queue_areas to service_role;

do $$
declare
  ruokalinjasto_room_id uuid;
begin
  select rooms.id
  into strict ruokalinjasto_room_id
  from public.rooms rooms
  where lower(btrim(rooms.title)) = 'ruokalinjasto';

  insert into public.queue_areas (slug, name, room_id)
  values ('ruokalinjasto', 'Ruokalinjasto', ruokalinjasto_room_id)
  on conflict (slug) do update
    set name = excluded.name,
        room_id = excluded.room_id,
        active = true,
        updated_at = now();
end;
$$;

create table public.queue_observations (
  id bigint generated always as identity primary key,
  queue_area_id uuid not null references public.queue_areas(id) on delete restrict,
  level smallint not null check (level between 1 and 5),
  admin_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  observed_at timestamptz not null default now(),
  crowd_sample_count integer not null default 0 check (crowd_sample_count >= 0),
  created_at timestamptz not null default now()
);

create index queue_observations_area_observed_idx
  on public.queue_observations (queue_area_id, observed_at desc);

alter table public.queue_observations enable row level security;

create policy "Admins can read queue observation history"
  on public.queue_observations
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "Admins can record queue observations"
  on public.queue_observations
  for insert
  to authenticated
  with check (
    (select private.is_admin())
    and admin_user_id = (select auth.uid())
  );

revoke all on table public.queue_observations from anon, authenticated;
grant select on table public.queue_observations to authenticated;
grant insert (queue_area_id, level)
  on table public.queue_observations to authenticated;
grant all on table public.queue_observations to service_role;
grant usage, select on sequence public.queue_observations_id_seq to authenticated;

create or replace function private.prepare_queue_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  new.admin_user_id := auth.uid();
  new.observed_at := now();

  select count(*)::integer
  into new.crowd_sample_count
  from public.anonymous_crowd_samples samples
  join public.queue_areas areas
    on areas.id = new.queue_area_id
   and areas.room_id = samples.room_id
  where samples.observed_at >= now() - interval '10 minutes';

  return new;
end;
$$;

revoke all on function private.prepare_queue_observation()
  from public, anon, authenticated;

create trigger prepare_queue_observation
before insert on public.queue_observations
for each row execute function private.prepare_queue_observation();

-- Safe public aggregate. Raw anonymous crowd samples remain unreadable.
create or replace function public.get_queue_statuses()
returns table (
  area_id uuid,
  slug text,
  name text,
  room_id uuid,
  floor numeric,
  status_level smallint,
  status_source text,
  status_observed_at timestamptz,
  activity_level smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with queue_state as (
    select
      areas.id as area_id,
      areas.slug,
      areas.name,
      areas.room_id,
      rooms.floor,
      latest.level as manual_level,
      latest.observed_at as manual_observed_at,
      crowd.sample_count,
      crowd.last_sample_at,
      case
        when crowd.sample_count = 0 then null
        when crowd.sample_count <= 3 then 2
        when crowd.sample_count <= 9 then 3
        when crowd.sample_count <= 19 then 4
        else 5
      end::smallint as automatic_level
    from public.queue_areas areas
    join public.rooms rooms on rooms.id = areas.room_id
    left join lateral (
      select observations.level, observations.observed_at
      from public.queue_observations observations
      where observations.queue_area_id = areas.id
      order by observations.observed_at desc
      limit 1
    ) latest on true
    left join lateral (
      select
        count(*)::integer as sample_count,
        max(samples.observed_at) as last_sample_at
      from public.anonymous_crowd_samples samples
      where samples.room_id = areas.room_id
        and samples.observed_at >= now() - interval '10 minutes'
    ) crowd on true
    where areas.active
      and auth.uid() is not null
  )
  select
    state.area_id,
    state.slug,
    state.name,
    state.room_id,
    state.floor,
    case
      when state.manual_observed_at >= now() - interval '20 minutes'
        then state.manual_level
      else state.automatic_level
    end as status_level,
    case
      when state.manual_observed_at >= now() - interval '20 minutes'
        then 'manual'
      when state.automatic_level is not null
        then 'crowd'
      else 'none'
    end as status_source,
    case
      when state.manual_observed_at >= now() - interval '20 minutes'
        then state.manual_observed_at
      else state.last_sample_at
    end as status_observed_at,
    state.automatic_level as activity_level
  from queue_state state
  order by state.name;
$$;

revoke all on function public.get_queue_statuses()
  from public, anon, authenticated;
grant execute on function public.get_queue_statuses() to authenticated, service_role;

create or replace function public.get_admin_queue_activity()
returns table (
  area_id uuid,
  sample_count_10m integer,
  last_sample_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    areas.id,
    count(samples.id)::integer,
    max(samples.observed_at)
  from public.queue_areas areas
  left join public.anonymous_crowd_samples samples
    on samples.room_id = areas.room_id
   and samples.observed_at >= now() - interval '10 minutes'
  where auth.uid() is not null
    and private.is_admin()
  group by areas.id
  order by areas.name;
$$;

revoke all on function public.get_admin_queue_activity()
  from public, anon, authenticated;
grant execute on function public.get_admin_queue_activity()
  to authenticated, service_role;

comment on column public.users.role is
  'Server-managed application role. Assign only through a trusted direct database operation.';
comment on table public.queue_areas is
  'Database-managed queue locations shown to all authenticated users.';
comment on table public.queue_observations is
  'Append-only manual queue ratings recorded by database-authorized administrators.';
