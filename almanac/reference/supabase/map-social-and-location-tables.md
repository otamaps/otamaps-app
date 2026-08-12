---
title: "Map, Social, Location, Queue, And Consent Tables"
summary: "This reference lists the Supabase tables, views, and RPCs used by OtaMaps map data, social relations, shared weekly schedules, BLE beacon lookup, live locations, queue status, consent-gated tracking, anonymous crowd samples, and older location-history helpers."
topics: [reference, supabase, map, social, location, queue, privacy, wilma]
sources:
  - id: room-service
    type: file
    path: lib/roomService.ts
  - id: map-route
    type: file
    path: app/(tabs)/map.tsx
  - id: friends-handler
    type: file
    path: lib/friendsHandler.ts
  - id: friend-add
    type: file
    path: app/(app)/friends/add.tsx
  - id: friend-requests
    type: file
    path: app/(app)/friends/requests.tsx
  - id: google-auth
    type: file
    path: lib/googleAuth.ts
  - id: me-screen
    type: file
    path: app/(tabs)/me.tsx
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: shared-schedule
    type: file
    path: lib/sharedSchedule.ts
  - id: onboarding-migration
    type: file
    path: supabase/migrations/20260808105737_onboarding_and_consents.sql
  - id: consent-migration
    type: file
    path: supabase/migrations/20260808114122_enforce_identified_location_consent.sql
  - id: shared-schedule-migration
    type: file
    path: supabase/migrations/20260811232612_share_weekly_schedule_with_friends.sql
  - id: queue-service
    type: file
    path: lib/queueService.ts
  - id: queue-migration
    type: file
    path: supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql
  - id: queue-grant-migration
    type: file
    path: supabase/migrations/20260812083900_restore_queue_status_execute_grant.sql
  - id: id-translation
    type: file
    path: lib/idTranslation.ts
  - id: location-migration
    type: file
    path: database/migrations/001_create_user_locations_table.sql
---

# Map, Social, And Location Tables

This reference lists Supabase table, view, and RPC names that appear in the map, social, BLE location, queue status, consent, and shared schedule code. The active campus map reads room and feature data, friend/location overlays read social and live-location rows, weekly schedule sharing writes sanitized Wilma lesson snapshots, BLE upload code can upsert the live `locations` table or insert anonymous crowd samples depending on user preferences, queue status reads aggregate RPC output, and older history helpers still reference `user_locations` plus `latest_user_locations` [@room-service] [@map-route] [@friends-handler] [@shared-schedule] [@location-service] [@user-preferences] [@queue-service]. Use this page as a lookup companion to [room feature data](../../architecture/map/room-feature-data), [friend relations](../../architecture/social/friend-relations), [BLE beacons and location](../../concepts/location/ble-beacons-and-location), [queue status](../../architecture/map/queue-status), and [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences).

## Map Data

| Table | Owner | Use |
| --- | --- | --- |
| `rooms` | `lib/roomService.ts`, `app/(tabs)/map.tsx`, `lib/bleLocationService.ts`, `lib/idTranslation.ts` | Room polygons and metadata for map rendering, room modal lookup, beacon room-number lookup, and id translation [@room-service] [@map-route] [@location-service] [@id-translation]. |
| `features` | `lib/roomService.ts`, `app/(tabs)/map.tsx` | Map feature geometry used for filtered floor rendering and feature layers [@room-service] [@map-route]. |
| `beacons` | `lib/bleLocationService.ts`, `lib/idTranslation.ts` | BLE beacon catalog keyed by `ble_id` for coordinates, floor, room id, and beacon lookup [@location-service] [@id-translation]. |

`roomService` caches `rooms` and `features` in AsyncStorage for ten minutes, but the tables remain Supabase-backed runtime data rather than static bundled GeoJSON [@room-service]. Exact client cache keys are listed in [client caches](../storage/client-caches).

## Social Data

| Table Or View | Owner | Use |
| --- | --- | --- |
| `users` | `lib/googleAuth.ts`, profile screens | Private profile row writes and Me-tab display; this table is covered in [session and identity](../../architecture/auth/session-and-identity) [@google-auth] [@me-screen]. |
| `users_public` | friend add/request screens | Public lookup surface for friend search and requests in the friend UI [@friend-add] [@friend-requests]. |
| `users_ff` | `lib/friendsHandler.ts` | Friend-list profile lookup joined client-side with live locations [@friends-handler]. |
| `relations` | `lib/friendsHandler.ts`, friend add/request screens, `lib/bleLocationService.ts` | Friend request, friend, and blocked relation rows, plus current user's friend ids for location sharing [@friends-handler] [@friend-add] [@friend-requests] [@location-service]. |
| `reports` | `app/(tabs)/map.tsx` | User reports submitted from the map route [@map-route]. |
| `shared_weekly_schedules` | `lib/sharedSchedule.ts`, schedule-sharing migration | Sanitized current-week Wilma lesson snapshots keyed by `(user_id, week_start)`; owner writes and deletes are allowed, and accepted friends can read only when the owner's `schedule_sharing_enabled` preference is true [@shared-schedule] [@shared-schedule-migration]. |

