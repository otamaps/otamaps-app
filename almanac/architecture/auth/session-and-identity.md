---
title: "Session And Identity"
summary: "Session and identity is the architecture that combines Supabase Auth sessions, Wilma auth exchange, local user cache, Google sign-in profile creation, profile rows, and realtime profile updates."
topics: [architecture, authentication, profiles, storage, supabase]
sources:
  - id: supabase-client
    type: file
    path: lib/supabase.ts
  - id: auth-context
    type: file
    path: context/AuthContext.tsx
  - id: user-handle
    type: file
    path: lib/getUserHandle.tsx
  - id: me-screen
    type: file
    path: app/(tabs)/me.tsx
  - id: edit-profile
    type: file
    path: app/(app)/me/edit.tsx
  - id: google-auth
    type: file
    path: lib/googleAuth.ts
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: welcome-index
    type: file
    path: app/welcome/(pre)/index.tsx
---

# Session And Identity

Session and identity in OtaMaps is a layered architecture. Supabase Auth owns the signed-in session, the shared Supabase client persists that session in AsyncStorage and manages token refresh, `getUser()` adds a separate one-hour cached copy of the authenticated user, and profile screens combine auth metadata with the public `users` row [@supabase-client] [@user-handle] [@me-screen]. Wilma primary auth can create or select the Supabase session through the OtaMaps API broker, while Google sign-in and profile editing also write profile data, so future identity changes must account for Supabase Auth metadata, local caches, broker exchanges, and table rows together [@wilma-auth-broker] [@welcome-index] [@google-auth] [@edit-profile].

## Session Authority

`lib/supabase.ts` creates the single Supabase client with a committed project URL and anon key, configures Supabase Auth to use React Native AsyncStorage, enables `autoRefreshToken` and `persistSession`, and disables URL session detection [@supabase-client]. The same file listens for React Native `AppState` changes and starts Supabase auto-refresh when the app is active while stopping it outside the foreground [@supabase-client].

`AuthProvider` is a small context wrapper around that session source. On mount, it reads `supabase.auth.getSession()`, stores the session in React state, clears the loading flag, and subscribes to `onAuthStateChange` so descendants see later session changes [@auth-context]. This context is useful for UI state, but it does not replace direct Supabase calls in the rest of the codebase.

Wilma auth does not replace Supabase authority. `finishWilmaSupabaseExchange` verifies an email OTP token hash through Supabase, rejects the exchange if the returned Supabase user id differs from the broker's `expectedUserId`, and only then stores Wilma GraphQL session material [@wilma-auth-broker]. Legacy Wilma linking follows the same idea: it requires a signed-in Supabase access token, verifies the current user id against the linked expected id, and clears Supabase plus Wilma local state on failure [@wilma-auth-broker].

## Local User Cache

`getUser()` wraps `supabase.auth.getUser()` with a local cache under two AsyncStorage keys: `user` and `user_cache_timestamp` [@user-handle]. Unless called with `forceRefresh: true`, it returns the cached user when the timestamp is less than one hour old [@user-handle]. A fresh fetch stores the Supabase user and timestamp; a null user removes both keys [@user-handle].

That cache is separate from Supabase Auth's own persisted session. A sign-out flow must clear both the Supabase session and the `getUser()` cache to avoid stale identity data in app code that calls `getUser()` directly. The Me screen does this by calling `signOutGoogleAndSupabase()`, then `clearUserCache()`, and finally routing to `/` [@me-screen].

## Profile Rows And Metadata

Google sign-in creates identity in two places. `signInWithGoogle()` exchanges a Google ID token for a Supabase session, then `ensureUserProfile()` upserts a `users` row with the Supabase user id, normalized email, display name, class, color, and deterministic friend code [@google-auth]. The display name falls back from Google metadata to the email prefix, and the default color is `#4A89EE` [@google-auth].

The Me tab reads identity by combining auth metadata with table data. It gets the current Supabase user through `getUser()`, builds fallback display values from `user_metadata` and email, then queries `users` for `name`, `class`, `color`, and `code` by auth user id [@me-screen]. When the table row exists, table values override metadata fallback values for profile display [@me-screen].

Editing profile data also writes both layers. The edit route loads initial values from auth metadata, validates the class string, calls `getUser({ forceRefresh: true })`, updates Supabase Auth metadata with `full_name`, `class`, `color`, and `code`, and updates the `users` row's `name`, `class`, `color`, and `updated_at` fields [@edit-profile]. It does not update the `code` column in the `users` table during save, even though it regenerates a code for auth metadata [@edit-profile].

## Realtime Profile Updates

The Me screen subscribes to all `UPDATE` events on the public `users` table through a Supabase realtime channel named `profile_changes` [@me-screen]. On every update payload, it merges `payload.new` into the local profile state and prefers new `name`, `class`, and `color` values when present [@me-screen]. The subscription is not filtered by user id in the code, so profile updates for other users can still trigger the handler before the merge updates local state [@me-screen].

The same screen refreshes profile and debug-mode state on focus. It reloads `isDebugMode` from AsyncStorage and repeats the auth metadata plus `users` table profile fetch when the tab gains focus [@me-screen]. This focus refresh is why profile edits can show updated values after returning from the edit route even without relying only on realtime delivery.

## Boundaries For Future Changes

Session-sensitive code should treat Supabase Auth as the authority for whether the app is signed in, and `getUser()` as a convenience cache for the current user object. The cache can be stale for up to one hour unless a caller forces refresh [@user-handle]. Profile-sensitive code should treat the `users` row as the source for display fields and friend code on the Me tab, while remembering that auth metadata is also updated by edit and sign-in flows [@me-screen] [@edit-profile] [@google-auth]. Wilma-sensitive auth changes must also preserve the broker's expected-user-id checks before saving Wilma GraphQL session or credential keys [@wilma-auth-broker].

For surrounding context, see [Supabase session authority](../../concepts/authentication/supabase-and-google-auth) and [Wilma auth broker and account linking](../wilma/auth-broker-and-account-linking). Use [client caches](../../reference/storage/client-caches) for the exact storage keys, and [friend relations](../social/friend-relations) for the social rows that depend on the current Supabase user id.
