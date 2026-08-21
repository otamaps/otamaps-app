-- Make the Ruokalinjasto crowdsourced reporting system configurable and
-- update-safe without changing what production does today.
--
-- Ownership constraint this migration is shaped around:
--   The two earlier queue migrations were applied by different roles. On the
--   live database `public.queue_areas`, `public.queue_observations` and
--   `public.get_admin_queue_activity()` are owned by `supabase_admin`, while
--   `public.get_queue_statuses()`, `public.record_canteen_queue_report()` and
--   the canteen tables are owned by `postgres`.
--
--   Rather than require a superuser connection, this migration only touches
--   `postgres`-owned objects and adds configuration in a new side table. That
--   also avoids recreating a SECURITY DEFINER function under a more privileged
--   owner, which would silently widen what the function can do.
--
-- Backwards compatibility rules this migration follows:
--   * every column previously returned by `get_queue_statuses()` keeps its
--     name and type, new columns are appended only, so already-installed app
--     builds keep working unchanged;
--   * `record_canteen_queue_report(smallint)` keeps its exact signature and is
--     replaced in place (never dropped) so its grants survive;
--   * `get_admin_queue_activity()` is left completely alone;
--   * every configuration value defaults to what was previously hard-coded, so
--     deployed behaviour is unchanged until somebody edits a config row;
--   * the closed-window error message is still rendered from the configured
--     times, so the old client's `message.includes("10:45")` check keeps
--     matching while new clients read the structured `detail` marker.

begin;

-- ---------------------------------------------------------------------------
-- 1. Reporting configuration moves out of the function bodies and into data.
--    A side table keyed by queue area, so `public.queue_areas` (owned by
--    supabase_admin) does not need to be altered.
-- ---------------------------------------------------------------------------

create table if not exists public.queue_area_config (
  queue_area_id uuid primary key
    references public.queue_areas(id) on delete cascade,
  area_timezone text not null default 'Europe/Helsinki',
  report_opens_at time not null default time '10:45',
  report_closes_at time not null default time '12:30',
  slot_minutes integer not null default 15,
  report_weekdays smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  min_community_reports integer not null default 1,
  trust_weight_cap integer not null default 3,
  manual_ttl_minutes integer not null default 20,
  crowd_window_minutes integer not null default 10,
  updated_at timestamptz not null default now(),
  constraint queue_area_config_window_valid
    check (report_closes_at > report_opens_at),
  constraint queue_area_config_slot_minutes_valid
    check (slot_minutes between 1 and 240),
  constraint queue_area_config_weekdays_valid
    check (
      cardinality(report_weekdays) between 1 and 7
      and report_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    ),
  constraint queue_area_config_thresholds_valid
    check (
      min_community_reports >= 1
      and trust_weight_cap >= 1
      and manual_ttl_minutes between 1 and 1440
      and crowd_window_minutes between 1 and 1440
    ),
  constraint queue_area_config_timezone_valid check (area_timezone <> '')
);

alter table public.queue_area_config enable row level security;

-- Configuration reaches clients only through the SECURITY DEFINER aggregate,
-- so no role needs direct read access.
revoke all on table public.queue_area_config from public, anon, authenticated;
grant all on table public.queue_area_config to service_role;

insert into public.queue_area_config (queue_area_id)
select areas.id from public.queue_areas areas
on conflict (queue_area_id) do nothing;

comment on table public.queue_area_config is
  'Per-area reporting configuration for the queue feature. Every column defaults to the value that used to be hard-coded inside get_queue_statuses() and record_canteen_queue_report().';
comment on column public.queue_area_config.min_community_reports is
  'Minimum student reports in the current slot before the community level is shown. 1 reproduces the pre-migration behaviour; raise it to require corroboration.';
comment on column public.queue_area_config.trust_weight_cap is
  'Maximum trust weight a single contributor can reach. 1 disables trust weighting and restores a plain average.';

-- ---------------------------------------------------------------------------
-- 2. Effective settings for an area, with the pre-migration values as the
--    fallback so an area without a config row behaves exactly as before.
-- ---------------------------------------------------------------------------

