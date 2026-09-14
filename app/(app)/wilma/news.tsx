import { fetchNews, WilmaNewsItem } from "@/lib/wilma/graphqlClient";
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

export default function WilmaNewsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [items, setItems] = useState<WilmaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setItems(await fetchNews({ forceRefresh: refresh }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tiedotteiden lataaminen epäonnistui.");
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
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Tiedotteet</Text>
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
          keyExtractor={(item) => String(item.id)}
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
          ListEmptyComponent={<Text style={[styles.emptyText, isDark && styles.textMuted]}>Ei tiedotteita.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, isDark && styles.cardDark]}
              onPress={() =>
                router.push({
                  pathname: "/wilma/news-item" as never,
                  params: { id: String(item.id), title: item.title },
                })
              }
            >
              <View style={styles.metaRow}>
                <Text style={[styles.date, isDark && styles.textMuted]}>{item.date}</Text>
                {item.isPermanent ? (
                  <View style={styles.permanentChip}>
                    <MaterialIcons name="push-pin" size={12} color="#8A5A00" />
                    <Text style={styles.permanentText}>Pysyvä</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.title, isDark && styles.textLight]}>{item.title}</Text>
              {!!item.excerpt && (
                <Text style={[styles.excerpt, isDark && styles.textMuted]}>{item.excerpt}</Text>
              )}
              {!!item.teacherName && (
                <Text style={[styles.author, isDark && styles.textMuted]}>{item.teacherName}</Text>
              )}
            </Pressable>
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 12 },
  borderDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardDark: { backgroundColor: "#232427" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  date: { fontFamily: "Figtree-Medium", fontSize: 12, color: "#666" },
  title: { fontFamily: "Figtree-SemiBold", fontSize: 17, lineHeight: 22, color: "#222" },
  excerpt: { fontFamily: "Figtree-Regular", fontSize: 14, lineHeight: 20, color: "#666", marginTop: 8 },
  author: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 12 },
  permanentChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF2CC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  permanentText: { fontFamily: "Figtree-Medium", fontSize: 11, color: "#8A5A00" },
  emptyText: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#888", textAlign: "center" },
  retryButton: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#3478F5" },
  textLight: { color: "#fff" },
  textMuted: { color: "#aaa" },
});
