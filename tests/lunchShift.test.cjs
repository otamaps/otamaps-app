const assert = require("node:assert/strict");
const test = require("node:test");
const {
  lunchSplit,
  matchLunchShift,
  normalizeCourseCode,
  stripJsonFence,
  validateLunchShiftImport,
} = require("../.expo/lunch-shift-test-build/lunchShiftCore.js");

test("normalizeCourseCode trims, uppercases via fi-FI, and collapses whitespace", () => {
  assert.equal(normalizeCourseCode(" äi01.02 "), "ÄI01.02");
  assert.equal(normalizeCourseCode("ke01.01"), "KE01.01");
  assert.equal(normalizeCourseCode("ke 01 . 01"), "KE 01 . 01");
  assert.equal(normalizeCourseCode(undefined), "");
});

test("stripJsonFence strips a fenced block and is a no-op otherwise", () => {
  assert.equal(stripJsonFence('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(stripJsonFence('```\n{"a":1}\n```'), '{"a":1}');
  assert.equal(stripJsonFence('{"a":1}'), '{"a":1}');
});

const validSlot = {
  weekday: 1,
  startTime: "11:05",
  endTime: "11:45",
  shift: 1,
  courseCodes: ["ÄI01.02", "KE01.01"],
};

test("validateLunchShiftImport accepts a well-formed payload", () => {
  const result = validateLunchShiftImport(
    JSON.stringify({ periodLabel: "Jakso 1", slots: [validSlot] })
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.periodLabel, "Jakso 1");
  assert.equal(result.payload.slots.length, 1);
  assert.deepEqual(result.warnings, []);
});

test("validateLunchShiftImport rejects unparsable JSON with one clear error", () => {
  const result = validateLunchShiftImport("not json");
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
});

test("validateLunchShiftImport collects every field error in one pass, not fail-fast", () => {
  const result = validateLunchShiftImport(
    JSON.stringify({
      periodLabel: "Jakso 1",
      slots: [
        {
          weekday: 6,
          startTime: "25:99",
          endTime: "11:45",
          shift: 3,
          courseCodes: [],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("weekday")));
  assert.ok(result.errors.some((e) => e.includes("startTime")));
  assert.ok(result.errors.some((e) => e.includes("shift")));
  assert.ok(result.errors.some((e) => e.includes("courseCodes")));
  assert.equal(result.errors.length, 4);
});

test("validateLunchShiftImport rejects an empty slots array", () => {
  const result = validateLunchShiftImport(
    JSON.stringify({ periodLabel: "Jakso 1", slots: [] })
  );
  assert.equal(result.ok, false);
});

test("validateLunchShiftImport warns (but does not fail) on suspicious course codes", () => {
  const result = validateLunchShiftImport(
    JSON.stringify({
      periodLabel: "Jakso 1",
      slots: [{ ...validSlot, courseCodes: ["Yht."] }],
    })
  );
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length > 0);
});

test("validateLunchShiftImport does not warn on real Wilma code shapes with letter or 3-digit suffixes", () => {
  const result = validateLunchShiftImport(
    JSON.stringify({
      periodLabel: "Jakso 1",
      slots: [
        { ...validSlot, courseCodes: ["TO01.A", "ÄI05.TU", "ENA04.AE", "MAY01.D1", "EAB304.01", "SAB201.01"] },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, []);
});

test("validateLunchShiftImport warns on duplicate rows", () => {
  const result = validateLunchShiftImport(
    JSON.stringify({ periodLabel: "Jakso 1", slots: [validSlot, validSlot] })
  );
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes("useammin kuin kerran")));
});

const weekdayRows = [
  { weekday: 1, startTime: "11:05", endTime: "11:45", shift: 1, courseCodes: ["ÄI01.02"] },
  { weekday: 1, startTime: "11:50", endTime: "12:30", shift: 2, courseCodes: ["KE01.01"] },
];

test("matchLunchShift returns the single matching window", () => {
  assert.deepEqual(matchLunchShift(["ÄI01.02"], weekdayRows), {
    startTime: "11:05",
    endTime: "11:45",
    shift: 1,
  });
});

test("matchLunchShift returns null when nothing matches (graceful no-op)", () => {
  assert.equal(matchLunchShift(["GE01.23"], weekdayRows), null);
});

test("matchLunchShift returns null on an ambiguous match across two windows", () => {
  assert.equal(matchLunchShift(["ÄI01.02", "KE01.01"], weekdayRows), null);
});

test("matchLunchShift is case/whitespace-insensitive", () => {
  assert.deepEqual(matchLunchShift([" äi01.02 "], weekdayRows), {
    startTime: "11:05",
    endTime: "11:45",
    shift: 1,
  });
});

test("lunchSplit carves a lunch out of the middle of a long midday lesson", () => {
  // The real case from the schedule: 11:20-13:15 lesson, 12:10-12:50 lunch.
  assert.deepEqual(lunchSplit("11:20:00", "13:15:00", { startTime: "12:10", endTime: "12:50", shift: 2 }), {
    before: { start: "11:20", end: "12:10" },
    after: { start: "12:50", end: "13:15" },
  });
});

test("lunchSplit returns null when the lunch does not touch the lesson", () => {
  const lunch = { startTime: "12:10", endTime: "12:50", shift: 2 };
  assert.equal(lunchSplit("08:30", "09:45", lunch), null);
  assert.equal(lunchSplit("13:30", "14:45", lunch), null);
  // Abutting, not overlapping: lesson ends exactly when lunch starts.
  assert.equal(lunchSplit("11:20", "12:10", lunch), null);
  assert.equal(lunchSplit("12:50", "13:15", lunch), null);
});

test("lunchSplit drops zero-length fragments at the lesson boundaries", () => {
  assert.deepEqual(lunchSplit("12:10", "13:15", { startTime: "12:10", endTime: "12:50", shift: 1 }), {
    before: null,
    after: { start: "12:50", end: "13:15" },
  });
  assert.deepEqual(lunchSplit("11:20", "12:50", { startTime: "12:10", endTime: "12:50", shift: 1 }), {
    before: { start: "11:20", end: "12:10" },
    after: null,
  });
});

test("lunchSplit consumes a lesson the lunch fully covers", () => {
  assert.deepEqual(lunchSplit("12:15", "12:45", { startTime: "12:10", endTime: "12:50", shift: 1 }), {
    before: null,
    after: null,
  });
});
