---
title: "Edit Profile And Sign Out"
summary: "Use this guide to change a user's displayed profile fields, verify friend-code and debug visibility behavior, and sign out without leaving the local user cache behind."
topics: [guides, account, authentication, profiles, storage]
sources:
  - id: me-screen
    type: file
    path: app/(tabs)/me.tsx
  - id: edit-profile
    type: file
    path: app/(app)/me/edit.tsx
  - id: settings-screen
    type: file
    path: app/(app)/me/settings.tsx
  - id: user-handle
    type: file
    path: lib/getUserHandle.tsx
  - id: google-auth
    type: file
    path: lib/googleAuth.ts
---

# Edit Profile And Sign Out

Use this guide when checking or changing the account surface in OtaMaps: the Me tab display, profile editing, friend-code copying, debug route visibility, and sign-out. A correct run updates both Supabase Auth metadata and the `users` table fields used by the Me tab, leaves the friend code visible and copyable from the Me tab, keeps debug visibility tied to `isDebugMode`, and clears the local `getUser()` cache during sign-out [@me-screen] [@edit-profile] [@settings-screen] [@user-handle].

## Before Editing

Start from the Me tab. It loads the current authenticated user through `getUser()`, builds fallback profile values from auth metadata and email, then queries `users` for `name`, `class`, `color`, and `code` by the current user id [@me-screen]. If the table row exists, those table values override the auth metadata fallback for display [@me-screen]. This means a profile edit is not fully verified by checking auth metadata alone.

Check the friend code on the Me tab before changing related code. The code displayed there comes from `users.code`, and pressing the friend-code pill dynamically imports `expo-clipboard`, writes the code to the clipboard, and shows either a success or failure alert [@me-screen]. The social model that consumes that code is described in [friends and shared location](../../concepts/social/friends-and-shared-location).

## Edit The Profile

Open `Muokkaa tietojani` from the Me tab; it routes to `/me/edit` [@me-screen]. The edit screen loads initial values from the current user's auth metadata: `full_name`, `class`, and `color` [@edit-profile]. It validates class input by stripping non-alphanumeric characters, uppercasing the result, limiting it to three characters, and accepting the final format only when it matches two digits followed by one letter [@edit-profile].

Save only after the name is non-empty and any three-character class value matches the expected class format [@edit-profile]. On save, the route calls `getUser({ forceRefresh: true })`, updates Supabase Auth metadata with `full_name`, `class`, `color`, and a generated `code`, then updates the `users` row with `id`, `name`, `class`, `color`, and `updated_at` for the same auth user id [@edit-profile]. The table update does not write the generated code column during edit, so do not expect profile editing to rotate the friend code shown on the Me tab [@edit-profile] [@me-screen].

After save, the route updates `UserContext` with the new name, class, and color and navigates back [@edit-profile]. The Me tab refreshes profile data on focus, so returning from edit should reload the table-backed display values [@me-screen]. It also subscribes to `users` table updates and merges update payloads into the local profile state, but that realtime subscription is not filtered to the current user id in the component [@me-screen].

## Verify Debug Visibility

Debug mode is controlled by AsyncStorage key `isDebugMode`. The settings screen reads the key on mount, writes `"true"` or `"false"` when the `Debug tila` switch changes, and the Me tab reads the same key on focus [@settings-screen] [@me-screen]. When the value is true, the Me tab shows a `Debug` row that routes to `/(app)/debug2/ble` [@me-screen].

If a debug row does not appear after toggling the switch, leave and re-enter the Me tab or otherwise trigger focus. The Me tab reads `isDebugMode` inside `useFocusEffect`, not from a global settings context [@me-screen].

## Sign Out

Use the `Kirjaudu ulos` button on the Me tab for the normal sign-out flow [@me-screen]. The handler calls `signOutGoogleAndSupabase()`, logs any sign-out failure, then calls `clearUserCache()` and routes to `/` in a `finally` block [@me-screen]. `clearUserCache()` removes both `user` and `user_cache_timestamp` from AsyncStorage [@user-handle].

`signOutGoogleAndSupabase()` signs out of Supabase first, then attempts local Google sign-out and only throws if Supabase returned an error [@google-auth]. A Google local sign-out failure is logged as a warning and does not by itself prevent the Supabase sign-out from completing [@google-auth]. This boundary is part of [session and identity](../../architecture/auth/session-and-identity) and the broader [Supabase session authority](../../concepts/authentication/supabase-and-google-auth) concept.

## Recovery Notes

If the Me tab still shows an old name, check both layers: auth metadata can be refreshed by `getUser({ forceRefresh: true })`, while displayed profile fields prefer the `users` row when that row is present [@edit-profile] [@me-screen]. If the app behaves as though an old user is still signed in after logout, inspect the `getUser()` cache keys because Supabase session persistence and the custom `user` cache are separate storage paths [@user-handle].
