---
title: "Local Development"
summary: "Use this guide to run OtaMaps locally and choose the available validation commands without confusing targeted BLE tests with app-wide readiness."
topics: [guides, development, testing]
sources:
  - id: package
    type: file
    path: package.json
  - id: repo-notes
    type: file
    path: chatgpt.md
  - id: typecheck-reference
    type: file
    path: almanac/reference/testing/typecheck-status.md
  - id: test-reference
    type: file
    path: almanac/reference/testing/test-coverage.md
---

# Local Development

Use this guide when starting or validating the local OtaMaps Expo app. The repository is an Expo Router React Native app with package scripts for starting Expo, running platform helpers, linting, and running the targeted BLE test suite [@package] [@repo-notes]. App-wide TypeScript checking remains a manual command rather than a package script [@repo-notes] [@typecheck-reference].

## Run The App

Start the Expo dev server with:

```bash
npm run start
```

Platform helpers are also defined for Android, iOS, and web [@package]:

```bash
npm run android
npm run ios
npm run web
```

These commands start local development surfaces. They do not prove native background BLE, EAS builds, Supabase migrations, Wilma backend deployment, or physical-device behavior.

## Validate Changes

Run lint through the package script [@package]:

```bash
npm run lint
```

Run the targeted BLE parser, selection, retry-coalescing, and native-config tests with [@package] [@test-reference]:

```bash
npm run test:ble
```

Run broad TypeScript checking manually [@repo-notes] [@typecheck-reference]:

```bash
npx tsc --noEmit
```

The known caveat is that broad TypeScript currently reports pre-existing errors in debug Supabase screens, map layer typings, welcome route typing, and checkout error types [@repo-notes]. Use [typecheck status](../../reference/testing/typecheck-status) and [test coverage](../../reference/testing/test-coverage) to separate targeted local checks from full app validation.
