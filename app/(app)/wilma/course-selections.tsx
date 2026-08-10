import {
  fetchCourseTray,
  fetchCourseTrays,
  fetchSelectedCourses,
  WilmaCourseTray,
  WilmaCourseTrayDetail,
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
  const [expandedTrayId, setExpandedTrayId] = useState<string | null>(null);
  const [trayDetails, setTrayDetails] = useState<Record<string, WilmaCourseTrayDetail>>({});
  const [trayDetailLoading, setTrayDetailLoading] = useState<string | null>(null);
  const [trayDetailError, setTrayDetailError] = useState<Record<string, string>>({});
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
      if (refresh) {
        setTrayDetails({});
        setTrayDetailError({});
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kurssivalintojen lataaminen epäonnistui."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggleTray = useCallback(async (tray: WilmaCourseTray) => {
    if (expandedTrayId === tray.id) {
      setExpandedTrayId(null);
      return;
    }

    setExpandedTrayId(tray.id);
    if (trayDetails[tray.id] || trayDetailLoading === tray.id) return;
    setTrayDetailLoading(tray.id);
    setTrayDetailError((current) => ({ ...current, [tray.id]: "" }));
    try {
      const detail = await fetchCourseTray(tray.id);
      setTrayDetails((current) => ({ ...current, [tray.id]: detail }));
    } catch (cause) {
      setTrayDetailError((current) => ({
        ...current,
        [tray.id]: cause instanceof Error
          ? cause.message
          : "Kurssitarjottimen sisältöä ei voitu ladata.",
      }));
    } finally {
      setTrayDetailLoading((current) => current === tray.id ? null : current);
    }
  }, [expandedTrayId, trayDetails, trayDetailLoading]);

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
          : (trays.length ? trays.map((tray) => {
            const expanded = expandedTrayId === tray.id;
            const detail = trayDetails[tray.id];
            return (
              <View key={tray.id} style={[styles.trayCard, isDark && styles.cardDark]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  style={styles.trayHeader}
                  onPress={() => void toggleTray(tray)}
                >
                  <MaterialIcons name={tray.closed ? "event-busy" : "view-week"} size={22} color={tray.closed ? "#8a94a6" : "#4A89EE"} />
                  <View style={{ flex: 1 }}><Text style={[styles.cardTitle, isDark && styles.textLight]}>{tray.name}</Text><Text style={styles.meta}>{tray.category} · {tray.status}</Text></View>
                  <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={22} color={isDark ? "#aaa" : "#667085"} />
                </Pressable>
                {expanded && (
                  <View style={[styles.trayContents, isDark && styles.trayContentsDark]}>
                    {trayDetailLoading === tray.id ? (
                      <ActivityIndicator color="#4A89EE" style={styles.detailLoader} />
                    ) : trayDetailError[tray.id] ? (
                      <View style={styles.detailError}>
                        <Text style={styles.empty}>{trayDetailError[tray.id]}</Text>
                        <Pressable
                          style={styles.retry}
                          onPress={async () => {
                            setTrayDetailError((current) => ({ ...current, [tray.id]: "" }));
                            setTrayDetailLoading(tray.id);
                            try {
                              const nextDetail = await fetchCourseTray(tray.id, { forceRefresh: true });
                              setTrayDetails((current) => ({ ...current, [tray.id]: nextDetail }));
                            } catch (cause) {
                              setTrayDetailError((current) => ({
                                ...current,
                                [tray.id]: cause instanceof Error
                                  ? cause.message
                                  : "Kurssitarjottimen sisältöä ei voitu ladata.",
                              }));
                            } finally {
                              setTrayDetailLoading((current) => current === tray.id ? null : current);
                            }
                          }}
                        >
                          <Text style={styles.retryText}>Yritä uudelleen</Text>
                        </Pressable>
                      </View>
                    ) : detail?.bars.length ? detail.bars.map((bar) => (
                      <View key={bar.name} style={styles.trayBar}>
                        <Text style={[styles.barTitle, isDark && styles.textLight]}>{bar.name}</Text>
                        {bar.courses.map((course) => (
                          <View key={course.id} style={[styles.courseRow, isDark && styles.courseRowDark]}>
                            <View style={[styles.codeChip, course.selected && styles.selectedCodeChip]}>
                              <Text style={[styles.codeText, course.selected && styles.selectedCodeText]}>{course.code}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.courseName, isDark && styles.textLight]}>{course.name}</Text>
                              {!!course.teacher && <Text style={styles.meta}>{course.teacher}</Text>}
                              <View style={styles.courseBadges}>
                                {course.selected && <Text style={styles.selectedBadge}>Valittu</Text>}
                                {course.locked && <Text style={styles.mutedBadge}>Lukittu</Text>}
                                {course.full && <Text style={styles.mutedBadge}>Täynnä</Text>}
                                {course.completed && <Text style={styles.mutedBadge}>Suoritettu{course.grade ? ` · ${course.grade}` : ""}</Text>}
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )) : (
                      <Text style={styles.empty}>Tarjottimelta ei löytynyt kursseja.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          }) : <Text style={styles.empty}>Kurssitarjottimia ei löytynyt.</Text>)}
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
  trayCard: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" },
  trayHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  trayContents: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e3e7ee", padding: 12, gap: 14 },
  trayContentsDark: { borderTopColor: "#444" },
  trayBar: { gap: 7 },
  barTitle: { fontFamily: "Figtree-SemiBold", fontSize: 13, color: "#344054" },
  courseRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#f7f9fc", borderRadius: 10, padding: 10 },
  courseRowDark: { backgroundColor: "#333" },
  courseName: { fontFamily: "Figtree-Medium", fontSize: 13, color: "#202939" },
  selectedCodeChip: { backgroundColor: "#4A89EE" },
  selectedCodeText: { color: "#fff" },
  courseBadges: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  selectedBadge: { fontFamily: "Figtree-SemiBold", fontSize: 10, color: "#2870d9", backgroundColor: "#eaf1ff", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mutedBadge: { fontFamily: "Figtree-Medium", fontSize: 10, color: "#667085", backgroundColor: "#e9edf3", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  detailLoader: { marginVertical: 18 },
  detailError: { alignItems: "center", gap: 10, paddingVertical: 8 },
  empty: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" }, retry: { backgroundColor: "#eaf1ff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { fontFamily: "Figtree-SemiBold", color: "#4A89EE" }, textLight: { color: "#fff" }, textMuted: { color: "#aaa" },
});
