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
  end: () => Promise<void>;
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

export async function endLessonActivity(): Promise<void> {
  if (!native || Platform.OS !== "ios") return;
  try {
    await native.end();
  } catch {
    // Ending is best effort — a stale card is not worth surfacing an error.
  }
}
