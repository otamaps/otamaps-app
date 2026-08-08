create schema if not exists private;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_source text not null default 'legacy'
    check (profile_source in ('legacy', 'wilma')),
  onboarding_version integer not null default 0
    check (onboarding_version >= 0),
  onboarding_completed_at timestamptz,
  friend_location_enabled boolean not null default false,
  anonymous_analytics_enabled boolean not null default false,
  background_tracking_enabled boolean not null default false,
  consent_policy_version integer not null default 1
    check (consent_policy_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can read their own preferences"
  on public.user_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own preferences"
  on public.user_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.user_preferences from anon, authenticated;
grant select on table public.user_preferences to authenticated;
grant insert (
  user_id,
  onboarding_version,
  onboarding_completed_at,
  friend_location_enabled,
  anonymous_analytics_enabled,
  background_tracking_enabled,
  consent_policy_version,
  updated_at
) on public.user_preferences to authenticated;
grant update (
  onboarding_version,
  onboarding_completed_at,
  friend_location_enabled,
  anonymous_analytics_enabled,
  background_tracking_enabled,
  consent_policy_version,
  updated_at
) on public.user_preferences to authenticated;
grant all on table public.user_preferences to service_role;

create table public.user_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (
    purpose in (
      'friend_location',
      'anonymous_crowd_analytics',
      'background_tracking'
    )
  ),
  granted boolean not null,
  policy_version integer not null check (policy_version > 0),
  created_at timestamptz not null default now()
);

create index user_consent_events_user_id_created_at_idx
  on public.user_consent_events (user_id, created_at desc);

alter table public.user_consent_events enable row level security;

create policy "Users can read their own consent history"
  on public.user_consent_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can record their own consent decisions"
  on public.user_consent_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.user_consent_events from anon, authenticated;
grant select on table public.user_consent_events to authenticated;
grant insert (user_id, purpose, granted, policy_version)
  on public.user_consent_events to authenticated;
grant all on table public.user_consent_events to service_role;
grant usage, select on sequence public.user_consent_events_id_seq to authenticated;

create table public.anonymous_crowd_samples (
  id bigint generated always as identity primary key,
  room_id uuid references public.rooms(id) on delete set null,
  floor numeric,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index anonymous_crowd_samples_observed_at_idx
  on public.anonymous_crowd_samples (observed_at desc);
create index anonymous_crowd_samples_room_observed_idx
  on public.anonymous_crowd_samples (room_id, observed_at desc);

alter table public.anonymous_crowd_samples enable row level security;

create policy "Consenting users can submit anonymous crowd samples"
  on public.anonymous_crowd_samples
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_preferences preferences
      where preferences.user_id = (select auth.uid())
        and preferences.anonymous_analytics_enabled
    )
  );

revoke all on table public.anonymous_crowd_samples from anon, authenticated;
grant insert (room_id, floor, observed_at)
  on public.anonymous_crowd_samples to authenticated;
grant all on table public.anonymous_crowd_samples to service_role;
grant usage, select on sequence public.anonymous_crowd_samples_id_seq to authenticated;

create or replace function private.prune_anonymous_crowd_samples()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.anonymous_crowd_samples
  where created_at < now() - interval '2 hours';
  return null;
end;
$$;

revoke all on function private.prune_anonymous_crowd_samples() from public, anon, authenticated;

create trigger prune_anonymous_crowd_samples_after_insert
after insert on public.anonymous_crowd_samples
for each statement execute function private.prune_anonymous_crowd_samples();

create or replace function private.mark_wilma_profile_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_preferences (user_id, profile_source, updated_at)
  values (new.user_id, 'wilma', now())
  on conflict (user_id) do update
    set profile_source = 'wilma', updated_at = now();
  return new;
end;
$$;

revoke all on function private.mark_wilma_profile_source() from public, anon, authenticated;

create trigger wilma_identity_marks_profile_source
after insert or update of user_id on public.wilma_identities
for each row execute function private.mark_wilma_profile_source();

insert into public.user_preferences (user_id, profile_source)
select identities.user_id, 'wilma'
from public.wilma_identities identities
on conflict (user_id) do update
  set profile_source = 'wilma', updated_at = now();

create or replace function private.protect_wilma_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and auth.uid() = old.id
    and exists (
      select 1
      from public.wilma_identities identities
      where identities.user_id = old.id
    )
    and (
      new.name is distinct from old.name
      or new.class is distinct from old.class
    )
  then
    raise exception 'Wilma-verified name and class cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_wilma_profile_fields() from public, anon, authenticated;

create trigger protect_wilma_profile_fields
before update of name, class on public.users
for each row execute function private.protect_wilma_profile_fields();

comment on table public.user_preferences is
  'Current per-user onboarding state and privacy choices. Wilma profile source is server-managed.';
comment on table public.user_consent_events is
  'Append-only history of user privacy choices by policy version.';
comment on table public.anonymous_crowd_samples is
  'Short-lived coarse crowd observations without user ids, class, exact coordinates, or beacon ids.';
