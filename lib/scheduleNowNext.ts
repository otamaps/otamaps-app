import { clockMinutes, clockValue, type LunchMatch } from "./lunchShiftCore";

/**
 * One thing occupying a stretch of the school day. Lessons and the lunch
 * window are the same shape here because a Live Activity cares about "what is
 * happening and when does it end", not about which of the two it is.
 */
export type ScheduleSegment = {
  kind: "lesson" | "lunch";
  title: string;
  /** Wilma course code, empty when there is none. */
  code: string;
  room: string;
  /** `HH:MM`. */
  start: string;
  /** `HH:MM`. */
  end: string;
};

export type NowAndNext = {
  /** What is happening right now, or `null` outside the school day. */
  current: ScheduleSegment | null;
  /** What starts next, or `null` once the day is done. */
  next: ScheduleSegment | null;
};

type ShapedLesson = {
  start: string;
  end: string;
  title: string;
  code?: string;
  room?: string;
};

/**
 * The day's lessons plus its lunch window as one ordered list of segments.
 *
 * Lunch is a segment of its own rather than being folded into the lesson it
 * falls inside: during lunch, "lunch, until 12:50" is what a person wants to
 * read on their Lock Screen, not the three-hour block containing it.
 */
export function buildDaySegments(
  lessons: ShapedLesson[],
  lunch: LunchMatch | null
): ScheduleSegment[] {
  const segments: ScheduleSegment[] = lessons.map((lesson) => ({
    kind: "lesson",
    title: lesson.title,
    code: lesson.code ?? "",
    room: lesson.room ?? "",
    start: clockValue(lesson.start),
    end: clockValue(lesson.end),
  }));

  if (lunch) {
    segments.push({
      kind: "lunch",
      title: "Lounas",
      code: "",
      room: "",
      start: clockValue(lunch.startTime),
      end: clockValue(lunch.endTime),
    });
  }

  return segments.sort((a, b) =>
    a.start === b.start
      ? clockMinutes(a.end) - clockMinutes(b.end)
      : clockMinutes(a.start) - clockMinutes(b.start)
  );
}

/**
 * What is on at `nowClock` and what follows it.
 *
 * Two segments can cover the same minute — lunch sits inside a long midday
 * block, and ryhmänohjaus is laid over the ordinary timetable — so `current`
 * is whichever of them ends *soonest*. That is the one whose countdown is
 * worth showing, and it keeps lunch (short, inside a lesson) winning over the
 * block it interrupts.
 *
 * `next` is the earliest segment starting at or after `nowClock`, skipping
 * anything already counted as `current`.
 */
export function nowAndNext(
  segments: ScheduleSegment[],
  nowClock: string
): NowAndNext {
  const now = clockMinutes(nowClock);

  const live = segments
    .filter(
      (segment) =>
        clockMinutes(segment.start) <= now && now < clockMinutes(segment.end)
    )
    .sort((a, b) => clockMinutes(a.end) - clockMinutes(b.end));
  const current = live[0] ?? null;

  const upcoming = segments
    .filter((segment) => clockMinutes(segment.start) > now)
    .sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start));

  return { current, next: upcoming[0] ?? null };
}
