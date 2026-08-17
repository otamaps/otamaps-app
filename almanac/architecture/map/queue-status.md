---
title: "Queue Status"
summary: "Queue status adds a Ruokalinjasto crowd-status layer to the map, backed by privacy-preserving anonymous samples, admin-only manual observations, and current-slot canteen reports."
topics: [architecture, map, queue, supabase, privacy]
sources:
  - id: queue-service
    type: file
    path: lib/queueService.ts
  - id: queue-formatting-core
    type: file
    path: lib/queueFormattingCore.ts
  - id: map-route
    type: file
    path: app/(tabs)/map.tsx
  - id: admin-screen
    type: file
    path: app/(app)/me/admin/queue.tsx
  - id: me-screen
    type: file
    path: app/(tabs)/me.tsx
  - id: me-layout
    type: file
    path: app/(app)/me/_layout.tsx
  - id: queue-migration
    type: file
    path: supabase/migrations/20260808150006_secure_admin_and_ruokalinjasto_queue.sql
  - id: onboarding-migration
    type: file
    path: supabase/migrations/20260808105737_onboarding_and_consents.sql
  - id: queue-grant-migration
    type: file
    path: supabase/migrations/20260812083900_restore_queue_status_execute_grant.sql
  - id: canteen-migration
    type: file
    path: supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql
  - id: queue-config-migration
    type: file
    path: supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql
  - id: queue-formatting-test
    type: file
    path: tests/queueFormatting.test.cjs
  - id: canteen-modal
    type: file
    path: components/canteen/CanteenStatusModal.tsx
  - id: canteen-menu
    type: file
    path: lib/canteenMenu.ts
  - id: canteen-menu-core
    type: file
    path: lib/canteenMenuCore.ts
  - id: canteen-menu-test
    type: file
    path: tests/canteenMenu.test.cjs
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: implementation-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
  - id: queue-grant-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-40-23-019ff28e-0e0c-7383-be65-1ff5a35ceaa4.jsonl
  - id: queue-update-session
    type: conversation
    path: /Users/renesaarikko/.claude/projects/-Users-renesaarikko-projects-otamaps-app/c1468f0d-b2c5-43f9-9c68-4faee4065cb1.jsonl
---

# Queue Status

Queue status is the OtaMaps "Vilkkaus" feature for showing the current Ruokalinjasto crowd level on the map. The client reads a safe aggregate from Supabase, highlights the configured room polygon during the reporting window, and shows a compact people-tab entry that opens a canteen modal for reporting, map focus, and the daily menu [@queue-service] [@map-route] [@canteen-modal]. Automatic estimates come from `anonymous_crowd_samples`, trusted administrators can record manual observations, and students can submit one identified canteen report per 15-minute lunch slot [@onboarding-migration] [@queue-migration] [@canteen-migration] [@location-service]. This keeps the map useful to all signed-in users while raw anonymous samples and raw identified reports stay behind RLS [@onboarding-migration] [@queue-migration] [@canteen-migration].

## Public Map Flow

The map route calls `getQueueStatuses()` through `lib/queueService.ts` and keeps the Ruokalinjasto status in route state [@queue-service] [@map-route]. The service first asks Supabase Auth for the current session and returns an empty list when no session exists, so startup or signed-out renders do not call the queue RPC as `anon` [@queue-service]. Every 30 seconds the route refreshes the queue status, builds a one-feature GeoJSON source only when reporting is open and the queue area's floor matches the selected floor, and draws a fill layer plus a label reading `Vilkkaus` and the current queue label [@map-route]. Outside the reporting window, the bottom-sheet entry renders the configured window from the queue status and falls back to the old `arkisin 10.45–12.30` copy only when the database is still on the pre-configuration contract [@queue-service] [@queue-formatting-core] [@queue-formatting-test]. The people tab header inside the map bottom sheet names Ruokalinjasto, uses the queue color/label helpers, disables itself until a queue status exists, and opens `CanteenStatusModal`; the modal can focus the queue area on the map through the same `focusQueueArea` path [@queue-service] [@map-route] [@canteen-modal].

