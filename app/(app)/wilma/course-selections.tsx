import {
  AppText,
  Row,
  RowIcon,
  SegmentedControl,
  StateView,
  Surface,
  useNativeHeader,
  useTheme,
  type Theme,
  useSelectorSwipe,
} from "@/components/ui";
import { GestureDetector } from "react-native-gesture-handler";
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
  groupCoursesByPeriodParts,
  isOtherSchoolTray,
} from "@/lib/wilma/courseSelectionGrouping";
import { scopeBarIn, SearchScopeBar } from "@/modules/search-scope-bar";
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
  const [trayDetails, setTrayDetails] = useState<
    Record<string, WilmaCourseTrayDetail>
  >({});
  const [trayDetailLoading, setTrayDetailLoading] = useState<string | null>(
    null,
  );
  const [trayDetailError, setTrayDetailError] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showOtherSchools, setShowOtherSchools] = useState(false);
  const needle = query.trim().toLocaleLowerCase("fi-FI");
  const selectedGroups = useMemo(() => {
    const shown = needle
      ? selected.filter((course) =>
          [course.groupCode, course.tray].some((field) =>
            field.toLocaleLowerCase("fi-FI").includes(needle),
          ),
        )
      : selected;
    return groupCoursesByPeriodParts(shown);
  }, [selected, needle]);
  const shownTrays = useMemo(
    () =>
      needle
        ? trays.filter((tray) =>
            [tray.name, tray.category].some((field) =>
              field.toLocaleLowerCase("fi-FI").includes(needle),
            ),
          )
        : trays,
    [trays, needle],
  );
  // B parts start hidden; a period's key is here once its B part is opened.
  const [shownB, setShownB] = useState<Record<string, boolean>>({});

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
      setError(
        cause instanceof Error
          ? cause.message
          : "Kurssivalintojen lataaminen epäonnistui.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

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
          "Kurssitarjotin ei ole enää saatavilla. Päivitä näkymä ja yritä uudelleen.",
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
        [targetId]:
          cause instanceof Error
            ? cause.message
            : "Kurssitarjottimen sisältöä ei voitu ladata.",
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

  // A large title, with the list as the screen's root so UIKit can collapse
  // it — and give the bar the soft scroll edge only large titles get.
  // …and the search field under the title, with the selector in the bar as
  // its scope bar, as the teachers page.
  const header = useNativeHeader({
    // Back by swiping only from the first option; elsewhere a sideways swipe
    // changes the option.
    swipeBack: tab === TABS[0][0],
    title: "Kurssivalinnat",
    background: "page",
    searchPlaceholder: "Hae kurssikoodilla tai nimellä",
    onSearch: setQuery,
  });
  const scopeInBar = scopeBarIn(header);
  const swipe = useSelectorSwipe(TABS, tab, setTab);

  // Other schools' trays wait behind a disclosure, opened by default only
  // while searching, so a match there is never hidden.
  const ownTrays = shownTrays.filter((tray) => !isOtherSchoolTray(tray));
  const otherTrays = shownTrays.filter(isOtherSchoolTray);
  const othersShown = showOtherSchools || !!needle;

  const renderTray = (tray: WilmaCourseTray) => {
    const expanded = expandedTrayId === tray.id;
    const detail = trayDetails[tray.id];
    return (
      <Surface key={tray.id} style={styles.group}>
        <Row onPress={() => void toggleTray(tray)} chevron={false}>
          <RowIcon
            ios={tray.closed ? "lock.fill" : "square.grid.2x2.fill"}
            android={tray.closed ? "lock" : "view_week"}
            color={tray.closed ? theme.textFaint : theme.accent}
          />
          <View style={styles.flex1}>
            <AppText variant="body">{tray.name}</AppText>
            <AppText variant="meta" color="textMuted" style={styles.meta}>
              {tray.category} · {tray.status}
            </AppText>
          </View>
          <PlatformSymbol
            ios={expanded ? "chevron.up" : "chevron.down"}
            android={expanded ? "expand_less" : "expand_more"}
            size={13}
            weight="semibold"
            tintColor={theme.textFaint}
          />
        </Row>
        {expanded
          ? trayDetailLoading === tray.id
            ? [
                <View key="loading" style={styles.detailState}>
                  <ActivityIndicator color={theme.accent} />
                </View>,
              ]
            : trayDetailError[tray.id]
              ? [
                  <View key="error" style={styles.detailState}>
                    <AppText
                      variant="bodySmall"
                      color="textMuted"
                      style={styles.centeredText}
                    >
                      {trayDetailError[tray.id]}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => void loadTrayDetail(tray)}
                    >
                      <AppText variant="body" color="accent">
                        Yritä uudelleen
                      </AppText>
                    </Pressable>
                  </View>,
                ]
              : detail?.bars.length
                ? detail.bars.flatMap((bar, barIndex) => [
                    <AppText
                      key={`${tray.id}-bar-${barIndex}`}
                      variant="micro"
                      color="textMuted"
                      style={styles.barHeading}
                    >
                      {bar.name.toLocaleUpperCase("fi-FI")}
                    </AppText>,
                    ...bar.courses.map((course) => (
                      <Row
                        key={course.id}
                        chevron={false}
                        style={styles.courseRow}
                      >
                        <CodeChip
                          label={course.code}
                          theme={theme}
                          selected={course.selected}
                        />
                        <View style={styles.flex1}>
                          <AppText variant="body">{course.name}</AppText>
                          {!!course.teacher && (
                            <AppText
                              variant="meta"
                              color="textMuted"
                              style={styles.meta}
                            >
                              {course.teacher}
                            </AppText>
                          )}
                          {course.selected ||
                          course.locked ||
                          course.full ||
                          course.completed ? (
                            <View style={styles.badges}>
                              {course.selected && (
                                <Badge label="Valittu" accent theme={theme} />
                              )}
                              {course.locked && (
                                <Badge label="Lukittu" theme={theme} />
                              )}
                              {course.full && (
                                <Badge label="Täynnä" theme={theme} />
                              )}
                              {course.completed && (
                                <Badge
                                  label={`Suoritettu${course.grade ? ` · ${course.grade}` : ""}`}
                                  theme={theme}
                                />
                              )}
                            </View>
                          ) : null}
                        </View>
                      </Row>
                    )),
                  ])
                : [
                    <AppText
                      key="empty"
                      variant="bodySmall"
                      color="textMuted"
                      style={[styles.centeredText, styles.detailState]}
                    >
                      Tarjottimelta ei löytynyt kursseja.
                    </AppText>,
                  ]
          : null}
      </Surface>
    );
  };

  return (
    <>
      <Stack.Screen options={header} />
      <GestureDetector gesture={swipe}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
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
        {scopeInBar ? null : (
          <SegmentedControl value={tab} onChange={setTab} options={TABS} />
        )}
        {/* A footnote, not a banner: it qualifies the page, it isn't news. */}
        <View style={styles.readOnly}>
          <PlatformSymbol
            ios="lock.fill"
            android="lock"
            size={11}
            tintColor={theme.textMuted}
          />
          <AppText variant="meta" color="textMuted" style={styles.flex1}>
            Vain luku -tila. Kurssivalintoja ei muuteta.
          </AppText>
        </View>

        {loading ? (
          <StateView loading />
        ) : error ? (
          <StateView
            icon="error-outline"
            message={error}
            actionLabel="Yritä uudelleen"
            onAction={() => void load()}
          />
        ) : tab === "SELECTED" ? (
          selectedGroups.length ? (
            selectedGroups.map((group) => {
              const bShown = shownB[group.key] ?? false;
              return (
                <Surface
                  key={group.key}
                  title={
                    /^\d+$/.test(group.label)
                      ? `Jakso ${group.label}`
                      : group.label
                  }
                  style={styles.group}
                >
                  {group.a.map((course) => (
                    <SelectedCourseRow
                      key={courseKey(course)}
                      course={course}
                      theme={theme}
                    />
                  ))}
                  {/* The B part waits behind a row of its own, as a
                      disclosure: the A part is what's on now. */}
                  {group.b.length ? (
                    <Row
                      onPress={() =>
                        setShownB((current) => ({
                          ...current,
                          [group.key]: !bShown,
                        }))
                      }
                      chevron={false}
                      accessibilityLabel={`${bShown ? "Piilota" : "Näytä"} B-osa`}
                    >
                      <AppText
                        variant="meta"
                        color="textMuted"
                        style={styles.flex1}
                      >
                        B-osa · {group.b.length}{" "}
                        {group.b.length === 1 ? "valinta" : "valintaa"}
                      </AppText>
                      <PlatformSymbol
                        ios={bShown ? "chevron.up" : "chevron.down"}
                        android={bShown ? "expand_less" : "expand_more"}
                        size={11}
                        weight="semibold"
                        tintColor={theme.textFaint}
                      />
                    </Row>
                  ) : null}
                  {bShown
                    ? group.b.map((course) => (
                        <SelectedCourseRow
                          key={courseKey(course)}
                          course={course}
                          theme={theme}
                          secondary
                        />
                      ))
                    : null}
                </Surface>
              );
            })
          ) : (
            <StateView
              icon={needle ? "search-off" : "inbox"}
              message={
                needle
                  ? `Ei tuloksia haulle ”${query.trim()}”.`
                  : "Valittuja kursseja ei löytynyt."
              }
            />
          )
        ) : shownTrays.length ? (
          <>
            {ownTrays.map(renderTray)}
            {/* Other schools' trays, tucked behind one quiet row: they are
                listed by Wilma but rarely what the student is looking for. */}
            {otherTrays.length ? (
              <Surface style={styles.group}>
                <Row
                  onPress={() => setShowOtherSchools((shown) => !shown)}
                  chevron={false}
                  accessibilityLabel={`${othersShown ? "Piilota" : "Näytä"} muiden koulujen tarjottimet`}
                >
                  <AppText
                    variant="meta"
                    color="textMuted"
                    style={styles.flex1}
                  >
                    Muiden koulujen tarjottimet · {otherTrays.length}
                  </AppText>
                  <PlatformSymbol
                    ios={othersShown ? "chevron.up" : "chevron.down"}
                    android={othersShown ? "expand_less" : "expand_more"}
                    size={11}
                    weight="semibold"
                    tintColor={theme.textFaint}
                  />
                </Row>
              </Surface>
            ) : null}
            {othersShown ? otherTrays.map(renderTray) : null}
          </>
        ) : (
          <StateView
            icon={needle ? "search-off" : "inbox"}
            message={
              needle
                ? `Ei tuloksia haulle ”${query.trim()}”.`
                : "Kurssitarjottimia ei löytynyt."
            }
          />
        )}
      </ScrollView>
      </GestureDetector>
      {/* After the list, not before: UIKit attaches the large title, search
          field and scroll-edge effect to the first scroll view in the
          screen, and this view draws nothing but would be first. */}
      {scopeInBar ? (
        <SearchScopeBar value={tab} onChange={setTab} options={TABS} />
      ) : null}
    </>
  );
}

