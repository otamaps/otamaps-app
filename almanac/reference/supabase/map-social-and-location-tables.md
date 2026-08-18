---
title: "Map, Social, Location, Queue, And Consent Tables"
summary: "This reference lists the Supabase tables, views, and RPCs used by OtaMaps map data, social relations, shared weekly schedules, BLE beacon lookup, live locations, queue status, canteen reports, consent-gated tracking, anonymous crowd samples, and older location-history helpers."
topics: [reference, supabase, map, social, location, queue, privacy, wilma, schedule-sharing]
sources:
  - id: room-service
    type: file
    path: lib/roomService.ts
  - id: map-route
    type: file
    path: app/(tabs)/map.tsx
  - id: room-modal
    type: file
    path: components/sheets/roomModalSheet.tsx
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
  - id: queue-formatting-core
    type: file
    path: lib/queueFormattingCore.ts
  - id: queue-migration
    type: file
    path: supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql
  - id: queue-grant-migration
    type: file
    path: supabase/migrations/20260812083900_restore_queue_status_execute_grant.sql
  - id: canteen-migration
    type: file
    path: supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql
  - id: queue-config-migration
    type: file
    path: supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql
  - id: id-translation
    type: file
    path: lib/idTranslation.ts
  - id: location-migration
    type: file
    path: database/migrations/001_create_user_locations_table.sql
  - id: location-query-migration
    type: file
    path: supabase/migrations/20260813094204_optimize_location_queries.sql
  - id: location-performance-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/13/rollout-2026-08-13T12-25-53-019ffa71-3d38-7ad0-b45b-aee8355a0812.jsonl
  - id: beacon-admin-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/18/rollout-2026-08-18T08-45-44-01a01367-7d38-7ad3-8e90-2bfebe03dee5.jsonl
  - id: room-wilma-link-migration
    type: file
    path: supabase/migrations/20260813225236_link_map_rooms_to_wilma_rooms.sql
  - id: room-wilma-link-session
    type: conversation
    path: /Users/renesaarikko/.claude/projects/-Users-renesaarikko-projects-otamaps-app/abcc29d5-7f33-499d-a898-7e79cd83a0a8.jsonl
---

# Map, Social, Location, Queue, And Consent Tables

This reference lists Supabase table, view, and RPC names that appear in the map, social, BLE location, queue status, consent, and shared schedule code. The active campus map reads room and feature data, friend/location overlays read social and live-location rows, weekly schedule sharing writes sanitized Wilma lesson snapshots, BLE upload code can upsert the live `locations` table or insert anonymous crowd samples depending on user preferences, queue status reads aggregate RPC output, canteen reporting writes identified current-slot reports through an RPC, and older history helpers still reference `user_locations` plus `latest_user_locations` [@room-service] [@map-route] [@friends-handler] [@shared-schedule] [@location-service] [@user-preferences] [@queue-service] [@canteen-migration]. Use this page as a lookup companion to [room feature data](../../architecture/map/room-feature-data), [friend relations](../../architecture/social/friend-relations), [schedule sharing](../../architecture/social/schedule-sharing), [BLE beacons and location](../../concepts/location/ble-beacons-and-location), [queue status](../../architecture/map/queue-status), and [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences).

## Map Data

| Table | Owner | Use |
| --- | --- | --- |
| `rooms` | `lib/roomService.ts`, `app/(tabs)/map.tsx`, `lib/bleLocationService.ts`, `lib/idTranslation.ts`, `components/sheets/roomModalSheet.tsx` | Room polygons and metadata for map rendering, room modal lookup, beacon room-number lookup, id translation, and room-schedule display; `wilma_id` links a map room to the Wilma room id used for room schedules [@room-service] [@map-route] [@location-service] [@id-translation] [@room-modal] [@room-wilma-link-migration]. |
| `features` | `lib/roomService.ts`, `app/(tabs)/map.tsx` | Map feature geometry used for filtered floor rendering and feature layers [@room-service] [@map-route]. |
| `beacons` | `lib/bleLocationService.ts`, `lib/idTranslation.ts`, admin tooling | BLE beacon catalog keyed by `ble_id` for coordinates, floor, room id, and beacon lookup; admin edits must keep `x`, `y`, `floor`, and `room_id` coherent because the app uses the same row as both coordinate source and room/floor authority [@location-service] [@id-translation] [@beacon-admin-session]. |

