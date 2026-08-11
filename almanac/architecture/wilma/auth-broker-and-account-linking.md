---
title: "Wilma Auth Broker And Account Linking"
summary: "The Wilma auth broker is the client boundary between Wilma credentials, the OtaMaps API auth exchange, Supabase Auth sessions, legacy-account linking, and stored Wilma GraphQL sessions."
topics: [architecture, wilma, authentication, supabase]
sources:
  - id: auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: welcome-index
    type: file
    path: app/welcome/(pre)/index.tsx
  - id: legacy-login
    type: file
    path: app/welcome/(pre)/login.tsx
  - id: email-login
    type: file
    path: app/welcome/(pre)/emailLogin.tsx
  - id: google-auth
    type: file
    path: lib/googleAuth.ts
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: network-errors
    type: file
    path: lib/networkErrors.ts
  - id: sentry-runtime
    type: file
    path: lib/sentry.ts
  - id: env-example
    type: file
    path: .env.example
  - id: eas-config
    type: file
    path: eas.json
---

# Wilma Auth Broker And Account Linking

The Wilma auth broker is the client-side boundary for using Wilma as an OtaMaps identity input. `lib/wilma/authBroker.ts` sends Wilma credentials to the OtaMaps API, finishes a Supabase email-OTP exchange from the returned token hash, verifies that Supabase returned the expected user id, and then saves the Wilma GraphQL session token plus Wilma credentials for the dashboard client [@auth-broker] [@graphql-client]. This flow is separate from ordinary Google or password login: Wilma can create or identify the OtaMaps account, while Supabase Auth remains the signed-in app session authority [@auth-broker].

## API Boundary And Feature Flag

The broker builds its API base from `EXPO_PUBLIC_OTAMAPS_API_URL`, defaulting to `https://api.otamaps.fi`, and uses JSON POST requests with a 45-second timeout for Wilma primary-auth exchange calls [@auth-broker]. That timeout is intentionally longer than ordinary GraphQL reads because a successful primary-auth sign-in can include upstream Wilma login, profile parsing, identity lookup or creation, and Supabase token minting behind the OtaMaps API route [@auth-broker]. When the abort is recognized as a fetch cancellation, the broker throws a `FetchTimeoutError` with code `ETIMEDOUT` and reports a handled `wilma.auth` timeout with the path and timeout duration before rethrowing [@auth-broker] [@network-errors] [@sentry-runtime]. `.env.example` describes that URL as the OtaMaps API hosting GraphQL and the Wilma-to-Supabase auth exchange, and EAS build profiles set the same API URL for development, preview, and production [@env-example] [@eas-config].

Wilma primary auth is gated by `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED` [@auth-broker]. The auth broker treats Wilma primary auth as enabled unless the value is exactly `"false"`, and the welcome screen shows the Wilma username/password form when the exported broker constant is enabled [@auth-broker] [@welcome-index]. The committed EAS profiles set the flag to `"true"` for development, preview, and production; setting it to `"false"` is therefore an explicit rollback path that changes the visible onboarding route to legacy OtaMaps login [@eas-config] [@welcome-index].

## New Account Flow

When the user submits Wilma credentials from the welcome screen, `startWilmaAuthentication` calls `/v1/auth/wilma/start` [@auth-broker] [@welcome-index]. A `kind: "session"` response contains a Supabase email token hash, an expected Supabase user id, and a Wilma session token [@auth-broker]. `finishWilmaSupabaseExchange` verifies the token hash with `supabase.auth.verifyOtp({ type: "email" })`, rejects the exchange if the returned Supabase user id does not match `expectedUserId`, and saves the Wilma GraphQL session and credentials only after Supabase identity matches [@auth-broker].

If the API returns `kind: "legacy_match"`, the welcome screen explains that a Wilma-verified name matched an existing OtaMaps account and states that name alone never links accounts [@welcome-index]. The user can choose to create a new account by calling `/v1/auth/wilma/create` with the attempt token and then finishing the same Supabase exchange [@auth-broker] [@welcome-index].

## Legacy Account Link Flow

The legacy-link branch preserves the Wilma attempt while the user proves ownership of an old OtaMaps account. `savePendingLegacyLink` stores `{ attemptToken, username, password }` in SecureStore key `wilma_legacy_link_attempt`, and the welcome screen then routes the user to the old login path [@auth-broker] [@welcome-index]. Both the Google login screen and the email/password login screen call `completePendingLegacyLink` after Supabase sign-in, passing the fresh access token when they have one [@legacy-login] [@email-login].

`completePendingLegacyLink` calls `/v1/auth/wilma/link-legacy` with the pending attempt token and a Supabase bearer token, then verifies that the current Supabase user id matches the API response's `expectedUserId` before it saves the Wilma session token and credentials [@auth-broker]. If link completion fails, the broker signs out of Supabase, clears Wilma GraphQL session material, and clears the pending-link key so the app does not keep a half-linked local state [@auth-broker] [@graphql-client].

## Stored Session Consequences

The broker deliberately writes the same `wilma_graphql_session` and `wilma_graphql_credentials` keys as the dashboard GraphQL client [@auth-broker] [@graphql-client]. That means a successful Wilma auth exchange, new-account creation, or legacy link leaves the home dashboard ready to use the normal single-flight Wilma reauthentication path described in [Wilma GraphQL client and reauth](graphql-client-and-reauth) [@graphql-client]. Sign-out cleanup also crosses this boundary: `signOutGoogleAndSupabase` signs out of Supabase, calls `logoutMutation()` to clear Wilma GraphQL keys, and clears any pending legacy-link attempt [@google-auth] [@auth-broker] [@graphql-client].

Future auth work should preserve the order of checks. Supabase Auth is accepted only after the broker verifies the expected user id, and Wilma GraphQL credentials are saved only after that check passes [@auth-broker]. Skipping either step would allow a stale Supabase session or pending-link attempt to receive Wilma session material for the wrong app user.
