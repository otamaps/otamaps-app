const assert = require("node:assert/strict");
const test = require("node:test");
const {
  asClock,
  asPositiveInt,
  asWeekdays,
  canteenFailureReason,
  formatReportingWindow,
  getCanteenReportingText,
  LEGACY_QUEUE_CONFIG,
} = require("../.expo/queue-test-build/queueFormattingCore.js");

const openWindow = {
  report_weekdays: [1, 2, 3, 4, 5],
  report_opens_at: "10:45:00",
  report_closes_at: "12:30:00",
};

test("renders the configured weekday window the way the old copy read", () => {
  assert.equal(formatReportingWindow(openWindow), "arkisin 10.45–12.30");
  assert.equal(
    formatReportingWindow(openWindow, { withClock: true }),
    "arkisin klo 10.45–12.30"
  );
});

test("follows the database when the window is reconfigured", () => {
  assert.equal(
    formatReportingWindow({
      report_weekdays: [1, 3, 5],
      report_opens_at: "09:00:00",
      report_closes_at: "11:15:00",
    }),
    "ma, ke, pe 9.00–11.15"
  );
  assert.equal(
    formatReportingWindow({
      report_weekdays: [1, 2, 3, 4, 5, 6, 7],
      report_opens_at: "10:45:00",
      report_closes_at: "12:30:00",
    }),
    "päivittäin 10.45–12.30"
  );
});

test("falls back to the pre-migration window when the status is missing", () => {
  assert.equal(formatReportingWindow(null), "arkisin 10.45–12.30");
  assert.equal(LEGACY_QUEUE_CONFIG.slot_minutes, 15);
});

test("reporting copy reflects the configured slot length", () => {
  assert.equal(
    getCanteenReportingText({ ...openWindow, reporting_open: false, current_user_reported: false, slot_minutes: 15 }),
    "Raportointi arkisin 10.45–12.30"
  );
  assert.equal(
    getCanteenReportingText({ ...openWindow, reporting_open: true, current_user_reported: true, slot_minutes: 20 }),
    "Olet osallistunut tähän 20 min jaksoon"
  );
  assert.equal(
    getCanteenReportingText({ ...openWindow, reporting_open: true, current_user_reported: false, slot_minutes: 20 }),
    "Voit raportoida kerran jokaisessa 20 min jaksossa"
  );
});

test("classifies report failures from the structured detail marker", () => {
  assert.equal(
    canteenFailureReason({ code: "22023", details: "reporting_closed" }),
    "reporting_closed"
  );
  assert.equal(
    canteenFailureReason({ code: "42501", details: "auth_required" }),
    "auth_required"
  );
  assert.equal(
    canteenFailureReason({ code: "22023", details: "unknown_area" }),
    "unknown_area"
  );
  assert.equal(canteenFailureReason({ code: "P0001", details: null }), "unknown");
});

test("still classifies errors raised by a pre-migration database", () => {
  assert.equal(
    canteenFailureReason({
      code: "22023",
      details: null,
      message: "Canteen reporting is open on weekdays from 10:45 to 12:30",
    }),
    "reporting_closed"
  );
  assert.equal(
    canteenFailureReason({
      code: "22023",
      details: null,
      message: "Queue level must be between 1 and 5",
    }),
    "invalid_level"
  );
  assert.equal(
    canteenFailureReason({ code: "42501", details: null, message: "Authentication is required" }),
    "auth_required"
  );
});

test("coerces malformed configuration back to the pre-migration defaults", () => {
  assert.deepEqual(asWeekdays(undefined), [1, 2, 3, 4, 5]);
  assert.deepEqual(asWeekdays([]), [1, 2, 3, 4, 5]);
  assert.deepEqual(asWeekdays([1, 9, "3"]), [1, 3]);
  assert.equal(asPositiveInt(null, 15), 15);
  assert.equal(asPositiveInt(0, 15), 15);
  assert.equal(asPositiveInt("20", 15), 20);
  assert.equal(asClock(undefined, "10:45:00"), "10:45:00");
  assert.equal(asClock("9:00:00", "10:45:00"), "9:00:00");
});
