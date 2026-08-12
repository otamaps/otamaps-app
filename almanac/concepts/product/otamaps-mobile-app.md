---
title: "OtaMaps Mobile App"
summary: "OtaMaps is the Expo React Native campus app in this repository, centered on indoor maps, school data, social location, queue status, and optional FabLab printing."
topics: [concepts, product, map, queue, location, wilma, fablab]
sources:
  - id: app-config
    type: file
    path: app.json
  - id: package
    type: file
    path: package.json
  - id: project-notes
    type: file
    path: chatgpt.md
  - id: tabs-layout
    type: file
    path: app/(tabs)/_layout.tsx
  - id: feature-constants
    type: file
    path: constants/features.ts
  - id: map-route
    type: file
    path: app/(tabs)/map.tsx
  - id: home-route
    type: file
    path: app/(tabs)/home.tsx
  - id: fablab-route
    type: file
    path: app/(tabs)/fablab/index.tsx
---

# OtaMaps Mobile App

OtaMaps is the mobile campus app implemented in this repository. It is an Expo and React Native application named `OtaMaps`, with app slug `otamaps`, iOS bundle `fi.otamaps.ios`, Android package `fi.otamaps.app`, and the custom URL scheme `otamapsapp` [@app-config]. Its product surface is broader than a map: the maintained project notes describe tab routes, authenticated nested routes, onboarding, Supabase-backed data, BLE location, friends, Wilma, and FabLab/SumUp checkout as core areas of the app [@project-notes]. The current code makes the map, home, FabLab, and profile tabs the main user-facing neighborhoods [@tabs-layout].

## Product Neighborhoods

The [campus map model](../map/campus-map-model) is the central product neighborhood. The map tab composes Mapbox rendering, room and feature stores, floor filtering, search, BLE current-location state, friend locations, friend requests, reports, bottom sheets, and room modal behavior in one route [@map-route]. This is why map work usually crosses product, rendering, search, location, and social boundaries rather than staying inside one component.

The map also surfaces [queue status](../../architecture/map/queue-status) for Ruokalinjasto. That feature highlights the queue room polygon and displays a Finnish `Vilkkaus` label based on a Supabase aggregate, so queue work crosses the map renderer, anonymous analytics consent, and admin-only observation storage [@map-route].

The [Wilma](../integrations/wilma) neighborhood is currently surfaced through the home tab. The route imports the Wilma GraphQL client, handles login and logout state, and displays schedule, messages, attendance, and exams with Finnish UI copy [@home-route]. The app also contains disabled or auxiliary Wilma route files, so route work should use the [main route map](../../architecture/app/main-route-map) before assuming every Wilma-looking file is active.

The [print jobs](../fablab/print-jobs) neighborhood is optional from the tab bar. The tab layout declares a FabLab trigger, but the current committed feature constant sets `FABLAB_VISIBLE` to false, so the visible tab bar hides FabLab until that static gate changes [@tabs-layout] [@feature-constants]. When visible, the FabLab list reads the signed-in user's `print_jobs`, joins filament data, subscribes to realtime changes, and opens the new-print or job-detail routes [@fablab-route].

## Native App Boundary

OtaMaps depends on native integrations rather than only JavaScript screens. The dependency set includes Expo Router, React Native, Mapbox, Supabase, Google sign-in, BLE, Notifee, SecureStore, notifications, document picking, Algolia InstantSearch, and SumUp packages [@package]. The app config also declares location, background location, Bluetooth, foreground-service, Mapbox, Google sign-in, BLE background, SecureStore, notification, font, web browser, and image plugins or permissions [@app-config].

That native boundary matters for future changes. Work on the [Expo Router shell](../../architecture/app/expo-router-shell) can affect all product neighborhoods because providers, splash loading, search, payment setup, and BLE background behavior are mounted above the route tree. Work on [BLE beacons and location](../location/ble-beacons-and-location) can affect both the user's local map position and shared friend locations because the app config permission text states that location is sent to the server and shared with added friends [@app-config].
