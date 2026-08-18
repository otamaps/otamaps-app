---
title: "BLE Beacons And Location"
summary: "BLE beacons give OtaMaps an indoor location estimate by turning nearby room broadcasts into coordinates, floors, accuracy radius, and live sharing records."
topics: [concepts, location, ble, supabase]
sources:
  - id: core
    type: file
    path: lib/bleTrackingCore.ts
  - id: types
    type: file
    path: lib/bleTrackingTypes.ts
  - id: runtime
    type: file
    path: lib/bleTrackingRuntime.ts
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: estimator
    type: file
    path: lib/blePositionEstimator.ts
  - id: catalog-cache
    type: file
    path: lib/bleBeaconCatalog.ts
  - id: admin-policy
    type: file
    path: supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql
  - id: admin-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/18/rollout-2026-08-18T08-45-44-01a01367-7d38-7ad3-8e90-2bfebe03dee5.jsonl
  - id: background-task
    type: file
    path: lib/bleBackgroundTask.ts
  - id: ble-doc
    type: file
    path: docs/BLE_LOCATION_TRACKING.md
  - id: location-migration
    type: file
    path: database/migrations/001_create_user_locations_table.sql
---

# BLE Beacons And Location

BLE beacons are OtaMaps' indoor location signal. The app looks for nearby ESP32 room beacons, extracts a beacon id from OtaMaps service data or manufacturer data, maps observed beacon ids to coordinates and floor data, and then produces a local estimate and a live shared row for the current user [@core] [@runtime] [@location-service] [@estimator]. This concept sits between [BLE background location](../../architecture/location/ble-background-location), which keeps scanning alive, and [live location overlays](../../architecture/location/live-location-overlays), which draw the local user and friends on the map.

## Beacon Identity

The active OtaMaps beacon format is defined around the service UUID `f47fcfd9-0634-49de-8e99-80d05ae8fcef`, service data containing the beacon identifier, manufacturer data as a fallback, and an RSSI threshold of `-80` dBm [@types] [@core]. Device names are advisory because iOS may omit them from advertisements delivered while the app is in the background [@core]. The parser therefore requires the OtaMaps service UUID or service data, an acceptable RSSI value, and a decoded id that is non-empty, not `none`, not overlong, and free of control characters [@core].

The runtime treats the advertised id as the lookup key. It decodes service data first, then manufacturer data, and rejects the device if neither path yields a usable id [@core] [@runtime]. That id is not itself the final map position. It is a key into the beacon data stored in Supabase, where the location service loads `ble_id`, `x`, `y`, `floor`, and `room_id` from the `beacons` table [@location-service].

## From Signal To Estimate

OtaMaps builds a bounded same-floor estimate rather than treating every audible beacon as equally authoritative. The runtime keeps active observations, smooths RSSI readings, drops stale entries after `BLE_BEACON_STALE_MS`, and chooses one anchor beacon through `BeaconSelectionEngine` [@core] [@types] [@runtime]. `estimatePosition` resolves observed ids through the beacon catalog, falls back to the anchor's exact coordinates for a single beacon or floorless anchor, and otherwise computes a weighted centroid from at most four strongest beacons on the anchor floor [@estimator] [@types].

The active live estimate adds stability before switching anchors. If a stronger beacon is only marginally stronger than the currently selected beacon, the selection engine keeps the current selection until the candidate either has at least a 6 dB advantage or wins three consecutive readings [@core]. This protects the map overlay from rapid room-to-room jumping when the phone hears adjacent beacons with similar strengths, while the centroid can still move within the same floor between uploads [@core] [@estimator].

Floor selection comes from the anchor beacon record, not from room-number parsing. The catalog cache reads a one-day AsyncStorage snapshot, refreshes stale data without blocking callers, fetches missing ids in a single batch, and stores merged rows back into the same cache [@catalog-cache] [@location-service]. The estimator ignores observations on other floors and falls back to the anchor coordinate when the anchor has no authoritative floor, because blending through a ceiling would be less trustworthy than a single-beacon estimate [@estimator].

## Admin Maintenance Boundary

The mobile app consumes beacon records but does not provide a beacon editor. The shared contract is the Supabase `beacons` row: `ble_id` is the advertisement lookup key, `x` and `y` are the indoor map coordinates, `floor` is the anchor floor, and `room_id` is the room authority used by location display [@types] [@location-service]. Admin maintenance tooling therefore has to update coordinates, floor, and room mapping together when a beacon is created or moved; otherwise the weighted centroid can point at one place while the room/floor authority points somewhere else [@estimator] [@admin-session].

The current admin-maintenance workflow is outside this repository, but the transcript records the intended behavior: create a new beacon by choosing a point inside a room, require a unique three-digit BLE id, list beacons by id and mapped room, allow editing the id and mapped room, and recompute the containing room when a beacon marker is dragged [@admin-session]. Because the `beacons` table policy allows authenticated writes only for users passing `private.is_admin()`, browser verification of admin edits must be done with an admin Supabase session rather than inferred from local TypeScript checks [@admin-policy] [@admin-session].

## Live Table Split

There are two identified location storage models in the repository, plus a separate anonymous crowd-sample path. Current friend live sharing uses the `locations` table only when `friend_location_enabled` is true: `updateLocationFix` can upsert one row per user with `floor`, `x`, `y`, `radius`, beacon details, and `updated_at`, and friend lookups read other users from the same table [@location-service] [@user-preferences]. When `anonymous_analytics_enabled` is true, the same location fix can insert `anonymous_crowd_samples` with room, floor, and observed time instead of identified coordinates [@location-service]. Older history-oriented methods still write or read `user_locations`, including `uploadLocation`, `getLocationHistory`, `getUsersInRoom`, and cleanup helpers [@location-service].

The committed migration creates `user_locations`, indexes it by user, timestamp, room, and beacon, enables row level security, and defines a `latest_user_locations` view [@location-migration]. The documentation also describes `user_locations` as the BLE database schema [@ble-doc]. Future work should treat code as the source of current live behavior: map sharing depends on `locations`, while the migration and older methods document a separate or unfinished history table. The exact Supabase table contracts are collected in [map, social, and location tables](../../reference/supabase/map-social-and-location-tables).

## Why This Matters

The beacon concept explains why OtaMaps location differs from ordinary GPS. Beacons give indoor coordinates, floor, room signal, contributing-beacon diagnostics, and confidence radius that can be rendered on the campus map, while the shared runtime, background workers, and permission flows exist to keep that estimate fresh [@runtime] [@background-task] [@estimator]. The [background BLE via Notifee](../../decisions/mobile/background-ble-via-notifee) decision records why Android uses a foreground service for this work, [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences) explains which writes the estimate may produce, and [live location overlays](../../architecture/location/live-location-overlays) explains how identified live rows become visible in the map UI.
