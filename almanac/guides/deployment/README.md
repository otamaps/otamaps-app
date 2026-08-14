---
title: "Deployment Guides"
summary: "Deployment guides route OtaMaps release work between native EAS builds, EAS Updates, server-side Supabase and Wilma API deployment, and configuration lookup."
topics: [guides, deployment, configuration, mobile]
sources:
  - id: app-config
    type: file
    path: app.json
  - id: eas-config
    type: file
    path: eas.json
  - id: wilma-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: supabase-client
    type: file
    path: lib/supabase.ts
---

# Deployment Guides

Deployment work in OtaMaps splits by the boundary being changed. Native dependency, permission, plugin, identifier, and version-code changes belong to [EAS production build](eas-production-build), JavaScript and TypeScript fixes that match the installed `runtimeVersion` belong to [EAS production update](eas-production-update), and Supabase or Wilma API changes belong to [server deployment](server-deployment) [@app-config] [@eas-config] [@wilma-client] [@wilma-auth-broker] [@supabase-client].

## Choose The Guide

Use [EAS production build](eas-production-build) when a release needs a new native binary. `app.json` owns the current runtime, native identifiers, permissions, Expo plugins, and update URL, while `eas.json` owns the production channel, environment, and store-build profile [@app-config] [@eas-config].

Use [EAS production update](eas-production-update) when the change can be delivered as an OTA bundle to installed production-channel binaries with the same runtime version [@app-config] [@eas-config]. Start by inspecting the dirty tree because EAS Update publishes the current bundle state, not only selected files.

Use [server deployment](server-deployment) when the release depends on `https://api.otamaps.fi`, `https://db.otamaps.fi`, Supabase migrations, Wilma GraphQL schema support, Google Auth configuration, Storage, or production data correction [@wilma-client] [@wilma-auth-broker] [@supabase-client]. Local mobile checks do not prove that those provider and server boundaries are live.

Use [runtime and build config](../../reference/configuration/runtime-and-build-config) as the lookup reference before changing public environment variables, build profiles, Sentry configuration, native permissions, runtime versioning, or provider hostnames.
