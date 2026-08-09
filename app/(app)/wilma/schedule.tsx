import { Exam, fetchSchedule, ScheduleData, ScheduleLesson } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

function isoToFinnishShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d)}.${parseInt(m)}.`;
}

function finnishToISO(d: string): string {
  const [day, month, year] = d.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** ISO week number (1–53). */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Monday of (today + weekOffset weeks) at midnight. */
function getMondayOfWeek(weekOffset: number): Date {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + toMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** ISO strings for Mon … Sun of a week. */
function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const WEEKDAY_SHORT = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];
function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[new Date(iso + "T00:00:00").getDay()];
}
function dayNum(iso: string): string {
  return String(parseInt(iso.split("-")[2], 10));
}

function weekMonthLabel(monday: Date, sunday: Date): string {
  const sy = monday.getFullYear() === sunday.getFullYear();
  const sm = sy && monday.getMonth() === sunday.getMonth();
  if (sm) return monday.toLocaleDateString("fi-FI", { month: "long", year: "numeric" });
  if (sy) {
    const a = monday.toLocaleDateString("fi-FI", { month: "short" });
    const b = sunday.toLocaleDateString("fi-FI", { month: "long", year: "numeric" });
    return `${a} – ${b}`;
  }
  const a = monday.toLocaleDateString("fi-FI", { month: "short", year: "numeric" });
  const b = sunday.toLocaleDateString("fi-FI", { month: "short", year: "numeric" });
  return `${a} – ${b}`;
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
  const subject = group?.fullCaption ?? lesson.class;
  const room = group?.rooms[0]?.longCaption ?? "";
  const teacher = group?.teachers[0]?.longCaption ?? "";
  const meta = [room, teacher].filter(Boolean).join(" · ");

  return (
    <>
      <View
        style={[
          styles.lessonCard,
          isDark && { backgroundColor: "#2a2a2a" },
          isFirst && styles.cardTop,
          isLast && styles.cardBottom,
        ]}
      >
        <View style={[styles.timeTag, isDark && { backgroundColor: "#4A89EE18" }]}>
          <Text style={[styles.timeTagStart, isDark && { color: "#51a2ff" }]}>
            {formatTime(lesson.start)}
          </Text>
          <Text style={[styles.timeTagEnd, isDark && { color: "#51a2ff70" }]}>
            {formatTime(lesson.end)}
          </Text>
        </View>
        <View style={styles.lessonInfo}>
          <Text
            style={[styles.lessonSubject, isDark && { color: "#fff" }]}
            numberOfLines={2}
          >
            {subject}
          </Text>
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
  return (
    <View
      style={[
        styles.examCard,
        isDark && { backgroundColor: "#2a2a2a", borderColor: "#ff9800" },
      ]}
    >
      <MaterialIcons
        name="assignment"
        size={16}
        color="#ff9800"
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.examTitle, isDark && { color: "#fff" }]}
          numberOfLines={2}
        >
          {exam.courseTitle || exam.course}
          {exam.name ? ` – ${exam.name}` : ""}
        </Text>
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
  const today = todayISO();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(today);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived values (pure, recalculated each render)
  const monday = getMondayOfWeek(weekOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekDays = getWeekDays(monday);
  const weekNum = getISOWeekNumber(monday);

  const load = useCallback(
    async (isRefresh = false) => {
      const mon = getMondayOfWeek(weekOffset);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const monYear = mon.getFullYear();
      const monMonth = mon.getMonth() + 1;
      const sunYear = sun.getFullYear();
      const sunMonth = sun.getMonth() + 1;
      const sameMonth = monYear === sunYear && monMonth === sunMonth;

      if (isRefresh) {
        invalidateMonth(monYear, monMonth);
        if (!sameMonth) invalidateMonth(sunYear, sunMonth);
      }

      setLoading(true);
      setError(null);

      try {
        let combined: ScheduleData;
        if (sameMonth) {
          combined = await fetchMonthCached(monYear, monMonth, isRefresh);
        } else {
          const [a, b] = await Promise.all([
            fetchMonthCached(monYear, monMonth, isRefresh),
            fetchMonthCached(sunYear, sunMonth, isRefresh),
          ]);
          combined = mergeScheduleData(a, b);
        }
        setData(combined);
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

  const prevWeek = () => {
    const newOffset = weekOffset - 1;
    const newDays = getWeekDays(getMondayOfWeek(newOffset));
    const idx = Math.max(0, weekDays.indexOf(selectedDay));
    setWeekOffset(newOffset);
    setSelectedDay(newDays[idx]);
  };

  const nextWeek = () => {
    const newOffset = weekOffset + 1;
    const newDays = getWeekDays(getMondayOfWeek(newOffset));
    const idx = Math.max(0, weekDays.indexOf(selectedDay));
    setWeekOffset(newOffset);
    setSelectedDay(newDays[idx]);
  };

  // Lessons / exams for selected day
  const dayLessons = (data?.schedule ?? [])
    .filter((l) => l.dateArray.includes(selectedDay))
    .sort((a, b) => a.start.localeCompare(b.start));

  const dayExams = (data?.exams ?? []).filter(
    (e) => finnishToISO(e.date) === selectedDay
  );

  const examDays = new Set((data?.exams ?? []).map((e) => finnishToISO(e.date)));

  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          isDark && { backgroundColor: "#1e1e1e", borderBottomColor: "#333" },
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
          isDark && { backgroundColor: "#252525", borderBottomColor: "#333" },
        ]}
      >
        <Pressable onPress={prevWeek} style={styles.navBtn} hitSlop={12}>
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
            {weekMonthLabel(monday, sunday)}
          </Text>
        </View>
        <Pressable onPress={nextWeek} style={styles.navBtn} hitSlop={12}>
          <MaterialIcons
            name="chevron-right"
            size={28}
            color={isDark ? "#51a2ff" : "#4A89EE"}
          />
        </Pressable>
      </View>

      {/* ── Day tabs ── */}
      <View
        style={[
          styles.dayTabsRow,
          isDark && { backgroundColor: "#1e1e1e", borderBottomColor: "#2e2e2e" },
        ]}
      >
        {weekDays.map((day) => {
          const isToday = day === today;
          const isSel = day === selectedDay;
          const hasExam = examDays.has(day);
          return (
            <Pressable
              key={day}
              style={[
                styles.dayTab,
                isSel && styles.dayTabSelected,
                isSel && isDark && { backgroundColor: "#4A89EE" },
              ]}
              onPress={() => setSelectedDay(day)}
            >
              <Text
                style={[
                  styles.dayTabWd,
                  !isSel && !isToday && isDark && { color: "#888" },
                  isToday && !isSel && { color: isDark ? "#51a2ff" : "#4A89EE" },
                  isSel && { color: "#fff" },
                ]}
              >
                {weekdayShort(day)}
              </Text>
              <Text
                style={[
                  styles.dayTabNum,
                  !isSel && !isToday && isDark && { color: "#d4d4d4" },
                  isToday && !isSel && {
                    color: isDark ? "#51a2ff" : "#4A89EE",
                    fontFamily: "Figtree-Bold",
                  },
                  isSel && { color: "#fff" },
                ]}
              >
                {dayNum(day)}
              </Text>
              {hasExam && (
                <View
                  style={[
                    styles.examDot,
                    isSel && { backgroundColor: "#fff" },
                    !isSel && { backgroundColor: "#ff9800" },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
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
          style={[styles.body, isDark && { backgroundColor: "#1e1e1e" }]}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
          }
        >
          {dayExams.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, isDark && { color: "#888" }]}>
                KOKEET
              </Text>
              {dayExams.map((exam) => (
                <ExamRow key={exam.examId} exam={exam} isDark={isDark} />
              ))}
            </View>
          )}

          {dayLessons.length === 0 && dayExams.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="event-available"
                size={52}
                color={isDark ? "#444" : "#ddd"}
              />
              <Text style={[styles.emptyText, isDark && { color: "#666" }]}>
                Ei tunteja {isoToFinnishShort(selectedDay)}
              </Text>
            </View>
          ) : dayLessons.length > 0 ? (
            <View style={styles.section}>
              {dayExams.length > 0 && (
                <Text style={[styles.sectionLabel, isDark && { color: "#888" }]}>
                  TUNNIT
                </Text>
              )}
              {dayLessons.map((lesson, i) => (
                <LessonCard
                  key={`${lesson.reservationId}-${i}`}
                  lesson={lesson}
                  isDark={isDark}
                  isFirst={i === 0}
                  isLast={i === dayLessons.length - 1}
                />
              ))}
            </View>
          ) : null}
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

  // Day tabs
  dayTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dayTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  dayTabSelected: { backgroundColor: "#4A89EE" },
  dayTabWd: {
    fontFamily: "Figtree-Medium",
    fontSize: 10,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dayTabNum: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    color: "#333",
    marginTop: 2,
  },
  examDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  section: { marginBottom: 8 },
  sectionLabel: {
    fontFamily: "Figtree-Medium",
    fontSize: 11,
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
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

  // Empty / error
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#bbb",
    textAlign: "center",
  },
  errorText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
