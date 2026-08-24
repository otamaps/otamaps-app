# SumUp checkout setup

OtaMaps creates SumUp checkouts on the authenticated backend. Never place a
SumUp secret key, merchant credential, or server API token in an
`EXPO_PUBLIC_*` variable: Expo embeds those values in the mobile bundle.

## Mobile configuration

Configure these public values locally in `.env` and in the matching EAS
environment:

```env
EXPO_PUBLIC_SUMUP_API_KEY=sup_pk_YOUR_PUBLIC_KEY_HERE
EXPO_PUBLIC_BACKEND_URL=https://api.example.com
```

`EXPO_PUBLIC_SUMUP_API_KEY` is the public key used by `SumUpProvider`.
`EXPO_PUBLIC_BACKEND_URL` is the authenticated service that owns checkout
creation. Do not configure a `sup_sk_*` value in the app.

## Checkout contract

The print-job detail screen sends:

```http
POST /jobs/:jobId/checkout
Authorization: Bearer <Supabase access token>
```

The backend must authenticate the user, authorize access to the job, derive the
amount and merchant account from trusted server-side data, create the SumUp
checkout with a server-held secret, and return:

```json
{ "checkoutId": "..." }
```

The app passes that identifier to the native SumUp payment sheet. Payment
status remains backend-authoritative and reaches the app through the existing
job update path.

## Secret handling

- Store the SumUp secret only in the backend secret manager.
- Store public mobile configuration in EAS environment variables instead of
  committing account-specific values.
- Revoke a credential immediately if it appears in Git history or a mobile
  bundle; deleting the current file does not invalidate the exposed value.
