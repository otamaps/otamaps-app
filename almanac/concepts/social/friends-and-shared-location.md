---
title: "Friends And Shared Location"
summary: "Friends and shared location is the social layer that connects six-digit friend codes, relation rows, friend lists, live map markers, shared weekly schedules, removal, blocking, and reports."
topics: [concepts, social, location, supabase, wilma, privacy, schedule-sharing]
sources:
  - id: friends-handler
    type: file
    path: lib/friendsHandler.ts
  - id: add-friend
    type: file
    path: app/(app)/friends/add.tsx
  - id: requests-route
    type: file
    path: app/(app)/friends/requests.tsx
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
  - id: friend-item
    type: file
    path: components/friendItem.tsx
  - id: friend-modal
    type: file
    path: components/sheets/friendModalSheet.tsx
  - id: friend-profile-sheet
    type: file
    path: components/friends/FriendProfileSheetContent.tsx
  - id: schedule-dates
    type: file
    path: lib/wilma/scheduleDates.ts
  - id: shared-schedule
    type: file
    path: lib/sharedSchedule.ts
  - id: shared-schedule-core
    type: file
    path: lib/sharedScheduleCore.ts
  - id: shared-schedule-migration
    type: file
    path: supabase/migrations/20260811232612_share_weekly_schedule_with_friends.sql
---

# Friends And Shared Location

Friends and shared location is the OtaMaps social model for finding classmates by a six-digit code, creating a relation, showing app friend records in the map bottom sheet, rendering friends with live coordinates on the selected floor, and optionally showing a friend's shared current-week schedule. The implementation spans the friend-code screens, relation helpers, friend list cache, location overlay, shared schedule helpers, and friend action modal [@add-friend] [@friends-handler] [@map-screen] [@shared-schedule]. It is social identity plus consented presence/schedule sharing, not a separate chat or contact system.

## Friend Codes And Requests

Adding a friend starts from a six-character code. The add-friend route waits until the entered code has length six, searches `users_public` by `code`, and hides a result when the found user has blocked the current user through a `relations` row where the found user is the subject and the current user is the object [@add-friend]. If a matching user is visible, the route checks both subject-object directions in `relations` before showing whether the relationship is already requested or accepted [@add-friend].

Sending a request inserts one row into `relations` with the current user as `subject`, the found user as `object`, and `status: "request"` [@add-friend]. Incoming requests are rows where `status` is `request` and `object` is the current user; both the combined add-friend screen and the dedicated requests route fetch requester profile rows from `users_public` after loading the relation rows [@add-friend] [@requests-route].

Acceptance changes the matching relation row to `status: "friends"` using a symmetric subject-object filter. Rejection deletes the matching relation row with the same symmetric filter [@add-friend] [@requests-route]. The symmetric query shape is part of the relation architecture documented in [friend relations](../../architecture/social/friend-relations).

## Friend List And Presence

The active friend list helper first reads accepted `relations` in either direction, derives the other user ids, and then queries `users_ff` profiles plus `locations` rows with `.in(..., friendIds)` [@friends-handler]. For each friend, it derives `lastSeen` from `locations.updated_at`, `location` from the `x` and `y` columns, and a user-friendly room/status value from the strongest beacon in the location row [@friends-handler]. The result is cached in AsyncStorage under `cached_friends`, so a non-forced friend fetch can return cached social data before touching Supabase [@friends-handler].

The map screen force-refreshes friends on focus and separately polls the combined friend rows every 30 seconds [@map-screen]. Its visible friend overlay is therefore an accepted friend list joined to friend-scoped location data in the client. Database visibility still belongs to Supabase RLS and the accepted-friend predicates described in [live location overlays](../../architecture/location/live-location-overlays), not to the map renderer alone.

## Map Representation

Friend locations become GeoJSON point features only when a friend has coordinates and the friend's `locationData.floor` matches the selected floor [@map-screen]. Friends at the same rounded coordinate are spread in a small circle before rendering, so overlapping people remain tappable on the map [@map-screen]. Pressing a friend feature opens the friend modal, while pressing a friend in the bottom sheet can also move the camera to the friend location and switch floors based on the status string [@map-screen].

The bottom-sheet row is a compact presence summary. `FriendItem` shows the profile initial, display name, status text, and a relative last-seen string such as "Nyt" for very recent updates [@friend-item]. Status coloring is conservative: most statuses, including `ei sijaintia`, resolve to gray, while the special `busy` branch is the only explicit non-gray state in the component logic [@friend-item].

The modal container itself is a reusable bottom sheet with minimum, middle, and maximum snap heights derived from screen height [@friend-modal]. The map supplies the actual friend actions and status content inside that sheet [@map-screen].

## Shared Weekly Schedule

Friend profile content can load `fetchFriendSharedSchedule(friend.id, activeDay)` and render `Päivän lukujärjestys` for one active school day: today on weekdays, or the upcoming Monday on weekends [@friend-profile-sheet] [@schedule-dates] [@shared-schedule]. An empty state means the friend has not shared lessons for that day, has not shared a schedule for that week, or the RLS policy did not expose the row; the UI does not fall back to the friend's full Wilma account or live schedule endpoint [@friend-profile-sheet] [@shared-schedule-migration]. The cross-file sync and RLS boundary is explained in [schedule sharing](../../architecture/social/schedule-sharing).

The shared record is sanitized before it reaches Supabase. `buildSharedWeek()` emits only lesson id, date, start, end, subject, and room for Monday through Friday of the selected school week, collapses duplicate reservation/date pairs, and sorts the result before syncing [@shared-schedule-core]. Database read access is friend-scoped: the `shared_weekly_schedules` RLS policy lets owners read their own rows and lets accepted friends read only when the owner still has `schedule_sharing_enabled` true in `user_preferences` [@shared-schedule-migration]. This makes schedule sharing closer to friend location than to Wilma messaging: it is a consented social projection, not general Wilma data access.

## Removal, Blocking, And Reports

Removing a friend deletes `relations` rows whose status is `friends` in either subject-object direction [@friends-handler]. The helper named `handleBlockFriend` first deletes any relation in either direction and then inserts a new `relations` row from the current user to the friend with `status: "blocked"` [@friends-handler].

The current map modal has an important mismatch: the visible "Estä" action calls `handleRemoveFriend(friendId)` instead of `handleBlockFriend(friendId)` [@map-screen]. From the current code, the map's block button removes the friendship relation; it does not create the blocked relation row that the add-friend search checks [@map-screen] [@friends-handler].

Reporting is separate from relation status. The modal prompts for a reason and inserts `{ user_id: friendId, reason }` into the `reports` table [@map-screen]. It does not change the friend relation or location sharing state.

## Related Pages

Use [friend relations](../../architecture/social/friend-relations) for the relation status transitions and symmetric query boundary. Use [live location overlays](../../architecture/location/live-location-overlays) for the map overlay flow, [schedule sharing](../../architecture/social/schedule-sharing) for the friend-visible Wilma week projection, [map social and location tables](../../reference/supabase/map-social-and-location-tables) for table-name lookup, [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences) for the sharing toggles, and [edit profile and sign out](../../guides/account/edit-profile-and-sign-out) for the account surface that exposes the user's own friend code.
