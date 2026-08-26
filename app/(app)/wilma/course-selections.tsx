import {
  fetchCourseTray,
  fetchCourseTrays,
  fetchSelectedCourses,
  WilmaCourseTray,
  WilmaCourseTrayDetail,
  WilmaSelectedCourse,
} from "@/lib/wilma/graphqlClient";
import {
  findCurrentCourseTray,
  groupCoursesByPeriod,
} from "@/lib/wilma/courseSelectionGrouping";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedGroups = useMemo(() => groupCoursesByPeriod(selected), [selected]);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const options = { forceRefresh: refresh };
      const [nextSelected, nextTrays] = await Promise.all([
        fetchSelectedCourses(options),
        fetchCourseTrays(options),
      ]);
      setSelected(nextSelected);
      setTrays(nextTrays);
      if (refresh) {
        setTrayDetails({});
        setTrayDetailError({});
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kurssivalintojen lataaminen epäonnistui."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedGroups.length) return;
    setExpandedPeriods((current) =>
      Object.keys(current).length
        ? current
        : { [selectedGroups[0].key]: true }
    );
  }, [selectedGroups]);

  const loadTrayDetail = useCallback(async (tray: WilmaCourseTray) => {
    let targetId = tray.id;
    setTrayDetailLoading(targetId);
    setTrayDetailError((current) => ({ ...current, [targetId]: "" }));
    try {
      const currentTrays = await fetchCourseTrays({ forceRefresh: true });
      setTrays(currentTrays);
      const currentTray = findCurrentCourseTray(tray, currentTrays);
      if (!currentTray) {
        throw new Error(
          "Kurssitarjotin ei ole enää saatavilla. Päivitä näkymä ja yritä uudelleen."
        );
      }

      targetId = currentTray.id;
      setExpandedTrayId(targetId);
      setTrayDetailLoading(targetId);
      setTrayDetailError((current) => ({ ...current, [targetId]: "" }));
      const detail = await fetchCourseTray(targetId, { forceRefresh: true });
      setTrayDetails((current) => ({ ...current, [targetId]: detail }));
    } catch (cause) {
      setTrayDetailError((current) => ({
        ...current,
        [targetId]: cause instanceof Error
          ? cause.message
          : "Kurssitarjottimen sisältöä ei voitu ladata.",
      }));
    } finally {
      setTrayDetailLoading(null);
    }
  }, []);

  const toggleTray = useCallback(async (tray: WilmaCourseTray) => {
    if (expandedTrayId === tray.id) {
      setExpandedTrayId(null);
      return;
    }

    setExpandedTrayId(tray.id);
    if (trayDetails[tray.id] || trayDetailLoading === tray.id) return;
    await loadTrayDetail(tray);
  }, [expandedTrayId, loadTrayDetail, trayDetails, trayDetailLoading]);

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
          {tab === "SELECTED" ? (selectedGroups.length ? selectedGroups.map((group) => {
            const expanded = expandedPeriods[group.key] ?? false;
            return (
              <View key={group.key} style={[styles.trayCard, isDark && styles.cardDark]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  style={styles.periodHeader}
                  onPress={() =>
                    setExpandedPeriods((current) => ({
                      ...current,
                      [group.key]: !expanded,
                    }))
                  }
                >
                  <View style={styles.periodBadge}>
                    <Text style={styles.periodBadgeText}>{group.label}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, isDark && styles.textLight]}>
                      Jakso {group.label}
                    </Text>
                    <Text style={styles.meta}>
                      {group.courses.length} {group.courses.length === 1 ? "valinta" : "valintaa"}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={expanded ? "expand-less" : "expand-more"}
                    size={22}
                    color={isDark ? "#aaa" : "#667085"}
                  />
                </Pressable>
                {expanded && (
                  <View style={[styles.periodContents, isDark && styles.trayContentsDark]}>
                    {group.courses.map((course) => (
                      <View
                        key={`${course.tray}-${course.period}-${course.groupCode}`}
                        style={[styles.selectedCourseRow, isDark && styles.courseRowDark]}
                      >
                        <View style={styles.codeChip}>
                          <Text style={styles.codeText}>{course.groupCode}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, isDark && styles.textLight]}>
                            {course.tray}
                          </Text>
                          {!!course.bar && <Text style={styles.meta}>Palkki {course.bar}</Text>}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }) : <Text style={styles.empty}>Valittuja kursseja ei löytynyt.</Text>)
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
                          onPress={() => void loadTrayDetail(tray)}
                        >
                          <Text style={styles.retryText}>Yritä uudelleen</Text>
                        </Pressable>
                      </View>
                    ) : detail?.bars.length ? detail.bars.map((bar, barIndex) => (
                      <View key={`${tray.id}-${bar.name}-${barIndex}`} style={styles.trayBar}>
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
  container: { flex: 1, backgroundColor: "#f5f7fb" }, containerDark: { backgroundColor: "#18191B" }, header: { height: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 20, color: "#222" }, borderDark: { borderBottomColor: "#333" }, tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd", paddingHorizontal: 12 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" }, tabActive: { borderBottomColor: "#4A89EE" }, tabText: { fontFamily: "Figtree-Medium", fontSize: 13, color: "#667085" }, tabTextActive: { color: "#4A89EE" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 }, content: { padding: 16, gap: 10 }, notice: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#eaf1ff", borderRadius: 12, padding: 12, marginBottom: 4 }, noticeDark: { backgroundColor: "#233047" }, noticeText: { flex: 1, fontFamily: "Figtree-Regular", fontSize: 12, color: "#4b6282" },
  cardDark: { backgroundColor: "#232427" }, codeChip: { backgroundColor: "#eaf1ff", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, codeText: { fontFamily: "Figtree-SemiBold", fontSize: 12, color: "#4A89EE" }, cardTitle: { fontFamily: "Figtree-SemiBold", fontSize: 14, color: "#202939" }, meta: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 3 },
  trayCard: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" },
  trayHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  periodHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  periodBadge: { alignItems: "center", backgroundColor: "#4A89EE", borderRadius: 9, justifyContent: "center", minHeight: 38, minWidth: 44, paddingHorizontal: 8 },
  periodBadgeText: { color: "#fff", fontFamily: "Figtree-Bold", fontSize: 14 },
  periodContents: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e3e7ee", gap: 8, padding: 10 },
  selectedCourseRow: { alignItems: "flex-start", backgroundColor: "#f7f9fc", borderRadius: 10, flexDirection: "row", gap: 10, padding: 10 },
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
