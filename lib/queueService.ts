import { supabase } from "@/lib/supabase";

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
});

export async function getQueueStatuses(): Promise<QueueStatus[]> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return [];

  const { data, error } = await supabase.rpc("get_queue_statuses");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeStatus);
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
  level: QueueLevel
): Promise<void> {
  const { error } = await supabase.rpc("record_canteen_queue_report", {
    input_level: level,
  });
  if (error) throw error;
}

export function getCanteenReportingText(status: QueueStatus | null): string {
  if (!status?.reporting_open) return "Raportointi arkisin 10.45–12.30";
  if (status.current_user_reported) {
    return "Olet osallistunut tähän 15 min jaksoon";
  }
  return "Voit raportoida kerran jokaisessa 15 min jaksossa";
}

export function getQueueLabel(level: QueueLevel | null): string {
  return level == null ? "Ei tuoretta tietoa" : QUEUE_LEVEL_LABELS[level];
}

export function getQueueColor(level: QueueLevel | null): string {
  return level == null ? "#7D8795" : QUEUE_LEVEL_COLORS[level];
}
