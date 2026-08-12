import {
  formatLocalISO,
  getMondayOfWeek,
  getSchoolWeekDays,
} from "./wilma/scheduleDates";

export type SharedScheduleLesson = {
  id: string;
  date: string;
  start: string;
  end: string;
  subject: string;
  room: string;
};

type ShareableScheduleLesson = {
  reservationId: string | number;
  class?: string | null;
  start?: string | null;
  end?: string | null;
  dateArray: string[];
  groups: {
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
    const subject = cleanSharedText(group?.fullCaption || lesson.class, 160);
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
