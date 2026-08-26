import { fetchCoursework, WilmaCourse } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CourseworkTab = "HOMEWORK" | "DIARY" | "EXAMS";

type CourseworkRow = {
  key: string;
  date: string;
  courseCode: string;
  courseName: string;
  title: string;
  body: string;
  teacher: string;
};

function dateValue(value: string): number {
  const iso = new Date(value).getTime();
  if (!Number.isNaN(iso)) return iso;
  const [day, month, year] = value.split(".").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function formatDate(value: string): string {
  const timestamp = dateValue(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleDateString("fi-FI", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

function rowsFor(courses: WilmaCourse[], tab: CourseworkTab): CourseworkRow[] {
  const rows = courses.flatMap((course) => {
    const teacher = course.teachers.map((item) => item.teacherName).join(", ");
    if (tab === "HOMEWORK") {
      return course.homework.map((item) => ({
        key: `h-${course.id}-${item.rowNumber}`,
        date: item.date,
        courseCode: course.name || course.courseCode,
        courseName: course.courseName,
        title: "Kotitehtävä",
        body: item.homework,
        teacher,
      }));
    }
    if (tab === "DIARY") {
      return course.diary.map((item) => ({
        key: `d-${course.id}-${item.rowNumber}`,
        date: item.date,
        courseCode: course.name || course.courseCode,
        courseName: course.courseName,
        title: item.lesson ? `Tunti ${item.lesson}` : "Tuntipäiväkirja",
        body: item.note,
        teacher: item.teacherName || teacher,
      }));
    }
    return course.exams.map((item) => ({
      key: `e-${course.id}-${item.id}`,
      date: item.date,
      courseCode: course.name || course.courseCode,
      courseName: course.courseName,
      title: item.name || item.caption || "Koe",
      body: item.info || item.topic || "Ei lisätietoja.",
      teacher,
    }));
  });

  return rows.sort((a, b) => {
    const delta = dateValue(a.date) - dateValue(b.date);
    // Homework matches the diary's newest-first order so upcoming deadlines
    // aren't buried at the bottom of the list (see GitHub issue #3).
    return tab === "DIARY" || tab === "HOMEWORK" ? -delta : delta;
  });
}

export default function WilmaCourseworkScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [courses, setCourses] = useState<WilmaCourse[]>([]);
  const [tab, setTab] = useState<CourseworkTab>("HOMEWORK");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setCourses(await fetchCoursework(undefined, { forceRefresh: refresh }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kurssitietojen lataaminen epäonnistui.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => rowsFor(courses, tab), [courses, tab]);
  const tabs: readonly [CourseworkTab, string][] = [
    ["HOMEWORK", "Tehtävät"],
    ["DIARY", "Päiväkirja"],
    ["EXAMS", "Kokeet"],
  ];

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Kurssit ja tehtävät</Text>
      </View>

      <View style={[styles.tabs, isDark && styles.borderDark]}>
        {tabs.map(([value, label]) => {
          const active = tab === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(value)}
            >
              <Text style={[styles.tabText, isDark && styles.textMuted, active && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={42} color="#aaa" />
          <Text style={[styles.emptyText, isDark && styles.textMuted]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Yritä uudelleen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={rows.length ? styles.list : styles.emptyList}
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
          ListEmptyComponent={
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>Ei näytettäviä tietoja.</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, isDark && styles.cardDark]}>
              <View style={styles.cardHeader}>
                <View style={styles.courseChip}>
                  <Text style={styles.courseChipText}>{item.courseCode}</Text>
                </View>
                <Text style={[styles.date, isDark && styles.textMuted]}>{formatDate(item.date)}</Text>
              </View>
              <Text style={[styles.title, isDark && styles.textLight]}>{item.title}</Text>
              <Text style={[styles.courseName, isDark && styles.textMuted]}>{item.courseName}</Text>
              {!!item.body && <Text style={[styles.body, isDark && styles.textLight]}>{item.body}</Text>}
              {!!item.teacher && <Text style={[styles.teacher, isDark && styles.textMuted]}>{item.teacher}</Text>}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  containerDark: { backgroundColor: "#18191B" },
  header: { height: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 20, color: "#222" },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd", paddingHorizontal: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#4A89EE" },
  tabText: { fontFamily: "Figtree-Medium", fontSize: 13, color: "#667085" },
  tabTextActive: { color: "#4A89EE" },
  borderDark: { borderBottomColor: "#333" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardDark: { backgroundColor: "#232427" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  courseChip: { borderRadius: 7, backgroundColor: "#eaf1ff", paddingHorizontal: 8, paddingVertical: 4 },
  courseChipText: { fontFamily: "Figtree-SemiBold", fontSize: 12, color: "#4A89EE" },
  date: { fontFamily: "Figtree-Medium", fontSize: 12, color: "#667085" },
  title: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#202939" },
  courseName: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#667085", marginTop: 2 },
  body: { fontFamily: "Figtree-Regular", fontSize: 15, lineHeight: 21, color: "#344054", marginTop: 12 },
  teacher: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 12 },
  emptyText: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" },
  retryButton: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  textLight: { color: "#fff" },
  textMuted: { color: "#aaa" },
});
