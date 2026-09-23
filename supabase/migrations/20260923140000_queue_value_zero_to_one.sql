-- Ruokalinjasto: measure queue length as a value from 0 (no queue) to 1
-- (longest), instead of five whole levels from 1 to 5.
--
-- What changes:
--   * `canteen_queue_reports.level` (1-5) becomes `value` (0-1, three
--     decimals). Existing rows convert as (level - 1) / 4, so 1 -> 0,
--     3 -> 0.5, 5 -> 1.
--   * New RPC `record_canteen_queue_value(input_value, area_slug)` takes 0-1.
--     It has its own name because PostgREST resolves overloads by argument
--     name, and a second `record_canteen_queue_report(input_level, area_slug)`
--     would be ambiguous.
--   * `get_queue_statuses()` computes everything in 0-1 and appends
--     `status_value` and `activity_value`. `schema_version` goes to 4 so the
--     app knows the new RPC and columns exist.
--
-- What stays, for app builds already installed:
--   * `status_level` / `activity_level` are still returned as 1-5, now derived
--     from the value (1 + round(value * 4)).
--   * `record_canteen_queue_report(numeric, text)` and `(smallint)` still take
--     1-5 and convert. The (smallint) wrapper is untouched: its body calls the
--     two-argument function by name, which resolves to the numeric one.
--   * `queue_observations` (staff reports) keeps storing 1-5. It is owned by
--     supabase_admin, so it cannot be altered from the `postgres` role; it is
--     converted to 0-1 where `get_queue_statuses()` reads it.
--
-- Safe to run whether or not 20260923120000 (numeric report levels) ran first.

begin;

-- ---------------------------------------------------------------------------
-- 1. The status function reads the column being renamed, so it goes first.
--    Its grants are reinstated in step 4.
-- ---------------------------------------------------------------------------

drop function if exists public.get_queue_statuses();

-- ---------------------------------------------------------------------------
-- 2. Reports: level 1-5 -> value 0-1.
-- ---------------------------------------------------------------------------

do $$
declare
  constraint_name text;
