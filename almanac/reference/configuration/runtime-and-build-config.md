---
title: "Runtime And Build Config"
summary: "This reference lists the OtaMaps runtime and build configuration surfaces that affect Expo plugins, native identifiers, public environment variables, Supabase, Wilma, Mapbox, Google sign-in, SumUp, BLE, and Sentry."
topics: [reference, configuration, deployment, mobile, observability]
sources:
  - id: app-config
    type: file
    path: app.json
  - id: google-modular-plugin
    type: file
    path: plugins/withIosGoogleModularHeaders.js
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
  - id: sentry-runtime
    type: file
    path: lib/sentry.ts
  - id: metro-config
    type: file
    path: metro.config.js
  - id: splash-route
    type: file
    path: app/welcome/splash.tsx
  - id: sentry-rollout
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/09/rollout-2026-08-09T01-56-35-019fe397-a8b7-7ea0-ac45-84bdfaa1f182.jsonl
  - id: sdk57-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/08/rollout-2026-08-08T17-37-34-019fe1ce-cd4f-7ee1-b1a8-46157360f6f8.jsonl
  - id: dev-apk-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
---

# Runtime And Build Config

Runtime and build configuration in OtaMaps is split across Expo app config, EAS build profiles, local environment examples, Metro config, and runtime client fallbacks. `app.json` owns native identifiers, permissions, plugins, and EAS project id; `eas.json` owns per-profile public env values; `.env.example` documents local env shape; `metro.config.js` owns Sentry-aware bundler config; and runtime clients still carry production defaults for Supabase, the OtaMaps API, and Sentry [@app-config] [@eas-config] [@env-example] [@metro-config] [@supabase-client] [@wilma-client] [@wilma-auth-broker] [@sentry-runtime].

## Native App Config

`app.json` declares the app name, slug, version, portrait orientation, bundle identifiers, Android package and version code, iOS Info.plist permission copy, Android permissions, blocked permissions, plugins, typed routes, and EAS project id [@app-config]. The current native app version is `0.4.0`, iOS `buildNumber` is `4`, Android `versionCode` is `15`, and `runtimeVersion.policy` follows the app version for Expo Updates [@app-config]. The native `expo-splash-screen` plugin uses `./assets/images/otamaps-logo.png` at width `260` on a white background, and the in-app `welcome/splash.tsx` route uses the same wordmark image before showing the Streetsmarts footer [@app-config] [@splash-route]. BLE-sensitive native config includes Android foreground-service and connected-device foreground-service permissions, Android Bluetooth scan/connect permissions, iOS Bluetooth usage text, and the `react-native-ble-plx` plugin with background support and `central` mode [@app-config]. iOS Google sign-in config includes `@react-native-google-signin/google-signin` plus `./plugins/withIosGoogleModularHeaders`; the custom plugin writes `apple.extraPods` entries for `GoogleUtilities` and `RecaptchaInterop` with modular headers so Swift AppCheckCore can build under static CocoaPods linking [@app-config] [@google-modular-plugin]. Observability-sensitive native config includes the `@sentry/react-native/expo` plugin, while Metro uses `getSentryExpoConfig` so native builds can include Sentry source-map/debug-id handling [@app-config] [@metro-config].

The root layout depends on this native configuration because it mounts BLE background lifecycle code, SumUp provider setup, Algolia search, fonts, and the route stack above individual screens [@root-layout]. Changes to app config should therefore be checked against [Expo Router shell](../../architecture/app/expo-router-shell), [BLE background location](../../architecture/location/ble-background-location), and [location, notification, and BLE permissions](../../guides/permissions/location-notification-and-ble).

## Web Static Export Boundary

The Expo web config uses Metro static output and sets `web.favicon` to `./assets/images/icon.png` [@app-config]. The current image directory contains OtaMaps, splash, adaptive-icon, login background, Hallitus, and Streetsmarts images, but not `icon.png`; a web export therefore needs either the config path or the asset set corrected before the favicon check can pass [@app-config] [@assets-images].

