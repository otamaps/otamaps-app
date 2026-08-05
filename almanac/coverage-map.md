---
title: Coverage Map
summary: Frozen page inventory for this first wiki build.
topics: [build, wiki, reference]
sources: []
---

# Coverage Map

## Page Inventory

### Root

- path: `almanac/getting-started.md`
  slug: `getting-started`
  purpose: Front door to the finished wiki for future agents entering OtaMaps work.
  planned links: `concepts/product/otamaps-mobile-app`, `architecture/app/expo-router-shell`, `guides/development/local-development`, `reference/configuration/runtime-and-build-config`
  key evidence files: `chatgpt.md`, `package.json`, `app/_layout.tsx`, `app/(tabs)/map.tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/fablab/index.tsx`

### concepts/product

- path: `almanac/concepts/product/otamaps-mobile-app.md`
  slug: `concepts/product/otamaps-mobile-app`
  purpose: Define OtaMaps as the mobile app in this repository and name its main product neighborhoods.
  planned links: `architecture/app/expo-router-shell`, `concepts/map/campus-map-model`, `concepts/location/ble-beacons-and-location`, `concepts/fablab/print-jobs`, `concepts/integrations/wilma`
  key evidence files: `app.json`, `package.json`, `chatgpt.md`, `app/(tabs)/_layout.tsx`, `app/(tabs)/map.tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/fablab/index.tsx`

### concepts/authentication

- path: `almanac/concepts/authentication/supabase-and-google-auth.md`
  slug: `concepts/authentication/supabase-and-google-auth`
  purpose: Explain the Supabase session model, Google sign-in exchange, email fallback, and profile creation assumptions.
  planned links: `architecture/app/expo-router-shell`, `architecture/auth/session-and-identity`, `guides/account/edit-profile-and-sign-out`, `reference/storage/client-caches`
  key evidence files: `lib/supabase.ts`, `lib/googleAuth.ts`, `context/AuthContext.tsx`, `app/index.tsx`, `app/welcome/(pre)/login.tsx`, `app/welcome/(pre)/emailLogin.tsx`, `components/functions/codeGen.tsx`

### concepts/map

- path: `almanac/concepts/map/campus-map-model.md`
  slug: `concepts/map/campus-map-model`
  purpose: Describe the room, feature, floor, coordinate, and search model that makes the indoor campus map work.
  planned links: `architecture/map/geospatial-rendering`, `architecture/map/room-feature-data`, `architecture/search/room-search-flow`, `reference/supabase/map-social-and-location-tables`
  key evidence files: `app/(tabs)/map.tsx`, `lib/roomService.ts`, `components/globalSearch.tsx`, `lib/idTranslation.ts`, `components/functions/geoJson.ts`

### concepts/location

- path: `almanac/concepts/location/ble-beacons-and-location.md`
  slug: `concepts/location/ble-beacons-and-location`
  purpose: Define OtaMaps BLE beacons, location estimates, floor selection, and the live location table split.
  planned links: `architecture/location/ble-background-location`, `architecture/location/live-location-overlays`, `decisions/mobile/background-ble-via-notifee`, `reference/supabase/map-social-and-location-tables`
  key evidence files: `components/functions/bleScanner.tsx`, `lib/bleLocationService.ts`, `lib/bleBackgroundTask.ts`, `lib/bleBackgroundManager.ts`, `docs/BLE_LOCATION_TRACKING.md`, `database/migrations/001_create_user_locations_table.sql`

### concepts/social

- path: `almanac/concepts/social/friends-and-shared-location.md`
  slug: `concepts/social/friends-and-shared-location`
  purpose: Explain friend codes, requests, relations, visible friend locations, reporting, and blocking/removal gotchas.
  planned links: `architecture/social/friend-relations`, `architecture/location/live-location-overlays`, `reference/supabase/map-social-and-location-tables`, `guides/account/edit-profile-and-sign-out`
  key evidence files: `lib/friendsHandler.ts`, `app/(app)/friends/add.tsx`, `app/(app)/friends/requests.tsx`, `app/(tabs)/map.tsx`, `components/friendItem.tsx`, `components/sheets/friendModalSheet.tsx`

### concepts/integrations