function courseKey(course: WilmaSelectedCourse): string {
  return `${course.tray}-${course.period}-${course.groupCode}`;
}

/**
 * One of the student's own courses, led by its bar ("palkki") — the slot in
 * the timetable it takes — then its course code, with the tray's name below.
 */
function SelectedCourseRow({
  course,
  theme,
  secondary,
}: {
  course: WilmaSelectedCourse;
  theme: Theme;
  /** A B-part course: grey and quieter, behind the A part it follows. */
  secondary?: boolean;
}) {
  return (
    <Row chevron={false}>
      <CodeChip label={course.bar || "–"} theme={theme} muted={secondary} />
      <View style={styles.flex1}>
        <AppText
          variant="body"
          color={secondary ? "textSecondary" : "text"}
          numberOfLines={1}
        >
          {course.groupCode}
        </AppText>
        <AppText
          variant="meta"
          color="textMuted"
          style={styles.meta}
          numberOfLines={2}
        >
          {course.tray}
        </AppText>
      </View>
    </Row>
  );
}

/** A course code as a capsule; filled when it is one of the student's own. */
function CodeChip({
  label,
  theme,
  selected,
  muted,
}: {
  label: string;
  theme: Theme;
  selected?: boolean;
  /** Grey instead of the accent, for something secondary. */
  muted?: boolean;
}) {
  return (
    <View
      style={[
        styles.codeChip,
        {
          backgroundColor: selected
            ? theme.accent
            : muted
              ? theme.border
              : theme.accentTint,
        },
      ]}
    >
      <AppText
        variant="micro"
        color={muted ? "textMuted" : "accent"}
        style={selected ? styles.codeChipTextSelected : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

function Badge({
  label,
  theme,
  accent,
}: {
  label: string;
  theme: Theme;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: accent ? theme.accentTint : theme.border },
      ]}
    >
      <AppText variant="micro" color={accent ? "accent" : "textMuted"}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 40 },
  flex1: { flex: 1 },
  readOnly: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 2,
  },
  group: { borderRadius: radii.xl },
  meta: { marginTop: 2 },
  // A bar's name inside its tray's group, as a small sub-heading.
  barHeading: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  courseRow: { alignItems: "flex-start" },
  codeChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 1,
  },
  codeChipTextSelected: { color: "#fff" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2 },
  detailState: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  centeredText: { textAlign: "center" },
});
