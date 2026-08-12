---
title: "OtaMaps Almanac"
summary: "Repository-owned Almanac entry point for the OtaMaps Expo mobile app."
topics: [wiki, product, app-shell]
sources:
  - id: package
    type: file
    path: package.json
  - id: root-layout
    type: file
    path: app/_layout.tsx
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

# OtaMaps Almanac

OtaMaps is an Expo Router React Native app for an Otaniemi school/campus map, Wilma school data, account/profile flows, BLE-based indoor location, friends and shared location, Ruokalinjasto queue status, and optional FabLab print workflows [@map-route] [@home-route] [@fablab-route]. The app entrypoint is `expo-router/entry`, and the dependency graph includes native Mapbox, Supabase, Google sign-in, BLE, Notifee, Algolia, SumUp, and Sentry packages [@package].

Use [Getting Started](getting-started) as the reading map for this wiki. It routes first-time agents toward product shape, app-shell ownership, route boundaries, Wilma, map/location behavior, FabLab, deployment, and validation caveats.

## First Reads

Start with [OtaMaps mobile app](concepts/product/otamaps-mobile-app), [Expo Router shell](architecture/app/expo-router-shell), and [main route map](architecture/app/main-route-map). The root layout wraps the app with SumUp, user state, gesture handling, Algolia search, splash/font loading, and BLE lifecycle wiring before individual screens render [@root-layout].

For feature work, read the owning cluster before editing code: [Wilma](concepts/integrations/wilma), [campus map model](concepts/map/campus-map-model), [BLE background location](architecture/location/ble-background-location), [friends and shared location](concepts/social/friends-and-shared-location), [schedule sharing](architecture/social/schedule-sharing), [queue status](architecture/map/queue-status), or [print jobs](concepts/fablab/print-jobs).

## Maintenance Bar

This wiki records durable knowledge future agents should not rediscover from scratch: decisions, cross-file flows, invariants, incidents, gotchas, operating procedures, and project context. Do not add pages that only restate nearby code.

Topics live in `topics.yaml`. Pages are Markdown files directly under `almanac/`, including nested folders. Use normal Markdown links between pages and put file evidence in `sources:`.
