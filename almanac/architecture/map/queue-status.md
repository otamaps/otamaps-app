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
  - id: location-service
    type: file
    path: lib/bleLocationService.ts
  - id: implementation-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/05/rollout-2026-08-05T16-26-35-019fd21a-bd1d-7f21-b404-fa1cf155890d.jsonl
---

# Queue Status

Queue status is the OtaMaps "Vilkkaus" feature for showing the current Ruokalinjasto crowd level on the map. The client reads a safe aggregate from Supabase, highlights the configured room polygon, and shows a compact map control for focusing the queue area [@queue-service] [@map-route]. Automatic estimates come from `anonymous_crowd_samples`, while trusted administrators can record append-only manual observations that override the automatic estimate for a short window [@queue-migration] [@location-service]. This keeps the map useful to all signed-in users without exposing raw anonymous samples or treating sample counts as people counts.

## Public Map Flow

The map route calls `getQueueStatuses()` through `lib/queueService.ts` and keeps the Ruokalinjasto status in route state [@queue-service] [@map-route]. Every 30 seconds it refreshes the queue status, builds a one-feature GeoJSON source when the queue area's floor matches the selected floor, and draws a fill layer plus a label reading `Vilkkaus` and the current queue label [@map-route]. The floating map control always names Ruokalinjasto and uses the queue color/label helpers so missing data displays as `Ei tuoretta tietoa`, not as an empty queue [@queue-service] [@map-route].

The feature deliberately lives inside the existing map renderer. It reuses the same room geometry and floor filter described in [geospatial rendering](geospatial-rendering), so queue rendering should not introduce a second map, a separate coordinate model, or a room lookup path outside the current room data flow [@map-route].

## Status Sources

The database-managed queue configuration starts with one active area, `ruokalinjasto`, linked to the `rooms` row whose trimmed lowercase title is `ruokalinjasto` [@queue-migration]. `get_queue_statuses()` returns active areas for authenticated users and computes a status from either the newest manual observation within 20 minutes or the recent anonymous sample count from the same room within 10 minutes [@queue-migration]. Automatic sample thresholds map 1-3 samples to level 2, 4-9 to level 3, 10-19 to level 4, and 20 or more to level 5; zero samples produce no status level [@queue-migration].

Queue labels are fixed in the client as five Finnish levels: `Olematon`, `Lyhyt`, `Normaali`, `Pitkä`, and `Erittäin pitkä` [@queue-service]. The service type allows `manual`, `crowd`, and `none` sources, which lets the UI distinguish a fresh admin rating from an automatic activity estimate or unavailable data [@queue-service].

## Admin Flow

The admin queue screen is under the authenticated Me stack at `app/(app)/me/admin/queue.tsx`, and the Me tab shows the `Jonotilanteen hallinta` link only when the client reads `users.role === "admin"` [@admin-screen] [@me-screen] [@me-layout]. That link is presentation only. The migration removes client write access to `users.role`, makes the role non-null with a `user|admin` check, and replaces the old public `is_admin(uuid)` helper with `private.is_admin()` using `auth.uid()` and a fixed empty `search_path` [@queue-migration].

Admins record observations by inserting only `queue_area_id` and `level` into `queue_observations` through `recordQueueObservation()` [@queue-service]. A trigger stamps `admin_user_id`, `observed_at`, and the 10-minute anonymous sample count server-side, and RLS allows observation reads and inserts only for `private.is_admin()` [@queue-migration]. New admins are therefore an operations task through trusted database access, not an app-side profile edit [@queue-migration] [@implementation-session].

## Privacy Boundary

Queue status uses anonymous analytics as an input, not as an identified attendance system. `BLELocationService.updateLocationFix()` inserts `anonymous_crowd_samples` only when anonymous analytics is enabled, and those rows omit user id, class, exact coordinates, and beacon ids [@location-service]. The queue RPCs expose aggregate status and activity counts, while raw anonymous sample rows remain unreadable to normal clients [@queue-migration].

Future queue work should preserve that distinction. The admin screen can show "anonyymiä sijaintinäytettä 10 minuutissa - ei henkilömäärä" because `get_admin_queue_activity()` returns a sample count, not a distinct-user estimate [@admin-screen] [@queue-migration]. Showing occupancy claims, per-person counts, or raw sample history would be a product and privacy change, not a small UI copy change.
