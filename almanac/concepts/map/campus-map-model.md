---
title: "Campus Map Model"
summary: "The campus map model is the shared room, feature, floor, coordinate, and search vocabulary used by the OtaMaps indoor map."
topics: [concepts, map, search, supabase]
sources:
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
  - id: room-service
    type: file
    path: lib/roomService.ts
  - id: global-search
    type: file
    path: components/globalSearch.tsx
  - id: id-translation
    type: file
    path: lib/idTranslation.ts
  - id: geojson-utils
    type: file
    path: components/functions/geoJson.ts
---

# Campus Map Model

The campus map model is the set of records and conventions that let OtaMaps present an indoor campus as searchable rooms, rendered polygons, structural features, floor-specific overlays, and live location points. Rooms and features are fetched from Supabase through the shared room store, then the map screen filters them by numeric floor and converts their geometries into Mapbox GeoJSON sources [@room-service] [@map-screen]. Search hits use the same room identifiers and floor values, so selecting a hit can switch floors, select a room, open the room sheet, and focus the camera [@global-search] [@map-screen].

## Rooms

A room is the user-facing indoor destination. The `Room` type includes identity, display text, seats, room number, status, floor, and optional geometry, so the same record can appear in the room list, room modal, search result, and map polygon [@room-service]. The map screen derives a lighter `RoomItemData` shape for the bottom sheet, using `title || room_number` as the visible name, `seats` as capacity, `status !== "occupied"` as availability, and the database `floor` field as a number [@map-screen].

Room geometry is optional. The rendering path first filters rooms with geometry, then filters those rooms to `room.floor === selectedFloor` before building polygon features [@map-screen]. This means a room can still appear in room data and modal flows without being drawn as a polygon, but map selection and camera focusing depend on a geometry record being present.

## Features

A feature is non-room map geometry such as a wall or stairs. The `Feature` type has an `id`, nullable `geometry`, numeric `floor`, `type`, and free-form `properties` object [@room-service]. The map screen filters features by numeric floor, rejects missing or malformed geometries, and emits Mapbox features with a derived `height` property: walls use height `5`, while other feature types use height `2` [@map-screen].

The distinction between rooms and features matters because rooms are selectable destinations, while features form the indoor structure around those destinations. [Geospatial rendering](../../architecture/map/geospatial-rendering) uses room polygons for labels, fill, WC symbols, and selection state, while it uses features for extrusion and stairs icons [@map-screen].

## Floors

Floors are numeric throughout the active map flow. The map screen initializes `selectedFloor` to `1`, room and feature filtering compares numeric `floor` fields directly, and the search component exposes floor buttons for `4`, `3`, `2`, `1`, and `0` [@map-screen] [@global-search]. The bottom-sheet room list also filters by the numeric selected floor before rendering rooms [@map-screen].

Floor `0` is part of the same numeric floor model as the upper floors. The local user location GeoJSON guard checks `localUserLocation.floor == null`, so floor `0` remains renderable while absent floor values are still rejected [@map-screen]. Future live-location changes should preserve numeric floor comparisons instead of converting floor state to a truthy/falsy test.

## Coordinates

Active map coordinates are `[longitude, latitude]`. The map screen stores camera centers in that order, combines Supabase location `x` and `y` as `[x, y]`, and comments that `x` is longitude and `y` is latitude when building friend locations [@map-screen]. The debug location display prints the same array as latitude first and longitude second by reading `coordinates[1]` and `coordinates[0]` [@map-screen].

There is conflicting documentation in `idTranslation.ts`: `getLocationFromBeaconID` says it returns `[latitude, longitude]`, but the function returns `[beacon?.x, beacon?.y]` from Supabase beacon fields [@id-translation]. Treat the map screen as the active convention for rendered map coordinates, and check beacon callers before changing the helper comment or return order.

## Search Identity

Room search depends on Algolia hits carrying room ids and floor values that match the Supabase room records. `GlobalSearch` uses InstantSearch hits, clears the query on selection, calls `onFloorChange(item.floor)` when the result floor differs, and then calls `onRoomSelect(item.id)` [@global-search]. The map screen passes `handleRoomPress(roomId, { focusMap: true })` as that room-select callback, so the same room id drives floor switching, selection state, modal opening, and camera centering [@map-screen].

Search therefore belongs to the same model rather than a separate navigation layer. [Room search flow](../../architecture/search/room-search-flow) explains that control flow, while [room and feature data](../../architecture/map/room-feature-data) explains how the Supabase-backed records are cached before rendering.

## Debug GeoJSON Boundary

The repository still has generic GeoJSON picker/cache helpers that store imported documents under `@findoors:geojson` [@geojson-utils]. The active map screen imports those helpers only in a commented-out cache-loading block, and the visible room and feature layers are built from Supabase room and feature stores instead [@map-screen]. Use [GeoJSON debug import](../../guides/map/geojson-debug-import) to inspect that debug route without confusing it with the active map source.