- path: `almanac/concepts/integrations/wilma.md`
  slug: `concepts/integrations/wilma`
  purpose: Explain the active Wilma integration, including schedule, messages, attendance, and the split between active and placeholder routes.
  planned links: `architecture/wilma/graphql-client-and-reauth`, `architecture/app/main-route-map`, `reference/wilma/endpoints-and-securestore-keys`
  key evidence files: `app/(tabs)/home.tsx`, `lib/wilma/graphqlClient.ts`, `app/(app)/wilma/messages.tsx`, `app/(app)/wilma/message.tsx`, `app/(app)/wilma/schedule.tsx`, `app/(app)/me/wilma/login.tsx`, `app/(tabs)/wilma.tsx.dis`

### concepts/fablab

- path: `almanac/concepts/fablab/print-jobs.md`
  slug: `concepts/fablab/print-jobs`
  purpose: Define the FabLab print job product surface, status vocabulary, file upload, and user-facing lifecycle.
  planned links: `architecture/fablab/print-upload-and-status`, `architecture/fablab/sumup-payment-boundary`, `guides/fablab/enable-and-test-fablab`, `reference/supabase/fablab-tables-and-storage`
  key evidence files: `app/(tabs)/fablab/index.tsx`, `app/(tabs)/fablab/new-print.tsx`, `app/(tabs)/fablab/[jobId].tsx`, `lib/fablabTypes.ts`, `assets/fablab/terms.md`

### architecture/app

- path: `almanac/architecture/app/expo-router-shell.md`
  slug: `architecture/app/expo-router-shell`
  purpose: Document the root Expo Router shell, providers, splash/font loading, SumUp provider, InstantSearch, and BLE background lifecycle hook.
  planned links: `architecture/app/main-route-map`, `concepts/authentication/supabase-and-google-auth`, `architecture/location/ble-background-location`, `architecture/fablab/sumup-payment-boundary`
  key evidence files: `package.json`, `app/_layout.tsx`, `app/index.tsx`, `app/(tabs)/_layout.tsx`, `app/(app)/_layout.tsx`

- path: `almanac/architecture/app/main-route-map.md`
  slug: `architecture/app/main-route-map`
  purpose: Map active tab, auxiliary, welcome, debug, placeholder, and disabled route surfaces without mirroring every file.
  planned links: `architecture/app/expo-router-shell`, `concepts/integrations/wilma`, `concepts/fablab/print-jobs`, `reference/routes/debug-and-disabled-routes`
  key evidence files: `app/`, `app/(tabs)/_layout.tsx`, `app/(app)/_layout.tsx`, `app/welcome/_layout.tsx`, `tsconfig.json`

### architecture/auth

- path: `almanac/architecture/auth/session-and-identity.md`
  slug: `architecture/auth/session-and-identity`
  purpose: Describe how Supabase sessions, cached users, profile rows, and profile realtime updates interact.
  planned links: `concepts/authentication/supabase-and-google-auth`, `reference/storage/client-caches`, `architecture/social/friend-relations`
  key evidence files: `lib/supabase.ts`, `context/AuthContext.tsx`, `lib/getUserHandle.tsx`, `app/(tabs)/me.tsx`, `app/(app)/me/edit.tsx`, `lib/googleAuth.ts`

### architecture/map

- path: `almanac/architecture/map/geospatial-rendering.md`
  slug: `architecture/map/geospatial-rendering`
  purpose: Explain the Mapbox layer composition, floor filtering, room polygons, WC symbols, building extrusions, and camera focus behavior.
  planned links: `concepts/map/campus-map-model`, `architecture/map/room-feature-data`, `architecture/search/room-search-flow`, `guides/map/geojson-debug-import`
  key evidence files: `app/(tabs)/map.tsx`, `components/mapBottomSheet.tsx`, `components/sheets/roomModalSheet.tsx`, `assets/icons/stairs.png`

- path: `almanac/architecture/map/room-feature-data.md`
  slug: `architecture/map/room-feature-data`
  purpose: Explain the Zustand and AsyncStorage cache flow for rooms and map features.
  planned links: `concepts/map/campus-map-model`, `reference/supabase/map-social-and-location-tables`, `reference/storage/client-caches`, `architecture/map/geospatial-rendering`
  key evidence files: `lib/roomService.ts`, `app/(tabs)/map.tsx`, `components/sheets/roomModalSheet.tsx`, `app/(app)/debug/supabase/rooms.tsx`, `app/(app)/debug/supabase/features.tsx`

### architecture/search

- path: `almanac/architecture/search/room-search-flow.md`
  slug: `architecture/search/room-search-flow`
  purpose: Document how Algolia InstantSearch hits drive floor switching, room selection, modal opening, and camera focus.
  planned links: `architecture/app/expo-router-shell`, `architecture/map/geospatial-rendering`, `concepts/map/campus-map-model`
  key evidence files: `app/_layout.tsx`, `components/globalSearch.tsx`, `app/(tabs)/map.tsx`

