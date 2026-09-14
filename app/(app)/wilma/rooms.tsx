import { fetchWilmaRooms, WilmaRoomProfile } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function WilmaRoomsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [rooms, setRooms] = useState<WilmaRoomProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setRooms(await fetchWilmaRooms({ forceRefresh: refresh }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Tilojen lataaminen epäonnistui.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fi-FI");
    if (!needle) return rooms;
    return rooms.filter((room) =>
      `${room.code} ${room.name}`.toLocaleLowerCase("fi-FI").includes(needle),
    );
  }, [query, rooms]);

  return (
    // The safe-area inset above the header is otherwise painted with the
    // screen's body background, so the status bar sits on a visibly
    // different color than the nav bar right below it. Painting the inset
    // with the header's own background keeps the two matched.
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
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>
            Tilojen lukujärjestykset
          </Text>
        </View>

        <View style={[styles.searchBox, isDark && styles.searchBoxDark]}>
          <MaterialIcons
            name="search"
            size={20}
            color={isDark ? "#888" : "#999"}
          />
          <TextInput
            style={[styles.searchInput, isDark && styles.textLight]}
            value={query}
            onChangeText={setQuery}
            placeholder="Hae tilan numerolla tai nimellä"
            placeholderTextColor={isDark ? "#777" : "#aaa"}
            autoCorrect={false}
          />
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
              color={isDark ? "#666" : "#ccc"}
            />
            <Text style={[styles.stateText, isDark && styles.mutedDark]}>
              {error}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>Yritä uudelleen</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
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
              <View style={styles.centered}>
                <Text style={[styles.stateText, isDark && styles.mutedDark]}>
                  Tiloja ei löytynyt.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  isDark && styles.rowDark,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Näytä tilan ${item.code} lukujärjestys`}
                onPress={() =>
                  router.push({
                    pathname: "/wilma/room-schedule" as never,
                    params: {
                      roomId: String(item.id),
                      code: item.code,
                      name: item.name,
                    },
                  })
                }
              >
                <View style={styles.rowText}>
                  <Text
                    style={[styles.name, isDark && styles.textLight]}
                    numberOfLines={1}
                  >
                    {item.code}
                  </Text>
                  <Text
                    style={[styles.category, isDark && styles.mutedDark]}
                    numberOfLines={1}
                  >
                    {item.name || "Ei kuvausta"}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={isDark ? "#666" : "#aaa"}
                />
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
  container: { flex: 1, backgroundColor: "#fff" },
  containerDark: { backgroundColor: "#18191B" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  headerDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    // Sits on the page background rather than on a card of its own — the
    // border alone outlines the field.
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  searchBoxDark: { backgroundColor: "#18191B", borderColor: "#444" },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#222",
  },
  centered: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  stateText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    textAlign: "center",
    color: "#888",
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#eef4ff",
  },
  retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  rowDark: { backgroundColor: "#232427", borderBottomColor: "#3a3a3a" },
  // Unlike the teacher rows, a room row is itself the tap target.
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  name: {
    flexShrink: 1,
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  category: {
    marginTop: 2,
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
  },
  textLight: { color: "#fff" },
  mutedDark: { color: "#888" },
});
