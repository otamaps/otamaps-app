alter table public.user_preferences
add constraint user_preferences_background_requires_purpose
check (
  not background_tracking_enabled
  or friend_location_enabled
  or anonymous_analytics_enabled
);

create policy "Users can delete their own identified location"
  on public.locations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.enforce_identified_location_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and new.user_id = auth.uid()
    and not exists (
      select 1
      from public.user_preferences preferences
      where preferences.user_id = auth.uid()
        and preferences.friend_location_enabled
    )
  then
    raise exception 'Identified location sharing is not enabled'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_identified_location_consent()
  from public, anon, authenticated;

create trigger enforce_identified_location_consent
before insert or update on public.locations
for each row execute function private.enforce_identified_location_consent();

comment on function private.enforce_identified_location_consent() is
  'Fails closed when an authenticated user writes identified location data without active friend-location consent.';