### architecture/location

- path: `almanac/architecture/location/ble-background-location.md`
  slug: `architecture/location/ble-background-location`
  purpose: Explain foreground BLE scanning, Android Notifee foreground service, iOS state restoration, permissions, and upload cadences.
  planned links: `concepts/location/ble-beacons-and-location`, `decisions/mobile/background-ble-via-notifee`, `guides/permissions/location-notification-and-ble`, `reference/storage/client-caches`
  key evidence files: `components/functions/bleScanner.tsx`, `lib/bleBackgroundTask.ts`, `lib/bleBackgroundManager.ts`, `plugins/withNotifeeAndroid.js`, `app/_layout.tsx`, `app.json`, `docs/BLE_LOCATION_TRACKING.md`

- path: `almanac/architecture/location/live-location-overlays.md`
  slug: `architecture/location/live-location-overlays`
  purpose: Explain how local BLE location and friend locations become map overlays and bottom-sheet social UI.
  planned links: `concepts/location/ble-beacons-and-location`, `concepts/social/friends-and-shared-location`, `architecture/map/geospatial-rendering`, `reference/supabase/map-social-and-location-tables`
  key evidence files: `app/(tabs)/map.tsx`, `components/customUserLocation.tsx`, `components/friendItem.tsx`, `components/friendBlob.tsx`, `lib/bleLocationService.ts`, `lib/friendsHandler.ts`

### architecture/social

- path: `almanac/architecture/social/friend-relations.md`
  slug: `architecture/social/friend-relations`
  purpose: Explain relation status transitions, symmetric subject/object queries, request handling, removal, and blocking mismatch.
  planned links: `concepts/social/friends-and-shared-location`, `architecture/auth/session-and-identity`, `reference/supabase/map-social-and-location-tables`
  key evidence files: `lib/friendsHandler.ts`, `app/(app)/friends/add.tsx`, `app/(app)/friends/requests.tsx`, `app/(tabs)/map.tsx`

### architecture/fablab

- path: `almanac/architecture/fablab/print-upload-and-status.md`
  slug: `architecture/fablab/print-upload-and-status`
  purpose: Document the new-print wizard, Supabase storage upload, print_jobs insert, realtime job updates, and status stepper.
  planned links: `concepts/fablab/print-jobs`, `architecture/fablab/sumup-payment-boundary`, `reference/supabase/fablab-tables-and-storage`
  key evidence files: `app/(tabs)/fablab/new-print.tsx`, `app/(tabs)/fablab/[jobId].tsx`, `app/(tabs)/fablab/index.tsx`, `lib/fablabTypes.ts`

- path: `almanac/architecture/fablab/sumup-payment-boundary.md`
  slug: `architecture/fablab/sumup-payment-boundary`
  purpose: Explain the SumUp provider, backend checkout endpoint boundary, SDK hook/service split, and stale setup-doc mismatch.
  planned links: `concepts/fablab/print-jobs`, `architecture/fablab/print-upload-and-status`, `reference/configuration/runtime-and-build-config`
  key evidence files: `app/_layout.tsx`, `app/(tabs)/fablab/[jobId].tsx`, `hooks/useCheckout.ts`, `lib/sumupService.ts`, `docs/SUMUP_CHECKOUT_SETUP.md`, `llm/sumup.md`, `llm/sumupsdk.md`

### architecture/wilma

- path: `almanac/architecture/wilma/graphql-client-and-reauth.md`
  slug: `architecture/wilma/graphql-client-and-reauth`
  purpose: Explain the Wilma GraphQL client, timeout wrapper, SecureStore session/credential persistence, single-flight reauth, and schedule/messages/attendance requests.
  planned links: `concepts/integrations/wilma`, `reference/wilma/endpoints-and-securestore-keys`, `architecture/app/main-route-map`
  key evidence files: `lib/wilma/graphqlClient.ts`, `app/(tabs)/home.tsx`, `app/(app)/wilma/messages.tsx`, `app/(app)/wilma/message.tsx`, `app/(app)/wilma/schedule.tsx`

### architecture/runtime

