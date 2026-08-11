---
title: "Local Development"
summary: "Use this guide to run OtaMaps locally and choose the available validation commands without confusing targeted BLE tests with app-wide readiness."
topics: [guides, development, testing]
sources:
  - id: package
    type: file
    path: package.json
  - id: eas-config
    type: file
    path: eas.json
  - id: repo-notes
    type: file
    path: chatgpt.md
  - id: typecheck-reference
    type: file
    path: almanac/reference/testing/typecheck-status.md
  - id: test-reference
    type: file
    path: almanac/reference/testing/test-coverage.md
  - id: sdk57-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/08/rollout-2026-08-08T17-37-34-019fe1ce-cd4f-7ee1-b1a8-46157360f6f8.jsonl
  - id: dev-apk-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
---

# Local Development

Use this guide when starting or validating the local OtaMaps Expo app. The repository is an Expo Router React Native app with package scripts for starting Expo, running platform helpers, linting, and running the targeted BLE test suite [@package] [@repo-notes]. App-wide TypeScript checking remains a manual command rather than a package script, and the August 2026 SDK 57 upgrade made that command pass cleanly in the upgraded dependency graph [@package] [@typecheck-reference] [@sdk57-session].

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

The current `development` EAS profile is a development-client internal APK. It sets `developmentClient: true`, `distribution: "internal"`, Android `buildType: "apk"`, and channel/environment `development` [@eas-config]. A previous development profile was deliberately release-mode after an Android development-client runtime crash, so verify the native dev-client startup path on a built APK before treating `npx expo start --dev-client` as proven for this checkout [@dev-apk-session] [@eas-config].

For JavaScript or TypeScript-only testing changes on an installed development-channel build, publish an EAS update instead of rebuilding the APK [@dev-apk-session]:

```bash
npx eas-cli update \
  --channel development \
  --environment development \
  --message "testing changes"
```

Native dependency, permission, plugin, Expo config, or version-code changes still require a new `--profile development` APK build because EAS Update cannot change the installed native binary [@dev-apk-session].

## Validate Changes

Run lint through the package script [@package]:

```bash
npm run lint
```

Run the targeted BLE parser, selection, retry-coalescing, and native-config tests with [@package] [@test-reference]:

```bash
npm run test:ble
```

Run broad TypeScript checking manually [@typecheck-reference]:

```bash
npx tsc --noEmit
```

Use [typecheck status](../../reference/testing/typecheck-status) and [test coverage](../../reference/testing/test-coverage) to separate targeted local checks from full app validation. A clean local TypeScript run still does not prove native device behavior, EAS artifacts, or live provider state [@sdk57-session].
