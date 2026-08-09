---
title: "Client Caches"
summary: "This reference catalogs the AsyncStorage and SecureStore keys used by OtaMaps client-side session, onboarding, map, BLE, social, feature-flag, FabLab, and Wilma flows."
topics: [reference, storage, authentication, onboarding, privacy, map, location, wilma]
sources:
  - id: user-handle
    type: file
    path: lib/getUserHandle.tsx
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: room-service
    type: file
    path: lib/roomService.ts
  - id: ble-scanner
    type: file
    path: components/functions/bleScanner.tsx
  - id: ble-runtime
    type: file
    path: lib/bleTrackingRuntime.ts
  - id: ble-location
    type: file
    path: lib/bleLocationService.ts
  - id: ble-catalog-cache
    type: file
    path: lib/bleBeaconCatalog.ts
  - id: feature-flags
    type: file
    path: lib/featureFlagService.ts
  - id: fablab-settings
    type: file
    path: app/(app)/me/fablab.tsx
  - id: ble-background-manager
    type: file
    path: lib/bleBackgroundManager.ts
  - id: wilma-graphql
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: wilma-login
    type: file
    path: lib/wilma/owLoginHandler.ts
  - id: wilma-requests
    type: file
    path: lib/wilma/wilmaRequestHandlers.ts
  - id: friends-handler
    type: file
    path: lib/friendsHandler.ts
---

# Client Caches

Client caches in OtaMaps are local device stores spread across AsyncStorage and SecureStore. They cover the app's custom user cache, onboarding and privacy preferences, Supabase-backed map data, BLE tracking snapshots and beacon lookups, friend list results, feature flags, FabLab tab opt-in, BLE background consent, Wilma read-through response caches, and Wilma credentials or response data [@user-handle] [@user-preferences] [@room-service] [@ble-runtime] [@ble-location] [@friends-handler] [@wilma-graphql]. This reference lists the exact keys visible in the assigned source files and links those keys back to the architecture pages that use them.

## AsyncStorage Keys

| Key | Owner | Stored Value | Lifetime Or Refresh Rule |
| --- | --- | --- | --- |
| `user` | `lib/getUserHandle.tsx` | JSON Supabase Auth user returned by `supabase.auth.getUser()` | Used for up to one hour unless `getUser({ forceRefresh: true })` is called [@user-handle]. |
| `user_cache_timestamp` | `lib/getUserHandle.tsx` | Millisecond timestamp for `user` | Removed with `user` by `clearUserCache()` [@user-handle]. |
| `user_preferences_v1:<user_id>` | `lib/userPreferences.ts` | JSON `UserPreferences` row for the signed-in user, including onboarding version, profile source, privacy choices, and consent policy version | Returned unless a caller forces refresh; rewritten after onboarding or settings updates, and removed for the current session by `clearCurrentUserPreferencesCache()` [@user-preferences]. |
| `room_cache` | `lib/roomService.ts` | JSON object `{ data, timestamp }` for Supabase `rooms` rows | Valid for ten minutes, matching the store TTL [@room-service]. |
| `features_cache` | `lib/roomService.ts` | JSON object `{ data, timestamp }` for Supabase `features` rows | Valid for ten minutes, matching the store TTL [@room-service]. |
| `ble_beacon_catalog_v2` | `lib/bleLocationService.ts` through `BeaconCatalogCache` | JSON array of beacon records with normalized string `ble_id` values, coordinates, floor, room id, and any merged room number | Valid for one day before `getBeacons()` refetches; missing beacon ids are batch-fetched with a cache-miss throttle and room-number lookups merge fresh rows into the same catalog [@ble-location] [@ble-catalog-cache]. |
| `ble_beacon_catalog_timestamp_v2` | `lib/bleLocationService.ts` | Millisecond timestamp for `ble_beacon_catalog_v2` | Removed by `clearBeaconsCache()` with the catalog [@ble-location]. |
| `ble_tracking_snapshot_v1` | `lib/bleTrackingRuntime.ts` | Last runtime snapshot, including diagnostics, current room, coordinates, floor, radius, active observations, and last update time | Hydrated on runtime startup and persisted with throttling for diagnostics and resumed display state [@ble-runtime]. |
| `ble_pending_location_fix_v1` | `lib/bleTrackingRuntime.ts` | Latest unsent `LocationFix` selected for offline or failed-upload retry | Coalesced by newest `observedAt`, removed after a successful upload, and optionally cleared on stop/sign-out [@ble-runtime]. |
| `ble_background_consent_v1` | `lib/bleTrackingRuntime.ts` | String `"true"` or `"false"` for explicit background BLE tracking consent | Written by `setBackgroundTrackingConsent`; stop and sign-out manager paths clear consent by writing false [@ble-runtime] [@ble-background-manager]. |
| `cached_friends` | `lib/friendsHandler.ts` | JSON array of friend records joined with location/status data | Returned by `getFriends()` unless a force refresh is requested; no TTL is enforced in this helper [@friends-handler]. |
| `@feature_flags` | `lib/featureFlagService.ts` | JSON array of enabled feature flag records | Replaced when `fetchAndStoreFeatureFlags()` fetches all flags from Supabase and stores only enabled ones [@feature-flags]. |
| `fablabEnabled` | `app/(app)/me/fablab.tsx` | String `"true"` or `"false"` for local FabLab tab opt-in | Read on focus and written when the FabLab settings switch changes [@fablab-settings]. |
| `wilma_read_cache_v1:<scope>:<cacheKey>` | `lib/wilma/graphqlClient.ts` | JSON `{ version: 1, storedAt, data }` envelope for cached Wilma GraphQL reads, scoped by a SHA-256 digest of API base URL and Wilma username | TTL depends on the helper: message lists are shortest at two minutes, profile/rooms/recipients and detail reads are longest at hours; `forceRefresh` bypasses cache-first behavior, auth errors do not fall back to cached data, message send/reply invalidates message keys, and `clearAll()` removes entries for the current scope [@wilma-graphql]. |
The `user` keys belong to [session and identity](../../architecture/auth/session-and-identity), and the `user_preferences_v1:<user_id>` key belongs to [onboarding and consent preferences](../../architecture/auth/onboarding-and-consent-preferences). The room and feature keys belong to [room feature data](../../architecture/map/room-feature-data), while the BLE keys belong to [BLE background location](../../architecture/location/ble-background-location). `useBLEScanner` no longer owns AsyncStorage cache keys directly; it reads the shared runtime snapshot instead [@ble-scanner] [@ble-runtime].

