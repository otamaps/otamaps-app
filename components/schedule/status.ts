import type { Theme } from "@/components/ui";

/**
 * States a lesson card's time tag can be in that the shared palette has no
 * role for — "current" and "over" are specific to a live timetable, not text
 * roles a settings row would ever need. Exam orange and lunch amber are
 * genuinely one fixed hue each, light and dark alike; only their fill tints.
 */
export const STATUS = {
  current: { light: "#16A34A", dark: "#4ADE80" },
  currentSub: { light: "#16A34A80", dark: "#4ADE8080" },
  currentTint: { light: "#16A34A1A", dark: "#4ADE8022" },
  over: { light: "#8A929D", dark: "#9CA3AF" },
  overSub: { light: "#8A929D80", dark: "#9CA3AF80" },
  overTint: { light: "#F3F4F6", dark: "#2E3034" },
  exam: "#ff9800",
  examTint: { light: "#fff8f0" },
  lunch: { light: "#B45309", dark: "#FBBF24" },
  lunchSub: { light: "#B4530980", dark: "#FBBF2480" },
  lunchTint: { light: "#FEF3C7", dark: "#78350F55" },
} as const;

export function pick<T extends { light: string; dark: string }>(theme: Theme, pair: T): string {
  return theme.isDark ? pair.dark : pair.light;
}

/**
 * The time tag's three colours for a lesson: green while it is on, grey once
 * it is over — so the coloured badges left on a day are only the ones still
 * ahead — and the accent otherwise.
 */
export function timeTagColors(
  theme: Theme,
  { isCurrent, isOver }: { isCurrent: boolean; isOver: boolean },
) {
  if (isCurrent) {
    return {
      start: pick(theme, STATUS.current),
      end: pick(theme, STATUS.currentSub),
      fill: pick(theme, STATUS.currentTint),
    };
  }
  if (isOver) {
    return {
      start: pick(theme, STATUS.over),
      end: pick(theme, STATUS.overSub),
      fill: pick(theme, STATUS.overTint),
    };
  }
  return { start: theme.accent, end: theme.accent + "70", fill: theme.accentTint };
}
