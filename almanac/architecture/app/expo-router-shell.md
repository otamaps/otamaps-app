---
title: "Expo Router Shell"
summary: "The Expo Router shell owns app-wide providers, font and splash readiness, root stacks, search, payment context, and BLE background lifecycle hooks."
topics: [architecture, app-shell, routes, authentication, location, fablab]
sources:
  - id: package
    type: file
    path: package.json
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: index-route
    type: file
    path: app/index.tsx
  - id: tabs-layout
    type: file
    path: app/(tabs)/_layout.tsx
  - id: app-layout
    type: file
    path: app/(app)/_layout.tsx
---

# Expo Router Shell

The Expo Router shell is the app-wide runtime boundary for OtaMaps. The package entrypoint is `expo-router/entry`, so files under `app/` define navigation rather than a manually assembled React Navigation tree [@package]. The root layout imports the BLE background task first, loads Figtree fonts before hiding the splash screen, mounts SumUp, user, gesture, stack, Algolia InstantSearch, and status-bar providers, and listens to Supabase auth events to start or stop BLE background location [@root-layout]. Route-specific code should be read against this shell because payment, search, auth-adjacent background services, and font readiness are established before individual screens render.

## Root Runtime Responsibilities

`app/_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at module scope and returns `null` from the root navigation component until the custom Figtree font files are loaded [@root-layout]. When fonts finish loading, it hides the splash screen and renders the provider tree [@root-layout]. This makes font readiness a root concern instead of something each tab handles.

The same file creates an Algolia lite client and wraps the app in `InstantSearch` with index name `rooms_rows` [@root-layout]. That is the app-wide search boundary used by map search flows, not a provider that belongs only to one search component. The root also wraps navigation with `SumUpProvider`, passing `process.env.EXPO_PUBLIC_SUMUP_API_KEY || ''` as the public key [@root-layout]. See [SumUp payment boundary](../fablab/sumup-payment-boundary) before changing this provider or the FabLab checkout surfaces.

## Navigation Shape

The root stack declares `(tabs)`, `(app)/me`, `welcome`, and `+not-found` screens with headers disabled for the main app groups [@root-layout]. The index route is the first redirector: it checks the Supabase session, waits for a short custom splash, and replaces the route with `/home` for signed-in users or `/welcome` for unauthenticated users [@index-route]. The detailed route inventory is in [main route map](main-route-map).

The tab layout nests another provider boundary. It wraps tabs with `AuthProvider`, sets `home` as the initial tab, labels that tab `Wilma`, defines FabLab, map, and me tabs, and hides the FabLab tab unless `AsyncStorage` key `fablabEnabled` is `"true"` [@tabs-layout]. The authenticated auxiliary stack under `(app)` is a simple headerless `Stack`, so nested account, friends, Wilma, and debug screens inherit the root providers rather than defining their own app shell [@app-layout].

## BLE Background Lifecycle

The first import in the root layout is `@/lib/bleBackgroundTask`, with a comment stating it must run before any Notifee foreground-service notification is displayed [@root-layout]. After mount, the root asks Supabase for the current session and syncs tracking against both session state and `AppState` [@root-layout]. If a session exists and background tracking is enabled while the app is active, it starts the BLE background service; if background tracking is disabled while active, it starts foreground tracking; and if the app is not active without background tracking, it stops foreground tracking [@root-layout]. The root also listens for `SIGNED_IN` and `SIGNED_OUT`: sign-in resyncs authenticated tracking, and sign-out stops BLE tracking through the sign-out cleanup path [@root-layout].

This lifecycle links the shell to both [Supabase and Google auth](../../concepts/authentication/supabase-and-google-auth) and [BLE background location](../location/ble-background-location). Future auth changes should account for this coupling because a session transition can affect background location, not just navigation.
