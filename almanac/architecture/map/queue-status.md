---
title: "Queue Status"
summary: "Queue status adds a Ruokalinjasto crowd-status layer to the map, backed by privacy-preserving anonymous samples, admin-only manual observations, and current-slot canteen reports."
topics: [architecture, map, queue, supabase, privacy]
sources:
  - id: queue-service
    type: file
    path: lib/queueService.ts
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
  - id: queue-grant-migration
    type: file
    path: supabase/migrations/20260812083900_restore_queue_status_execute_grant.sql
  - id: canteen-migration
    type: file
    path: supabase/migrations/20260812220708_canteen_reports_and_schedule_sync.sql
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
---

# Queue Status

Queue status is the OtaMaps "Vilkkaus" feature for showing the current Ruokalinjasto crowd level on the map. The client reads a safe aggregate from Supabase, highlights the configured room polygon, and shows a compact people-tab entry that opens a canteen modal for reporting, map focus, and the daily menu [@queue-service] [@map-route] [@canteen-modal]. Automatic estimates come from `anonymous_crowd_samples`, trusted administrators can record manual observations, and students can submit one identified canteen report per 15-minute lunch slot [@queue-migration] [@canteen-migration] [@location-service]. This keeps the map useful to all signed-in users while raw anonymous samples and raw identified reports stay behind RLS [@queue-migration] [@canteen-migration].

## Public Map Flow

The map route calls `getQueueStatuses()` through `lib/queueService.ts` and keeps the Ruokalinjasto status in route state [@queue-service] [@map-route]. The service first asks Supabase Auth for the current session and returns an empty list when no session exists, so startup or signed-out renders do not call the queue RPC as `anon` [@queue-service]. Every 30 seconds the route refreshes the queue status, builds a one-feature GeoJSON source when the queue area's floor matches the selected floor, and draws a fill layer plus a label reading `Vilkkaus` and the current queue label [@map-route]. The people tab header inside the map bottom sheet names Ruokalinjasto, uses the queue color/label helpers, disables itself until a queue status exists, and opens `CanteenStatusModal`; the modal can focus the queue area on the map through the same `focusQueueArea` path [@queue-service] [@map-route] [@canteen-modal].

The feature deliberately lives inside the existing map renderer. It reuses the same room geometry and floor filter described in [geospatial rendering](geospatial-rendering), so queue rendering should not introduce a second map, a separate coordinate model, or a room lookup path outside the current room data flow [@map-route].

## Status Sources

The database-managed queue configuration starts with one active area, `ruokalinjasto`, linked to the `rooms` row whose trimmed lowercase title is `ruokalinjasto` [@queue-migration]. `get_queue_statuses()` returns active areas for authenticated users and computes a status only during the weekday reporting window, 10:45-12:30 in `Europe/Helsinki` time [@canteen-migration]. Inside that window, a manual observation from the last 20 minutes wins, then the average of current-slot student reports, then the recent anonymous sample count from the same room within 10 minutes [@canteen-migration]. Automatic sample thresholds map 1-3 samples to level 2, 4-9 to level 3, 10-19 to level 4, and 20 or more to level 5; zero samples produce no status level [@canteen-migration].

Queue labels are fixed in the client as five Finnish levels: `Olematon`, `Lyhyt`, `Normaali`, `Pitkä`, and `Erittäin pitkä` [@queue-service]. The service type allows `manual`, `community`, `crowd`, and `none` sources, which lets the UI distinguish a fresh admin rating, current-slot student reports, an automatic activity estimate, or unavailable data [@queue-service].

## Canteen Reporting And Menu

`record_canteen_queue_report(input_level)` is the only normal write path for student canteen reports [@canteen-migration] [@queue-service]. It requires an authenticated user, rejects levels outside 1-5, rejects submissions outside weekdays 10:45-12:30 Helsinki time, resolves the active `ruokalinjasto` area, floors the current time into a 15-minute slot, and inserts or updates the caller's row for `(queue_area_id, user_id, slot_start)` [@canteen-migration]. The raw row in `canteen_queue_reports` is identified and private to its contributor through RLS, while the aggregate returned from `get_queue_statuses()` exposes only counts, the averaged level, whether the current user has reported in the slot, and the current user's contribution total [@canteen-migration] [@queue-service].

