---
title: "Server Deployment"
summary: "Use this guide when preparing or verifying the self-hosted Supabase and OtaMaps Wilma API deployment that the mobile client expects."
topics: [guides, deployment, supabase, wilma, configuration]
sources:
  - id: deployment-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
  - id: cutover-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/10/rollout-2026-08-10T17-50-29-019fec27-5ab5-7382-9a46-d5688210c318.jsonl
  - id: google-auth-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-13-03-019ff275-0483-77d1-946f-cbe15fb6eee3.jsonl
  - id: wilma-schema-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-40-23-019ff28e-0e0c-7383-be65-1ff5a35ceaa4.jsonl
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
  - id: shared-schedule-migration
    type: file
    path: supabase/migrations/20260811232612_share_weekly_schedule_with_friends.sql
  - id: room-wilma-link-session
    type: conversation
    path: /Users/renesaarikko/.claude/projects/-Users-renesaarikko-projects-otamaps-app/abcc29d5-7f33-499d-a898-7e79cd83a0a8.jsonl
  - id: peak-load-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/13/rollout-2026-08-13T20-13-37-019ffc1d-78cd-73a3-bd4b-4c076390bf16.jsonl
  - id: algolia-db-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/14/rollout-2026-08-14T10-59-09-019fff48-3236-78c2-83b3-63e844bbbe49.jsonl
  - id: queue-config-migration
    type: file
    path: supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql
  - id: queue-migration-script
    type: file
    path: scripts/deploy-queue-migration.sh
  - id: queue-update-session
    type: conversation
    path: /Users/renesaarikko/.claude/projects/-Users-renesaarikko-projects-otamaps-app/c1468f0d-b2c5-43f9-9c68-4faee4065cb1.jsonl
---

# Server Deployment

Use this guide when preparing or verifying the server side that OtaMaps needs in production. This repository is the Expo mobile client, not the Wilma GraphQL server; the client expects one OtaMaps API origin for Wilma GraphQL and Wilma-to-Supabase account exchange, and a separate Supabase origin for Auth, REST, Realtime, Storage, and Postgres [@wilma-graphql-client] [@wilma-auth-broker] [@supabase-client]. The latest recorded self-hosting cutover moved production Supabase and the Wilma API onto `fablabserver` behind Cloudflare Tunnel, with public traffic on `https://db.otamaps.fi` and `https://api.otamaps.fi` [@cutover-session].

## Deployment Boundary

The mobile app builds its Wilma GraphQL endpoint by taking `EXPO_PUBLIC_OTAMAPS_API_URL`, defaulting to `https://api.otamaps.fi`, trimming a trailing slash, and appending `/graphql` [@wilma-graphql-client]. Authenticated GraphQL requests add the stored Wilma session token as the `X-Wilma-Session` header [@wilma-graphql-client].

The same OtaMaps API origin owns the Wilma account exchange endpoints. The client posts to `/v1/auth/wilma/start`, `/v1/auth/wilma/create`, and `/v1/auth/wilma/link-legacy`; the link endpoint requires the current Supabase access token in the `Authorization` header [@wilma-auth-broker]. These endpoints are custom OtaMaps API routes, not Supabase's database GraphQL API [@deployment-session] [@wilma-graphql-client] [@wilma-auth-broker].

