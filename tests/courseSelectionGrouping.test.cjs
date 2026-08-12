const assert = require("node:assert/strict");
const test = require("node:test");
const {
  coursePeriodLabel,
  findCurrentCourseTray,
  groupCoursesByPeriod,
} = require("../.expo/course-selection-test-build/courseSelectionGrouping.js");

test("maps sequential Wilma periods to split Jakso labels", () => {
  assert.equal(coursePeriodLabel("1"), "1A");
  assert.equal(coursePeriodLabel("2"), "1B");
  assert.equal(coursePeriodLabel("3"), "2A");
  assert.equal(coursePeriodLabel("4"), "2B");
  assert.equal(coursePeriodLabel("Jakso 3A"), "3A");
});

test("groups and naturally sorts selected courses by split Jakso", () => {
  const courses = [
    { period: "4", groupCode: "FY08.D2" },
    { period: "1", groupCode: "BI02.08" },
    { period: "2", groupCode: "MAA09.01" },
    { period: "1", groupCode: "ENA01.02" },
  ];

  assert.deepEqual(
    groupCoursesByPeriod(courses).map((group) => ({
      label: group.label,
      codes: group.courses.map((course) => course.groupCode),
    })),
    [
      { label: "1A", codes: ["BI02.08", "ENA01.02"] },
      { label: "1B", codes: ["MAA09.01"] },
      { label: "2B", codes: ["FY08.D2"] },
    ]
  );
});

test("rematches a refreshed tray when its session-scoped id changes", () => {
  const previous = { id: "old_1", category: "Otaniemen lukio", name: "1. jakson tarjotin" };
  const current = {
    id: "new_2",
    category: "Otaniemen lukio",
    name: "1. jakson tarjotin",
    status: "Ilmoittautuminen mahdollista",
  };

  assert.equal(findCurrentCourseTray(previous, [current]), current);
});
