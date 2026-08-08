---
title: "Room Search Flow"
summary: "Room search uses Algolia InstantSearch hits to switch floors, select a Supabase room id, open the room modal, and focus the map camera."
topics: [architecture, search, map]
sources:
  - id: app-layout
    type: file
    path: app/_layout.tsx
  - id: global-search
    type: file
    path: components/globalSearch.tsx
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
---

# Room Search Flow

Room search is a global InstantSearch context wrapped around the Expo Router app and consumed by the map screen's floating search control. The root layout creates an Algolia lite client, wraps the app in `InstantSearch`, and uses the `rooms_rows` index; `GlobalSearch` reads query and hit state from that context [@app-layout] [@global-search]. Selecting a result clears the query, optionally changes the selected floor, passes the room id back to the map screen, and lets the map screen handle room selection, modal opening, and camera focus [@global-search] [@map-screen].

## Search Context

`app/_layout.tsx` is the search provider boundary. It initializes `liteClient` from `algoliasearch/lite` with the application id and search key in source, then renders `RootLayoutNav` inside `<InstantSearch searchClient={searchClient} indexName="rooms_rows">` [@app-layout]. Because this provider wraps the router stack, the map tab can use InstantSearch hooks without owning Algolia client setup.

The root layout also owns unrelated app providers such as SumUp, user context, gesture handling, font loading, and BLE background lifecycle [@app-layout]. For search-specific changes, keep the provider/index assumptions in the root shell and the map behavior in the map screen. The broader shell is covered by [Expo Router shell](../app/expo-router-shell).

## Search Control

`GlobalSearch` uses `useSearchBox` for query refinement and `useHits` for current hits [@global-search]. It maintains local focus state and animated result visibility, and `handleSearchChange` updates the local query before calling `refine(text)` [@global-search]. The rendered search results use each hit's `objectID` as the FlatList key and show highlighted room number, title, description, and type fields when available [@global-search].

The same control also owns the floor switcher. It exposes buttons for floors `4`, `3`, `2`, `1`, and `0`, stores the selected floor locally, and calls `onFloorChange(floor)` when a floor button is pressed [@global-search]. The map screen passes its `selectedFloor` state and `setSelectedFloor` callback into the component [@map-screen].

## Result Selection

Result selection starts in `handleResultPress`. The handler clears the visible query, runs the blur path, dismisses the keyboard, and checks whether `item.floor` differs from the component's selected floor [@global-search]. When the hit has a different floor and `onFloorChange` is available, it calls `onFloorChange(item.floor)` before selecting the room [@global-search].

The preferred selection path is `props.onRoomSelect(item.id)` [@global-search]. On the map screen, that callback is `handleRoomPress(roomId, { focusMap: true })`, so the search component does not open Mapbox layers or room sheets directly [@map-screen]. If no `onRoomSelect` callback exists, `GlobalSearch` falls back to opening the provided room modal ref with the hit id [@global-search].

## Map Response

`handleRoomPress` is the convergence point for search hits, room-list taps, and room polygon presses. It finds the room in the Supabase-backed room store, switches to `room.floor` when needed, updates `selectedRoomId`, and opens the modal immediately when the room was already selected [@map-screen]. A separate effect watches `selectedRoomId`, collapses the map bottom sheet to its minimum snap point, and opens the room modal [@map-screen].

When the selected room has geometry and focus is not disabled, `handleRoomPress` calculates a centroid from `room.geometry.coordinates[0]` and updates camera center, zoom `18`, and animation duration `1000` [@map-screen]. This is why search result ids must match room-store ids and why search hits need a floor field that matches the numeric floor model explained in [campus map model](../../concepts/map/campus-map-model).

## Constraints For Changes

Search must preserve three contracts. First, the Algolia index records need ids that the Supabase room store can find; otherwise selection falls back to an id that opens no room [@global-search] [@map-screen]. Second, `item.floor` must remain numeric to match the floor switcher and map filters [@global-search] [@map-screen]. Third, search should continue routing room selection through the map screen callback, because [geospatial rendering](../map/geospatial-rendering) owns floor state, room selection state, modal refs, and camera state [@map-screen].
