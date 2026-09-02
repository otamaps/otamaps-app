/**
 * Pure helpers for the lunch-shift (ruokailuvuorot) feature: validating the
 * JSON an admin pastes in after running it through Claude, and matching a
 * student's today's Wilma course codes against the saved shift data.
 *
 * Kept free of React Native and Supabase imports so it can be compiled and
 * unit tested on its own, following the same pattern as `queueFormattingCore.ts`.
 */

export type LunchShiftSlot = {
  weekday: number;
  startTime: string;
  endTime: string;
  shift: 1 | 2 | null;
  courseCodes: string[];
};

export type LunchShiftImportPayload = {
  periodLabel: string;
  slots: LunchShiftSlot[];
};

export type LunchShiftRow = {
  weekday: number;
  startTime: string;
  endTime: string;
  shift: 1 | 2 | null;
  courseCodes: string[];
};

export type LunchMatch = {
  startTime: string;
  endTime: string;
  shift: 1 | 2 | null;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WILMA_CODE_SHAPE_RE = /^[A-ZÄÖ]{2,4}\d{1,3}(\.[A-Z0-9]{1,3})?$/;

export function normalizeCourseCode(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("fi-FI");
}

/**
 * Claude.ai often wraps output in a ```json fence even when told not to.
 * Strips a single leading/trailing fence if present; otherwise a no-op.
 */
export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : trimmed;
}

type ValidationSuccess = {
  ok: true;
  payload: LunchShiftImportPayload;
  warnings: string[];
};
type ValidationFailure = { ok: false; errors: string[] };

export function validateLunchShiftImport(
  raw: string
): ValidationSuccess | ValidationFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    return { ok: false, errors: ["Teksti ei ole kelvollista JSON-muotoa."] };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, errors: ["JSON:n tulee olla objekti."] };
  }
  const obj = parsed as Record<string, unknown>;

  const errors: string[] = [];
  const warnings: string[] = [];

  const periodLabel =
    typeof obj.periodLabel === "string" ? obj.periodLabel : "";
  if (typeof obj.periodLabel !== "string") {
    errors.push("periodLabel: puuttuu tai ei ole merkkijono.");
  }

  if (!Array.isArray(obj.slots)) {
    errors.push("slots: puuttuu tai ei ole taulukko.");
    return { ok: false, errors };
  }
  if (obj.slots.length === 0) {
    errors.push("slots: taulukko on tyhjä.");
    return { ok: false, errors };
  }

  const slots: LunchShiftSlot[] = [];
  const seenKeys = new Set<string>();

  obj.slots.forEach((rawSlot, index) => {
    const prefix = `slots[${index}]`;
    if (typeof rawSlot !== "object" || rawSlot === null) {
      errors.push(`${prefix}: ei ole objekti.`);
      return;
    }
    const slot = rawSlot as Record<string, unknown>;

    const weekday = Number(slot.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
      errors.push(
        `${prefix}.weekday: odotettiin kokonaislukua 1-5, saatiin ${JSON.stringify(
          slot.weekday
        )}.`
      );
    }

    const startTime = typeof slot.startTime === "string" ? slot.startTime : "";
    if (!TIME_RE.test(startTime)) {
      errors.push(
        `${prefix}.startTime: odotettiin muotoa HH:MM, saatiin ${JSON.stringify(
          slot.startTime
        )}.`
      );
    }

    const endTime = typeof slot.endTime === "string" ? slot.endTime : "";
    if (!TIME_RE.test(endTime)) {
      errors.push(
        `${prefix}.endTime: odotettiin muotoa HH:MM, saatiin ${JSON.stringify(
          slot.endTime
        )}.`
      );
    } else if (TIME_RE.test(startTime) && endTime <= startTime) {
      errors.push(`${prefix}.endTime: tulee olla myöhemmin kuin startTime.`);
    }

    let shift: 1 | 2 | null = null;
    if (slot.shift === 1 || slot.shift === 2) {
      shift = slot.shift;
    } else if (slot.shift !== null && slot.shift !== undefined) {
      errors.push(
        `${prefix}.shift: odotettiin arvoa 1, 2 tai null, saatiin ${JSON.stringify(
          slot.shift
        )}.`
      );
    }

    let courseCodes: string[] = [];
    if (
      !Array.isArray(slot.courseCodes) ||
      slot.courseCodes.length === 0 ||
      !slot.courseCodes.every((c) => typeof c === "string" && c.trim())
    ) {
      errors.push(
        `${prefix}.courseCodes: odotettiin ei-tyhjää merkkijonotaulukkoa.`
      );
    } else {
      courseCodes = slot.courseCodes.map((c) => (c as string).trim());
      for (const code of courseCodes) {
        if (!WILMA_CODE_SHAPE_RE.test(normalizeCourseCode(code))) {
          warnings.push(
            `${prefix}.courseCodes: "${code}" ei näytä Wilma-kurssikoodilta — tarkista, ettei kyseessä ole esim. "Yht."-sarake tai keksitty paikkamerkki.`
          );
        }
      }
    }

    if (errors.length === 0 || !errors.some((e) => e.startsWith(prefix))) {
      const key = `${weekday}|${startTime}|${shift ?? ""}`;
      if (seenKeys.has(key)) {
        warnings.push(
          `${prefix}: rivi (weekday=${weekday}, startTime=${startTime}, shift=${
            shift ?? "null"
          }) esiintyy useammin kuin kerran.`
        );
      }
      seenKeys.add(key);
    }

    slots.push({ weekday, startTime, endTime, shift, courseCodes });
  });

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, payload: { periodLabel, slots }, warnings };
}

