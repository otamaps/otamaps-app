import {
  fetchMessageRecipients,
  fetchWilmaQueryCapabilities,
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
  const [scheduleSupported, setScheduleSupported] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      setRecipients(await fetchMessageRecipients({ forceRefresh: refresh }));
      try {
        const capabilities = await fetchWilmaQueryCapabilities({ forceRefresh: refresh });
        setScheduleSupported(capabilities.has("teacherSchedule"));
      } catch {
        setScheduleSupported(false);
      }
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

  const openMessage = (item: WilmaMessageRecipient) => router.push({
    pathname: "/wilma/compose" as never,
    params: {
      recipientId: String(item.id),
      schoolId: String(item.schoolId),
      name: item.name,
      code: item.code,
    },
  });

  const openSchedule = (item: WilmaMessageRecipient) => router.push({
    pathname: "/wilma/teacher-schedule" as never,
    params: { teacherId: String(item.id), name: item.name, code: item.code },
  });

  return (
    // The safe-area inset above the header is otherwise painted with the
    // screen's body background, so the status bar sits on a visibly
    // different color than the nav bar right below it. Painting the inset
    // with the header's own background keeps the two matched.
    <SafeAreaView style={[styles.statusBarArea, isDark && styles.statusBarAreaDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, isDark && styles.containerDark]}>
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
          renderItem={({ item }) => {
            const isTeacher = item.category.toLocaleLowerCase("fi-FI").includes("opettajat");
            return (
            <View style={[styles.row, isDark && styles.rowDark]}>
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
              <View style={styles.actions}>
                {isTeacher && scheduleSupported && (
                  <Pressable
                    style={[styles.actionButton, isDark && styles.actionButtonDark]}
                    onPress={() => openSchedule(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Näytä opettajan ${item.name} lukujärjestys`}
                  >
                    <MaterialIcons name="calendar-month" size={19} color={isDark ? "#51a2ff" : "#4A89EE"} />
                  </Pressable>
                )}
                <Pressable
                  style={[styles.actionButton, isDark && styles.actionButtonDark]}
                  onPress={() => openMessage(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Lähetä viesti vastaanottajalle ${item.name}`}
                >
                  <MaterialIcons name="mail-outline" size={19} color={isDark ? "#51a2ff" : "#4A89EE"} />
                </Pressable>
              </View>
            </View>
          );}}
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", backgroundColor: "#fff" },
  headerDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e5e5" },
  searchBoxDark: { backgroundColor: "#2b2b2b", borderColor: "#444" },
  searchInput: { flex: 1, height: 44, fontFamily: "Figtree-Regular", fontSize: 15, color: "#222" },
  centered: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateText: { fontFamily: "Figtree-Regular", fontSize: 15, textAlign: "center", color: "#888" },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, backgroundColor: "#eef4ff" },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  rowDark: { backgroundColor: "#232427", borderBottomColor: "#3a3a3a" },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#eef4ff" },
  avatarDark: { backgroundColor: "#25334a" },
  rowText: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#222" },
  code: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#888" },
  category: { marginTop: 2, fontFamily: "Figtree-Regular", fontSize: 12, color: "#888" },
  actions: { flexDirection: "row", gap: 7 },
  actionButton: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef4ff" },
  actionButtonDark: { backgroundColor: "#25334a" },
  textLight: { color: "#fff" },
  mutedDark: { color: "#888" },
});
