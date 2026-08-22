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
