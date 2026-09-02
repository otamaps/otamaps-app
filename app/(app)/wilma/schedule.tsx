import { PlatformSymbol } from "@/components/PlatformSymbol";
import LessonTitleRow from "@/components/schedule/LessonTitleRow";
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
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** How far ahead the view may jump on open before giving up on finding lessons. */
const MAX_AUTO_ADVANCE_WEEKS = 4;

/** Never highlight the next school day instead of today earlier than this. */
const NEXT_DAY_SWITCH_EARLIEST = "12:00";

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

function LunchChip({
  lunch,
  isDark,
}: {
  lunch: { start: string; end: string };
  isDark: boolean;
}) {
  return (
    <View style={[styles.lunchChip, isDark && styles.lunchChipDark]}>
      <PlatformSymbol
        ios="fork.knife"
        android="restaurant"
        size={11}
        tintColor={isDark ? "#FBBF24" : "#B45309"}
      />
      <Text style={[styles.lunchChipText, isDark && styles.lunchChipTextDark]}>
        Lounas {lunch.start}–{lunch.end}
      </Text>
    </View>
  );
}

function LessonCard({
  lesson,
  isDark,
  isFirst,
  isLast,
  showDivider,
  lunch,
  isPast,
  isCurrent,
}: {
  lesson: ScheduleLesson;
  isDark: boolean;
  isFirst: boolean;
  isLast: boolean;
  showDivider: boolean;
  lunch: { start: string; end: string } | null;
  isPast: boolean;
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
  const timeColor = isCurrent
    ? isDark
      ? "#4ADE80"
      : "#16A34A"
    : isDark
      ? "#51a2ff"
      : undefined;
  const timeSubColor = isCurrent
    ? isDark
      ? "#4ADE8080"
      : "#16A34A80"
    : isDark
      ? "#51a2ff70"
      : undefined;

  return (
    <>
      <View
        style={[
          styles.lessonCard,
          isDark && { backgroundColor: "#232427" },
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
            isDark && { backgroundColor: "#51A2FF1F" },
            isCurrent && styles.timeTagCurrent,
            isCurrent && isDark && styles.timeTagCurrentDark,
          ]}
        >
          <Text
            style={[styles.timeTagStart, !!timeColor && { color: timeColor }]}
          >
            {formatTime(lesson.start)}
          </Text>
          <Text
            style={[
              styles.timeTagEnd,
              !!timeSubColor && { color: timeSubColor },
            ]}
          >
            {formatTime(lesson.end)}
          </Text>
        </View>
        <View style={styles.lessonInfo}>
          <LessonTitleRow
            title={title}
            code={code}
            isDark={isDark}
            numberOfLines={2}
            titleStyle={[styles.lessonSubject, isDark && { color: "#fff" }]}
          />
          {!!meta && (
            <Text
              style={[styles.lessonMeta, isDark && { color: "#aaa" }]}
              numberOfLines={1}
            >
              {meta}
            </Text>
          )}
          {!!lunch && <LunchChip lunch={lunch} isDark={isDark} />}
        </View>
      </View>
      {showDivider && (
        <View
          style={[styles.lessonDivider, isDark && { backgroundColor: "#333" }]}
        />
      )}
    </>
  );
}

// ── Free slot ("Hyppytunti") ─────────────────────────────────────────────────

function FreeSlotCard({
  start,
  end,
  lunch,
  isDark,
  isFirst,
  isLast,
  showDivider,
  isPast,
  isCurrent,
}: {
  start: string;
  end: string;
  lunch: { start: string; end: string } | null;
  isDark: boolean;
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
  const timeColor = isCurrent ? (isDark ? "#4ADE80" : "#16A34A") : undefined;
  const timeSubColor = isCurrent
    ? isDark
      ? "#4ADE8080"
      : "#16A34A80"
    : undefined;

  return (
    <>
      <View
        style={[
          styles.lessonCard,
          styles.freeSlotCard,
          isDark && styles.freeSlotCardDark,
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
            isDark && styles.freeSlotTimeTagDark,
            isCurrent && styles.timeTagCurrent,
            isCurrent && isDark && styles.timeTagCurrentDark,
          ]}
        >
          <Text
            style={[
              styles.timeTagStart,
              styles.freeSlotTimeText,
              isDark && styles.freeSlotTimeTextDark,
              !!timeColor && { color: timeColor },
            ]}
          >
            {start}
          </Text>
          <Text
            style={[
              styles.timeTagEnd,
              styles.freeSlotTimeText,
              isDark && styles.freeSlotTimeTextDark,
              !!timeSubColor && { color: timeSubColor },
            ]}
          >
            {displayEnd}
          </Text>
        </View>
        <View style={styles.lessonInfo}>
          <Text
            style={
              isCurrent
                ? [styles.lessonSubject, isDark && { color: "#fff" }]
                : [styles.freeSlotTitle, isDark && styles.freeSlotTitleDark]
            }
          >
            Hyppytunti
          </Text>
          {!!lunch && <LunchChip lunch={lunch} isDark={isDark} />}
        </View>
      </View>
      {showDivider && (
        <View
          style={[styles.lessonDivider, isDark && { backgroundColor: "#333" }]}
        />
      )}
    </>
  );
}

// ── Standalone lunch (falls outside every lesson and free slot) ────────────

function LunchOnlyCard({
  start,
  end,
  isDark,
  isFirst,
  isLast,
  showDivider,
  isPast,
}: {
  start: string;
  end: string;
  isDark: boolean;
  isFirst: boolean;
  isLast: boolean;
  showDivider: boolean;
  isPast: boolean;
}) {
  return (
    <>
      <View
        style={[
          styles.lessonCard,
          isDark && { backgroundColor: "#232427" },
          isFirst && styles.cardTop,
          isLast && styles.cardBottom,
          isPast && styles.pastOpacity,
        ]}
      >
        <View
          style={[
            styles.timeTag,
            styles.lunchOnlyTimeTag,
            isDark && styles.lunchOnlyTimeTagDark,
          ]}
        >
          <Text
            style={[
              styles.timeTagStart,
              styles.lunchOnlyTimeText,
              isDark && styles.lunchOnlyTimeTextDark,
            ]}
          >
            {start}
          </Text>
          <Text
            style={[
              styles.timeTagEnd,
              styles.lunchOnlyTimeTextSub,
              isDark && styles.lunchOnlyTimeTextSubDark,
            ]}
          >
            {end}
          </Text>
        </View>
        <View style={styles.lessonInfo}>
          <Text style={[styles.lessonSubject, isDark && { color: "#fff" }]}>
            Lounas
          </Text>
        </View>
      </View>
      {showDivider && (
        <View
          style={[styles.lessonDivider, isDark && { backgroundColor: "#333" }]}
        />
      )}
    </>
  );
}

// ── Exam row ──────────────────────────────────────────────────────────────────

function ExamRow({ exam, isDark }: { exam: Exam; isDark: boolean }) {
  const { code, title } = lessonLabel(exam.course, exam.courseTitle);
  return (
    <View
      style={[
        styles.examCard,
        isDark && { backgroundColor: "#232427", borderColor: "#ff9800" },
      ]}
    >
      <MaterialIcons
        name="assignment"
        size={16}
        color="#ff9800"
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <LessonTitleRow
          title={`${title}${exam.name ? ` – ${exam.name}` : ""}`}
          code={code}
          isDark={isDark}
          numberOfLines={2}
          titleStyle={[styles.examTitle, isDark && { color: "#fff" }]}
        />
        <Text style={[styles.examTime, isDark && { color: "#aaa" }]}>
          {formatTime(exam.timeStart)} – {formatTime(exam.timeEnd)}
          {exam.teachers[0] ? `  ·  ${exam.teachers[0].teacherName}` : ""}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
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

  return (
    // The safe-area inset above the header is otherwise painted with the
    // screen's body background, so the status bar sits on a visibly
    // different color than the nav bar right below it. Painting the inset
    // with the header's own background keeps the two matched.
    <SafeAreaView
      style={[styles.statusBarArea, isDark && styles.statusBarAreaDark]}
      edges={["top"]}
    >
      <View
        style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      >
        <Stack.Screen options={{ headerShown: false }} />

        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            isDark && { backgroundColor: "#18191B", borderBottomColor: "#333" },
          ]}
        >
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </Pressable>
          <Text style={[styles.headerTitle, isDark && { color: "#fff" }]}>
            Lukujärjestys
          </Text>
          <View style={{ flex: 1 }} />
        </View>

        {/* ── Week navigation ── */}
        <View
          style={[
            styles.weekNav,
            isDark && { backgroundColor: "#232427", borderBottomColor: "#333" },
          ]}
        >
          <Pressable
            onPress={() => goToWeek(-1)}
            style={styles.navBtn}
            hitSlop={12}
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.weekLabel, isDark && { color: "#fff" }]}>
              Viikko {weekNum}
            </Text>
            <Text style={[styles.weekSub, isDark && { color: "#888" }]}>
              {weekMonthLabel(monday, friday)}
            </Text>
          </View>
          <Pressable
            onPress={() => goToWeek(1)}
            style={styles.navBtn}
            hitSlop={12}
          >
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </Pressable>
        </View>

        {/* ── Body ── */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator
              size="large"
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <MaterialIcons
              name="error-outline"
              size={48}
              color={isDark ? "#888" : "#ccc"}
            />
            <Text style={[styles.errorText, isDark && { color: "#888" }]}>
              {error}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={[styles.body, isDark && { backgroundColor: "#18191B" }]}
            contentContainerStyle={styles.bodyContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDark ? "#51a2ff" : "#4A89EE"}
              />
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
                    <Text
                      style={[
                        styles.dayName,
                        isDark && { color: "#fff" },
                        isHighlighted && {
                          color: isDark ? "#51a2ff" : "#3d7de3",
                        },
                      ]}
                    >
                      {heading.name}
                    </Text>
                    <Text style={[styles.dayDate, isDark && { color: "#888" }]}>
                      {heading.date}
                    </Text>
                    <View style={{ flex: 1 }} />
                    {isHighlighted && (
                      <View
                        style={[
                          styles.todayPill,
                          isDark && {
                            backgroundColor: "#51A2FF1F",
                            borderColor: "#51a2ff49",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.todayPillText,
                            isDark && { color: "#51a2ff" },
                          ]}
                        >
                          {isToday ? "Tänään" : "Huomenna"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {exams.map((exam) => (
                    <ExamRow key={exam.examId} exam={exam} isDark={isDark} />
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
                        const isCurrent =
                          isToday &&
                          slot.start <= nowClock &&
                          nowClock < slot.end;

                        if (slot.kind === "lesson") {
                          return (
                            <LessonCard
                              key={`lesson-${slot.lesson.reservationId}`}
                              lesson={slot.lesson}
                              isDark={isDark}
                              isFirst={isFirst}
                              isLast={isLast}
                              showDivider={showDivider}
                              lunch={slot.lunch}
                              isPast={isPast}
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
                              isDark={isDark}
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
                            isDark={isDark}
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
                      style={[styles.emptyDay, isDark && styles.emptyDayDark]}
                    >
                      <Text
                        style={[
                          styles.emptyDayText,
                          isDark && { color: "#666" },
                        ]}
                      >
                        Ei tunteja
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  statusBarArea: { flex: 1, backgroundColor: "#fff" },
  statusBarAreaDark: { backgroundColor: "#18191B" },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  pastOpacity: { opacity: 0.5 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    gap: 12,
  },
  headerTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
    color: "#222",
  },

  // Week navigation
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  navBtn: { padding: 4 },
  weekLabel: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    color: "#222",
  },
  weekSub: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
    marginTop: 1,
    textTransform: "capitalize",
  },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  // Day sections
  daySection: { marginBottom: 22 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginLeft: 2,
  },
  dayName: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    color: "#222",
  },
  dayDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#999",
  },
  todayPill: {
    backgroundColor: "#EEF4FF",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#cddcf3",
  },
  todayPillText: {
    fontFamily: "Figtree-Medium",
    fontSize: 11,
    color: "#4A89EE",
  },
  emptyDay: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    backgroundColor: "#ffffff80",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyDayDark: { borderColor: "#333", backgroundColor: "#23242780" },
  emptyDayText: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#aaa",
  },

  // Lesson cards (grouped, rounded first/last)
  lessonCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTop: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  cardBottom: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  lessonCardWithLunch: { alignItems: "flex-start", paddingVertical: 15 },
  lessonDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
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

  // Free slot ("Hyppytunti")
  freeSlotCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderStyle: "dashed",
    borderColor: "#e0e0e0",
  },
  freeSlotCardDark: { backgroundColor: "#232427", borderColor: "#4A5058" },
  freeSlotTimeTag: { backgroundColor: "#F3F4F6" },
  freeSlotTimeTagDark: { backgroundColor: "#2E3034" },
  freeSlotTimeText: { color: "#8A929D" },
  freeSlotTimeTextDark: { color: "#9CA3AF" },
  freeSlotTitle: {
    fontFamily: "Figtree-SemiBold",
    fontStyle: "italic",
    fontSize: 15,
    color: "#8A929D",
  },
  freeSlotTitleDark: { color: "#9CA3AF" },

  // Standalone lunch (falls outside every lesson and free slot)
  lunchOnlyTimeTag: { backgroundColor: "#FEF3C7" },
  lunchOnlyTimeTagDark: { backgroundColor: "#78350F55" },
  lunchOnlyTimeText: { color: "#B45309" },
  lunchOnlyTimeTextDark: { color: "#FBBF24" },
  lunchOnlyTimeTextSub: { color: "#B4530980" },
  lunchOnlyTimeTextSubDark: { color: "#FBBF2480" },
  timeTag: {
    backgroundColor: "#EEF4FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  timeTagStart: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 13,
    color: "#4A89EE",
  },
  timeTagEnd: {
    fontFamily: "Figtree-Regular",
    fontSize: 11,
    color: "#4A89EE70",
    marginTop: 1,
  },
  timeTagCurrent: { backgroundColor: "#16A34A1A" },
  timeTagCurrentDark: { backgroundColor: "#4ADE8022" },
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

  // Exam card
  examCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#fff8f0",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderColor: "#ff9800",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  examTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 14,
    color: "#222",
  },
  examTime: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },

  // Error
  errorText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
  },
});
