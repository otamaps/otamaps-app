---
title: "SumUp Payment Boundary"
summary: "The SumUp payment boundary keeps checkout creation behind an authenticated backend endpoint while the mobile app initializes and presents the SumUp payment sheet for FabLab print jobs."
topics: [architecture, fablab, payments, sumup, configuration]
sources:
  - id: root-layout
    type: file
    path: app/_layout.tsx
  - id: package
    type: file
    path: package.json
  - id: sumup-patch
    type: file
    path: patches/sumup-react-native-alpha+0.1.36.patch
  - id: job-detail
    type: file
    path: app/(tabs)/fablab/[jobId].tsx
  - id: checkout-hook
    type: file
    path: hooks/useCheckout.ts
  - id: sumup-service
    type: file
    path: lib/sumupService.ts
  - id: setup-doc
    type: file
    path: docs/SUMUP_CHECKOUT_SETUP.md
  - id: rn-sdk-doc
    type: file
    path: llm/sumup.md
  - id: node-sdk-doc
    type: file
    path: llm/sumupsdk.md
---

# SumUp Payment Boundary

The SumUp payment boundary is the split between FabLab job payment UI in the React Native app and checkout creation outside the app. The active print-job detail screen gets the user's Supabase access token, posts to `EXPO_PUBLIC_BACKEND_URL + /jobs/:id/checkout`, expects a `checkoutId`, and then uses `sumup-react-native-alpha` to initialize and present the payment sheet [@job-detail]. The root layout supplies the SumUp provider with `EXPO_PUBLIC_SUMUP_API_KEY`, but the active job-payment path does not call the local `lib/sumupService.ts` checkout creator [@root-layout] [@job-detail] [@sumup-service].

## Runtime Path

`app/_layout.tsx` wraps the app navigation in `SumUpProvider` and passes `process.env.EXPO_PUBLIC_SUMUP_API_KEY || ''` as the provider public key [@root-layout]. The print job detail route calls `useSumUp()` directly to obtain `initPaymentSheet` and `presentPaymentSheet` [@job-detail]. This means the payment sheet dependency is available globally, while job-specific checkout creation is triggered only from statuses that expose payment UI.

When the user taps "Pay Now" or the inline "Pay" button, `handlePayNow()` requires a loaded job and an authenticated Supabase session [@job-detail]. It sends a POST request to `${BACKEND_URL}/jobs/${job.id}/checkout` with `Authorization: Bearer <access_token>`, handles non-2xx responses by reading an optional JSON `message`, and expects the success response body to contain `checkoutId` [@job-detail]. The checkout id is then passed to `initPaymentSheet({ checkoutId })`, and a successful initialization is followed by `presentPaymentSheet()` [@job-detail].

The native payment sheet dependency has an iOS build compatibility patch. `package.json` runs `patch-package` after install, and `patches/sumup-react-native-alpha+0.1.36.patch` removes the SDK podspec's New Architecture-only React Codegen, RCT-Folly, RCTRequired, RCTTypeSafety, and ReactCommon turbomodule dependencies [@package] [@sumup-patch]. Keep that patch with the `sumup-react-native-alpha` version unless the SDK is upgraded and the replacement podspec is proven against an iOS EAS archive.

## Backend And Secret Boundary

The active screen treats the backend as the checkout authority. The mobile app sends only the authenticated job request to `/jobs/:id/checkout`; it does not include amount, merchant code, or a SumUp secret in that request [@job-detail]. This fits the SumUp React Native guide copied into the repository, which says checkout ids are created on a backend and then passed to the SDK payment sheet [@rn-sdk-doc].

`lib/sumupService.ts` is a separate client-side service that constructs an `@sumup/sdk` client from `EXPO_PUBLIC_SUMUP_SECRET_KEY` or `EXPO_PUBLIC_SUMUP_API_KEY`, logs key metadata, patches global `fetch` to log SumUp API traffic, and creates checkouts directly with a merchant code and generated reference [@sumup-service]. `hooks/useCheckout.ts` wraps that service with `initPaymentSheet()` and `presentPaymentSheet()`, but the current FabLab job detail route bypasses the hook and implements its own backend checkout call [@checkout-hook] [@job-detail]. The Node SDK note says the SDK can create checkouts with a secret API key supplied to `new SumUp({ apiKey })`, which explains the service's dependency shape, but that is not the path used by the FabLab job detail screen [@node-sdk-doc] [@job-detail].

Because `EXPO_PUBLIC_*` values are exposed to the Expo client bundle, future production work should keep SumUp secret-key checkout creation outside the mobile app and behind the authenticated backend endpoint already used by job detail [@sumup-service] [@job-detail]. The local service is still important evidence because it imports the Node SDK into client code and installs a global fetch patch when imported, so future maintainers should avoid accidentally wiring it into the active FabLab route without revisiting the secret boundary [@sumup-service].

## Stale Setup Document

`docs/SUMUP_CHECKOUT_SETUP.md` describes an older FabLab integration: machine selection, a checkout card, in-memory machine prices, and a file named `app/(tabs)/fablab.tsx` [@setup-doc]. The current route tree in the active code uses `app/(tabs)/fablab/index.tsx`, `new-print.tsx`, and `[jobId].tsx` for print jobs instead [@job-detail]. Treat the setup document as historical intent for SumUp integration, not as current behavior for the FabLab product surface.

The same document tells maintainers to configure `EXPO_PUBLIC_SUMUP_API_KEY` with a secret-looking `sup_sk_` value [@setup-doc]. Current code separates the provider key read in the root layout from the backend checkout endpoint used by job detail, while `lib/sumupService.ts` still allows a public Expo environment variable to hold a secret key [@root-layout] [@job-detail] [@sumup-service]. This mismatch is the main gotcha for payment changes.

## Status Coupling

The payment boundary is coupled to [print upload and status](print-upload-and-status) through job statuses and estimated fields. The detail route shows the larger cost card when status is `cost_estimated`, shows the compact payment-required panel when status is `awaiting_payment`, and relies on realtime job updates after a payment attempt rather than manually marking the job paid [@job-detail]. The job model supports `estimated_cost`, `estimated_grams`, and `estimated_duration_minutes`, so the backend that creates checkouts must agree with the same cost fields that the user sees [@job-detail].

For the user-facing job model that payment belongs to, see [FabLab print jobs](../../concepts/fablab/print-jobs).
