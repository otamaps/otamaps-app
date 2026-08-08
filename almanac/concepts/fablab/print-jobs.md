---
title: "FabLab Print Jobs"
summary: "FabLab print jobs are the app's user-facing record for uploaded 3D print files, selected materials, staff review, payment, and print progress."
topics: [concepts, fablab, print-jobs, supabase, payments]
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
  - id: fablab-terms
    type: file
    path: assets/fablab/terms.md
---

# FabLab Print Jobs

FabLab print jobs are the OtaMaps model for submitting and following 3D prints from the mobile app. A job begins when a signed-in user picks a `.gcode`, `.stl`, or `.obj` file, chooses an available filament, optionally chooses an idle printer, uploads the file to Supabase Storage, and inserts a `print_jobs` row with status `pending_upload` [@new-print]. After that, the user sees the job in "My Prints" and follows its staff, payment, and printing lifecycle through status labels and realtime updates [@jobs-list] [@job-detail]. The concept matters because FabLab rules describe supervised, safe, and accountable use of equipment, while the app models each print as a durable record with a file, owner, material, cost fields, review note, timestamps, and status [@fablab-terms] [@fablab-types].

## Product Surface

The FabLab tab is a print-job workspace, not a generic equipment reservation screen. Its landing screen fetches the authenticated Supabase user, lists that user's `print_jobs` rows newest first, joins each row to its filament display data, and opens the job detail route by id [@jobs-list]. Empty state text directs the user to tap the floating add button, which routes to the new-print wizard [@jobs-list].

The new-print wizard is the only client-side creator for jobs in the current app. It has three steps: file selection, options, and confirmation [@new-print]. File selection accepts any picked document but only treats `gcode`, `stl`, and `obj` as expected extensions in the UI [@new-print]. Options are loaded from available filaments and idle printers, and filament selection is required while printer selection is optional [@new-print].

## Lifecycle Vocabulary

`PrintJobStatus` defines ten status values: `pending_upload`, `uploaded`, `cost_estimated`, `awaiting_payment`, `awaiting_approval`, `approved`, `printing`, `completed`, `rejected`, and `failed` [@fablab-types]. The user-facing labels turn those values into states such as "Processing", "Cost Ready", "Awaiting Payment", "Under Review", and "Printing" [@fablab-types]. The happy-path stepper orders eight non-terminal progress steps from `pending_upload` through `completed`; `rejected` and `failed` are terminal side branches rendered separately in the job detail stepper [@fablab-types] [@job-detail].

The lifecycle carries operational meaning. `cost_estimated` and `awaiting_payment` expose payment actions, `awaiting_approval` tells the user staff review is pending, `printing` can show a start timestamp, and `completed`, `failed`, or `rejected` show terminal result panels [@job-detail]. For the runtime upload and realtime mechanics behind this vocabulary, see [print upload and status](../../architecture/fablab/print-upload-and-status).

## Payment As Part Of The Job

Payment is attached to a print job after cost estimation rather than collected during initial upload. The detail screen renders weight, duration, and cost pills only when the estimated fields are present, and it enables "Pay Now" when the job status is `cost_estimated` or `awaiting_payment` [@job-detail]. The payment flow asks a backend route for a SumUp checkout id and then passes that checkout id to the SumUp payment sheet [@job-detail].

This makes the job the bridge between Supabase state and the external payment provider. The user sees one print record, but the architecture keeps checkout creation outside the mobile client; see [SumUp payment boundary](../../architecture/fablab/sumup-payment-boundary) for that provider split.

## Storage Contract

A print job stores both the uploaded file path and the relational metadata needed to show progress. The client-generated job id becomes part of the storage path `prints/<user-id>/<job-id>/<filename>`, and the inserted row records that path with `user_id`, `filename`, `filament_id`, optional `printer_id`, and initial status `pending_upload` [@new-print]. The typed model also allows estimates, review notes, print timestamps, and optional joined `filament` and `printer` objects [@fablab-types].

Use [FabLab tables and storage](../../reference/supabase/fablab-tables-and-storage) when changing the database or storage assumptions behind this concept. Use [enable and test FabLab](../../guides/fablab/enable-and-test-fablab) when checking the end-to-end user surface from tab opt-in through upload and payment setup.
