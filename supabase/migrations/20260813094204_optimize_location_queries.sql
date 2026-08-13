-- The location RLS policies and users_ff view resolve accepted friendships via
-- either direction of a relations row. Partial indexes keep those checks small
-- without adding write overhead for pending requests and blocked relations.
create index if not exists relations_friends_subject_object_idx
  on public.relations (subject, object)
  where status = 'friends';

create index if not exists relations_friends_object_subject_idx
  on public.relations (object, subject)
  where status = 'friends';

-- Preserve the existing access contract while replacing the per-row
-- SECURITY DEFINER function call in the locations SELECT policy with one
-- set-based relation lookup. The user's own row remains visible for the
-- upsert/update path, and accepted friends remain symmetric.
drop policy if exists "Allow fetch for user's friends" on public.locations;
create policy "Users and friends can read shared locations"
  on public.locations
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.relations relation
      where relation.status = 'friends'
        and (
          (
            relation.subject = (select auth.uid())
            and relation.object = locations.user_id
          )
          or (
            relation.object = (select auth.uid())
            and relation.subject = locations.user_id
          )
        )
    )
  );

-- users_ff is a security-invoker view over public.users, whose existing
-- friend policy calls can_access_user_data() once per profile row. Use the
-- same indexed set-based predicate as locations so targeted friend-profile
-- reads do not pay that function-call cost.
drop policy if exists "Allow access to friends" on public.users;
create policy "Users can read accepted friend profiles"
  on public.users
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.relations relation
      where relation.status = 'friends'
        and (
          (
            relation.subject = (select auth.uid())
            and relation.object = users.id
          )
          or (
            relation.object = (select auth.uid())
            and relation.subject = users.id
          )
        )
    )
  );

-- locations.user_id already has the unique constraint required by the client
-- upsert's onConflict target, so an additional user_id index would be redundant.
analyze public.relations;
analyze public.locations;
analyze public.users;
