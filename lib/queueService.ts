import {
  asClock,
  asPositiveInt,
  asWeekdays,
  canteenFailureReason,
  LEGACY_QUEUE_CONFIG,
  QUEUE_STATUS_SCHEMA_VERSION,
} from "@/lib/queueFormattingCore";
import { reportHandledMessage } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";

export {
  formatReportingWindow,
  getCanteenReportingText,
  QUEUE_STATUS_SCHEMA_VERSION,
} from "@/lib/queueFormattingCore";
export type { CanteenReportFailure } from "@/lib/queueFormattingCore";

import type { CanteenReportFailure } from "@/lib/queueFormattingCore";

export type QueueLevel = 1 | 2 | 3 | 4 | 5;
export type QueueStatusSource = "manual" | "community" | "crowd" | "none";

export type QueueStatus = {
  area_id: string;
  slug: string;
  name: string;
  room_id: string;
  floor: number;
  status_level: QueueLevel | null;
  status_source: QueueStatusSource;
  status_observed_at: string | null;
  activity_level: QueueLevel | null;
  reporting_open: boolean;
  report_count: number;
  contributor_count: number;
  current_user_contributions: number;
  current_user_reported: boolean;
  current_slot_start: string | null;
  schema_version: number;
  next_slot_start: string | null;
  area_timezone: string;
  report_opens_at: string;
  report_closes_at: string;
  slot_minutes: number;
  report_weekdays: number[];
  min_community_reports: number;
  crowd_window_minutes: number;
};

export type QueueActivity = {
  area_id: string;
  sample_count_10m: number;
  last_sample_at: string | null;
};

export type QueueObservation = {
  id: number;
  queue_area_id: string;
  level: QueueLevel;
  observed_at: string;
  crowd_sample_count: number;
};

export class CanteenReportError extends Error {
  readonly reason: CanteenReportFailure;

  constructor(reason: CanteenReportFailure, message: string) {
    super(message);
    this.name = "CanteenReportError";
    this.reason = reason;
  }
}

export const QUEUE_LEVEL_LABELS: Record<QueueLevel, string> = {
  1: "Olematon",
  2: "Lyhyt",
  3: "Normaali",
  4: "Pitkä",
  5: "Erittäin pitkä",
};

export const QUEUE_LEVEL_COLORS: Record<QueueLevel, string> = {
  1: "#2E9D59",
  2: "#73B94B",
  3: "#E2B93B",
  4: "#E88332",
  5: "#D94A4A",
};

const normalizeStatus = (row: Record<string, unknown>): QueueStatus => ({
  area_id: String(row.area_id),
  slug: String(row.slug),
  name: String(row.name),
  room_id: String(row.room_id),
  floor: Number(row.floor),
  status_level:
    row.status_level == null ? null : (Number(row.status_level) as QueueLevel),
  status_source: String(row.status_source) as QueueStatusSource,
  status_observed_at:
    row.status_observed_at == null ? null : String(row.status_observed_at),
  activity_level:
    row.activity_level == null
      ? null
      : (Number(row.activity_level) as QueueLevel),
  reporting_open: Boolean(row.reporting_open),
  report_count: Number(row.report_count ?? 0),
  contributor_count: Number(row.contributor_count ?? 0),
  current_user_contributions: Number(row.current_user_contributions ?? 0),
  current_user_reported: Boolean(row.current_user_reported),
  current_slot_start:
    row.current_slot_start == null ? null : String(row.current_slot_start),
  schema_version: Number(row.schema_version ?? 1),
  next_slot_start:
    row.next_slot_start == null ? null : String(row.next_slot_start),
  area_timezone:
    typeof row.area_timezone === "string" && row.area_timezone
      ? row.area_timezone
      : LEGACY_QUEUE_CONFIG.area_timezone,
  report_opens_at: asClock(
    row.report_opens_at,
    LEGACY_QUEUE_CONFIG.report_opens_at
  ),
  report_closes_at: asClock(
    row.report_closes_at,
    LEGACY_QUEUE_CONFIG.report_closes_at
  ),
  slot_minutes: asPositiveInt(
    row.slot_minutes,
    LEGACY_QUEUE_CONFIG.slot_minutes
  ),
  report_weekdays: asWeekdays(row.report_weekdays),
  min_community_reports: asPositiveInt(
    row.min_community_reports,
    LEGACY_QUEUE_CONFIG.min_community_reports
  ),
  crowd_window_minutes: asPositiveInt(
    row.crowd_window_minutes,
    LEGACY_QUEUE_CONFIG.crowd_window_minutes
  ),
});