Supabase remains the mobile session and data authority. The client reads `EXPO_PUBLIC_SUPABASE_URL`, then falls back to `https://db.otamaps.fi`; for the public client key it reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY` [@supabase-client]. `.env.example` documents the split as `EXPO_PUBLIC_SUPABASE_URL` for authentication, beacons, and location sharing, and `EXPO_PUBLIC_OTAMAPS_API_URL` for GraphQL plus the Wilma-to-Supabase auth exchange [@env-example].

## Server Shape

The production shape recorded in the cutover keeps the private service ports loopback-only and routes public traffic through Cloudflare Tunnel [@cutover-session]. Keep Supabase/Kong on `127.0.0.1:8000` and the Wilma API on `127.0.0.1:4000`; do not expose Postgres `5432`, Supavisor `6543`, the Supabase gateway, or the OtaMaps GraphQL container port directly to the internet [@cutover-session].

Keep the hostname split explicit:

| Hostname | Backend |
| --- | --- |
| `api.otamaps.fi` | OtaMaps API container that implements `/graphql` and `/v1/auth/wilma/*` [@wilma-graphql-client] [@wilma-auth-broker]. |
| `db.otamaps.fi` | Supabase Auth, REST, Realtime, Storage, and Postgres gateway, matching `EXPO_PUBLIC_SUPABASE_URL` in mobile builds [@supabase-client] [@env-example] [@eas-config]. |
| `supa.otamaps.fi` | Supabase Studio route through the same Kong gateway, protected by HTTP Basic Auth before Studio loads [@wilma-schema-session]. |

EAS profiles currently set `https://db.otamaps.fi` for Supabase and `https://api.otamaps.fi` for the OtaMaps API in development, preview, and production [@eas-config]. If the deployment moves either service to a different hostname, update and verify the relevant EAS profile values together with [runtime and build config](../../reference/configuration/runtime-and-build-config).

## Cutover State

The August 10, 2026 cutover recorded migration parity for 536 Auth users, 606 sessions, 6,062 refresh tokens, public table row counts, two Storage objects, 39 public RLS policies, and ownership/function fingerprints [@cutover-session]. The run preserved target-only Postgres and dashboard credentials while migrating production Google Auth and Wilma API configuration [@cutover-session].

Public probes in the cutover passed for Supabase Auth health, Supabase REST, OtaMaps API `/health`, and GraphQL `{ __typename }` on the production hostnames [@cutover-session]. The recorded stress test is a lightweight endpoint result, not a maximum-user claim: at 128 concurrent health requests Autocannon reached about 727 requests per second with p97.5 latency around 274 ms and zero errors, while 256 concurrent requests flattened throughput and raised p97.5 latency to about 607 ms [@cutover-session].

Treat the cutover as proof for the recorded lightweight workloads only. Any later capacity claim needs representative authenticated GraphQL, REST, Realtime, Storage, and database workloads with user think-time, and should monitor the recorded cold Kong first-use outlier separately from warmed latency [@cutover-session].

The later August 13, 2026 peak-load repair changed the live PostgREST headroom rather than the mobile schema: the recorded state after the repair was 20 PostgREST connections, a 300 second idle lifetime, healthy `supabase-rest`, public API health HTTP 200, and 100 REST requests at concurrency 20 returning 100 HTTP 200 responses with median 117 ms and p95 531 ms [@peak-load-session]. Treat that as a dated production observation. Re-check the effective container config and a representative authenticated workload before relying on it for a new capacity claim [@peak-load-session].

## External Database Connectors

The public Supabase hostname is an HTTPS API gateway, not a PostgreSQL endpoint for third-party database connectors. On August 14, 2026, direct checks for an Algolia Supabase connector setup found that `db.otamaps.fi` only exposed `443` publicly and that the conventional Supabase pooler ports `6543` and `5432` timed out [@algolia-db-session]. That result matches the deployment boundary above: PostgreSQL and Supavisor stay private behind the server and Cloudflare Tunnel, while the mobile app uses Supabase over the public HTTPS API [@cutover-session] [@supabase-client].

For Algolia or a similar connector that expects a raw PostgreSQL connection, do not point the connector at `https://db.otamaps.fi` and do not publish `5432` or `6543` broadly just to satisfy the dashboard form [@algolia-db-session]. The safer OtaMaps pattern is an internal synchronization job that reads the local database or a restricted view from the server side and pushes records to the external index [@algolia-db-session]. If a raw database endpoint must be exposed, make that a deliberate production-network change: use TLS, a dedicated read-only role restricted to the needed table or view, and provider-specific source restrictions before handing credentials to the connector [@algolia-db-session].

## Migration And Recovery Gotchas

Postgres 17 can look healthy at the container level while the database is unusable. The cutover hit `could not open file "global/pg_filenode.map": Permission denied` when a Postgres 17 container running as UID 100 read data owned by UID 105; the recovery path was a cold backup, ownership repair, and authenticated SQL plus API probes rather than relying on `docker compose ps` [@cutover-session].

Supabase Storage's file backend uses extended attributes for object metadata. Ordinary tar extraction caused `ENODATA`; restore Storage files with GNU tar extended attributes, for example `tar --xattrs --xattrs-include='*'`, before treating Storage parity as complete [@cutover-session].

Cloudflare Tunnel ingress for this deployment is remotely managed. Local `cloudflared` ingress edits may have no effect when pushed Cloudflare Zero Trust configuration wins, so hostname changes must be made in Cloudflare Zero Trust and must preserve existing `supa.otamaps.fi` and `ssh.otamaps.fi` routes [@cutover-session].

When DNS or HTTPS looks inconsistent, compare authoritative DNS, DNS-over-HTTPS, forced-edge requests with `curl --resolve`, and normal HTTPS before concluding that a hostname is unavailable [@cutover-session]. Public process health alone is also too shallow: always include authenticated SQL plus Auth, REST, Storage, API health, and GraphQL probes in release verification [@cutover-session].

Access to `fablabserver` is an operational dependency, not a mobile build detail. The August 11, 2026 release work repeatedly found healthy public API responses while backend deployment was blocked by Tailscale timeouts or rejected SSH credentials, so a mobile OTA can be live while the matching Wilma API field is still undeployed [@wilma-schema-session]. The later queue deployment used Cloudflare Access SSH instead of raw TCP: connect as `fablab@ssh.otamaps.fi` with `ProxyCommand=cloudflared access ssh --hostname %h`, then run SQL inside `supabase-db` with `docker exec -i supabase-db psql -U postgres -d postgres` [@queue-migration-script] [@queue-update-session].

Do not diagnose every `ssh.otamaps.fi` failure as a server outage. The August 17, 2026 queue deployment hit a local resolver failure where normal DNS lookup failed while DNS-over-HTTPS to `1.1.1.1` still resolved the hostname; that points to the local resolver path, not the tunnel or database host [@queue-update-session]. Check DNS-over-HTTPS, normal DNS, and the Cloudflare Access SSH path separately before reporting restored server access as blocked.

PostgREST write probes need readback verification. During the August 13, 2026 room-to-Wilma backfill, an anonymous PATCH with an impossible zero-row filter returned `HTTP 200 []`, and later real PATCH attempts also returned empty arrays because the anon role could not update the rows through RLS [@room-wilma-link-session]. Do not read `200 []` as "writes are allowed"; it can mean no visible row matched or no row was updated. For production data corrections, apply the SQL through Studio or host-side `psql`, then verify the exact rows and aggregate invariants through REST or SQL readback [@room-wilma-link-session].

Queue-status schema changes have their own host-side helper. `scripts/deploy-queue-migration.sh` streams `supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql` through Cloudflare Access SSH to `fablab@ssh.otamaps.fi`, runs it in the `supabase-db` container with `psql -v ON_ERROR_STOP=1`, and supports `--dry-run` by removing the final PostgREST schema-cache notify and replacing the commit with `rollback` [@queue-migration-script] [@queue-config-migration]. Run `./scripts/deploy-queue-migration.sh --dry-run` first, then run the same script without the flag only after the dry run succeeds [@queue-migration-script]. The migration is transactional and contains a post-migration privilege check for the queue RPCs, so a grant regression aborts the transaction instead of leaving the queue contract half-applied [@queue-config-migration].

The August 17, 2026 queue update did reach production after the access issue was resolved. The deployment verified `queue_area_config` defaults, six PostgREST RPCs after `notify pgrst, 'reload schema'`, healthy `supabase-rest` and `supabase-db` containers, anonymous `42501` denial for `get_queue_statuses()`, and direct `42501` denial for `queue_area_config` reads [@queue-update-session]. The production database does not expose a usable `supabase_migrations.schema_migrations` ledger for this workflow, so answer "is it applied?" by inspecting the live schema, RPC signatures, grants, row counts, and PostgREST schema cache instead of relying on a migrations table [@queue-update-session].

## Supabase Studio Access

`supa.otamaps.fi` is not an OtaMaps user login, Supabase Auth login, or SSH credential surface. It is the self-hosted Supabase Studio route, and the live incident on August 13, 2026 verified that the Studio gateway accepted the configured HTTP Basic Auth credentials while deliberately wrong credentials returned 401 responses [@wilma-schema-session].

The Studio Basic Auth username is `supabase`; the password comes from the active deployment's `DASHBOARD_PASSWORD` in `/home/fablab/supabase-project/.env` [@wilma-schema-session]. Do not trust a matching value found only in an older checkout such as `/home/fablab/supabase`; that stale copy can explain why a password appears correct but has no effect on the live gateway [@wilma-schema-session].

Rotating the Studio password is a gateway operation. Update only the active stack's `.env`, create a timestamped backup first, recreate the `kong` service so the container receives the new value, and then verify the public Studio URL with the `supabase` username until it redirects into `/project/default` rather than returning 401 [@wilma-schema-session]. After a Kong recreate, also probe Supabase Auth and REST through `db.otamaps.fi` so a Studio credential repair does not silently break mobile traffic [@wilma-schema-session]. Never record a shared Studio password in the wiki; if a password was pasted into a chat, rotate to a new value rather than preserving it as operational reference material.

## Self-Hosted Google Auth

For self-hosted Supabase Auth, the Google OAuth redirect URI belongs to the public Auth origin: `https://db.otamaps.fi/auth/v1/callback` [@google-auth-session]. The live server must set `API_EXTERNAL_URL=https://db.otamaps.fi/auth/v1`, pass `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` as `${API_EXTERNAL_URL}/callback`, and configure the provider with the app's Google Web client id first in the comma-separated client id list [@google-auth-session]. A mismatch between the app's Web client id and the Auth container's Google client id causes `signInWithIdToken()` to reject otherwise valid Google tokens [@google-auth-session].

OtaMaps' current iOS Google Sign-In path uses `@react-native-google-signin/google-signin@15`, whose free API does not expose the nonce generated by the iOS SDK [@google-auth-session]. The deployed workaround is provider-specific `GOOGLE_SKIP_NONCE_CHECK=true` passed to Auth as `GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK`; the transcript verified that the similarly named non-provider-specific setting did not affect this Supabase configuration [@google-auth-session]. This weakens Google ID-token replay protection, so treat browser OAuth with PKCE or a nonce-capable Google Sign-In implementation as the stronger long-term fix [@google-auth-session].

Android `DEVELOPER_ERROR` can happen before Supabase receives a request. The August 11 diagnosis tied that error to missing Android OAuth credentials for package `fi.otamaps.app` and the relevant signing SHA-1, while keeping `GoogleSignin.configure()` pointed at the Web client id [@google-auth-session]. Create separate Android OAuth clients for each signing context, including EAS development/production and Play App Signing when applicable [@google-auth-session].

## Wilma API Schema Deployment

Backend schema drift is a first-class release gate for Wilma work. On August 11, 2026, public `/health` and basic GraphQL probes were healthy, but the production API rejected app queries such as `messages(folder: MessageFolder!)` until the full-schema image `otamaps/wilma-api:f2de54a-full-20260812` was deployed [@wilma-schema-session]. The successful deployment kept a rollback image, verified the container was healthy with zero restarts, and then ran credentialed GraphQL login plus every app read endpoint before declaring production Wilma login fixed [@wilma-schema-session].

Use that shape for future Wilma API changes: test the sibling backend build and suite, deploy the image with rollback retained, verify `/health`, run a live authenticated read sweep across the exact app operations, and log out temporary Wilma and Supabase sessions afterward [@wilma-schema-session]. Do not execute message-sending, reply, course-selection, or other Wilma mutations merely to prove schema availability unless the user explicitly approves that operation.

## Supabase Installer TLS Failure

During the deployment discussion, the Supabase installer failed with `curl 60 ssl certificate problem unable to get local issuer certificate`, and the direct raw GitHub installer URL failed the same way [@deployment-session]. Treat that symptom as an Ubuntu or network trust-store problem, not as proof that the Supabase installer URL is wrong [@deployment-session].

Do not use `curl -k` for the installer. First check which `curl` binary and CA bundle are in use, clear CA override environment variables such as `SSL_CERT_FILE`, `SSL_CERT_DIR`, `CURL_CA_BUNDLE`, and `REQUESTS_CA_BUNDLE`, and test `/usr/bin/curl --cacert /etc/ssl/certs/ca-certificates.crt` against the raw Supabase Docker installer URL [@deployment-session]. If the failure remains, reinstall and refresh Ubuntu's `ca-certificates`, `openssl`, and `curl` packages, then inspect the certificate issuer with `openssl s_client` to distinguish a broken local CA bundle from TLS interception [@deployment-session].

## Schedule-Sharing Schema Release

Schedule sharing is a Supabase schema release as much as a mobile feature. The August 12, 2026 production incident showed the failure mode: the client correctly reported the feature unavailable because `shared_weekly_schedules` and `user_preferences.schedule_sharing_enabled` were missing from the live database, even though the app bundle and the public service health checks were otherwise healthy [@wilma-schema-session]. The fix was to apply the already committed migration, reload PostgREST's schema cache with `notify pgrst, 'reload schema'`, and then verify the exact REST surfaces and RLS behavior the app uses [@wilma-schema-session].

For a future schedule-sharing rollout, prove all of these before calling the server side done: an authenticated `user_preferences` REST query can read `schedule_sharing_enabled`, an authenticated `shared_weekly_schedules` REST query returns HTTP 200, the owner role can enable sharing and upsert the current-week snapshot, an accepted friend can read that row, and an unrelated authenticated user cannot read it [@wilma-schema-session] [@shared-schedule-migration]. Keep the privacy boundary explicit during recovery: backend tests may use rolled-back transactions or temporary sessions, but operators should not leave the user's own `schedule_sharing_enabled` flag enabled unless the user has made that consent choice [@wilma-schema-session].

## Release Proof

Do not call a server deployment complete from local mobile checks alone. The mobile repo can prove that it points at the expected public URLs, but release proof also needs the OtaMaps API container running, Wilma GraphQL requests succeeding through `/graphql`, Wilma account exchange producing a valid Supabase session, Supabase migrations/data restored or created in the target project, private Storage object contents transferred, Google Auth configured and live-tested, and EAS profile values matching the deployed hostnames [@deployment-session] [@wilma-graphql-client] [@wilma-auth-broker] [@supabase-client] [@eas-config] [@google-auth-session]. For new Supabase tables, include a public REST/Data API probe for the exact table the client uses; the August 11 schedule-sharing release gate was a `PGRST205` response for missing `shared_weekly_schedules`, even though production native builds and bundle exports were healthy [@wilma-schema-session]. Use [EAS production build](eas-production-build) for the native archive, bundle, and remote-build proof that sits on top of this server checklist.
