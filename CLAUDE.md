# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn start          # Start Expo dev server (scan QR or open in simulator)
yarn android        # Start with Android target
yarn ios            # Start with iOS target
yarn lint           # Run ESLint via expo lint
```

There is no automated test runner configured. The file `tests/beaconFilteringTest.ts` is a standalone script, not part of a test suite.

Building for distribution uses EAS:
```bash
eas build --profile development
eas build --profile preview
eas build --profile production
```

## Architecture Overview

OtaMaps is an Expo 55 / React Native app providing indoor positioning and navigation for a school building (Otaniemi area, Finland). The UI language is Finnish.

### Routing

File-based routing via `expo-router`. Route groups:

- `app/index.tsx` — Auth gate: shows splash, then redirects to `/map` (authenticated) or `/welcome` (unauthenticated).
- `app/(tabs)/` — Tab bar: **map** (main screen), **me** (profile), **fablab** (feature-flagged, hidden by default).
- `app/(app)/` — Stack screens pushed over tabs: friend management (`friends/`), profile editing (`me/`), debug tools (`debug/`).
- `app/welcome/` — Onboarding flow: `(pre)/` for login, `(post)/` for permissions and profile setup.

Files with the `.tsx.dis` extension (e.g. `debug.tsx.dis`, `wilma.tsx.dis`) are disabled routes excluded from the router.

### Backend: Supabase

`lib/supabase.ts` exports a singleton client pointed at the production project. Auth uses `AsyncStorage` for session persistence. Key tables:

| Table | Purpose |
|-------|---------|
| `rooms` | Room metadata + GeoJSON polygon geometry + floor number |
| `features` | Building features (walls, stairs) with GeoJSON geometry |
| `beacons` | BLE beacon registry: `ble_id`, `x`, `y`, `floor`, `room_id` |
| `locations` | One row per user (upserted on conflict `user_id`): current position `x`, `y`, `floor`, `radius`, `beacons[]` |
| `relations` | Friend graph: `subject`, `object`, `status` (`request`/`friends`/`blocked`) |
| `users_ff` | View used for friend list; combined with `locations` in `friendsHandler.ts` |
| `feature_flags` | Remote feature toggles read by `lib/featureFlagService.ts` |

### State Management

`lib/roomService.ts` exports two Zustand stores:
- `useRoomStore` — all rooms; 10-minute TTL cache backed by `AsyncStorage` (`room_cache` key).
- `useFeatureStore` — building features (walls, stairs); same TTL pattern (`features_cache` key).

Both accept a `force?: boolean` parameter to bypass cache.

### BLE Indoor Positioning

Two parallel scanning systems run simultaneously:

**Foreground hook** (`components/functions/bleScanner.tsx`):
- `useBLEScanner()` hook instantiates a singleton `BLEScannerService`.
- Scans continuously, uploads location to Supabase every 10 seconds while the app is in the foreground.
- Maintains a 30-day in-memory + AsyncStorage cache of `beaconId → roomId` mappings.

**Android background service** (`lib/bleBackgroundTask.ts` + `lib/bleBackgroundManager.ts`):
- Registered via `notifee.registerForegroundService()` — **must be imported at the top of `app/_layout.tsx`** before any notification fires.
- Started on sign-in, stopped on sign-out. Keeps scanning when the app is killed from recents.
- Uploads to Supabase every 5 minutes.

**Beacon identification** (`lib/bleLocationService.ts`):
- OtaMaps ESP32 beacons advertise service UUID `f47fcfd9-0634-49de-8e99-80d05ae8fcef` with device name `"Room"`.
- The room identifier is encoded in service data (base64 → UTF-8); manufacturer data is a fallback.
- RSSI threshold: `-80 dBm`. Beacons expire after 10 seconds without a new advertisement.
- Position is estimated from the strongest beacon's coordinates; accuracy radius is derived from distance-to-RSSI formula.

`lib/idTranslation.ts` — `getRoomIdFromBleId(bleId)` looks up `beacons.room_id` then resolves to `rooms.room_number`.

### Map Screen (`app/(tabs)/map.tsx`)

The map screen is the largest file and the primary user surface. Key patterns:

- Renders `@rnmapbox/maps` `MapView` with MapTiler tile styles (dark/light variants).
- Room polygons and building features are fetched from Supabase, converted to GeoJSON inside `useMemo` hooks, and rendered as `ShapeSource` + layer combos.
- Floor filtering: all GeoJSON is filtered by `selectedFloor` (integer) before rendering; rooms store floor as a database `integer`, not parsed from the room number string.
- Friends are fetched from `users_ff` + `locations` tables; displayed as clustered `CircleLayer` markers with spiderfy offset logic for overlapping positions.
- Bottom sheet (`@gorhom/bottom-sheet`) has three snap points (min/mid/max) and shows either a friends list or a rooms list depending on the selected tab.
- `RoomModalSheet` and `FriendModalSheet` are imperative-ref-controlled bottom sheet modals.

### Auth Flow

`lib/googleAuth.ts` handles Google Sign-In → Supabase `signInWithIdToken`. On first sign-in, `ensureUserProfile()` upserts a row into the `users` table with a generated `code` (from `components/functions/codeGen.tsx`).

`context/AuthContext.tsx` — `useAuth()` provides `{ session, loading }` within `(tabs)`.  
`context/UserContext.tsx` — `useUser()` provides `{ user, setUser }` for app-level user metadata (name, class, color).

### Search

Algolia `liteClient` is initialized in `app/_layout.tsx` with the index `rooms_rows`. The `InstantSearch` provider wraps the entire navigation tree. `components/globalSearch.tsx` consumes it.

### Feature Flags

`lib/featureFlagService.ts` reads the `feature_flags` table from Supabase and caches enabled flags in AsyncStorage (`@feature_flags`). The Fablab tab visibility is additionally controlled by `AsyncStorage` key `fablabEnabled` (set from `app/(app)/me/fablab.tsx`).

### Typography & Styling

Custom font: Figtree (Regular, Medium, SemiBold, Bold) loaded in `app/_layout.tsx`. Font names: `"Figtree-Regular"`, `"Figtree-Medium"`, etc. Constants in `constants/typography.ts`.

Dark mode is handled via `useColorScheme()` throughout; no theming library.

## Path Aliases

`@/` maps to the project root (configured in `tsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.

## Environment Variables

All runtime env vars are prefixed `EXPO_PUBLIC_`. Key variables:

- `EXPO_PUBLIC_DEBUG_BLE=true` — enables verbose BLE console logging (checked inline in scanner files).
- `EXPO_PUBLIC_MAPTILER_KEY` — MapTiler API key for map tile style URLs.
- `EXPO_PUBLIC_SUMUP_API_KEY` / `EXPO_PUBLIC_SUMUP_SECRET_KEY` / `EXPO_PUBLIC_SUMUP_MERCHANT_CODE` — SumUp payment integration for Fablab.

The Supabase URL and anon key are hardcoded in `lib/supabase.ts` (not in env vars for the production project).