`roomService` caches `rooms` and `features` in AsyncStorage for ten minutes, but the tables remain Supabase-backed runtime data rather than static bundled GeoJSON [@room-service]. Room-to-Wilma links should preserve the verified invariant that a linked Wilma room `code` equals the trimmed map `room_number`, every linked id exists in the Wilma room list, and a Wilma id is used by only one map room; the August 13, 2026 production readback showed 50 linked rooms under that invariant after the biology room-number correction [@room-wilma-link-session]. Exact client cache keys are listed in [client caches](../storage/client-caches).

## Social Data

| Table Or View | Owner | Use |
| --- | --- | --- |
| `users` | `lib/googleAuth.ts`, profile screens | Private profile row writes and Me-tab display; this table is covered in [session and identity](../../architecture/auth/session-and-identity) [@google-auth] [@me-screen]. |
| `users_public` | friend add/request screens | Public lookup surface for friend search and requests in the friend UI [@friend-add] [@friend-requests]. |
| `users_ff` | `lib/friendsHandler.ts` | Friend-list profile lookup joined client-side with live locations [@friends-handler]. |
| `relations` | `lib/friendsHandler.ts`, friend add/request screens, `lib/bleLocationService.ts` | Friend request, friend, and blocked relation rows, plus current user's friend ids for location sharing [@friends-handler] [@friend-add] [@friend-requests] [@location-service]. |
| `reports` | `app/(tabs)/map.tsx` | User reports submitted from the map route [@map-route]. |
| `shared_weekly_schedules` | `lib/sharedSchedule.ts`, schedule-sharing migration | Sanitized current-week Wilma lesson snapshots keyed by `(user_id, week_start)`; owner writes and deletes are allowed, and accepted friends can read only when the owner's `schedule_sharing_enabled` preference is true [@shared-schedule] [@shared-schedule-migration]. |

The relations code uses statuses such as `"request"`, `"friends"`, and `"blocked"` in the social flows [@friends-handler]. The location-query optimization migration adds partial indexes for `"friends"` rows in both lookup directions, so performance-sensitive friend/profile/location reads should keep the symmetric accepted-friend predicate aligned with those indexes [@location-query-migration]. See [friend relations](../../architecture/social/friend-relations) for behavioral details.

## Location Data

| Table Or View | Owner | Use |
| --- | --- | --- |
| `locations` | `lib/bleLocationService.ts`, `app/(tabs)/map.tsx`, `lib/friendsHandler.ts` | Active live location table. BLE uploads upsert one row per user on `user_id`, the map reads rows for friend overlays, and friend-list code joins rows to friend profiles [@location-service] [@map-route] [@friends-handler]. |
| `user_locations` | `lib/bleLocationService.ts`, `database/migrations/001_create_user_locations_table.sql` | Older history-oriented insert, history, and cleanup path; the migration creates indexes and RLS policies for this table [@location-service] [@location-migration]. |
| `latest_user_locations` | `lib/bleLocationService.ts`, `database/migrations/001_create_user_locations_table.sql` | View over `user_locations` used by older room-membership helpers [@location-service] [@location-migration]. |
| `anonymous_crowd_samples` | `lib/bleLocationService.ts`, `supabase/migrations/20260808105737_onboarding_and_consents.sql` | Short-lived coarse crowd observations written when anonymous analytics consent is enabled; rows store room, floor, and observed time without user id, class, exact coordinates, or beacon ids, and an insert-time trigger prunes rows older than two hours [@location-service] [@onboarding-migration]. |

The active identified live sharing path is `locations`, not `user_locations` [@location-service]. The `locations` table is now guarded by a consent trigger that rejects authenticated identified-location writes unless the user's `friend_location_enabled` preference is active [@consent-migration]. The older migration and helper methods remain important because they explain why some code and docs still mention history rows or the `latest_user_locations` view [@location-migration] [@location-service].

