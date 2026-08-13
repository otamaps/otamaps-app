begin;

create table public.canteen_queue_reports (
  id bigint generated always as identity primary key,
  queue_area_id uuid not null references public.queue_areas(id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  level smallint not null check (level between 1 and 5),
  slot_start timestamptz not null,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (queue_area_id, user_id, slot_start)
);

create index canteen_queue_reports_area_slot_idx
  on public.canteen_queue_reports (queue_area_id, slot_start desc);
create index canteen_queue_reports_user_reported_idx
  on public.canteen_queue_reports (user_id, reported_at desc);

alter table public.canteen_queue_reports enable row level security;

create policy "Users can read their own canteen reports"
  on public.canteen_queue_reports
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.canteen_queue_reports from public, anon, authenticated;
grant select on table public.canteen_queue_reports to authenticated;
grant all on table public.canteen_queue_reports to service_role;
grant usage, select on sequence public.canteen_queue_reports_id_seq to service_role;

create table public.canteen_contributor_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contribution_count integer not null default 0 check (contribution_count >= 0),
  first_contributed_at timestamptz not null,
  last_contributed_at timestamptz not null
);

alter table public.canteen_contributor_stats enable row level security;

create policy "Users can read their own canteen contribution stats"
  on public.canteen_contributor_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.canteen_contributor_stats from public, anon, authenticated;
grant select on table public.canteen_contributor_stats to authenticated;
grant all on table public.canteen_contributor_stats to service_role;

create or replace function private.update_canteen_contributor_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.canteen_contributor_stats (
    user_id,
    contribution_count,
    first_contributed_at,
    last_contributed_at
  )
  values (new.user_id, 1, new.reported_at, new.reported_at)
  on conflict (user_id) do update
    set contribution_count = public.canteen_contributor_stats.contribution_count + 1,
        last_contributed_at = excluded.last_contributed_at;
  return new;
end;
$$;

revoke all on function private.update_canteen_contributor_stats()
  from public, anon, authenticated;

create trigger update_canteen_contributor_stats_after_insert
after insert on public.canteen_queue_reports
for each row execute function private.update_canteen_contributor_stats();

