export type CoursePeriodGroup<T> = {
  key: string;
  label: string;
  courses: T[];
};

type CourseWithPeriod = {
  period: string;
};

type CourseTrayIdentity = {
  id: string;
  category: string;
  name: string;
};

export function coursePeriodLabel(period: string): string {
  // Wilma's own names are "1A. periodi"; older data said "Jakso 1A" or
  // numbered the halves 1, 2, 3… — all reduce to "1A".
  const normalized = period
    .trim()
    .replace(/^jakso\s+/i, "")
    .replace(/\.?\s*periodi$/i, "")
    .trim();
  if (!normalized) return "Muut";

  const alreadySplit = normalized.match(/^(\d+)\s*([ab])$/i);
  if (alreadySplit) return `${Number(alreadySplit[1])}${alreadySplit[2].toUpperCase()}`;

  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized);
    if (index > 0) return `${Math.ceil(index / 2)}${index % 2 === 1 ? "A" : "B"}`;
  }

  return normalized;
}

export function groupCoursesByPeriod<T extends CourseWithPeriod>(
  courses: T[]
): CoursePeriodGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const course of courses) {
    const label = coursePeriodLabel(course.period);
    const existing = groups.get(label);
    if (existing) existing.push(course);
    else groups.set(label, [course]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => comparePeriodLabels(left, right))
    .map(([label, groupedCourses]) => ({
      key: label,
      label,
      courses: groupedCourses,
    }));
}

export type CoursePeriodParts<T> = {
  key: string;
  /** The period's number — "1" for 1A and 1B — or a label that isn't split. */
  label: string;
  a: T[];
  b: T[];
};

/**
 * Courses grouped by period, with each period's A and B parts kept apart
 * inside it: "Jakso 1" holds both 1A and 1B. Labels that aren't an A/B part
 * ("Muut") stay their own group, with every course under `a`.
 */
export function groupCoursesByPeriodParts<T extends CourseWithPeriod>(
  courses: T[]
): CoursePeriodParts<T>[] {
  const periods = new Map<string, CoursePeriodParts<T>>();
  for (const group of groupCoursesByPeriod(courses)) {
    const split = group.label.match(/^(\d+)([AB])$/);
    const label = split ? split[1] : group.label;
    const period = periods.get(label) ?? { key: label, label, a: [], b: [] };
    if (split?.[2] === "B") period.b.push(...group.courses);
    else period.a.push(...group.courses);
    periods.set(label, period);
  }
  // `groupCoursesByPeriod` already sorts 1A, 1B, 2A…, so first-seen order holds.
  return [...periods.values()];
}

export function findCurrentCourseTray<T extends CourseTrayIdentity>(
  tray: CourseTrayIdentity,
  currentTrays: T[]
): T | undefined {
  return (
    currentTrays.find((candidate) => candidate.id === tray.id) ??
    currentTrays.find(
      (candidate) =>
        candidate.category.trim() === tray.category.trim() &&
        candidate.name.trim() === tray.name.trim()
    )
  );
}

function comparePeriodLabels(left: string, right: string): number {
  const leftMatch = left.match(/^(\d+)([AB])$/);
  const rightMatch = right.match(/^(\d+)([AB])$/);
  if (leftMatch && rightMatch) {
    const numberDifference = Number(leftMatch[1]) - Number(rightMatch[1]);
    if (numberDifference !== 0) return numberDifference;
    return leftMatch[2].localeCompare(rightMatch[2], "fi-FI");
  }
  if (leftMatch) return -1;
  if (rightMatch) return 1;
  return left.localeCompare(right, "fi-FI", { numeric: true });
}

/** The student's own school, as Wilma names it. */
const OWN_SCHOOL = /otaniem/i;
/** A word that makes a tray's text name a school. */
const SCHOOL_WORD = /lukio|koulu|opisto|lyseo|gymnasium/i;

/**
 * Whether a course tray belongs to another school: its name or category
 * names a school, and not the student's own. Wilma lists other schools'
 * trays — shared offerings, adult upper secondary — alongside the student's
 * own, and the page tucks those away behind a disclosure.
 */
export function isOtherSchoolTray(tray: { name: string; category: string }): boolean {
  const text = `${tray.name} ${tray.category}`;
  return SCHOOL_WORD.test(text) && !OWN_SCHOOL.test(text);
}
