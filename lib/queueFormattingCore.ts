/**
 * Pure helpers for the Ruokalinjasto queue feature: reading the reporting
 * configuration that `public.get_queue_statuses()` returns, rendering it as
 * Finnish copy, and classifying report failures.
 *
 * Kept free of React Native and Supabase imports so it can be compiled and
 * unit tested on its own, following the same pattern as `canteenMenuCore.ts`.
 */

/**
 * Contract version of `public.get_queue_statuses()`. Bump this together with
 * the migration whenever the RPC gains columns the app depends on, so a
 * client/database mismatch is reported instead of silently disabling the
 * feature.
 */
export const QUEUE_STATUS_SCHEMA_VERSION = 2;

/**
 * The values the database hard-coded before migration 20260817002500 moved
 * them into `public.queue_areas`. They are the fallback for a client that
 * reaches an older database: the feature keeps behaving exactly as it did,
 * and the drift is reported rather than rendering an empty queue.
 */
export const LEGACY_QUEUE_CONFIG = {
  area_timezone: "Europe/Helsinki",
  report_opens_at: "10:45:00",
  report_closes_at: "12:30:00",
  slot_minutes: 15,
  report_weekdays: [1, 2, 3, 4, 5] as number[],
  min_community_reports: 1,
  crowd_window_minutes: 10,
};

export type ReportingWindowConfig = {
  report_weekdays: number[];
  report_opens_at: string;
  report_closes_at: string;
};

export type ReportingCopyStatus = ReportingWindowConfig & {
  reporting_open: boolean;
  current_user_reported: boolean;
  slot_minutes: number;
};

export type CanteenReportFailure =
  | "auth_required"
  | "invalid_level"
  | "reporting_closed"
  | "unknown_area"
  | "unknown";

const WEEKDAY_ABBREVIATIONS: Record<number, string> = {
  1: "ma",
  2: "ti",
  3: "ke",
  4: "to",
  5: "pe",
  6: "la",
  7: "su",
};

const KNOWN_FAILURES: CanteenReportFailure[] = [
  "auth_required",
  "invalid_level",
  "reporting_closed",
  "unknown_area",
];

export function asWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return LEGACY_QUEUE_CONFIG.report_weekdays;
  const days = value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return days.length ? days : LEGACY_QUEUE_CONFIG.report_weekdays;
}

export function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function asClock(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)
    ? value
    : fallback;
}

function formatClock(value: string): string {
  const [hours, minutes = "00"] = value.split(":");
  return `${Number(hours)}.${minutes}`;
}

function formatWeekdays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.every((day, index) => day === index + 1)) {
    return "arkisin";
  }
  if (sorted.length === 7) return "päivittäin";
  return sorted
    .map((day) => WEEKDAY_ABBREVIATIONS[day] ?? String(day))
    .join(", ");
}

/**
 * Renders the configured reporting window, e.g. `arkisin 10.45–12.30`. The
 * times come from `public.queue_areas`, so changing them is a data change
 * rather than a coordinated migration plus app release.
 */
export function formatReportingWindow(
  status: ReportingWindowConfig | null,
  options?: { withClock?: boolean }
): string {
  const days = formatWeekdays(
    status?.report_weekdays ?? LEGACY_QUEUE_CONFIG.report_weekdays
  );
  const opens = formatClock(
    status?.report_opens_at ?? LEGACY_QUEUE_CONFIG.report_opens_at
  );
  const closes = formatClock(
    status?.report_closes_at ?? LEGACY_QUEUE_CONFIG.report_closes_at
  );
  const clock = options?.withClock ? "klo " : "";
  return `${days} ${clock}${opens}–${closes}`;
}

export function getCanteenReportingText(
  status: ReportingCopyStatus | null
): string {
  if (!status?.reporting_open) {
    return `Raportointi ${formatReportingWindow(status)}`;
  }
  if (status.current_user_reported) {
    return `Olet osallistunut tähän ${status.slot_minutes} min jaksoon`;
  }
  return `Voit raportoida kerran jokaisessa ${status.slot_minutes} min jaksossa`;
}

/**
 * Maps a Postgres error onto a stable reason. Migration 20260817002500 tags
 * every rejection with a `detail` marker; the message-text branches below only
 * exist for databases that predate it.
 */
export function canteenFailureReason(error: {
  code?: string | null;
  details?: string | null;
  message?: string | null;
}): CanteenReportFailure {
  const detail = (error.details ?? "").trim() as CanteenReportFailure;
  if (KNOWN_FAILURES.includes(detail)) return detail;

  const message = error.message ?? "";
  if (/reporting is open/i.test(message)) return "reporting_closed";
  if (/between 1 and 5/i.test(message)) return "invalid_level";
  if (error.code === "42501") return "auth_required";
  return "unknown";
}
