---
title: "Background BLE Via Notifee"
summary: "OtaMaps registers Notifee foreground-service handling before the app layout and uses it as the Android host for the shared BLE tracking runtime."
topics: [decisions, mobile, location, ble]
sources:
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: runtime
    type: file
    path: lib/bleTrackingRuntime.ts
  - id: background-task
    type: file
    path: lib/bleBackgroundTask.ts
  - id: background-manager
    type: file
    path: lib/bleBackgroundManager.ts
  - id: notifee-plugin
    type: file
    path: plugins/withNotifeeAndroid.js
  - id: app-config
    type: file
    path: app.json
  - id: package
    type: file
    path: package.json
  - id: sdk57-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/08/rollout-2026-08-08T17-37-34-019fe1ce-cd4f-7ee1-b1a8-46157360f6f8.jsonl
---

# Background BLE Via Notifee

OtaMaps has decided to host Android background BLE in a Notifee foreground service while keeping scan lifecycle, beacon selection, diagnostics, consent, and upload retry in one shared tracking runtime [@background-task] [@runtime]. iOS uses the same runtime with Core Bluetooth state restoration instead of Notifee [@runtime] [@background-task]. The root layout imports `lib/bleBackgroundTask` before providers, routing, and other app shell work so Android foreground-service registration and iOS restoration setup happen before user code can display foreground-service notifications or miss a background relaunch [@root-layout] [@background-task]. Future changes to [BLE background location](../../architecture/location/ble-background-location) must preserve that early registration contract unless they replace the underlying background mechanism.

## Status

This decision is active. `app/_layout.tsx` still has the background task as its first import, with a comment stating that `notifee.registerForegroundService()` must run before any notification with `asForegroundService: true` is displayed [@root-layout]. The background task file also states that it must be imported before the app renders so Notifee can register its foreground-service runner and iOS can restore an opted-in Core Bluetooth central early [@background-task].

## Context

The app needs to keep [BLE beacon](../../concepts/location/ble-beacons-and-location) scanning alive after sign-in and when the app is not actively foregrounded. Android requires a foreground-service notification for long-running background BLE work, and the repository uses a custom Expo config plugin to declare Notifee's foreground-service entry in the Android manifest [@notifee-plugin]. Android 14 also enforces foreground-service types, so the manifest plugin declares Notifee's foreground service with `connectedDevice`, keeps it alive with `stopWithTask="false"`, and adds foreground-service, connected-device foreground-service, Bluetooth scan, and background-location permissions [@notifee-plugin].

iOS has a different constraint. The runtime creates a restoration-capable `BleManager` with `restoreStateIdentifier: "otamaps-ble-central-v1"` because iOS can relaunch the app in the background for a BLE event and invoke the restoration callback during launch [@runtime]. That means a late or component-scoped initialization would not express the same contract.

## Decision

OtaMaps registers the background BLE task as an app-shell side effect, not as a screen-level feature. Android registers a Notifee foreground-service handler at module scope, and that handler starts `startTrackingRuntime("android-background")` instead of owning a separate scanner [@background-task] [@runtime]. The foreground-service notification is still Android-specific, but the selected beacon, pending upload, and diagnostics state are owned by the shared runtime [@background-manager] [@runtime]. iOS creates a restoration-capable BLE manager through the same runtime and starts `ios-background` mode through the manager API [@runtime] [@background-manager].

The root layout owns lifecycle wiring. On launch and app-state changes, it checks the current Supabase session and saved background consent before choosing background service tracking or foreground-only tracking; on auth changes, it resynchronizes after sign-in and stops BLE tracking for sign-out [@root-layout]. Settings and permission flows should use the manager APIs described in the [location, notification, and BLE permissions](../../guides/permissions/location-notification-and-ble) guide rather than calling Notifee or BLE manager internals directly.

## Consequences

The first-import rule is a real invariant. Moving the `bleBackgroundTask` import below ordinary layout imports can make Android foreground-service registration late and can undermine iOS restoration timing [@root-layout] [@background-task]. Any refactor that changes root-layout imports should check this file before rearranging imports.

Background BLE depends on explicit consent as well as native permissions. The manager refuses to start when `getBackgroundTrackingConsent()` is false, `setBLEBackgroundEnabled(true)` requests the platform-specific tracking permissions before writing consent, and stop or sign-out paths clear that consent [@background-manager]. The settings UI must therefore treat the switch as a consent and service control, not as a passive cached preference.

The platform split remains native-hosting and scan-filtering, not duplicate business logic. Android starts a Notifee connected-device foreground service and scans without a service UUID filter, while iOS uses Core Bluetooth restoration and a UUID-filtered scan; both paths use the same selection and two-minute heartbeat upload logic from the runtime [@background-manager] [@runtime]. `app.json` and the custom Notifee plugin must stay aligned with that behavior, because the app config carries iOS central background BLE settings and Android location, Bluetooth, foreground-service, and connected-device permissions [@app-config] [@notifee-plugin].

The August 2026 SDK 57 upgrade removed `expo-background-fetch`, and the follow-up diagnosis rejected `expo-background-task` as a replacement for continuous BLE scanning because it is a system-scheduled background-job API rather than a foreground-service or Core Bluetooth host [@sdk57-session]. The current package graph still includes `expo-task-manager`, but it does not include `expo-background-fetch` or `expo-background-task` [@package]. Add an Expo background task only for a separate periodic sync job; do not route the BLE scanner runtime through it without revisiting this decision.