The feature deliberately lives inside the existing map renderer. It reuses the same room geometry and floor filter described in [geospatial rendering](geospatial-rendering), so queue rendering should not introduce a second map, a separate coordinate model, or a room lookup path outside the current room data flow [@map-route].

## Status Sources

The database-managed queue configuration starts with one active area, `ruokalinjasto`, linked to the `rooms` row whose trimmed lowercase title is `ruokalinjasto` [@queue-migration]. Migration `20260817002500` moves the reporting window, timezone, weekdays, slot length, community-report threshold, trust-weight cap, manual TTL, and crowd-sample window into `queue_area_config`, a side table keyed by `queue_area_id`, with defaults that preserve the original weekday 10:45-12:30 Helsinki window, 15-minute slots, one required community report, 20-minute manual TTL, and 10-minute crowd window [@queue-config-migration]. The side table is deliberate because the production `queue_areas`, `queue_observations`, and `get_admin_queue_activity()` objects were owned by `supabase_admin`, while `get_queue_statuses()`, `record_canteen_queue_report()`, and the canteen tables were owned by `postgres`; changing only `postgres`-owned objects avoided recreating a `SECURITY DEFINER` queue RPC under a more privileged owner [@queue-config-migration] [@queue-update-session]. `get_queue_statuses()` returns active areas for authenticated users and appends `schema_version`, next-slot, and configuration columns after the historical columns, so older installed clients keep reading the existing fields while newer clients can render configured copy and detect schema drift [@queue-config-migration] [@queue-service] [@queue-formatting-core]. Inside an open window, a fresh manual observation wins, then the current-slot community level when report count reaches `min_community_reports`, then the recent anonymous sample count from the same room [@queue-config-migration]. Automatic sample thresholds map 1-3 samples to level 2, 4-9 to level 3, 10-19 to level 4, and 20 or more to level 5; zero samples produce no status level [@queue-config-migration].

Queue labels are fixed in the client as five Finnish levels: `Olematon`, `Lyhyt`, `Normaali`, `Pitkä`, and `Erittäin pitkä` [@queue-service]. The service type allows `manual`, `community`, `crowd`, and `none` sources, which lets the UI distinguish a fresh admin rating, current-slot student reports, an automatic activity estimate, or unavailable data [@queue-service].

## Canteen Reporting And Menu

`record_canteen_queue_report(input_level)` remains the compatibility write path for already-installed app builds, and `record_canteen_queue_report(input_level, area_slug)` is the area-aware write path used once a status row proves the schema-version-2 contract is live [@queue-config-migration] [@queue-service]. Both require an authenticated user, reject levels outside 1-5, reject submissions outside the area's configured reporting window, floor the current time through `private.queue_slot_state(...)`, and insert or update the caller's row for `(queue_area_id, user_id, slot_start)` [@queue-config-migration]. The raw row in `canteen_queue_reports` is identified and private to its contributor through RLS, while the aggregate returned from `get_queue_statuses()` exposes only counts, weighted status, whether the current user has reported in the slot, and the current user's contribution total [@queue-config-migration] [@queue-service].

`canteen_contributor_stats` is a per-user counter maintained by a trigger after canteen report inserts, not after same-slot corrections [@canteen-migration]. Updating the caller's current slot changes the raw report row but does not add another contribution count [@canteen-migration]. The schema-version-2 aggregate weights community reports with `private.canteen_report_weight(contribution_count, trust_weight_cap)`, where cap `1` disables trust weighting and higher caps let experienced reporters affect the rounded community average more [@queue-config-migration]. The mobile modal displays `current_user_contributions` as "Sinun panoksesi yhteensä" and explains that repeated reports increase the weight of the user's future community reports, so any reliability-weighting change should preserve the private raw-report boundary and update this user-facing copy with the database behavior [@canteen-modal] [@queue-config-migration].

