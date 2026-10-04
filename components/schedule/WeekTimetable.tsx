import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import { timeTagColors } from "@/components/schedule/status";
import { WeekNav, WeekNavFade } from "@/components/schedule/WeekNav";
import { AppText, StateView, useNativeHeader, useTheme, type Theme } from "@/components/ui";
import { radii } from "@/constants/theme";
import {fonts, typography } from "@/constants/typography";
import { addMinutesClock, clockValue } from "@/lib/lunchShiftCore";
import { lessonLabel } from "@/lib/wilma/lessonLabels";
import {
  formatLocalISO,
  getMondayOfWeek,
  getNextSchoolDay,
  getSchoolWeekDays,
  parseLocalISO,
  shortDateLabel,
  weekdayLabel,
} from "@/lib/wilma/scheduleDates";
import { Stack } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

/** Never highlight the next school day instead of today earlier than this. */
const NEXT_DAY_SWITCH_EARLIEST = "12:00";

export type TimetableLesson = {
  /** ISO weekday, 1 = Monday. Anything outside Mon–Fri is dropped. */
  day: number;
  start: string;
  end: string;
  /** `detail` is the line under the title — rooms for a teacher, teachers for a room. */
  groups: { code: string; name: string; detail: string }[];
};

type Props = {
  title: string;
  /** A short line above the week — a teacher's code, a room's full name. */
  subtitle?: string;
  /** Fetches the school week starting on `monday`. Throw to show an error. */
  fetchWeek: (monday: Date, forceRefresh: boolean) => Promise<TimetableLesson[]>;
};

function currentClock(): string {
  return clockValue(new Date().toTimeString());
}

/**
 * Somebody else's week, read-only: a teacher's or a room's. The personal
 * schedule has lunch shifts, free slots and exams layered on; this is the
 * same day-by-day card list without any of that, which is all those two
 * screens had ever been — each a 730-line copy of the other.
 */
