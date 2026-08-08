---
title: "FabLab Tables And Storage"
summary: "This reference lists the Supabase tables, joined fields, storage bucket, and status values assumed by the FabLab print-job client."
topics: [reference, fablab, print-jobs, supabase, storage]
sources:
  - id: jobs-list
    type: file
    path: app/(tabs)/fablab/index.tsx
  - id: new-print
    type: file
    path: app/(tabs)/fablab/new-print.tsx
  - id: job-detail
    type: file
    path: app/(tabs)/fablab/[jobId].tsx
  - id: fablab-types
    type: file
    path: lib/fablabTypes.ts
---

# FabLab Tables And Storage

This reference describes the Supabase schema and storage assumptions visible in the FabLab client code. It covers the tables and fields read by the list, new-print, and detail screens; the storage bucket and object path used for uploaded print files; and the status vocabulary consumed by the UI [@jobs-list] [@new-print] [@job-detail] [@fablab-types]. For the runtime flow that uses these contracts, see [print upload and status](../../architecture/fablab/print-upload-and-status).

## Tables

| Table | Client Use | Required Fields Or Relations |
| --- | --- | --- |
| `print_jobs` | Main print-job rows. The list filters by `user_id`, the detail route filters by `id`, and the new-print route inserts new rows [@jobs-list] [@job-detail] [@new-print]. | See the `PrintJob` fields below. Must relate `filament_id` to `filaments.id` and `printer_id` to `printers.id` for the current select aliases [@jobs-list] [@job-detail]. |
| `filaments` | New-print options and joined display data for jobs [@new-print] [@jobs-list] [@job-detail]. | `id`, `name`, `material`, `color`, `available`; option query filters `available = true` and orders by `name` [@new-print] [@fablab-types]. |
| `printers` | Optional new-print printer selection and joined display data on detail [@new-print] [@job-detail]. | `id`, `name`, optional `model`, `status`; option query filters `status = idle` and orders by `name` [@new-print] [@fablab-types]. |

## Print Job Fields

| Field | Client Behavior |
| --- | --- |
| `id` | Generated client-side before upload and inserted into `print_jobs`; also used as the job detail route parameter [@new-print] [@job-detail]. |
| `user_id` | Inserted from `supabase.auth.getUser()` and used to filter the current user's list and list realtime channel [@new-print] [@jobs-list]. |
| `filename` | Displayed on list cards and detail headers; inserted from the picked document asset name [@new-print] [@jobs-list] [@job-detail]. |
| `file_path` | Inserted as the Supabase Storage object path after upload [@new-print]. |
| `filament_id` | Required for submission because the wizard disables continuation until a filament is selected [@new-print]. |
| `printer_id` | Optional; inserted as `null` when the user has not selected an idle printer [@new-print]. |
| `status` | Drives list badges, detail panels, and the progress stepper [@jobs-list] [@job-detail] [@fablab-types]. |
| `estimated_grams` | Displayed as weight in the cost card and details when present [@job-detail]. |
| `estimated_duration_minutes` | Displayed as formatted duration in the cost card and details when present [@job-detail]. |
| `estimated_cost` | Displayed on list cards, in the cost/payment panels, and in details when present [@jobs-list] [@job-detail]. |
| `review_note` | Displayed in the rejected panel when present [@job-detail]. |
| `print_started_at` | Displayed in the printing panel when present [@job-detail]. |
| `completed_at` | Displayed for completed and failed terminal panels when present [@job-detail]. |
| `created_at` | Required by list card timestamps and detail "Submitted" display [@jobs-list] [@job-detail]. |
| `updated_at` | Part of the typed `PrintJob` model, though the visible screens do not render it directly [@fablab-types]. |

## Joined Selects

The list screen selects `*, filament:filaments(id,name,material,color)` from `print_jobs` [@jobs-list]. The detail screen selects `*, filament:filaments(id,name,material,color), printer:printers(id,name,model)` [@job-detail]. Those aliases are the shape expected by the optional `filament` and `printer` properties in `PrintJob` [@fablab-types].

## Storage Bucket

Uploaded print files go to the Supabase Storage bucket named `print-files` [@new-print]. The object path format is:

```text
prints/<user-id>/<job-id>/<filename>
```

The upload uses `upsert: false` and a content type of the picked file's MIME type, falling back to `application/octet-stream` [@new-print]. The job row stores the same path in `file_path` only after the storage upload succeeds [@new-print].

## Status Values

| Status | Label | Stepper Role |
| --- | --- | --- |
| `pending_upload` | `Pending Upload` | First happy-path step [@fablab-types]. |
| `uploaded` | `Processing` | Happy-path step [@fablab-types]. |
| `cost_estimated` | `Cost Ready` | Happy-path step and full payment card trigger [@fablab-types] [@job-detail]. |
| `awaiting_payment` | `Awaiting Payment` | Happy-path step and compact payment panel trigger [@fablab-types] [@job-detail]. |
| `awaiting_approval` | `Under Review` | Happy-path step and staff-review panel trigger [@fablab-types] [@job-detail]. |
| `approved` | `Approved` | Happy-path step [@fablab-types]. |
| `printing` | `Printing` | Happy-path step and printing panel trigger [@fablab-types] [@job-detail]. |
| `completed` | `Completed` | Final happy-path step and completed panel trigger [@fablab-types] [@job-detail]. |
| `rejected` | `Rejected` | Terminal side status rendered outside the happy-path stepper [@fablab-types] [@job-detail]. |
| `failed` | `Failed` | Terminal side status rendered outside the happy-path stepper [@fablab-types] [@job-detail]. |

## Realtime Channels

The list channel is named `fablab-jobs-list`, listens for all events on public `print_jobs`, filters by `user_id=eq.<current-user-id>`, and refetches the full list on each event [@jobs-list]. The detail channel is named `fablab-job-<jobId>`, listens for `UPDATE` events on public `print_jobs` filtered by id, and merges changed row fields into the current job state [@job-detail].

For the user-facing meaning of these fields and statuses, see [FabLab print jobs](../../concepts/fablab/print-jobs). Use [enable and test FabLab](../../guides/fablab/enable-and-test-fablab) when checking these assumptions from the app UI.
