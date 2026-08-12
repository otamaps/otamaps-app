---
title: "EAS Production Update"
summary: "Use this guide when publishing a JavaScript or TypeScript-only OtaMaps fix to installed production builds through EAS Update."
topics: [guides, deployment, mobile, configuration]
sources:
  - id: update-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T20-03-13-019ff1c7-3903-76f0-ac11-5da6c46f4398.jsonl
  - id: app-config
    type: file
    path: app.json
  - id: eas-config
    type: file
    path: eas.json
  - id: package
    type: file
    path: package.json
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: required-update-gate
    type: file
    path: components/updates/RequiredUpdateGate.tsx
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: network-errors
    type: file
    path: lib/networkErrors.ts
  - id: sentry-runtime
    type: file
    path: lib/sentry.ts
  - id: required-update-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-40-23-019ff28e-0e0c-7383-be65-1ff5a35ceaa4.jsonl
---

# EAS Production Update

Use this guide when an OtaMaps change can be delivered to already installed production builds with EAS Update. An update is appropriate for JavaScript, TypeScript, and bundled-asset behavior that does not require a new native binary; native dependencies, Expo plugins, permissions, identifiers, version changes, and build-profile changes still belong in [EAS production build](eas-production-build) [@app-config] [@eas-config]. Because `app.json` pins `runtimeVersion` to `0.4.1`, a production update can only reach installed binaries that use that exact runtime unless a new native build changes the runtime value [@app-config].

## Preflight

Start by checking `git status --short` and reading the diff. The August 11, 2026 Wilma login update was published from a dirty tree that included the intended client timeout and Expo-fetch cancellation changes plus earlier uncommitted iOS build-support changes, so future updates must inspect scope deliberately before publishing [@update-session]. Do not include unrelated app-source edits by accident; EAS Update publishes the current JavaScript bundle state, not only the files a maintainer is thinking about.

Confirm the update is runtime-compatible before publishing. The current app config has app version `0.4.1`, Android `versionCode` 15, iOS `buildNumber` 8, and Expo Updates URL `https://u.expo.dev/a66a863c-7d69-47e4-ab26-8f79f378847e` [@app-config]. The production EAS profile uses channel and environment `production`, and it embeds the production Supabase, OtaMaps API, Wilma primary-auth, Google, Mapbox, SumUp, and Sentry public values into the build environment [@eas-config].

## Validate The Bundle

Run the checks that match the changed surface before publishing. For the Wilma login timeout fix, the session ran app-wide TypeScript, targeted ESLint over the network and Wilma files, a temporary CommonJS compile plus Node tests for `lib/networkErrors.ts`, and `git diff --check` before publishing [@update-session]. That validation matched the change because the code introduced `FetchTimeoutError`, `ETIMEDOUT`, and Expo SDK 57 cancellation recognition in `lib/networkErrors.ts`, wired that helper into Sentry's rejected-fetch tracking, and used it from the Wilma auth broker's timeout path [@network-errors] [@sentry-runtime] [@wilma-auth-broker].

Also run native-target exports for the update contents:

```bash
npx expo export --platform android --output-dir /tmp/otamaps-eas-production/android
npx expo export --platform ios --output-dir /tmp/otamaps-eas-production/ios
```

The Wilma login update session completed Android and iOS exports before publishing [@update-session]. These exports prove the Metro bundle can be produced for both native platforms; they do not prove the update was downloaded by an installed device or that the user-facing Wilma login succeeds [@update-session].

## Publish

Publish to the production branch with the production EAS environment and both native platforms:

```bash
npx eas update \
  --branch production \
  --message "Fix Wilma login timeout and Expo fetch cancellation handling" \
  --environment production \
  --platform all \
  --non-interactive \
  --json
```

Use the project-local EAS CLI path through `npx` so the command follows the repository dependency graph; `package.json` declares `eas-cli` as a project dependency [@package]. The `production` channel is mapped to the `production` branch, so this command changes the update served to installed production-channel builds that match the runtime version [@eas-config] [@update-session].

If `eas update` stalls before the export or upload output appears, retry with Node's IPv4-first DNS ordering instead of treating the silent process as a publish. In the August 12, 2026 update session, the plain publish attempt hung with no upload output, `update:list` showed that no new group had appeared, and the successful retry used this prefix [@required-update-session]:

```bash
NODE_OPTIONS=--dns-result-order=ipv4first npx eas update \
  --branch production \
  --platform all \
  --environment production \
  --message "Prevent anonymous queue RPC permission errors" \
  --non-interactive
```

After any stalled attempt, stop the hanging process and verify the branch before retrying so an operator does not accidentally publish the same dirty tree twice [@required-update-session].

## Verify

After publishing, query the production channel and branch instead of trusting the upload output alone:

```bash
npx eas channel:view production --json --non-interactive
npx eas update:list --branch production --limit 3 --json --non-interactive
```

The August 11, 2026 update produced group `01fe7db7-34c8-4ffd-b686-585ab233b049` with message `Fix Wilma login timeout and Expo fetch cancellation handling`, runtime `0.4.0`, Android update id `019ff1ed-34dc-7ec2-8963-aac63a8004f4`, and iOS update id `019ff1ed-34dc-7a6e-a9af-6d7c3fdd55f1` [@update-session]. Direct `curl` probes to both remote manifest permalinks returned HTTP 200, and the session confirmed the latest production Android build 15 and iOS build 4 were compatible with that runtime [@update-session].

`npx eas update:view <group> --json --non-interactive` failed in that session because this EAS CLI command rejected `--non-interactive`; use `channel:view`, `update:list`, direct manifest probes, or rerun `update:view` without that flag when an exact group view is needed [@update-session].

## Device Activation

The app now has an explicit in-app reload prompt. `app/_layout.tsx` renders `RequiredUpdateGate` at the root, and that component checks for an EAS update on mount and when the app returns to active, fetches an available update or rollback, and blocks the UI with a non-dismissible Finnish modal until the user presses `Päivitä nyt`, which calls `Updates.reloadAsync()` [@root-layout] [@required-update-gate]. User-facing release instructions should therefore tell users to open the app online and accept the required update prompt when it appears.

Do not call an OTA release fully proven from manifest checks alone. The Wilma timeout update was published and remotely visible, but a real successful Wilma login still needed an on-device test; if login failed again, the new telemetry was expected to distinguish a 45-second auth timeout from a server response error [@update-session] [@wilma-auth-broker] [@sentry-runtime]. The August 12, 2026 update was also remotely visible on the production branch with HTTP 200 manifest probes, but no iOS simulator was used and the schedule-sharing feature still needed a separate Supabase schema deployment before the client path could work in production [@required-update-session].
