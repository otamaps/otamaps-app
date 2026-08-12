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

/** Select today on weekdays and Friday when opening a schedule on the weekend. */
export function getInitialSchoolDay(baseDate = new Date()): string {
  const monday = getMondayOfWeek(0, baseDate);
  const schoolDays = getSchoolWeekDays(monday);
  const weekdayIndex = Math.min(4, Math.max(0, (baseDate.getDay() || 7) - 1));
  return schoolDays[weekdayIndex];
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