- path: `almanac/architecture/runtime/feature-flags.md`
  slug: `architecture/runtime/feature-flags`
  purpose: Explain Supabase-backed feature flags, the local enabled-flag cache, and current usage gaps around booking UI.
  planned links: `reference/storage/client-caches`, `reference/supabase/map-social-and-location-tables`, `architecture/map/room-feature-data`
  key evidence files: `lib/featureFlagService.ts`, `components/sheets/roomModalSheet.tsx`, `components/findRoomView.tsx`

### guides/development

- path: `almanac/guides/development/local-development.md`
  slug: `guides/development/local-development`
  purpose: Give future agents the current commands, project conventions, and known local validation caveats.
  planned links: `reference/configuration/runtime-and-build-config`, `reference/testing/typecheck-status`, `architecture/app/expo-router-shell`
  key evidence files: `package.json`, `chatgpt.md`, `tsconfig.json`, `babel.config.js`, `eslint.config.js`

### guides/permissions

- path: `almanac/guides/permissions/location-notification-and-ble.md`
  slug: `guides/permissions/location-notification-and-ble`
  purpose: Explain how onboarding and settings request/check notification, foreground location, background location, Bluetooth, and BLE background-service permissions.
  planned links: `architecture/location/ble-background-location`, `decisions/mobile/background-ble-via-notifee`, `concepts/location/ble-beacons-and-location`
  key evidence files: `app/welcome/(post)/permissions.tsx`, `app/(app)/me/settings.tsx`, `lib/bleBackgroundManager.ts`, `app.json`, `plugins/withNotifeeAndroid.js`

### guides/map

- path: `almanac/guides/map/geojson-debug-import.md`
  slug: `guides/map/geojson-debug-import`
  purpose: Explain the debug GeoJSON import/cache route and how it relates to the active Supabase-backed map.
  planned links: `architecture/map/geospatial-rendering`, `architecture/map/room-feature-data`, `reference/routes/debug-and-disabled-routes`
  key evidence files: `components/functions/geoJson.ts`, `app/(app)/debug/geoJsonImport.tsx`, `assets/geos/map.ts`, `app/(tabs)/map.tsx`

### guides/fablab

- path: `almanac/guides/fablab/enable-and-test-fablab.md`
  slug: `guides/fablab/enable-and-test-fablab`
  purpose: Explain the local FabLab tab opt-in, expected user flow, and runtime dependencies needed to exercise print jobs and payments.
  planned links: `concepts/fablab/print-jobs`, `architecture/fablab/print-upload-and-status`, `architecture/fablab/sumup-payment-boundary`
  key evidence files: `app/(app)/me/fablab.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/fablab/index.tsx`, `app/(tabs)/fablab/new-print.tsx`, `app/(tabs)/fablab/[jobId].tsx`

### guides/account

- path: `almanac/guides/account/edit-profile-and-sign-out.md`
  slug: `guides/account/edit-profile-and-sign-out`
  purpose: Explain profile editing, friend-code copying, debug mode visibility, user cache clearing, and sign-out behavior.
  planned links: `concepts/authentication/supabase-and-google-auth`, `architecture/auth/session-and-identity`, `concepts/social/friends-and-shared-location`
  key evidence files: `app/(tabs)/me.tsx`, `app/(app)/me/edit.tsx`, `app/(app)/me/settings.tsx`, `lib/getUserHandle.tsx`, `lib/googleAuth.ts`

### decisions/mobile

- path: `almanac/decisions/mobile/background-ble-via-notifee.md`
  slug: `decisions/mobile/background-ble-via-notifee`
  purpose: Record the repo's explicit decision to register Notifee foreground service before app layout work and use platform-specific BLE background handling.
  planned links: `architecture/location/ble-background-location`, `guides/permissions/location-notification-and-ble`
  key evidence files: `app/_layout.tsx`, `lib/bleBackgroundTask.ts`, `lib/bleBackgroundManager.ts`, `plugins/withNotifeeAndroid.js`, `app.json`

### reference/configuration

- path: `almanac/reference/configuration/runtime-and-build-config.md`
  slug: `reference/configuration/runtime-and-build-config`
  purpose: Catalog app identifiers, Expo plugins, EAS profiles, runtime env variables, and known hard-coded configuration discrepancies.
  planned links: `architecture/app/expo-router-shell`, `architecture/location/ble-background-location`, `architecture/fablab/sumup-payment-boundary`, `guides/development/local-development`
  key evidence files: `app.json`, `eas.json`, `package.json`, `lib/supabase.ts`, `app/(tabs)/map.tsx`, `lib/googleAuth.ts`, `lib/sumupService.ts`

### reference/supabase

