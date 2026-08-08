import { fetchWilmaRooms, WilmaRoomProfile } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WilmaRoomsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [rooms, setRooms] = useState<WilmaRoomProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setRooms(await fetchWilmaRooms()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Tilojen lataaminen epäonnistui."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fi-FI");
    if (!needle) return rooms;
    return rooms.filter((room) => `${room.code} ${room.name}`.toLocaleLowerCase("fi-FI").includes(needle));
  }, [query, rooms]);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} /></Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Tilojen lukujärjestykset</Text>
      </View>
      <View style={[styles.search, isDark && styles.searchDark]}>
        <MaterialIcons name="search" size={20} color="#8a94a6" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Hae tilan numerolla tai nimellä"
          placeholderTextColor="#8a94a6"
          style={[styles.input, isDark && styles.textLight]}
          autoCorrect={false}
        />
      </View>
      {loading ? <View style={styles.centered}><ActivityIndicator size="large" color="#4A89EE" /></View>
      : error ? <View style={styles.centered}><Text style={styles.empty}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Yritä uudelleen</Text></Pressable></View>
      : <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={filtered.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#4A89EE" />}
          ListEmptyComponent={<Text style={styles.empty}>Tiloja ei löytynyt.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, isDark && styles.rowDark]}
              onPress={() => router.push({ pathname: "/wilma/room-schedule" as never, params: { roomId: String(item.id), code: item.code, name: item.name } })}
            >
              <View style={styles.roomIcon}><MaterialIcons name="meeting-room" size={20} color="#4A89EE" /></View>
              <View style={{ flex: 1 }}><Text style={[styles.code, isDark && styles.textLight]}>{item.code}</Text><Text style={styles.name}>{item.name || "Ei kuvausta"}</Text></View>
              <MaterialIcons name="chevron-right" size={22} color="#aaa" />
            </Pressable>
          )}
        />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" }, containerDark: { backgroundColor: "#1e1e1e" },
  header: { height: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 20, color: "#222" }, borderDark: { borderBottomColor: "#333" },
  search: { margin: 16, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12 },
  searchDark: { backgroundColor: "#292929" }, input: { flex: 1, height: 44, fontFamily: "Figtree-Regular", fontSize: 14, color: "#222" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 }, list: { padding: 16, gap: 8 }, emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: "#fff" }, rowDark: { backgroundColor: "#292929" },
  roomIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf1ff" },
  code: { fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#202939" }, name: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 2 },
  empty: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" }, retry: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#eaf1ff", borderRadius: 10 }, retryText: { color: "#4A89EE", fontFamily: "Figtree-SemiBold" }, textLight: { color: "#fff" },
});
