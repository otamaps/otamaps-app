import { PlatformSymbol } from "@/components/PlatformSymbol";
import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import { AppText, Screen, StateView, useTheme } from "@/components/ui";
import { colors } from "@/constants/theme";
import {fonts } from "@/constants/typography";
import { syncLessonLiveActivity } from "@/lib/lessonLiveActivity";
import {
  addMinutesClock,
  clockMinutes,
  clockValue,
  freeSlotHeight,
  lessonHeight,
  LunchMatch,
  lunchSplit,
  matchLunchShift,
  splitLessonGap,
} from "@/lib/lunchShiftCore";
import { getLunchShiftsForWeekday } from "@/lib/lunchShiftService";
import { isNetworkError, isTransientNetworkError } from "@/lib/networkErrors";
import { reportHandledError } from "@/lib/sentry";
import { syncSharedWeeklySchedule } from "@/lib/sharedSchedule";
import {
  AttendanceEntry,
  clearSession,
  Exam,
  fetchAttendance,
  fetchMe,
  fetchMessages,
  fetchSchedule,
  ScheduleLesson,
  WilmaMessage,
  WilmaStudentProfile,
} from "@/lib/wilma/graphqlClient";
import { lessonLabel } from "@/lib/wilma/lessonLabels";
import {
  formatLocalISO,
  getNextSchoolDay,
  isoWeekdayOf,
  weekdayLabel,
} from "@/lib/wilma/scheduleDates";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Never switch the "Tänään" card to the next school day earlier than this. */
const NEXT_DAY_SWITCH_EARLIEST = "12:00";

/**
 * Today's *local* calendar date. `toISOString()` would answer in UTC, which
 * after 21:00/22:00 Finnish time is still yesterday — the card then asked for
 * yesterday's date on today's weekday and matched nothing.
 */
function todayISO(): string {
  return formatLocalISO(new Date());
}

function isoWeekday(): number {
  return isoWeekdayOf(new Date());
}

