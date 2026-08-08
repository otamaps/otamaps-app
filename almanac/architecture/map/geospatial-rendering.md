---
title: "Geospatial Rendering"
summary: "Geospatial rendering turns cached Supabase rooms, features, and locations into Mapbox sources and layers filtered by the selected indoor floor."
topics: [architecture, map, location]
sources:
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
  - id: map-bottom-sheet
    type: file
    path: components/mapBottomSheet.tsx
  - id: room-modal
    type: file
    path: components/sheets/roomModalSheet.tsx
  - id: stairs-icon
    type: file
    path: assets/icons/stairs.png
---

# Geospatial Rendering

Geospatial rendering in OtaMaps is owned by the map tab screen. It takes rooms, structural features, friend locations, and local BLE location state, filters the geospatial data to the selected numeric floor, and feeds Mapbox `ShapeSource` layers inside a single `MapView` [@map-screen]. The renderer depends on the [campus map model](../../concepts/map/campus-map-model): rooms are selectable polygons, features are structural geometry, and coordinates are active Mapbox coordinates in `[longitude, latitude]` order [@map-screen].

## Map Container And Camera

The map screen renders an `@rnmapbox/maps` `MapView` with dark and light MapTiler style URLs, bounded camera movement around the Otaniemi campus area, zoom limits from `14` to `21`, heading `180`, and pitch `5` [@map-screen]. Camera state is stored in `cameraConfig`, initially centered at `[24.818510511790645, 60.18394233125424]`, and room selection updates that state when the selected room has geometry [@map-screen].

Room camera focus computes a centroid by averaging the first coordinate ring in `room.geometry.coordinates[0]` [@map-screen]. This is a practical fit for simple polygons, but it is also a constraint: the code imports both `Polygon` and `MultiPolygon`, yet the centroid calculation assumes the first ring shape. Future support for complex MultiPolygons should replace that centroid logic rather than only changing the type.

## Room Layers

Rooms render through a `roomsSource` `ShapeSource` only when the selected floor has room geometries [@map-screen]. The room source contains one feature per filtered room, with properties for id, room number, title, selection state, fill color, WC status, and precomputed unselected RGBA fill [@map-screen]. Three layers draw the room source: room numbers at high zoom, room titles at high zoom, and a fill layer that highlights the selected room, colors WC rooms, and otherwise uses the precomputed fill [@map-screen].

Room press handling reads the pressed feature id from the Mapbox event and calls the shared room-press flow [@map-screen]. That flow may switch the selected floor, set selection state, collapse the main map bottom sheet, open the room modal, and focus the camera [@map-screen]. The modal itself loads the selected room from `useRoomStore`, presents the cached room when found, and falls back to fetching rooms before showing an error [@room-modal].

## WC Symbols And Structural Features

WC rooms have a second derived source. The map screen classifies a room title or number containing `wc` as `wc`, `men`, or `women`, then renders a symbol layer with `WC`, male, or female text depending on the derived `wcType` [@map-screen]. This means WC labels are a rendering convention derived from room names, not a separate normalized field.

Structural map features render through `featuresSource`. Before rendering, the map screen filters features to the selected floor and discards records with missing geometry, missing type, missing coordinates, or non-array coordinates [@map-screen]. A `FillExtrusionLayer` uses feature `type` to color walls differently and uses the derived `height` property for extrusion height [@map-screen]. The stairs layer filters the same source to `type === "stairs"` and uses the registered `stairsIcon` image loaded from `assets/icons/stairs.png` [@map-screen] [@stairs-icon].

## Location Overlays

Friend and local user locations are rendered as point GeoJSON overlays on top of the room and feature layers. Friend locations come from Supabase `locations`, are combined with friend records as `[x, y]`, filtered to the selected floor, grouped by rounded coordinate key, and spread in a small circle when multiple friends share the same coordinate [@map-screen]. The friend source enables Mapbox clustering and draws clustered circles, cluster counts, individual circles, and initial labels [@map-screen].

Local user location is built from BLE scanner state. The renderer emits an empty feature collection unless the location has coordinates, a truthy floor, and a floor matching `selectedFloor`; when present, it draws an accuracy circle and a blue user dot [@map-screen]. Because that guard treats floor `0` as absent, rendering floor-zero user locations requires a code change to test for `null` or `undefined` rather than truthiness [@map-screen].

## UI Coupling

The rendering layer is tightly coupled to the map screen's bottom sheets. `MapBottomSheet` exposes imperative `snapToMax`, `snapToMid`, and `snapToMin` methods with fixed min, mid, and max snap heights, and the map screen collapses it before opening room or friend detail sheets [@map-bottom-sheet] [@map-screen]. Search focus also collapses the bottom sheet, while search blur returns it to the mid snap point [@map-screen].

The result is one map-centered interaction model: [room search](../search/room-search-flow), room-list taps, and direct polygon taps all converge on the same selected room state and modal opening behavior [@map-screen]. [Room and feature data](room-feature-data) explains the store and cache path that feeds the renderer, and [GeoJSON debug import](../../guides/map/geojson-debug-import) explains the older debug cache path that is separate from the active rendering source.
