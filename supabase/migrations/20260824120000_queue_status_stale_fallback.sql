-- Ruokalinjasto: align the staff-verified TTL with the 15 minute reporting
-- slot, and stop hiding the queue status the instant the active source goes
-- stale. Instead, fall back to the last known level and let the app render
-- it with an "X min sitten" badge, so the panel never flips from a useful
-- reading straight to "no data" just because nobody reported in this slot.
--
-- Follows the same ownership constraint as 20260817002500: only touches
-- postgres-owned objects (`queue_area_config`, `get_queue_statuses`), never
-- superuser-owned ones (`queue_areas`, `queue_observations`).

begin;

-- ---------------------------------------------------------------------------
-- 1. Staff-verified reports now expire after 15 minutes, matching the
--    community slot length, instead of the previous 20 minute TTL.
-- ---------------------------------------------------------------------------

alter table public.queue_area_config
  alter column manual_ttl_minutes set default 15;

update public.queue_area_config
set manual_ttl_minutes = 15
where manual_ttl_minutes = 20;

-- ---------------------------------------------------------------------------
-- 2. Public aggregate: append a staleness flag and fall back to the most
--    recent known reading (manual, then community, then crowd, by however
--    recently each was observed) once every source has gone stale, rather
--    than collapsing straight to null.
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
  status_is_stale boolean
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
      last_community.level as last_community_level,
      last_community.observed_at as last_community_observed_at,
      crowd.last_sample_at,
      case
        when coalesce(crowd.sample_count, 0) = 0 then null
        when crowd.sample_count <= 3 then 2
        when crowd.sample_count <= 9 then 3
        when crowd.sample_count <= 19 then 4
        else 5
      end::smallint as automatic_level,
      last_crowd.level as last_crowd_level,
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
    -- Most recent slot (any slot, not just the current one) that reached the
    -- corroboration threshold, used as the stale fallback once the current
    -- slot has no usable community reading of its own.
    left join lateral (
      select
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
        )::smallint as level,
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
          when count(*) <= 3 then 2
          when count(*) <= 9 then 3
          when count(*) <= 19 then 4
          else 5
        end::smallint as level,
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
        and state.community_level is not null
      ) as community_is_usable
    from queue_state state
  ),
  fresh as (
    select
      resolved.*,
      case
        when not resolved.is_open then null
        when resolved.manual_is_fresh then resolved.manual_level
        when resolved.community_is_usable then resolved.community_level
        else resolved.automatic_level
      end as fresh_level,
      case
        when not resolved.is_open then 'none'
        when resolved.manual_is_fresh then 'manual'
        when resolved.community_is_usable then 'community'
        when resolved.automatic_level is not null then 'crowd'
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
  -- was actually observed last. Only consulted once `fresh_level` is null.
  stale as (
    select
      fresh.*,
      stale_pick.level as stale_level,
      stale_pick.source as stale_source,
      stale_pick.observed_at as stale_observed_at
    from fresh
    left join lateral (
      select candidate.level, candidate.source, candidate.observed_at
      from (
        values
          (fresh.manual_level, 'manual', fresh.manual_observed_at),
          (fresh.last_community_level, 'community', fresh.last_community_observed_at),
          (fresh.last_crowd_level, 'crowd', fresh.last_crowd_observed_at)
      ) as candidate(level, source, observed_at)
      where candidate.level is not null and candidate.observed_at is not null
      order by candidate.observed_at desc
      limit 1
    ) stale_pick on true
  )
  select
    stale.area_id,
    stale.slug,
    stale.name,
    stale.room_id,
    stale.floor,
    coalesce(stale.fresh_level, case when stale.is_open then stale.stale_level else null end) as status_level,
    case
      when stale.fresh_level is not null then stale.fresh_source
      when stale.is_open and stale.stale_level is not null then stale.stale_source
      else 'none'
    end as status_source,
    coalesce(
      stale.fresh_observed_at,
      case when stale.is_open then stale.stale_observed_at else null end
    ) as status_observed_at,
    case
      when stale.is_open then stale.automatic_level
      else null
    end as activity_level,
    stale.is_open as reporting_open,
    case when stale.is_open then stale.report_count else 0 end,
    case when stale.is_open then stale.contributor_count else 0 end,
    stale.user_contribution_count,
    stale.viewer_has_reported,
    stale.slot_start,
    3::smallint as schema_version,
    stale.next_slot_start,
    stale.area_timezone,
    stale.report_opens_at,
    stale.report_closes_at,
    stale.slot_minutes,
    stale.report_weekdays,
    stale.min_community_reports,
    stale.crowd_window_minutes,
    (stale.fresh_level is null and stale.is_open and stale.stale_level is not null) as status_is_stale
  from stale
  order by stale.name;
$$;

revoke all on function public.get_queue_statuses()
  from public, anon, authenticated;
grant execute on function public.get_queue_statuses()
  to authenticated, service_role;

comment on function public.get_queue_statuses() is
  'Safe per-area queue aggregate for authenticated users. Columns are append-only: never reorder or remove one, because already-installed app builds read them by name.';

commit;

-- PostgREST caches function signatures; without this the new return column
-- keeps serving the old shape until the container is restarted.
notify pgrst, 'reload schema';
