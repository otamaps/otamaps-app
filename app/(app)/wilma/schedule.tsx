import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import { Exam, fetchSchedule, ScheduleData, ScheduleLesson } from "@/lib/wilma/graphqlClient";
import { lessonLabel } from "@/lib/wilma/lessonLabels";
import {
  formatLocalISO,
  getISOWeekNumber,
  getMondayOfWeek,
  getSchoolWeekDays,
  parseLocalISO,
  shortDateLabel,
  weekdayLabel,
  weekMonthLabel,
} from "@/lib/wilma/scheduleDates";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatTime(t: string) {
  return t.slice(0, 5);
}

function finnishToISO(d: string): string {
  const [day, month, year] = d.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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
  forceRefresh = false
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
    schedule: [...a.schedule, ...b.schedule.filter((l) => !seenL.has(l.reservationId))],
    exams: [...a.exams, ...b.exams.filter((e) => !seenE.has(e.examId))],
  };
}

// ── Lesson card ───────────────────────────────────────────────────────────────

function LessonCard({
  lesson,
  isDark,
  isFirst,
  isLast,
}: {
  lesson: ScheduleLesson;
  isDark: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const group = lesson.groups[0];
  const { code, title } = lessonLabel(
    group?.shortCaption,
    group?.fullCaption,
    lesson.class
  );
  const room = group?.rooms[0]?.longCaption ?? "";
  const teacher = group?.teachers[0]?.longCaption ?? "";
  const meta = [room, teacher].filter(Boolean).join(" · ");

  return (
    <>
      <View
        style={[
          styles.lessonCard,
          isDark && { backgroundColor: "#232427" },
          isFirst && styles.cardTop,
          isLast && styles.cardBottom,
        ]}
      >
        <View style={[styles.timeTag, isDark && { backgroundColor: "#51A2FF1F" }]}>
          <Text style={[styles.timeTagStart, isDark && { color: "#51a2ff" }]}>
            {formatTime(lesson.start)}
          </Text>
          <Text style={[styles.timeTagEnd, isDark && { color: "#51a2ff70" }]}>
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
        </View>
      </View>
      {!isLast && (
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

  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loadedOffset, setLoadedOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const dayOffsets = useRef<Record<string, number>>({});
  const pendingScrollDay = useRef<string | null>(null);
  // Jumping the week forward is a one-time convenience on open. Once it has
  // settled — or the user has picked a week themselves — it must never move
  // the week out from under them again.
  const autoAdvance = useRef({ settled: false, weeksTried: 0 });

  // Derived values (pure, recalculated each render)
  const monday = getMondayOfWeek(weekOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const weekDays = getSchoolWeekDays(monday);
  const weekNum = getISOWeekNumber(monday);

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
    [weekOffset]
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

  const examsByDay = useMemo(() => {
    const byDay: Record<string, Exam[]> = {};
    for (const exam of data?.exams ?? []) {
      (byDay[finnishToISO(exam.date)] ??= []).push(exam);
    }
    return byDay;
  }, [data]);

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
    [scrollToDay]
  );

  // Open on the first day from today onwards that actually has something. When
  // the rest of the week is empty, step forward a week and look again.
  useEffect(() => {
    if (autoAdvance.current.settled) return;
    if (loading || error || !data || loadedOffset !== weekOffset) return;

    const target = weekDays.find(
      (day) =>
        day >= today &&
        ((lessonsByDay[day]?.length ?? 0) > 0 || (examsByDay[day]?.length ?? 0) > 0)
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
    lessonsByDay,
    loadedOffset,
    loading,
    scrollToDay,
    today,
    weekDays,
    weekOffset,
  ]);

  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      edges={["top"]}
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
        <Pressable onPress={() => goToWeek(-1)} style={styles.navBtn} hitSlop={12}>
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
        <Pressable onPress={() => goToWeek(1)} style={styles.navBtn} hitSlop={12}>
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
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons
            name="error-outline"
            size={48}
            color={isDark ? "#888" : "#ccc"}
          />
          <Text style={[styles.errorText, isDark && { color: "#888" }]}>{error}</Text>
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
            const lessons = lessonsByDay[day] ?? [];
            const exams = examsByDay[day] ?? [];
            const heading = dayHeading(day);
            const isToday = day === today;

            return (
              <View
                key={day}
                style={styles.daySection}
                onLayout={(event) =>
                  handleDayLayout(day, event.nativeEvent.layout.y)
                }
              >
                <View style={styles.dayHeader}>
                  <Text
                    style={[
                      styles.dayName,
                      isDark && { color: "#fff" },
                      isToday && { color: isDark ? "#51a2ff" : "#4A89EE" },
                    ]}
                  >
                    {heading.name}
                  </Text>
                  <Text style={[styles.dayDate, isDark && { color: "#888" }]}>
                    {heading.date}
                  </Text>
                  {isToday && (
                    <View
                      style={[
                        styles.todayPill,
                        isDark && { backgroundColor: "#51A2FF1F" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.todayPillText,
                          isDark && { color: "#51a2ff" },
                        ]}
                      >
                        Tänään
                      </Text>
                    </View>
                  )}
                </View>

                {exams.map((exam) => (
                  <ExamRow key={exam.examId} exam={exam} isDark={isDark} />
                ))}

                {lessons.length > 0 ? (
                  <View>
                    {lessons.map((lesson, i) => (
                      <LessonCard
                        key={`${lesson.reservationId}-${i}`}
                        lesson={lesson}
                        isDark={isDark}
                        isFirst={i === 0}
                        isLast={i === lessons.length - 1}
                      />
                    ))}
                  </View>
                ) : exams.length === 0 ? (
                  <View style={[styles.emptyDay, isDark && styles.emptyDayDark]}>
                    <Text
                      style={[styles.emptyDayText, isDark && { color: "#666" }]}
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
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
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
  lessonDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
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
