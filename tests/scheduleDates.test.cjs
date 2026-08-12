const assert = require("node:assert/strict");
const test = require("node:test");
const {
  formatLocalISO,
  getInitialSchoolDay,
  getMondayOfWeek,
  getSchoolWeekDays,
} = require("../.expo/schedule-dates-test-build/scheduleDates.js");

test("school weeks contain only Monday through Friday", () => {
  const monday = new Date(2026, 7, 10, 0, 0, 0);
  assert.deepEqual(getSchoolWeekDays(monday), [
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
  ]);
});

test("local dates are not shifted by UTC serialization", () => {
  assert.equal(formatLocalISO(new Date(2026, 7, 10, 0, 0, 0)), "2026-08-10");
});

test("Sunday resolves to the previous Monday and selects Friday", () => {
  const sunday = new Date(2026, 7, 16, 12, 0, 0);
  assert.equal(formatLocalISO(getMondayOfWeek(0, sunday)), "2026-08-10");
  assert.equal(getInitialSchoolDay(sunday), "2026-08-14");
});