export function WeekTimetable({ title, subtitle, fetchWeek }: Props) {
  const theme = useTheme();
  // On iOS the scroll view runs up under the bar and UIKit insets it by the
  // bar's height, so its resting offset is negative by that much and a
  // programmatic scroll has to account for it. Android lays it out below.
  const headerHeight = useHeaderHeight();
  const topInset = Platform.OS === "ios" ? headerHeight : 0;
  const scrollTop = -topInset;

  const [weekOffset, setWeekOffset] = useState(0);
  const [lessons, setLessons] = useState<TimetableLesson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drives which rows read as past or current; refreshed periodically rather
  // than left stale for the whole day.
  const [nowClock, setNowClock] = useState(currentClock);
  useEffect(() => {
    const id = setInterval(() => setNowClock(currentClock()), 30000);
    return () => clearInterval(id);
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const dayOffsets = useRef<Record<string, number>>({});
  const pendingScrollDay = useRef<string | null>(null);
  // Landing on today is a one-time convenience on open. Once it has happened —
  // or the reader has moved the week themselves — it must never yank their
  // scroll position again.
  const didAutoScroll = useRef(false);

  const today = formatLocalISO(new Date());
  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const weekDates = useMemo(() => getSchoolWeekDays(monday), [monday]);

  const load = useCallback(
    async (forceRefresh = false) => {
      // A refresh keeps the week on screen so the pull-to-refresh spinner —
      // and the reader's scroll position — survive the reload.
      if (!forceRefresh) {
        dayOffsets.current = {};
        setLoading(true);
      }
      setError(null);
      try {
        setLessons(await fetchWeek(getMondayOfWeek(weekOffset), forceRefresh));
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Lukujärjestyksen lataaminen epäonnistui.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchWeek, weekOffset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const stepWeek = useCallback(
    (delta: number) => {
      didAutoScroll.current = true;
      pendingScrollDay.current = null;
      setWeekOffset((offset) => offset + delta);
      scrollRef.current?.scrollTo({ y: scrollTop, animated: false });
    },
    [scrollTop],
  );

  const lessonsByDay = useMemo(() => {
    const byDay: Record<number, TimetableLesson[]> = {};
    for (const lesson of lessons ?? []) {
      if (lesson.day >= 1 && lesson.day <= 5) (byDay[lesson.day] ??= []).push(lesson);
    }
    for (const day of Object.values(byDay)) day.sort((a, b) => a.start.localeCompare(b.start));
    return byDay;
  }, [lessons]);

  // The day marked with a pill: today, or — once today's last lesson has been
  // over for 30+ minutes, or there is nothing today at all — the next school
  // day, matching how the personal schedule reads. Only meaningful on the
  // current week; any other week has no "today" on screen.
  const highlightedDay = useMemo(() => {
    if (weekOffset !== 0) return today;
    const todayIndex = weekDates.indexOf(today);
    const todaysLessons = todayIndex >= 0 ? (lessonsByDay[todayIndex + 1] ?? []) : [];
    const lastLessonEnd = todaysLessons.reduce(
      (latest, lesson) => (clockValue(lesson.end) > latest ? clockValue(lesson.end) : latest),
      "",
    );
    const showNextDay =
      nowClock >= NEXT_DAY_SWITCH_EARLIEST &&
      (!lastLessonEnd || nowClock >= addMinutesClock(lastLessonEnd, 30));
    return showNextDay ? formatLocalISO(getNextSchoolDay(new Date())) : today;
  }, [lessonsByDay, nowClock, today, weekDates, weekOffset]);

  const scrollToDay = useCallback(
    (day: string) => {
      const y = dayOffsets.current[day];
      // The section may not be measured yet; the next onLayout finishes the job.
      if (y === undefined) {
        pendingScrollDay.current = day;
        return;
      }
      pendingScrollDay.current = null;
      // Wait a frame so the ScrollView has taken the new content height;
      // without it a jump to the last day of the week gets clamped back to the top.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(scrollTop, y - 4 - topInset),
          animated: false,
        });
      });
    },
    [scrollTop, topInset],
  );

  const handleDayLayout = useCallback(
    (day: string, y: number) => {
      dayOffsets.current[day] = y;
      if (pendingScrollDay.current === day) scrollToDay(day);
    },
    [scrollToDay],
  );

  // Open on the day worth reading rather than on Monday. Only the current
  // week can do this, and only once.
  useEffect(() => {
    if (didAutoScroll.current) return;
    if (loading || error || !lessons || weekOffset !== 0) return;
    didAutoScroll.current = true;
    // A Friday evening rolls the highlight into next week, which this screen
    // is not showing — the week reads fine from the top.
    if (weekDates.includes(highlightedDay)) scrollToDay(highlightedDay);
  }, [error, highlightedDay, lessons, loading, scrollToDay, weekDates, weekOffset]);

  // Same shape as the personal schedule, for the same reason: the soft edge
  // attaches to the scroll view found by following each view's FIRST child
  // down from the screen, so the ScrollView stays mounted through loading
  // and errors (they render inside it) and leads every wrapper it sits in.
  const header = useNativeHeader({
    title,
    background: "page",
    large: false,
    edgeEffect: "soft",
  });

  return (
    <>
      <Stack.Screen options={header} />
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.bodyWrap}>
          <ScrollView
            ref={scrollRef}
            contentInsetAdjustmentBehavior="automatic"
            style={styles.body}
            contentContainerStyle={[
              styles.bodyContent,
              (loading || !!error) && styles.bodyContentState,
            ]}
            scrollEnabled={!loading && !error}
            refreshControl={
              loading || error ? undefined : (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
              )
            }
          >
            {loading ? (
              <StateView loading />
            ) : error ? (
              <StateView
                icon="error-outline"
                message={error}
                actionLabel="Yritä uudelleen"
                onAction={() => void load()}
              />
            ) : (
              <>
                {subtitle ? (
                  <AppText variant="meta" color="textMuted" style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </AppText>
                ) : null}
                {weekDates.map((dayISO, index) => (
                  <DaySection
                    key={dayISO}
                    dayISO={dayISO}
                    lessons={lessonsByDay[index + 1] ?? []}
                    today={today}
                    highlightedDay={highlightedDay}
                    nowClock={nowClock}
                    theme={theme}
                    onLayout={handleDayLayout}
                  />
                ))}
              </>
            )}
          </ScrollView>
          <WeekNavFade />
        </View>
        <WeekNav monday={monday} onStep={stepWeek} />
      </View>
    </>
  );
}

