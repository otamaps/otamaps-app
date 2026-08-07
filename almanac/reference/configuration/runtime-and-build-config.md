---
title: "Runtime And Build Config"
summary: "This reference lists the OtaMaps runtime and build configuration surfaces that affect Expo plugins, native identifiers, public environment variables, Supabase, Wilma, Mapbox, Google sign-in, SumUp, and BLE."
topics: [reference, configuration, deployment, mobile]
sources:
  - id: app-config
    type: file
    path: app.json
  - id: package
    type: file
    path: package.json
  - id: eas-config
    type: file
    path: eas.json
  - id: env-example
    type: file
    path: .env.example
  - id: assets-images
    type: file
    path: assets/images/
  - id: map-route
    type: file
    path: app/(tabs)/map.tsx
  - id: supabase-client
    type: file
    path: lib/supabase.ts
  - id: wilma-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: splash-route
    type: file
    path: app/welcome/splash.tsx
---

# Runtime And Build Config

Runtime and build configuration in OtaMaps is split across Expo app config, EAS build profiles, local environment examples, and runtime client fallbacks. `app.json` owns native identifiers, permissions, plugins, and EAS project id; `eas.json` owns per-profile public env values; `.env.example` documents local env shape; and runtime clients still carry production defaults for Supabase and the OtaMaps API [@app-config] [@eas-config] [@env-example] [@supabase-client] [@wilma-client] [@wilma-auth-broker].

## Native App Config

`app.json` declares the app name, slug, version, portrait orientation, bundle identifiers, Android package and version code, iOS Info.plist permission copy, Android permissions, blocked permissions, plugins, typed routes, and EAS project id [@app-config]. The native `expo-splash-screen` plugin uses `./assets/images/otamaps-logo.png` at width `260` on a white background, and the in-app `welcome/splash.tsx` route uses the same wordmark image before showing the Streetsmarts footer [@app-config] [@splash-route]. BLE-sensitive native config includes Android foreground-service and connected-device foreground-service permissions, Android Bluetooth scan/connect permissions, iOS Bluetooth usage text, and the `react-native-ble-plx` plugin with background support and `central` mode [@app-config].

The root layout depends on this native configuration because it mounts BLE background lifecycle code, SumUp provider setup, Algolia search, fonts, and the route stack above individual screens [@root-layout]. Changes to app config should therefore be checked against [Expo Router shell](../../architecture/app/expo-router-shell), [BLE background location](../../architecture/location/ble-background-location), and [location, notification, and BLE permissions](../../guides/permissions/location-notification-and-ble).

## Web Static Export Boundary

The Expo web config uses Metro static output and sets `web.favicon` to `./assets/images/icon.png` [@app-config]. The current image directory contains OtaMaps, splash, adaptive-icon, login background, Hallitus, and Streetsmarts images, but not `icon.png`; a web export therefore needs either the config path or the asset set corrected before the favicon check can pass [@app-config] [@assets-images].

The package dependencies include `@rnmapbox/maps` but do not declare `mapbox-gl` [@package]. Because the map tab imports `@rnmapbox/maps` through the app route graph, a static web export can stop on Mapbox web dependency resolution even when Android or native-route changes are unrelated [@map-route] [@package]. Treat that as a web configuration boundary and verify native changes with native-target validation when the change is not meant to make the web build production-ready.

## Public Environment Variables

The Supabase client reads `EXPO_PUBLIC_SUPABASE_URL`, then falls back to the committed `egfc...` Supabase project URL; it reads `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY`, then falls back to the committed anon key [@supabase-client]. EAS development, preview, and production profiles all set the same canonical Supabase URL and public key [@eas-config].

Wilma and OtaMaps API clients read `EXPO_PUBLIC_OTAMAPS_API_URL`, defaulting to `https://api.otamaps.fi` [@wilma-client] [@wilma-auth-broker]. `.env.example` describes that API as the host for GraphQL and the Wilma-to-Supabase auth exchange, and all EAS profiles set it to the production API URL [@env-example] [@eas-config]. `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED` controls whether the Wilma primary-auth form is visible; EAS enables it for development and disables it for preview and production [@eas-config] [@wilma-auth-broker].

Other public env keys include Google web and iOS client ids, MapTiler and Mapbox tokens, SumUp public and secret key placeholders, SumUp merchant code, and the payment return URL [@env-example] [@eas-config]. The root layout reads `EXPO_PUBLIC_SUMUP_API_KEY` for `SumUpProvider` [@root-layout].

## Change Boundary

Configuration changes are not purely local. If a change touches Supabase URL/key, OtaMaps API URL, Wilma primary-auth enablement, native permissions, Expo plugins, or app identifiers, update the relevant architecture or reference page and verify the matching EAS profile rather than assuming local `.env` behavior matches a build [@app-config] [@eas-config] [@env-example]. Use [server deployment](../../guides/deployment/server-deployment) for the hostname and service-boundary implications of Supabase or OtaMaps API changes.
