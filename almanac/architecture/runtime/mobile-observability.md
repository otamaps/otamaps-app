---
title: "Mobile Observability"
summary: "Mobile observability in OtaMaps is centered on a root Sentry runtime that captures native, JavaScript, network, Supabase, Wilma GraphQL, authentication, and BLE background failures while filtering sensitive request and credential data."
topics: [architecture, runtime, observability, mobile]
sources:
  - id: sentry-runtime
    type: file
    path: lib/sentry.ts
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: auth-context
    type: file
    path: context/AuthContext.tsx
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: network-errors
    type: file
    path: lib/networkErrors.ts
  - id: ble-background-task
    type: file
    path: lib/bleBackgroundTask.ts
  - id: ble-runtime
    type: file
    path: lib/bleTrackingRuntime.ts
  - id: app-config
    type: file
    path: app.json
  - id: metro-config
    type: file
    path: metro.config.js
  - id: eas-config
    type: file
    path: eas.json
  - id: env-example
    type: file
    path: .env.example
  - id: sentry-rollout
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/09/rollout-2026-08-09T01-56-35-019fe397-a8b7-7ea0-ac45-84bdfaa1f182.jsonl
---

# Mobile Observability

Mobile observability is a root runtime concern in OtaMaps. `app/_layout.tsx` imports `lib/sentry.ts` immediately after the BLE background entrypoint and exports the root layout through `Sentry.wrap`, so Sentry is initialized before route screens render while preserving the Notifee first-import requirement recorded by [BLE background location](../location/ble-background-location) [@root-layout]. The runtime captures native crashes, JavaScript errors, failed HTTP responses, rejected fetches, Supabase activity, Wilma GraphQL failures, auth session failures, and BLE background failures through one shared helper layer [@sentry-runtime] [@graphql-client] [@auth-context] [@ble-background-task] [@ble-runtime].

## Root Runtime

`lib/sentry.ts` calls `Sentry.init` with the public DSN from `EXPO_PUBLIC_SENTRY_DSN` or a committed mobile fallback, sets `EXPO_PUBLIC_SENTRY_ENVIRONMENT` or a development/production fallback as the environment, enables native crash, app hang, watchdog termination, tombstone, session, replay, feedback, console-log, HTTP-client, and Supabase integrations, and exports `Sentry` for the root layout wrapper [@sentry-runtime]. `metro.config.js` uses `getSentryExpoConfig`, and `app.json` declares the `@sentry/react-native/expo` plugin with the OtaMaps Sentry organization and project identifiers, so source maps and native integration are part of the Expo config rather than only JavaScript code [@metro-config] [@app-config].

The Sentry runtime also installs an idempotent `globalThis.fetch` wrapper for rejected network requests. The wrapper skips Sentry's own hostnames and expected AbortController cancellations, records sanitized URL, method, duration, and network-failure tags for other rejections, then rethrows the original error so callers keep their existing control flow [@sentry-runtime] [@network-errors]. The cancellation helper treats an aborted request signal, standard abort names and codes, nested causes, and Expo SDK 57's native "fetch request has been canceled" message as cancellation evidence, which keeps client-owned timeout control flow out of the global network-error stream [@network-errors] [@sentry-runtime]. HTTP responses with status 400 through 599 are captured by Sentry's HTTP client integration rather than this rejected-fetch wrapper [@sentry-runtime].

## Sanitization Boundary

Telemetry sanitization happens before events, breadcrumbs, handled-error contexts, and log attributes leave the app. The sanitizer removes request bodies, cookies, authorization-like headers, keys matching password/secret/token/api-key/Wilma-session patterns, query strings, URL fragments, and deep context beyond the configured depth; it also truncates long strings [@sentry-runtime]. This matters because Wilma and Supabase flows can contain credentials, session tokens, request URLs, and school data in error paths. Future instrumentation should pass structured tags and sanitized extras through `reportHandledError` or `reportHandledMessage` instead of calling Sentry directly from feature code [@sentry-runtime].

`AuthProvider` reports `supabase.auth.getSession()` failures and keeps Sentry user context in sync with the Supabase session id and email, clearing it when the session disappears [@auth-context]. That user context is useful for correlating authenticated failures, but it makes the sanitization boundary more important when adding extra auth or profile context [@auth-context] [@sentry-runtime].

## Feature Instrumentation

The Wilma GraphQL client reports invalid JSON or HTML responses, HTTP failures, GraphQL errors, missing data, retry state, authentication codes, and operation names before applying its one reauthentication retry or stale-session cleanup behavior [@graphql-client]. Wilma primary-auth exchange timeouts are reported in the auth broker instead, because those `/v1/auth/wilma/*` POSTs have a 45-second timeout and are not ordinary GraphQL reads [@wilma-auth-broker] [@network-errors]. This instrumentation belongs in the Wilma network boundaries because screens should not duplicate transport-level failure handling.

The BLE background entrypoint reports Android foreground-service runner exceptions, Android service-start failures, and iOS Core Bluetooth restoration failures through the same helpers [@ble-background-task]. The shared BLE tracking runtime reports snapshot persistence errors, hydrated-state errors, device-scan callback errors, and non-routine upload failures while preserving the runtime's local diagnostics and retry behavior [@ble-runtime]. This keeps [BLE background location](../location/ble-background-location) observable without splitting its single runtime ownership.

## Build And Verification Boundary

EAS profiles set `EXPO_PUBLIC_SENTRY_ENVIRONMENT` to `development`, `preview`, or `production`, while `.env.example` documents both the public Sentry DSN and the build-only `SENTRY_AUTH_TOKEN` placeholder [@eas-config] [@env-example]. `SENTRY_AUTH_TOKEN` is not a runtime public variable; it must be configured in the relevant EAS environments so source maps can upload during native builds [@env-example] [@sentry-rollout].

The Sentry rollout validated TypeScript, targeted ESLint, BLE tests, Android production bundling, JSON parsing, and diff checks, but it did not send a synthetic Sentry issue from a rebuilt app [@sentry-rollout]. Native Sentry components and source-map upload changes require a fresh development, preview, or production native build; hot refresh or an old installed client is not enough to prove ingestion and symbolication [@sentry-rollout].
