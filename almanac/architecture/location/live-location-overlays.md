---
title: "Live Location Overlays"
summary: "Live location overlays convert local BLE estimates and friend location rows into floor-filtered Mapbox points, map interactions, and bottom-sheet social UI."
topics: [architecture, location, map, social, privacy]
sources:
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
  - id: scanner
    type: file
    path: components/functions/bleScanner.tsx
  - id: custom-location
    type: file
    path: components/customUserLocation.tsx
  - id: friend-item
    type: file
    path: components/friendItem.tsx
  - id: friend-blob
    type: file
    path: components/friendBlob.tsx
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: friends-handler
    type: file
    path: lib/friendsHandler.ts
---

# Live Location Overlays

Live location overlays are the map-layer and bottom-sheet behavior that make OtaMaps' indoor location social. The map tab reads local BLE estimates from `useBLEScanner`, fetches friend rows from Supabase `locations`, filters both by the selected floor, and renders point overlays on top of the same Mapbox map that draws rooms and features [@map-screen]. Identified live rows exist only when the user has enabled the friend-location purpose, so this architecture depends on the [BLE beacon](../../concepts/location/ble-beacons-and-location) estimate, the social relation model in [friends and shared location](../../concepts/social/friends-and-shared-location), [onboarding and consent preferences](../auth/onboarding-and-consent-preferences), and the base [geospatial rendering](../map/geospatial-rendering) stack [@location-service] [@user-preferences].

## Local User Overlay

The local user overlay is intentionally local-first. The map screen calls `getCurrentLocation` from the BLE scanner adapter every two seconds and stores the result as `localUserLocation` [@map-screen]. That adapter reads the shared BLE tracking runtime snapshot rather than Supabase state, so the blue dot can update more often than the live upload cadence [@scanner].

The map only renders the local user when the estimate has coordinates, has a non-null floor, and the estimate floor matches `selectedFloor` [@map-screen]. When those guards pass, the screen builds a single-point GeoJSON feature with the user's coordinates, radius, floor, current room, and beacon count [@map-screen]. The renderer draws an accuracy circle scaled by zoom and a blue user dot with a light or dark stroke [@map-screen].

`CustomUserLocation` subclasses Mapbox `UserLocation`, keeps custom coordinates in component state, subscribes to heading updates through Expo Location, and exposes `setCustomLocation(lng, lat)` [@custom-location]. The map currently mounts both a `CustomLocationProvider` with a fixed coordinate and this custom user location component, while the explicit live BLE overlay is drawn by the `localUserLocationSource` GeoJSON path [@map-screen].

## Friend Location Overlay

Friend locations use server state. The map screen polls Supabase `locations` every 30 seconds, combines each friend with the matching `locations.user_id`, and stores `[x, y]` as `[longitude, latitude]` [@map-screen]. The `friendsHandler` fetch path also combines `users_ff` rows with `locations`, uses the strongest beacon in a location row to derive a user-friendly room string, and caches friends in AsyncStorage [@friends-handler].

Rendering filters friends to those with a location whose `floor` matches the selected floor [@map-screen]. Friends with identical rounded coordinates are grouped; one friend renders at the stored point, while multiple friends at the same point are spread in a two-meter circle before rendering [@map-screen]. The Mapbox source enables clustering at lower zooms, draws gray cluster bubbles with counts, and draws individual friend circles with initials and friend colors [@map-screen].

## Interaction Coupling

Friend markers and friend list rows open the same friend modal. Pressing a friend feature reads the feature id from the Mapbox event, stores it in `friendId`, presents the modal sheet, and collapses the main map bottom sheet [@map-screen]. Pressing a friend row also centers the camera on the friend's stored coordinates, sets the selected floor from the first character of the friend status string, and opens the modal [@map-screen]. That floor derivation assumes the status string starts with a floor number; changing the status vocabulary requires changing that map-row behavior too.

The friend modal header shows the selected friend's name, user-friendly location, and formatted last-seen value [@map-screen]. `FriendItem` formats recent times in Finnish labels such as `Nyt`, minutes, hours, and days, and renders status and schedule metadata in the bottom sheet list [@friend-item]. `FriendBlob` is a small reusable circular initial marker component, but the active map overlay uses Mapbox circle and symbol layers rather than mounting `FriendBlob` instances [@friend-blob] [@map-screen].

## Storage And Reference Boundary

The active overlay table is `locations`. `BLELocationService.updateLocation` delegates to `updateLocationFix`, which writes an identified live user position row to `locations` only when `friend_location_enabled` is true [@location-service] [@user-preferences]. `getCurrentLocation` reads the current user's row from `locations`, `getFriendsLocations` reads friend ids and selects matching rows from `locations`, and realtime subscriptions watch the `locations` table [@location-service]. The map screen also performs its own `locations` fetch for friend overlays [@map-screen].

Older history APIs in the same service still reference `user_locations`, and anonymous analytics uses `anonymous_crowd_samples`, so maintainers should avoid assuming one location table covers all code paths [@location-service]. The table and view details belong in [map, social, location, and consent tables](../../reference/supabase/map-social-and-location-tables); this page records how the active overlay code consumes the identified live records.
