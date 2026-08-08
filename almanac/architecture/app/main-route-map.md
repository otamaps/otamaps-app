---
title: "Main Route Map"
summary: "The main route map explains how OtaMaps separates root redirects, tabs, authenticated auxiliary stacks, welcome flows, debug surfaces, and disabled route files."
topics: [architecture, routes, navigation, onboarding]
sources:
  - id: app-dir
    type: file
    path: app/
  - id: index-route
    type: file
    path: app/index.tsx
  - id: user-preferences
    type: file
    path: lib/userPreferences.ts
  - id: tabs-layout
    type: file
    path: app/(tabs)/_layout.tsx
  - id: app-layout
    type: file
    path: app/(app)/_layout.tsx
  - id: me-layout
    type: file
    path: app/(app)/me/_layout.tsx
  - id: me-screen
    type: file
    path: app/(tabs)/me.tsx
  - id: welcome-layout
    type: file
    path: app/welcome/_layout.tsx
  - id: tsconfig
    type: file
    path: tsconfig.json
---

# Main Route Map

The OtaMaps route map is organized by Expo Router groups rather than by a single central router file. The `app/` tree contains a root layout and index route, the `(tabs)` group for primary app tabs, the `(app)` group for authenticated auxiliary screens, a `welcome` group for onboarding and login, debug routes, placeholder routes, and `.tsx.dis` files that are present in the repository but not normal Expo Router pages [@app-dir]. The root shell explains provider setup; this page explains the route surfaces a maintainer should expect when following navigation links from the [Expo Router shell](expo-router-shell).

## Primary Tabs

The active tab bar defines four tab names: `home`, `fablab`, `map`, and `me`, with `home` as the initial route [@tabs-layout]. The visible home tab is titled `Wilma`, map is titled `Kartta`, and profile is titled `Minä` [@tabs-layout]. All four tabs use `MaterialIcons`: Wilma uses `school`, FabLab uses `precision-manufacturing`, map uses `map`, and profile uses `person` [@tabs-layout]. The FabLab tab is declared but hidden from the tab bar unless `AsyncStorage` key `fablabEnabled` is set to `"true"` [@tabs-layout]. This makes FabLab a runtime opt-in route surface, not a separate build flavor.

The `app/` directory also contains disabled tab files, including `app/(tabs)/debug.tsx.dis`, `app/(tabs)/find.tsx.dis`, and `app/(tabs)/wilma.tsx.dis` [@app-dir]. The TypeScript config explicitly includes two disabled tab files, `debug.tsx.dis` and `wilma.tsx.dis`, even though the `.dis` suffix keeps them outside the normal `.tsx` route shape [@tsconfig]. Use [debug and disabled routes](../../reference/routes/debug-and-disabled-routes) before treating those files as active navigation.

## Auxiliary Authenticated Stack

The `(app)` group is a headerless stack [@app-layout]. Its route neighborhood includes debug screens, Supabase debug screens, friend add/request screens, profile auxiliary screens, a FabLab enablement screen under `me`, an admin queue screen under `me/admin/queue`, an active Wilma account connection screen under `me/wilma`, a redirecting compatibility login route under `me/wilma/login`, and active Wilma schedule, message, reply, compose, teacher-directory, news, and past-exam screens under `wilma` [@app-dir] [@me-layout]. These routes are not tabs, but they still inherit the root shell providers and can be pushed from tab surfaces.

This split matters for product work. The active home tab contains the main [Wilma](../../concepts/integrations/wilma) dashboard, while auxiliary Wilma routes live under `(app)/wilma` and `(app)/me/wilma` [@app-dir]. FabLab similarly has a visible tab neighborhood for [print jobs](../../concepts/fablab/print-jobs) plus a separate `me/fablab` enablement route [@app-dir]. The Me tab only shows `Jonotilanteen hallinta` to users whose profile role is admin, but authorization for [queue status](../map/queue-status) is enforced by Supabase RLS rather than by that hidden route link [@me-screen].

## Welcome And Root Redirects

The `welcome` group has its own layout that declares the `(pre)` stack with headers hidden [@welcome-layout]. The route tree includes `welcome/splash.tsx`, post-onboarding screens under `welcome/(post)`, and pre-auth screens under `welcome/(pre)` [@app-dir]. The pre-auth index is also the entrypoint for the [Wilma auth broker and account linking](../wilma/auth-broker-and-account-linking) flow when Wilma primary auth is enabled. Root navigation should be considered together with the index route described in [Expo Router shell](expo-router-shell), because the route tree alone does not show session-based redirects [@index-route].

The root index route separately handles the first redirect after the custom splash and Supabase session check. Signed-in users are sent to `/home`, the Wilma dashboard tab, only when `isOnboardingComplete()` returns true; otherwise they are sent to `/welcome/(post)/permissions`, and unauthenticated users are sent to `/welcome` [@index-route] [@user-preferences]. That redirect is not visible from the directory shape alone, so route work should read `app/index.tsx` with the route tree and the [onboarding and consent preferences](../auth/onboarding-and-consent-preferences) boundary [@index-route] [@app-dir].

## Placeholder And Debug Surfaces

`app/+not-found.tsx` exists as the root not-found route [@app-dir]. Debug surfaces are split between `(app)/debug`, `(app)/debug/supabase`, and `(app)/debug2` [@app-dir]. The route map should therefore be used as a guardrail: active tabs, authenticated auxiliary screens, debug tools, onboarding screens, and disabled files are separate surfaces even when their filenames look similar.