The relations code uses statuses such as `"request"`, `"friends"`, and `"blocked"` in the social flows [@friends-handler]. See [friend relations](../../architecture/social/friend-relations) for behavioral details.

## Location Data

| Table Or View | Owner | Use |
| --- | --- | --- |
| `locations` | `lib/bleLocationService.ts`, `app/(tabs)/map.tsx`, `lib/friendsHandler.ts` | Active live location table. BLE uploads upsert one row per user on `user_id`, the map reads rows for friend overlays, and friend-list code joins rows to friend profiles [@location-service] [@map-route] [@friends-handler]. |
| `user_locations` | `lib/bleLocationService.ts`, `database/migrations/001_create_user_locations_table.sql` | Older history-oriented insert, history, and cleanup path; the migration creates indexes and RLS policies for this table [@location-service] [@location-migration]. |
| `latest_user_locations` | `lib/bleLocationService.ts`, `database/migrations/001_create_user_locations_table.sql` | View over `user_locations` used by older room-membership helpers [@location-service] [@location-migration]. |
| `anonymous_crowd_samples` | `lib/bleLocationService.ts`, `supabase/migrations/20260808105737_onboarding_and_consents.sql` | Short-lived coarse crowd observations written when anonymous analytics consent is enabled; rows store room, floor, and observed time without user id, class, exact coordinates, or beacon ids [@location-service] [@onboarding-migration]. |

The active identified live sharing path is `locations`, not `user_locations` [@location-service]. The `locations` table is now guarded by a consent trigger that rejects authenticated identified-location writes unless the user's `friend_location_enabled` preference is active [@consent-migration]. The older migration and helper methods remain important because they explain why some code and docs still mention history rows or the `latest_user_locations` view [@location-migration] [@location-service].

## Consent Data

| Table | Owner | Use |
| --- | --- | --- |
| `user_preferences` | `lib/userPreferences.ts`, onboarding/settings screens, consent migrations | Current per-user onboarding state, Wilma profile source, privacy choices, and consent policy version; client inserts and updates omit `profile_source`, while a Wilma identity trigger can mark that source server-side [@user-preferences] [@onboarding-migration]. |
| `user_consent_events` | `lib/userPreferences.ts`, consent migrations | Append-only consent decision history for `friend_location`, `weekly_schedule`, `anonymous_crowd_analytics`, and `background_tracking` by policy version [@user-preferences] [@onboarding-migration] [@shared-schedule-migration]. |

`user_preferences_background_requires_purpose` prevents background tracking from being true unless friend location or anonymous analytics is also true [@consent-migration]. `schedule_sharing_enabled` is independent from that tracking constraint because it controls read access to a sanitized weekly Wilma snapshot, not BLE collection [@shared-schedule-migration]. This matches the client behavior in [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences): background tracking is a native runtime mode for an enabled tracking purpose, while schedule sharing is a separate social consent.

## Queue And Admin Data

| Table Or RPC | Owner | Use |
| --- | --- | --- |
| `queue_areas` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `lib/queueService.ts` | Database-managed queue locations shown to authenticated users; the initial active row is `ruokalinjasto`, linked to the matching `rooms` row [@queue-migration] [@queue-service]. |
| `queue_observations` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `lib/queueService.ts` | Append-only manual queue ratings. Authenticated admins can insert only `queue_area_id` and `level`; a trigger sets admin id, server timestamp, and 10-minute anonymous sample count [@queue-migration] [@queue-service]. |
| `get_queue_statuses()` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `supabase/migrations/20260812083900_restore_queue_status_execute_grant.sql`, `lib/queueService.ts` | Authenticated aggregate used by the map. It prefers a manual rating from the last 20 minutes, otherwise derives an automatic level from 10-minute anonymous sample counts; the grant repair revokes execution from `public` and `anon` and grants it to `authenticated` and `service_role` [@queue-migration] [@queue-grant-migration] [@queue-service]. |
| `get_admin_queue_activity()` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `lib/queueService.ts` | Admin aggregate that returns 10-minute sample counts and last sample time without exposing raw anonymous sample rows [@queue-migration] [@queue-service]. |
| `private.is_admin()` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql` | Security-definer role check based on `auth.uid()` and `public.users.role`; it replaces the older public `is_admin(uuid)` helper and is used by admin RLS policies [@queue-migration]. |

The same migration hardens `public.users.role`: ordinary clients can read their role through the profile path but cannot insert or update it, role values are constrained to `user` or `admin`, and the default is `user` [@queue-migration]. New queue admins must therefore be assigned through trusted database access rather than through the mobile app [@queue-migration]. `lib/queueService.ts` also skips `get_queue_statuses()` unless Supabase Auth has a session, so an unauthenticated startup render should return no queue rows rather than invoking the authenticated-only RPC as `anon` [@queue-service] [@queue-grant-migration].