begin
  -- The 1-5 check was declared inline, so drop it by what it covers rather
  -- than by a generated name.
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.canteen_queue_reports'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%level%'
  loop
    execute format(
      'alter table public.canteen_queue_reports drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.canteen_queue_reports rename column level to value;

-- `::numeric` first: on the smallint column `(value - 1) / 4` would be integer
-- division and turn every report into 0.
alter table public.canteen_queue_reports
  alter column value type numeric(4, 3)
  using ((value::numeric - 1) / 4)::numeric(4, 3);

alter table public.canteen_queue_reports
  add constraint canteen_queue_reports_value_check
  check (value between 0 and 1);

-- ---------------------------------------------------------------------------
-- 3. Report RPCs.
-- ---------------------------------------------------------------------------

create function public.record_canteen_queue_value(
  input_value numeric,
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

  if input_value is null or input_value < 0 or input_value > 1 then
    raise exception 'Queue value must be between 0 and 1'
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
    value,
    slot_start,
    reported_at
  )
  values (
    target_area_id,
    viewer_id,
    round(input_value, 3),
    slot.slot_start,
    now()
  )
  on conflict (queue_area_id, user_id, slot_start) do update
    set value = excluded.value,
        reported_at = excluded.reported_at;
end;
$$;

revoke all on function public.record_canteen_queue_value(numeric, text)
  from public, anon, authenticated;
grant execute on function public.record_canteen_queue_value(numeric, text)
  to authenticated, service_role;

comment on function public.record_canteen_queue_value(numeric, text) is
  'Records or corrects the caller queue value (0 = no queue, 1 = longest) for the current slot of the named area.';

-- Legacy 1-5 entry point. Whichever of its two signatures exists goes.
drop function if exists public.record_canteen_queue_report(smallint, text);
drop function if exists public.record_canteen_queue_report(numeric, text);

create function public.record_canteen_queue_report(
  input_level numeric,
  area_slug text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Kept in 1-5 terms so older builds still get the message they match on.
  if input_level is null or input_level < 1 or input_level > 5 then
    raise exception 'Queue level must be between 1 and 5'
      using errcode = '22023', detail = 'invalid_level';
  end if;

  perform public.record_canteen_queue_value((input_level - 1) / 4, area_slug);
end;
$$;

revoke all on function public.record_canteen_queue_report(numeric, text)
  from public, anon, authenticated;
grant execute on function public.record_canteen_queue_report(numeric, text)
  to authenticated, service_role;

comment on function public.record_canteen_queue_report(numeric, text) is
  'Compatibility entry point for app builds that report 1-5. Converts to 0-1 and delegates to record_canteen_queue_value.';

-- ---------------------------------------------------------------------------
-- 4. The aggregate, now in 0-1. Same logic as 20260918120000; only the scale
--    changed and two columns were appended.
-- ---------------------------------------------------------------------------

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
  schema_version smallint,
  next_slot_start timestamptz,
  area_timezone text,
  report_opens_at time,
  report_closes_at time,
  slot_minutes integer,
  report_weekdays smallint[],
  min_community_reports integer,
  crowd_window_minutes integer,
  -- appended in migration 20260824120000
  status_is_stale boolean,
  -- appended in migration 20260923140000
  status_value numeric,
  activity_value numeric
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
      -- Staff observations are still stored 1-5; see the header.
      (latest.level::numeric - 1) / 4 as manual_value,
      latest.observed_at as manual_observed_at,
      coalesce(community.report_count, 0) as report_count,
      coalesce(community.contributor_count, 0) as contributor_count,
      community.last_reported_at,
      community.community_value,
      last_community.value as last_community_value,
      last_community.observed_at as last_community_observed_at,
      crowd.last_sample_at,
      case
        when coalesce(crowd.sample_count, 0) = 0 then null
        when crowd.sample_count <= 3 then 0.25
        when crowd.sample_count <= 9 then 0.5
        when crowd.sample_count <= 19 then 0.75
        else 1
      end::numeric as automatic_value,
      last_crowd.value as last_crowd_value,
      last_crowd.observed_at as last_crowd_observed_at,
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
            reports.value
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
            ),
          3
        ) as community_value
      from public.canteen_queue_reports reports
      left join public.canteen_contributor_stats reporter_stats
        on reporter_stats.user_id = reports.user_id
      where reports.queue_area_id = areas.id
        and reports.slot_start = slot.slot_start
        and slot.is_open
    ) community on true
    -- Most recent slot (any slot, not just the current one) that reached the
    -- corroboration threshold, used as the stale fallback once the current
    -- slot has no usable community reading of its own.
    left join lateral (
      select
        round(
          sum(
            reports.value
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
            ),
          3
        ) as value,
        max(reports.reported_at) as observed_at
      from public.canteen_queue_reports reports
      left join public.canteen_contributor_stats reporter_stats
        on reporter_stats.user_id = reports.user_id
      where reports.queue_area_id = areas.id
      group by reports.slot_start
      having count(*) >= cfg.min_community_reports
      order by reports.slot_start desc
      limit 1
    ) last_community on true
    left join lateral (
      select
        count(*)::integer as sample_count,
        max(samples.observed_at) as last_sample_at
      from public.anonymous_crowd_samples samples
      where samples.room_id = areas.room_id
        and samples.observed_at
              >= now() - make_interval(mins => cfg.crowd_window_minutes)
    ) crowd on true
    -- Most recent crowd sample bucket regardless of the freshness window,
    -- used as the stale fallback once the current window is empty.
    left join lateral (
      select
        case
          when count(*) <= 3 then 0.25
          when count(*) <= 9 then 0.5
          when count(*) <= 19 then 0.75
          else 1
        end::numeric as value,
        max(samples.observed_at) as observed_at
      from public.anonymous_crowd_samples samples
      where samples.room_id = areas.room_id
        and samples.observed_at
              >= now() - make_interval(mins => cfg.crowd_window_minutes)
              * 8
      having count(*) > 0
    ) last_crowd on true
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
        and state.community_value is not null
      ) as community_is_usable
    from queue_state state
  ),
  fresh as (
    select
      resolved.*,
      case
        when not resolved.is_open then null
        when resolved.manual_is_fresh then resolved.manual_value
        when resolved.community_is_usable then resolved.community_value
        else resolved.automatic_value
      end as fresh_value,
      case
        when not resolved.is_open then 'none'
        when resolved.manual_is_fresh then 'manual'
        when resolved.community_is_usable then 'community'
        when resolved.automatic_value is not null then 'crowd'
        else 'none'
      end as fresh_source,
      case
        when not resolved.is_open then null
        when resolved.manual_is_fresh then resolved.manual_observed_at
        when resolved.community_is_usable then resolved.last_reported_at
        else resolved.last_sample_at
      end as fresh_observed_at
    from resolved
  ),
  -- The most recent known reading across every source, picked by whichever
  -- was actually observed last. Only consulted once `fresh_value` is null.
  stale as (
    select
      fresh.*,
      stale_pick.value as stale_value,
      stale_pick.source as stale_source,
      stale_pick.observed_at as stale_observed_at
    from fresh
    left join lateral (
      select candidate.value, candidate.source, candidate.observed_at
      from (
        values
          (fresh.manual_value, 'manual', fresh.manual_observed_at),
          (fresh.last_community_value, 'community', fresh.last_community_observed_at),
          (fresh.last_crowd_value, 'crowd', fresh.last_crowd_observed_at)
      ) as candidate(value, source, observed_at)
      where candidate.value is not null
        and candidate.observed_at is not null
        -- Same school day only. Without this the fallback will happily reach
        -- back days or weeks and present it as the previous slot: the queue
        -- at 11:20 last Tuesday says nothing about the queue now.
        and (candidate.observed_at at time zone fresh.area_timezone)::date
              = (fresh.slot_start at time zone fresh.area_timezone)::date
      order by candidate.observed_at desc
      limit 1
    ) stale_pick on true
  ),
  picked as (
    select
      stale.*,
      coalesce(
        stale.fresh_value,
        case when stale.is_open then stale.stale_value else null end
      ) as status_value,
      case when stale.is_open then stale.automatic_value else null end
        as activity_value
    from stale
  )
  select
    picked.area_id,
    picked.slug,
    picked.name,
    picked.room_id,
    picked.floor,
    (1 + round(picked.status_value * 4))::smallint as status_level,
    case
      when picked.fresh_value is not null then picked.fresh_source
      when picked.is_open and picked.stale_value is not null then picked.stale_source
      else 'none'
    end as status_source,
    coalesce(
      picked.fresh_observed_at,
      case when picked.is_open then picked.stale_observed_at else null end
    ) as status_observed_at,
    (1 + round(picked.activity_value * 4))::smallint as activity_level,
    picked.is_open as reporting_open,
    case when picked.is_open then picked.report_count else 0 end,
    case when picked.is_open then picked.contributor_count else 0 end,
    picked.user_contribution_count,
    picked.viewer_has_reported,
    picked.slot_start,
    4::smallint as schema_version,
    picked.next_slot_start,
    picked.area_timezone,
    picked.report_opens_at,
    picked.report_closes_at,
    picked.slot_minutes,
    picked.report_weekdays,
    picked.min_community_reports,
    picked.crowd_window_minutes,
    (picked.fresh_value is null and picked.is_open and picked.stale_value is not null) as status_is_stale,
    picked.status_value,
    picked.activity_value
  from picked
  order by picked.name;
$$;

revoke all on function public.get_queue_statuses()
  from public, anon, authenticated;
grant execute on function public.get_queue_statuses()
  to authenticated, service_role;

comment on function public.get_queue_statuses() is
  'Safe per-area queue aggregate for authenticated users. status_value / activity_value are 0 (no queue) to 1 (longest); status_level / activity_level are the same reading as 1-5 for older builds. Columns are append-only: never reorder or remove one, because already-installed app builds read them by name.';

-- ---------------------------------------------------------------------------
-- 5. Refuse to commit unless the client roles can do exactly what they need.
-- ---------------------------------------------------------------------------

do $$
declare
  required_grants text[] := array[
    'public.get_queue_statuses()',
    'public.record_canteen_queue_value(numeric, text)',
    'public.record_canteen_queue_report(numeric, text)',
    'public.record_canteen_queue_report(smallint)'
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
end;
$$;

commit;

-- PostgREST caches function signatures; without this the new RPC returns
-- PGRST202 and the new columns stay missing until it is restarted.
notify pgrst, 'reload schema';
