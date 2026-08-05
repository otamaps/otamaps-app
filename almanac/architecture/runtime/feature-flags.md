---
title: "Feature Flags"
summary: "Feature flags are fetched from Supabase, stored locally as enabled records, and currently gate the booking UI from room search and room detail surfaces."
topics: [architecture, runtime, feature-flags, supabase, storage]
sources:
  - id: feature-service
    type: file
    path: lib/featureFlagService.ts
  - id: find-room
    type: file
    path: components/findRoomView.tsx
  - id: room-modal
    type: file
    path: components/sheets/roomModalSheet.tsx
---

# Feature Flags

Feature flags are a Supabase-backed client runtime boundary, not a static build setting. `fetchAndStoreFeatureFlags()` reads `id`, `name`, `description`, and `enabled` from the `feature_flags` table, filters the response to enabled records, and writes those records to AsyncStorage under `@feature_flags` [@feature-service]. Callers then use `isFeatureEnabled(name)`, which reads only that local cache and returns false when the key is missing, malformed, or unreadable [@feature-service]. This means a flag can exist in Supabase but still fail closed in the UI until something has hydrated the local enabled-flag cache.

## Booking Gate

The only active flag consumer is the room booking surface. `components/findRoomView.tsx` checks `isFeatureEnabled("booking")` once on mount and shows the `Book` button only when the cached enabled flag is present [@find-room]. `components/sheets/roomModalSheet.tsx` performs the same mount-time check for the room detail bottom sheet before exposing booking UI there [@room-modal]. Neither component fetches fresh flags itself, so changes to the Supabase flag row do not automatically appear in these mounted views [@find-room] [@room-modal].

## Change Constraints

Future flag work should preserve the fail-closed behavior unless the product explicitly wants stale or missing cache to enable a feature. A new flag-gated surface can call `isFeatureEnabled`, but it should also identify the cache hydration path that calls `fetchAndStoreFeatureFlags()` before relying on the flag for visible behavior [@feature-service]. The exact AsyncStorage key is cataloged in [client caches](../../reference/storage/client-caches), and room UI changes should be read together with [room feature data](../map/room-feature-data) because the current booking gate appears inside room list/detail components.
