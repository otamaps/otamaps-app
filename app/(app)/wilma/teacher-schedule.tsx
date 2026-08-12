import { fetchWilmaTeacherSchedule, WilmaTeacherSchedule } from "@/lib/wilma/graphqlClient";
import {
  formatFinnishDate,
  getISOWeekNumber,
  getMondayOfWeek,
  getSchoolWeekDays,
  weekMonthLabel,
} from "@/lib/wilma/scheduleDates";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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

const SCHOOL_DAYS = ["Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai"];

export default function WilmaTeacherScheduleScreen() {
  const router = useRouter();
  const { teacherId, code, name } = useLocalSearchParams<{ teacherId: string; code?: string; name?: string }>();
  const isDark = useColorScheme() === "dark";
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedule, setSchedule] = useState<WilmaTeacherSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monday = getMondayOfWeek(weekOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const weekDates = getSchoolWeekDays(monday);

  const load = useCallback(async (forceRefresh = false) => {
    const id = Number(teacherId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Virheellinen opettajan tunniste.");
      setLoading(false);
      return;
    }
    if (!forceRefresh) setLoading(true);
    setError(null);
    try {
      const weekMonday = getMondayOfWeek(weekOffset);
      setSchedule(await fetchWilmaTeacherSchedule(id, formatFinnishDate(weekMonday), { forceRefresh }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lukujärjestyksen lataaminen epäonnistui.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teacherId, weekOffset]);

  useEffect(() => { void load(); }, [load]);

  const lessonsByDay = schedule?.lessons.reduce<Record<number, WilmaTeacherSchedule["lessons"]>>((result, lesson) => {
    if (lesson.day >= 1 && lesson.day <= 5) (result[lesson.day] ??= []).push(lesson);
    return result;
  }, {}) ?? {};

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>{schedule?.teacher.name || name || "Opettaja"}</Text>
          <Text style={styles.headerSubtitle}>{schedule?.teacher.code || code || "Lukujärjestys"}</Text>
        </View>
      </View>

      <View style={[styles.weekNav, isDark && styles.weekNavDark]}>
        <Pressable onPress={() => setWeekOffset((value) => value - 1)} style={styles.navButton} hitSlop={10}>
          <MaterialIcons name="chevron-left" size={28} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <View style={styles.weekText}>
          <Text style={[styles.weekTitle, isDark && styles.textLight]}>Viikko {getISOWeekNumber(monday)}</Text>
          <Text style={styles.weekSubtitle}>{weekMonthLabel(monday, friday)}</Text>
        </View>
        <Pressable onPress={() => setWeekOffset((value) => value + 1)} style={styles.navButton} hitSlop={10}>
          <MaterialIcons name="chevron-right" size={28} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={46} color={isDark ? "#666" : "#bbb"} />
          <Text style={[styles.empty, isDark && styles.mutedDark]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>Yritä uudelleen</Text></Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(true); }}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
          }
        >
          {SCHOOL_DAYS.map((dayName, index) => {
            const day = index + 1;
            const lessons = [...(lessonsByDay[day] ?? [])].sort((a, b) => a.start.localeCompare(b.start));
            const date = weekDates[index].split("-");
            return (
              <View key={day} style={styles.daySection}>
                <Text style={[styles.dayTitle, isDark && styles.textLight]}>{dayName} {Number(date[2])}.{Number(date[1])}.</Text>
                {lessons.length ? lessons.map((lesson, lessonIndex) => (
                  <View key={`${day}-${lesson.start}-${lessonIndex}`} style={[styles.card, isDark && styles.cardDark]}>
                    <Text style={styles.time}>{lesson.start}–{lesson.end}</Text>
                    {lesson.groups.map((group, groupIndex) => {
                      const roomNames = group.rooms.map((room) => room.code || room.name).filter(Boolean).join(", ");
                      return (
                        <View key={`${group.code}-${group.name}-${groupIndex}`}>
                          <Text style={[styles.groupCode, isDark && styles.textLight]}>{group.code}</Text>
                          <Text style={[styles.groupName, isDark && styles.mutedDark]}>{group.name}</Text>
                          {!!roomNames && <Text style={styles.room}>{roomNames}</Text>}
                        </View>
                      );
                    })}
                  </View>
                )) : (
                  <View style={[styles.emptyDay, isDark && styles.emptyDayDark]}>
                    <Text style={[styles.emptyDayText, isDark && styles.mutedDark]}>Ei oppitunteja</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  containerDark: { backgroundColor: "#1e1e1e" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  borderDark: { borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 18, color: "#222" },
  headerSubtitle: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 1 },
  weekNav: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e6ee", backgroundColor: "#fff" },
  weekNavDark: { backgroundColor: "#252525", borderBottomColor: "#333" },
  navButton: { padding: 8 },
  weekText: { alignItems: "center" },
  weekTitle: { fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#202939" },
  weekSubtitle: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 1, textTransform: "capitalize" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  content: { padding: 16, paddingBottom: 40, gap: 18 },
  daySection: { gap: 8 },
  dayTitle: { fontFamily: "Figtree-SemiBold", fontSize: 16, color: "#202939" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  cardDark: { backgroundColor: "#292929" },
  time: { fontFamily: "Figtree-SemiBold", fontSize: 13, color: "#4A89EE", marginBottom: 7 },
  groupCode: { fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#202939" },
  groupName: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#667085", marginTop: 2 },
  room: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 6 },
  emptyDay: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "#dfe4ec", backgroundColor: "#ffffff80" },
  emptyDayDark: { borderColor: "#353535", backgroundColor: "#252525" },
  emptyDayText: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#8a94a6" },
  empty: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, backgroundColor: "#eef4ff" },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  textLight: { color: "#fff" },
  mutedDark: { color: "#929292" },
});