- path: `almanac/reference/supabase/map-social-and-location-tables.md`
  slug: `reference/supabase/map-social-and-location-tables`
  purpose: List the Supabase map, room, beacon, social, report, and location tables/views inferred from current code and the committed migration.
  planned links: `concepts/map/campus-map-model`, `concepts/social/friends-and-shared-location`, `concepts/location/ble-beacons-and-location`, `architecture/map/room-feature-data`
  key evidence files: `lib/roomService.ts`, `lib/bleLocationService.ts`, `lib/idTranslation.ts`, `lib/friendsHandler.ts`, `app/(tabs)/map.tsx`, `database/migrations/001_create_user_locations_table.sql`, `app/(app)/debug/supabase/`

- path: `almanac/reference/supabase/fablab-tables-and-storage.md`
  slug: `reference/supabase/fablab-tables-and-storage`
  purpose: List the Supabase tables and storage bucket assumptions behind the FabLab print workflow.
  planned links: `concepts/fablab/print-jobs`, `architecture/fablab/print-upload-and-status`
  key evidence files: `app/(tabs)/fablab/index.tsx`, `app/(tabs)/fablab/new-print.tsx`, `app/(tabs)/fablab/[jobId].tsx`, `lib/fablabTypes.ts`

### reference/storage

- path: `almanac/reference/storage/client-caches.md`
  slug: `reference/storage/client-caches`
  purpose: Catalog AsyncStorage and SecureStore keys used for sessions, user cache, rooms, features, beacons, friends, feature flags, FabLab tab opt-in, BLE background opt-in, and Wilma data.
  planned links: `architecture/auth/session-and-identity`, `architecture/map/room-feature-data`, `architecture/location/ble-background-location`, `reference/wilma/endpoints-and-securestore-keys`
  key evidence files: `lib/getUserHandle.tsx`, `lib/roomService.ts`, `components/functions/bleScanner.tsx`, `lib/bleLocationService.ts`, `lib/featureFlagService.ts`, `app/(app)/me/fablab.tsx`, `lib/bleBackgroundTask.ts`, `lib/wilma/graphqlClient.ts`, `lib/wilma/owLoginHandler.ts`, `lib/wilma/wilmaRequestHandlers.ts`

### reference/wilma

- path: `almanac/reference/wilma/endpoints-and-securestore-keys.md`
  slug: `reference/wilma/endpoints-and-securestore-keys`
  purpose: Catalog active Wilma endpoint constants, SecureStore keys, GraphQL operations, direct REST helper, and placeholder/disabled route evidence.
  planned links: `concepts/integrations/wilma`, `architecture/wilma/graphql-client-and-reauth`
  key evidence files: `lib/wilma/graphqlClient.ts`, `lib/wilma/owLoginHandler.ts`, `lib/wilma/wilmaRequestHandlers.ts`, `app/(tabs)/home.tsx`, `app/(app)/me/wilma/login.tsx`, `app/(tabs)/wilma.tsx.dis`

### reference/routes

- path: `almanac/reference/routes/debug-and-disabled-routes.md`
  slug: `reference/routes/debug-and-disabled-routes`
  purpose: Catalog debug, disabled, and placeholder route surfaces that future agents should not mistake for production flows.
  planned links: `architecture/app/main-route-map`, `guides/map/geojson-debug-import`, `concepts/integrations/wilma`
  key evidence files: `app/(app)/debug/`, `app/(app)/debug2/`, `app/(tabs)/debug.tsx.dis`, `app/(tabs)/find.tsx.dis`, `app/(tabs)/wilma.tsx.dis`, `app/(app)/me/wilma/login.tsx`, `tsconfig.json`

### reference/testing

- path: `almanac/reference/testing/typecheck-status.md`
  slug: `reference/testing/typecheck-status`
  purpose: Record the local validation commands and known TypeScript/typecheck caveats visible from repo guidance and configuration.
  planned links: `guides/development/local-development`, `reference/routes/debug-and-disabled-routes`
  key evidence files: `package.json`, `chatgpt.md`, `tsconfig.json`, `tests/beaconFilteringTest.ts`

- path: `almanac/reference/testing/test-coverage.md`
  slug: `reference/testing/test-coverage`
  purpose: Record the current test-script reality and the standalone beacon filtering test that is not wired into npm scripts.
  planned links: `guides/development/local-development`, `architecture/location/ble-background-location`, `reference/testing/typecheck-status`
  key evidence files: `package.json`, `tests/beaconFilteringTest.ts`, `chatgpt.md`
