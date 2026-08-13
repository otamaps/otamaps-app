---
title: "Schedule Sharing"
summary: "Schedule sharing is the consented social projection that turns the current user's Wilma week into a sanitized Supabase row visible only to accepted friends."
topics: [architecture, social, schedule-sharing, wilma, privacy, supabase]
sources:
  - id: shared-schedule
    type: file
    path: lib/sharedSchedule.ts
  - id: shared-schedule-core
    type: file
    path: lib/sharedScheduleCore.ts
  - id: schedule-schema-helper
    type: file
    path: lib/scheduleSharingSchema.ts
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: home-route
    type: file
    path: app/(tabs)/home.tsx
  - id: friend-profile-sheet
    type: file
    path: components/friends/FriendProfileSheetContent.tsx
  - id: day-schedule-section
    type: file
    path: components/schedule/DayScheduleSection.tsx
  - id: schedule-dates
    type: file
    path: lib/wilma/scheduleDates.ts
  - id: onboarding-screen
    type: file
    path: app/welcome/(post)/permissions.tsx
  - id: settings-screen
    type: file
    path: app/(app)/me/settings.tsx
  - id: schedule-sharing-migration
    type: file
    path: supabase/migrations/20260811232612_share_weekly_schedule_with_friends.sql
  - id: shared-schedule-test
    type: file
    path: tests/sharedSchedule.test.cjs
  - id: schema-test
    type: file
    path: tests/scheduleSharingSchema.test.cjs
---

# Schedule Sharing

Schedule sharing is the consented social projection that lets an accepted friend see the owner's current school-week lessons without gaining access to the owner's full [Wilma](../../concepts/integrations/wilma) account. The flow starts from the Wilma dashboard, sanitizes the current week's schedule into a narrow lesson list, writes that list to `shared_weekly_schedules`, and reads it from the friend profile sheet only through Supabase RLS [@home-route] [@shared-schedule] [@shared-schedule-core] [@friend-profile-sheet] [@schedule-sharing-migration]. It belongs with [friends and shared location](../../concepts/social/friends-and-shared-location) because the visibility rule is accepted-friend social sharing plus an owner consent flag, not general school-data synchronization.

## Consent Owner

The owner-controlled switch is `user_preferences.schedule_sharing_enabled` [@user-preferences] [@schedule-sharing-migration]. The post-login permissions screen saves that choice with the other consent decisions, while settings exposes a repeatable `Viikkolukujärjestys kavereille` toggle [@onboarding-screen] [@settings-screen]. Both surfaces call the same preference writer, so schedule sharing is part of the consent row and consent-event history rather than a separate local-only switch [@user-preferences].

Turning the setting off is destructive for the projection. The onboarding screen and settings screen both call `clearSharedWeeklySchedules()` when sharing is disabled, and the sync helper also clears the owner's shared rows before returning `null` if it sees the preference disabled [@onboarding-screen] [@settings-screen] [@shared-schedule]. That behavior keeps old schedule snapshots from remaining visible after the owner revokes consent.

## Sync Boundary

The Wilma dashboard remains the recurring sync trigger. When the home tab loads Wilma profile, schedule, messages, and attendance, it passes `scheduleData.schedule` to `syncSharedWeeklySchedule()` in a background fire-and-forget call [@home-route]. Sync failures are reported as handled Sentry warnings under `area: "shared_schedule"` and do not block rendering the dashboard data [@home-route].

The consent surfaces now also try an immediate first sync when the user enables sharing. The settings toggle and post-login permissions flow both save `schedule_sharing_enabled`, fetch the Wilma schedule with `forceRefresh: true`, and pass the returned lessons to `syncSharedWeeklySchedule()`; if Wilma cannot load at that moment, the consent remains enabled and the user is told that the next Wilma-tab load can sync the snapshot [@settings-screen] [@onboarding-screen]. This matters because an enabled consent no longer waits silently for a later dashboard visit before producing a friend-visible row.

`syncSharedWeeklySchedule()` reads preferences with `forceRefresh: true`, then either clears snapshots or upserts one row into `shared_weekly_schedules` [@shared-schedule] [@user-preferences]. The forced preference read preserves schedule sharing as a cross-device consent: a stale local cache must not delete a snapshot after another signed-in device enabled sharing [@shared-schedule]. The row is keyed by `(user_id, week_start)`, stores `lessons` as JSONB, and writes `updated_at` from the client payload [@shared-schedule] [@schedule-sharing-migration]. The table reference for this row is [map, social, location, queue, and consent tables](../../reference/supabase/map-social-and-location-tables).

## Sanitized Lesson Shape

The projection uses `buildSharedWeek()` instead of storing the full Wilma schedule object [@shared-schedule-core]. The helper computes the Monday of the current week, keeps only Monday through Friday dates for that school week, collapses duplicate reservation/date pairs, sorts by date and start time, and emits only `id`, `date`, `start`, `end`, `subject`, and `room` [@shared-schedule-core]. String fields are trimmed and length-limited, and a missing subject becomes `Oppitunti` [@shared-schedule-core].

The focused tests document the intended privacy boundary. `tests/sharedSchedule.test.cjs` checks that non-school-week dates are excluded, duplicate reservation dates are collapsed, output is sorted, and extra source fields such as private notes do not appear in the shared lesson [@shared-schedule-test]. Future changes that add fields to the projection should treat this as a privacy change, then update the database, UI, tests, and consent copy together.

## Friend Read Path

Friend profile content resolves one active school day when a friend sheet opens, calls `fetchFriendSharedSchedule(friend.id, activeDay)`, and filters the returned lesson list to that date before rendering [@friend-profile-sheet] [@schedule-dates]. The active day is today on Monday through Friday and the upcoming Monday on weekends, so the friend sheet does not open on Saturday or Sunday to a stale Friday view [@schedule-dates]. The helper still queries by the matching week start, returns `null` when no row is visible, and normalizes stored lesson JSON back through a parser that accepts only date, start, end, subject, id, and room fields [@shared-schedule]. The UI renders that one day through `DayScheduleSection` and shows an empty state when no lessons are shared for the active day [@friend-profile-sheet] [@day-schedule-section].

Database policy is the final visibility boundary. The migration enables RLS and defines `private.can_view_shared_weekly_schedule(owner_id)`, which allows the owner to read their own row and allows another authenticated user to read only when the owner still has `schedule_sharing_enabled` true and a `relations` row in either direction has `status = 'friends'` [@schedule-sharing-migration]. Owners can insert, update, and delete only their own rows [@schedule-sharing-migration].

## Schema Drift Handling

The client has explicit compatibility handling for deployments where the schedule-sharing schema has not arrived yet. `isMissingScheduleSharingSchema()` recognizes missing table, missing column, and legacy consent-purpose constraint errors by code or message [@schedule-schema-helper]. Preference writes and consent-event writes can fall back to legacy columns only when the user is not enabling schedule sharing; enabling the feature against a missing schema raises a Finnish unavailable error instead [@user-preferences] [@schedule-schema-helper]. `tests/scheduleSharingSchema.test.cjs` checks those exact recognized errors and verifies that unrelated errors such as RLS denial are not swallowed [@schema-test].

Treat this fallback as a rollout bridge, not as the steady-state data model. Production proof for a schedule-sharing release needs the Supabase migration applied, the REST/Data API able to see `shared_weekly_schedules`, the Wilma dashboard sync path running, and a friend read path checked through accepted-friend credentials. Local UI tests or EAS build success alone do not prove the table and RLS policy are live.