/**
 * Matches a student's today's course codes against the saved shift rows for
 * today's weekday. Returns `null` on no match, and also on an ambiguous
 * match spanning more than one distinct time window — never guess.
 */
export function matchLunchShift(
  todaysCourseCodes: string[],
  weekdayRows: LunchShiftRow[]
): LunchMatch | null {
  const normalizedCodes = new Set(
    todaysCourseCodes.map(normalizeCourseCode).filter(Boolean)
  );
  if (normalizedCodes.size === 0) return null;

  const matches = weekdayRows.filter((row) =>
    row.courseCodes.some((code) => normalizedCodes.has(normalizeCourseCode(code)))
  );
  if (matches.length === 0) return null;

  const distinctWindows = new Set(
    matches.map((m) => `${m.startTime}|${m.endTime}|${m.shift ?? ""}`)
  );
  if (distinctWindows.size > 1) return null;

  const { startTime, endTime, shift } = matches[0];
  return { startTime, endTime, shift };
}

/** `11:20:00` and `11:20` both compare as `11:20`. */
export function clockValue(value: string): string {
  return value.slice(0, 5);
}

/** Adds whole minutes to a `HH:MM` clock value, for same-day comparisons. */
export function addMinutesClock(clock: string, minutes: number): string {
  const [h, m] = clock.split(":").map(Number);
  const total = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Minutes since midnight for a `HH:MM` (or `HH:MM:SS`) clock value. */
export function clockMinutes(clock: string): number {
  const [h, m] = clockValue(clock).split(":").map(Number);
  return h * 60 + m;
}

export type FreeSlot = { start: string; end: string };

/** Below this, a free slot renders at the normal row height. */
const FREE_SLOT_TALL_THRESHOLD_MINUTES = 105;
const FREE_SLOT_BASELINE_MINUTES = 75;
const FREE_SLOT_BASELINE_HEIGHT = 56;
const FREE_SLOT_MAX_HEIGHT = 200;

/**
 * A minimum row height for a free slot longer than
 * `FREE_SLOT_TALL_THRESHOLD_MINUTES`, scaled roughly against a typical
 * lesson's length so a long "Hyppytunti" reads as visibly longer than the
 * lessons around it. Returns `undefined` below the threshold, meaning the
 * row should just use its normal content-driven height. Capped so a whole
 * free afternoon doesn't blow out the layout.
 */
export function freeSlotHeight(durationMinutes: number): number | undefined {
  if (durationMinutes <= FREE_SLOT_TALL_THRESHOLD_MINUTES) return undefined;
  return Math.min(
    FREE_SLOT_MAX_HEIGHT,
    Math.round(FREE_SLOT_BASELINE_HEIGHT * (durationMinutes / FREE_SLOT_BASELINE_MINUTES))
  );
}

/** A lesson this long or longer (three hours) renders taller than usual. */
const LESSON_TALL_THRESHOLD_MINUTES = 180;

/**
 * A minimum row height for a lesson at least `LESSON_TALL_THRESHOLD_MINUTES`
 * long, scaled the same way as `freeSlotHeight` so a three-hour-plus lesson
 * reads as visibly taller than the ordinary ~75 minute ones around it.
 * Returns `undefined` below the threshold, meaning the row should just use
 * its normal content-driven height.
 */
export function lessonHeight(durationMinutes: number): number | undefined {
  if (durationMinutes < LESSON_TALL_THRESHOLD_MINUTES) return undefined;
  return Math.min(
    FREE_SLOT_MAX_HEIGHT,
    Math.round(FREE_SLOT_BASELINE_HEIGHT * (durationMinutes / FREE_SLOT_BASELINE_MINUTES))
  );
}

/** Below this, a gap between two lessons is a passing period, not a free slot. */
export const FREE_SLOT_MIN_GAP_MINUTES = 20;

/**
 * The school day's fixed lesson periods. A gap between two lessons that
 * skips over more than one of these is split into one free slot per period
 * (see `splitLessonGap`) rather than shown as a single oversized block.
 */
export const LESSON_SLOTS: FreeSlot[] = [
  { start: "08:30", end: "09:45" },
  { start: "10:00", end: "11:15" },
  { start: "11:20", end: "13:15" },
  { start: "13:30", end: "14:45" },
  { start: "15:00", end: "16:15" },
];

export type DayGapPiece =
  | { kind: "freeslot"; start: string; end: string }
  | { kind: "lunch"; start: string; end: string };

/**
 * Splits the gap strictly between two consecutive lessons — a schedule's
 * "Hyppytunti" (free/jump period), or the day's lunch break — into the
 * pieces it should render as. `lessonA` ends where the gap starts, `lessonB`
 * starts where it ends.
 *
 * - A gap of `FREE_SLOT_MIN_GAP_MINUTES` or less is a passing period, not a
 *   real gap, and produces nothing.
 * - When both flanking lessons are three hours or longer (`LESSON_TALL_THRESHOLD_MINUTES`),
 *   the whole gap is the day's lunch break rather than a free slot — a day
 *   condensed into two long blocks has no "Hyppytunti", just lunch between
 *   them.
 * - Otherwise it's genuine free time. A gap spanning more than one of the
 *   day's fixed lesson slots (e.g. a lesson ending at 9:45 followed by one
 *   starting at 13:30, skipping two whole periods) is returned as one piece
 *   per period it fully covers, rather than a single piece spanning the
 *   whole gap.
 */
export function splitLessonGap(
  lessonA: { start: string; end: string },
  lessonB: { start: string; end: string }
): DayGapPiece[] {
  const start = clockValue(lessonA.end);
  const end = clockValue(lessonB.start);
  if (clockMinutes(end) - clockMinutes(start) <= FREE_SLOT_MIN_GAP_MINUTES) {
    return [];
  }

  const lessonADuration = clockMinutes(clockValue(lessonA.end)) - clockMinutes(clockValue(lessonA.start));
  const lessonBDuration = clockMinutes(clockValue(lessonB.end)) - clockMinutes(clockValue(lessonB.start));
  if (
    lessonADuration >= LESSON_TALL_THRESHOLD_MINUTES &&
    lessonBDuration >= LESSON_TALL_THRESHOLD_MINUTES
  ) {
    return [{ kind: "lunch", start, end }];
  }

  const coveredLessonSlots = LESSON_SLOTS.filter(
    (slot) =>
      clockMinutes(slot.start) >= clockMinutes(start) &&
      clockMinutes(slot.end) <= clockMinutes(end)
  );
  const pieces = coveredLessonSlots.length ? coveredLessonSlots : [{ start, end }];
  return pieces.map((piece) => ({ kind: "freeslot", ...piece }));
}

export type LessonFragment = { start: string; end: string };

/**
 * How a lunch window cuts into one lesson. The school schedules lunch *inside*
 * a long midday block (an 11:20–13:15 lesson containing a 12:10–12:50 lunch),
 * so that lesson renders as the part before lunch and the part after it rather
 * than as one row the lunch appears to follow.
 *
 * Times may arrive as `HH:MM` or Wilma's `HH:MM:SS`; both compare as `HH:MM`.
 * Returns `null` when the lunch does not overlap this lesson at all — touching
 * boundaries do not count, so a lesson ending exactly when lunch starts is not
 * interrupted by it. Either fragment is `null` when the lunch starts or ends on
 * the lesson boundary and would leave a zero-length piece.
 */
export function lunchSplit(
  lessonStart: string,
  lessonEnd: string,
  lunch: LunchMatch
): { before: LessonFragment | null; after: LessonFragment | null } | null {
  const start = clockValue(lessonStart);
  const end = clockValue(lessonEnd);
  const lunchStart = clockValue(lunch.startTime);
  const lunchEnd = clockValue(lunch.endTime);

  if (!(lunchStart < end && lunchEnd > start)) return null;

  return {
    before: lunchStart > start ? { start, end: lunchStart } : null,
    after: lunchEnd < end ? { start: lunchEnd, end } : null,
  };
}

export type LunchWindow = { start: string; end: string };

export type DaySlot<L> =
  | { kind: "lesson"; lesson: L; start: string; end: string; lunch: LunchWindow | null }
  | { kind: "freeslot"; key: string; start: string; end: string; lunch: LunchWindow | null }
  | { kind: "lunch"; start: string; end: string };

/**
 * One school day's lessons, interleaved with its free slots ("Hyppytunti")
 * and lunch window, in chronological order:
 *  - A gap only appears in a real gap between two lessons (5–20 minute
 *    passing periods are excluded), and is either a free slot or, when both
 *    flanking lessons are three-hour blocks, the day's lunch break — see
 *    `splitLessonGap`.
 *  - A configured lunch shift nests inside whichever lesson or free slot it
 *    overlaps, sitting on its own row only when it falls outside every
 *    lesson and free slot.
 *  - A lunch straddling the boundary between two adjacent slots is kept only
 *    on the later of the two, so it's never shown twice.
 *
 * `lessons` need not be pre-sorted. `getKey` derives a stable id per lesson,
 * used to key the free slot(s) that follow it.
 */
export function buildDaySlots<L extends { start: string; end: string }>(
  lessons: L[],
  lunch: LunchMatch | null,
  getKey: (lesson: L) => string
): DaySlot<L>[] {
  const sortedLessons = [...lessons].sort((a, b) => a.start.localeCompare(b.start));

  type Slot =
    | { kind: "lesson"; lesson: L; start: string; end: string }
    | { kind: "freeslot"; key: string; start: string; end: string }
    | { kind: "lunch"; start: string; end: string };

  const slots: Slot[] = [];
  sortedLessons.forEach((lesson, i) => {
    slots.push({
      kind: "lesson",
      lesson,
      start: clockValue(lesson.start),
      end: clockValue(lesson.end),
    });
    const nextLesson = sortedLessons[i + 1];
    if (!nextLesson) return;
    splitLessonGap(lesson, nextLesson).forEach((piece, pieceIndex) => {
      slots.push(
        piece.kind === "lunch"
          ? { kind: "lunch", start: piece.start, end: piece.end }
          : {
              kind: "freeslot",
              key: `gap:${getKey(lesson)}:${pieceIndex}`,
              start: piece.start,
              end: piece.end,
            }
      );
    });
  });

  const nestedLunchFor = (start: string, end: string): LunchWindow | null => {
    const split = lunch ? lunchSplit(start, end, lunch) : null;
    return split && lunch
      ? { start: clockValue(lunch.startTime), end: clockValue(lunch.endTime) }
      : null;
  };

  // A lunch spanning the short boundary between two adjacent slots (a lesson
  // ending right where the next one starts, or a lesson and its free slot)
  // would otherwise get nested — and shown — in both. Keep it only on the
  // last slot of each run that overlaps it.
  const rawLunch = slots.map((slot) => nestedLunchFor(slot.start, slot.end));
  const dedupedLunch = rawLunch.map((entry, i) => (rawLunch[i + 1] ? null : entry));

  const rows: DaySlot<L>[] = slots.map((slot, i) =>
    slot.kind === "lesson"
      ? { kind: "lesson", lesson: slot.lesson, start: slot.start, end: slot.end, lunch: dedupedLunch[i] }
      : slot.kind === "freeslot"
        ? { kind: "freeslot", key: slot.key, start: slot.start, end: slot.end, lunch: dedupedLunch[i] }
        : { kind: "lunch", start: slot.start, end: slot.end }
  );

  // A lunch that falls outside every lesson and every free slot still
  // belongs on the day.
  if (lunch && !dedupedLunch.some(Boolean)) {
    rows.push({
      kind: "lunch",
      start: clockValue(lunch.startTime),
      end: clockValue(lunch.endTime),
    });
  }

  const sortedRows = rows.sort((a, b) => a.start.localeCompare(b.start));

  // A free slot only makes sense after a lesson has already happened —
  // drop one that would otherwise open the list. A chain of several split
  // free slots (see `splitLessonGap`) is fine; only a leading one is dropped.
  return sortedRows.filter((row, i) => row.kind !== "freeslot" || i > 0);
}
