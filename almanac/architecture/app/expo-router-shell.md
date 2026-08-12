---
title: "Expo Router Shell"
summary: "The Expo Router shell owns app-wide providers, font and splash readiness, root stacks, search, payment context, mobile observability, and BLE background lifecycle hooks."
topics: [architecture, app-shell, routes, authentication, location, fablab, observability]
sources:
  - id: package
    type: file
    path: package.json
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: required-update-gate
    type: file
    path: components/updates/RequiredUpdateGate.tsx
  - id: sentry-runtime
    type: file
    path: lib/sentry.ts
  - id: index-route
    type: file
    path: app/index.tsx
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: tabs-layout
    type: file
    path: app/(tabs)/_layout.tsx
  - id: feature-constants
    type: file
    path: constants/features.ts
  - id: app-layout
    type: file
    path: app/(app)/_layout.tsx
---

# Expo Router Shell

The Expo Router shell is the app-wide runtime boundary for OtaMaps. The package entrypoint is `expo-router/entry`, so files under `app/` define navigation rather than a manually assembled React Navigation tree [@package]. The root layout imports the BLE background task first, initializes Sentry immediately after that native entrypoint, loads Figtree fonts before hiding the splash screen, mounts SumUp, user, gesture, stack, Algolia InstantSearch, the required EAS update gate, and status-bar providers, and listens to Supabase auth events to start or stop BLE background location [@root-layout] [@required-update-gate] [@sentry-runtime]. Route-specific code should be read against this shell because payment, search, mobile observability, auth-adjacent background services, update activation, and font readiness are established before individual screens render.

## Root Runtime Responsibilities

`app/_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at module scope and returns `null` from the root navigation component until the custom Figtree font files are loaded [@root-layout]. When fonts finish loading, it hides the splash screen and renders the provider tree [@root-layout]. This makes font readiness a root concern instead of something each tab handles.

The root layout also exports `Sentry.wrap(function RootLayout() { ... })`, so React errors at and below the root shell enter the shared [mobile observability](../runtime/mobile-observability) path [@root-layout]. Keep the BLE background task import before the Sentry import because Notifee foreground-service registration must stay the first native background entrypoint [@root-layout].

The same file creates an Algolia lite client and wraps the app in `InstantSearch` with index name `rooms_rows` [@root-layout]. That is the app-wide search boundary used by map search flows, not a provider that belongs only to one search component. The root also wraps navigation with `SumUpProvider`, passing `process.env.EXPO_PUBLIC_SUMUP_API_KEY || ''` as the public key [@root-layout]. See [SumUp payment boundary](../fablab/sumup-payment-boundary) before changing this provider or the FabLab checkout surfaces.

`RequiredUpdateGate` is rendered beside the root navigation rather than inside one route, so an already authenticated app and a pre-authentication screen both share the same EAS update activation path [@root-layout]. The gate skips development and builds where Expo Updates is disabled, checks for updates when the app mounts and whenever `AppState` returns to active, downloads an available update or rollback, then shows a non-dismissible modal that calls `Updates.reloadAsync()` when the user presses `Päivitä nyt` [@required-update-gate]. Check and reload failures are reported through the shared Sentry helper under `area: "eas_update"` [@required-update-gate].

## Navigation Shape

The root stack declares `(tabs)`, `(app)/me`, `welcome`, and `+not-found` screens with headers disabled for the main app groups [@root-layout]. The index route is the first redirector: it checks the Supabase session, waits for a short custom splash, sends completed signed-in users to `/home`, sends incomplete signed-in users or preference-load failures to `/welcome/(post)/permissions`, and sends unauthenticated users to `/welcome` [@index-route] [@user-preferences]. The detailed route inventory is in [main route map](main-route-map), and the preference gate is explained in [onboarding and consent preferences](../auth/onboarding-and-consent-preferences).

The tab layout nests another provider boundary. It wraps tabs with `AuthProvider`, sets `home` as the initial tab, labels that tab `Wilma`, defines FabLab, map, and me triggers, and hides the FabLab trigger while static `FABLAB_VISIBLE` is false [@tabs-layout] [@feature-constants]. The authenticated auxiliary stack under `(app)` is a simple headerless `Stack`, so nested account, friends, Wilma, and debug screens inherit the root providers rather than defining their own app shell [@app-layout].

## BLE Background Lifecycle

The first import in the root layout is `@/lib/bleBackgroundTask`, with a comment stating it must run before any Notifee foreground-service notification is displayed [@root-layout]. After mount, the root asks Supabase for the current session and syncs tracking against both session state and `AppState` [@root-layout]. If a session exists and background tracking is enabled while the app is active, it starts the BLE background service; if background tracking is disabled while active, it starts foreground tracking; and if the app is not active without background tracking, it stops foreground tracking [@root-layout]. The root also listens for `SIGNED_IN` and `SIGNED_OUT`: sign-in resyncs authenticated tracking, and sign-out stops BLE tracking through the sign-out cleanup path [@root-layout].

This lifecycle links the shell to both [Supabase session authority](../../concepts/authentication/supabase-and-google-auth) and [BLE background location](../location/ble-background-location). Future auth changes should account for this coupling because a session transition can affect background location, not just navigation.
