const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildSharedWeek,
  pickStaleDayLessons,
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

function sharedLesson(date, start, overrides = {}) {
  return {
    id: `${date}:${start}`,
    date,
    start,
    end: "09:45",
    subject: "Matematiikka",
    code: "MAA09.01",
    room: "U261",
    ...overrides,
  };
}

test("a stale day comes from the newest past week that covers the weekday", () => {
  // Tuesdays: 2026-08-11 and 2026-08-18. Target is Tuesday 2026-09-01.
  const result = pickStaleDayLessons(
    [
      { week_start: "2026-08-10", lessons: [sharedLesson("2026-08-11", "08:00")] },
      { week_start: "2026-08-17", lessons: [sharedLesson("2026-08-18", "10:00")] },
    ],
    new Date(2026, 8, 1)
  );

  assert.equal(result.weekStart, "2026-08-17");
  assert.deepEqual(result.lessons.map((item) => item.date), ["2026-08-18"]);
});

test("a week without the wanted weekday falls through to an older one", () => {
  // The newest week shared only a Wednesday; the target day is a Tuesday.
  const result = pickStaleDayLessons(
    [
      { week_start: "2026-08-17", lessons: [sharedLesson("2026-08-19", "10:00")] },
      { week_start: "2026-08-10", lessons: [sharedLesson("2026-08-11", "08:00")] },
    ],
    new Date(2026, 8, 1)
  );

  assert.equal(result.weekStart, "2026-08-10");
});

test("stale lessons for the weekday are sorted by start time", () => {
  const result = pickStaleDayLessons(
    [
      {
        week_start: "2026-08-10",
        lessons: [
          sharedLesson("2026-08-11", "12:00"),
          sharedLesson("2026-08-13", "07:00"),
          sharedLesson("2026-08-11", "08:00"),
        ],
      },
    ],
    new Date(2026, 8, 1)
  );

  assert.deepEqual(result.lessons.map((item) => item.start), ["08:00", "12:00"]);
});

test("no past week covering the weekday yields no stale day", () => {
  assert.equal(
    pickStaleDayLessons(
      [{ week_start: "2026-08-10", lessons: [sharedLesson("2026-08-14", "08:00")] }],
      new Date(2026, 8, 1)
    ),
    null
  );
  assert.equal(pickStaleDayLessons([], new Date(2026, 8, 1)), null);
});
