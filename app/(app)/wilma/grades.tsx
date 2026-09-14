import {
  fetchGradebook,
  fetchMatriculationResults,
  WilmaGradebook,
  WilmaMatriculationResult,
} from "@/lib/wilma/graphqlClient";
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

type Tab = "COURSES" | "MATRICULATION";

export default function WilmaGradesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [tab, setTab] = useState<Tab>("COURSES");
  const [gradebook, setGradebook] = useState<WilmaGradebook | null>(null);
  const [matriculation, setMatriculation] = useState<WilmaMatriculationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const [nextGradebook, nextMatriculation] = await Promise.all([
        fetchGradebook({ forceRefresh: refresh }),
        fetchMatriculationResults({ forceRefresh: refresh }),
      ]);
      setGradebook(nextGradebook);
      setMatriculation(nextMatriculation);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arvosanojen lataaminen epäonnistui.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    // The safe-area inset above the header is otherwise painted with the
    // screen's body background, so the status bar sits on a visibly
    // different color than the nav bar right below it. Painting the inset
    // with the header's own background keeps the two matched.
    <SafeAreaView style={[styles.statusBarArea, isDark && styles.statusBarAreaDark]} edges={["top"]}>
      <View style={[styles.container, isDark && styles.containerDark]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#3478F5"} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Arvosanat</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push("/wilma/past-exams" as never)} hitSlop={8}>
          <MaterialIcons name="fact-check" size={22} color={isDark ? "#51a2ff" : "#3478F5"} />
        </Pressable>
      </View>
      <View style={[styles.tabs, isDark && styles.borderDark]}>
        {([[
          "COURSES",
          "Suoritukset",
        ], ["MATRICULATION", "Yo-tulokset"]] as const).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            style={[styles.tab, tab === value && styles.tabActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, isDark && styles.textMuted, tab === value && styles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#3478F5" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={44} color="#aaa" />
          <Text style={[styles.emptyText, isDark && styles.textMuted]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>Yritä uudelleen</Text></Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor="#3478F5" />}
        >
          {tab === "COURSES" ? (
            <>
              {!!gradebook?.summary.length && (
                <View style={[styles.summaryCard, isDark && styles.cardDark]}>
                  {gradebook.summary.map((item) => (
                    <View key={item.label} style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, isDark && styles.textMuted]}>{item.label}</Text>
                      <Text style={[styles.summaryValue, isDark && styles.textLight]}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              )}
              {gradebook?.subjects.map((subject) => (
                <View key={subject.name} style={[styles.card, isDark && styles.cardDark]}>
                  <View style={styles.subjectHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subjectName, isDark && styles.textLight]}>{subject.name}</Text>
                      {!!subject.credits && <Text style={[styles.meta, isDark && styles.textMuted]}>{subject.credits} ECTS</Text>}
                    </View>
                    {!!subject.grade && <Text style={styles.grade}>{subject.grade}</Text>}
                  </View>
                  {subject.courses.map((course) => (
                    <View key={`${subject.name}-${course.code}-${course.completedOn}`} style={[styles.courseRow, isDark && styles.courseRowDark]}>
                      <View style={styles.codeChip}><Text style={styles.codeText}>{course.code}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.courseName, isDark && styles.textLight]}>{course.name || course.code}</Text>
                        <Text style={[styles.meta, isDark && styles.textMuted]}>{[course.completedOn, course.teacher].filter(Boolean).join(" · ")}</Text>
                      </View>
                      {!!course.grade && <Text style={styles.courseGrade}>{course.grade}</Text>}
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : matriculation.length ? (
            matriculation.map((item) => (
              <View key={`${item.subject}-${item.completedOn}`} style={[styles.card, isDark && styles.cardDark]}>
                <View style={styles.subjectHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subjectName, isDark && styles.textLight]}>{item.subject}</Text>
                    <Text style={[styles.meta, isDark && styles.textMuted]}>{[item.completedOn, item.compulsory].filter(Boolean).join(" · ")}</Text>
                  </View>
                  {!!item.grade && <Text style={styles.grade}>{item.grade}</Text>}
                </View>
                {!!item.points && <Text style={[styles.points, isDark && styles.textMuted]}>Pisteet: {item.points}</Text>}
                {!!item.rejectedReason && <Text style={styles.rejected}>{item.rejectedReason}</Text>}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>Ei yo-tuloksia.</Text>
          )}
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusBarArea: { flex: 1, backgroundColor: "#fff" },
  statusBarAreaDark: { backgroundColor: "#18191B" },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  containerDark: { backgroundColor: "#18191B" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 12, backgroundColor: "#fff" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd", paddingHorizontal: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#3478F5" },
  tabText: { fontFamily: "Figtree-Medium", fontSize: 13, color: "#666" },
  tabTextActive: { color: "#3478F5" },
  borderDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  content: { padding: 16, gap: 12 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 9 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  summaryLabel: { flex: 1, fontFamily: "Figtree-Regular", fontSize: 13, color: "#666" },
  summaryValue: { fontFamily: "Figtree-SemiBold", fontSize: 14, color: "#222" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10 },
  cardDark: { backgroundColor: "#232427" },
  subjectHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  subjectName: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  grade: { minWidth: 40, textAlign: "center", fontFamily: "Figtree-Bold", fontSize: 22, color: "#3478F5" },
  courseRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e4e7ec", paddingTop: 10 },
  courseRowDark: { borderTopColor: "#3a3a3a" },
  codeChip: { backgroundColor: "#eaf1ff", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  codeText: { fontFamily: "Figtree-SemiBold", fontSize: 11, color: "#3478F5" },
  courseName: { fontFamily: "Figtree-Medium", fontSize: 14, color: "#222" },
  courseGrade: { fontFamily: "Figtree-Bold", fontSize: 17, color: "#3478F5" },
  meta: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 2 },
  points: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#666" },
  rejected: { fontFamily: "Figtree-Medium", fontSize: 13, color: "#c62828" },
  emptyText: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#888", textAlign: "center" },
  retryButton: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#3478F5" },
  textLight: { color: "#fff" },
  textMuted: { color: "#aaa" },
});
