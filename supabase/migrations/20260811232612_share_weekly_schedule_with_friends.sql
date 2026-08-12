alter table public.user_preferences
add column schedule_sharing_enabled boolean not null default false;

grant insert (schedule_sharing_enabled)
  on public.user_preferences to authenticated;
grant update (schedule_sharing_enabled)
  on public.user_preferences to authenticated;

alter table public.user_consent_events
drop constraint if exists user_consent_events_purpose_check;

alter table public.user_consent_events
add constraint user_consent_events_purpose_check check (
  purpose in (
    'friend_location',
    'anonymous_crowd_analytics',
    'background_tracking',
    'weekly_schedule'
  )
);

create table public.shared_weekly_schedules (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  lessons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(lessons) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index shared_weekly_schedules_week_start_idx
  on public.shared_weekly_schedules (week_start);

alter table public.shared_weekly_schedules enable row level security;

create or replace function private.can_view_shared_weekly_schedule(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      owner_id = (select auth.uid())
      or (
        exists (
          select 1
          from public.user_preferences preferences
          where preferences.user_id = owner_id
            and preferences.schedule_sharing_enabled
        )
        and exists (
          select 1
          from public.relations relation
          where relation.status = 'friends'
            and (
              (
                relation.subject = owner_id
                and relation.object = (select auth.uid())
              )
              or (
                relation.object = owner_id
                and relation.subject = (select auth.uid())
              )
            )
        )
      )
    );
$$;

revoke all on function private.can_view_shared_weekly_schedule(uuid)
  from public, anon;
grant execute on function private.can_view_shared_weekly_schedule(uuid)
  to authenticated, service_role;

create policy "Owners and friends can read shared weekly schedules"
  on public.shared_weekly_schedules
  for select
  to authenticated
  using (private.can_view_shared_weekly_schedule(user_id));

create policy "Users can create their own shared weekly schedules"
  on public.shared_weekly_schedules
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own shared weekly schedules"
  on public.shared_weekly_schedules
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own shared weekly schedules"
  on public.shared_weekly_schedules
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.shared_weekly_schedules from anon, authenticated;
grant select, insert, update, delete
  on table public.shared_weekly_schedules to authenticated;
grant all on table public.shared_weekly_schedules to service_role;

comment on column public.user_preferences.schedule_sharing_enabled is
  'Whether accepted friends may read the user current sanitized weekly schedule.';
comment on table public.shared_weekly_schedules is
  'Sanitized Wilma lesson snapshots. RLS limits friend reads to accepted relations with active owner consent.';