function todayFinnish(): string {
  return new Date().toLocaleDateString("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** A time-of-day greeting, in place of a flat "Hei" at every hour. */
function timeOfDayGreeting(hour = new Date().getHours()): string {
  if (hour < 5) return "Mene nukkumaan";
  if (hour < 11) return "Huomenta";
  if (hour < 18) return "Hyvää päivää";
  if (hour < 24) return "Iltaa";
  return "Hei";
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

type TodayRow = { key: string; start: string; end: string } & (
  | {
      kind: "lesson";
      lesson: ScheduleLesson;
      lunch: { start: string; end: string } | null;
    }
  | { kind: "freeslot"; lunch: { start: string; end: string } | null }
  | { kind: "lunch" }
);

function nestedLunchFor(
  start: string,
  end: string,
  lunch: LunchMatch | null,
): { start: string; end: string } | null {
  const split = lunch ? lunchSplit(start, end, lunch) : null;
  return split && lunch
    ? { start: clockValue(lunch.startTime), end: clockValue(lunch.endTime) }
    : null;
}

type TodaySlot =
  | { kind: "lesson"; lesson: ScheduleLesson; start: string; end: string }
  | { kind: "freeslot"; key: string; start: string; end: string }
  | { kind: "lunch"; key: string; start: string; end: string };

function todayRows(
  lessons: ScheduleLesson[],
  lunch: LunchMatch | null,
): TodayRow[] {
  const sortedLessons = [...lessons].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  // Lessons and the gap(s) after each — a real gap is either genuine free
  // time or, between two three-hour blocks, the day's lunch break; see
  // `splitLessonGap`. Short passing-period breaks produce nothing.
  const slots: TodaySlot[] = [];
  sortedLessons.forEach((lesson, i) => {
    slots.push({
      kind: "lesson",
      lesson,
      start: clockValue(lesson.start),
      end: clockValue(lesson.end),
    });
    const nextLesson = sortedLessons[i + 1];
    if (!nextLesson) return;
    splitLessonGap(lesson, nextLesson).forEach((piece, pieceIndex) => {
      const key = `gap:${lesson.reservationId}:${piece.start}:${pieceIndex}`;
      slots.push(
        piece.kind === "lunch"
          ? { kind: "lunch", key, start: piece.start, end: piece.end }
          : { kind: "freeslot", key, start: piece.start, end: piece.end },
      );
    });
  });

  // A lunch spanning the short boundary between two adjacent slots (a lesson
  // ending right where the next one starts, or a lesson and its free slot)
  // would otherwise get nested — and shown — in both. Keep it only on the
  // last slot of each run that overlaps it.
  const rawLunch = slots.map((slot) =>
    nestedLunchFor(slot.start, slot.end, lunch),
  );
  const dedupedLunch = rawLunch.map((entry, i) =>
    rawLunch[i + 1] ? null : entry,
  );

  // Lunch sits inside the long midday block, so rather than splitting the
  // lesson into a "before"/"after" pair of rows, the lesson stays a single
  // row that renders taller and shows the lunch window nested inside it.
  const rows: TodayRow[] = slots.map((slot, i) =>
    slot.kind === "lesson"
      ? {
          kind: "lesson",
          lesson: slot.lesson,
          key: String(slot.lesson.reservationId),
          start: slot.start,
          end: slot.end,
          lunch: dedupedLunch[i],
        }
      : slot.kind === "freeslot"
        ? {
            kind: "freeslot",
            key: slot.key,
            start: slot.start,
            end: slot.end,
            lunch: dedupedLunch[i],
          }
        : { kind: "lunch", key: slot.key, start: slot.start, end: slot.end },
  );

  // A lunch that falls outside every lesson and every free slot still
  // belongs on the day.
  if (lunch && !dedupedLunch.some(Boolean)) {
    rows.push({
      kind: "lunch",
      key: "lunch",
      start: clockValue(lunch.startTime),
      end: clockValue(lunch.endTime),
    });
  }

  const sortedRows = rows.sort((a, b) => a.start.localeCompare(b.start));

  // A free slot only makes sense after a lesson has already happened —
  // drop one that would otherwise open the list. A chain of several split
  // free slots (see `splitLessonGap`) is fine; only a leading one is dropped.
  return sortedRows.filter((row, i) => row.kind !== "freeslot" || i > 0);
}

// Dates from the API arrive either as ISO "YYYY-MM-DD" (dateArray) or
// Finnish "D.M.YYYY" (exam.date, attendance.date).
function formatDateFI(d: string): string {
  if (d.includes("-")) {
    const [y, m, day] = d.split("-");
    return `${parseInt(day)}.${parseInt(m)}.${y}`;
  }
  return d;
}

/** The year a mark falls in, whichever of the two shapes the API used. */
function markYear(d: string): string {
  return formatDateFI(d).split(".")[2] ?? "";
}

/**
 * An attendance date with the year left off when it is the current one — the
 * card only ever covers the last four weeks, so "3.10." is unambiguous. Marks
 * from an earlier year are dropped before they reach here; the full date is
 * kept as a fallback rather than silently printing a bare day and month for
 * one that somehow gets through.
 */
function formatMarkDate(d: string): string {
  const [day, month, year] = formatDateFI(d).split(".");
  return year === String(new Date().getFullYear())
    ? `${day}.${month}.`
    : `${day}.${month}.${year}`;
}

function finnishToISO(d: string): string {
  const [day, month, year] = d.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const ATTENDANCE_COLORS: Record<number, { bg: string; label: string }> = {
  10: { bg: "#ff6b6b", label: "Poissaolo" },
  16: { bg: "#a0522d", label: "Terveys" },
  31: { bg: "#4caf50", label: "Koulutoiminta" },
  32: { bg: "#ff9800", label: "Muu lupa" },
};

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionCard({
  title,
  badge,
  onMore,
  wholeCardPress = false,
  children,
}: {
  title: string;
  badge?: number;
  onMore?: () => void;
  /**
   * Makes the whole card open `onMore`, not just its header. Rows inside
   * that have their own action keep it — a nested Pressable claims the touch
   * first — so only use this where rows are mostly display.
   */
  wholeCardPress?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const cardPress = wholeCardPress && onMore ? onMore : undefined;
  return (
    <Pressable
      onPress={cardPress}
      disabled={!cardPress}
      accessible={false}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card },
        pressed && cardPress ? styles.cardPressed : null,
      ]}
    >
      <View style={styles.cardHeader}>
        {/* The title opens the same screen as "Kaikki →" — a heading is a much
            bigger target than the link, and people reach for it first. */}
        <Pressable
          onPress={onMore}
          disabled={!onMore}
          hitSlop={8}
          accessibilityRole={onMore ? "button" : "header"}
          accessibilityLabel={onMore ? `${title} – avaa kaikki` : title}
          style={({ pressed }) => [
            styles.cardTitleGroup,
            pressed && onMore ? styles.cardTitlePressed : null,
          ]}
        >
          <AppText variant="navTitle">{title}</AppText>
          {badge !== undefined && badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <AppText variant="micro" style={styles.badgeText}>
                {badge}
              </AppText>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.spacer} />
        {onMore ? (
          <Pressable onPress={onMore} hitSlop={8}>
            <AppText variant="meta" color="accent" style={styles.moreLink}>
              Kaikki →
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </Pressable>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <AppText variant="bodySmall" color="textMuted" style={styles.emptyText}>
      {label}
    </AppText>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

// ── Login screen ───────────────────────────────────────────────────────────────

// ── Dashboard ──────────────────────────────────────────────────────────────────

type DashboardData = {
  profile: WilmaStudentProfile;
  lessons: ScheduleLesson[];
  exams: Exam[];
  messages: WilmaMessage[];
  attendance: AttendanceEntry[];
  lunch: LunchMatch | null;
  /** Set once the day's lessons are done and the "Tänään" card shows the next school day instead. */
  scheduleDayLabel: string | null;
  /** The calendar date (`YYYY-MM-DD`) the "Tänään" card is actually showing — today's, or the next school day once its lessons are done. */
  scheduleDayISO: string;
};

export default function Dashboard({
  isDark,
  onLogout,
}: {
  isDark: boolean;
  onLogout: () => void;
}) {
  const theme = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drives which lesson row is highlighted as "current" and which are dimmed
  // as past; refreshed periodically rather than left stale for the whole day.
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

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setLoadError(null);

      try {
        const [profile, scheduleData, msgs, att] = await Promise.all([
          fetchMe({ forceRefresh: isRefresh }),
          fetchSchedule(undefined, { forceRefresh: isRefresh }),
          fetchMessages("INBOX", { forceRefresh: isRefresh }),
          fetchAttendance(0, { forceRefresh: isRefresh }),
        ]);

        const today = todayISO();
        const weekday = isoWeekday();

        const todaysLessons = scheduleData.schedule
          .filter((l) => l.day === weekday && l.dateArray.includes(today))
          .sort((a, b) => a.start.localeCompare(b.start));

        // Once the school day is over (30 min past the last lesson's end) —
        // or there were no lessons today at all — the "Tänään" card switches
        // to showing the next school day instead of sitting empty for the
        // rest of the day. Never before 10:00 though — a short day ending
        // early (e.g. one morning lesson) would otherwise flip to "tomorrow"
        // while it's still morning.
        const lastLessonEnd = todaysLessons.reduce(
          (latest, l) =>
            clockValue(l.end) > latest ? clockValue(l.end) : latest,
          "",
        );
        const nowClockValue = formatTime(new Date().toTimeString());
        const showNextDay =
          nowClockValue >= NEXT_DAY_SWITCH_EARLIEST &&
          (!lastLessonEnd ||
            nowClockValue >= addMinutesClock(lastLessonEnd, 30));

        let scheduleLessons = todaysLessons;
        let scheduleWeekday = weekday;
        let scheduleDayLabel: string | null = null;
        let scheduleDayISO = formatLocalISO(new Date());

        if (showNextDay) {
          const nextDay = getNextSchoolDay(new Date());
          const nextDayISO = formatLocalISO(nextDay);
          scheduleWeekday = isoWeekdayOf(nextDay);
          scheduleDayLabel = weekdayLabel(nextDay);
          scheduleDayISO = nextDayISO;

          let nextDayLessons = scheduleData.schedule
            .filter(
              (l) =>
                l.day === scheduleWeekday && l.dateArray.includes(nextDayISO),
            )
            .sort((a, b) => a.start.localeCompare(b.start));

          // The "current" schedule fetch may not cover a next school day that
          // falls in a different month (e.g. the last school day of a month).
          if (
            !nextDayLessons.length &&
            nextDay.getMonth() !== new Date().getMonth()
          ) {
            try {
              const monthData = await fetchSchedule(
                `1.${nextDay.getMonth() + 1}.${nextDay.getFullYear()}`,
                { forceRefresh: isRefresh },
              );
              nextDayLessons = monthData.schedule
                .filter(
                  (l) =>
                    l.day === scheduleWeekday &&
                    l.dateArray.includes(nextDayISO),
                )
                .sort((a, b) => a.start.localeCompare(b.start));
            } catch (error) {
              reportHandledError(error, {
                area: "schedule",
                operation: "fetch_next_school_day",
                level: "warning",
              });
            }
          }

          scheduleLessons = nextDayLessons;
        }

        const upcomingExams = scheduleData.exams
          .filter((e) => finnishToISO(e.date) >= today)
          .sort((a, b) =>
            finnishToISO(a.date).localeCompare(finnishToISO(b.date)),
          )
          .slice(0, 3);

        // The four-week window reaches back into the previous year every
        // January. Those marks are dropped outright rather than shown with a
        // year hanging off them; filtering before the slice keeps the list at
        // eight entries instead of eight-minus-the-dropped-ones.
        const thisYear = String(new Date().getFullYear());
        const sortedAtt = [...att]
          .filter((a) => markYear(a.date) === thisYear)
          .sort((a, b) =>
            finnishToISO(b.date).localeCompare(finnishToISO(a.date)),
          )
          .slice(0, 8);

        void syncSharedWeeklySchedule(scheduleData.schedule).catch((error) => {
          if (!isTransientNetworkError(error)) {
            reportHandledError(error, {
              area: "shared_schedule",
              operation: "sync_current_week",
              level: "warning",
            });
          }
        });

        let lunch: LunchMatch | null = null;
        try {
          const lunchRows = await getLunchShiftsForWeekday(scheduleWeekday);
          const scheduleCourseCodes = scheduleLessons
            .map(
              (l) =>
                lessonLabel(
                  l.groups[0]?.shortCaption,
                  l.groups[0]?.fullCaption,
                  l.class,
                ).code,
            )
            .filter(Boolean);
          lunch = matchLunchShift(scheduleCourseCodes, lunchRows);
        } catch (error) {
          reportHandledError(error, {
            area: "lunch_shift",
            operation: "match_today",
            level: "warning",
          });
        }

        setData({
          profile,
          lessons: scheduleLessons,
          exams: upcomingExams,
          messages: msgs.slice(0, 5),
          attendance: sortedAtt,
          lunch,
          scheduleDayLabel,
          scheduleDayISO,
        });

        // iOS cannot schedule a future Live Activity update, so the card is
        // refreshed from whatever the app has just loaded. Deliberately not
        // awaited: a Lock Screen card must never hold up the dashboard.
        void syncLessonLiveActivity({
          lessons: scheduleLessons.map((l) => {
            const group = l.groups[0];
            const { code, title } = lessonLabel(
              group?.shortCaption,
              group?.fullCaption,
              l.class,
            );
            return {
              start: l.start,
              end: l.end,
              title,
              code,
              room: group?.rooms[0]?.longCaption ?? "",
            };
          }),
          lunch,
          dayISO: scheduleDayISO,
        }).catch((error) =>
          reportHandledError(error, {
            area: "live_activity",
            operation: "sync_today",
            level: "warning",
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Lataus epäonnistui";

        if (msg.includes("UNAUTHENTICATED")) {
          // Token gone and re-auth failed inside gqlFetch – go to login
          clearSession(); // fire and forget
          onLogout();
          return;
        }
        setLoadError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onLogout],
  );

  // Loaded once, then only on pull to refresh. Reloading on every focus put
  // the whole screen behind a spinner each time the tab came back, for data
  // that barely moves within a session.
  const loadedDay = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      // The one thing that does force a reload: the card is built around
      // "today", so an app left open past midnight would otherwise keep
      // showing yesterday's lessons.
      const today = todayISO();
      if (loadedDay.current === today) return;
      loadedDay.current = today;
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // The greeting stays the app's own, at the top of the scroll rather than
  // in a navigation bar. `Screen` gives the shell the bar would otherwise
  // have: the safe-area inset and the page colour behind the cards.
  return (
    <Screen background="page">
      <ScrollView
        contentContainerStyle={styles.dashContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
      >
        <View style={styles.dashHeader}>
          <AppText variant="heading2" style={styles.dashGreeting}>
            {timeOfDayGreeting()}, {data?.profile.firstName || "opiskelija"}!
          </AppText>
          {/* <AppText variant="body" color="textMuted" style={styles.dashDate}>
            {todayFinnish()}
          </AppText> */}
        </View>

        {loading ? (
          <StateView loading />
        ) : loadError ? (
          <StateView
            icon={isNetworkError(loadError) ? "wifi-off" : "error-outline"}
            message={
              isNetworkError(loadError)
                ? "Ei yhteyttä palvelimeen. Tarkista, että olet verkossa."
                : loadError
            }
            actionLabel="Yritä uudelleen"
            onAction={() => load()}
          />
        ) : (
          <>
            {/* Today's lessons (or, once the day is done, the next school day's) */}
            <SectionCard
              title={data?.scheduleDayLabel ?? "Tänään"}
              wholeCardPress
              onMore={() =>
                router.push({
                  pathname: "/wilma/schedule",
                  params: data?.scheduleDayISO
                    ? { day: data.scheduleDayISO }
                    : {},
                })
              }
            >
              {!data?.lessons.length && !data?.lunch ? (
                <EmptyRow
                  label={
                    data?.scheduleDayLabel ? "Ei tunteja" : "Ei tunteja tänään"
                  }
                />
              ) : (
                (() => {
                  const rows = todayRows(
                    data?.lessons ?? [],
                    data?.lunch ?? null,
                  );
                  return rows.map((row, i) => {
                    // A free slot already reads as a break in the list via its
                    // dashed border, so a divider directly touching it just
                    // doubles up on that same visual cue.
                    const showDivider =
                      i > 0 &&
                      row.kind !== "freeslot" &&
                      rows[i - 1].kind !== "freeslot";
                    // Without that divider, a free slot needs a little breathing
                    // room from the lesson that just ended above it.
                    const spaceAboveFreeSlot =
                      row.kind === "freeslot" &&
                      i > 0 &&
                      rows[i - 1].kind === "lesson";

                    // Past/current highlighting only makes sense against today's
                    // clock — once the card is showing the next school day, none
                    // of its rows are "past" or "current" yet.
                    const isShowingToday = !data?.scheduleDayLabel;
                    const isPast = isShowingToday && row.end <= nowClock;
                    const isCurrent =
                      isShowingToday &&
                      row.start <= nowClock &&
                      nowClock < row.end;
                    // A lesson that is over drops its blue accent for a neutral
                    // gray, so the colored badges left on the card are only the
                    // ones still ahead.
                    const timeColor = isCurrent
                      ? isDark
                        ? "#4ADE80"
                        : "#16A34A"
                      : isPast
                        ? isDark
                          ? "#9CA3AF"
                          : "#8A929D"
                        : isDark
                          ? "#51a2ff"
                          : "#3478F5";
                    const timeSubColor = isCurrent
                      ? isDark
                        ? "#4ADE8080"
                        : "#16A34A80"
                      : isPast
                        ? isDark
                          ? "#9CA3AF80"
                          : "#8A929D80"
                        : isDark
                          ? "#51a2ff70"
                          : "#3478F580";

                    if (row.kind === "lunch") {
                      const lunchOnlyTimeColor = isCurrent
                        ? timeColor
                        : isDark
                          ? "#FBBF24"
                          : "#B45309";
                      const lunchOnlyTimeSubColor = isCurrent
                        ? timeSubColor
                        : isDark
                          ? "#FBBF2480"
                          : "#B4530980";
                      return (
                        <React.Fragment key={row.key}>
                          {showDivider && <Divider />}
                          <View
                            style={[
                              styles.lessonRow,
                              isCurrent && styles.rowCurrent,
                              isCurrent && isDark && styles.rowCurrentDark,
                              isPast && styles.rowPast,
                            ]}
                          >
                            <View
                              style={[
                                styles.timeTag,
                                {
                                  backgroundColor: isDark
                                    ? "#78350F55"
                                    : "#FEF3C7",
                                },
                                isCurrent && styles.timeTagCurrent,
                                isCurrent &&
                                  isDark &&
                                  styles.timeTagCurrentDark,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timeTagText,
                                  { color: lunchOnlyTimeColor },
                                ]}
                              >
                                {row.start}
                              </Text>
                              <Text
                                style={[
                                  styles.timeTagSub,
                                  { color: lunchOnlyTimeSubColor },
                                ]}
                              >
                                {row.end}
                              </Text>
                            </View>
                            <View style={styles.lessonInfo}>
                              <LessonTitleRow
                                title="Lounas"
                                isDark={isDark}
                                numberOfLines={1}
                                titleStyle={[
                                  styles.lessonSubject,
                                  isDark && { color: "#fff" },
                                ]}
                              />
                            </View>
                          </View>
                        </React.Fragment>
                      );
                    }

                    if (row.kind === "freeslot") {
                      const freeSlotTimeColor = isCurrent
                        ? timeColor
                        : isDark
                          ? "#9CA3AF"
                          : "#8A929D";
                      const freeSlotTimeSubColor = isCurrent
                        ? timeSubColor
                        : isDark
                          ? "#9CA3AF80"
                          : "#8A929D80";
                      // The gap's real end always lands exactly on the next
                      // lesson's start, so the two rows would show the same time
                      // back to back — trim the label a few minutes early so it
                      // doesn't read as a duplicate.
                      const freeSlotDisplayEnd = addMinutesClock(row.end, -5);
                      const tallHeight = freeSlotHeight(
                        clockMinutes(row.end) - clockMinutes(row.start),
                      );
                      return (
                        <React.Fragment key={row.key}>
                          {showDivider && <Divider />}
                          <View
                            style={[
                              styles.lessonRow,
                              styles.freeSlotRow,
                              isDark && styles.freeSlotRowDark,
                              !!row.lunch && styles.lessonRowWithLunch,
                              isPast && styles.rowPast,
                              spaceAboveFreeSlot && styles.freeSlotSpaceAbove,
                              !!tallHeight && {
                                minHeight: tallHeight,
                                alignItems: "center",
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.timeTag,
                                styles.freeSlotTimeTag,
                                isDark && styles.freeSlotTimeTagDark,
                                isCurrent && styles.timeTagCurrent,
                                isCurrent &&
                                  isDark &&
                                  styles.timeTagCurrentDark,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timeTagText,
                                  { color: freeSlotTimeColor },
                                ]}
                              >
                                {row.start}
                              </Text>
                              <Text
                                style={[
                                  styles.timeTagSub,
                                  { color: freeSlotTimeSubColor },
                                ]}
                              >
                                {freeSlotDisplayEnd}
                              </Text>
                            </View>
                            <View style={styles.lessonInfo}>
                              <LessonTitleRow
                                title="Hyppytunti"
                                isDark={isDark}
                                numberOfLines={1}
                                titleStyle={
                                  isCurrent
                                    ? [
                                        styles.lessonSubject,
                                        isDark && { color: "#fff" },
                                      ]
                                    : [
                                        styles.freeSlotTitle,
                                        isDark && styles.freeSlotTitleDark,
                                      ]
                                }
                              />
                              {!!row.lunch && (
                                <View
                                  style={[
                                    styles.lunchChip,
                                    isDark && styles.lunchChipDark,
                                  ]}
                                >
                                  <PlatformSymbol
                                    ios="fork.knife"
                                    android="restaurant"
                                    size={11}
                                    tintColor={isDark ? "#FBBF24" : "#B45309"}
                                  />
                                  <Text
                                    style={[
                                      styles.lunchChipText,
                                      isDark && styles.lunchChipTextDark,
                                    ]}
                                  >
                                    Lounas {row.lunch.start}–{row.lunch.end}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </React.Fragment>
                      );
                    }

                    const lesson = row.lesson;
                    const group = lesson.groups[0];
                    const room = group?.rooms[0]?.longCaption ?? "";
                    const teacher = group?.teachers[0]?.longCaption ?? "";
                    const { code, title } = lessonLabel(
                      group?.shortCaption,
                      group?.fullCaption,
                      lesson.class,
                    );
                    const lessonTallHeight = lessonHeight(
                      clockMinutes(row.end) - clockMinutes(row.start),
                    );
                    return (
                      <React.Fragment key={row.key}>
                        {showDivider && <Divider />}
                        <Pressable
                          disabled={!room}
                          onPress={() =>
                            router.push({
                              pathname: "/map",
                              params: { roomQuery: room },
                            })
                          }
                          style={({ pressed }) => [
                            styles.lessonRow,
                            !!row.lunch && styles.lessonRowWithLunch,
                            // isCurrent && styles.rowCurrent,
                            // isCurrent && isDark && styles.rowCurrentDark,
                            isPast && styles.rowPast,
                            pressed && !!room && styles.rowPressed,
                            !!lessonTallHeight && {
                              minHeight: lessonTallHeight,
                              alignItems: "center",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.timeTag,
                              isDark && { backgroundColor: "#51A2FF1F" },
                              isPast && styles.timeTagPast,
                              isPast && isDark && styles.timeTagPastDark,
                              isCurrent && styles.timeTagCurrent,
                              isCurrent && isDark && styles.timeTagCurrentDark,
                            ]}
                          >
                            <Text
                              style={[styles.timeTagText, { color: timeColor }]}
                            >
                              {row.start}
                            </Text>
                            <Text
                              style={[
                                styles.timeTagSub,
                                { color: timeSubColor },
                              ]}
                            >
                              {row.end}
                            </Text>
                          </View>
                          <View style={styles.lessonInfo}>
                            <LessonTitleRow
                              title={title}
                              code={code}
                              isDark={isDark}
                              numberOfLines={1}
                              titleStyle={[
                                styles.lessonSubject,
                                isDark && { color: "#fff" },
                              ]}
                            />
                            <Text
                              style={[
                                styles.lessonMeta,
                                isDark && { color: "#aaa" },
                              ]}
                              numberOfLines={1}
                            >
                              {[room, teacher].filter(Boolean).join(" · ")}
                            </Text>
                            {!!row.lunch && (
                              <View
                                style={[
                                  styles.lunchChip,
                                  isDark && styles.lunchChipDark,
                                ]}
                              >
                                <PlatformSymbol
                                  ios="fork.knife"
                                  android="restaurant"
                                  size={11}
                                  tintColor={isDark ? "#FBBF24" : "#B45309"}
                                />
                                <Text
                                  style={[
                                    styles.lunchChipText,
                                    isDark && styles.lunchChipTextDark,
                                  ]}
                                >
                                  Lounas {row.lunch.start}–{row.lunch.end}
                                </Text>
                              </View>
                            )}
                          </View>
                        </Pressable>
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </SectionCard>

            {/* Upcoming exams */}
            <SectionCard title="Tulevat kokeet">
              {!data?.exams.length ? (
                <EmptyRow label="Ei tulevia kokeita" />
              ) : (
                data.exams.map((exam, i) => {
                  const { code, title } = lessonLabel(
                    exam.course,
                    exam.courseTitle,
                  );
                  return (
                    <React.Fragment key={exam.examId}>
                      {i > 0 && <Divider />}
                      <View style={styles.examRow}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <LessonTitleRow
                            title={title}
                            code={code}
                            isDark={isDark}
                            numberOfLines={1}
                            titleStyle={[
                              styles.examCourse,
                              { color: theme.text },
                            ]}
                          />
                          {exam.name ? (
                            <AppText
                              variant="meta"
                              color="textSecondary"
                              style={styles.examName}
                              numberOfLines={1}
                            >
                              {exam.name}
                            </AppText>
                          ) : null}
                          {exam.teachers[0] && (
                            <AppText
                              variant="caption"
                              color="textMuted"
                              style={styles.examMeta}
                              numberOfLines={1}
                            >
                              {exam.teachers[0].teacherName}
                            </AppText>
                          )}
                        </View>
                        <View style={styles.examDateBox}>
                          <AppText variant="rowTitle" color="accent">
                            {formatDateFI(exam.date)}
                          </AppText>
                          <AppText
                            variant="caption"
                            color="accent"
                            style={styles.examTime}
                          >
                            {formatTime(exam.timeStart)}
                          </AppText>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })
              )}
            </SectionCard>

            {/* Messages */}
            <SectionCard
              title="Viestit"
              wholeCardPress
              onMore={() => router.push("/wilma/messages")}
            >
              {!data?.messages.length ? (
                <EmptyRow label="Ei viestejä" />
              ) : (
                data.messages.map((msg, i) => (
                  <React.Fragment key={msg.id}>
                    {i > 0 && <Divider />}
                    <Pressable
                      style={({ pressed }) => [
                        styles.msgRow,
                        pressed && styles.rowPressed,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/wilma/message",
                          params: {
                            id: String(msg.id),
                            subject: msg.subject,
                            sender: msg.senders[0]?.name ?? msg.sender,
                          },
                        })
                      }
                    >
                      <View style={styles.msgInfo}>
                        <AppText variant="rowTitle" numberOfLines={1}>
                          {msg.subject}
                        </AppText>
                        <AppText
                          variant="meta"
                          color="textMuted"
                          style={styles.msgSender}
                          numberOfLines={1}
                        >
                          {msg.senders.map((s) => s.name).join(", ")}
                        </AppText>
                      </View>
                      <View style={styles.msgRight}>
                        <AppText variant="caption" color="textMuted">
                          {new Date(
                            msg.timestamp.replace(" ", "T"),
                          ).toLocaleDateString("fi-FI", {
                            day: "numeric",
                            month: "numeric",
                          })}
                        </AppText>
                        {msg.isEvent && (
                          <View
                            style={[
                              styles.eventChip,
                              { backgroundColor: theme.accentTint },
                            ]}
                          >
                            <AppText variant="micro" color="accent">
                              Tapahtuma
                            </AppText>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </React.Fragment>
                ))
              )}
            </SectionCard>

            {/* Attendance */}
            <SectionCard title="Merkinnät (4 vko)">
              {!data?.attendance.length ? (
                <EmptyRow label="Ei merkintöjä" />
              ) : (
                data.attendance.map((entry, i) => {
                  const info = ATTENDANCE_COLORS[entry.typeCode] ?? {
                    bg: "#aaa",
                    label: entry.status,
                  };
                  return (
                    <React.Fragment key={`${entry.date}-${i}`}>
                      {i > 0 && <Divider />}
                      <View style={styles.attRow}>
                        <AppText
                          variant="meta"
                          color="textMuted"
                          style={styles.attDate}
                        >
                          {formatMarkDate(entry.date)}
                        </AppText>
                        <AppText
                          variant="bodySmall"
                          style={styles.attCourse}
                          numberOfLines={1}
                        >
                          {entry.course}
                        </AppText>
                        <View
                          style={[
                            styles.attChip,
                            { backgroundColor: info.bg + "28" },
                          ]}
                        >
                          <AppText variant="micro" style={{ color: info.bg }}>
                            {info.label}
                          </AppText>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })
              )}
            </SectionCard>

            <SectionCard title="Lisää Wilmasta">
              <Pressable
                style={styles.moreWilmaRow}
                onPress={() => router.push("/wilma/coursework" as never)}
              >
                <PlatformSymbol
                  ios="doc.text"
                  android="assignment"
                  size={22}
                  tintColor={theme.accent}
                />
                <View style={styles.moreWilmaText}>
                  <AppText variant="rowTitle">Kurssit ja tehtävät</AppText>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.moreWilmaSubtitle}
                  >
                    Kotitehtävät, tuntipäiväkirja ja kurssikokeet
                  </AppText>
                </View>
                <PlatformSymbol
                  ios="chevron.right"
                  android="chevron_right"
                  size={22}
                  tintColor={theme.textFaint}
                />
              </Pressable>
              <Divider />
              <Pressable
                style={styles.moreWilmaRow}
                onPress={() => router.push("/wilma/course-selections" as never)}
              >
                <PlatformSymbol
                  ios="rectangle.grid.1x2"
                  android="view_week"
                  size={22}
                  tintColor={theme.accent}
                />
                <View style={styles.moreWilmaText}>
                  <AppText variant="rowTitle">Kurssivalinnat</AppText>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.moreWilmaSubtitle}
                  >
                    Omat valinnat ja tarjottimet vain luku -tilassa
                  </AppText>
                </View>
                <PlatformSymbol
                  ios="chevron.right"
                  android="chevron_right"
                  size={22}
                  tintColor={theme.textFaint}
                />
              </Pressable>
              <Divider />
              <Pressable
                style={styles.moreWilmaRow}
                onPress={() => router.push("/wilma/rooms" as never)}
              >
                <PlatformSymbol
                  ios="door.left.hand.open"
                  android="meeting_room"
                  size={22}
                  tintColor={theme.accent}
                />
                <View style={styles.moreWilmaText}>
                  <AppText variant="rowTitle">Tilojen lukujärjestykset</AppText>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.moreWilmaSubtitle}
                  >
                    Katso milloin luokkahuone on käytössä
                  </AppText>
                </View>
                <PlatformSymbol
                  ios="chevron.right"
                  android="chevron_right"
                  size={22}
                  tintColor={theme.textFaint}
                />
              </Pressable>
              <Divider />
              <Pressable
                style={styles.moreWilmaRow}
                onPress={() => router.push("/wilma/teachers" as never)}
              >
                <PlatformSymbol
                  ios="person.2"
                  android="group"
                  size={22}
                  tintColor={theme.accent}
                />
                <View style={styles.moreWilmaText}>
                  <AppText variant="rowTitle">
                    Opettajat ja henkilökunta
                  </AppText>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.moreWilmaSubtitle}
                  >
                    Opettajien lukujärjestykset ja viestit
                  </AppText>
                </View>
                <PlatformSymbol
                  ios="chevron.right"
                  android="chevron_right"
                  size={22}
                  tintColor={theme.textFaint}
                />
              </Pressable>
              <Divider />
              <Pressable
                style={styles.moreWilmaRow}
                onPress={() => router.push("/wilma/news" as never)}
              >
                <PlatformSymbol
                  ios="megaphone"
                  android="campaign"
                  size={22}
                  tintColor={theme.accent}
                />
                <View style={styles.moreWilmaText}>
                  <AppText variant="rowTitle">Tiedotteet</AppText>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.moreWilmaSubtitle}
                  >
                    Koulun ajankohtaiset tiedotteet
                  </AppText>
                </View>
                <PlatformSymbol
                  ios="chevron.right"
                  android="chevron_right"
                  size={22}
                  tintColor={theme.textFaint}
                />
              </Pressable>
              <Divider />
              <Pressable
                style={styles.moreWilmaRow}
                onPress={() => router.push("/wilma/grades" as never)}
              >
                <PlatformSymbol
                  ios="checkmark.seal"
                  android="fact_check"
                  size={22}
                  tintColor={theme.accent}
                />
                <View style={styles.moreWilmaText}>
                  <AppText variant="rowTitle">Arvosanat</AppText>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.moreWilmaSubtitle}
                  >
                    Kurssisuoritukset, kokeet ja yo-tulokset
                  </AppText>
                </View>
                <PlatformSymbol
                  ios="chevron.right"
                  android="chevron_right"
                  size={22}
                  tintColor={theme.textFaint}
                />
              </Pressable>
            </SectionCard>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  moreWilmaRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  moreWilmaText: { flex: 1 },
  moreWilmaSubtitle: { marginTop: 2 },
  dashHeader: { marginBottom: 22, marginTop: 4 },
  dashGreeting: { letterSpacing: -0.4 },
  dashContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  // AppText supplies the face and the colour; only the placement and the
  // capitalisation are this screen's own.
  dashDate: { marginTop: 2, textTransform: "capitalize" },
  card: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  cardTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitlePressed: {
    opacity: 0.6,
  },
  cardPressed: {
    opacity: 0.85,
  },
  spacer: { flex: 1 },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.textOnDark },
  moreLink: { ...fonts.medium },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  emptyText: { textAlign: "center", paddingVertical: 8 },
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: -8,
  },
  lessonRowWithLunch: { alignItems: "flex-start", paddingVertical: 8 },
  rowCurrent: { backgroundColor: "#16A34A14" },
  rowCurrentDark: { backgroundColor: "#4ADE8022" },
  rowPast: { opacity: 0.45 },
  rowPressed: { opacity: 0.6 },
  freeSlotRow: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D9DEE5",
    paddingVertical: 7,
    marginVertical: 8,
  },
  freeSlotRowDark: { borderColor: "#4A5058" },
  freeSlotSpaceAbove: { marginVertical: 0, marginTop: 8 },
  freeSlotTimeTag: { backgroundColor: "#F3F4F6" },
  freeSlotTimeTagDark: { backgroundColor: "#3A3F46" },
  freeSlotTitle: {
    ...fonts.semiBold,
    fontStyle: "italic",
    fontSize: 15,
    color: "#888",
  },
  freeSlotTitleDark: { color: "#AAA" },
  timeTag: {
    backgroundColor: "#EEF4FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 46,
  },
  timeTagCurrent: { backgroundColor: "#16A34A1A" },
  timeTagCurrentDark: { backgroundColor: "#4ADE8022" },
  timeTagPast: { backgroundColor: "#F3F4F6" },
  timeTagPastDark: { backgroundColor: "#2E3034" },
  timeTagText: {
    ...fonts.semiBold,
    fontSize: 13,
    color: "#3478F5",
  },
  timeTagSub: {
    ...fonts.regular,
    fontSize: 11,
    color: "#3478F580",
    marginTop: 1,
  },
  lessonInfo: { flex: 1 },
  lessonSubject: {
    ...fonts.semiBold,
    fontSize: 15,
    color: "#222",
  },
  lessonMeta: {
    ...fonts.regular,
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  lunchChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "#FEF3C7",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  lunchChipDark: { backgroundColor: "#78350F55" },
  lunchChipText: {
    ...fonts.semiBold,
    fontSize: 12,
    color: "#B45309",
  },
  lunchChipTextDark: { color: "#FBBF24" },
  examRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  examCourse: { ...fonts.semiBold, fontSize: 15 },
  examName: { marginTop: 2 },
  examMeta: { marginTop: 2 },
  examDateBox: { alignItems: "flex-end" },
  // The accent at half strength, as the hex #3478F580 was.
  examTime: { marginTop: 2, opacity: 0.5 },
  msgRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  msgInfo: { flex: 1 },
  msgSender: { marginTop: 2 },
  msgRight: { alignItems: "flex-end" },
  eventChip: {
    backgroundColor: "#51A2FF1F",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  attRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attDate: { width: 52 },
  attCourse: { ...fonts.medium, flex: 1 },
  attChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
