const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildDaySegments,
  nowAndNext,
} = require("../.expo/now-next-test-build/scheduleNowNext.js");

function lesson(start, end, title, extra = {}) {
  return { start, end, title, ...extra };
}

test("segments come back in clock order with lunch among them", () => {
  const segments = buildDaySegments(
    [
      lesson("11:20", "13:15", "Matematiikka", { code: "MAA09.01", room: "U261" }),
      lesson("09:45", "11:05", "Biologia"),
    ],
    { startTime: "12:10", endTime: "12:50", courseCodes: [] }
  );

  assert.deepEqual(
    segments.map((s) => [s.start, s.title]),
    [
      ["09:45", "Biologia"],
      ["11:20", "Matematiikka"],
      ["12:10", "Lounas"],
    ]
  );
  assert.equal(segments[1].code, "MAA09.01");
  assert.equal(segments[1].room, "U261");
  assert.equal(segments[2].kind, "lunch");
});

test("Wilma's HH:MM:SS times are normalised", () => {
  const segments = buildDaySegments(
    [lesson("09:45:00", "11:05:00", "Biologia")],
    null
  );
  assert.deepEqual([segments[0].start, segments[0].end], ["09:45", "11:05"]);
});

test("mid-lesson reports that lesson and the one after it", () => {
  const segments = buildDaySegments(
    [lesson("08:15", "09:30", "Fysiikka"), lesson("09:45", "11:05", "Biologia")],
    null
  );
  const { current, next } = nowAndNext(segments, "08:40");

  assert.equal(current.title, "Fysiikka");
  assert.equal(current.end, "09:30");
  assert.equal(next.title, "Biologia");
});

test("lunch inside a long block becomes the current segment", () => {
  // The 11:20–13:15 block contains the 12:10–12:50 lunch. During lunch the
  // useful line is "Lounas, until 12:50", not the block it sits inside.
  const segments = buildDaySegments(
    [lesson("11:20", "13:15", "Matematiikka")],
    { startTime: "12:10", endTime: "12:50", courseCodes: [] }
  );
  const { current } = nowAndNext(segments, "12:30");

  assert.equal(current.title, "Lounas");
  assert.equal(current.end, "12:50");
});

test("an overlaid lesson wins while it runs, by ending soonest", () => {
  // Ryhmänohjaus laid over a normal lesson: the shorter one is the one whose
  // countdown means something.
  const segments = buildDaySegments(
    [
      lesson("10:00", "11:30", "Matematiikka"),
      lesson("10:45", "11:15", "Ryhmänohjaus"),
    ],
    null
  );
  const { current, next } = nowAndNext(segments, "11:00");

  assert.equal(current.title, "Ryhmänohjaus");
  assert.equal(current.end, "11:15");
  assert.equal(next, null);
});

test("during a gap there is no current segment, only the next one", () => {
  const segments = buildDaySegments(
    [lesson("08:15", "09:30", "Fysiikka"), lesson("10:00", "11:05", "Biologia")],
    null
  );
  const { current, next } = nowAndNext(segments, "09:40");

  assert.equal(current, null);
  assert.equal(next.title, "Biologia");
});

test("before the day starts everything is still ahead", () => {
  const segments = buildDaySegments([lesson("08:15", "09:30", "Fysiikka")], null);
  const { current, next } = nowAndNext(segments, "07:00");

  assert.equal(current, null);
  assert.equal(next.title, "Fysiikka");
});

test("after the last lesson both are empty, so the activity can end", () => {
  const segments = buildDaySegments([lesson("08:15", "09:30", "Fysiikka")], null);
  const { current, next } = nowAndNext(segments, "15:00");

  assert.equal(current, null);
  assert.equal(next, null);
});

test("a lesson ending exactly now is over, not current", () => {
  const segments = buildDaySegments(
    [lesson("08:15", "09:30", "Fysiikka"), lesson("09:30", "10:45", "Biologia")],
    null
  );
  const { current } = nowAndNext(segments, "09:30");

  assert.equal(current.title, "Biologia");
});

test("an empty day yields nothing at all", () => {
  assert.deepEqual(nowAndNext(buildDaySegments([], null), "10:00"), {
    current: null,
    next: null,
  });
});
