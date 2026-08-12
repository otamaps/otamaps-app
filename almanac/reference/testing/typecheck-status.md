---
title: "Typecheck Status"
summary: "Typecheck status records the exact local TypeScript validation command, the npm script gap, the BLE test exception, and the repository caveats that affect OtaMaps type-checking."
topics: [reference, testing, typescript, development]
sources:
  - id: package-scripts
    type: file
    path: package.json
  - id: typescript-config
    type: file
    path: tsconfig.json
  - id: ble-core-test
    type: file
    path: tests/bleTrackingCore.test.cjs
  - id: ble-config-test
    type: file
    path: tests/bleConfig.test.mjs
  - id: tests-dir
    type: file
    path: tests/
  - id: sdk57-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/08/rollout-2026-08-08T17-37-34-019fe1ce-cd4f-7ee1-b1a8-46157360f6f8.jsonl
---

# Typecheck Status

Typecheck status in this repository is a local reference point, not a green automated test contract. The package scripts define Expo start, platform start, reset, lint, and `test:ble`, but they do not define an npm typecheck script [@package-scripts]. The local TypeScript command is `npx tsc --noEmit`, and the August 2026 SDK 57 upgrade session reported it passing with no errors after dependency and typing fixes [@sdk57-session]. The TypeScript configuration is strict, uses the `@/*` import path alias, and includes both normal TypeScript sources and two disabled tab-route files with `.tsx.dis` suffixes [@typescript-config].

## Command Surface

The package-managed validation commands are `npm run lint` and `npm run test:ble` [@package-scripts]. Type-checking is documented separately as:

```bash
npx tsc --noEmit
```

That command is not wired into `package.json`, so a future agent should not expect `npm run typecheck` or `npm test` to exist unless those scripts are added later [@package-scripts]. `npm run test:ble` compiles only the named BLE core, type, estimator, and catalog modules into `.expo/ble-test-build` before running Node tests, so it is not a substitute for app-wide TypeScript validation [@package-scripts] [@ble-core-test] [@ble-config-test]. Other helper tests now exist under `tests/`, but they do not change the package-managed command surface until a package script or CI target runs them [@tests-dir] [@package-scripts]. The local development guide should use this page as the lookup source for TypeScript command status: [local development](../../guides/development/local-development).

## Compiler Scope

`tsconfig.json` extends Expo's base TypeScript configuration, enables `strict: true`, and maps `@/*` imports to the repository root [@typescript-config]. Its `include` list covers `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`, and the disabled tab files `app/(tabs)/debug.tsx.dis` and `app/(tabs)/wilma.tsx.dis` [@typescript-config].

The disabled-route includes are a caveat for route work. They mean type-checking can still inspect some route surfaces that are not active `.tsx` files. The route catalog for those files belongs in [debug and disabled routes](../routes/debug-and-disabled-routes).

## Current Status Source

The older repository notes about pre-existing TypeScript failures are no longer the current status source after the SDK 57 upgrade. The selected upgrade session fixed TypeScript 6 errors across Supabase debug screens, checkout handling, globals, timers, native package typings, RNMapbox map typings, and the BLE test compiler invocation, then reported `npx tsc --noEmit` passing with no errors [@sdk57-session]. If the command fails again, treat the diagnostics as current evidence rather than assuming the old baseline still applies.

## BLE Test Caveat

The BLE tests intentionally avoid the full app type-checking scope. `tests/bleTrackingCore.test.cjs` imports the compiled CommonJS output from `.expo/ble-test-build`, and `tests/bleConfig.test.mjs` reads JSON and plugin source files directly [@ble-core-test] [@ble-config-test]. The `test:ble` script therefore type-checks only the compiled BLE inputs it names, then runs JavaScript tests; app routes, React Native UI files, and disabled `.tsx.dis` routes remain covered only by `npx tsc --noEmit` [@package-scripts] [@typescript-config].
