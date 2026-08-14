---
title: "Feature Flags"
summary: "Feature flags are fetched from Supabase, stored locally as enabled records, and currently only have a disabled-route booking UI consumer."
topics: [architecture, runtime, feature-flags, supabase, storage]
sources:
  - id: feature-service
    type: file
    path: lib/featureFlagService.ts
  - id: find-room
    type: file
    path: components/findRoomView.tsx
  - id: disabled-find-tab
    type: file
    path: app/(tabs)/find.tsx.dis
  - id: room-modal
    type: file
    path: components/sheets/roomModalSheet.tsx
---

# Feature Flags

Feature flags are a Supabase-backed client runtime boundary, not a static build setting. `fetchAndStoreFeatureFlags()` reads `id`, `name`, `description`, and `enabled` from the `feature_flags` table, filters the response to enabled records, and writes those records to AsyncStorage under `@feature_flags` [@feature-service]. Callers then use `isFeatureEnabled(name)`, which reads only that local cache and returns false when the key is missing, malformed, or unreadable [@feature-service]. This means a flag can exist in Supabase but still fail closed in the UI until something has hydrated the local enabled-flag cache.

## Booking Gate

The only current code consumer found in this repository is `components/findRoomView.tsx`, which checks `isFeatureEnabled("booking")` once on mount and shows the `Book` button only when the cached enabled flag is present [@find-room]. That component is only imported by `app/(tabs)/find.tsx.dis`, a disabled tab file, so the active Expo Router tree does not currently expose a booking flag surface [@disabled-find-tab]. The room detail bottom sheet no longer imports the feature-flag helper or gates booking UI [@room-modal].

## Change Constraints

Future flag work should preserve the fail-closed behavior unless the product explicitly wants stale or missing cache to enable a feature. A new flag-gated surface can call `isFeatureEnabled`, but it should also identify the cache hydration path that calls `fetchAndStoreFeatureFlags()` before relying on the flag for visible behavior [@feature-service]. The exact AsyncStorage key is cataloged in [client caches](../../reference/storage/client-caches), and route work should distinguish disabled-route consumers from active tabs through [debug and disabled routes](../../reference/routes/debug-and-disabled-routes).
