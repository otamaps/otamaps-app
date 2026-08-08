---
title: "Onboarding And Consent Preferences"
summary: "Onboarding and consent preferences decide whether a signed-in user reaches the app directly, which profile fields they can edit, and which BLE location writes are allowed."
topics: [architecture, onboarding, privacy, permissions, location, authentication, supabase]
sources:
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: index-route
    type: file
    path: app/index.tsx
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: onboarding-permissions
    type: file
    path: app/welcome/(post)/permissions.tsx
  - id: settings
    type: file
    path: app/(app)/me/settings.tsx
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: onboarding-migration
    type: file
    path: supabase/migrations/20260808105737_onboarding_and_consents.sql
  - id: consent-migration
    type: file
    path: supabase/migrations/20260808114122_enforce_identified_location_consent.sql
---

# Onboarding And Consent Preferences

Onboarding and consent preferences are the architecture that connects the post-login route, profile editability, privacy choices, BLE tracking startup, and Supabase write guards. Supabase Auth still decides whether a user is signed in, but `lib/userPreferences.ts` decides whether that signed-in user has completed the current onboarding version and which location purposes are enabled [@user-preferences]. This page belongs next to [session and identity](session-and-identity) because the root route, settings, onboarding screen, and BLE upload path all depend on the same per-user preference row.

## Startup Gate

The root index route no longer sends every signed-in user directly to `/home`. After the custom splash and Supabase session check, it calls `isOnboardingComplete()`; completed users go to `/home`, while incomplete users or preference-load failures go to `/welcome/(post)/permissions` [@index-route] [@user-preferences]. This makes the post-login onboarding screen part of the authenticated startup path, not only a first-run welcome route.

`CURRENT_ONBOARDING_VERSION` is `1`, and completion means the loaded `user_preferences.onboarding_version` is at least that value [@user-preferences]. `getUserPreferences({ forceRefresh: true })` reads the row from Supabase, falls back to a default in-memory object when the row is absent, and caches returned preferences under a user-specific AsyncStorage key [@user-preferences]. The exact local cache key is listed in [client caches](../../reference/storage/client-caches).

## Preference Row And Consent Events

The `user_preferences` table stores `profile_source`, onboarding version and timestamp, `friend_location_enabled`, `anonymous_analytics_enabled`, `background_tracking_enabled`, a consent policy version, and timestamps keyed by `user_id` [@onboarding-migration]. Authenticated users can read, insert, and update only their own preference row, and the allowed insert/update column grants exclude `profile_source`, so Wilma profile source stays server-managed [@onboarding-migration].

Preference changes also write an event history. `saveOnboardingChoices()` records all three consent decisions when onboarding finishes, while `updateConsentChoices()` records only changed decisions for settings updates [@user-preferences]. The migration stores those rows in `user_consent_events` with a constrained purpose vocabulary of `friend_location`, `anonymous_crowd_analytics`, and `background_tracking` [@onboarding-migration]. This creates both a current state row and an append-only consent history.

## Onboarding Screen

The post-onboarding permissions screen loads preferences and the current `users` profile row, then locks name and class editing when `profile_source` is `wilma` [@onboarding-permissions]. Saving first updates the profile fields allowed for the profile source, then writes onboarding choices through `saveOnboardingChoices()` [@onboarding-permissions] [@user-preferences].

The screen treats background tracking as subordinate to a tracking purpose. It only saves `background_tracking_enabled` when either friend location or anonymous analytics is enabled, deletes the current user's identified `locations` row when friend location is disabled, and stops all BLE tracking when no tracking purpose remains [@onboarding-permissions]. If background tracking is requested and the manager cannot start it, the screen writes `background_tracking_enabled: false` and routes to `/home` only after a saved onboarding version exists [@onboarding-permissions].

## Settings And Runtime Coupling

Settings is the repeatable control surface for the same choices. It reloads preferences from Supabase, combines the stored background preference with `isBLEBackgroundEnabled()`, and updates individual choices through `updateConsentChoices()` [@settings] [@user-preferences]. Turning off friend location deletes the user's identified `locations` row; turning off the last tracking purpose disables background preference, stops the background service, and stops foreground tracking [@settings].

The root layout uses `getTrackingConsentChoices()` before starting BLE work for an authenticated user [@root-layout] [@user-preferences]. If neither friend location nor anonymous analytics is enabled, it leaves tracking off; otherwise an active app starts either the background service or foreground tracking depending on the background consent state [@root-layout]. The [BLE background location](../location/ble-background-location) page explains the scanner and foreground-service runtime that this consent gate controls.

## Database Enforcement

The client gate is not the only boundary. A later migration adds a `user_preferences_background_requires_purpose` check so background tracking cannot be true unless friend location or anonymous analytics is also true [@consent-migration]. The same migration adds a trigger on `locations` that rejects authenticated identified-location writes unless the user's `friend_location_enabled` preference is active [@consent-migration].

`BLELocationService.updateLocationFix()` mirrors those preferences at write time. When friend location is enabled it upserts the user's identified row in `locations`; when anonymous analytics is enabled it inserts a coarse `anonymous_crowd_samples` row with room, floor, and observed time but no user id, class, exact coordinate, or beacon id [@location-service]. The table contracts are listed in [map, social, location, and consent tables](../../reference/supabase/map-social-and-location-tables), while the native permission path is in [location, notification, and BLE permissions](../../guides/permissions/location-notification-and-ble).
