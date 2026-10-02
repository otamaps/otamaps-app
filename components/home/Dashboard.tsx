import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import { LunchPill } from "@/components/schedule/LunchPill";
import { timeTagColors } from "@/components/schedule/status";
import {
  AppText,
  Row,
  RowIcon,
  Screen,
  StateView,
  Surface,
  useTheme,
} from "@/components/ui";
import { colors, radii } from "@/constants/theme";
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
import {
  attendanceType,
  formatMarkDate,
  markWithinDays,
  sortMarks,
} from "@/lib/wilma/attendance";
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

function finnishToISO(d: string): string {
  const [day, month, year] = d.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * The rest of Wilma, each in one of iOS's system colours so the tiles tell
 * the rows apart at a glance, as Settings' do.
 */
const MORE_WILMA: {
  path: string;
  title: string;
  subtitle: string;
  ios: React.ComponentProps<typeof RowIcon>["ios"];
  android: React.ComponentProps<typeof RowIcon>["android"];
  color: string;
}[] = [
  {
    path: "/wilma/coursework",
    title: "Kurssit ja tehtävät",
    subtitle: "Kotitehtävät, tuntipäiväkirja ja kurssikokeet",
    ios: "doc.text.fill",
    android: "assignment",
    color: "#007AFF",
  },
  {
    path: "/wilma/course-selections",
    title: "Kurssivalinnat",
    subtitle: "Omat valinnat ja tarjottimet vain luku -tilassa",
    ios: "rectangle.grid.1x2.fill",
    android: "view_week",
    color: "#5856D6",
  },
  {
    path: "/wilma/rooms",
    title: "Tilojen lukujärjestykset",
    subtitle: "Katso milloin luokkahuone on käytössä",
    ios: "door.left.hand.open",
    android: "meeting_room",
    color: "#FF9500",
  },
  {
    path: "/wilma/teachers",
    title: "Opettajat ja henkilökunta",
    subtitle: "Opettajien lukujärjestykset ja viestit",
    ios: "person.2.fill",
    android: "group",
    color: "#34C759",
  },
  {
    path: "/wilma/news",
    title: "Tiedotteet",
    subtitle: "Koulun ajankohtaiset tiedotteet",
    ios: "megaphone.fill",
    android: "campaign",
    color: "#FF3B30",
  },
  {
    path: "/wilma/grades",
    title: "Arvosanat",
    subtitle: "Kurssisuoritukset, kokeet ja yo-tulokset",
    ios: "checkmark.seal.fill",
    android: "fact_check",
    color: "#AF52DE",
  },
];

// ── Shared sub-components ──────────────────────────────────────────────────────

/**
 * One section of the dashboard, set as the Me tab sets its groups: the
 * heading above the card in small capitals, and the card itself the same
 * radius and inset. Where the section has more behind it, "Kaikki" sits at
 * the heading's far end, as iOS puts "See All".
 */
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
   * Makes the whole card open `onMore`, not just its heading. Rows inside
   * that have their own action keep it — a nested Pressable claims the touch
   * first — so only use this where rows are mostly display.
   */
  wholeCardPress?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const cardPress = wholeCardPress && onMore ? onMore : undefined;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {/* The heading opens the same screen as "Kaikki" — a heading is a
            bigger target than the link, and people reach for it first. */}
        <Pressable
          onPress={onMore}
          disabled={!onMore}
          hitSlop={8}
          accessibilityRole={onMore ? "button" : "header"}
          accessibilityLabel={onMore ? `${title} – avaa kaikki` : title}
          style={({ pressed }) => [
            styles.sectionTitleGroup,
            pressed && onMore ? styles.pressed : null,
          ]}
        >
          <AppText variant="micro" color="textMuted">
            {title.toLocaleUpperCase("fi-FI")}
          </AppText>
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
          <Pressable
            onPress={onMore}
            hitSlop={8}
            style={({ pressed }) => [pressed ? styles.pressed : null]}
          >
            <AppText variant="meta" color="accent" style={styles.moreLink}>
              Kaikki
            </AppText>
          </Pressable>
        ) : null}
      </View>
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
        {children}
      </Pressable>
    </View>
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

        // The card shows the last seven days; the full list has its own
        // page. A week can never straddle more than the turn of one year, and
        // `formatMarkDate` prints the year for the few marks that do.
        const sortedAtt = sortMarks(
          att.filter((a) => markWithinDays(a.date, 7)),
        );

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
                    // Green while on, grey once over, the accent otherwise —
                    // the same tag colours every timetable in the app uses.
                    const tag = timeTagColors(theme, {
                      isCurrent,
                      isOver: isPast,
                    });
                    const timeColor = tag.start;
                    const timeSubColor = tag.end;

                    if (row.kind === "lunch") {
                      const lunchOnlyTimeColor = isCurrent
                        ? timeColor
                        : isDark
                          ? "#FFD60A"
                          : "#8A6100";
                      const lunchOnlyTimeSubColor = isCurrent
                        ? timeSubColor
                        : isDark
                          ? "#FFD60A80"
                          : "#8A610080";
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
                                  // systemYellow, as the lunch pill is.
                                  backgroundColor: isDark
                                    ? "rgba(255,214,10,0.2)"
                                    : "rgba(255,204,0,0.22)",
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
                                <LunchPill
                                  start={row.lunch.start}
                                  end={row.lunch.end}
                                  isDark={isDark}
                                />
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
                              { backgroundColor: tag.fill },
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
                              <LunchPill
                                start={row.lunch.start}
                                end={row.lunch.end}
                                isDark={isDark}
                              />
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
            {/* The last week only; everything Wilma returns is a tap away. */}
            <SectionCard
              title="Merkinnät"
              wholeCardPress
              onMore={() => router.push("/wilma/attendance" as never)}
            >
              {!data?.attendance.length ? (
                <EmptyRow label="Ei merkintöjä viimeisen viikon aikana" />
              ) : (
                data.attendance.map((entry, i) => {
                  const info = attendanceType(entry);
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
                            { backgroundColor: info.color + "28" },
                          ]}
                        >
                          <AppText variant="micro" style={{ color: info.color }}>
                            {info.label}
                          </AppText>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })
              )}
            </SectionCard>

            {/* Built exactly as the Me tab's menus are: a Surface of Rows,
                each led by a filled glyph tile in its own system colour. */}
            <Surface title="Lisää Wilmasta" style={styles.menu}>
              {MORE_WILMA.map((item) => (
                <Row key={item.path} onPress={() => router.push(item.path as never)}>
                  <RowIcon ios={item.ios} android={item.android} color={item.color} />
                  <View style={styles.moreWilmaText}>
                    <AppText variant="body">{item.title}</AppText>
                    <AppText
                      variant="caption"
                      color="textMuted"
                      style={styles.moreWilmaSubtitle}
                    >
                      {item.subtitle}
                    </AppText>
                  </View>
                </Row>
              ))}
            </Surface>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  moreWilmaText: { flex: 1 },
  moreWilmaSubtitle: { marginTop: 2 },
  // Surface brings its own 24pt top margin and side inset, as on the Me tab.
  menu: { borderRadius: radii.xl },
  dashHeader: { marginBottom: 2, marginTop: 4, marginHorizontal: 20 },
  dashGreeting: { letterSpacing: -0.4 },
  // No side padding: each section insets itself, as the Me tab's groups do.
  dashContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 100,
  },
  // AppText supplies the face and the colour; only the placement and the
  // capitalisation are this screen's own.
  dashDate: { marginTop: 2, textTransform: "capitalize" },
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 4,
    marginBottom: 6,
  },
  sectionTitleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  card: {
    borderRadius: radii.xl,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardPressed: { opacity: 0.85 },
  pressed: { opacity: 0.6 },
  spacer: { flex: 1 },
  badge: {
    borderRadius: 9,
    minWidth: 18,
    height: 18,
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
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  attRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attDate: { width: 52 },
  attCourse: { ...fonts.medium, flex: 1 },
  attChip: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
});
