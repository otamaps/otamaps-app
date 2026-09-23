-- Ruokalinjasto: let a student's queue report be any point on the 1-5 scale,
-- not only one of the five whole levels.
--
-- The app's slider is now continuous, so a report can land between two
-- levels (say 3.4, "a bit more than medium"). Storing that instead of
-- rounding it on the phone makes the weighted community average in
-- `get_queue_statuses` more precise; the average is still rounded to a whole
-- level there, so `status_level` and everything that reads it are unchanged.
--
-- Compatibility:
--   * Existing rows are whole numbers and convert losslessly.
--   * The two-argument RPC takes `numeric` instead of `smallint`. Installed app
--     builds that send whole numbers keep working, since JSON has no integer
--     type and PostgREST casts either way.
--   * The one-argument `(smallint)` wrapper for the oldest builds is left
--     alone. It must not become `numeric` too: PostgREST resolves overloads by
--     argument name, and `(input_level)` alone still only matches it.
--   * The (smallint, text) signature is dropped rather than kept beside the
--     numeric one, because two functions with the same argument names are
--     ambiguous to PostgREST. Dropping takes its grants, so they are set on the
--     replacement below and checked before commit.

begin;

-- ---------------------------------------------------------------------------
-- 1. Store reports to two decimals. The existing `level between 1 and 5`
--    check carries over to the new type unchanged.
-- ---------------------------------------------------------------------------

alter table public.canteen_queue_reports
  alter column level type numeric(3, 2) using level::numeric(3, 2);

-- ---------------------------------------------------------------------------
-- 2. Replace the two-argument report RPC with a numeric one. The body is
--    20260817002500's, with only the input type and rounding changed.
-- ---------------------------------------------------------------------------

drop function public.record_canteen_queue_report(smallint, text);

create function public.record_canteen_queue_report(
  input_level numeric,
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
  values (
    target_area_id,
    viewer_id,
    round(input_level, 2),
    slot.slot_start,
    now()
  )
  on conflict (queue_area_id, user_id, slot_start) do update
    set level = excluded.level,
        reported_at = excluded.reported_at;
end;
$$;

revoke all on function public.record_canteen_queue_report(numeric, text)
  from public, anon, authenticated;
grant execute on function public.record_canteen_queue_report(numeric, text)
  to authenticated, service_role;

comment on function public.record_canteen_queue_report(numeric, text) is
  'Records or corrects the caller queue level (1-5, two decimals) for the current slot of the named area, using the reporting window configured in public.queue_area_config.';

-- The wrapper's body calls the two-argument function by name, so it now
-- resolves to the numeric one through the implicit smallint -> numeric cast.
-- Nothing to change there.

-- ---------------------------------------------------------------------------
-- 3. Refuse to commit unless the client roles can still do exactly what they
--    could before.
-- ---------------------------------------------------------------------------

do $$
declare
  required_grants text[] := array[
    'public.get_queue_statuses()',
    'public.record_canteen_queue_report(smallint)',
    'public.record_canteen_queue_report(numeric, text)'
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

-- PostgREST caches function signatures; without this it keeps routing the
-- two-argument call to the dropped smallint function until restarted.
notify pgrst, 'reload schema';
