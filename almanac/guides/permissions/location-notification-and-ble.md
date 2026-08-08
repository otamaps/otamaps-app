---
title: "Location, Notification, And BLE Permissions"
summary: "Use this guide when checking or changing the OtaMaps permission flow for notifications, foreground location, Android BLE permissions, Android background-location compatibility, iOS Core Bluetooth, and background BLE consent."
topics: [guides, permissions, onboarding, privacy, location, ble, mobile]
sources:
  - id: onboarding-permissions
    type: file
    path: app/welcome/(post)/permissions.tsx
  - id: settings
    type: file
    path: app/(app)/me/settings.tsx
  - id: scanner
    type: file
    path: components/functions/bleScanner.tsx
  - id: runtime
    type: file
    path: lib/bleTrackingRuntime.ts
  - id: permissions
    type: file
    path: lib/blePermissions.ts
  - id: background-manager
    type: file
    path: lib/bleBackgroundManager.ts
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: app-config
    type: file
    path: app.json
  - id: notifee-plugin
    type: file
    path: plugins/withNotifeeAndroid.js
---

# Location, Notification, And BLE Permissions

Use this guide when you need to verify or change the OtaMaps permission path for [BLE background location](../../architecture/location/ble-background-location). A successful change keeps four surfaces aligned: onboarding can request background tracking through the manager, settings can turn explicit consent on or off, `lib/userPreferences.ts` owns persisted privacy choices, `lib/blePermissions.ts` owns API-specific permission checks, and app configuration declares the native permissions and background modes needed by Android and iOS [@onboarding-permissions] [@settings] [@user-preferences] [@permissions] [@app-config]. The [background BLE via Notifee](../../decisions/mobile/background-ble-via-notifee) decision explains why Android notification and foreground-service configuration belongs to location behavior, and [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences) explains the Supabase preference row behind these controls.

## Know The Permission Surfaces

The shared runtime blocks background modes unless `ble_background_consent_v1` is true, a Supabase session exists, and `hasBleTrackingPermissions(true)` succeeds [@runtime] [@permissions]. Root-layout startup also requires at least one tracking purpose from `getTrackingConsentChoices()`: friend location or anonymous analytics must be enabled before foreground or background BLE tracking starts for an authenticated user [@user-preferences]. `setBLEBackgroundEnabled(true)` is the normal user-facing path: it requests tracking permissions, writes consent, and starts the platform background service; failure clears consent except for the `bluetooth_off` case, where the service may resume when Bluetooth returns [@background-manager].

Android permission checks are version-specific. Foreground tracking needs fine location, and Android 12+ also needs `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`; background tracking adds `ACCESS_BACKGROUND_LOCATION` only for Android 10 and 11 because Android 12+ uses Nearby Devices for this check [@permissions]. `requestBleTrackingPermissions` refuses to request permissions while the app is not active, so any UI that starts background tracking must run from a visible screen [@permissions].

iOS does not request BLE permission through the guide flow. The permission helper returns success for iOS because Core Bluetooth presents its own system prompt when the manager is first used, and the code notes that GPS background permission is not a BLE prerequisite [@permissions]. iOS capability is instead expressed through `app.json`, where `react-native-ble-plx` has background support and the `central` mode enabled with Bluetooth permission copy [@app-config].

## When Changing Onboarding

Onboarding's background-tracking item calls `setBLEBackgroundEnabled(true)` through the manager rather than duplicating Android permission logic [@onboarding-permissions] [@background-manager]. Keep that boundary: the manager knows about consent, platform branches, Notifee startup, iOS runtime startup, and rollback behavior [@background-manager].

If you add a new BLE-dependent prompt, keep it near the background-tracking step and use the manager or `blePermissions` helpers rather than direct permission calls from the screen [@onboarding-permissions] [@permissions]. On Android, do not remove fine location from the request group unless the BLE permission helper is changed too; on Android API 29 and 30, do not remove background-location handling unless background BLE discovery is intentionally dropped for those releases [@permissions].

## When Changing Settings

Use `setBLEBackgroundEnabled` for the settings switch. The current settings screen initializes the background switch to false, reads `isBLEBackgroundEnabled()` on mount, and calls `setBLEBackgroundEnabled(value)` on change [@settings]. If start fails, it keeps the switch enabled only for `bluetooth_off` and otherwise shows a recovery alert that points the user to system settings [@settings].

Do not bypass the manager by directly displaying or canceling Notifee notifications from settings. The manager persists consent, starts iOS tracking, displays the Android connected-device foreground-service notification, stops the Android runner, cancels the persistent notification, and clears runtime state on stop/sign-out [@background-manager]. Calling the manager keeps settings aligned with root-layout auto-start behavior and the runtime's single-owner scanner invariant [@runtime] [@scanner].

## Check App Configuration

Android permission declarations live in two places. `app.json` declares coarse and fine location, background location, legacy Bluetooth, Android 12 Bluetooth scan/connect, foreground service, and connected-device foreground-service permissions [@app-config]. The custom Notifee config plugin injects the Notifee foreground-service declaration with `connectedDevice`, `stopWithTask="false"`, required foreground-service permissions, Bluetooth scan, max-SDK-30 background location, and max-SDK-30 caps for legacy Bluetooth permissions [@notifee-plugin].

iOS permission copy and BLE background settings live in `app.json`. The Info.plist strings explain when-in-use location, always-and-when-in-use location, and Bluetooth always usage, and the `react-native-ble-plx` plugin is configured with background support and the `central` mode [@app-config]. Keep that central-only shape aligned with the runtime's iOS `BleManager` restoration path [@runtime] [@app-config].

## Verify A Permission Change

After a permission-flow change, review all four code paths together. Onboarding should still request background tracking through the manager [@onboarding-permissions]. Settings should still reflect persisted consent and recover start failures through the manager result [@settings] [@background-manager]. `blePermissions` should still match the Android API-level behavior you intend [@permissions]. App configuration should still include the native Android and iOS declarations required by the scanner and background service [@app-config] [@notifee-plugin].

For behavioral testing, check the active [BLE beacon](../../concepts/location/ble-beacons-and-location) path rather than only the UI. Android should be able to start the persistent connected-device foreground-service notification from an active app state, and iOS should rely on the BLE plugin background mode plus runtime restoration rather than an Android-style service [@background-manager] [@runtime] [@app-config].
