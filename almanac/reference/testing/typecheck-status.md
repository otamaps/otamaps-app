---
title: "Typecheck Status"
summary: "Typecheck status records the exact local TypeScript validation command, the npm script gap, the targeted test exceptions, and the repository caveats that affect OtaMaps type-checking."
topics: [reference, testing, development]
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
  - id: queue-formatting-test
    type: file
    path: tests/queueFormatting.test.cjs
  - id: queue-formatting-core
    type: file
    path: lib/queueFormattingCore.ts
  - id: tests-dir
    type: file
    path: tests/
---

# Typecheck Status

Typecheck status in this repository is a local reference point, not a green automated test contract. The package scripts define Expo start, platform start, reset, lint, `test:ble`, and `test:queue`, but they do not define an npm typecheck script [@package-scripts]. The local TypeScript command is `npx tsc --noEmit`; run it in the current checkout when app-wide type status matters. The TypeScript configuration is strict, uses the `@/*` import path alias, and includes both normal TypeScript sources and two disabled tab-route files with `.tsx.dis` suffixes [@typescript-config].

## Command Surface

The package-managed validation commands are `npm run lint`, `npm run test:ble`, and `npm run test:queue` [@package-scripts]. Type-checking is documented separately as:

```bash
npx tsc --noEmit
```

That command is not wired into `package.json`, so a future agent should not expect `npm run typecheck` or `npm test` to exist unless those scripts are added later [@package-scripts]. `npm run test:ble` compiles only the named BLE core, type, estimator, and catalog modules into `.expo/ble-test-build` before running Node tests, so it is not a substitute for app-wide TypeScript validation [@package-scripts] [@ble-core-test] [@ble-config-test]. `npm run test:queue` compiles only the pure queue formatting helper into `.expo/queue-test-build` before running Node tests, so it validates queue copy and error classification without covering app-wide types, Supabase runtime RPCs, or React Native routes [@package-scripts] [@queue-formatting-core] [@queue-formatting-test]. Other helper tests now exist under `tests/`, but they do not change the package-managed command surface until a package script or CI target runs them [@tests-dir] [@package-scripts]. The local development guide should use this page as the lookup source for TypeScript command status: [local development](../../guides/development/local-development).

## Compiler Scope

`tsconfig.json` extends Expo's base TypeScript configuration, enables `strict: true`, and maps `@/*` imports to the repository root [@typescript-config]. Its `include` list covers `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`, and the disabled tab files `app/(tabs)/debug.tsx.dis` and `app/(tabs)/wilma.tsx.dis` [@typescript-config].

The disabled-route includes are a caveat for route work. They mean type-checking can still inspect some route surfaces that are not active `.tsx` files. The route catalog for those files belongs in [debug and disabled routes](../routes/debug-and-disabled-routes).

## Status Interpretation

Do not treat older notes about pre-existing TypeScript failures or old passing runs as the current status source. The current status is the output of `npx tsc --noEmit` in the checkout being changed, and failures should be interpreted against the command surface and compiler scope described above [@package-scripts] [@typescript-config].

## Targeted Test Caveat

The BLE tests intentionally avoid the full app type-checking scope. `tests/bleTrackingCore.test.cjs` imports the compiled CommonJS output from `.expo/ble-test-build`, and `tests/bleConfig.test.mjs` reads JSON and plugin source files directly [@ble-core-test] [@ble-config-test]. The `test:ble` script therefore type-checks only the compiled BLE inputs it names, then runs JavaScript tests; app routes, React Native UI files, and disabled `.tsx.dis` routes remain covered only by `npx tsc --noEmit` [@package-scripts] [@typescript-config].

The queue formatting tests follow the same targeted pattern. `tests/queueFormatting.test.cjs` imports the compiled CommonJS output from `.expo/queue-test-build`, so `test:queue` checks `lib/queueFormattingCore.ts` behavior but does not type-check `lib/queueService.ts`, the map route, the canteen modal, or Supabase migrations [@package-scripts] [@queue-formatting-core] [@queue-formatting-test].
