---
title: "EAS Production Build"
summary: "Use this guide when preparing and uploading native OtaMaps production builds through EAS."
topics: [guides, deployment, mobile, configuration]
sources:
  - id: release-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
  - id: ios-production-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/10/rollout-2026-08-10T19-02-10-019fec68-f9f4-7652-afff-13664fb4d6b9.jsonl
  - id: eas-config
    type: file
    path: eas.json
  - id: app-config
    type: file
    path: app.json
  - id: package
    type: file
    path: package.json
  - id: eas-ignore
    type: file
    path: .easignore
  - id: google-modular-plugin
    type: file
    path: plugins/withIosGoogleModularHeaders.js
  - id: sumup-patch
    type: file
    path: patches/sumup-react-native-alpha+0.1.36.patch
  - id: message-thread-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-40-23-019ff28e-0e0c-7383-be65-1ff5a35ceaa4.jsonl
---

# EAS Production Build

Use this guide when preparing an Android or iOS production build for OtaMaps through EAS. Production builds are native release artifacts, so they require more than a successful Metro bundle: inspect the EAS archive, verify the public build-time configuration, run native-target exports with dotenv disabled, upload with the intended EAS profile, preserve the known iOS CocoaPods compatibility fixes, and poll the remote build result before calling the release complete [@release-session] [@ios-production-session] [@eas-config]. If the change is JavaScript, TypeScript, or bundled-asset-only and does not require a new native runtime, use [EAS production update](eas-production-update) instead. Server-side readiness is a separate gate covered by [server deployment](server-deployment).

## Archive Before Upload

Start by creating the exact production archive that EAS will upload:

```bash
node_modules/.bin/eas build:inspect --platform android --stage archive --output /private/tmp/otamaps-eas-archive --profile production --force
```

The August 2026 release run used `build:inspect` before upload, then scanned the archive for dotenv files, keystores, private keys, provisioning profiles, certificates, and package artifacts [@release-session]. A safe archive may still contain `.env.example`; it must not contain real `.env` files or private signing material [@release-session]. `.easignore` excludes local dotenv files, `node_modules`, Expo output, native Pods and Xcode build products, signing material, local artifacts, and `almanac/` from EAS archives [@eas-ignore]. The August 11 message-thread build proved why this matters: after excluding local Pods, build output, and machine-specific Xcode paths, the corrected iOS upload dropped from roughly 558 MB to about 3 MB [@message-thread-session].

After archive creation, check the archive's `eas.json`, `lib/supabase.ts`, and `.env.example` for the intended public hosts and public variable names [@release-session] [@eas-config]. The production profile currently declares `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_OTAMAPS_API_URL`, `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED`, Google client ids, and map tokens for native builds [@eas-config]. If those names or hosts change, update [runtime and build config](../../reference/configuration/runtime-and-build-config) and confirm the matching server state before building.

## Local Native Bundle Check

Run platform exports with dotenv disabled and explicit public production values:

```bash
EXPO_NO_DOTENV=1 \
EXPO_PUBLIC_SUPABASE_URL=<supabase-url> \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
EXPO_PUBLIC_OTAMAPS_API_URL=<api-url> \
EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED=true \
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google-web-client-id> \
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<google-ios-client-id> \
node_modules/.bin/expo export --platform android --output-dir /private/tmp/otamaps-export-android --clear
```

Repeat for iOS with `--platform ios`. In the release run, both Android and iOS exports completed and produced native Hermes bundles before the remote upload step [@release-session]. The same run repeatedly printed the React Native Mapbox warning that `RNMapboxMapsDownloadToken` is deprecated and that the token is written into Gradle properties; `app.json` still configures Mapbox with `RNMapboxMapsDownloadToken`, so treat that warning as a release hygiene item rather than a bundle failure [@release-session] [@app-config].

## EAS Upload

Use the local project EAS CLI entrypoint so the command follows the repository dependency graph:

```bash
node_modules/.bin/eas build --platform android --profile production --non-interactive --no-wait
node_modules/.bin/eas build --platform ios --profile production --non-interactive --no-wait
```

`package.json` pins `eas-cli` as a project dependency, while the release run showed EAS recommending an explicit `cli.version` field in `eas.json` and warning that `cli.appVersionSource` will become required [@package] [@release-session]. Add those fields deliberately when stabilizing the release pipeline; do not hide the warning by switching to an arbitrary global CLI.

EAS loaded the same public variable names from both the remote production environment and the production profile `env` block, then used the profile values when both existed [@release-session] [@eas-config]. That precedence matters: changing a value only in the EAS web environment is not enough if `eas.json` still defines the same key.

## Local EAS Failure Mode

A non-escalated Android upload failed locally after credentials were selected because EAS tried to run `git config core.ignorecase false` and then could not write its cache error log under the user's Library cache [@release-session]. The same upload succeeded after the command was rerun with permission for EAS to update local Git/cache state and upload the archive, producing an Android EAS build URL [@release-session].

When this failure appears, do not debug the build contents first. Re-run the same profile after confirming the archive scan passed, and allow the local EAS CLI to update its cache and Git ignore-case setting [@release-session]. That fix only starts the remote build; it does not prove that Android or iOS finished successfully.

## iOS CocoaPods Failure Modes

The August 2026 iOS production run hit two separate CocoaPods failures after the upload reached remote native dependency resolution. First, `sumup-react-native` asked CocoaPods for the standalone `RCT-Folly` spec and failed with "Unable to find a specification for `RCT-Folly` depended upon by `sumup-react-native`" [@ios-production-session]. The repository fix is not a pod repo update; `patch-package` runs in `postinstall`, and the committed patch removes the SumUp podspec's New Architecture-only `React-Codegen`, `RCT-Folly`, `RCTRequired`, `RCTTypeSafety`, and `ReactCommon/turbomodule/core` dependencies [@package] [@sumup-patch].

After that patch, iOS pod install progressed to `sumup-react-native` and then failed because the Swift pod `AppCheckCore` depends on `GoogleUtilities` and `RecaptchaInterop`, which did not define modules under the static-library build [@ios-production-session]. The app config registers `./plugins/withIosGoogleModularHeaders`, which uses Expo's `apple.extraPods` Podfile properties hook to mark only `GoogleUtilities` and `RecaptchaInterop` as modular headers [@app-config] [@google-modular-plugin]. Keep that targeted plugin instead of switching to a global `use_modular_headers!` workaround unless the whole native graph is revalidated.

## Completion Criteria

An EAS production build is complete only after both platform jobs reach a successful terminal state and the resulting artifacts are installed or submitted through the intended channel [@release-session] [@ios-production-session]. The August 10, 2026 replacement iOS job `c289a5c9-3b6b-4d1d-a240-ab7b5b696617` reached `FINISHED`, produced an `.ipa`, completed remote CocoaPods installation with 153 pods, archived the app, and uploaded Sentry debug symbols [@ios-production-session]. That proves the remote iOS archive path after the SumUp and Google modular-header fixes, but it does not prove App Store Connect submission or device-level runtime behavior [@ios-production-session].

Native build success also does not prove server cutover. Before releasing a build that changes Supabase, Wilma, or OtaMaps API hosts, verify the server-side checklist in [server deployment](server-deployment) and make sure the EAS profile values match that deployed state [@eas-config]. For compatible client-only fixes after a native build is already installed, publish and verify through [EAS production update](eas-production-update) instead of rebuilding only to move JavaScript.
