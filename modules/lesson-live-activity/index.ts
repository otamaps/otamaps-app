import { Platform, requireOptionalNativeModule } from "expo-modules-core";

/** One lesson, or the lunch window. Times are epoch seconds. */
export type LessonActivitySegment = {
  title: string;
  room: string;
  start: number;
  end: number;
};

/** What the Lock Screen should say. Times are epoch seconds. */
export type LessonActivitySnapshot = {
  dayLabel: string;
  currentTitle: string;
  currentRoom: string;
  currentEndsAt?: number;
  currentStartsAt?: number;
  nextTitle: string;
  nextRoom: string;
  nextStartsAt?: number;
  /**
   * The rest of the day. Lets the card move on to the next lesson by itself
   * between updates; `current*` and `next*` above are what it shows until
   * then, and all an older build reads.
   */
  segments?: LessonActivitySegment[];
  /** The phone's appearance, which the Lock Screen does not pass on reliably. */
  isDark?: boolean;
};

type LessonLiveActivityNativeModule = {
  isAvailable: () => boolean;
  start: (snapshot: LessonActivitySnapshot) => Promise<boolean>;
  end: (dismissAt?: number) => Promise<void>;
  /** Absent from a module built before the API had versions. */
  apiVersion?: () => number;
  /** Version 3 and later. */
  isActive?: () => boolean;
};

// Optional so a build without the widget extension — Android, or an iOS build
// made before this module existed — loads instead of crashing at import time.
const native = requireOptionalNativeModule<LessonLiveActivityNativeModule>(
  "LessonLiveActivity"
);

/**
 * Whether a Live Activity can be shown: iOS only, and only while the user
 * leaves Live Activities enabled for OtaMaps in Settings. They can turn that
 * off at any time, so this is worth re-checking rather than caching.
 */
export function isLiveActivityAvailable(): boolean {
  if (Platform.OS !== "ios" || !native) return false;
  try {
    return native.isAvailable();
  } catch {
    return false;
  }
}

/** Starts today's activity, or updates the one already on screen. */
export async function startLessonActivity(
  snapshot: LessonActivitySnapshot
): Promise<boolean> {
  if (!native || Platform.OS !== "ios") return false;
  try {
    return await native.start(snapshot);
  } catch {
    return false;
  }
}

/**
 * What the installed native module can do. This JavaScript can be updated over
 * the air to an app built with an older module, so anything newer than
 * version 1 is only used once the module says it is there: 0 for no module,
 * 1 for one without a version, 2 for one that can `end` with a delay, 3 for
 * one that can say whether a card is showing.
 */
export function lessonActivityApiVersion(): number {
  if (!native || Platform.OS !== "ios") return 0;
  try {
    return typeof native.apiVersion === "function" ? native.apiVersion() : 1;
  } catch {
    return 1;
  }
}

/**
 * Whether a lesson card is on the Lock Screen now, or `null` when this build of
 * the module cannot say.
 */
export function isLessonActivityRunning(): boolean | null {
  if (!native || Platform.OS !== "ios") return false;
  if (lessonActivityApiVersion() < 3 || typeof native.isActive !== "function") {
    return null;
  }
  try {
    return native.isActive();
  } catch {
    return null;
  }
}

/** Whether `endLessonActivity` can take a dismissal time. */
export function supportsDelayedEnd(): boolean {
  return lessonActivityApiVersion() >= 2;
}

/**
 * Ends the activity. With `dismissAt`, epoch seconds, it stays on the Lock
 * Screen as it is until then and takes no more updates. A module that cannot
 * delay is left alone rather than asked to end it now — see
 * `supportsDelayedEnd`.
 */
export async function endLessonActivity(dismissAt?: number): Promise<void> {
  if (!native || Platform.OS !== "ios") return;
  if (dismissAt !== undefined && !supportsDelayedEnd()) return;
  try {
    // No argument at all for an immediate end: an older module takes none, and
    // rejects a call that passes one, even `undefined`.
    if (dismissAt === undefined) await native.end();
    else await native.end(dismissAt);
  } catch {
    // Ending is best effort — a stale card is not worth surfacing an error.
  }
}
