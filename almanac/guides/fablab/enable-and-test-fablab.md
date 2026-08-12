---
title: "Enable And Test FabLab"
summary: "This guide explains how to expose the local FabLab tab and verify the print-job upload, status, and payment surfaces in the mobile app."
topics: [guides, fablab, print-jobs, payments, supabase]
sources:
  - id: feature-constants
    type: file
    path: constants/features.ts
  - id: fablab-settings
    type: file
    path: app/(app)/me/fablab.tsx
  - id: tab-layout
    type: file
    path: app/(tabs)/_layout.tsx
  - id: jobs-list
    type: file
    path: app/(tabs)/fablab/index.tsx
  - id: new-print
    type: file
    path: app/(tabs)/fablab/new-print.tsx
  - id: job-detail
    type: file
    path: app/(tabs)/fablab/[jobId].tsx
---

# Enable And Test FabLab

Use this guide when you need to expose the FabLab tab on a device or simulator and verify that the print-job flow is wired through the current app. The current committed code has a static feature gate first: `FABLAB_VISIBLE` is false, the tab trigger is hidden, and the FabLab settings route redirects back to Me before its local switch can be used [@feature-constants] [@tab-layout] [@fablab-settings]. The expected result after deliberately enabling that static gate is that the bottom tab bar shows "Fablab", a signed-in user can reach "My Prints", the new-print wizard can upload a file and create a Supabase job row, and payment UI appears for jobs whose status and estimate fields make payment possible [@tab-layout] [@jobs-list] [@new-print] [@job-detail]. For the model behind the flow, read [FabLab print jobs](../../concepts/fablab/print-jobs) first.

## Preconditions

Test with a signed-in Supabase user. The FabLab list screen returns early without a user, and the upload screen throws `Not authenticated` before storage upload or row insertion when no user is present [@jobs-list] [@new-print].

Supabase must have compatible `filaments`, `printers`, `print_jobs`, and `print-files` resources. The new-print wizard queries available filaments and idle printers before submission, uploads the selected file to the `print-files` bucket, and inserts a `print_jobs` row [@new-print]. Use [FabLab tables and storage](../../reference/supabase/fablab-tables-and-storage) for the exact fields the client reads and writes.

Payment testing also needs runtime configuration and a backend checkout route. The job detail screen posts to `EXPO_PUBLIC_BACKEND_URL + /jobs/:id/checkout` with the user's Supabase access token and then initializes the SumUp payment sheet with the returned checkout id [@job-detail]. Use [SumUp payment boundary](../../architecture/fablab/sumup-payment-boundary) before changing this path.

## Enable The Tab

First confirm that `constants/features.ts` exports `FABLAB_VISIBLE = true`; with the committed false value, the tab layout hides the trigger and `app/(app)/me/fablab.tsx` redirects to `/(tabs)/me` [@feature-constants] [@tab-layout] [@fablab-settings].

When that static gate is enabled, the current tab layout exposes the FabLab trigger directly [@tab-layout]. The FabLab settings screen still reads and writes the string value of its switch to AsyncStorage under `fablabEnabled`, but the current tab layout does not read that key for visibility [@fablab-settings] [@tab-layout].

## Verify The Job List

Open the FabLab tab and confirm the "My Prints" screen loads. A working empty state shows "No print jobs yet" and "Tap + to start a new print"; a working populated state shows rows from `print_jobs` filtered by the current user's id and joined to filament display fields [@jobs-list].

If the screen shows an error, use the visible Retry button after fixing the underlying issue. The list screen stores the caught error message and reruns `fetchJobs()` on retry [@jobs-list]. Typical causes are a missing session, missing table, missing relation, or policy/schema mismatch.

## Submit A Print Job

Tap the floating add button to open the new-print wizard. Select a `.gcode`, `.stl`, or `.obj` file for a normal path; other extensions can still be picked, but the UI marks them as unusual rather than blocking the step [@new-print]. Continue to options, select a required filament, optionally select an idle printer, and confirm submission [@new-print].

On submission, the app generates a job id, uploads the file to `prints/<user-id>/<job-id>/<filename>` inside the `print-files` bucket, and then inserts the `print_jobs` row with status `pending_upload` [@new-print]. A successful submission routes back to the previous screen; the list screen's realtime subscription should refresh when the new row appears [@new-print] [@jobs-list].

## Verify Status And Payment Surfaces

Open the created job from the list. The detail screen loads by job id, joins filament and printer display data, and subscribes to `UPDATE` events on that job row [@job-detail]. Change the row status from the database or backend workflow to verify each panel: `awaiting_approval` shows staff review text, `printing` can show `print_started_at`, and terminal statuses show completion, failure, or rejection panels [@job-detail].

To verify payment UI, put a job into `cost_estimated` with estimate fields or `awaiting_payment` with `estimated_cost`. The detail screen shows "Pay Now" for `cost_estimated`, a compact "Pay" button for `awaiting_payment`, and reports checkout or payment-sheet errors inline [@job-detail]. Successful payment presentation does not locally update the job; the code expects realtime database updates to move the status after the payment path completes [@job-detail].

## Recovery Notes

If the tab is missing, check `FABLAB_VISIBLE` first. The committed false value hides the tab and blocks the settings route regardless of the local `fablabEnabled` value [@feature-constants] [@tab-layout] [@fablab-settings].

If uploads fail after the object is created, inspect the `print_jobs` insert separately. The current upload function has no cleanup path for a successful storage upload followed by a failed row insert [@new-print]. If payment fails before the SumUp sheet appears, check `EXPO_PUBLIC_BACKEND_URL`, the `/jobs/:id/checkout` backend response, and the Supabase bearer token accepted by that backend [@job-detail].
