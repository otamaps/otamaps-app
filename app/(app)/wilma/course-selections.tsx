import {
  AppText,
  SegmentedControl,
  StateView,
  useNativeHeader,
  useTheme,
  type Theme,
} from "@/components/ui";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { radii } from "@/constants/theme";
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
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

type Tab = "SELECTED" | "TRAYS";

const TABS = [
  ["SELECTED", "Omat valinnat"],
  ["TRAYS", "Tarjottimet"],
] as const;

export default function WilmaCourseSelectionsScreen() {
  const theme = useTheme();
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kurssivalintojen lataaminen epäonnistui.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedGroups.length) return;
    setExpandedPeriods((current) =>
      Object.keys(current).length ? current : { [selectedGroups[0].key]: true },
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
        throw new Error("Kurssitarjotin ei ole enää saatavilla. Päivitä näkymä ja yritä uudelleen.");
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
        [targetId]:
          cause instanceof Error ? cause.message : "Kurssitarjottimen sisältöä ei voitu ladata.",
      }));
    } finally {
      setTrayDetailLoading(null);
    }
  }, []);

  const toggleTray = useCallback(
    async (tray: WilmaCourseTray) => {
      if (expandedTrayId === tray.id) {
        setExpandedTrayId(null);
        return;
      }

      setExpandedTrayId(tray.id);
      if (trayDetails[tray.id] || trayDetailLoading === tray.id) return;
      await loadTrayDetail(tray);
    },
    [expandedTrayId, loadTrayDetail, trayDetails, trayDetailLoading],
  );

  // Compact, not large: the tabs sit directly under the bar, which puts a
  // ScrollView — not this screen — as the root a large title would need to
  // collapse against.
  const header = useNativeHeader({ title: "Kurssivalinnat", background: "page", large: false });

  return (
    <>
      <Stack.Screen options={header} />
      <View style={styles.screen}>
        <SegmentedControl value={tab} onChange={setTab} options={TABS} />

        {loading ? (
          <StateView loading />
        ) : error ? (
          <StateView
            icon="error-outline"
            message={error}
            actionLabel="Yritä uudelleen"
            onAction={() => void load()}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load(true);
                }}
                tintColor={theme.accent}
              />
            }
          >
            <View style={[styles.notice, { backgroundColor: theme.accentTint }]}>
              <PlatformSymbol ios="lock" android="lock" size={16} tintColor={theme.accent} />
              <AppText variant="bodySmall" color="textSecondary" style={styles.noticeText}>
                Tämä näkymä on vain luku -tilassa. Kurssivalintoja ei muuteta.
              </AppText>
            </View>

            {tab === "SELECTED" ? (
              selectedGroups.length ? (
                selectedGroups.map((group) => {
                  const expanded = expandedPeriods[group.key] ?? false;
                  return (
                    <View key={group.key} style={[styles.card, { backgroundColor: theme.card }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        style={styles.cardHeader}
                        onPress={() =>
                          setExpandedPeriods((current) => ({ ...current, [group.key]: !expanded }))
                        }
                      >
                        <View style={[styles.periodBadge, { backgroundColor: theme.accent }]}>
                          <AppText variant="rowTitle" style={styles.periodBadgeText}>
                            {group.label}
                          </AppText>
                        </View>
                        <View style={styles.flex1}>
                          <AppText variant="bodySmall">Jakso {group.label}</AppText>
                          <AppText variant="caption" color="textFaint" style={styles.meta}>
                            {group.courses.length}{" "}
                            {group.courses.length === 1 ? "valinta" : "valintaa"}
                          </AppText>
                        </View>
                        <Chevron expanded={expanded} theme={theme} />
                      </Pressable>
                      {expanded && (
                        <View style={[styles.cardBody, { borderTopColor: theme.border }]}>
                          {group.courses.map((course) => (
                            <View
                              key={`${course.tray}-${course.period}-${course.groupCode}`}
                              style={[styles.itemRow, { backgroundColor: theme.bg }]}
                            >
                              <CodeChip label={course.groupCode} theme={theme} />
                              <View style={styles.flex1}>
                                <AppText variant="bodySmall">{course.tray}</AppText>
                                {!!course.bar && (
                                  <AppText variant="caption" color="textFaint" style={styles.meta}>
                                    Palkki {course.bar}
                                  </AppText>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <StateView message="Valittuja kursseja ei löytynyt." />
              )
            ) : trays.length ? (
              trays.map((tray) => {
                const expanded = expandedTrayId === tray.id;
                const detail = trayDetails[tray.id];
                return (
                  <View key={tray.id} style={[styles.card, { backgroundColor: theme.card }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      style={styles.cardHeader}
                      onPress={() => void toggleTray(tray)}
                    >
                      <MaterialIcons
                        name={tray.closed ? "event-busy" : "view-week"}
                        size={22}
                        color={tray.closed ? theme.textFaint : theme.accent}
                      />
                      <View style={styles.flex1}>
                        <AppText variant="bodySmall">{tray.name}</AppText>
                        <AppText variant="caption" color="textFaint" style={styles.meta}>
                          {tray.category} · {tray.status}
                        </AppText>
                      </View>
                      <Chevron expanded={expanded} theme={theme} />
                    </Pressable>
                    {expanded && (
                      <View style={[styles.cardBody, { borderTopColor: theme.border }]}>
                        {trayDetailLoading === tray.id ? (
                          <ActivityIndicator color={theme.accent} style={styles.detailLoader} />
                        ) : trayDetailError[tray.id] ? (
                          <View style={styles.detailError}>
                            <AppText variant="bodySmall" color="textMuted" style={styles.centeredText}>
                              {trayDetailError[tray.id]}
                            </AppText>
                            <Pressable
                              style={[styles.retry, { backgroundColor: theme.accentTint }]}
                              onPress={() => void loadTrayDetail(tray)}
                            >
                              <AppText variant="rowTitle" color="accent">
                                Yritä uudelleen
                              </AppText>
                            </Pressable>
                          </View>
                        ) : detail?.bars.length ? (
                          detail.bars.map((bar, barIndex) => (
                            <View key={`${tray.id}-${bar.name}-${barIndex}`} style={styles.bar}>
                              <AppText variant="bodySmall">{bar.name}</AppText>
                              {bar.courses.map((course) => (
                                <View
                                  key={course.id}
                                  style={[styles.itemRow, { backgroundColor: theme.bg }]}
                                >
                                  <CodeChip
                                    label={course.code}
                                    theme={theme}
                                    selected={course.selected}
                                  />
                                  <View style={styles.flex1}>
                                    <AppText variant="bodySmall">{course.name}</AppText>
                                    {!!course.teacher && (
                                      <AppText variant="caption" color="textFaint" style={styles.meta}>
                                        {course.teacher}
                                      </AppText>
                                    )}
                                    {course.selected || course.locked || course.full || course.completed ? (
                                      <View style={styles.badges}>
                                        {course.selected && <Badge label="Valittu" accent theme={theme} />}
                                        {course.locked && <Badge label="Lukittu" theme={theme} />}
                                        {course.full && <Badge label="Täynnä" theme={theme} />}
                                        {course.completed && (
                                          <Badge
                                            label={`Suoritettu${course.grade ? ` · ${course.grade}` : ""}`}
                                            theme={theme}
                                          />
                                        )}
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                              ))}
                            </View>
                          ))
                        ) : (
                          <AppText variant="bodySmall" color="textMuted" style={styles.centeredText}>
                            Tarjottimelta ei löytynyt kursseja.
                          </AppText>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <StateView message="Kurssitarjottimia ei löytynyt." />
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

function Chevron({ expanded, theme }: { expanded: boolean; theme: Theme }) {
  return (
    <MaterialIcons
      name={expanded ? "expand-less" : "expand-more"}
      size={22}
      color={theme.textMuted}
    />
  );
}

function CodeChip({
  label,
  theme,
  selected,
}: {
  label: string;
  theme: Theme;
  selected?: boolean;
}) {
  return (
    <View
      style={[
        styles.codeChip,
        { backgroundColor: selected ? theme.accent : theme.accentTint },
      ]}
    >
      <AppText
        variant="micro"
        color={selected ? "text" : "accent"}
        style={selected ? styles.codeChipTextSelected : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

function Badge({ label, theme, accent }: { label: string; theme: Theme; accent?: boolean }) {
  return (
    <View
      style={[styles.badge, { backgroundColor: accent ? theme.accentTint : theme.border }]}
    >
      <AppText variant="micro" color={accent ? "accent" : "textMuted"}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 10 },
  flex1: { flex: 1 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  noticeText: { flex: 1 },
  card: { borderRadius: radii.xl, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  cardBody: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, padding: 10 },
  meta: { marginTop: 3 },
  periodBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    minHeight: 38,
    minWidth: 44,
    paddingHorizontal: 8,
  },
  periodBadgeText: { color: "#fff" },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 10,
    padding: 10,
  },
  codeChip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  codeChipTextSelected: { color: "#fff" },
  bar: { gap: 7 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  detailLoader: { marginVertical: 18 },
  detailError: { alignItems: "center", gap: 10, paddingVertical: 8 },
  centeredText: { textAlign: "center" },
  retry: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
});
