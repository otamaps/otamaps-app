import { fetchPastExams, WilmaPastExam } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

export default function WilmaPastExamsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [items, setItems] = useState<WilmaPastExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setItems(await fetchPastExams({ forceRefresh: refresh }));
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
        <View>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>Arvosanat</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>Viimeiset 12 kuukautta</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#3478F5"} />
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
          data={items}
          keyExtractor={(item, index) => `${item.date}-${item.examTitle}-${index}`}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={isDark ? "#51a2ff" : "#3478F5"}
            />
          }
          ListEmptyComponent={<Text style={[styles.emptyText, isDark && styles.textMuted]}>Ei arvioituja kokeita viimeisen vuoden ajalta.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, isDark && styles.cardDark]}>
              <View style={styles.titleRow}>
                <View style={styles.titleText}>
                  <Text style={[styles.title, isDark && styles.textLight]}>{item.examTitle}</Text>
                  <Text style={[styles.meta, isDark && styles.textMuted]}>
                    {[item.date, item.teacherName].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <View style={[styles.grade, !item.grade && styles.gradePending]}>
                  <Text style={[styles.gradeText, !item.grade && styles.gradePendingText]}>
                    {item.grade || "–"}
                  </Text>
                </View>
              </View>
              {!!item.details && <Text style={[styles.details, isDark && styles.textMuted]}>{item.details}</Text>}
              {!!item.writtenAssessment && (
                <View style={[styles.assessment, isDark && styles.assessmentDark]}>
                  <Text style={[styles.assessmentText, isDark && styles.textLight]}>{item.writtenAssessment}</Text>
                </View>
              )}
            </View>
          )}
        />
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
  borderDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  headerSubtitle: { fontFamily: "Figtree-Regular", fontSize: 11, color: "#888", marginTop: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardDark: { backgroundColor: "#232427" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleText: { flex: 1 },
  title: { fontFamily: "Figtree-SemiBold", fontSize: 16, lineHeight: 21, color: "#222" },
  meta: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#7c8799", marginTop: 6 },
  grade: { minWidth: 44, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F5E9", paddingHorizontal: 8 },
  gradePending: { backgroundColor: "#eef1f5" },
  gradeText: { fontFamily: "Figtree-Bold", fontSize: 17, color: "#2E7D32" },
  gradePendingText: { color: "#7c8799" },
  details: { fontFamily: "Figtree-Regular", fontSize: 13, lineHeight: 19, color: "#666", marginTop: 12 },
  assessment: { backgroundColor: "#F1F5FF", borderRadius: 10, padding: 11, marginTop: 12 },
  assessmentDark: { backgroundColor: "#343b48" },
  assessmentText: { fontFamily: "Figtree-Regular", fontSize: 13, lineHeight: 18, color: "#222" },
  emptyText: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#888", textAlign: "center" },
  retryButton: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#3478F5" },
  textLight: { color: "#fff" },
  textMuted: { color: "#aaa" },
});
