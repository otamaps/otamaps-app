---
title: "Debug And Disabled Routes"
summary: "This reference catalogs OtaMaps debug, placeholder, and disabled route surfaces so agents do not mistake them for normal production navigation."
topics: [reference, routes, navigation, development]
sources:
  - id: app-dir
    type: file
    path: app/
  - id: debug-tab
    type: file
    path: app/(tabs)/debug.tsx.dis
  - id: wilma-disabled-tab
    type: file
    path: app/(tabs)/wilma.tsx.dis
  - id: find-disabled-tab
    type: file
    path: app/(tabs)/find.tsx.dis
  - id: tsconfig
    type: file
    path: tsconfig.json
  - id: me-screen
    type: file
    path: app/(tabs)/me.tsx
  - id: wilma-account
    type: file
    path: app/(app)/me/wilma/index.tsx
  - id: wilma-login-redirect
    type: file
    path: app/(app)/me/wilma/login.tsx
---

# Debug And Disabled Routes

OtaMaps keeps several route-like files that are useful for development context but are not all normal user-facing routes. The active route tree contains debug stacks under `app/(app)/debug`, `app/(app)/debug2`, and `app/(app)/debug/supabase`, while disabled tab files use the `.tsx.dis` suffix under `app/(tabs)` [@app-dir]. The route map links here so future agents can tell active navigation from disabled or placeholder surfaces before changing [main route behavior](../../architecture/app/main-route-map).

## Disabled Tab Files

`app/(tabs)/debug.tsx.dis`, `app/(tabs)/find.tsx.dis`, and `app/(tabs)/wilma.tsx.dis` look like tab routes but are disabled by extension [@debug-tab] [@find-disabled-tab] [@wilma-disabled-tab]. `tsconfig.json` still explicitly includes `app/(tabs)/debug.tsx.dis` and `app/(tabs)/wilma.tsx.dis`, so broad TypeScript checks can inspect some disabled code even though Expo Router does not treat those files as normal `.tsx` pages [@tsconfig].

The disabled debug tab is an old menu for `/debug/ble`, `/debug/geoJsonImport`, `/debug/lang`, and `/debug/supabase` [@debug-tab]. Use [geoJSON debug import](../../guides/map/geojson-debug-import) for the debug import task and [BLE background location](../../architecture/location/ble-background-location) for the scanner runtime behind BLE diagnostics. The disabled Wilma tab uses direct Otawilma REST helpers, an AsyncStorage `wilma_saved_credentials` key, and debug-mode BLE display, so it is not the active OtaMaps API GraphQL Wilma surface [@wilma-disabled-tab]. The disabled find tab performs direct room searches and feature filters outside the active tab set [@find-disabled-tab].

## Active Debug Surfaces

The active app directory includes debug routes under `(app)`, including BLE diagnostics and Supabase debug screens [@app-dir]. The Me tab can route to `/(app)/debug2/ble`, and that route re-exports the main BLE diagnostics implementation rather than creating a second scanner [@me-screen] [@app-dir]. Use [BLE background location](../../architecture/location/ble-background-location) for the runtime boundary behind that screen and [test coverage](../testing/test-coverage) for the targeted BLE test scope.

## Placeholder Surfaces

`app/(app)/me/wilma/login.tsx` is now a compatibility redirect to `/me/wilma`, and `app/(app)/me/wilma/index.tsx` is an active Wilma account connection/settings screen [@wilma-login-redirect] [@wilma-account]. It should not be treated as the primary onboarding login implementation. The current Wilma primary auth entrypoint is the welcome pre-auth index when enabled, and the current Wilma dashboard entrypoint is the home tab; both are described by [Wilma](../../concepts/integrations/wilma).