The location-query optimization migration rewrites the `locations` SELECT policy and the `users` SELECT policy behind `users_ff` to use an indexed accepted-friend `exists` predicate instead of per-row `are_friends()` or `can_access_user_data()` helper calls [@location-query-migration]. A rollback-only validation session measured the same visible rows before and after the change and saw `locations` query time drop from about 530 ms to about 2.5 ms, while `users_ff` dropped from about 46 ms to about 1.8 ms [@location-performance-session]. Treat those numbers as validation evidence for the migration, not as current production proof until the migration is applied and `pg_stat_statements` is reset and rechecked [@location-performance-session].

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
| `queue_area_config` | `supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql`, `lib/queueService.ts` | Per-area reporting configuration keyed by `queue_area_id`: timezone, open/close times, weekdays, slot minutes, minimum community reports, trust-weight cap, manual TTL, and crowd-window minutes. Direct reads are revoked from `anon` and `authenticated`; clients receive the values only through `get_queue_statuses()` [@queue-config-migration] [@queue-service]. |
| `queue_observations` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `lib/queueService.ts` | Append-only manual queue ratings. Authenticated admins can insert only `queue_area_id` and `level`; a trigger sets admin id, server timestamp, and 10-minute anonymous sample count [@queue-migration] [@queue-service]. |
| `canteen_queue_reports` | `supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql`, `lib/queueService.ts` | Identified Ruokalinjasto reports keyed by `(queue_area_id, user_id, slot_start)`. Authenticated users can read only their own raw rows; normal clients write through `record_canteen_queue_report()` rather than direct table insert [@canteen-migration] [@queue-service]. |
| `canteen_contributor_stats` | `supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql` | Per-user canteen contribution totals maintained by a trigger after canteen report inserts; same-slot report corrections update `canteen_queue_reports` without adding another contribution, and authenticated users can read only their own stats [@canteen-migration]. |
| `record_canteen_queue_report(smallint)` | `supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql`, `supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql`, `lib/queueService.ts` | Compatibility RPC that records or corrects the caller's current-slot Ruokalinjasto level. It delegates to the area-aware overload for `ruokalinjasto`, preserving the old signature for installed clients [@canteen-migration] [@queue-config-migration] [@queue-service]. |
| `record_canteen_queue_report(smallint, text)` | `supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql`, `lib/queueService.ts` | Authenticated area-aware RPC that accepts levels 1-5 only during the named area's configured reporting window, then inserts or updates the current configured slot. Rejections include structured detail markers such as `auth_required`, `invalid_level`, `reporting_closed`, and `unknown_area` [@queue-config-migration] [@queue-formatting-core] [@queue-service]. |
| `get_queue_statuses()` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `supabase/migrations/20260812083900_restore_queue_status_execute_grant.sql`, `supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql`, `supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql`, `lib/queueService.ts` | Authenticated aggregate used by the map. During the reporting window, it prefers a fresh manual rating, then current-slot community reports once `min_community_reports` is met, then anonymous sample counts from the configured crowd window; it also returns reporting-window state, report/contributor counts, current-user contribution totals, current-user slot participation, slot start, schema version, next-slot start, and per-area configuration columns. The grant repair and configuration migration both keep execution limited to `authenticated` and `service_role` [@queue-migration] [@queue-grant-migration] [@canteen-migration] [@queue-config-migration] [@queue-service]. |
| `get_admin_queue_activity()` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql`, `supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql`, `lib/queueService.ts` | Admin aggregate that returns anonymous sample count and last sample time without exposing raw anonymous sample rows. The configuration migration leaves this RPC in place, so the historical `sample_count_10m` column name remains for client compatibility and the configured crowd window comes from the matching `get_queue_statuses()` status row [@queue-migration] [@queue-config-migration] [@queue-service]. |
| `private.is_admin()` | `supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql` | Security-definer role check based on `auth.uid()` and `public.users.role`; it replaces the older public `is_admin(uuid)` helper and is used by admin RLS policies [@queue-migration]. |

The same migration hardens `public.users.role`: ordinary clients can read their role through the profile path but cannot insert or update it, role values are constrained to `user` or `admin`, and the default is `user` [@queue-migration]. New queue admins must therefore be assigned through trusted database access rather than through the mobile app [@queue-migration]. `lib/queueService.ts` also skips `get_queue_statuses()` unless Supabase Auth has a session, so an unauthenticated startup render should return no queue rows rather than invoking the authenticated-only RPC as `anon` [@queue-service] [@queue-grant-migration].
