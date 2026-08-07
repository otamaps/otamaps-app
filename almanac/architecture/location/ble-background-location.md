---
title: "BLE Background Location"
summary: "BLE background location keeps OtaMaps beacon scanning and live location uploads running through one process-wide tracking runtime used by foreground hooks, Android foreground service work, iOS restoration, settings, and diagnostics."
topics: [architecture, location, ble, mobile]
sources:
  - id: scanner
    type: file
    path: components/functions/bleScanner.tsx
  - id: runtime
    type: file
    path: lib/bleTrackingRuntime.ts
  - id: core
    type: file
    path: lib/bleTrackingCore.ts
  - id: types
    type: file
    path: lib/bleTrackingTypes.ts
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: estimator
    type: file
    path: lib/blePositionEstimator.ts
  - id: catalog-cache
    type: file
    path: lib/bleBeaconCatalog.ts
  - id: permissions
    type: file
    path: lib/blePermissions.ts
  - id: background-task
    type: file
    path: lib/bleBackgroundTask.ts
  - id: background-manager
    type: file
    path: lib/bleBackgroundManager.ts
  - id: notifee-plugin
    type: file
    path: plugins/withNotifeeAndroid.js
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: debug-screen
    type: file
    path: app/(app)/debug/ble.tsx
  - id: app-config
    type: file
    path: app.json
---

# BLE Background Location

BLE background location is the runtime path that keeps OtaMaps' [BLE beacon](../../concepts/location/ble-beacons-and-location) estimate fresh while the app is foregrounded, running an Android foreground service, or restored by iOS Core Bluetooth. The active design has one process-wide tracking runtime in `lib/bleTrackingRuntime.ts`; foreground React code observes it through `useBLEScanner`, Android and iOS background entrypoints start it with platform-specific modes, and uploads go through `BLELocationService.updateLocationFix` [@runtime] [@scanner] [@background-task] [@location-service]. This shape matters because changing a screen hook must not create a second `BleManager`, and changing background behavior must preserve Android foreground-service and iOS restoration constraints.

## Entrypoints

The foreground map-facing hook is now read-only. `useBLEScanner` subscribes to the shared tracking snapshot, exposes current room, diagnostics, fresh beacon observations, and a force-upload action, and its comment states that mounting or unmounting the hook never creates or destroys a `BleManager` [@scanner]. Foreground scanning is started by root-layout lifecycle code with `startForegroundTracking`, not by the hook itself [@root-layout] [@runtime].

Background scanning starts through `startBLEBackgroundService`. The root layout imports `lib/bleBackgroundTask` as its first import, then checks Supabase session state and the saved consent flag; signed-in users with background tracking enabled get the background service, while signed-in users without background consent get foreground tracking only while the app is active [@root-layout] [@background-manager]. Auth events follow the same boundary: sign-in resynchronizes tracking and sign-out stops BLE tracking for sign-out, clears pending background work, and clears background consent [@root-layout] [@background-manager].

## Android Flow

Android background BLE uses Notifee only to host a foreground-service runner. `bleBackgroundTask` registers one Notifee foreground service at module load time; the runner calls `startTrackingRuntime("android-background")` and keeps the service alive when Bluetooth is temporarily off so the runtime's Bluetooth state subscription can resume scanning later [@background-task] [@runtime]. The manager starts Android background tracking only from an active app state, because the code records that modern Android forbids ordinary foreground-service launches while the app is already backgrounded [@background-manager].

The Android notification is a low-importance persistent Notifee notification with `asForegroundService: true` and the connected-device foreground-service type [@background-manager]. The custom Expo config plugin declares Notifee's `app.notifee.core.ForegroundService` with `android:foregroundServiceType="connectedDevice"` and `android:stopWithTask="false"`, adds foreground-service, connected-device foreground-service, Bluetooth scan, and max-SDK-30 background-location manifest permissions, and caps legacy Bluetooth permissions at SDK 30 [@notifee-plugin]. `app.json` also declares foreground service, connected-device foreground service, Bluetooth, and location permissions [@app-config].

Android permission checks are API-specific. `hasBleTrackingPermissions(true)` requires fine location, Android 12+ scan/connect permissions, and background location only on Android 10 and 11; Android 12+ relies on Nearby Devices permissions instead of background location for this check [@permissions]. `requestBleTrackingPermissions(true)` can run only while the app is active, requests foreground Bluetooth/location permissions first, and asks Expo Location for background permission only on Android API 29 and 30 [@permissions].

## iOS Flow