function DaySection({
  dayISO,
  lessons,
  today,
  highlightedDay,
  nowClock,
  theme,
  onLayout,
}: {
  dayISO: string;
  lessons: TimetableLesson[];
  today: string;
  highlightedDay: string;
  nowClock: string;
  theme: Theme;
  onLayout: (day: string, y: number) => void;
}) {
  const parsed = parseLocalISO(dayISO);
  const isToday = dayISO === today;
  // Once the highlight has moved on to the next school day (today's last
  // lesson is long over), today itself is done too and dims along with the
  // actually-past days.
  const isPastDay = dayISO < highlightedDay;
  const isHighlighted = dayISO === highlightedDay;

  return (
    <View
      style={[styles.daySection, isPastDay && styles.pastOpacity]}
      onLayout={(event) => onLayout(dayISO, event.nativeEvent.layout.y)}
    >
      <View style={styles.dayHeader}>
        <AppText variant="rowTitle" color={isHighlighted ? "accent" : "text"}>
          {parsed ? weekdayLabel(parsed) : dayISO}
        </AppText>
        <AppText variant="meta" color="textMuted">
          {parsed ? shortDateLabel(parsed) : ""}
        </AppText>
        <View style={styles.flex1} />
        {isHighlighted && (
          <View
            style={[
              styles.todayPill,
              { backgroundColor: theme.accentTint, borderColor: theme.accent + "49" },
            ]}
          >
            <AppText variant="micro" color="accent">
              {isToday ? "Tänään" : "Huomenna"}
            </AppText>
          </View>
        )}
      </View>

      {lessons.length ? (
        // One continuous card with hairlines between lessons rather than a
        // stack of separate boxes, matching the personal schedule.
        <View style={[styles.dayCard, { backgroundColor: theme.card }]}>
          {lessons.map((lesson, i) => {
            const end = clockValue(lesson.end);
            const start = clockValue(lesson.start);
            // Stacking the row dim on top of an already dimmed day would make
            // today's lessons darker than a genuinely past day's.
            const isPast = !isPastDay && isToday && end <= nowClock;
            const isCurrent = isToday && start <= nowClock && nowClock < end;
            // Unlike the dim, the grey badge also applies on a day that has
            // wholly passed — a colour under the day's opacity reads fine.
            const isOver = isPastDay || (isToday && end <= nowClock);
            const tag = timeTagColors(theme, { isCurrent, isOver });

            return (
              <Fragment key={`${lesson.start}-${i}`}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={[styles.lesson, isPast && styles.pastOpacity]}>
                  <View style={[styles.timeTag, { backgroundColor: tag.fill }]}>
                    <AppText style={[styles.timeTagStart, { color: tag.start }]}>{start}</AppText>
                    <AppText style={[styles.timeTagEnd, { color: tag.end }]}>{end}</AppText>
                  </View>
                  <View style={styles.flex1}>
                    {lesson.groups.map((group, groupIndex) => {
                      const { code, title } = lessonLabel(group.code, group.name);
                      return (
                        <View key={`${group.code}-${group.name}-${groupIndex}`}>
                          <LessonTitleRow
                            title={title}
                            code={code}
                            isDark={theme.isDark}
                            numberOfLines={2}
                            titleStyle={[typography.rowTitle, { color: theme.text }]}
                          />
                          {!!group.detail && (
                            <AppText
                              variant="bodySmall"
                              color="textMuted"
                              style={styles.detail}
                              numberOfLines={1}
                            >
                              {group.detail}
                            </AppText>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Fragment>
            );
          })}
        </View>
      ) : (
        <View style={[styles.emptyDay, { borderColor: theme.border }]}>
          <AppText variant="bodySmall" color="textFaint">
            Ei oppitunteja
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pastOpacity: { opacity: 0.5 },
  flex1: { flex: 1 },

  bodyWrap: { flex: 1, position: "relative" },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  // Loading and error fill the viewport so StateView can centre itself.
  bodyContentState: { flexGrow: 1 },
  subtitle: { marginLeft: 2, marginBottom: 14 },

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
  dayCard: { borderRadius: radii.lg, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth },
  emptyDay: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  lesson: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  timeTagStart: { ...fonts.semiBold, fontSize: 13, lineHeight: 17 },
  timeTagEnd: { ...fonts.regular, fontSize: 11, lineHeight: 14, marginTop: 1 },
  detail: { marginTop: 2 },
});
