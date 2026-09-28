import { PlatformSymbol } from "@/components/PlatformSymbol";
import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import DayPickerSheet, {
  DayPickerSheetRef,
} from "@/components/sheets/dayPickerSheet";
import { AppText, StateView, useNativeHeader, useTheme, type Theme } from "@/components/ui";
import { radii } from "@/constants/theme";
import {
  addMinutesClock,
  buildDaySlots,
  clockMinutes,
  DaySlot,
  freeSlotHeight,
  lessonHeight,
  LunchMatch,
  LunchShiftRow,
  matchLunchShift,
} from "@/lib/lunchShiftCore";
import { getAllLunchShifts } from "@/lib/lunchShiftService";
import {
  Exam,
  fetchSchedule,
  ScheduleData,
  ScheduleLesson,
} from "@/lib/wilma/graphqlClient";
import { lessonLabel } from "@/lib/wilma/lessonLabels";
import {
  formatLocalISO,
  getISOWeekNumber,
  getMondayOfWeek,
  getNextSchoolDay,
  getSchoolWeekDays,
  isoWeekdayOf,
  parseLocalISO,
  shortDateLabel,
  weekdayLabel,
  weekMonthLabel,
} from "@/lib/wilma/scheduleDates";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** How far ahead the view may jump on open before giving up on finding lessons. */
const MAX_AUTO_ADVANCE_WEEKS = 4;

/** Never highlight the next school day instead of today earlier than this. */
const NEXT_DAY_SWITCH_EARLIEST = "12:00";

/**
 * States a lesson card's time tag can be in that the shared palette has no
 * role for — "current" and "over" are specific to a live timetable, not text
 * roles a settings row would ever need. Exam orange and lunch amber are
 * genuinely one fixed hue each, light and dark alike; only their fill tints.
 */
