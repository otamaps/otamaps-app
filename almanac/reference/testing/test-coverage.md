---
title: "Test Coverage"
summary: "Test coverage records the repository's current validation wiring: lint is scripted, BLE tests have an npm script, broad app type-checking remains separate, and several helper tests exist without a package script."
topics: [reference, testing, ble, development]
sources:
  - id: package-scripts
    type: file
    path: package.json
  - id: ble-core-test
    type: file
    path: tests/bleTrackingCore.test.cjs
  - id: ble-config-test
    type: file
    path: tests/bleConfig.test.mjs
  - id: network-errors-test
    type: file
    path: tests/networkErrors.test.cjs
  - id: message-thread-test
    type: file
    path: tests/messageThread.test.cjs
  - id: schedule-dates-test
    type: file
    path: tests/scheduleDates.test.cjs
  - id: shared-schedule-test
    type: file
    path: tests/sharedSchedule.test.cjs
  - id: schedule-sharing-schema-test
    type: file
    path: tests/scheduleSharingSchema.test.cjs
  - id: course-selection-grouping-test
    type: file
    path: tests/courseSelectionGrouping.test.cjs
  - id: friend-presentation-test
    type: file
    path: tests/friendPresentation.test.cjs
  - id: ble-core
    type: file
    path: lib/bleTrackingCore.ts
  - id: ble-types
    type: file
    path: lib/bleTrackingTypes.ts
  - id: ble-estimator
    type: file
    path: lib/blePositionEstimator.ts
  - id: ble-catalog
    type: file
    path: lib/bleBeaconCatalog.ts
  - id: sdk57-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/08/rollout-2026-08-08T17-37-34-019fe1ce-cd4f-7ee1-b1a8-46157360f6f8.jsonl
---

# Test Coverage

Test coverage for OtaMaps is split between package-wired validation and helper tests. `package.json` defines Expo start helpers, reset, platform helpers, `lint`, and `test:ble`; it still does not define a generic `test` script or a `typecheck` script [@package-scripts]. The BLE script compiles the tracking core, tracking types, position estimator, and catalog cache into `.expo/ble-test-build` with the SDK 57 TypeScript `node16` module settings, then runs Node's built-in test runner against the core, estimator, cache, and native-config tests [@package-scripts] [@ble-core-test] [@ble-config-test] [@sdk57-session]. Additional Node test files cover network errors, Wilma message-thread rendering, schedule date helpers, shared weekly schedule shaping and schema-error detection, course-selection grouping, and friend-location presentation, but those files are not wired into an npm script in the current package manifest [@network-errors-test] [@message-thread-test] [@schedule-dates-test] [@shared-schedule-test] [@schedule-sharing-schema-test] [@course-selection-grouping-test] [@friend-presentation-test] [@package-scripts].

## Scripted Validation

The package script table has these validation-related entries:

| Script | Command | Coverage meaning |
| --- | --- | --- |
| `lint` | `expo lint` | Scripted static lint command [@package-scripts]. |
| `test:ble` | `tsc lib/bleTrackingCore.ts lib/bleTrackingTypes.ts lib/blePositionEstimator.ts lib/bleBeaconCatalog.ts --ignoreConfig --outDir .expo/ble-test-build --module node16 --moduleResolution node16 --target es2020 --esModuleInterop --skipLibCheck && node --test tests/bleTrackingCore.test.cjs tests/bleConfig.test.mjs` | Compiles the BLE selection/parser, estimator, catalog, and type modules for Node 16 module resolution tests, then runs the BLE core and native config tests [@package-scripts]. |
| `test` | not defined | No all-purpose npm test runner is declared [@package-scripts]. |
| `typecheck` | not defined | Type-checking is documented on [typecheck status](typecheck-status) as `npx tsc --noEmit`, not as an npm script [@package-scripts]. |

Use [typecheck status](typecheck-status) for the TypeScript command. Use [local development](../../guides/development/local-development) for the broader development command surface.

## BLE Tests

`tests/bleTrackingCore.test.cjs` covers the deterministic code exported from the compiled BLE modules. It accepts valid OtaMaps advertisements without a device name, allows manufacturer data only when the OtaMaps service UUID is present, rejects weak, empty, `none`, and control-character payloads, prunes stale observations, verifies the 6 dB immediate switch rule, verifies the three-reading smaller-margin switch rule, switches away from stale selections, checks heartbeat and movement upload decisions, confirms latest-only location-fix coalescing, checks single-beacon and weighted-centroid estimates, and verifies single-flight catalog refresh plus batched missing-id lookup [@ble-core-test] [@ble-core] [@ble-types] [@ble-estimator] [@ble-catalog].

`tests/bleConfig.test.mjs` checks native configuration rather than runtime behavior. It reads `app.json`, `eas.json`, and `plugins/withNotifeeAndroid.js`; then it asserts that iOS enables only the Core Bluetooth `central` background role, Android declares a persistent connected-device foreground service with the expected permissions and max-SDK-30 background-location cap, and all EAS build profiles point at the canonical Supabase project [@ble-config-test].

## Unwired Helper Tests

Several Node tests exist outside the package script table. `tests/networkErrors.test.cjs` checks Expo SDK 57 fetch-cancellation recognition, abort handling, ordinary network-error separation, and the stable `FetchTimeoutError` shape [@network-errors-test]. `tests/messageThread.test.cjs` checks original-message and reply ordering, metadata escaping while preserving Wilma HTML bodies, and Finnish reply-count labels [@message-thread-test]. `tests/scheduleDates.test.cjs` checks Monday-through-Friday school-week calculation, local ISO date formatting without UTC day shifts, and Sunday-to-Friday week selection [@schedule-dates-test].

The social and Wilma helper tests cover data-shaping boundaries that are easy to break without touching route files. `tests/sharedSchedule.test.cjs` checks Monday-through-Friday schedule extraction, sanitized lesson fields, duplicate collapse, and time sorting [@shared-schedule-test]. `tests/scheduleSharingSchema.test.cjs` recognizes missing schedule-sharing schema and legacy consent-purpose constraint errors without swallowing unrelated database errors [@schedule-sharing-schema-test]. `tests/courseSelectionGrouping.test.cjs` checks split `Jakso` labels, selected-course grouping, natural sorting, and refreshed tray rematching when a session-scoped id changes [@course-selection-grouping-test]. `tests/friendPresentation.test.cjs` checks Finnish empty-state labels for missing or legacy unknown locations and concise room labels for known rooms [@friend-presentation-test].

## Coverage Boundary

`test:ble` is useful evidence for the BLE parser, selection engine, estimator math, catalog cache behavior, retry coalescing helper, upload-decision helper, and native configuration. The SDK 57 upgrade session reported the script passing 20/20 after the compiler invocation was moved to `node16` settings [@sdk57-session]. It is not an end-to-end proof that physical BLE scanning, Android foreground-service behavior, iOS restoration, Supabase uploads, or ESP32 beacon hardware work on devices [@package-scripts] [@ble-core-test] [@ble-config-test]. The unwired helper tests are evidence for their focused pure-helper contracts, but they are not a repository-wide test command until a script or CI target runs them with the compiled `.expo/*-test-build` artifacts they import [@package-scripts] [@network-errors-test] [@message-thread-test] [@shared-schedule-test].
