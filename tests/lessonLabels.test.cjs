const assert = require("node:assert/strict");
const test = require("node:test");
const {
  lessonLabel,
} = require("../.expo/lesson-labels-test-build/lessonLabels.js");

test("a code and a name are kept side by side", () => {
  assert.deepEqual(lessonLabel("GE01.23", "Maailma muutoksessa"), {
    code: "GE01.23",
    title: "Maailma muutoksessa",
  });
});

test("a name that already carries its code is not doubled up", () => {
  assert.deepEqual(lessonLabel("GE01.23", "GE01.23 Maailma muutoksessa"), {
    code: "GE01.23",
    title: "Maailma muutoksessa",
  });
  assert.deepEqual(lessonLabel("GE01.23", "GE01.23 – Maailma muutoksessa"), {
    code: "GE01.23",
    title: "Maailma muutoksessa",
  });
});

test("a shorter code never eats the start of a longer one", () => {
  assert.deepEqual(lessonLabel("GE01", "GE01.23 Maailma muutoksessa"), {
    code: "GE01",
    title: "GE01.23 Maailma muutoksessa",
  });
});

test("a lesson known only by its code shows the code as the title", () => {
  assert.deepEqual(lessonLabel("GE01.23", ""), { code: "", title: "GE01.23" });
  assert.deepEqual(lessonLabel("GE01.23", "GE01.23"), { code: "", title: "GE01.23" });
});

test("the fallback names a lesson whose group has no caption", () => {
  assert.deepEqual(lessonLabel("", "", "Oppitunti"), { code: "", title: "Oppitunti" });
  assert.deepEqual(lessonLabel("GE01.23", null, "Oppitunti"), {
    code: "GE01.23",
    title: "Oppitunti",
  });
});

test("missing and padded values are tolerated", () => {
  assert.deepEqual(lessonLabel(undefined, undefined), { code: "", title: "" });
  assert.deepEqual(lessonLabel("  GE01.23 ", " Maailma muutoksessa "), {
    code: "GE01.23",
    title: "Maailma muutoksessa",
  });
});