const STATUS = {
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

function pick<T extends { light: string; dark: string }>(theme: Theme, pair: T): string {
  return theme.isDark ? pair.dark : pair.light;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatTime(t: string) {
  return t.slice(0, 5);
}

function finnishToISO(d: string): string {
  const [day, month, year] = d.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** The `weekOffset` (relative to the current week) whose Mon–Fri contains `iso`. */
function weekOffsetForDay(iso: string): number {
  const target = parseLocalISO(iso);
  if (!target) return 0;
  const targetMonday = getMondayOfWeek(0, target).getTime();
  const currentMonday = getMondayOfWeek(0).getTime();
  return Math.round((targetMonday - currentMonday) / (7 * 24 * 60 * 60 * 1000));
}

function dayHeading(iso: string): { name: string; date: string } {
  const parsed = parseLocalISO(iso);
  return parsed
    ? { name: weekdayLabel(parsed), date: shortDateLabel(parsed) }
    : { name: iso, date: "" };
}

// ── Schedule cache (module-level, keyed by "YYYY-MM") ─────────────────────────

const _cache: Record<string, ScheduleData> = {};

function cacheKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function fetchMonthCached(
  year: number,
  month: number,
  forceRefresh = false,
): Promise<ScheduleData> {
  const key = cacheKey(year, month);
  if (_cache[key] && !forceRefresh) return _cache[key];
  const data = await fetchSchedule(`1.${month}.${year}`, { forceRefresh });
  _cache[key] = data;
  return data;
}

function invalidateMonth(year: number, month: number) {
  delete _cache[cacheKey(year, month)];
}

function mergeScheduleData(a: ScheduleData, b: ScheduleData): ScheduleData {
  const seenL = new Set(a.schedule.map((l) => l.reservationId));
  const seenE = new Set(a.exams.map((e) => e.examId));
  return {
    schedule: [
      ...a.schedule,
      ...b.schedule.filter((l) => !seenL.has(l.reservationId)),
    ],
    exams: [...a.exams, ...b.exams.filter((e) => !seenE.has(e.examId))],
  };
}

// ── Lesson card ───────────────────────────────────────────────────────────────

function LunchChip({ lunch, theme }: { lunch: { start: string; end: string }; theme: Theme }) {
  const fg = pick(theme, STATUS.lunch);
  return (
    <View style={[styles.lunchChip, { backgroundColor: pick(theme, STATUS.lunchTint) }]}>
      <PlatformSymbol ios="fork.knife" android="restaurant" size={11} tintColor={fg} />
      <Text style={[styles.lunchChipText, { color: fg }]}>
        Lounas {lunch.start}–{lunch.end}
      </Text>
    </View>
  );
}

function LessonCard({
  lesson,
  theme,
  isFirst,
  isLast,
  showDivider,
  lunch,
  isPast,
  isOver,
  isCurrent,
}: {
  lesson: ScheduleLesson;
  theme: Theme;
  isFirst: boolean;
  isLast: boolean;
  showDivider: boolean;
  lunch: { start: string; end: string } | null;
  isPast: boolean;
  /** The lesson has already happened — earlier today, or on an earlier day. */
  isOver: boolean;
  isCurrent: boolean;
}) {
  const group = lesson.groups[0];
  const { code, title } = lessonLabel(
    group?.shortCaption,
    group?.fullCaption,
    lesson.class,
  );
  const room = group?.rooms[0]?.longCaption ?? "";
  const teacher = group?.teachers[0]?.longCaption ?? "";
  const meta = [room, teacher].filter(Boolean).join(" · ");
  const tallHeight = lessonHeight(
    clockMinutes(lesson.end) - clockMinutes(lesson.start),
  );
  // A lesson that is over drops its blue accent for a neutral gray, so the
  // colored badges left on the day are only the ones still ahead.
  const timeColor = isCurrent
    ? pick(theme, STATUS.current)
    : isOver
      ? pick(theme, STATUS.over)
      : theme.accent;
  const timeSubColor = isCurrent
    ? pick(theme, STATUS.currentSub)
    : isOver
      ? pick(theme, STATUS.overSub)
      : theme.accent + "70";

  return (
    <>
      <View
        style={[
          styles.lessonCard,
          { backgroundColor: theme.card },
          isFirst && styles.cardTop,
          isLast && styles.cardBottom,
          !!lunch && styles.lessonCardWithLunch,
          !!tallHeight && { minHeight: tallHeight, alignItems: "center" },
          isPast && styles.pastOpacity,
        ]}
      >
        <View
          style={[
            styles.timeTag,
            { backgroundColor: theme.accentTint },
            isOver && { backgroundColor: pick(theme, STATUS.overTint) },
            isCurrent && { backgroundColor: pick(theme, STATUS.currentTint) },
          ]}
        >
          <Text style={[styles.timeTagStart, { color: timeColor }]}>
            {formatTime(lesson.start)}
          </Text>
          <Text style={[styles.timeTagEnd, { color: timeSubColor }]}>
            {formatTime(lesson.end)}
          </Text>
        </View>
        <View style={styles.lessonInfo}>
          <LessonTitleRow
            title={title}
            code={code}
            isDark={theme.isDark}
            numberOfLines={2}
            titleStyle={[styles.lessonSubject, { color: theme.text }]}
          />
          {!!meta && (
            <AppText variant="bodySmall" color="textMuted" style={styles.lessonMeta} numberOfLines={1}>
              {meta}
            </AppText>
          )}
          {!!lunch && <LunchChip lunch={lunch} theme={theme} />}
        </View>
      </View>
      {showDivider && <View style={[styles.lessonDivider, { backgroundColor: theme.border }]} />}
    </>
  );
}

// ── Free slot ("Hyppytunti") ─────────────────────────────────────────────────

function FreeSlotCard({
  start,
  end,
  lunch,
  theme,
  isFirst,
  isLast,
  showDivider,
  isPast,
  isCurrent,
}: {
  start: string;
  end: string;
  lunch: { start: string; end: string } | null;
  theme: Theme;
  isFirst: boolean;
  isLast: boolean;
  showDivider: boolean;
  isPast: boolean;
  isCurrent: boolean;
}) {
  // The gap's real end always lands exactly on the next lesson's start, so
  // trim the label a few minutes early rather than showing the same time on
  // two consecutive rows.
  const displayEnd = addMinutesClock(end, -5);
  const tallHeight = freeSlotHeight(clockMinutes(end) - clockMinutes(start));
  const timeColor = isCurrent ? pick(theme, STATUS.current) : theme.textMuted;
  const timeSubColor = isCurrent ? pick(theme, STATUS.currentSub) : theme.textMuted;

  return (
    <>
      <View
        style={[
          styles.lessonCard,
          styles.freeSlotCard,
          { backgroundColor: theme.card, borderColor: theme.border },
          isFirst && styles.cardTop,
          isLast && styles.cardBottom,
          !!lunch && styles.lessonCardWithLunch,
          !!tallHeight && { minHeight: tallHeight, alignItems: "center" },
          isPast && styles.pastOpacity,
        ]}
      >
        <View
          style={[
            styles.timeTag,
            styles.freeSlotTimeTag,
            { backgroundColor: theme.border },
            isCurrent && { backgroundColor: pick(theme, STATUS.currentTint) },
          ]}
        >
          <Text style={[styles.timeTagStart, { color: timeColor }]}>{start}</Text>
          <Text style={[styles.timeTagEnd, { color: timeSubColor }]}>{displayEnd}</Text>
        </View>
        <View style={styles.lessonInfo}>
          {isCurrent ? (
            <Text style={[styles.lessonSubject, { color: theme.text }]}>Hyppytunti</Text>
          ) : (
            <Text style={[styles.freeSlotTitle, { color: theme.textMuted }]}>Hyppytunti</Text>
          )}
          {!!lunch && <LunchChip lunch={lunch} theme={theme} />}
        </View>
      </View>
      {showDivider && <View style={[styles.lessonDivider, { backgroundColor: theme.border }]} />}
    </>
  );
}

// ── Standalone lunch (falls outside every lesson and free slot) ────────────

function LunchOnlyCard({
  start,
  end,
  theme,
  isFirst,
  isLast,
  showDivider,
  isPast,
}: {
  start: string;
  end: string;
  theme: Theme;
  isFirst: boolean;
  isLast: boolean;
  showDivider: boolean;
  isPast: boolean;
}) {
  const fg = pick(theme, STATUS.lunch);
  return (
    <>
      <View
        style={[
          styles.lessonCard,
          { backgroundColor: theme.card },
          isFirst && styles.cardTop,
          isLast && styles.cardBottom,
          isPast && styles.pastOpacity,
        ]}
      >
        <View style={[styles.timeTag, { backgroundColor: pick(theme, STATUS.lunchTint) }]}>
          <Text style={[styles.timeTagStart, { color: fg }]}>{start}</Text>
          <Text style={[styles.timeTagEnd, { color: pick(theme, STATUS.lunchSub) }]}>{end}</Text>
        </View>
        <View style={styles.lessonInfo}>
          <Text style={[styles.lessonSubject, { color: theme.text }]}>Lounas</Text>
        </View>
      </View>
      {showDivider && <View style={[styles.lessonDivider, { backgroundColor: theme.border }]} />}
    </>
  );
}

// ── Exam row ──────────────────────────────────────────────────────────────────

function ExamRow({ exam, theme }: { exam: Exam; theme: Theme }) {
  const { code, title } = lessonLabel(exam.course, exam.courseTitle);
  return (
    <View
      style={[
        styles.examCard,
        {
          backgroundColor: theme.isDark ? theme.card : STATUS.examTint.light,
          borderColor: STATUS.exam,
        },
      ]}
    >
      <PlatformSymbol ios="doc.text" android="assignment" size={16} tintColor={STATUS.exam} style={styles.examIcon} />
      <View style={styles.flex1}>
        <LessonTitleRow
          title={`${title}${exam.name ? ` – ${exam.name}` : ""}`}
          code={code}
          isDark={theme.isDark}
          numberOfLines={2}
          titleStyle={[styles.examTitle, { color: theme.text }]}
        />
        <AppText variant="caption" color="textMuted" style={styles.examTime}>
          {formatTime(exam.timeStart)} – {formatTime(exam.timeEnd)}
          {exam.teachers[0] ? `  ·  ${exam.teachers[0].teacherName}` : ""}
        </AppText>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = formatLocalISO(new Date());
  // Opened from the Wilma tab's "Tänään" card: that card may already be
  // showing the next school day (once today's lessons are done), so land on
  // whichever day it actually displayed rather than always today.
  const { day: targetDayParam } = useLocalSearchParams<{ day?: string }>();
  const targetDay =
    typeof targetDayParam === "string" && parseLocalISO(targetDayParam)
      ? targetDayParam
      : null;

  const [weekOffset, setWeekOffset] = useState(() =>
    targetDay ? weekOffsetForDay(targetDay) : 0,
  );
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loadedOffset, setLoadedOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lunchRows, setLunchRows] = useState<LunchShiftRow[]>([]);

  // The weekly lunch shift configuration doesn't depend on which week is on
  // screen, so it's fetched once rather than per week.
  useEffect(() => {
    getAllLunchShifts()
      .then(setLunchRows)
      .catch(() => setLunchRows([]));
  }, []);

  // Drives which of today's rows are dimmed as past; refreshed periodically
  // rather than left stale for the whole day.
  const [nowClock, setNowClock] = useState(() =>
    formatTime(new Date().toTimeString()),
  );
  useEffect(() => {
    const id = setInterval(
      () => setNowClock(formatTime(new Date().toTimeString())),
      30000,
    );
    return () => clearInterval(id);
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const dayOffsets = useRef<Record<string, number>>({});
  const pendingScrollDay = useRef<string | null>(null);
  const dayPickerRef = useRef<DayPickerSheetRef>(null);
  // Jumping the week forward is a one-time convenience on open. Once it has
  // settled — or the user has picked a week themselves — it must never move
  // the week out from under them again.
  const autoAdvance = useRef({ settled: false, weeksTried: 0 });

  // Derived values, memoized so `daySlotsByDay` below gets a stable
  // `weekDays` reference to key off instead of recomputing every render.
  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const friday = useMemo(() => {
    const f = new Date(monday);
    f.setDate(monday.getDate() + 4);
    return f;
  }, [monday]);
  const weekDays = useMemo(() => getSchoolWeekDays(monday), [monday]);
  const weekNum = useMemo(() => getISOWeekNumber(monday), [monday]);

  const load = useCallback(
    async (isRefresh = false) => {
      const mon = getMondayOfWeek(weekOffset);
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);

      const monYear = mon.getFullYear();
      const monMonth = mon.getMonth() + 1;
      const friYear = fri.getFullYear();
      const friMonth = fri.getMonth() + 1;
      const sameMonth = monYear === friYear && monMonth === friMonth;

      if (isRefresh) {
        invalidateMonth(monYear, monMonth);
        if (!sameMonth) invalidateMonth(friYear, friMonth);
      }

      // A refresh keeps the week on screen so the pull-to-refresh spinner — and
      // the reader's scroll position — survive the reload.
      if (!isRefresh) {
        dayOffsets.current = {};
        setLoading(true);
      }
      setError(null);

      try {
        let combined: ScheduleData;
        if (sameMonth) {
          combined = await fetchMonthCached(monYear, monMonth, isRefresh);
        } else {
          const [a, b] = await Promise.all([
            fetchMonthCached(monYear, monMonth, isRefresh),
            fetchMonthCached(friYear, friMonth, isRefresh),
          ]);
          combined = mergeScheduleData(a, b);
        }
        setData(combined);
        setLoadedOffset(weekOffset);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [weekOffset],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const goToWeek = useCallback((delta: number) => {
    autoAdvance.current.settled = true;
    pendingScrollDay.current = null;
    setWeekOffset((offset) => offset + delta);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Lessons and exams bucketed by calendar date for the whole week.
  const lessonsByDay = useMemo(() => {
    const byDay: Record<string, ScheduleLesson[]> = {};
    for (const lesson of data?.schedule ?? []) {
      for (const date of lesson.dateArray) (byDay[date] ??= []).push(lesson);
    }
    for (const lessons of Object.values(byDay)) {
      lessons.sort((a, b) => a.start.localeCompare(b.start));
    }
    return byDay;
  }, [data]);

  // The day highlighted with a pill: today, or — once today's last lesson
  // has been over for 30+ minutes, or there were no lessons today at all —
  // mirroring the Wilma tab's "Tänään" card — the next school day instead.
  // Never before 10:00 though — a short day ending early (e.g. one morning
  // lesson) would otherwise flip to "tomorrow" while it's still morning.
  // Only meaningful while the current week (the only week whose lessons are
  // loaded here) is on screen — otherwise there's no way to tell whether
  // today genuinely has no lessons or its data just isn't loaded, so this
  // stays on plain today rather than guessing.
  const highlightedDay = useMemo(() => {
    if (weekOffset !== 0) return today;
    const todaysLessons = lessonsByDay[today] ?? [];
    const lastLessonEnd = todaysLessons.reduce(
      (latest, l) => (formatTime(l.end) > latest ? formatTime(l.end) : latest),
      "",
    );
    const showNextDay =
      nowClock >= NEXT_DAY_SWITCH_EARLIEST &&
      (!lastLessonEnd || nowClock >= addMinutesClock(lastLessonEnd, 30));
    return showNextDay ? formatLocalISO(getNextSchoolDay(new Date())) : today;
  }, [lessonsByDay, nowClock, today, weekOffset]);

  const examsByDay = useMemo(() => {
    const byDay: Record<string, Exam[]> = {};
    for (const exam of data?.exams ?? []) {
      (byDay[finnishToISO(exam.date)] ??= []).push(exam);
    }
    return byDay;
  }, [data]);

  // Each day's lessons interleaved with its free slots ("Hyppytunti") and
  // lunch window, matched against that day's own weekday and course codes.
  const daySlotsByDay = useMemo(() => {
    const byDay: Record<string, DaySlot<ScheduleLesson>[]> = {};
    for (const day of weekDays) {
      const lessons = lessonsByDay[day] ?? [];
      if (!lessons.length) {
        byDay[day] = [];
        continue;
      }
      const parsed = parseLocalISO(day);
      const weekday = parsed ? isoWeekdayOf(parsed) : null;
      let lunch: LunchMatch | null = null;
      if (weekday !== null) {
        const codes = lessons
          .map(
            (l) =>
              lessonLabel(
                l.groups[0]?.shortCaption,
                l.groups[0]?.fullCaption,
                l.class,
              ).code,
          )
          .filter(Boolean);
        const rowsForDay = lunchRows.filter((row) => row.weekday === weekday);
        lunch = matchLunchShift(codes, rowsForDay);
      }
      byDay[day] = buildDaySlots(lessons, lunch, (lesson) =>
        String(lesson.reservationId),
      );
    }
    return byDay;
  }, [weekDays, lessonsByDay, lunchRows]);

  const scrollToDay = useCallback((day: string) => {
    const y = dayOffsets.current[day];
    // The section may not be measured yet; the next onLayout finishes the job.
    if (y === undefined) {
      pendingScrollDay.current = day;
      return;
    }
    pendingScrollDay.current = null;
    // Wait a frame so the ScrollView has taken the new content height; without
    // it a jump to the last day of the week gets clamped back to the top.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false });
    });
  }, []);

  const handleDayLayout = useCallback(
    (day: string, y: number) => {
      dayOffsets.current[day] = y;
      if (pendingScrollDay.current === day) scrollToDay(day);
    },
    [scrollToDay],
  );

  // Jumps straight to a day picked from the calendar sheet — possibly in a
  // different week entirely. `scrollToDay` already defers to `handleDayLayout`
  // when that day hasn't been measured yet (e.g. its week just switched in).
  const goToDay = useCallback(
    (iso: string) => {
      autoAdvance.current.settled = true;
      setWeekOffset(weekOffsetForDay(iso));
      scrollToDay(iso);
    },
    [scrollToDay],
  );

  // Open on the day the caller asked for (e.g. whichever day the Wilma tab's
  // "Tänään" card was actually showing), or otherwise the first day from
  // today onwards that has something. When the rest of the week is empty,
  // step forward a week and look again.
  useEffect(() => {
    if (autoAdvance.current.settled) return;
    if (loading || error || !data || loadedOffset !== weekOffset) return;

    if (targetDay) {
      // `weekOffset` was already initialized to targetDay's own week, so it
      // belongs in `weekDays` as soon as that week has loaded.
      autoAdvance.current.settled = true;
      if (weekDays.includes(targetDay)) scrollToDay(targetDay);
      return;
    }

    const target = weekDays.find(
      (day) =>
        day >= highlightedDay &&
        ((lessonsByDay[day]?.length ?? 0) > 0 ||
          (examsByDay[day]?.length ?? 0) > 0),
    );
    if (target) {
      autoAdvance.current.settled = true;
      scrollToDay(target);
      return;
    }
    if (autoAdvance.current.weeksTried >= MAX_AUTO_ADVANCE_WEEKS) {
      autoAdvance.current.settled = true;
      return;
    }
    autoAdvance.current.weeksTried += 1;
    setWeekOffset((offset) => offset + 1);
  }, [
    data,
    error,
    examsByDay,
    highlightedDay,
    lessonsByDay,
    loadedOffset,
    loading,
    scrollToDay,
    targetDay,
    today,
    weekDays,
    weekOffset,
  ]);

  // Compact, not large: the week nav footer and the gradient overlay make
  // the ScrollView one layer down from the screen, not its root, so a large
  // title would have nothing to collapse against.
  const header = useNativeHeader({
    title: "Lukujärjestys",
    background: "page",
    large: false,
    edgeEffect: "soft",
  });

  return (
    <BottomSheetModalProvider>
      <Stack.Screen options={header} />
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {loading ? (
          <StateView loading />
        ) : error ? (
          <StateView icon="error-outline" message={error} />
        ) : (
          <View style={styles.bodyWrap}>
            <ScrollView
              ref={scrollRef}
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
              }
            >
              {weekDays.map((day) => {
                const daySlots = daySlotsByDay[day] ?? [];
                const exams = examsByDay[day] ?? [];
                const heading = dayHeading(day);
                const isToday = day === today;
                // Once the highlight has moved on to the next school day
                // (today's last lesson is long over), today itself is done
                // too and should dim along with the actually-past days.
                const isPastDay = day < highlightedDay;
                const isHighlighted = day === highlightedDay;

                return (
                  <View
                    key={day}
                    style={[styles.daySection, isPastDay && styles.pastOpacity]}
                    onLayout={(event) =>
                      handleDayLayout(day, event.nativeEvent.layout.y)
                    }
                  >
                    <View style={styles.dayHeader}>
                      <AppText
                        variant="rowTitle"
                        color={isHighlighted ? "accent" : "text"}
                      >
                        {heading.name}
                      </AppText>
                      <AppText variant="meta" color="textMuted">
                        {heading.date}
                      </AppText>
                      <View style={styles.flex1} />
                      {isHighlighted && (
                        <View style={[styles.todayPill, { backgroundColor: theme.accentTint, borderColor: theme.accent + "49" }]}>
                          <AppText variant="micro" color="accent">
                            {isToday ? "Tänään" : "Huomenna"}
                          </AppText>
                        </View>
                      )}
                    </View>

                    {exams.map((exam) => (
                      <ExamRow key={exam.examId} exam={exam} theme={theme} />
                    ))}

                    {daySlots.length > 0 ? (
                      <View>
                        {daySlots.map((slot, i) => {
                          // Free slots and the odd standalone lunch sit in the
                          // same continuous, rounded card group as the day's
                          // lessons rather than breaking out into their own box.
                          const isFirst = i === 0;
                          const isLast = i === daySlots.length - 1;
                          // A free slot already reads as a break via its own
                          // dashed border, so a divider right next to it would
                          // just double up on that same visual cue.
                          const next = daySlots[i + 1];
                          const showDivider =
                            !isLast &&
                            slot.kind !== "freeslot" &&
                            next?.kind !== "freeslot";
                          // When today itself has already dimmed as a whole
                          // (the highlight moved on to tomorrow), skip the
                          // per-row dim too — stacking both would make today's
                          // lessons darker than an actually past day's.
                          const isPast =
                            !isPastDay && isToday && slot.end <= nowClock;
                          // Unlike the dim, the gray badge also applies on a
                          // day that has wholly passed — stacking a color with
                          // the day's opacity reads fine, a second dim does not.
                          const isOver =
                            isPastDay || (isToday && slot.end <= nowClock);
                          const isCurrent =
                            isToday &&
                            slot.start <= nowClock &&
                            nowClock < slot.end;

                          if (slot.kind === "lesson") {
                            return (
                              <LessonCard
                                key={`lesson-${slot.lesson.reservationId}`}
                                lesson={slot.lesson}
                                theme={theme}
                                isFirst={isFirst}
                                isLast={isLast}
                                showDivider={showDivider}
                                lunch={slot.lunch}
                                isPast={isPast}
                                isOver={isOver}
                                isCurrent={isCurrent}
                              />
                            );
                          }
                          if (slot.kind === "freeslot") {
                            return (
                              <FreeSlotCard
                                key={slot.key}
                                start={slot.start}
                                end={slot.end}
                                lunch={slot.lunch}
                                theme={theme}
                                isFirst={isFirst}
                                isLast={isLast}
                                showDivider={showDivider}
                                isPast={isPast}
                                isCurrent={isCurrent}
                              />
                            );
                          }
                          return (
                            <LunchOnlyCard
                              key={`lunch-${slot.start}`}
                              start={slot.start}
                              end={slot.end}
                              theme={theme}
                              isFirst={isFirst}
                              isLast={isLast}
                              showDivider={showDivider}
                              isPast={isPast}
                            />
                          );
                        })}
                      </View>
                    ) : exams.length === 0 ? (
                      <View
                        style={[
                          styles.emptyDay,
                          {
                            borderColor: theme.border,
                            // `theme.card` is the 3-digit `#fff` shorthand in
                            // light mode, which an appended alpha pair turns
                            // into an invalid 5-digit string — spelled out in
                            // full here instead of reusing the token.
                            backgroundColor: theme.isDark ? "#23242780" : "#ffffff80",
                          },
                        ]}
                      >
                        <AppText variant="bodySmall" color="textFaint">
                          Ei tunteja
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <LinearGradient
              pointerEvents="none"
              colors={
                theme.isDark
                  ? ["#18191B00", "#18191B1A", "#18191B4D", "#18191B99", "#18191B"]
                  : ["#F2F2F600", "#F2F2F61A", "#F2F2F64D", "#F2F2F699", "#F2F2F6"]
              }
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={styles.bottomFade}
            />
          </View>
        )}

        {/* ── Week navigation ── */}
        <View style={[styles.weekNav, { paddingBottom: 10 + insets.bottom, backgroundColor: theme.bg }]}>
          <Pressable onPress={() => goToWeek(-1)} style={styles.navBtn} hitSlop={12}>
            <PlatformSymbol ios="chevron.left" android="chevron_left" size={22} tintColor={theme.accent} />
          </Pressable>
          <Pressable style={styles.weekLabelWrap} onPress={() => dayPickerRef.current?.present(formatLocalISO(monday))} hitSlop={8}>
            <AppText variant="rowTitle">Viikko {weekNum}</AppText>
            <AppText variant="meta" color="textMuted" style={styles.weekSub}>
              {weekMonthLabel(monday, friday)}
            </AppText>
          </Pressable>
          <Pressable onPress={() => goToWeek(1)} style={styles.navBtn} hitSlop={12}>
            <PlatformSymbol ios="chevron.right" android="chevron_right" size={22} tintColor={theme.accent} />
          </Pressable>
        </View>
      </View>
      <DayPickerSheet ref={dayPickerRef} onSelectDay={goToDay} />
    </BottomSheetModalProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  pastOpacity: { opacity: 0.5 },
  flex1: { flex: 1 },

  // Week navigation
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  navBtn: { padding: 4 },
  weekLabelWrap: { alignItems: "center" },
  weekSub: { marginTop: 1, textTransform: "capitalize" },

  // Body
  bodyWrap: { flex: 1, position: "relative" },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  // Fades the scrolling content out just above the week navigation bar, so
  // it reads as sliding underneath it rather than stopping abruptly.
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
  },

  // Day sections
  daySection: { marginBottom: 22 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginLeft: 2,
  },
  todayPill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  emptyDay: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  // Lesson cards (grouped, rounded first/last)
  lessonCard: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTop: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  cardBottom: { borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg },
  lessonCardWithLunch: { alignItems: "flex-start", paddingVertical: 15 },
  lessonDivider: { height: StyleSheet.hairlineWidth },
  lunchChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  lunchChipText: { fontFamily: "Figtree-SemiBold", fontSize: 12 },

  // Free slot ("Hyppytunti")
  freeSlotCard: {
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderStyle: "dashed",
  },
  freeSlotTimeTag: {},
  freeSlotTitle: { fontFamily: "Figtree-SemiBold", fontStyle: "italic", fontSize: 15 },

  timeTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  timeTagStart: { fontFamily: "Figtree-SemiBold", fontSize: 13 },
  timeTagEnd: { fontFamily: "Figtree-Regular", fontSize: 11, marginTop: 1 },
  lessonInfo: { flex: 1 },
  lessonSubject: { fontFamily: "Figtree-SemiBold", fontSize: 15 },
  lessonMeta: { marginTop: 2 },

  // Exam card
  examCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  examIcon: { marginTop: 2 },
  examTitle: { fontFamily: "Figtree-SemiBold", fontSize: 14 },
  examTime: { marginTop: 2 },
});
