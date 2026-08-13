import type { ScheduleLesson } from "@/lib/wilma/graphqlClient";
import {
  formatLocalISO,
  getMondayOfWeek,
} from "@/lib/wilma/scheduleDates";
import { supabase } from "./supabase";
import { getUserPreferences } from "./userPreferences";
import { isMissingScheduleSharingSchema } from "./scheduleSharingSchema";
import {
  buildSharedWeek,
  cleanSharedText,
  type SharedScheduleLesson,
} from "./sharedScheduleCore";

export { buildSharedWeek, type SharedScheduleLesson } from "./sharedScheduleCore";

export type SharedWeeklySchedule = {
  user_id: string;
  week_start: string;
  lessons: SharedScheduleLesson[];
  updated_at: string;
};

export async function clearSharedWeeklySchedules(): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return;

  const { error } = await supabase
    .from("shared_weekly_schedules")
    .delete()
    .eq("user_id", session.user.id);
  if (error && !isMissingScheduleSharingSchema(error)) throw error;
}

export async function syncSharedWeeklySchedule(
  lessons: ScheduleLesson[],
  baseDate = new Date()
): Promise<SharedWeeklySchedule | null> {
  // Sharing is a cross-device consent. Never let a stale local preference
  // cache delete a snapshot that was enabled on another signed-in device.
  const preferences = await getUserPreferences({ forceRefresh: true });
  if (!preferences.schedule_sharing_enabled) {
    await clearSharedWeeklySchedules();
    return null;
  }

  const sharedWeek = buildSharedWeek(lessons, baseDate);
  const payload = {
    user_id: preferences.user_id,
    week_start: sharedWeek.weekStart,
    lessons: sharedWeek.lessons,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("shared_weekly_schedules")
    .upsert(payload, { onConflict: "user_id,week_start" })
    .select("user_id,week_start,lessons,updated_at")
    .single<SharedWeeklySchedule>();
  if (error) throw error;
  return data;
}

function parseSharedLessons(value: unknown): SharedScheduleLesson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((lesson) => {
    if (!lesson || typeof lesson !== "object") return [];
    const candidate = lesson as Record<string, unknown>;
    const date = cleanSharedText(candidate.date, 10);
    const start = cleanSharedText(candidate.start, 20);
    const end = cleanSharedText(candidate.end, 20);
    const subject = cleanSharedText(candidate.subject, 160);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !start || !end || !subject) {
      return [];
    }
    return [{
      id: cleanSharedText(candidate.id, 80) || `${date}:${start}:${subject}`,
      date,
      start,
      end,
      subject,
      room: cleanSharedText(candidate.room, 80),
    }];
  });
}

export async function fetchFriendSharedSchedule(
  friendId: string,
  baseDate = new Date()
): Promise<SharedWeeklySchedule | null> {
  const weekStart = formatLocalISO(getMondayOfWeek(0, baseDate));
  const { data, error } = await supabase
    .from("shared_weekly_schedules")
    .select("user_id,week_start,lessons,updated_at")
    .eq("user_id", friendId)
    .eq("week_start", weekStart)
    .maybeSingle<SharedWeeklySchedule>();
  if (error && isMissingScheduleSharingSchema(error)) return null;
  if (error) throw error;
  if (!data) return null;
  return { ...data, lessons: parseSharedLessons(data.lessons) };
}
