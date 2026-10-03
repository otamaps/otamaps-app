const assert = require("node:assert/strict");
const test = require("node:test");
const {
  coursePeriodLabel,
  findCurrentCourseTray,
  groupCoursesByPeriod,
  groupCoursesByPeriodParts,
  isOtherSchoolTray,
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

test("pairs each period's A and B parts under one period", () => {
  const groups = groupCoursesByPeriodParts([
    { period: "2", groupCode: "MAA02" },
    { period: "1", groupCode: "ENA01" },
    { period: "3", groupCode: "FY01" },
    { period: "1", groupCode: "KE01" },
    { period: "Muut", groupCode: "X" },
  ]);
  assert.deepEqual(
    groups.map((group) => [
      group.label,
      group.a.map((course) => course.groupCode),
      group.b.map((course) => course.groupCode),
    ]),
    [
      ["1", ["ENA01", "KE01"], ["MAA02"]],
      ["2", ["FY01"], []],
      ["Muut", ["X"], []],
    ]
  );
});

test("keeps a period that has only a B part", () => {
  const [group] = groupCoursesByPeriodParts([{ period: "4", groupCode: "BI02" }]);
  assert.equal(group.label, "2");
  assert.deepEqual(group.a, []);
  assert.deepEqual(group.b.map((course) => course.groupCode), ["BI02"]);
});

test("reads Wilma's \"1A. periodi\" period names", () => {
  assert.equal(coursePeriodLabel("1A. periodi"), "1A");
  assert.equal(coursePeriodLabel("1B. periodi"), "1B");
  assert.equal(coursePeriodLabel("3B periodi"), "3B");
  const groups = groupCoursesByPeriodParts([
    { period: "1B. periodi", groupCode: "MAA02" },
    { period: "1A. periodi", groupCode: "ENA01" },
    { period: "2A. periodi", groupCode: "FY01" },
  ]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.a.length, group.b.length]),
    [
      ["1", 1, 1],
      ["2", 1, 0],
    ]
  );
});

test("tells another school's trays from the student's own", () => {
  const tray = (name, category = "") => ({ name, category });
  assert.equal(isOtherSchoolTray(tray("1A. periodi")), false);
  assert.equal(isOtherSchoolTray(tray("1A. periodi", "Otaniemen lukio")), false);
  assert.equal(isOtherSchoolTray(tray("Otaniemen lukio, 2A. periodi")), false);
  assert.equal(isOtherSchoolTray(tray("1A. periodi", "Espoon aikuislukio")), true);
  assert.equal(isOtherSchoolTray(tray("Tapiolan lukio 2A. periodi")), true);
  assert.equal(isOtherSchoolTray(tray("Kuvataidekoulu, ilta")), true);
  assert.equal(isOtherSchoolTray(tray("Omnian ammattiopisto", "Yhteistarjonta")), true);
});
