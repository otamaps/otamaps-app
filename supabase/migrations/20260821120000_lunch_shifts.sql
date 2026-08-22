begin;

create table public.lunch_shifts (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 5),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  shift smallint check (shift is null or shift in (1, 2)),
  course_codes text[] not null check (cardinality(course_codes) > 0),
  period_label text,
  imported_at timestamptz not null default now(),
  imported_by uuid references auth.users(id) on delete set null
);

create index lunch_shifts_weekday_idx on public.lunch_shifts (weekday);

alter table public.lunch_shifts enable row level security;

create policy "Authenticated users can read lunch shifts"
  on public.lunch_shifts
  for select
  to authenticated
  using ((select auth.uid()) is not null);

revoke all on table public.lunch_shifts from public, anon, authenticated;
grant select on table public.lunch_shifts to authenticated;
grant all on table public.lunch_shifts to service_role;

create or replace function public.replace_lunch_shifts(p_period_label text, p_slots jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imported_at timestamptz := now();
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null or not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;
  if p_slots is null or jsonb_array_length(p_slots) = 0 then
    raise exception 'p_slots must not be empty' using errcode = '22023';
  end if;

  delete from public.lunch_shifts where true;

  insert into public.lunch_shifts (
    weekday, start_time, end_time, shift, course_codes, period_label, imported_by, imported_at
  )
  select x.weekday, x.start_time, x.end_time, x.shift, x.course_codes, p_period_label, viewer_id, v_imported_at
  from jsonb_to_recordset(p_slots) as x(
    weekday smallint, start_time time, end_time time, shift smallint, course_codes text[]
  );
end;
$$;

revoke all on function public.replace_lunch_shifts(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_lunch_shifts(text, jsonb) to authenticated, service_role;

comment on table public.lunch_shifts is
  'Current period''s lunch-shift lookup (weekday/time-slot/course-codes), fully replaced on each admin import. No history is retained.';
comment on function public.replace_lunch_shifts(text, jsonb) is
  'Admin-only: atomically replaces all lunch_shifts rows with a new period''s import.';

commit;
