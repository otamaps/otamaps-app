---
title: "Lunch-Shift Extraction Via LLM Paste, Not A Parser"
summary: "OtaMaps has an admin paste a fixed prompt plus the school's periodic ruokailuvuorot PDF into Claude.ai and paste the returned JSON back into the app, instead of writing a bespoke PDF/spreadsheet parser."
topics: [decisions, mobile, lunch-shifts, wilma]
sources:
  - id: core
    type: file
    path: lib/lunchShiftCore.ts
  - id: service
    type: file
    path: lib/lunchShiftService.ts
  - id: admin-screen
    type: file
    path: app/(app)/me/admin/lunch-shifts.tsx
  - id: migration
    type: file
    path: supabase/migrations/20260821120000_lunch_shifts.sql
  - id: home-route
    type: file
    path: app/(tabs)/home.tsx
  - id: tests
    type: file
    path: tests/lunchShift.test.cjs
---

# Lunch-Shift Extraction Via LLM Paste, Not A Parser

The school sends a "ruokailuvuorot" (lunch-shift) PDF/spreadsheet at the start of each of the 5 school periods per year, mapping weekday × time-slot × shift to the Wilma course codes eating lunch then; Wilma's own timetable only shows a combined lesson-and-lunch block and never says where the break falls within it [@home-route]. OtaMaps does not parse this document in app or backend code. Instead, an admin copies a fixed extraction prompt from the in-app admin screen, pastes it plus the period's PDF into a Claude.ai conversation, and pastes the JSON it returns back into the app for validation and save [@admin-screen].

## Status

This decision is active. `app/(app)/me/admin/lunch-shifts.tsx` has no PDF/image parsing code path; it only accepts pasted JSON [@admin-screen].

## Context

Two things ruled out a bespoke parser:

**Format instability.** The document's layout is not fixed. The two shift tables ("1. vuoron ruokailut" / "2. vuoron ruokailut") sit side by side in the same page, which naive linear PDF-text extraction interleaves unpredictably. The row shape also changes across periods: one period's document prints explicit ranges ("klo 11.05-11.45"), while an older period's document prints only start times ("klo 11.15", "klo 11.25"), requiring the end time to be inferred from context (typically the next row's start, or the lesson boundary printed elsewhere on the page). A parser built against one period's layout would silently mis-handle the next.

**Measured model accuracy.** Before choosing this approach, Claude Sonnet 5 at high reasoning effort and Gemini Flash (a lightweight/free-tier model) were both given the same source PDF and asked to extract the same JSON schema. Every course code from Sonnet 5's output was hand-verified against the source text across two different periods/layouts (35 rows, ~174 codes each) with zero errors. Gemini Flash produced roughly a 37% error rate on the same document, with silent, dangerous substitutions rather than obviously-broken output — e.g. `ÄI01.02` read as `A101.02`, and more seriously `MAY01.D1` read as `MAY01.01`, which happens to collide with a real, different code used elsewhere in the same table. A parser-shaped mental model ("OCR/extract once, trust it") does not fit a source where model quality this visibly determines correctness; a human-in-the-loop review step does.

Given the format instability and the low frequency of this task (~5 times a year), the admin effort of running a paste-and-review workflow each period is smaller than building and maintaining a parser robust to both failure modes above.

## Decision

- No PDF/spreadsheet parsing code exists anywhere in the app or backend for this feature.
- The admin screen shows a fixed extraction prompt (copyable via `expo-clipboard`) describing the exact JSON schema, and instructs the admin to use at least Claude Sonnet 5 with extended thinking, or a stronger model such as Opus 5 — not a lightweight/free-tier model — based on the accuracy gap measured above [@admin-screen].
- Pasted JSON is validated client-side before anything is saved (`validateLunchShiftImport`): malformed or out-of-range fields are hard errors that block saving, while course codes that don't match the Wilma code shape (`[A-ZÄÖ]{2,4}\d{1,2}(\.\d{1,2})?`) are soft warnings the admin can override, since shape alone cannot prove content correctness [@core].
- Saving calls `replace_lunch_shifts`, a `security definer` RPC that atomically deletes and re-inserts the whole `lunch_shifts` table in one transaction — full-period-replace, no history retained, matching how the admin actually receives one complete document per period rather than incremental updates [@migration].
- The student-facing side (`app/(tabs)/home.tsx`'s "Tänään" card) cross-references today's Wilma lesson course codes against the saved rows and shows nothing if there's no unambiguous match, rather than guessing [@home-route] [@core].

## Consequences

- Correctness now depends on the admin choosing a capable model and reviewing the preview, not on code. The shape-based warning is a safety net, not a guarantee: a wrong-but-shape-valid code (e.g. `MAAD8.03` for `MAA08.03`) will not be flagged and would need to be caught by eye against the source PDF.
- When a source document only prints start times, the extracting model must infer end times; testing found this inference usually self-consistent (end = next row's start, final row = the lesson-resumption boundary printed elsewhere on the page) but not always — one tested period had an internally inconsistent (overlapping) guess for a single row. If this recurs, tighten the extraction prompt with an explicit inference rule rather than adding parsing code.
- Two data shapes are deliberately not handled by this workflow: free-text "poikkeusvuorot" exception-day emails (irregular wording, not a stable schema) and "2. tunnin vapaatuntilaiset" (free 2nd-hour) rows with no course code. Both are treated as out of scope; a student with no matching course code for today simply sees no auto-detected lunch row, which is a graceful no-op rather than an error [@core] [@tests].
- If the source document's format stabilizes, or if a reliable cheap/fast model becomes available for this exact extraction, a bespoke parser becomes worth revisiting — this decision rejects it for the current situation, not permanently.