The package dependencies include `@rnmapbox/maps` but do not declare `mapbox-gl` [@package]. Because the map tab imports `@rnmapbox/maps` through the app route graph, a static web export can stop on Mapbox web dependency resolution even when Android or native-route changes are unrelated [@map-route] [@package]. Treat that as a web configuration boundary and verify native changes with native-target validation when the change is not meant to make the web build production-ready.

## Public Environment Variables

The Supabase client reads `EXPO_PUBLIC_SUPABASE_URL`, then falls back to `https://db.otamaps.fi`; it reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY`, then falls back to the committed publishable key [@supabase-client]. EAS development, preview, and production profiles all set the same canonical Supabase URL and publishable key [@eas-config].

Wilma and OtaMaps API clients read `EXPO_PUBLIC_OTAMAPS_API_URL`, defaulting to `https://api.otamaps.fi` [@wilma-client] [@wilma-auth-broker]. `.env.example` describes that API as the host for GraphQL and the Wilma-to-Supabase auth exchange, and all EAS profiles set it to the production API URL [@env-example] [@eas-config]. `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED` controls whether the Wilma primary-auth form is visible; the auth broker enables Wilma primary auth unless the value is exactly `"false"`, and the EAS profiles plus `.env.example` set it to `"true"` [@wilma-auth-broker] [@eas-config] [@env-example].

Sentry reads `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENVIRONMENT`; EAS development, preview, and production profiles set the Sentry environment label to match the profile, while `.env.example` documents the public DSN and the secret build-only `SENTRY_AUTH_TOKEN` placeholder [@sentry-runtime] [@eas-config] [@env-example]. `SENTRY_AUTH_TOKEN` is required for source-map upload in EAS environments and is not a public runtime key [@env-example] [@sentry-rollout]. See [mobile observability](../../architecture/runtime/mobile-observability) before changing the Sentry DSN, environment labels, source-map configuration, or event sanitization boundary.

Other public env keys include Google web and iOS client ids, MapTiler and Mapbox tokens, SumUp public and secret key placeholders, SumUp merchant code, and the payment return URL [@env-example] [@eas-config]. The root layout reads `EXPO_PUBLIC_SUMUP_API_KEY` for `SumUpProvider` [@root-layout].

## SDK And EAS Profile State

The current dependency graph is on Expo SDK 57-era packages: `package.json` declares Expo `^57.0.0`, React Native `0.86.2`, React `19.2.3`, TypeScript `~6.0.3`, Reanimated `4.5.1`, `expo-updates`, `expo-dev-client`, and a project-local `eas-cli` [@package]. The SDK 57 upgrade removed deprecated or unused packages including `expo-background-fetch` and `react-native-localization`, and its validation reported Expo Doctor 20/20, clean TypeScript, Android and iOS Hermes exports, clean prebuilds, and an Android SDK 36 arm64 APK build [@sdk57-session].

The current `development` EAS profile is a development-client internal APK profile: it sets `developmentClient` to `true`, Android `buildType` to `apk`, and keeps channel/environment `development` [@eas-config]. A previous release-mode development profile existed after an Android development-client runtime crash during React Native development-tool initialization, so future agents changing this profile should retest the native dev-client startup path rather than assuming Fast Refresh works from the EAS flag alone [@dev-apk-session] [@eas-config]. JS and TypeScript-only changes can still be delivered to installed development-channel builds with EAS Update, but native dependency, permission, plugin, Expo config, or version-code changes need a new native APK [@dev-apk-session] [@eas-config].

## Change Boundary

Configuration changes are not purely local. If a change touches Supabase URL/key, OtaMaps API URL, Wilma primary-auth enablement, Sentry DSN/environment/source-map setup, native permissions, Expo plugins, or app identifiers, update the relevant architecture or reference page and verify the matching EAS profile rather than assuming local `.env` behavior matches a build [@app-config] [@eas-config] [@env-example] [@sentry-runtime]. Use [server deployment](../../guides/deployment/server-deployment) for the hostname and service-boundary implications of Supabase or OtaMaps API changes, use [mobile observability](../../architecture/runtime/mobile-observability) for telemetry and sanitization changes, and use [EAS production build](../../guides/deployment/eas-production-build) when the change must be proven in native release archives.
