import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  endLessonActivity,
  isLiveActivityAvailable,
  startLessonActivity,
} from "@/modules/lesson-live-activity";
import type { LunchMatch } from "./lunchShiftCore";
import {
  buildDaySegments,
  nowAndNext,
  type ScheduleSegment,
} from "./scheduleNowNext";
import { parseLocalISO, weekdayLabel } from "./wilma/scheduleDates";

/** Device-local, like the debug-mode flag — a Live Activity is per phone. */
export const LIVE_ACTIVITY_ENABLED_KEY = "lessonLiveActivityEnabled";

export async function isLessonLiveActivityEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(LIVE_ACTIVITY_ENABLED_KEY)) === "true";
}

export async function setLessonLiveActivityEnabled(
  enabled: boolean
): Promise<void> {
  await AsyncStorage.setItem(LIVE_ACTIVITY_ENABLED_KEY, String(enabled));
  if (!enabled) await endLessonActivity();
}

/** Epoch seconds for an `HH:MM` clock value on `day`. */
function epochSecondsAt(day: Date, clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  const at = new Date(day);
  at.setHours(hours, minutes, 0, 0);
  return Math.round(at.getTime() / 1000);
}

function segmentLabel(segment: ScheduleSegment): string {
  return segment.code ? `${segment.title} ${segment.code}` : segment.title;
}

type LessonInput = {
  start: string;
  end: string;
  title: string;
  code?: string;
  room?: string;
};

/**
 * Brings the Lock Screen activity in line with `lessons`, or takes it down.
 *
 * Called whenever the app has fresh schedule data. iOS offers no way to
 * schedule a future update, so between calls the card keeps counting down
 * correctly but cannot move on to the next lesson by itself — the module sets
 * a `staleDate` at the next boundary so the system dims it instead of leaving
 * a finished lesson looking live.
 */
export async function syncLessonLiveActivity(options: {
  /** The lessons of the day being shown, already filtered to that day. */
  lessons: LessonInput[];
  lunch: LunchMatch | null;
  /** The day those lessons belong to, `YYYY-MM-DD`. */
  dayISO: string;
  now?: Date;
}): Promise<void> {
  if (!(await isLessonLiveActivityEnabled())) return;
  if (!isLiveActivityAvailable()) return;

  const now = options.now ?? new Date();
  const day = parseLocalISO(options.dayISO);
  if (!day) return;

  // A card for tomorrow would count down through the evening and overnight,
  // which is noise rather than information.
  const isToday = day.toDateString() === now.toDateString();
  if (!isToday) {
    await endLessonActivity();
    return;
  }

  const segments = buildDaySegments(options.lessons, options.lunch);
  const nowClock = now.toTimeString().slice(0, 5);
  const { current, next } = nowAndNext(segments, nowClock);

  // Nothing left today — take the card down rather than leave an empty one.
  if (!current && !next) {
    await endLessonActivity();
    return;
  }

  await startLessonActivity({
    dayLabel: weekdayLabel(day),
    currentTitle: current ? segmentLabel(current) : "",
    currentRoom: current?.room ?? "",
    currentEndsAt: current ? epochSecondsAt(day, current.end) : undefined,
    nextTitle: next ? segmentLabel(next) : "",
    nextRoom: next?.room ?? "",
    nextStartsAt: next ? epochSecondsAt(day, next.start) : undefined,
  });
}
