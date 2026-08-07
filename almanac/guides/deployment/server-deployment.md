---
title: "Server Deployment"
summary: "Use this guide when preparing an Ubuntu Docker deployment for the OtaMaps API and Supabase services that the mobile client expects."
topics: [guides, deployment, supabase, wilma, configuration]
sources:
  - id: deployment-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
  - id: wilma-graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: supabase-client
    type: file
    path: lib/supabase.ts
  - id: env-example
    type: file
    path: .env.example
  - id: eas-config
    type: file
    path: eas.json
---

# Server Deployment

Use this guide when preparing the server side that OtaMaps needs in production. This repository is the Expo mobile client, not the Wilma GraphQL server; the client expects one OtaMaps API origin for Wilma GraphQL and Wilma-to-Supabase account exchange, and a separate Supabase origin for Auth, REST, Realtime, Storage, and Postgres [@deployment-session] [@wilma-graphql-client] [@wilma-auth-broker] [@supabase-client]. The first self-hosted deployment was brought up on AWS Lightsail as an interim Ubuntu Docker host with HTTPS `sslip.io` names for API and Supabase while final domain cutover remains separate [@deployment-session].

## Deployment Boundary

The mobile app builds its Wilma GraphQL endpoint by taking `EXPO_PUBLIC_OTAMAPS_API_URL`, defaulting to `https://api.otamaps.fi`, trimming a trailing slash, and appending `/graphql` [@wilma-graphql-client]. Authenticated GraphQL requests add the stored Wilma session token as the `X-Wilma-Session` header [@wilma-graphql-client].

The same OtaMaps API origin owns the Wilma account exchange endpoints. The client posts to `/v1/auth/wilma/start`, `/v1/auth/wilma/create`, and `/v1/auth/wilma/link-legacy`; the link endpoint requires the current Supabase access token in the `Authorization` header [@wilma-auth-broker]. These endpoints are custom OtaMaps API routes, not Supabase's database GraphQL API [@deployment-session] [@wilma-graphql-client] [@wilma-auth-broker].

Supabase remains the mobile session and data authority. The client reads `EXPO_PUBLIC_SUPABASE_URL`, then falls back to the committed hosted Supabase project URL, and reads `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY` for the public key [@supabase-client]. `.env.example` documents the split as `EXPO_PUBLIC_SUPABASE_URL` for authentication, beacons, and location sharing, and `EXPO_PUBLIC_OTAMAPS_API_URL` for GraphQL plus the Wilma-to-Supabase auth exchange [@env-example].

## Server Shape

The discussed first deployment target was a single Ubuntu 24.04 LTS server with Docker Compose, HTTPS through Caddy, and only SSH, HTTP, and HTTPS exposed publicly [@deployment-session]. Do not expose Postgres `5432`, Supavisor `6543`, the Supabase gateway `8000`, or the OtaMaps GraphQL container port directly to the internet; route public traffic through HTTPS hostnames instead [@deployment-session].

Keep the hostname split explicit:

| Hostname | Backend |
| --- | --- |
| `api.otamaps.fi` | OtaMaps API container that implements `/graphql` and `/v1/auth/wilma/*` [@wilma-graphql-client] [@wilma-auth-broker]. |
| Supabase URL | Supabase Auth, REST, Realtime, Storage, and Postgres, matching `EXPO_PUBLIC_SUPABASE_URL` in mobile builds [@supabase-client] [@env-example] [@eas-config]. |

EAS profiles currently set the canonical hosted Supabase project URL and `https://api.otamaps.fi` for development, preview, and production [@eas-config]. If the deployment moves Supabase from the hosted project to a self-hosted hostname, update and verify the relevant EAS profile values together with [runtime and build config](../../reference/configuration/runtime-and-build-config).

## Interim Lightsail State

The August 7 deployment session verified AWS Lightsail instance `otamaps-prod-1` in `eu-north-1` as running, `https://api.13-62-117-118.sslip.io/health` as returning `{"status":"ok"}`, `https://api.13-62-117-118.sslip.io/graphql` as answering `{ __typename }`, and `https://supabase.13-62-117-118.sslip.io/` as reachable with HTTP `401` because Studio is protected [@deployment-session]. That state proves public process health and routing, not final production cutover.

The same session cloned database schema/data, Auth metadata, RLS, and Storage metadata into the target and verified disposable Auth and Storage create/read/delete flows there [@deployment-session]. Two private Storage object bodies and the Google Auth provider secret were still missing because they are not recoverable through the PostgreSQL connection alone, and the run intentionally stopped at the Supabase dashboard authentication boundary instead of extracting an end-user session or weakening Storage policies [@deployment-session].

Treat this as an operational checkpoint. Resuming the migration should start from Supabase dashboard sign-in, copy the remaining private Storage bytes and Google provider configuration through authorized provider surfaces, verify Google login against the target, run a point-in-time resynchronization, and only then update EAS/profile hostnames or DNS for real client traffic [@deployment-session] [@eas-config].

## Supabase Installer TLS Failure

During the deployment discussion, the Supabase installer failed with `curl 60 ssl certificate problem unable to get local issuer certificate`, and the direct raw GitHub installer URL failed the same way [@deployment-session]. Treat that symptom as an Ubuntu or network trust-store problem, not as proof that the Supabase installer URL is wrong [@deployment-session].

Do not use `curl -k` for the installer. First check which `curl` binary and CA bundle are in use, clear CA override environment variables such as `SSL_CERT_FILE`, `SSL_CERT_DIR`, `CURL_CA_BUNDLE`, and `REQUESTS_CA_BUNDLE`, and test `/usr/bin/curl --cacert /etc/ssl/certs/ca-certificates.crt` against the raw Supabase Docker installer URL [@deployment-session]. If the failure remains, reinstall and refresh Ubuntu's `ca-certificates`, `openssl`, and `curl` packages, then inspect the certificate issuer with `openssl s_client` to distinguish a broken local CA bundle from TLS interception [@deployment-session].

## Release Proof

Do not call a server deployment complete from local mobile checks alone. The mobile repo can prove that it points at the expected public URLs, but release proof also needs the OtaMaps API container running, Wilma GraphQL requests succeeding through `/graphql`, Wilma account exchange producing a valid Supabase session, Supabase migrations/data restored or created in the target project, private Storage object contents transferred, Google Auth configured and live-tested, and EAS profile values matching the deployed hostnames [@deployment-session] [@wilma-graphql-client] [@wilma-auth-broker] [@supabase-client] [@eas-config].
