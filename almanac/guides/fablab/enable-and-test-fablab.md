---
title: "Enable And Test FabLab"
summary: "This guide explains how to expose the local FabLab tab and verify the print-job upload, status, and payment surfaces in the mobile app."
topics: [guides, fablab, print-jobs, payments, supabase]
sources:
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

Use this guide when you need to expose the FabLab tab on a device or simulator and verify that the print-job flow is wired through the current app. The expected result is that `fablabEnabled` is set in local AsyncStorage, the bottom tab bar shows "Fablab", a signed-in user can reach "My Prints", the new-print wizard can upload a file and create a Supabase job row, and payment UI appears for jobs whose status and estimate fields make payment possible [@fablab-settings] [@tab-layout] [@jobs-list] [@new-print] [@job-detail]. For the model behind the flow, read [FabLab print jobs](../../concepts/fablab/print-jobs) first.

## Preconditions

Test with a signed-in Supabase user. The FabLab list screen returns early without a user, and the upload screen throws `Not authenticated` before storage upload or row insertion when no user is present [@jobs-list] [@new-print].

Supabase must have compatible `filaments`, `printers`, `print_jobs`, and `print-files` resources. The new-print wizard queries available filaments and idle printers before submission, uploads the selected file to the `print-files` bucket, and inserts a `print_jobs` row [@new-print]. Use [FabLab tables and storage](../../reference/supabase/fablab-tables-and-storage) for the exact fields the client reads and writes.

Payment testing also needs runtime configuration and a backend checkout route. The job detail screen posts to `EXPO_PUBLIC_BACKEND_URL + /jobs/:id/checkout` with the user's Supabase access token and then initializes the SumUp payment sheet with the returned checkout id [@job-detail]. Use [SumUp payment boundary](../../architecture/fablab/sumup-payment-boundary) before changing this path.

## Enable The Tab

Open the FabLab settings route under the Me area and turn on the switch labeled "Ota Fablab käyttöön" [@fablab-settings]. The settings screen writes the string value of the switch to AsyncStorage under `fablabEnabled`; if saving fails, it restores the previous visible state [@fablab-settings].

Return to another tab or route if the tab does not appear immediately. The tab layout reads `fablabEnabled` from AsyncStorage in an effect keyed by the current route segments, and the FabLab tab sets `href` to `null` when the stored value is not `"true"` [@tab-layout]. This is a local device opt-in, not a server-side entitlement.

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

If the tab is missing, check the local `fablabEnabled` key first. The settings screen and tab layout both use that exact key, and only the string `"true"` exposes the tab [@fablab-settings] [@tab-layout].

If uploads fail after the object is created, inspect the `print_jobs` insert separately. The current upload function has no cleanup path for a successful storage upload followed by a failed row insert [@new-print]. If payment fails before the SumUp sheet appears, check `EXPO_PUBLIC_BACKEND_URL`, the `/jobs/:id/checkout` backend response, and the Supabase bearer token accepted by that backend [@job-detail].
