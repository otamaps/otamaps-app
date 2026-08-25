export function formatLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatFinnishDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

export function getMondayOfWeek(weekOffset = 0, baseDate = new Date()): Date {
  const monday = new Date(baseDate);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Local calendar dates for Monday through Friday. */
export function getSchoolWeekDays(monday: Date): string[] {
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return formatLocalISO(day);
  });
}

/** Read a local calendar date back without the UTC shift `new Date(iso)` adds. */
export function parseLocalISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

const WEEKDAY_LABELS = [
  "Sunnuntai",
  "Maanantai",
  "Tiistai",
  "Keskiviikko",
  "Torstai",
  "Perjantai",
  "Lauantai",
];

/** Finnish weekday name, for example `Maanantai`. */
export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()];
}

/** Short date without a year, for example `17.8.`. */
export function shortDateLabel(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.`;
}

/** Finnish weekday plus short date, for example `Maanantai 17.8.`. */
export function schoolDayLabel(date: Date): string {
  return `${weekdayLabel(date)} ${shortDateLabel(date)}`;
}

/**
 * The school day a single-day schedule view should show: today on Monday
 * through Friday, and the upcoming Monday when opened on a weekend.
 */
export function getActiveSchoolDay(baseDate = new Date()): Date {
  const weekday = baseDate.getDay();
  if (weekday === 0 || weekday === 6) return getMondayOfWeek(1, baseDate);
  const day = new Date(baseDate);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** ISO weekday for a date: 1 on Monday through 7 on Sunday. */
export function isoWeekdayOf(date: Date): number {
  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
}

export function getISOWeekNumber(date: Date): number {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function weekMonthLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) return start.toLocaleDateString("fi-FI", { month: "long", year: "numeric" });
  if (sameYear) {
    const first = start.toLocaleDateString("fi-FI", { month: "short" });
    const last = end.toLocaleDateString("fi-FI", { month: "long", year: "numeric" });
    return `${first} – ${last}`;
  }
  const first = start.toLocaleDateString("fi-FI", { month: "short", year: "numeric" });
  const last = end.toLocaleDateString("fi-FI", { month: "short", year: "numeric" });
  return `${first} – ${last}`;
}
