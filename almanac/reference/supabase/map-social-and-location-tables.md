---
title: "Map, Social, Location, And Consent Tables"
summary: "This reference lists the Supabase tables and views used by OtaMaps map data, social relations, BLE beacon lookup, live locations, consent-gated tracking, anonymous crowd samples, and older location-history helpers."
topics: [reference, supabase, map, social, location, privacy]
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
  - id: onboarding-migration
    type: file
    path: supabase/migrations/20260808105737_onboarding_and_consents.sql
  - id: consent-migration
    type: file
    path: supabase/migrations/20260808114122_enforce_identified_location_consent.sql
  - id: id-translation
    type: file
    path: lib/idTranslation.ts
  - id: location-migration
    type: file
    path: database/migrations/001_create_user_locations_table.sql
---

# Map, Social, And Location Tables

This reference lists Supabase table and view names that appear in the map, social, BLE location, and consent code. The active campus map reads room and feature data, friend/location overlays read social and live-location rows, BLE upload code can upsert the live `locations` table or insert anonymous crowd samples depending on user preferences, and older history helpers still reference `user_locations` plus `latest_user_locations` [@room-service] [@map-route] [@friends-handler] [@location-service] [@user-preferences]. Use this page as a lookup companion to [room feature data](../../architecture/map/room-feature-data), [friend relations](../../architecture/social/friend-relations), [BLE beacons and location](../../concepts/location/ble-beacons-and-location), and [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences).

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
| `user_consent_events` | `lib/userPreferences.ts`, `supabase/migrations/20260808105737_onboarding_and_consents.sql` | Append-only consent decision history for `friend_location`, `anonymous_crowd_analytics`, and `background_tracking` by policy version [@user-preferences] [@onboarding-migration]. |

`user_preferences_background_requires_purpose` prevents background tracking from being true unless friend location or anonymous analytics is also true [@consent-migration]. This matches the client behavior in [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences): background tracking is a native runtime mode for an enabled tracking purpose, not an independent data use.
