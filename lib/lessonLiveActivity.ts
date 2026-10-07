import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import {
  endLessonActivity,
  isLiveActivityAvailable,
  startLessonActivity,
  type LessonActivitySegment,
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
  if (!enabled) {
    await clearCachedInputs();
    await endLessonActivity();
  }
}

/**
 * The inputs the card was last built from, kept so the app can rebuild it
 * while it is running in the background — woken for a beacon, with no Wilma
 * session or network to fetch the schedule again.
 */
const CACHED_INPUTS_KEY = "lessonLiveActivityInputs";

type CachedInputs = {
  lessons: LessonInput[];
  lunch: LunchMatch | null;
  /** The day they belong to, `YYYY-MM-DD`. */
  dayISO: string;
  /**
   * What the card last showed — current and next lesson — so a refresh can
   * skip when nothing has moved on. Absent until a push has actually landed.
   */
  signature?: string;
};

async function readCachedInputs(): Promise<CachedInputs | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_INPUTS_KEY);
    return raw ? (JSON.parse(raw) as CachedInputs) : null;
  } catch {
    return null;
  }
}

async function writeCachedInputs(inputs: CachedInputs): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHED_INPUTS_KEY, JSON.stringify(inputs));
  } catch {
    // A refresh that finds nothing cached simply does nothing.
  }
}

async function clearCachedInputs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHED_INPUTS_KEY);
  } catch {
    // Same: nothing cached is a safe state.
  }
}

/** Which lessons the card is showing, so an unchanged card is not re-sent. */
function cardSignature(
  current: ScheduleSegment | null,
  next: ScheduleSegment | null,
  isDark: boolean
): string {
  return [
    current?.start,
    current?.end,
    current?.title,
    next?.start,
    next?.title,
    isDark,
  ].join("|");
}

/** The phone's appearance right now, which the card cannot read for itself. */
function systemIsDark(): boolean {
  return Appearance.getColorScheme() === "dark";
}

// One listener for the life of the app: when the appearance changes while the
// app is running, rebuild the card so it follows. A change made with the app
// closed shows on the next sync.
let listeningForAppearance = false;
function followAppearance(): void {
  if (listeningForAppearance) return;
  listeningForAppearance = true;
  Appearance.addChangeListener(() => {
    void refreshLessonLiveActivityFromCache();
  });
}

/** Epoch seconds for an `HH:MM` clock value on `day`. */
function epochSecondsAt(day: Date, clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  const at = new Date(day);
  at.setHours(hours, minutes, 0, 0);
  return Math.round(at.getTime() / 1000);
}

/**
 * What the card calls a segment: the course code alone, which is short enough
 * to stay on one line and is what students go by. A segment without one — the
 * lunch window — keeps its title.
 */
function segmentLabel(segment: ScheduleSegment): string {
  return segment.code || segment.title;
}

/**
 * ActivityKit refuses an activity whose attributes and state together encode
 * to more than 4 KB. A day is well inside that, but a long list of long titles
 * is not, so cap what is sent and keep clear of the limit.
 */
const MAX_SEGMENTS = 14;
const MAX_TITLE_CHARS = 30;
const MAX_ROOM_CHARS = 14;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * The day's segments for the card, as it needs them to move on between
 * updates: only those not yet over, in time order, with text clipped.
 */
function activitySegments(
  segments: ScheduleSegment[],
  day: Date,
  nowSeconds: number
): LessonActivitySegment[] {
  return segments
    .map((segment) => ({
      title: clip(segmentLabel(segment), MAX_TITLE_CHARS),
      room: clip(segment.room ?? "", MAX_ROOM_CHARS),
      start: epochSecondsAt(day, segment.start),
      end: epochSecondsAt(day, segment.end),
    }))
    .filter((segment) => segment.end > segment.start && segment.end > nowSeconds)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .slice(0, MAX_SEGMENTS);
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
 * schedule a future update, so the card is given the whole day and works out
 * which lesson is on each time it is drawn. The module sets a `staleDate` at
 * the next boundary, when iOS redraws it once — enough to move on to the next
 * lesson without the app. Beyond that one redraw the card stays as drawn until
 * the app updates it again.
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

  await showDay(
    { lessons: options.lessons, lunch: options.lunch, dayISO: options.dayISO },
    options.now ?? new Date(),
    false
  );
}

/**
 * Rebuilds the card from the inputs it was last built from. For a moment the
 * app is awake without fresh schedule data — a beacon fix uploaded from the
 * background — when the card is worth re-arming: each update sets the next
 * `staleDate`, so the one redraw iOS gives it can fall on the next lesson
 * boundary again. Does nothing when the card would be unchanged.
 */
export async function refreshLessonLiveActivityFromCache(
  now: Date = new Date()
): Promise<void> {
  if (!isLiveActivityAvailable()) return;
  // Fixes can arrive back to back; one refresh at a time is plenty.
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    if (!(await isLessonLiveActivityEnabled())) return;

    const cached = await readCachedInputs();
    if (!cached) return;

    await showDay(cached, now, true);
  } finally {
    refreshInFlight = false;
  }
}

let refreshInFlight = false;

/**
 * Shows the card for `inputs`, or takes it down when there is nothing to show.
 * With `onlyIfChanged`, an unchanged card is left alone.
 */
async function showDay(
  inputs: CachedInputs,
  now: Date,
  onlyIfChanged: boolean
): Promise<void> {
  const day = parseLocalISO(inputs.dayISO);
  if (!day) return;

  // A card for tomorrow would count down through the evening and overnight,
  // which is noise rather than information.
  const isToday = day.toDateString() === now.toDateString();
  if (!isToday) {
    await clearCachedInputs();
    await endLessonActivity();
    return;
  }

  const segments = buildDaySegments(inputs.lessons, inputs.lunch);
  const nowClock = now.toTimeString().slice(0, 5);
  const { current, next } = nowAndNext(segments, nowClock);

  // Nothing left today — take the card down rather than leave an empty one.
  if (!current && !next) {
    await clearCachedInputs();
    await endLessonActivity();
    return;
  }

  const isDark = systemIsDark();
  const signature = cardSignature(current, next, isDark);
  if (onlyIfChanged && inputs.signature === signature) return;

  // Cached before the push, so a refresh has the day even if the push fails;
  // the signature only once it has landed, so a failed one is tried again.
  await writeCachedInputs({
    lessons: inputs.lessons,
    lunch: inputs.lunch,
    dayISO: inputs.dayISO,
  });

  followAppearance();
  const shown = await startLessonActivity({
    dayLabel: weekdayLabel(day),
    isDark,
    currentTitle: current ? segmentLabel(current) : "",
    currentRoom: current?.room ?? "",
    currentEndsAt: current ? epochSecondsAt(day, current.end) : undefined,
    currentStartsAt: current ? epochSecondsAt(day, current.start) : undefined,
    nextTitle: next ? segmentLabel(next) : "",
    nextRoom: next?.room ?? "",
    nextStartsAt: next ? epochSecondsAt(day, next.start) : undefined,
    segments: activitySegments(
      segments,
      day,
      Math.round(now.getTime() / 1000)
    ),
  });

  if (shown) {
    await writeCachedInputs({
      lessons: inputs.lessons,
      lunch: inputs.lunch,
      dayISO: inputs.dayISO,
      signature,
    });
  }
}
