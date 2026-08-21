const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildSharedWeek,
} = require("../.expo/shared-schedule-test-build/sharedScheduleCore.js");

function lesson(overrides = {}) {
  return {
    reservationId: "lesson-1",
    class: "Fallback subject",
    start: "09:00",
    end: "09:45",
    dateArray: ["2026-08-10"],
    groups: [
      {
        shortCaption: "MAA09.01",
        fullCaption: "Matematiikka",
        rooms: [{ longCaption: "U261" }],
      },
    ],
    ...overrides,
  };
}

test("shared schedule includes only the selected Monday through Friday", () => {
  const result = buildSharedWeek(
    [
      lesson({ dateArray: ["2026-08-09", "2026-08-10", "2026-08-14", "2026-08-15"] }),
    ],
    new Date(2026, 7, 12, 12, 0, 0)
  );

  assert.equal(result.weekStart, "2026-08-10");
  assert.deepEqual(
    result.lessons.map((item) => item.date),
    ["2026-08-10", "2026-08-14"]
  );
});

test("shared schedule exposes only sanitized lesson fields", () => {
  const result = buildSharedWeek(
    [lesson({ privateMessage: "must not leak", attendance: "private" })],
    new Date(2026, 7, 10, 12, 0, 0)
  );

  assert.deepEqual(result.lessons[0], {
    id: "lesson-1:2026-08-10",
    date: "2026-08-10",
    start: "09:00",
    end: "09:45",
    subject: "Matematiikka",
    code: "MAA09.01",
    room: "U261",
  });
});

test("a lesson Wilma names only by code still shares a subject", () => {
  const result = buildSharedWeek(
    [lesson({ groups: [{ shortCaption: "GE01.23", fullCaption: "", rooms: [] }] })],
    new Date(2026, 7, 10, 12, 0, 0)
  );

  assert.equal(result.lessons[0].subject, "Fallback subject");
  assert.equal(result.lessons[0].code, "GE01.23");
});

test("duplicate reservation dates are collapsed and sorted by time", () => {
  const result = buildSharedWeek(
    [
      lesson({ reservationId: "late", start: "12:00", dateArray: ["2026-08-11"] }),
      lesson({ reservationId: "early", start: "08:00", dateArray: ["2026-08-11", "2026-08-11"] }),
    ],
    new Date(2026, 7, 10, 12, 0, 0)
  );

  assert.deepEqual(
    result.lessons.map((item) => item.id),
    ["early:2026-08-11", "late:2026-08-11"]
  );
});