create or replace function public.record_canteen_queue_report(input_level smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  area_id uuid;
  local_now timestamp := timezone('Europe/Helsinki', now());
  slot_number integer;
  current_slot timestamptz;
begin
  if viewer_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if input_level is null or input_level < 1 or input_level > 5 then
    raise exception 'Queue level must be between 1 and 5' using errcode = '22023';
  end if;
  if extract(isodow from local_now) not between 1 and 5
    or local_now::time < time '10:45'
    or local_now::time >= time '12:30'
  then
    raise exception 'Canteen reporting is open on weekdays from 10:45 to 12:30'
      using errcode = '22023';
  end if;

  select areas.id
  into strict area_id
  from public.queue_areas areas
  where areas.slug = 'ruokalinjasto'
    and areas.active;

  slot_number := floor(
    extract(epoch from (local_now::time - time '10:45')) / 900
  )::integer;
  current_slot := (
    local_now::date + time '10:45' + slot_number * interval '15 minutes'
  ) at time zone 'Europe/Helsinki';

  insert into public.canteen_queue_reports (
    queue_area_id,
    user_id,
    level,
    slot_start,
    reported_at
  )
  values (area_id, viewer_id, input_level, current_slot, now())
  on conflict (queue_area_id, user_id, slot_start) do update
    set level = excluded.level,
        reported_at = excluded.reported_at;
end;
$$;

revoke all on function public.record_canteen_queue_report(smallint)
  from public, anon, authenticated;
grant execute on function public.record_canteen_queue_report(smallint)
  to authenticated, service_role;

drop function if exists public.get_queue_statuses();

create function public.get_queue_statuses()
returns table (
  area_id uuid,
  slug text,
  name text,
  room_id uuid,
  floor numeric,
  status_level smallint,
  status_source text,
  status_observed_at timestamptz,
  activity_level smallint,
  reporting_open boolean,
  report_count integer,
  contributor_count integer,
  current_user_contributions integer,
  current_user_reported boolean,
  current_slot_start timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with clock as (
    select
      timezone('Europe/Helsinki', now()) as local_now,
      auth.uid() as viewer_id
  ),
  reporting_clock as (
    select
      clock.*,
      (
        extract(isodow from clock.local_now) between 1 and 5
        and clock.local_now::time >= time '10:45'
        and clock.local_now::time < time '12:30'
      ) as is_open,
      case
        when extract(isodow from clock.local_now) between 1 and 5
          and clock.local_now::time >= time '10:45'
          and clock.local_now::time < time '12:30'
        then (
          clock.local_now::date
          + time '10:45'
          + floor(
              extract(epoch from (clock.local_now::time - time '10:45')) / 900
            )::integer * interval '15 minutes'
        ) at time zone 'Europe/Helsinki'
        else null
      end as slot_start
    from clock
  ),
  queue_state as (
    select
      areas.id as area_id,
      areas.slug,
      areas.name,
      areas.room_id,
      rooms.floor,
      reporting_clock.viewer_id,
      reporting_clock.is_open,
      reporting_clock.slot_start,
      latest.level as manual_level,
      latest.observed_at as manual_observed_at,
      community.report_count,
      community.contributor_count,
      community.last_reported_at,
      community.community_level,
      crowd.sample_count,
      crowd.last_sample_at,
      case
        when crowd.sample_count = 0 then null
        when crowd.sample_count <= 3 then 2
        when crowd.sample_count <= 9 then 3
        when crowd.sample_count <= 19 then 4
        else 5
      end::smallint as automatic_level,
      coalesce(stats.contribution_count, 0)::integer as user_contribution_count,
      coalesce(viewer_report.has_reported, false) as viewer_has_reported
    from public.queue_areas areas
    join public.rooms rooms on rooms.id = areas.room_id
    cross join reporting_clock
    left join lateral (
      select observations.level, observations.observed_at
      from public.queue_observations observations
      where observations.queue_area_id = areas.id
      order by observations.observed_at desc
      limit 1
    ) latest on true
    left join lateral (
      select
        count(*)::integer as report_count,
        count(distinct reports.user_id)::integer as contributor_count,
        max(reports.reported_at) as last_reported_at,
        round(avg(reports.level))::smallint as community_level
      from public.canteen_queue_reports reports
      where reports.queue_area_id = areas.id
        and reports.slot_start = reporting_clock.slot_start
        and reporting_clock.is_open
    ) community on true
    left join lateral (
      select
        count(*)::integer as sample_count,
        max(samples.observed_at) as last_sample_at
      from public.anonymous_crowd_samples samples
      where samples.room_id = areas.room_id
        and samples.observed_at >= now() - interval '10 minutes'
    ) crowd on true
    left join public.canteen_contributor_stats stats
      on stats.user_id = reporting_clock.viewer_id
    left join lateral (
      select true as has_reported
      from public.canteen_queue_reports reports
      where reports.queue_area_id = areas.id
        and reports.user_id = reporting_clock.viewer_id
        and reports.slot_start = reporting_clock.slot_start
      limit 1
    ) viewer_report on true
    where areas.active
      and reporting_clock.viewer_id is not null
  )
  select
    state.area_id,
    state.slug,
    state.name,
    state.room_id,
    state.floor,
    case
      when not state.is_open then null
      when state.manual_observed_at >= now() - interval '20 minutes'
        then state.manual_level
      when state.report_count > 0 then state.community_level
      else state.automatic_level
    end as status_level,
    case
      when not state.is_open then 'none'
      when state.manual_observed_at >= now() - interval '20 minutes'
        then 'manual'
      when state.report_count > 0 then 'community'
      when state.automatic_level is not null then 'crowd'
      else 'none'
    end as status_source,
    case
      when not state.is_open then null
      when state.manual_observed_at >= now() - interval '20 minutes'
        then state.manual_observed_at
      when state.report_count > 0 then state.last_reported_at
      else state.last_sample_at
    end as status_observed_at,
    case when state.is_open then state.automatic_level else null end as activity_level,
    state.is_open as reporting_open,
    case when state.is_open then coalesce(state.report_count, 0) else 0 end,
    case when state.is_open then coalesce(state.contributor_count, 0) else 0 end,
    state.user_contribution_count,
    state.viewer_has_reported,
    state.slot_start
  from queue_state state
  order by state.name;
$$;

revoke all on function public.get_queue_statuses()
  from public, anon, authenticated;
grant execute on function public.get_queue_statuses()
  to authenticated, service_role;

comment on table public.canteen_queue_reports is
  'Identified, user-submitted Ruokalinjasto queue levels, limited to one contribution per 15-minute slot. Raw reports are private to the contributor.';
comment on table public.canteen_contributor_stats is
  'Per-user canteen contribution totals for future reliability weighting. Each user may read only their own count.';
comment on function public.record_canteen_queue_report(smallint) is
  'Records or corrects the current user queue level for the active weekday 15-minute slot between 10:45 and 12:30 Europe/Helsinki time.';

commit;