iOS background BLE uses Core Bluetooth state restoration rather than a Notifee foreground service. The shared runtime creates an iOS `BleManager` with `restoreStateIdentifier: "otamaps-ble-central-v1"` and resumes iOS background tracking from the restore callback only when the user has consented and a Supabase session exists [@runtime]. `bleBackgroundTask` calls `initializeIOSStateRestoration()` at module load time on iOS so that restoration-capable manager can exist early enough for a background relaunch [@background-task].

The scan filter is platform-specific inside the runtime. iOS scans with the OtaMaps service UUID, while Android passes `null` for service UUIDs and applies OtaMaps advertisement parsing in JavaScript [@runtime]. The Expo BLE plugin is configured with `isBackgroundEnabled: true` and only the `central` background mode, matching the runtime's Core Bluetooth central role [@app-config].

## Selection, Upload, And Retry

Beacon parsing and selection are deterministic and isolated from React. `parseBeaconAdvertisement` accepts advertisements that carry the OtaMaps service UUID or service data, rejects missing or weak RSSI values below `BLE_RSSI_THRESHOLD`, decodes beacon ids from service data or manufacturer data, and rejects empty, `none`, overlong, or control-character payloads [@core] [@types]. `BeaconSelectionEngine` prunes observations after `BLE_BEACON_STALE_MS`, switches immediately when a new beacon is at least 6 dB stronger, and otherwise requires three consecutive readings before switching to a weaker-margin candidate [@core] [@types].

The runtime now separates local estimate cadence from upload cadence. Every five-second runtime tick prunes stale observations, reselects the anchor, builds a `LocationFix`, estimates local coordinates from the currently cached catalog, and updates the snapshot before deciding whether to upload [@runtime] [@location-service] [@estimator]. Uploads happen on the first valid fix, selected-beacon change, after the two-minute `BLE_HEARTBEAT_MS` interval, or when the estimated coordinate has moved at least eight metres and at least 30 seconds have passed since the last successful upload [@core] [@types] [@runtime].

`BLELocationService.updateLocationFix` refreshes a near-expiry Supabase session before upload, resolves all observed beacon ids through a shared `BeaconCatalogCache`, estimates position from the selected anchor and neighboring observations, and upserts the live `locations` row on `user_id` with blended `x` and `y` coordinates, anchor-derived floor, radius, and contributing beacon metadata [@location-service] [@catalog-cache] [@estimator]. The older `uploadLocation`, history, room, and cleanup helpers still target `user_locations` and related views, but the active tracking runtime uses `updateLocationFix` and the `locations` table [@location-service].

Offline and failed uploads are latest-only. The runtime stores one pending fix under `ble_pending_location_fix_v1`, coalesces queued and pending fixes by `observedAt`, retries after connectivity returns or a short failure backoff expires, and records sanitized diagnostics such as last upload attempt, last success, pending upload state, and last error [@runtime]. The BLE diagnostics route reads the same runtime snapshot and permission snapshot, so debug screens show the actual runtime state instead of creating their own scanner [@debug-screen] [@scanner].

## Consent And Storage Boundaries

Background tracking consent is explicit and versioned. `BLE_BACKGROUND_CONSENT_KEY` is `ble_background_consent_v1`; `getBackgroundTrackingConsent()` hydrates it, `setBackgroundTrackingConsent()` writes `"true"` or `"false"`, and `startTrackingRuntime` blocks background modes with `consent_required` when it is absent or false [@runtime]. Settings initialize their background switch to false before reading `isBLEBackgroundEnabled()`, and the manager clears consent when background tracking is stopped or the user signs out [@background-manager].

The runtime also persists `ble_tracking_snapshot_v1` for diagnostics and latest displayed state, while the location service persists the beacon catalog under `ble_beacon_catalog_v2` with a one-day timestamp [@runtime] [@location-service]. `BeaconCatalogCache` is single-flight for full refreshes and missing-id fetches, so multiple runtime callers can share one catalog refresh instead of issuing duplicate Supabase reads [@catalog-cache]. The exact cache keys are cataloged in [client caches](../../reference/storage/client-caches).

## Operational Constraints

The file-level comment in `bleBackgroundTask` says it must be the first import in `app/_layout.tsx`, and the root layout follows that rule [@background-task] [@root-layout]. Moving that import below components that can display foreground-service notifications risks Notifee registration happening too late. This constraint is recorded as the [background BLE via Notifee](../../decisions/mobile/background-ble-via-notifee) decision.

Future BLE work should preserve the single-runtime invariant. Foreground UI, Android background work, iOS restoration, upload retry, and diagnostics all depend on the same snapshot and `BleManager` ownership [@runtime] [@scanner] [@background-task]. Creating a second long-lived scanner in a screen or restoring the older per-hook scanner design would split beacon selection, upload cadence, and consent state across competing owners.
