---
title: "GeoJSON Debug Import"
summary: "Use the GeoJSON debug import route to cache and inspect an imported GeoJSON document without treating it as the active map source."
topics: [guides, map, storage]
sources:
  - id: geojson-utils
    type: file
    path: components/functions/geoJson.ts
  - id: geojson-route
    type: file
    path: app/(app)/debug/geoJsonImport.tsx
  - id: static-map
    type: file
    path: assets/geos/map.ts
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
---

# GeoJSON Debug Import

Use the GeoJSON debug import route when you need to manually pick a GeoJSON file, parse it, cache it in AsyncStorage, and inspect the cached JSON from inside the app. This route is a debug utility, not the active campus map data path: the map tab currently renders Supabase-backed rooms and features, while its old cached-GeoJSON loading block is commented out [@map-screen]. The expected outcome is a cached document under `@findoors:geojson` that can be printed on the debug screen for inspection [@geojson-utils] [@geojson-route].

## Before You Start

The picker only accepts `application/geo+json` documents through Expo Document Picker [@geojson-utils]. Use this guide for local or device debugging of a GeoJSON file, not for changing production room polygons or feature extrusions. The active rendering path is covered by [geospatial rendering](../../architecture/map/geospatial-rendering), and the active data flow is covered by [room and feature data](../../architecture/map/room-feature-data).

Also note the static file at `assets/geos/map.ts`. It exports a `FeatureCollection`, but the active map screen does not import that file in its render path [@static-map] [@map-screen]. Treat it as repository evidence of earlier or sample geometry, not as the current map source.

## Import A GeoJSON Document

Open the debug route at `app/(app)/debug/geoJsonImport.tsx` through the app's debug navigation or direct Expo Router path if the route is reachable in your local build [@geojson-route]. Tap `Import GeoJSON`; the route calls `geoJsonPicker()`, which opens the document picker and returns the first picked asset URI when the picker is not canceled [@geojson-utils] [@geojson-route].

After a URI is returned, the route calls `loadGeoJSON(uri)`. That helper dynamically imports `expo-file-system`, reads the selected file as text, and parses it with `JSON.parse` [@geojson-utils]. The parsed object is then passed to `cacheGeoJSON`, which writes the serialized document to AsyncStorage under `@findoors:geojson` [@geojson-utils] [@geojson-route].

## Inspect The Cached Document

Tap `t(See Cached GeoJSON)` to load the cached value back from AsyncStorage [@geojson-route]. The route calls `getCachedGeoJSON()`, which reads `@findoors:geojson` and parses it if present [@geojson-utils]. When a value exists, the route renders `JSON.stringify(parsedGeoJSON)` in a scroll view [@geojson-route].

This inspection path confirms only that the debug cache can store and read the chosen document. It does not prove that the map screen will render the document, because the active map screen derives `roomsGeoJSON` and `featuresGeoJSON` from Supabase room and feature stores instead [@map-screen].

## Verify The Active Map Separately

After importing debug GeoJSON, verify any real map behavior through the active room and feature pipeline. On the map tab, rooms are fetched from `useRoomStore`, features are fetched from `useFeatureStore`, both are filtered by `selectedFloor`, and the resulting data becomes Mapbox `ShapeSource` layers [@map-screen]. If the imported GeoJSON does not appear on the map, that is expected unless you also change the active map screen to read from the cached debug document.

Use [debug and disabled routes](../../reference/routes/debug-and-disabled-routes) for route reachability once that reference page exists. For data checks, inspect the active Supabase room and feature stores rather than the debug GeoJSON cache, because the map screen renders `roomsGeoJSON` and `featuresGeoJSON` from those stores [@map-screen].

## Recovery Notes

If import fails, check that the selected document has the `application/geo+json` MIME type accepted by the picker and contains valid JSON; parsing errors come directly from `JSON.parse` in `loadGeoJSON` [@geojson-utils]. If cached inspection shows `null`, rerun the import path because `getCachedGeoJSON()` returns `null` when the AsyncStorage key is absent [@geojson-utils]. If the cached document exists but the active map is unchanged, inspect Supabase `rooms` and `features` instead of the debug cache, because the live render path uses those stores [@map-screen].
