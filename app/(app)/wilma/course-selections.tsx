import {
  fetchCourseTrays,
  fetchSelectedCourses,
  WilmaCourseTray,
  WilmaSelectedCourse,
} from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "SELECTED" | "TRAYS";

export default function WilmaCourseSelectionsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [tab, setTab] = useState<Tab>("SELECTED");
  const [selected, setSelected] = useState<WilmaSelectedCourse[]>([]);
  const [trays, setTrays] = useState<WilmaCourseTray[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const options = { forceRefresh: refresh };
      const [nextSelected, nextTrays] = await Promise.all([
        fetchSelectedCourses(options),
        fetchCourseTrays(options),
      ]);
      setSelected(nextSelected); setTrays(nextTrays);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kurssivalintojen lataaminen epäonnistui."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} /></Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Kurssivalinnat</Text>
      </View>
      <View style={[styles.tabs, isDark && styles.borderDark]}>
        {([["SELECTED", "Omat valinnat"], ["TRAYS", "Tarjottimet"]] as const).map(([value, label]) => (
          <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
            <Text style={[styles.tabText, isDark && styles.textMuted, tab === value && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <View style={styles.centered}><ActivityIndicator size="large" color="#4A89EE" /></View>
      : error ? <View style={styles.centered}><Text style={styles.empty}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Yritä uudelleen</Text></Pressable></View>
      : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor="#4A89EE" />}>
          <View style={[styles.notice, isDark && styles.noticeDark]}><MaterialIcons name="lock-outline" size={18} color="#4A89EE" /><Text style={[styles.noticeText, isDark && styles.textMuted]}>Tämä näkymä on vain luku -tilassa. Kurssivalintoja ei muuteta.</Text></View>
          {tab === "SELECTED" ? (selected.length ? selected.map((course) => (
            <View key={`${course.tray}-${course.period}-${course.groupCode}`} style={[styles.card, isDark && styles.cardDark]}>
              <View style={styles.codeChip}><Text style={styles.codeText}>{course.groupCode}</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.cardTitle, isDark && styles.textLight]}>{course.tray}</Text><Text style={styles.meta}>{[course.period && `Jakso ${course.period}`, course.bar && `Palkki ${course.bar}`].filter(Boolean).join(" · ")}</Text></View>
            </View>
          )) : <Text style={styles.empty}>Valittuja kursseja ei löytynyt.</Text>)
          : (trays.length ? trays.map((tray) => (
            <View key={tray.id} style={[styles.card, isDark && styles.cardDark]}>
              <MaterialIcons name={tray.closed ? "event-busy" : "view-week"} size={22} color={tray.closed ? "#8a94a6" : "#4A89EE"} />
              <View style={{ flex: 1 }}><Text style={[styles.cardTitle, isDark && styles.textLight]}>{tray.name}</Text><Text style={styles.meta}>{tray.category} · {tray.status}</Text></View>
            </View>
          )) : <Text style={styles.empty}>Kurssitarjottimia ei löytynyt.</Text>)}
        </ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" }, containerDark: { backgroundColor: "#1e1e1e" }, header: { height: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 20, color: "#222" }, borderDark: { borderBottomColor: "#333" }, tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd", paddingHorizontal: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" }, tabActive: { borderBottomColor: "#4A89EE" }, tabText: { fontFamily: "Figtree-Medium", fontSize: 13, color: "#667085" }, tabTextActive: { color: "#4A89EE" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 }, content: { padding: 16, gap: 10 }, notice: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#eaf1ff", borderRadius: 12, padding: 12, marginBottom: 4 }, noticeDark: { backgroundColor: "#233047" }, noticeText: { flex: 1, fontFamily: "Figtree-Regular", fontSize: 12, color: "#4b6282" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14 }, cardDark: { backgroundColor: "#292929" }, codeChip: { backgroundColor: "#eaf1ff", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, codeText: { fontFamily: "Figtree-SemiBold", fontSize: 12, color: "#4A89EE" }, cardTitle: { fontFamily: "Figtree-SemiBold", fontSize: 14, color: "#202939" }, meta: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 3 },
  empty: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" }, retry: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" }, textLight: { color: "#fff" }, textMuted: { color: "#aaa" },
});
