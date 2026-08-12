type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

export function isMissingScheduleSharingSchema(
  error: unknown
): error is SupabaseLikeError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as SupabaseLikeError;
  if (["PGRST204", "PGRST205", "42703", "42P01"].includes(candidate.code ?? "")) {
    return true;
  }
  const message = candidate.message?.toLowerCase() ?? "";
  return (
    message.includes("schedule_sharing_enabled") ||
    message.includes("shared_weekly_schedules") ||
    message.includes("user_consent_events_purpose_check")
  );
}

export function scheduleSharingUnavailableError(): Error {
  return new Error(
    "Lukujärjestyksen jakaminen ei ole vielä käytettävissä. Yritä myöhemmin uudelleen."
  );
}
