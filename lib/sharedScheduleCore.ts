import { lessonLabel } from "./wilma/lessonLabels";
import {
  formatLocalISO,
  getMondayOfWeek,
  getSchoolWeekDays,
  isoWeekdayOf,
  parseLocalISO,
} from "./wilma/scheduleDates";

export type SharedScheduleLesson = {
  id: string;
  date: string;
  start: string;
  end: string;
  subject: string;
  /** Wilma course code, for example `GE01.23`. Empty when Wilma gave none. */
  code: string;
  room: string;
};

type ShareableScheduleLesson = {
  reservationId: string | number;
  class?: string | null;
  start?: string | null;
  end?: string | null;
  dateArray: string[];
  groups: {
    shortCaption?: string | null;
    fullCaption?: string | null;
    rooms: { longCaption?: string | null }[];
  }[];
};

export function cleanSharedText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function buildSharedWeek(
  lessons: ShareableScheduleLesson[],
  baseDate = new Date()
): { weekStart: string; lessons: SharedScheduleLesson[] } {
  const monday = getMondayOfWeek(0, baseDate);
  const weekStart = formatLocalISO(monday);
  const schoolDays = new Set(getSchoolWeekDays(monday));
  const shared: SharedScheduleLesson[] = [];
  const seen = new Set<string>();

  for (const lesson of lessons) {
    const group = lesson.groups[0];
    const label = lessonLabel(group?.shortCaption, group?.fullCaption, lesson.class);
    const subject = cleanSharedText(label.title, 160);
    const code = cleanSharedText(label.code, 40);
    const room = cleanSharedText(group?.rooms[0]?.longCaption, 80);
    for (const date of lesson.dateArray) {
      if (!schoolDays.has(date)) continue;
      const id = `${lesson.reservationId}:${date}`;
      if (seen.has(id)) continue;
      seen.add(id);
      shared.push({
        id,
        date,
        start: cleanSharedText(lesson.start, 20),
        end: cleanSharedText(lesson.end, 20),
        subject: subject || "Oppitunti",
        code,
        room,
      });
    }
  }

  shared.sort((a, b) =>
    a.date === b.date
      ? a.start.localeCompare(b.start)
      : a.date.localeCompare(b.date)
  );
  return { weekStart, lessons: shared };
}

export type WeeklyScheduleSnapshot = {
  week_start: string;
  lessons: SharedScheduleLesson[];
};

/**
 * The newest snapshot among `rows` that covers the same weekday as
 * `targetDay`, with only that weekday's lessons. Used when a friend has not
 * shared the current week yet: their previous weeks still say roughly what a
 * Tuesday looks like, so the sheet shows those instead of an empty day and
 * marks them as possibly outdated.
 */
export function pickStaleDayLessons(
  rows: WeeklyScheduleSnapshot[],
  targetDay: Date
): { weekStart: string; lessons: SharedScheduleLesson[] } | null {
  const weekday = isoWeekdayOf(targetDay);
  const newestFirst = [...rows].sort((a, b) =>
    b.week_start.localeCompare(a.week_start)
  );

  for (const row of newestFirst) {
    const lessons = row.lessons
      .filter((lesson) => {
        const date = parseLocalISO(lesson.date);
        return !!date && isoWeekdayOf(date) === weekday;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
    if (lessons.length) return { weekStart: row.week_start, lessons };
  }
  return null;
}
