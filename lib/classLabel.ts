/**
 * A class as it is shown anywhere in the app: `24K`, never `24k`.
 *
 * A class typed into the app is upper-cased by the field that takes it, but
 * one that arrives from Wilma keeps whatever casing Wilma stored — and for a
 * Wilma-linked account the `class` column is immutable from the client (see
 * the `protect_wilma_profile_fields` trigger in
 * `20260808105737_onboarding_and_consents.sql`), so it cannot be repaired in
 * place. Every screen that prints a class runs it through here instead.
 */
export function formatClassLabel(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}
