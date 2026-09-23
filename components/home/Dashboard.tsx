import { PlatformSymbol } from "@/components/PlatformSymbol";
import LessonTitleRow from "@/components/schedule/LessonTitleRow";
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
import { syncLessonLiveActivity } from "@/lib/lessonLiveActivity";
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
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


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
  children,
  isDark,
}: {
  title: string;
  badge?: number;
  onMore?: () => void;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <View style={[styles.card, isDark && { backgroundColor: "#232427" }]}>
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
          <Text style={[styles.cardTitle, isDark && { color: "#fff" }]}>
            {title}
          </Text>
          {badge !== undefined && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }} />
        {onMore && (
          <Pressable onPress={onMore} hitSlop={8}>
            <Text style={[styles.moreLink, isDark && { color: "#51a2ff" }]}>
              Kaikki →
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function EmptyRow({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <Text style={[styles.emptyText, isDark && { color: "#666" }]}>{label}</Text>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <View style={[styles.divider, isDark && { backgroundColor: "#454545" }]} />
  );
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

  // ── Loading state
  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={isDark ? "#51a2ff" : "#3478F5"}
          />
          <Text style={[styles.loadingLabel, isDark && { color: "#888" }]}>
            Ladataan tietoja...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Connection / load error
  if (loadError) {
    const isNet = isNetworkError(loadError);
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      >
        <View style={styles.centered}>
          <PlatformSymbol
            ios={isNet ? "wifi.slash" : "exclamationmark.circle"}
            android={isNet ? "wifi_off" : "error"}
            size={52}
            tintColor={isDark ? "#555" : "#ccc"}
          />
          <Text style={[styles.errorHeading, isDark && { color: "#d4d4d4" }]}>
            {isNet ? "Ei yhteyttä palvelimeen" : "Lataus epäonnistui"}
          </Text>
          <Text style={[styles.errorBody, isDark && { color: "#888" }]}>
            {isNet
              ? "Tarkista, että GraphQL-palvelin on käynnissä ja olet samassa verkossa."
              : loadError}
          </Text>
          <Pressable
            style={[styles.retryBtn, isDark && { backgroundColor: "#232427" }]}
            onPress={() => load()}
          >
            <PlatformSymbol
              ios="arrow.clockwise"
              android="refresh"
              size={18}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <Text style={[styles.retryBtnText, isDark && { color: "#51a2ff" }]}>
              Yritä uudelleen
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Dashboard
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.dashContent,
          isDark && { backgroundColor: "#18191B" },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#51a2ff" : "#3478F5"}
          />
        }
      >
        {/* Header */}
        <View style={styles.dashHeader}>
          <View>
            <Text style={[styles.dashGreeting, isDark && { color: "#fff" }]}>
              {timeOfDayGreeting()}, {data?.profile.firstName || "opiskelija"}!
              👋
            </Text>
            <Text style={[styles.dashDate, isDark && { color: "#aaa" }]}>
              {todayFinnish()}
            </Text>
            {/* {!!data?.profile.studentClass && (
              <Text style={[styles.dashClass, isDark && { color: "#888" }]}>
                Ryhmä {data.profile.studentClass}
              </Text>
            )} */}
          </View>
        </View>

        {/* Today's lessons (or, once the day is done, the next school day's) */}
        <SectionCard
          title={data?.scheduleDayLabel ?? "Tänään"}
          onMore={() =>
            router.push({
              pathname: "/wilma/schedule",
              params: data?.scheduleDayISO ? { day: data.scheduleDayISO } : {},
            })
          }
          isDark={isDark}
        >
          {!data?.lessons.length && !data?.lunch ? (
            <EmptyRow
              label={
                data?.scheduleDayLabel ? "Ei tunteja" : "Ei tunteja tänään"
              }
              isDark={isDark}
            />
          ) : (
            (() => {
              const rows = todayRows(data?.lessons ?? [], data?.lunch ?? null);
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
                  isShowingToday && row.start <= nowClock && nowClock < row.end;
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
                      {showDivider && <Divider isDark={isDark} />}
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
                              backgroundColor: isDark ? "#78350F55" : "#FEF3C7",
                            },
                            isCurrent && styles.timeTagCurrent,
                            isCurrent && isDark && styles.timeTagCurrentDark,
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
                      {showDivider && <Divider isDark={isDark} />}
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
                            isCurrent && isDark && styles.timeTagCurrentDark,
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
                    {showDivider && <Divider isDark={isDark} />}
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
                          style={[
                            styles.timeTagText,
                            { color: timeColor },
                          ]}
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
        <SectionCard title="Tulevat kokeet" isDark={isDark}>
          {!data?.exams.length ? (
            <EmptyRow label="Ei tulevia kokeita" isDark={isDark} />
          ) : (
            data.exams.map((exam, i) => {
              const { code, title } = lessonLabel(
                exam.course,
                exam.courseTitle,
              );
              return (
                <React.Fragment key={exam.examId}>
                  {i > 0 && <Divider isDark={isDark} />}
                  <View style={styles.examRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <LessonTitleRow
                        title={title}
                        code={code}
                        isDark={isDark}
                        numberOfLines={1}
                        titleStyle={[
                          styles.examCourse,
                          isDark && { color: "#fff" },
                        ]}
                      />
                      {exam.name ? (
                        <Text
                          style={[styles.examName, isDark && { color: "#aaa" }]}
                          numberOfLines={1}
                        >
                          {exam.name}
                        </Text>
                      ) : null}
                      {exam.teachers[0] && (
                        <Text
                          style={[styles.examMeta, isDark && { color: "#888" }]}
                          numberOfLines={1}
                        >
                          {exam.teachers[0].teacherName}
                        </Text>
                      )}
                    </View>
                    <View style={styles.examDateBox}>
                      <Text
                        style={[
                          styles.examDate,
                          isDark && { color: "#51a2ff" },
                        ]}
                      >
                        {formatDateFI(exam.date)}
                      </Text>
                      <Text
                        style={[
                          styles.examTime,
                          isDark && { color: "#51a2ff70" },
                        ]}
                      >
                        {formatTime(exam.timeStart)}
                      </Text>
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
          onMore={() => router.push("/wilma/messages")}
          isDark={isDark}
        >
          {!data?.messages.length ? (
            <EmptyRow label="Ei viestejä" isDark={isDark} />
          ) : (
            data.messages.map((msg, i) => (
              <React.Fragment key={msg.id}>
                {i > 0 && <Divider isDark={isDark} />}
                <Pressable
                  style={styles.msgRow}
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
                    <Text
                      style={[styles.msgSubject, isDark && { color: "#fff" }]}
                      numberOfLines={1}
                    >
                      {msg.subject}
                    </Text>
                    <Text
                      style={[styles.msgSender, isDark && { color: "#aaa" }]}
                      numberOfLines={1}
                    >
                      {msg.senders.map((s) => s.name).join(", ")}
                    </Text>
                  </View>
                  <View style={styles.msgRight}>
                    <Text style={[styles.msgDate, isDark && { color: "#888" }]}>
                      {new Date(
                        msg.timestamp.replace(" ", "T"),
                      ).toLocaleDateString("fi-FI", {
                        day: "numeric",
                        month: "numeric",
                      })}
                    </Text>
                    {msg.isEvent && (
                      <View style={styles.eventChip}>
                        <Text style={styles.eventChipText}>Tapahtuma</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </React.Fragment>
            ))
          )}
        </SectionCard>

        {/* Attendance */}
        <SectionCard title="Merkinnät (4 vko)" isDark={isDark}>
          {!data?.attendance.length ? (
            <EmptyRow label="Ei merkintöjä" isDark={isDark} />
          ) : (
            data.attendance.map((entry, i) => {
              const info = ATTENDANCE_COLORS[entry.typeCode] ?? {
                bg: "#aaa",
                label: entry.status,
              };
              return (
                <React.Fragment key={`${entry.date}-${i}`}>
                  {i > 0 && <Divider isDark={isDark} />}
                  <View style={styles.attRow}>
                    <Text style={[styles.attDate, isDark && { color: "#aaa" }]}>
                      {formatMarkDate(entry.date)}
                    </Text>
                    <Text
                      style={[styles.attCourse, isDark && { color: "#d4d4d4" }]}
                      numberOfLines={1}
                    >
                      {entry.course}
                    </Text>
                    <View
                      style={[
                        styles.attChip,
                        { backgroundColor: info.bg + "28" },
                      ]}
                    >
                      <Text style={[styles.attChipText, { color: info.bg }]}>
                        {info.label}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </SectionCard>

        <SectionCard title="Lisää Wilmasta" isDark={isDark}>
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/coursework" as never)}
          >
            <PlatformSymbol
              ios="doc.text"
              android="assignment"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <View style={styles.moreWilmaText}>
              <Text
                style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}
              >
                Kurssit ja tehtävät
              </Text>
              <Text
                style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}
              >
                Kotitehtävät, tuntipäiväkirja ja kurssikokeet
              </Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/course-selections" as never)}
          >
            <PlatformSymbol
              ios="rectangle.grid.1x2"
              android="view_week"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <View style={styles.moreWilmaText}>
              <Text
                style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}
              >
                Kurssivalinnat
              </Text>
              <Text
                style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}
              >
                Omat valinnat ja tarjottimet vain luku -tilassa
              </Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/rooms" as never)}
          >
            <PlatformSymbol
              ios="door.left.hand.open"
              android="meeting_room"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <View style={styles.moreWilmaText}>
              <Text
                style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}
              >
                Tilojen lukujärjestykset
              </Text>
              <Text
                style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}
              >
                Katso milloin luokkahuone on käytössä
              </Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/teachers" as never)}
          >
            <PlatformSymbol
              ios="person.2"
              android="group"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <View style={styles.moreWilmaText}>
              <Text
                style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}
              >
                Opettajat ja henkilökunta
              </Text>
              <Text
                style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}
              >
                Opettajien lukujärjestykset ja viestit
              </Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/news" as never)}
          >
            <PlatformSymbol
              ios="megaphone"
              android="campaign"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <View style={styles.moreWilmaText}>
              <Text
                style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}
              >
                Tiedotteet
              </Text>
              <Text
                style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}
              >
                Koulun ajankohtaiset tiedotteet
              </Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/grades" as never)}
          >
            <PlatformSymbol
              ios="checkmark.seal"
              android="fact_check"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
            <View style={styles.moreWilmaText}>
              <Text
                style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}
              >
                Arvosanat
              </Text>
              <Text
                style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}
              >
                Kurssisuoritukset, kokeet ja yo-tulokset
              </Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────



const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  loadingLabel: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  errorHeading: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginTop: 4,
  },
  errorBody: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#3478F5",
  },
  moreWilmaRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  moreWilmaText: { flex: 1 },
  moreWilmaTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  moreWilmaSubtitle: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  dashContent: { padding: 16, paddingBottom: 100 },
  dashHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  dashGreeting: {
    fontFamily: "Figtree-Bold",
    fontSize: 28,
    color: "#222",
    letterSpacing: -0.4,
  },
  dashDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#888",
    marginTop: 2,
    textTransform: "capitalize",
  },
  dashClass: {
    fontFamily: "Figtree-Medium",
    fontSize: 13,
    color: "#777",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
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
  cardTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
    color: "#222",
  },
  badge: {
    backgroundColor: "#3478F5",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Figtree-Bold" },
  moreLink: {
    fontFamily: "Figtree-Medium",
    fontSize: 13,
    color: "#3478F5",
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 10,
  },
  emptyText: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 8,
  },
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
  },
  freeSlotRowDark: { borderColor: "#4A5058" },
  freeSlotSpaceAbove: { marginVertical: 8 },
  freeSlotTimeTag: { backgroundColor: "#F3F4F6" },
  freeSlotTimeTagDark: { backgroundColor: "#3A3F46" },
  freeSlotTitle: {
    fontFamily: "Figtree-SemiBold",
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
    fontFamily: "Figtree-SemiBold",
    fontSize: 13,
    color: "#3478F5",
  },
  timeTagSub: {
    fontFamily: "Figtree-Regular",
    fontSize: 11,
    color: "#3478F580",
    marginTop: 1,
  },
  lessonInfo: { flex: 1 },
  lessonSubject: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  lessonMeta: {
    fontFamily: "Figtree-Regular",
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
    fontFamily: "Figtree-SemiBold",
    fontSize: 12,
    color: "#B45309",
  },
  lunchChipTextDark: { color: "#FBBF24" },
  examRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  examCourse: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  examName: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  examMeta: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#aaa",
    marginTop: 2,
  },
  examDateBox: { alignItems: "flex-end" },
  examDate: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 14,
    color: "#3478F5",
  },
  examTime: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#3478F580",
    marginTop: 2,
  },
  msgRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  msgInfo: { flex: 1 },
  msgSubject: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  msgSender: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  msgRight: { alignItems: "flex-end" },
  msgDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#aaa",
  },
  eventChip: {
    backgroundColor: "#51A2FF1F",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  eventChipText: {
    fontFamily: "Figtree-Medium",
    fontSize: 10,
    color: "#3478F5",
  },
  attRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    width: 52,
  },
  attCourse: {
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  attChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  attChipText: { fontFamily: "Figtree-Medium", fontSize: 11 },
});
