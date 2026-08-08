---
title: "Typecheck Status"
summary: "Typecheck status records the exact local TypeScript validation command, the npm script gap, the BLE test exception, and the repository caveats that affect OtaMaps type-checking."
topics: [reference, testing, typescript, development]
sources:
  - id: package-scripts
    type: file
    path: package.json
  - id: repo-notes
    type: file
    path: chatgpt.md
  - id: typescript-config
    type: file
    path: tsconfig.json
  - id: ble-core-test
    type: file
    path: tests/bleTrackingCore.test.cjs
  - id: ble-config-test
    type: file
    path: tests/bleConfig.test.mjs
---

# Typecheck Status

Typecheck status in this repository is a local reference point, not a green automated test contract. The package scripts define Expo start, platform start, reset, lint, and `test:ble`, but they do not define an npm typecheck script [@package-scripts]. Repository notes name `npx tsc --noEmit` as the TypeScript check and also record known pre-existing errors in debug Supabase screens, map layer typings, welcome route typing, and checkout error types [@repo-notes]. The TypeScript configuration is strict, uses the `@/*` import path alias, and includes both normal TypeScript sources and two disabled tab-route files with `.tsx.dis` suffixes [@typescript-config].

## Command Surface

The package-managed validation commands are `npm run lint` and `npm run test:ble` [@package-scripts]. Type-checking is documented separately as:

```bash
npx tsc --noEmit
```

That command comes from the repository notes rather than from `package.json`, so a future agent should not expect `npm run typecheck` or `npm test` to exist unless those scripts are added later [@repo-notes] [@package-scripts]. `npm run test:ble` compiles only the named BLE core, type, estimator, and catalog modules into `.expo/ble-test-build` before running Node tests, so it is not a substitute for app-wide TypeScript validation [@package-scripts] [@ble-core-test] [@ble-config-test]. The local development guide should use this page as the lookup source for TypeScript command status: [local development](../../guides/development/local-development).

## Compiler Scope

`tsconfig.json` extends Expo's base TypeScript configuration, enables `strict: true`, and maps `@/*` imports to the repository root [@typescript-config]. Its `include` list covers `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`, and the disabled tab files `app/(tabs)/debug.tsx.dis` and `app/(tabs)/wilma.tsx.dis` [@typescript-config].

The disabled-route includes are a caveat for route work. They mean type-checking can still inspect some route surfaces that are not active `.tsx` files. The route catalog for those files belongs in [debug and disabled routes](../routes/debug-and-disabled-routes).

## Known Status Source

The repository notes state that `npx tsc --noEmit` reports pre-existing errors in four areas: debug Supabase screens, map layer typings, welcome route typing, and checkout error types [@repo-notes]. Treat that statement as project guidance for triage, not as proof that a new change is unrelated to type errors. When a change touches one of those areas, run the command and separate old diagnostics from new ones.

## BLE Test Caveat

The BLE tests intentionally avoid the full app type-checking scope. `tests/bleTrackingCore.test.cjs` imports the compiled CommonJS output from `.expo/ble-test-build`, and `tests/bleConfig.test.mjs` reads JSON and plugin source files directly [@ble-core-test] [@ble-config-test]. The `test:ble` script therefore type-checks only the compiled BLE inputs it names, then runs JavaScript tests; app routes, React Native UI files, and disabled `.tsx.dis` routes remain covered only by `npx tsc --noEmit` [@package-scripts] [@typescript-config].