let schemaDriftReported = false;

function reportSchemaDrift(statuses: QueueStatus[]): void {
  if (schemaDriftReported) return;
  const stale = statuses.find(
    (status) => status.schema_version < QUEUE_STATUS_SCHEMA_VERSION
  );
  if (!stale) return;

  schemaDriftReported = true;
  // Deliberately loud. Before the schema version existed, a missing column
  // simply read as `false` and switched the whole queue feature off with no
  // error anywhere.
  reportHandledMessage(
    "get_queue_statuses is older than the app expects; queue configuration fell back to built-in defaults",
    {
      area: "queue",
      operation: "get_queue_statuses",
      level: "warning",
      tags: {
        "queue.schema_version": stale.schema_version,
        "queue.expected_schema_version": QUEUE_STATUS_SCHEMA_VERSION,
      },
      extra: { slug: stale.slug },
    }
  );
}

export async function getQueueStatuses(): Promise<QueueStatus[]> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return [];

  const { data, error } = await supabase.rpc("get_queue_statuses");
  if (error) throw error;
  const statuses = ((data ?? []) as Record<string, unknown>[]).map(
    normalizeStatus
  );
  reportSchemaDrift(statuses);
  return statuses;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return false;

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data?.role === "admin";
}

export async function getAdminQueueActivity(): Promise<QueueActivity[]> {
  const { data, error } = await supabase.rpc("get_admin_queue_activity");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    area_id: String(row.area_id),
    sample_count_10m: Number(row.sample_count_10m),
    last_sample_at:
      row.last_sample_at == null ? null : String(row.last_sample_at),
  }));
}

export async function getQueueObservationHistory(
  queueAreaId: string
): Promise<QueueObservation[]> {
  const { data, error } = await supabase
    .from("queue_observations")
    .select("id, queue_area_id, level, observed_at, crowd_sample_count")
    .eq("queue_area_id", queueAreaId)
    .order("observed_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    queue_area_id: String(row.queue_area_id),
    level: Number(row.level) as QueueLevel,
    observed_at: String(row.observed_at),
    crowd_sample_count: Number(row.crowd_sample_count),
  }));
}

export async function recordQueueObservation(
  queueAreaId: string,
  level: QueueLevel
): Promise<void> {
  const { error } = await supabase.from("queue_observations").insert({
    queue_area_id: queueAreaId,
    level,
  });
  if (error) throw error;
}

export async function recordCanteenQueueReport(
  level: QueueLevel,
  status?: QueueStatus | null
): Promise<void> {
  // The two-argument overload only exists from migration 20260817002500 on.
  // Older databases keep the single-argument signature, so only address an
  // area explicitly once the status proves the new contract is deployed.
  const canAddressArea =
    !!status && status.schema_version >= QUEUE_STATUS_SCHEMA_VERSION;

  const { error } = await supabase.rpc(
    "record_canteen_queue_report",
    canAddressArea
      ? { input_level: level, area_slug: status!.slug }
      : { input_level: level }
  );
  if (!error) return;

  throw new CanteenReportError(
    canteenFailureReason(error),
    error.message || "Raportointi epäonnistui."
  );
}

export function getQueueLabel(level: QueueLevel | null): string {
  return level == null ? "Ei tuoretta tietoa" : QUEUE_LEVEL_LABELS[level];
}

export function getQueueColor(level: QueueLevel | null): string {
  return level == null ? "#7D8795" : QUEUE_LEVEL_COLORS[level];
}
