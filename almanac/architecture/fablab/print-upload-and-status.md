---
title: "Print Upload And Status"
summary: "Print upload and status is the FabLab flow that uploads selected files to Supabase Storage, creates print job rows, and keeps list and detail screens current through realtime subscriptions."
topics: [architecture, fablab, print-jobs, supabase, realtime]
sources:
  - id: new-print
    type: file
    path: app/(tabs)/fablab/new-print.tsx
  - id: job-detail
    type: file
    path: app/(tabs)/fablab/[jobId].tsx
  - id: jobs-list
    type: file
    path: app/(tabs)/fablab/index.tsx
  - id: fablab-types
    type: file
    path: lib/fablabTypes.ts
---

# Print Upload And Status

Print upload and status is the client-side FabLab architecture for creating and observing [print jobs](../../concepts/fablab/print-jobs). The new-print route owns file picking, option loading, Supabase Storage upload, and `print_jobs` insertion; the list and detail routes own authenticated reads and realtime refresh [@new-print] [@jobs-list] [@job-detail]. This shape matters because the mobile app creates the initial job record directly in Supabase, while later status, cost, review, payment, and completion updates are expected to arrive through database changes rather than through local state transitions [@fablab-types] [@job-detail].

## Upload Entry Point

`app/(tabs)/fablab/new-print.tsx` implements a three-step wizard. Step 1 stores the picked document's name, size, URI, and optional MIME type after `DocumentPicker.getDocumentAsync()` returns an asset [@new-print]. Step 2 loads options by querying `filaments` where `available` is true and `printers` where `status` is `idle`; it orders both lists by name and requires a filament before continuing [@new-print]. Step 3 displays the selected file, filament, and optional printer before calling `confirmAndUpload()` [@new-print].

The upload function requires an authenticated Supabase user before it does any storage or table write [@new-print]. It generates a UUID-like job id on the client, builds `prints/<user-id>/<job-id>/<filename>`, fetches the picked file URI into a blob, and uploads the blob to the `print-files` storage bucket with the picked MIME type or `application/octet-stream` [@new-print]. Only after storage succeeds does it insert the `print_jobs` row with the same id, user id, filename, file path, selected filament, optional printer, and `pending_upload` status [@new-print].

## Job List Refresh

The FabLab landing screen reads the current user's jobs directly from Supabase. It calls `supabase.auth.getUser()`, returns early when no user is present, then selects `print_jobs` with a joined `filament:filaments(id,name,material,color)` relation filtered by `user_id` and ordered by `created_at` descending [@jobs-list]. Each returned row is rendered as a card with filename, status badge, optional filament label, optional estimated cost, and creation timestamp [@jobs-list].

The same screen creates a realtime channel named `fablab-jobs-list` after it knows the authenticated user. The channel listens to all Postgres changes on public `print_jobs` filtered by that user's id, and each event triggers a full `fetchJobs()` refresh [@jobs-list]. This keeps the list simple: it does not merge individual payloads into the list, so joined filament data is refreshed by the normal select query after every relevant database change [@jobs-list].

## Detail Refresh And Status Stepper

The detail route reads a single job by route parameter. It selects from `print_jobs`, joins filament and printer display fields, filters by id, and calls `.single()` [@job-detail]. It subscribes to `UPDATE` events on the same row through a channel named from the job id, then merges `payload.new` into the existing job state [@job-detail].

Status rendering is centralized in `lib/fablabTypes.ts` and consumed by the detail screen. The type file defines the status enum, colors, labels, and the ordered happy-path `STATUS_STEPS` sequence [@fablab-types]. The detail stepper marks previous steps as done, the current happy-path status as active, and appends a separate terminal marker when the status is `rejected` or `failed` [@job-detail].

## Boundary With Payment

Upload does not create a SumUp checkout and does not collect money. It creates the file and initial row, then leaves cost and payment states to later job updates [@new-print] [@fablab-types]. The detail route exposes payment actions only for `cost_estimated` and `awaiting_payment`, and that payment work crosses a backend boundary described in [SumUp payment boundary](sumup-payment-boundary) [@job-detail].

## Change Constraints

Future changes should preserve the storage-then-row order unless the backend starts owning both operations. In the current client, a storage failure stops before any row insert, while a row-insert failure can leave an uploaded object without a matching job row because no cleanup path is implemented [@new-print]. Future changes should also preserve user scoping on list reads and list realtime filters; the detail route currently filters by job id only, so database policies must remain the authority for preventing cross-user reads [@jobs-list] [@job-detail].

For the exact table and bucket assumptions used by this flow, see [FabLab tables and storage](../../reference/supabase/fablab-tables-and-storage).
