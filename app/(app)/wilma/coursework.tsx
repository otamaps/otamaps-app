import {
  AppText,
  Row,
  SegmentedControl,
  StateView,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import { fetchCoursework, WilmaCourse } from "@/lib/wilma/graphqlClient";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

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

const TABS = [
  ["HOMEWORK", "Tehtävät"],
  ["DIARY", "Päiväkirja"],
  ["EXAMS", "Kokeet"],
] as const;

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
  const theme = useTheme();
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

  // Compact, not large: the tabs sit directly under the bar, which puts a
  // FlatList — not this screen — as the root a large title would need to
  // collapse against.
  const header = useNativeHeader({
    title: "Kurssit ja tehtävät",
    background: "card",
    large: false,
  });

  return (
    <>
      <Stack.Screen options={header} />
      <View style={styles.screen}>
        <SegmentedControl value={tab} onChange={setTab} options={TABS} />
        <FlatList
          data={loading || error ? [] : rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            loading ? (
              <StateView loading />
            ) : error ? (
              <StateView
                icon="error-outline"
                message={error}
                actionLabel="Yritä uudelleen"
                onAction={() => void load()}
              />
            ) : (
              <StateView message="Ei näytettäviä tietoja." />
            )
          }
          renderItem={({ item }) => (
            <Row style={styles.row} chevron={false}>
              <View style={styles.text}>
                <View style={styles.metaLine}>
                  <View style={[styles.chip, { backgroundColor: theme.accentTint }]}>
                    <AppText variant="micro" color="accent">
                      {item.courseCode}
                    </AppText>
                  </View>
                  <AppText variant="meta" color="textMuted">
                    {formatDate(item.date)}
                  </AppText>
                </View>
                <AppText variant="rowTitle" style={styles.title}>
                  {item.title}
                </AppText>
                <AppText variant="meta" color="textMuted">
                  {item.courseName}
                </AppText>
                {!!item.body && (
                  <AppText variant="bodySmall" style={styles.body}>
                    {item.body}
                  </AppText>
                )}
                {!!item.teacher && (
                  <AppText variant="caption" color="textFaint" style={styles.teacher}>
                    {item.teacher}
                  </AppText>
                )}
              </View>
            </Row>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  row: { alignItems: "flex-start", paddingVertical: 14 },
  text: { flex: 1 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  chip: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  title: { marginTop: 2 },
  body: { marginTop: 8 },
  teacher: { marginTop: 8 },
});
