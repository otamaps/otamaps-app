import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import { addMinutesClock, clockValue } from "@/lib/lunchShiftCore";
import {
  fetchWilmaRoomSchedule,
  WilmaRoomSchedule,
} from "@/lib/wilma/graphqlClient";
import { lessonLabel } from "@/lib/wilma/lessonLabels";
import {
  formatFinnishDate,
  formatLocalISO,
  getISOWeekNumber,
  getMondayOfWeek,
  getNextSchoolDay,
  getSchoolWeekDays,
  weekMonthLabel,
} from "@/lib/wilma/scheduleDates";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const SCHOOL_DAYS = [
  "Maanantai",
  "Tiistai",
  "Keskiviikko",
  "Torstai",
  "Perjantai",
];

/** Never highlight the next school day instead of today earlier than this. */
const NEXT_DAY_SWITCH_EARLIEST = "12:00";

function currentClock(): string {
  return clockValue(new Date().toTimeString());
}

export default function WilmaRoomScheduleScreen() {
  const router = useRouter();
  const { roomId, code, name } = useLocalSearchParams<{
    roomId: string;
    code?: string;
    name?: string;
  }>();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedule, setSchedule] = useState<WilmaRoomSchedule | null>(null);
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
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const weekDates = useMemo(() => getSchoolWeekDays(monday), [monday]);

  const load = useCallback(
    async (forceRefresh = false) => {
      const id = Number(roomId);
      if (!Number.isInteger(id) || id <= 0) {
        setError("Virheellinen tilan tunniste.");
        setLoading(false);
        return;
      }
      if (!forceRefresh) setLoading(true);
      setError(null);
      try {
        const weekMonday = getMondayOfWeek(weekOffset);
        setSchedule(
          await fetchWilmaRoomSchedule(id, formatFinnishDate(weekMonday), {
            forceRefresh,
          }),
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Lukujärjestyksen lataaminen epäonnistui.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roomId, weekOffset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const lessonsByDay = useMemo(
    () =>
      schedule?.lessons.reduce<Record<number, WilmaRoomSchedule["lessons"]>>(
        (result, lesson) => {
          if (lesson.day >= 1 && lesson.day <= 5)
            (result[lesson.day] ??= []).push(lesson);
          return result;
        },
        {},
      ) ?? {},
    [schedule],
  );

  // The day marked with a pill: today, or — once today's last booking has been
  // over for 30+ minutes, or the room has nothing booked today at all — the
  // next school day, matching how the personal schedule reads. Only meaningful
  // on the current week; any other week has no "today" on screen, so nothing is
  // highlighted or dimmed there.
  const highlightedDay = useMemo(() => {
    if (weekOffset !== 0) return today;
    const todayIndex = weekDates.indexOf(today);
    const todaysLessons =
      todayIndex >= 0 ? (lessonsByDay[todayIndex + 1] ?? []) : [];
    const lastLessonEnd = todaysLessons.reduce(
      (latest, lesson) =>
        clockValue(lesson.end) > latest ? clockValue(lesson.end) : latest,
      "",
    );
    const showNextDay =
      nowClock >= NEXT_DAY_SWITCH_EARLIEST &&
      (!lastLessonEnd || nowClock >= addMinutesClock(lastLessonEnd, 30));
    return showNextDay ? formatLocalISO(getNextSchoolDay(new Date())) : today;
  }, [lessonsByDay, nowClock, today, weekDates, weekOffset]);

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

  // Open on the day worth reading rather than on Monday. Only the current week
  // can do this, and only once — a week the reader navigated to keeps whatever
  // scroll position they left it at.
  useEffect(() => {
    if (didAutoScroll.current) return;
    if (loading || error || !schedule || weekOffset !== 0) return;
    if (!weekDates.includes(highlightedDay)) {
      // A Friday evening rolls the highlight into next week, which this screen
      // is not showing — the week reads fine from the top.
      didAutoScroll.current = true;
      return;
    }
    didAutoScroll.current = true;
    scrollToDay(highlightedDay);
  }, [
    error,
    highlightedDay,
    loading,
    schedule,
    scrollToDay,
    weekDates,
    weekOffset,
  ]);

  return (
    // The safe-area inset above the header is otherwise painted with the
    // screen's body background, so the status bar sits on a visibly different
    // color than the nav bar right below it. Painting the inset with the
    // header's own background keeps the two matched.
    <SafeAreaView
      style={[styles.statusBarArea, isDark && styles.statusBarAreaDark]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={[styles.header, isDark && styles.headerDark]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.headerTitle, isDark && styles.textLight]}
              numberOfLines={1}
            >
              {schedule?.room.code ?? code ?? "Tila"}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {schedule?.room.name ?? name ?? ""}
            </Text>
          </View>
        </View>

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
            <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
              {error}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>Yritä uudelleen</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bodyWrap}>
            <ScrollView
              ref={scrollRef}
              style={[styles.body, isDark && styles.bodyDark]}
              contentContainerStyle={styles.bodyContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void load(true);
                  }}
                  tintColor={isDark ? "#51a2ff" : "#4A89EE"}
                />
              }
            >
              {SCHOOL_DAYS.map((dayName, index) => {
                const day = index + 1;
                const lessons = [...(lessonsByDay[day] ?? [])].sort((a, b) =>
                  a.start.localeCompare(b.start),
                );
                const dayISO = weekDates[index];
                const date = dayISO.split("-");
                const isToday = dayISO === today;
                // Once the highlight has moved on to the next school day
                // (today's last booking is long over), today itself is done too
                // and dims along with the actually-past days.
                const isPastDay = dayISO < highlightedDay;
                const isHighlighted = dayISO === highlightedDay;

                return (
                  <View
                    key={day}
                    style={[styles.daySection, isPastDay && styles.pastOpacity]}
                    onLayout={(event) =>
                      handleDayLayout(dayISO, event.nativeEvent.layout.y)
                    }
                  >
                    <View style={styles.dayHeader}>
                      <Text
                        style={[
                          styles.dayName,
                          isDark && styles.textLight,
                          isHighlighted && {
                            color: isDark ? "#51a2ff" : "#3d7de3",
                          },
                        ]}
                      >
                        {dayName}
                      </Text>
                      <Text style={styles.dayDate}>
                        {Number(date[2])}.{Number(date[1])}.
                      </Text>
                      <View style={{ flex: 1 }} />
                      {isHighlighted && (
                        <View
                          style={[
                            styles.todayPill,
                            isDark && styles.todayPillDark,
                          ]}
                        >
                          <Text
                            style={[
                              styles.todayPillText,
                              isDark && styles.todayPillTextDark,
                            ]}
                          >
                            {isToday ? "Tänään" : "Huomenna"}
                          </Text>
                        </View>
                      )}
                    </View>

                    {lessons.length ? (
                      // The day's bookings read as one continuous card with
                      // hairlines between them rather than a stack of separate
                      // boxes, matching the personal schedule.
                      <View>
                        {lessons.map((lesson, lessonIndex) => {
                          const isFirst = lessonIndex === 0;
                          const isLast = lessonIndex === lessons.length - 1;
                          // Stacking the row dim on top of an already dimmed
                          // day would make today's bookings darker than a
                          // genuinely past day's.
                          const isPast =
                            !isPastDay &&
                            isToday &&
                            clockValue(lesson.end) <= nowClock;
                          const isCurrent =
                            isToday &&
                            clockValue(lesson.start) <= nowClock &&
                            nowClock < clockValue(lesson.end);
                          // Unlike the dim, the gray badge also applies on a
                          // day that has wholly passed — stacking a color with
                          // the day's opacity reads fine, a second dim does not.
                          const isOver =
                            isPastDay ||
                            (isToday && clockValue(lesson.end) <= nowClock);

                          return (
                            <Fragment
                              key={`${day}-${lesson.start}-${lessonIndex}`}
                            >
                              <View
                                style={[
                                  styles.lessonCard,
                                  isDark && styles.lessonCardDark,
                                  isFirst && styles.cardTop,
                                  isLast && styles.cardBottom,
                                  isPast && styles.pastOpacity,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.timeTag,
                                    isDark && styles.timeTagDark,
                                    isOver && styles.timeTagPast,
                                    isOver && isDark && styles.timeTagPastDark,
                                    isCurrent && styles.timeTagCurrent,
                                    isCurrent &&
                                      isDark &&
                                      styles.timeTagCurrentDark,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.timeTagStart,
                                      isDark && styles.timeTagStartDark,
                                      isOver && styles.timeTagStartPast,
                                      isOver &&
                                        isDark &&
                                        styles.timeTagStartPastDark,
                                      isCurrent && styles.timeTagStartCurrent,
                                      isCurrent &&
                                        isDark &&
                                        styles.timeTagStartCurrentDark,
                                    ]}
                                  >
                                    {clockValue(lesson.start)}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.timeTagEnd,
                                      isDark && styles.timeTagEndDark,
                                      isOver && styles.timeTagEndPast,
                                      isOver &&
                                        isDark &&
                                        styles.timeTagEndPastDark,
                                      isCurrent && styles.timeTagEndCurrent,
                                      isCurrent &&
                                        isDark &&
                                        styles.timeTagEndCurrentDark,
                                    ]}
                                  >
                                    {clockValue(lesson.end)}
                                  </Text>
                                </View>
                                <View style={styles.lessonInfo}>
                                  {lesson.groups.map((group, groupIndex) => {
                                    const { code, title } = lessonLabel(
                                      group.code,
                                      group.name,
                                    );
                                    const teachers = group.teachers
                                      .map(
                                        (teacher) =>
                                          teacher.name || teacher.code,
                                      )
                                      .filter(Boolean)
                                      .join(", ");
                                    return (
                                      <View
                                        key={`${group.code}-${group.name}-${groupIndex}`}
                                      >
                                        <LessonTitleRow
                                          title={title}
                                          code={code}
                                          isDark={isDark}
                                          numberOfLines={2}
                                          titleStyle={[
                                            styles.lessonSubject,
                                            isDark && styles.textLight,
                                          ]}
                                        />
                                        {!!teachers && (
                                          <Text
                                            style={styles.lessonMeta}
                                            numberOfLines={1}
                                          >
                                            {teachers}
                                          </Text>
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                              {!isLast && (
                                <View
                                  style={[
                                    styles.lessonDivider,
                                    isDark && styles.lessonDividerDark,
                                  ]}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                      </View>
                    ) : (
                      <View
                        style={[styles.emptyDay, isDark && styles.emptyDayDark]}
                      >
                        <Text style={styles.emptyDayText}>Ei varauksia</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <LinearGradient
              pointerEvents="none"
              colors={
                isDark
                  ? [
                      "#18191B00",
                      "#18191B1A",
                      "#18191B4D",
                      "#18191B99",
                      "#18191B",
                    ]
                  : [
                      "#fafafa00",
                      "#fafafa1A",
                      "#fafafa4D",
                      "#fafafa99",
                      "#fafafa",
                    ]
              }
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={styles.bottomFade}
            />
          </View>
        )}

        {/* ── Week navigation ──
            Kept below the schedule rather than under the header: it is the one
            control on this screen, and the bottom edge is where a thumb reaches
            one-handed. Outside the loading/error branches so a failed week is
            still navigable. */}
        <View
          style={[
            styles.weekNav,
            { paddingBottom: 10 + insets.bottom },
            isDark && styles.weekNavDark,
          ]}
        >
          <Pressable
            onPress={() => {
              didAutoScroll.current = true;
              setWeekOffset((value) => value - 1);
            }}
            style={styles.navButton}
            hitSlop={12}
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </Pressable>
          <View style={styles.weekText}>
            <Text style={[styles.weekLabel, isDark && styles.textLight]}>
              Viikko {getISOWeekNumber(monday)}
            </Text>
            <Text style={styles.weekSub}>{weekMonthLabel(monday, friday)}</Text>
          </View>
          <Pressable
            onPress={() => {
              didAutoScroll.current = true;
              setWeekOffset((value) => value + 1);
            }}
            style={styles.navButton}
            hitSlop={12}
          >
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusBarArea: { flex: 1, backgroundColor: "#fff" },
  statusBarAreaDark: { backgroundColor: "#18191B" },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  containerDark: { backgroundColor: "#18191B" },
  pastOpacity: { opacity: 0.5 },
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
  headerDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  headerSubtitle: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
    marginTop: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 28,
  },
  errorText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
  },
  errorTextDark: { color: "#888" },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#eef4ff",
  },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  bodyWrap: { flex: 1, position: "relative" },
  body: { flex: 1 },
  bodyDark: { backgroundColor: "#18191B" },
  bodyContent: { padding: 16, paddingBottom: 40 },
  // Fades the scrolling content out just above the week navigation bar, so it
  // reads as sliding underneath it rather than stopping abruptly.
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 44 },
  daySection: { marginBottom: 22 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginLeft: 2,
  },
  dayName: { fontFamily: "Figtree-SemiBold", fontSize: 16, color: "#222" },
  dayDate: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#999" },
  todayPill: {
    backgroundColor: "#EEF4FF",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#cddcf3",
  },
  todayPillDark: { backgroundColor: "#51A2FF1F", borderColor: "#51a2ff49" },
  todayPillText: {
    fontFamily: "Figtree-Medium",
    fontSize: 11,
    color: "#4A89EE",
  },
  todayPillTextDark: { color: "#51a2ff" },
  lessonCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lessonCardDark: { backgroundColor: "#232427" },
  cardTop: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  cardBottom: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  lessonDivider: { height: 1, backgroundColor: "#f0f0f0" },
  lessonDividerDark: { backgroundColor: "#333" },
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
  timeTag: {
    backgroundColor: "#EEF4FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  timeTagDark: { backgroundColor: "#51A2FF1F" },
  timeTagCurrent: { backgroundColor: "#16A34A1A" },
  timeTagCurrentDark: { backgroundColor: "#4ADE8022" },
  // A booking that is over drops its blue accent for a neutral gray, so the
  // colored badges left on the week are only the ones still ahead.
  timeTagPast: { backgroundColor: "#F3F4F6" },
  timeTagPastDark: { backgroundColor: "#2E3034" },
  timeTagStart: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 13,
    color: "#4A89EE",
  },
  timeTagStartDark: { color: "#51a2ff" },
  timeTagStartCurrent: { color: "#16A34A" },
  timeTagStartCurrentDark: { color: "#4ADE80" },
  timeTagStartPast: { color: "#8A929D" },
  timeTagStartPastDark: { color: "#9CA3AF" },
  timeTagEnd: {
    fontFamily: "Figtree-Regular",
    fontSize: 11,
    color: "#4A89EE70",
    marginTop: 1,
  },
  timeTagEndDark: { color: "#51a2ff70" },
  timeTagEndCurrent: { color: "#16A34A80" },
  timeTagEndCurrentDark: { color: "#4ADE8080" },
  timeTagEndPast: { color: "#8A929D80" },
  timeTagEndPastDark: { color: "#9CA3AF80" },
  emptyDay: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    backgroundColor: "#ffffff80",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyDayDark: { borderColor: "#333", backgroundColor: "#23242780" },
  emptyDayText: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#aaa" },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
  },
  weekNavDark: { backgroundColor: "#18191B" },
  navButton: { padding: 4 },
  weekText: { alignItems: "center" },
  weekLabel: { fontFamily: "Figtree-SemiBold", fontSize: 16, color: "#222" },
  weekSub: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
    marginTop: 1,
    textTransform: "capitalize",
  },
  textLight: { color: "#fff" },
});
