const assert = require("node:assert/strict");
const test = require("node:test");
const {
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
