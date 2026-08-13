---
title: "Room And Feature Data"
summary: "Room and feature data is fetched from Supabase through Zustand stores and cached in AsyncStorage before the map screen renders it."
topics: [architecture, map, supabase, storage]
sources:
  - id: room-service
    type: file
    path: lib/roomService.ts
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
  - id: null-room-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/09/rollout-2026-08-09T01-56-35-019fe397-a8b7-7ea0-ac45-84bdfaa1f182.jsonl
  - id: room-modal
    type: file
    path: components/sheets/roomModalSheet.tsx
  - id: day-schedule-section
    type: file
    path: components/schedule/DayScheduleSection.tsx
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: schedule-dates
    type: file
    path: lib/wilma/scheduleDates.ts
  - id: room-wilma-link-migration
    type: file
    path: supabase/migrations/20260813225236_link_map_rooms_to_wilma_rooms.sql
  - id: room-wilma-link-session
    type: conversation
    path: /Users/renesaarikko/.claude/projects/-Users-renesaarikko-projects-otamaps-app/abcc29d5-7f33-499d-a898-7e79cd83a0a8.jsonl
  - id: feature-service
    type: file
    path: lib/featureFlagService.ts
  - id: rooms-debug
    type: file
    path: app/(app)/debug/supabase/rooms.tsx
  - id: features-debug
    type: file
    path: app/(app)/debug/supabase/features.tsx
---

# Room And Feature Data

Room and feature data is the Supabase-backed map dataset that feeds the active OtaMaps indoor map. `lib/roomService.ts` defines separate Zustand stores for rooms and features, persists each store to AsyncStorage for ten minutes, and exposes force-refresh and clear methods [@room-service]. The map screen calls both fetch methods on mount, transforms room records into list data, filters rooms and features by numeric floor, and turns records with geometry into the Mapbox sources used by [geospatial rendering](geospatial-rendering) [@map-screen].

## Store Boundary

The room store owns records from the `rooms` table. A room has id, room number, title, description, seats, type, equipment, Wilma id, bookable flag, image URL, schedule, status, numeric floor, and optional geometry [@room-service]. The feature store owns records from the `features` table. A feature has id, nullable geometry, numeric floor, type, and free-form properties [@room-service].

Both stores use the same cache time-to-live constant, `10 * 60 * 1000`, so a non-forced fetch returns immediately when the in-memory `lastFetched` value is younger than ten minutes [@room-service]. If memory is stale or empty, each store checks AsyncStorage, validates the cached timestamp against the same TTL, and only then queries Supabase [@room-service]. Room data is cached under `room_cache`; feature data is cached under `features_cache` [@room-service].

## Fetch Flow

`fetchRooms` and `fetchFeatures` share the same control flow. They skip work when fresh in-memory state exists, set loading and clear error state before a real fetch, optionally hydrate fresh AsyncStorage data, query Supabase with `select('*')`, write the returned data and timestamp back to AsyncStorage, and update the Zustand state [@room-service]. Errors are stored as message strings on the same store state instead of being thrown to UI callers [@room-service].

The map screen keeps refs to the current fetch functions and calls both on mount [@map-screen]. When `rooms` changes, it transforms rooms into bottom-sheet list rows and logs floor counts; when `features` changes, it logs type and floor counts [@map-screen]. These logs are debugging support, but the functional dependency is the transformed room list, filtered room geometries, and filtered features that the renderer derives from store state.

## Consumers

The map screen is the main consumer. It uses rooms for the bottom-sheet room list, selectable room polygons, WC symbols, and camera focus [@map-screen]. It uses features for wall and stairs extrusions after validating that each feature has a geometry type and coordinate array [@map-screen]. These rendering rules depend on the [campus map model](../../concepts/map/campus-map-model), especially numeric floors and Mapbox coordinate order.

`RoomModalSheet` is the detail consumer. Its `open(id)` method first looks for the room in the current room store, presents the modal immediately when found, and otherwise calls `fetchRooms()` before searching the updated store [@room-modal]. That means a selected room can open without an extra network request after the map screen has already populated the cache. For rooms whose `wilma_id` parses as a positive integer, the modal also checks for a stored Wilma session, fetches `fetchWilmaRoomSchedule(wilmaId, weekMonday)`, filters the result to the active school day, and renders it through the shared `DayScheduleSection` [@room-modal] [@graphql-client] [@schedule-dates] [@day-schedule-section]. Rooms without a Wilma id hide the schedule card rather than probing the Wilma room endpoint [@room-modal].

The same room detail surface also checks the cached `booking` feature flag before exposing booking UI, so room UI changes should be read together with [feature flags](../runtime/feature-flags) when they touch booking behavior [@room-modal] [@feature-service].

The Supabase debug route for rooms queries `rooms` directly and renders id, room number, title, description, seats, and equipment [@rooms-debug]. The feature debug route is currently only a placeholder screen, so it is not a live inspection tool for feature records yet [@features-debug].

## Failure Modes And Invariants

The stores do not validate database shape beyond TypeScript declarations. If Supabase returns malformed room geometry, the room path may still reach rendering because room geometry is only checked for existence before becoming GeoJSON [@map-screen]. Feature rendering is stricter: malformed feature geometries are logged and skipped before the `featuresSource` is built [@map-screen].

Display fields need the same caution. `Room` currently types `room_number` and `title` as strings, but `fetchRooms` stores raw `select('*')` results without normalization, and a map-screen crash showed a live room with `room_number: null` reaching label sizing [@room-service] [@null-room-session]. Rendering code should normalize room numbers and titles at the consumer boundary instead of assuming those TypeScript declarations describe every live row [@map-screen].

The floor field must stay numeric. The room list, room polygons, feature extrusions, friend overlays, local user overlay, and search floor switching all compare floor values against `selectedFloor` as a number [@map-screen]. If future migrations change floor representation, update the store types, map filters, search hits, and room modal display together rather than fixing only the renderer.

`rooms.wilma_id` is the bridge from a Supabase map room to the Wilma room schedule query; it is not the Supabase room id [@room-service] [@graphql-client]. The August 13, 2026 backfill linked ten additional rooms and corrected `2339 Biologia` to `2239` before assigning Wilma id `5372`, with guards that avoid overwriting non-null `wilma_id` values and only rename the biology row while it still has the old room number [@room-wilma-link-migration]. After the migration was applied, production readback showed 50 linked rooms, every linked Wilma room code matched the trimmed map `room_number`, no linked id was dangling, and no Wilma id was used by more than one map room [@room-wilma-link-session]. Future room-link backfills should preserve that code-match and uniqueness invariant rather than linking by title alone.

## Relationship To References

Use the Supabase table reference for exact table names and related social/location tables: [map social and location tables](../../reference/supabase/map-social-and-location-tables). Use [client caches](../../reference/storage/client-caches) for the full list of AsyncStorage and SecureStore keys. This page stays focused on the runtime ownership and flow for room and feature data.
