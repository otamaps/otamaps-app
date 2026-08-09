import {
  fetchMessageRecipients,
  WilmaMessageRecipient,
} from "@/lib/wilma/graphqlClient";
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
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TeachersScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [recipients, setRecipients] = useState<WilmaMessageRecipient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      setRecipients(await fetchMessageRecipients({ forceRefresh: refresh }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Vastaanottajien lataus epäonnistui");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fi-FI");
    return recipients
      .filter((item) =>
        !needle || `${item.name} ${item.code} ${item.category}`.toLocaleLowerCase("fi-FI").includes(needle)
      )
      .sort((a, b) => {
        if (a.isOwnTeacher !== b.isOwnTeacher) return a.isOwnTeacher ? -1 : 1;
        return a.name.localeCompare(b.name, "fi-FI");
      });
  }, [query, recipients]);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Opettajat ja henkilökunta</Text>
      </View>

      <View style={[styles.searchBox, isDark && styles.searchBoxDark]}>
        <MaterialIcons name="search" size={20} color={isDark ? "#888" : "#999"} />
        <TextInput
          style={[styles.searchInput, isDark && styles.textLight]}
          value={query}
          onChangeText={setQuery}
          placeholder="Hae nimellä tai lyhenteellä"
          placeholderTextColor={isDark ? "#777" : "#aaa"}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={isDark ? "#666" : "#ccc"} />
          <Text style={[styles.stateText, isDark && styles.mutedDark]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryText}>Yritä uudelleen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.id}:${item.schoolId}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.stateText, isDark && styles.mutedDark]}>Ei hakutuloksia</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, isDark && styles.rowDark]}
              onPress={() =>
                router.push({
                  pathname: "/wilma/compose" as never,
                  params: {
                    recipientId: String(item.id),
                    schoolId: String(item.schoolId),
                    name: item.name,
                    code: item.code,
                  },
                })
              }
            >
              <View style={[styles.avatar, isDark && styles.avatarDark]}>
                <MaterialIcons name="person-outline" size={22} color={isDark ? "#51a2ff" : "#4A89EE"} />
              </View>
              <View style={styles.rowText}>
                <View style={styles.nameLine}>
                  <Text style={[styles.name, isDark && styles.textLight]} numberOfLines={1}>{item.name}</Text>
                  {!!item.code && <Text style={[styles.code, isDark && styles.mutedDark]}>({item.code})</Text>}
                </View>
                <Text style={[styles.category, isDark && styles.mutedDark]} numberOfLines={1}>
                  {item.isOwnTeacher ? "Oma opettaja · " : ""}{item.category}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={isDark ? "#555" : "#bbb"} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  containerDark: { backgroundColor: "#1e1e1e" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", backgroundColor: "#fff" },
  headerDark: { backgroundColor: "#1e1e1e", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e5e5" },
  searchBoxDark: { backgroundColor: "#2b2b2b", borderColor: "#444" },
  searchInput: { flex: 1, height: 44, fontFamily: "Figtree-Regular", fontSize: 15, color: "#222" },
  centered: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateText: { fontFamily: "Figtree-Regular", fontSize: 15, textAlign: "center", color: "#888" },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, backgroundColor: "#eef4ff" },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  rowDark: { backgroundColor: "#252525", borderBottomColor: "#3a3a3a" },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#eef4ff" },
  avatarDark: { backgroundColor: "#25334a" },
  rowText: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#222" },
  code: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#888" },
  category: { marginTop: 2, fontFamily: "Figtree-Regular", fontSize: 12, color: "#888" },
  textLight: { color: "#fff" },
  mutedDark: { color: "#888" },
});
