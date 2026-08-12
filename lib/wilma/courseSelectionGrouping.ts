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
  const normalized = period.trim().replace(/^jakso\s+/i, "");
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
