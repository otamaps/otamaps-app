---
title: "Test Coverage"
summary: "Test coverage records the repository's current validation wiring: lint is scripted, BLE tests have an npm script, and broad app type-checking remains separate."
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
  - id: ble-core
    type: file
    path: lib/bleTrackingCore.ts
  - id: ble-types
    type: file
    path: lib/bleTrackingTypes.ts
  - id: repo-notes
    type: file
    path: chatgpt.md
---

# Test Coverage

Test coverage for OtaMaps is still narrow, but BLE now has an explicit package script. `package.json` defines Expo start helpers, reset, platform helpers, `lint`, and `test:ble`; it still does not define a generic `test` script or a `typecheck` script [@package-scripts]. The BLE script compiles the tracking core and types into `.expo/ble-test-build` and then runs Node's built-in test runner against the core-selection and native-config tests [@package-scripts] [@ble-core-test] [@ble-config-test]. Repository notes list lint and broad TypeScript checks separately, so agents should keep app-wide type-checking distinct from the BLE test script [@repo-notes].

## Scripted Validation

The package script table has these validation-related entries:

| Script | Command | Coverage meaning |
| --- | --- | --- |
| `lint` | `expo lint` | Scripted static lint command [@package-scripts]. |
| `test:ble` | `tsc lib/bleTrackingCore.ts lib/bleTrackingTypes.ts --outDir .expo/ble-test-build --module commonjs --moduleResolution node --target es2020 --esModuleInterop --skipLibCheck && node --test tests/bleTrackingCore.test.cjs tests/bleConfig.test.mjs` | Compiles the BLE selection/parser code for CommonJS tests, then runs the BLE core and native config tests [@package-scripts]. |
| `test` | not defined | No all-purpose npm test runner is declared [@package-scripts]. |
| `typecheck` | not defined | Type-checking is documented as `npx tsc --noEmit`, not as an npm script [@repo-notes] [@package-scripts]. |

Use [typecheck status](typecheck-status) for the TypeScript command and known diagnostic caveats. Use [local development](../../guides/development/local-development) for the broader development command surface.

## BLE Tests

`tests/bleTrackingCore.test.cjs` covers the deterministic code exported from the compiled BLE tracking core. It accepts valid OtaMaps advertisements without a device name, allows manufacturer data only when the OtaMaps service UUID is present, rejects weak, empty, `none`, and control-character payloads, prunes stale observations, verifies the 6 dB immediate switch rule, verifies the three-reading smaller-margin switch rule, switches away from stale selections, checks heartbeat upload decisions, and confirms latest-only location-fix coalescing [@ble-core-test] [@ble-core] [@ble-types].

`tests/bleConfig.test.mjs` checks native configuration rather than runtime behavior. It reads `app.json`, `eas.json`, and `plugins/withNotifeeAndroid.js`; then it asserts that iOS enables only the Core Bluetooth `central` background role, Android declares a persistent connected-device foreground service with the expected permissions and max-SDK-30 background-location cap, and all EAS build profiles point at the canonical Supabase project [@ble-config-test].

## Coverage Boundary

`test:ble` is useful evidence for the BLE parser, selection engine, retry coalescing helper, and native configuration. It is not an end-to-end proof that physical BLE scanning, Android foreground-service behavior, iOS restoration, Supabase uploads, or ESP32 beacon hardware work on devices [@package-scripts] [@ble-core-test] [@ble-config-test]. Future test additions should add new package scripts or extend this page so agents can distinguish local unit/config checks from device and deployment validation.