The same modal fetches the daily Otaniemen lukio menu from Compass Group when it opens [@canteen-modal] [@canteen-menu]. `lib/canteenMenu.ts` downloads `https://www.compass-group.fi/ravintolat-ja-ruokalistat/amica/kaupungit/espoo/espoon-tietokyla/`, and `lib/canteenMenuCore.ts` extracts `window.__INITIAL_MENU__`, selects the Helsinki-date menu, and keeps packages whose title mentions Otaniemen lukio or whose sort order is one of the school lunch orders `1`, `72`, or `80` [@canteen-menu] [@canteen-menu-core]. The focused menu test covers JSON extraction, filtering out non-school packages, default Finnish section titles for sort orders `72` and `80`, and the null case for a day without a school menu [@canteen-menu-test].

## Admin Flow

The admin queue screen is under the authenticated Me stack at `app/(app)/me/admin/queue.tsx`, and the Me tab shows the `Jonotilanteen hallinta` link only when the client reads `users.role === "admin"` [@admin-screen] [@me-screen] [@me-layout]. That link is presentation only. The migration removes client write access to `users.role`, makes the role non-null with a `user|admin` check, and replaces the old public `is_admin(uuid)` helper with `private.is_admin()` using `auth.uid()` and a fixed empty `search_path` [@queue-migration]. The admin activity RPC keeps the historical `sample_count_10m` column name but appends `window_minutes`, because the crowd-sample window is now configured per queue area [@queue-config-migration] [@queue-service].

Admins record observations by inserting only `queue_area_id` and `level` into `queue_observations` through `recordQueueObservation()` [@queue-service]. A trigger stamps `admin_user_id`, `observed_at`, and the 10-minute anonymous sample count server-side, and RLS allows observation reads and inserts only for `private.is_admin()` [@queue-migration]. New admins are therefore an operations task through trusted database access, not an app-side profile edit [@queue-migration] [@implementation-session].

## RPC Grants And Startup Races

The queue aggregate is not public. The grant-repair migration explicitly revokes all execution on `public.get_queue_statuses()` from `public` and `anon`, then grants execution only to `authenticated` and `service_role` [@queue-grant-migration]. The configuration migration repeats that exact grant check for `get_queue_statuses()`, `get_admin_queue_activity()`, and both canteen-report RPC signatures, and aborts if `anon` can execute those functions or read queue tables [@queue-config-migration]. This matches the client-side session guard in `getQueueStatuses()` and keeps the privacy boundary on the RPC instead of widening anonymous access to hide startup errors [@queue-service] [@queue-grant-migration] [@queue-config-migration].

The August 12, 2026 production update fixed a Sentry issue reported as `permission denied for function get_queue_statuses` by adding the authenticated-session guard before the RPC call and preparing the grant-repair migration for privilege drift [@queue-grant-session]. Future queue work should preserve both sides: anonymous clients should skip the RPC, and production database privileges should allow authenticated map sessions to execute it [@queue-service] [@queue-grant-migration].

The August 17, 2026 deployment verified that PostgREST reloaded the queue schema at 10:59:26 UTC, cached six RPCs, kept `supabase-rest` and `supabase-db` healthy, and still denied anonymous execution of `get_queue_statuses()` plus direct reads of `queue_area_config` with `42501` [@queue-update-session]. Treat those as dated production checks for the deployed migration, not as permission to expose the raw configuration table.

## Privacy Boundary

Queue status uses anonymous analytics as an input, not as an identified attendance system. `BLELocationService.updateLocationFix()` inserts `anonymous_crowd_samples` only when anonymous analytics is enabled, and those rows omit user id, class, exact coordinates, and beacon ids [@location-service]. The table has an insert-time prune trigger that deletes rows older than two hours, and the queue RPCs expose aggregate status and activity counts while raw anonymous sample rows remain unreadable to normal clients [@onboarding-migration] [@queue-migration].

Future queue work should preserve that distinction. The admin screen can show "anonyymiä sijaintinäytettä 10 minuutissa - ei henkilömäärä" because `get_admin_queue_activity()` returns a sample count, not a distinct-user estimate [@admin-screen] [@queue-migration]. Showing occupancy claims, per-person counts, or raw sample history would be a product and privacy change, not a small UI copy change.
