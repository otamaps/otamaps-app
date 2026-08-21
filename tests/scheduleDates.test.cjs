const assert = require("node:assert/strict");
const test = require("node:test");
const {
  formatLocalISO,
  getActiveSchoolDay,
  getMondayOfWeek,
  getSchoolWeekDays,
  parseLocalISO,
  schoolDayLabel,
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

test("Sunday resolves to the previous Monday", () => {
  const sunday = new Date(2026, 7, 16, 12, 0, 0);
  assert.equal(formatLocalISO(getMondayOfWeek(0, sunday)), "2026-08-10");
});

test("the active school day is today from Monday through Friday", () => {
  const wednesday = new Date(2026, 7, 12, 21, 30, 0);
  const active = getActiveSchoolDay(wednesday);
  assert.equal(formatLocalISO(active), "2026-08-12");
  assert.equal(active.getHours(), 0);
});

test("weekends look ahead to the upcoming Monday", () => {
  assert.equal(
    formatLocalISO(getActiveSchoolDay(new Date(2026, 7, 15, 12, 0, 0))),
    "2026-08-17"
  );
  assert.equal(
    formatLocalISO(getActiveSchoolDay(new Date(2026, 7, 16, 12, 0, 0))),
    "2026-08-17"
  );
});

test("local ISO dates parse back without a UTC day shift", () => {
  assert.equal(formatLocalISO(parseLocalISO("2026-08-17")), "2026-08-17");
  assert.equal(parseLocalISO("17.8.2026"), null);
});

test("day labels name the Finnish weekday and short date", () => {
  assert.equal(schoolDayLabel(new Date(2026, 7, 17, 12, 0, 0)), "Maanantai 17.8.");
});
