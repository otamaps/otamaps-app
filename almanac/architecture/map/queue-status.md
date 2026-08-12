---
title: "Queue Status"
summary: "Queue status adds a Ruokalinjasto crowd-status layer to the map, backed by privacy-preserving anonymous samples and admin-only manual observations."
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
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: implementation-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
  - id: map-ui-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/09/rollout-2026-08-09T01-56-35-019fe397-a8b7-7ea0-ac45-84bdfaa1f182.jsonl
  - id: queue-grant-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-40-23-019ff28e-0e0c-7383-be65-1ff5a35ceaa4.jsonl
---

# Queue Status

Queue status is the OtaMaps "Vilkkaus" feature for showing the current Ruokalinjasto crowd level on the map. The client reads a safe aggregate from Supabase, highlights the configured room polygon, and shows a compact people-tab entry for focusing the queue area [@queue-service] [@map-route] [@map-ui-session]. Automatic estimates come from `anonymous_crowd_samples`, while trusted administrators can record append-only manual observations that override the automatic estimate for a short window [@queue-migration] [@location-service]. This keeps the map useful to all signed-in users without exposing raw anonymous samples or treating sample counts as people counts.

## Public Map Flow

The map route calls `getQueueStatuses()` through `lib/queueService.ts` and keeps the Ruokalinjasto status in route state [@queue-service] [@map-route]. The service first asks Supabase Auth for the current session and returns an empty list when no session exists, so startup or signed-out renders do not call the queue RPC as `anon` [@queue-service]. Every 30 seconds the route refreshes the queue status, builds a one-feature GeoJSON source when the queue area's floor matches the selected floor, and draws a fill layer plus a label reading `Vilkkaus` and the current queue label [@map-route]. The people tab header inside the map bottom sheet names Ruokalinjasto, uses the queue color/label helpers, disables itself until a queue status exists, focuses the queue area when pressed, and snaps the sheet to its minimum height so the map overlay stays visible [@queue-service] [@map-route].

The feature deliberately lives inside the existing map renderer. It reuses the same room geometry and floor filter described in [geospatial rendering](geospatial-rendering), so queue rendering should not introduce a second map, a separate coordinate model, or a room lookup path outside the current room data flow [@map-route].

## Status Sources

The database-managed queue configuration starts with one active area, `ruokalinjasto`, linked to the `rooms` row whose trimmed lowercase title is `ruokalinjasto` [@queue-migration]. `get_queue_statuses()` returns active areas for authenticated users and computes a status from either the newest manual observation within 20 minutes or the recent anonymous sample count from the same room within 10 minutes [@queue-migration]. Automatic sample thresholds map 1-3 samples to level 2, 4-9 to level 3, 10-19 to level 4, and 20 or more to level 5; zero samples produce no status level [@queue-migration].

Queue labels are fixed in the client as five Finnish levels: `Olematon`, `Lyhyt`, `Normaali`, `Pitkä`, and `Erittäin pitkä` [@queue-service]. The service type allows `manual`, `crowd`, and `none` sources, which lets the UI distinguish a fresh admin rating from an automatic activity estimate or unavailable data [@queue-service].

## Admin Flow

The admin queue screen is under the authenticated Me stack at `app/(app)/me/admin/queue.tsx`, and the Me tab shows the `Jonotilanteen hallinta` link only when the client reads `users.role === "admin"` [@admin-screen] [@me-screen] [@me-layout]. That link is presentation only. The migration removes client write access to `users.role`, makes the role non-null with a `user|admin` check, and replaces the old public `is_admin(uuid)` helper with `private.is_admin()` using `auth.uid()` and a fixed empty `search_path` [@queue-migration].

Admins record observations by inserting only `queue_area_id` and `level` into `queue_observations` through `recordQueueObservation()` [@queue-service]. A trigger stamps `admin_user_id`, `observed_at`, and the 10-minute anonymous sample count server-side, and RLS allows observation reads and inserts only for `private.is_admin()` [@queue-migration]. New admins are therefore an operations task through trusted database access, not an app-side profile edit [@queue-migration] [@implementation-session].

## RPC Grants And Startup Races

The queue aggregate is not public. The grant-repair migration explicitly revokes all execution on `public.get_queue_statuses()` from `public` and `anon`, then grants execution only to `authenticated` and `service_role` [@queue-grant-migration]. This matches the client-side session guard in `getQueueStatuses()` and keeps the privacy boundary on the RPC instead of widening anonymous access to hide startup errors [@queue-service] [@queue-grant-migration].

The August 12, 2026 production update fixed a Sentry issue reported as `permission denied for function get_queue_statuses` by adding the authenticated-session guard before the RPC call and preparing the grant-repair migration for privilege drift [@queue-grant-session]. Future queue work should preserve both sides: anonymous clients should skip the RPC, and production database privileges should allow authenticated map sessions to execute it [@queue-service] [@queue-grant-migration].

## Privacy Boundary

Queue status uses anonymous analytics as an input, not as an identified attendance system. `BLELocationService.updateLocationFix()` inserts `anonymous_crowd_samples` only when anonymous analytics is enabled, and those rows omit user id, class, exact coordinates, and beacon ids [@location-service]. The queue RPCs expose aggregate status and activity counts, while raw anonymous sample rows remain unreadable to normal clients [@queue-migration].

Future queue work should preserve that distinction. The admin screen can show "anonyymiä sijaintinäytettä 10 minuutissa - ei henkilömäärä" because `get_admin_queue_activity()` returns a sample count, not a distinct-user estimate [@admin-screen] [@queue-migration]. Showing occupancy claims, per-person counts, or raw sample history would be a product and privacy change, not a small UI copy change.
