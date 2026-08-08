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

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchNews());
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
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Tiedotteet</Text>
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
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
          }
          ListEmptyComponent={<Text style={[styles.emptyText, isDark && styles.textMuted]}>Ei tiedotteita.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, isDark && styles.cardDark]}>
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
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  containerDark: { backgroundColor: "#1e1e1e" },
  header: { height: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, backgroundColor: "transparent", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  borderDark: { borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 20, color: "#222" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardDark: { backgroundColor: "#292929" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  date: { fontFamily: "Figtree-Medium", fontSize: 12, color: "#667085" },
  title: { fontFamily: "Figtree-SemiBold", fontSize: 17, lineHeight: 22, color: "#202939" },
  excerpt: { fontFamily: "Figtree-Regular", fontSize: 14, lineHeight: 20, color: "#4b5565", marginTop: 8 },
  author: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 12 },
  permanentChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF2CC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  permanentText: { fontFamily: "Figtree-Medium", fontSize: 11, color: "#8A5A00" },
  emptyText: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" },
  retryButton: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  textLight: { color: "#fff" },
  textMuted: { color: "#aaa" },
});
