---
title: "Supabase And Google Auth"
summary: "OtaMaps uses Supabase Auth as the session authority, with Wilma primary auth, Google ID-token legacy sign-in, email/password legacy sign-in, and profile-row creation in the public users table."
topics: [authentication, supabase, google-sign-in, profiles]
sources:
  - id: supabase-client
    type: file
    path: lib/supabase.ts
  - id: auth-context
    type: file
    path: context/AuthContext.tsx
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: google-auth
    type: file
    path: lib/googleAuth.ts
  - id: index-route
    type: file
    path: app/index.tsx
  - id: login-route
    type: file
    path: app/welcome/(pre)/login.tsx
  - id: email-route
    type: file
    path: app/welcome/(pre)/emailLogin.tsx
  - id: welcome-index
    type: file
    path: app/welcome/(pre)/index.tsx
  - id: wilma-auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: code-gen
    type: file
    path: components/functions/codeGen.tsx
---

# Supabase And Google Auth

Supabase Auth is the session authority for OtaMaps. The shared Supabase client persists auth state in `AsyncStorage`, refreshes tokens automatically, disables URL session detection, and starts or stops Supabase auto-refresh when the React Native app enters or leaves the foreground [@supabase-client]. Wilma primary auth is an identity input into that Supabase session model: the welcome screen can send Wilma credentials through the OtaMaps API auth broker, and the broker accepts the Supabase session only after verifying that the returned user id matches the expected Wilma-authenticated account [@welcome-index] [@wilma-auth-broker]. Google and email/password remain legacy sign-in paths for existing OtaMaps accounts [@login-route] [@email-route].

## Session Model

The root `app/index.tsx` route checks `supabase.auth.getSession()`, listens to `onAuthStateChange`, shows the custom splash route briefly, and redirects signed-in users to `/map` while sending unauthenticated users to `/welcome` [@index-route]. The tab route mounts `AuthProvider`, which exposes `{ session, loading }` from the same Supabase session APIs to tab descendants [@auth-context]. This means navigation and child route state both derive from Supabase auth, not from Google local state alone.

The broader shell also listens to Supabase auth events for background BLE behavior; sign-in may start the BLE background service when the user enabled it, and sign-out stops that service [@root-layout]. See the [Expo Router shell](../../architecture/app/expo-router-shell) and [session and identity](../../architecture/auth/session-and-identity) pages for the provider and lifecycle boundaries that sit around this concept.

## Wilma Primary Auth

The welcome index route shows the Wilma username/password form only when `WILMA_PRIMARY_AUTH_ENABLED` is true [@welcome-index] [@wilma-auth-broker]. That flow calls `startWilmaAuthentication`; a successful session exchange is finished with `supabase.auth.verifyOtp`, and a possible legacy-account match is handled by either creating a new Wilma-backed account or saving a pending link before sending the user to old-account login [@welcome-index] [@wilma-auth-broker].

The broker is the reason Wilma auth still respects Supabase session authority. It signs out if the Supabase user returned by `verifyOtp` does not match the expected user id, and it clears Supabase plus Wilma local state if legacy-link completion fails [@wilma-auth-broker]. See [Wilma auth broker and account linking](../../architecture/wilma/auth-broker-and-account-linking) for the full flow.

## Google Sign-In

The Google path configures `@react-native-google-signin/google-signin` with web and iOS client IDs that can come from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, falling back to committed defaults [@google-auth]. The legacy login screen calls `configureGoogleSignIn()`, checks Google Play Services availability, shows the Google button when available, and sends users without an `@eduespoo.fi` account to the email-login route [@login-route].

After Google returns tokens, `signInWithGoogle()` requires an `idToken`, exchanges it with Supabase as provider `google`, and calls `ensureUserProfile()` when Supabase returns a user [@google-auth]. That profile upsert normalizes the email, fills a display name from Google metadata or the email prefix, applies default class and color values, and stores a deterministic friend/profile code in the `users` table [@google-auth].

## Email Fallback And Profile Codes

The current email route is a legacy sign-in path, not a public sign-up form. It calls `supabase.auth.signInWithPassword`, then attempts `completePendingLegacyLink` so a Wilma-authenticated legacy-match attempt can be attached to the old Supabase account after password login [@email-route] [@wilma-auth-broker].

Google profile creation still uses `generateCode(email)` for the profile code. The generator hashes the email with SHA-256, takes the first 12 hex characters as an integer, and maps it into a zero-padded six-digit string [@code-gen] [@google-auth]. That makes profile-code behavior part of the auth concept as well as the account surface described in [edit profile and sign out](../../guides/account/edit-profile-and-sign-out).

## Sign-Out Boundary

`signOutGoogleAndSupabase()` signs out of Supabase first, then attempts Wilma GraphQL logout cleanup, clears any pending Wilma legacy-link attempt, signs out of local Google state, and only throws the Supabase error if one exists [@google-auth] [@wilma-auth-broker]. This keeps Supabase as the authoritative app session while still clearing Wilma and Google local state when possible. Cache details for session and profile-related storage belong in [client caches](../../reference/storage/client-caches).
