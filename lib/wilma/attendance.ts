import type { AttendanceEntry } from "@/lib/wilma/graphqlClient";
import { formatLocalISO } from "@/lib/wilma/scheduleDates";

/**
 * Attendance marks ("merkinnät") as the Wilma tab's card and the full list
 * page both show them, so the two cannot disagree on a mark's name, colour
 * or date.
 */

const TYPES: Record<number, { color: string; label: string }> = {
  10: { color: "#ff6b6b", label: "Poissaolo" },
  16: { color: "#a0522d", label: "Terveys" },
  31: { color: "#4caf50", label: "Koulutoiminta" },
  32: { color: "#ff9800", label: "Muu lupa" },
};

/** A mark's label and colour; unknown types fall back to Wilma's own status. */
export function attendanceType(entry: AttendanceEntry): { color: string; label: string } {
  return TYPES[entry.typeCode] ?? { color: "#aaaaaa", label: entry.status };
}

/**
 * A mark's date as `YYYY-MM-DD`. The API sends either that or Finnish
 * `D.M.YYYY`; normalising lets marks sort and compare as plain strings.
 */
export function markISO(date: string): string {
  if (date.includes("-")) return date;
  const [day, month, year] = date.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** "3.10." for this year, "3.10.2025" for any other. */
export function formatMarkDate(date: string): string {
  const [year, month, day] = markISO(date).split("-");
  const short = `${Number(day)}.${Number(month)}.`;
  return year === String(new Date().getFullYear()) ? short : `${short}${year}`;
}

/** Whether a mark falls within the last `days` days, today included. */
export function markWithinDays(date: string, days: number, now = new Date()): boolean {
  const since = new Date(now);
  since.setDate(now.getDate() - (days - 1));
  return markISO(date) >= formatLocalISO(since);
}

/** Newest first. */
export function sortMarks(entries: AttendanceEntry[]): AttendanceEntry[] {
  return [...entries].sort((a, b) => markISO(b.date).localeCompare(markISO(a.date)));
}
