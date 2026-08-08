---
title: "Getting Started"
summary: "Entry point for understanding the OtaMaps mobile app wiki."
topics: [product, app-shell, routes]
sources:
  - id: project-notes
    type: file
    path: chatgpt.md
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
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
---

# Getting Started

OtaMaps is an Expo Router React Native app whose main work is organized around a tabbed school map, Wilma school data, account/profile flows, BLE-based indoor location, friends, and an optional FabLab print workflow [@project-notes]. The repository entrypoint is `expo-router/entry`, and the app depends on native packages for Mapbox maps, Supabase, Google sign-in, BLE scanning, Notifee, Algolia search, and SumUp payments [@package]. Start with the [OtaMaps mobile app](concepts/product/otamaps-mobile-app) concept for the product shape, then read the [Expo Router shell](architecture/app/expo-router-shell) and [main route map](architecture/app/main-route-map) pages before changing navigation or provider boundaries.

## First Pages To Read

The root shell is the first architecture page to read because it wraps the whole app with the SumUp provider, user provider, gesture handler root, Algolia `InstantSearch`, splash/font loading, and BLE background-service auth lifecycle [@root-layout]. The [main route map](architecture/app/main-route-map) then explains how root, tab, authenticated stack, welcome, debug, placeholder, and disabled routes are arranged.

For product context, read [OtaMaps mobile app](concepts/product/otamaps-mobile-app). The map tab is not just a visual route: it combines room data, feature layers, BLE current-room state, friend locations, search, bottom sheets, selected-floor state, and debug mode [@map-route]. The home tab is currently the active Wilma dashboard and includes login, schedule, message, exam, and attendance surfaces in Finnish [@home-route]. The FabLab tab lists the signed-in user's `print_jobs`, subscribes to realtime job changes, and pushes into new-print and job-detail routes [@fablab-route].

## Common Work Areas

For feature work, start with the cluster that owns the user-facing behavior: [campus map model](concepts/map/campus-map-model) for room and floor behavior, [Wilma](concepts/integrations/wilma) for school-data and account flows, [BLE background location](architecture/location/ble-background-location) for indoor tracking, [friends and shared location](concepts/social/friends-and-shared-location) for social location, and [print jobs](concepts/fablab/print-jobs) for FabLab.

Use [local development](guides/development/local-development) for commands and validation caveats. Use [runtime and build config](reference/configuration/runtime-and-build-config) when a change touches Expo plugins, identifiers, public environment variables, native permissions, or hard-coded provider keys. Use [server deployment](guides/deployment/server-deployment) when preparing the Ubuntu/Docker side for Supabase and the OtaMaps Wilma GraphQL API, and [EAS production build](guides/deployment/eas-production-build) when preparing native production artifacts.

Authentication work should start with [Supabase session authority](concepts/authentication/supabase-and-google-auth). Route work should start with [Expo Router shell](architecture/app/expo-router-shell), because auth state, onboarding completion, BLE background lifecycle, search, fonts, and payment provider setup all sit above individual screens [@root-layout] [@user-preferences]. When a change touches privacy choices, post-login routing, or location writes, read [onboarding and consent preferences](architecture/auth/onboarding-and-consent-preferences) before changing the BLE or settings flows.