create or replace function private.queue_area_settings(p_area_id uuid)
returns table (
  area_timezone text,
  report_opens_at time,
  report_closes_at time,
  slot_minutes integer,
  report_weekdays smallint[],
  min_community_reports integer,
  trust_weight_cap integer,
  manual_ttl_minutes integer,
  crowd_window_minutes integer
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(config.area_timezone, 'Europe/Helsinki'),
    coalesce(config.report_opens_at, time '10:45'),
    coalesce(config.report_closes_at, time '12:30'),
    coalesce(config.slot_minutes, 15),
    coalesce(config.report_weekdays, array[1, 2, 3, 4, 5]::smallint[]),
    coalesce(config.min_community_reports, 1),
    coalesce(config.trust_weight_cap, 3),
    coalesce(config.manual_ttl_minutes, 20),
    coalesce(config.crowd_window_minutes, 10)
  from (select p_area_id as id) area
  left join public.queue_area_config config
    on config.queue_area_id = area.id;
$$;

revoke all on function private.queue_area_settings(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Shared slot maths, so the window is defined in exactly one place.
--    `at_moment` defaults to now(); it exists so the logic can be verified
--    against arbitrary instants instead of only the current clock.
-- ---------------------------------------------------------------------------

create or replace function private.queue_slot_state(
  area_timezone text,
  opens_at time,
  closes_at time,
  slot_minutes integer,
  weekdays smallint[],
  at_moment timestamptz default now()
)
returns table (
  local_now timestamp,
  is_open boolean,
  slot_start timestamptz,
  next_slot_start timestamptz
)
language sql
stable
set search_path = ''
as $$
  with clock as (
    select timezone(area_timezone, at_moment) as local_now
  ),
  state as (
    select
      clock.local_now,
      (
        extract(isodow from clock.local_now)::smallint = any (weekdays)
        and clock.local_now::time >= opens_at
        and clock.local_now::time < closes_at
      ) as is_open
    from clock
  )
  select
    state.local_now,
    state.is_open,
    case
      when state.is_open then (
        state.local_now::date
        + opens_at
        + floor(
            extract(epoch from (state.local_now::time - opens_at))
            / (slot_minutes * 60)
          )::integer * make_interval(mins => slot_minutes)
      ) at time zone area_timezone
      else null
    end as slot_start,
    case
      when state.is_open then (
        state.local_now::date
        + opens_at
        + (
            floor(
              extract(epoch from (state.local_now::time - opens_at))
              / (slot_minutes * 60)
            )::integer + 1
          ) * make_interval(mins => slot_minutes)
      ) at time zone area_timezone
      else null
    end as next_slot_start
  from state;
$$;

revoke all on function private.queue_slot_state(text, time, time, integer, smallint[], timestamptz)
  from public, anon, authenticated;

comment on function private.queue_slot_state(text, time, time, integer, smallint[], timestamptz) is
  'Single source of truth for whether a queue area is inside its reporting window and which slot an instant belongs to.';

-- Trust weight for one contributor. Cap 1 collapses this to a plain average,
-- which is exactly what the system did before this migration.
create or replace function private.canteen_report_weight(
  contribution_count integer,
  weight_cap integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(
    1 + floor(coalesce(contribution_count, 0) / 10.0),
    greatest(coalesce(weight_cap, 1), 1)::numeric
  );
$$;

revoke all on function private.canteen_report_weight(integer, integer)
  from public, anon, authenticated;

comment on function private.canteen_report_weight(integer, integer) is
  'Reliability weight applied to a student canteen report, derived from the contributor total maintained in public.canteen_contributor_stats.';

-- ---------------------------------------------------------------------------
-- 4. Public aggregate. Existing columns are preserved in place and in order;
--    configuration and drift-detection columns are appended.
-- ---------------------------------------------------------------------------

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
  current_slot_start timestamptz,
  -- appended in migration 20260817002500
  schema_version smallint,
  next_slot_start timestamptz,
  area_timezone text,
  report_opens_at time,
  report_closes_at time,
  slot_minutes integer,
  report_weekdays smallint[],
  min_community_reports integer,
  crowd_window_minutes integer
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
      cfg.area_timezone,
      cfg.report_opens_at,
      cfg.report_closes_at,
      cfg.slot_minutes,
      cfg.report_weekdays,
      cfg.min_community_reports,
      cfg.manual_ttl_minutes,
      cfg.crowd_window_minutes,
      slot.is_open,
      slot.slot_start,
      slot.next_slot_start,
      latest.level as manual_level,
      latest.observed_at as manual_observed_at,
      coalesce(community.report_count, 0) as report_count,
      coalesce(community.contributor_count, 0) as contributor_count,
      community.last_reported_at,
      community.community_level,
      crowd.last_sample_at,
      case
        when coalesce(crowd.sample_count, 0) = 0 then null
        when crowd.sample_count <= 3 then 2
        when crowd.sample_count <= 9 then 3
        when crowd.sample_count <= 19 then 4
        else 5
      end::smallint as automatic_level,
      coalesce(stats.contribution_count, 0)::integer as user_contribution_count,
      coalesce(viewer_report.has_reported, false) as viewer_has_reported
    from public.queue_areas areas
    join public.rooms rooms on rooms.id = areas.room_id
    cross join lateral private.queue_area_settings(areas.id) cfg
    cross join lateral private.queue_slot_state(
      cfg.area_timezone,
      cfg.report_opens_at,
      cfg.report_closes_at,
      cfg.slot_minutes,
      cfg.report_weekdays
    ) slot
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
        round(
          sum(
            reports.level::numeric
            * private.canteen_report_weight(
                reporter_stats.contribution_count,
                cfg.trust_weight_cap
              )
          )
          / nullif(
              sum(
                private.canteen_report_weight(
                  reporter_stats.contribution_count,
                  cfg.trust_weight_cap
                )
              ),
              0
            )
        )::smallint as community_level
      from public.canteen_queue_reports reports
      left join public.canteen_contributor_stats reporter_stats
        on reporter_stats.user_id = reports.user_id
      where reports.queue_area_id = areas.id
        and reports.slot_start = slot.slot_start
        and slot.is_open
    ) community on true
    left join lateral (
      select
        count(*)::integer as sample_count,
        max(samples.observed_at) as last_sample_at
      from public.anonymous_crowd_samples samples
      where samples.room_id = areas.room_id
        and samples.observed_at
              >= now() - make_interval(mins => cfg.crowd_window_minutes)
    ) crowd on true
    left join public.canteen_contributor_stats stats
      on stats.user_id = (select auth.uid())
    left join lateral (
      select true as has_reported
      from public.canteen_queue_reports reports
      where reports.queue_area_id = areas.id
        and reports.user_id = (select auth.uid())
        and reports.slot_start = slot.slot_start
      limit 1
    ) viewer_report on true
    where areas.active
      and (select auth.uid()) is not null
  ),
  resolved as (
    select
      state.*,
      (
        state.manual_observed_at
          >= now() - make_interval(mins => state.manual_ttl_minutes)
      ) as manual_is_fresh,
      (
        state.report_count >= state.min_community_reports
        and state.community_level is not null
      ) as community_is_usable
    from queue_state state
  )
  select
    resolved.area_id,
    resolved.slug,
    resolved.name,
    resolved.room_id,
    resolved.floor,
    case
      when not resolved.is_open then null
      when resolved.manual_is_fresh then resolved.manual_level
      when resolved.community_is_usable then resolved.community_level
      else resolved.automatic_level
    end as status_level,
    case
      when not resolved.is_open then 'none'
      when resolved.manual_is_fresh then 'manual'
      when resolved.community_is_usable then 'community'
      when resolved.automatic_level is not null then 'crowd'
      else 'none'
    end as status_source,
    case
      when not resolved.is_open then null
      when resolved.manual_is_fresh then resolved.manual_observed_at
      when resolved.community_is_usable then resolved.last_reported_at
      else resolved.last_sample_at
    end as status_observed_at,
    case
      when resolved.is_open then resolved.automatic_level
      else null
    end as activity_level,
    resolved.is_open as reporting_open,
    case when resolved.is_open then resolved.report_count else 0 end,
    case when resolved.is_open then resolved.contributor_count else 0 end,
    resolved.user_contribution_count,
    resolved.viewer_has_reported,
    resolved.slot_start,
    2::smallint as schema_version,
    resolved.next_slot_start,
    resolved.area_timezone,
    resolved.report_opens_at,
    resolved.report_closes_at,
    resolved.slot_minutes,
    resolved.report_weekdays,
    resolved.min_community_reports,
    resolved.crowd_window_minutes
  from resolved
  order by resolved.name;
$$;

revoke all on function public.get_queue_statuses()
  from public, anon, authenticated;
grant execute on function public.get_queue_statuses()
  to authenticated, service_role;

comment on function public.get_queue_statuses() is
  'Safe per-area queue aggregate for authenticated users. Columns are append-only: never reorder or remove one, because already-installed app builds read them by name.';

-- ---------------------------------------------------------------------------
-- 5. Write path. Config driven, area aware, with structured error markers.
--    The one-argument signature is replaced in place so its grants survive.
-- ---------------------------------------------------------------------------

create or replace function public.record_canteen_queue_report(
  input_level smallint,
  area_slug text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_area_id uuid;
  cfg record;
  slot record;
begin
  if viewer_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501', detail = 'auth_required';
  end if;

  if input_level is null or input_level < 1 or input_level > 5 then
    raise exception 'Queue level must be between 1 and 5'
      using errcode = '22023', detail = 'invalid_level';
  end if;

  select areas.id
  into target_area_id
  from public.queue_areas areas
  where areas.slug = area_slug
    and areas.active;

  if not found then
    raise exception 'Queue area % is not available for reporting', area_slug
      using errcode = '22023', detail = 'unknown_area';
  end if;

  select * into cfg from private.queue_area_settings(target_area_id);

  select *
  into slot
  from private.queue_slot_state(
    cfg.area_timezone,
    cfg.report_opens_at,
    cfg.report_closes_at,
    cfg.slot_minutes,
    cfg.report_weekdays
  );

  if not slot.is_open then
    -- The times are interpolated so this message still contains the literal
    -- window (today "10:45" / "12:30") that older app builds match on.
    raise exception 'Canteen reporting is open on ISO weekdays % from % to %',
      array_to_string(cfg.report_weekdays, ','),
      to_char(cfg.report_opens_at, 'HH24:MI'),
      to_char(cfg.report_closes_at, 'HH24:MI')
      using errcode = '22023', detail = 'reporting_closed';
  end if;

  insert into public.canteen_queue_reports (
    queue_area_id,
    user_id,
    level,
    slot_start,
    reported_at
  )
  values (target_area_id, viewer_id, input_level, slot.slot_start, now())
  on conflict (queue_area_id, user_id, slot_start) do update
    set level = excluded.level,
        reported_at = excluded.reported_at;
end;
$$;

revoke all on function public.record_canteen_queue_report(smallint, text)
  from public, anon, authenticated;
grant execute on function public.record_canteen_queue_report(smallint, text)
  to authenticated, service_role;

-- Replaced in place, never dropped: this preserves the existing grants that an
-- earlier privilege drift incident already cost us once.
create or replace function public.record_canteen_queue_report(input_level smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_canteen_queue_report(input_level, 'ruokalinjasto');
end;
$$;

comment on function public.record_canteen_queue_report(smallint) is
  'Compatibility wrapper for app builds that predate multi-area reporting. Delegates to the ruokalinjasto area.';
comment on function public.record_canteen_queue_report(smallint, text) is
  'Records or corrects the caller queue level for the current slot of the named area, using the reporting window configured in public.queue_area_config.';

-- ---------------------------------------------------------------------------
-- 6. Refuse to commit if the privilege state is not exactly what the client
--    needs. `get_queue_statuses` lost its grant once during a drop/recreate
--    and surfaced in production as "permission denied for function"; this
--    turns that class of mistake into a failed migration instead.
-- ---------------------------------------------------------------------------

do $$
declare
  required_grants text[] := array[
    'public.get_queue_statuses()',
    'public.get_admin_queue_activity()',
    'public.record_canteen_queue_report(smallint)',
    'public.record_canteen_queue_report(smallint, text)'
  ];
  target text;
begin
  foreach target in array required_grants loop
    if not has_function_privilege('authenticated', target, 'execute') then
      raise exception 'Post-migration check failed: authenticated cannot execute %', target;
    end if;
    if not has_function_privilege('service_role', target, 'execute') then
      raise exception 'Post-migration check failed: service_role cannot execute %', target;
    end if;
    if has_function_privilege('anon', target, 'execute') then
      raise exception 'Post-migration check failed: anon must not execute %', target;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.canteen_queue_reports', 'select')
    or has_table_privilege('anon', 'public.canteen_contributor_stats', 'select')
    or has_table_privilege('anon', 'public.queue_areas', 'select')
    or has_table_privilege('anon', 'public.queue_area_config', 'select')
    or has_table_privilege('authenticated', 'public.queue_area_config', 'select')
  then
    raise exception 'Post-migration check failed: queue configuration or reports are readable by a client role';
  end if;

  if not has_table_privilege('authenticated', 'public.queue_areas', 'select') then
    raise exception 'Post-migration check failed: authenticated cannot read public.queue_areas';
  end if;

  -- Every active area must have configuration, otherwise the fallbacks in
  -- private.queue_area_settings would be silently doing the work.
  if exists (
    select 1 from public.queue_areas areas
    left join public.queue_area_config config
      on config.queue_area_id = areas.id
    where areas.active and config.queue_area_id is null
  ) then
    raise exception 'Post-migration check failed: an active queue area has no configuration row';
  end if;
end;
$$;

commit;

-- PostgREST caches function signatures; without this the new two-argument
-- overload returns PGRST202 until the container is restarted.
notify pgrst, 'reload schema';