`canteen_contributor_stats` is a per-user counter maintained by a trigger after canteen report inserts [@canteen-migration]. The mobile modal displays `current_user_contributions` as "Sinun panoksesi yhteensä" and explains that reports are stored on the account for future automatic scoring, so any reliability-weighting change should preserve the private raw-report boundary and update this user-facing copy with the database behavior [@canteen-modal] [@canteen-migration].

The same modal fetches the daily Otaniemen lukio menu from Compass Group when it opens [@canteen-modal] [@canteen-menu]. `lib/canteenMenu.ts` downloads `https://www.compass-group.fi/ravintolat-ja-ruokalistat/amica/kaupungit/espoo/espoon-tietokyla/`, and `lib/canteenMenuCore.ts` extracts `window.__INITIAL_MENU__`, selects the Helsinki-date menu, and keeps packages whose title mentions Otaniemen lukio or whose sort order is one of the school lunch orders `1`, `72`, or `80` [@canteen-menu] [@canteen-menu-core]. The focused menu test covers JSON extraction, filtering out non-school packages, default Finnish section titles for sort orders `72` and `80`, and the null case for a day without a school menu [@canteen-menu-test].

## Admin Flow

The admin queue screen is under the authenticated Me stack at `app/(app)/me/admin/queue.tsx`, and the Me tab shows the `Jonotilanteen hallinta` link only when the client reads `users.role === "admin"` [@admin-screen] [@me-screen] [@me-layout]. That link is presentation only. The migration removes client write access to `users.role`, makes the role non-null with a `user|admin` check, and replaces the old public `is_admin(uuid)` helper with `private.is_admin()` using `auth.uid()` and a fixed empty `search_path` [@queue-migration].

Admins record observations by inserting only `queue_area_id` and `level` into `queue_observations` through `recordQueueObservation()` [@queue-service]. A trigger stamps `admin_user_id`, `observed_at`, and the 10-minute anonymous sample count server-side, and RLS allows observation reads and inserts only for `private.is_admin()` [@queue-migration]. New admins are therefore an operations task through trusted database access, not an app-side profile edit [@queue-migration] [@implementation-session].

## RPC Grants And Startup Races

The queue aggregate is not public. The grant-repair migration explicitly revokes all execution on `public.get_queue_statuses()` from `public` and `anon`, then grants execution only to `authenticated` and `service_role` [@queue-grant-migration]. This matches the client-side session guard in `getQueueStatuses()` and keeps the privacy boundary on the RPC instead of widening anonymous access to hide startup errors [@queue-service] [@queue-grant-migration].

The August 12, 2026 production update fixed a Sentry issue reported as `permission denied for function get_queue_statuses` by adding the authenticated-session guard before the RPC call and preparing the grant-repair migration for privilege drift [@queue-grant-session]. Future queue work should preserve both sides: anonymous clients should skip the RPC, and production database privileges should allow authenticated map sessions to execute it [@queue-service] [@queue-grant-migration].

## Privacy Boundary

Queue status uses anonymous analytics as an input, not as an identified attendance system. `BLELocationService.updateLocationFix()` inserts `anonymous_crowd_samples` only when anonymous analytics is enabled, and those rows omit user id, class, exact coordinates, and beacon ids [@location-service]. The queue RPCs expose aggregate status and activity counts, while raw anonymous sample rows remain unreadable to normal clients [@queue-migration].

Future queue work should preserve that distinction. The admin screen can show "anonyymiä sijaintinäytettä 10 minuutissa - ei henkilömäärä" because `get_admin_queue_activity()` returns a sample count, not a distinct-user estimate [@admin-screen] [@queue-migration]. Showing occupancy claims, per-person counts, or raw sample history would be a product and privacy change, not a small UI copy change.