## SecureStore Keys

| Key | Owner | Stored Value | Clear Function |
| --- | --- | --- | --- |
| `wilma_graphql_session` | `lib/wilma/graphqlClient.ts` | Wilma GraphQL session token | `clearSession()` deletes this key, and `clearAll()` deletes it with credentials [@wilma-graphql]. |
| `wilma_graphql_credentials` | `lib/wilma/graphqlClient.ts` | JSON object `{ username, password }` for silent GraphQL reauth | `clearCredentials()` deletes this key, and `clearAll()` deletes it with the session [@wilma-graphql]. |
| `wilma_legacy_link_attempt` | `lib/wilma/authBroker.ts` | JSON `{ attemptToken, username, password }` for a Wilma-authenticated user who may link to an old OtaMaps account | Cleared after successful Wilma-Supabase exchange, successful legacy link, sign-out cleanup, malformed JSON, or failed link cleanup [@wilma-auth-broker]. |
| `wilma_token` | `lib/wilma/owLoginHandler.ts` | Token returned by the direct Otawilma login API | `clearWilmaLogin()` deletes this key with username and login time [@wilma-login]. |
| `wilma_username` | `lib/wilma/owLoginHandler.ts` | Username used for direct Otawilma login | `clearWilmaLogin()` deletes this key [@wilma-login]. |
| `wilma_login_time` | `lib/wilma/owLoginHandler.ts` | Millisecond login timestamp as a string | `clearWilmaLogin()` deletes this key [@wilma-login]. |
| `wilma_messages` | `lib/wilma/wilmaRequestHandlers.ts` | JSON response from direct Wilma inbox request | Valid for 30 minutes when paired with `wilma_messages_time` [@wilma-requests]. |
| `wilma_messages_time` | `lib/wilma/wilmaRequestHandlers.ts` | Millisecond timestamp for `wilma_messages` | `clearWilmaMessagesCache()` deletes this key with cached messages [@wilma-requests]. |

The GraphQL Wilma client uses SecureStore for both its session token and saved credentials because it can silently reauthenticate when a request fails with an auth error [@wilma-graphql]. The Wilma auth broker uses a separate pending-link key because legacy account linking must survive the transition from Wilma credentials to an old Supabase login before it can exchange the attempt token [@wilma-auth-broker]. The direct Wilma handlers use a separate token, username, login-time, and messages cache namespace [@wilma-login] [@wilma-requests]. Use [Wilma endpoints and SecureStore keys](../wilma/endpoints-and-securestore-keys) for the broader Wilma endpoint contract.

## Cache Clearing And Staleness Rules

The user cache is cleared only through `clearUserCache()`, which removes `user` and `user_cache_timestamp` [@user-handle]. Use [edit profile and sign out](../../guides/account/edit-profile-and-sign-out) for the account workflow that relies on this cache boundary.

Room and feature stores each expose a clear method that removes the matching AsyncStorage key and empties in-memory Zustand state [@room-service]. Beacon coordinate/floor data has its own `clearBeaconsCache()` function, while runtime snapshot and pending-fix cleanup are owned by tracking stop, sign-out, upload success, and consent manager paths rather than by the scanner hook [@ble-location] [@ble-runtime] [@ble-background-manager].

[Feature flags](../../architecture/runtime/feature-flags) store only enabled flags locally. `getEnabledFeatureFlags()` returns an empty array when the key is absent or parsing fails, and `isFeatureEnabled()` returns false on lookup errors [@feature-flags]. This makes missing local feature-flag cache fail closed from the caller's perspective.

Wilma GraphQL read caches are scoped to the saved Wilma credentials rather than the Supabase user id. `saveCredentials()` computes the cache scope from the API base URL and username, while `clearAll()` removes the session, credentials, and cache entries for the current scope [@wilma-graphql]. The detailed helper-level cache behavior is in [Wilma GraphQL client and reauth](../../architecture/wilma/graphql-client-and-reauth).
