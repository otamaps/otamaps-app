import {
  fetchOtaniemiMenu,
  OTANIEMI_MENU_URL,
} from "@/lib/canteenMenu";
import type { CanteenDayMenu } from "@/lib/canteenMenuCore";
import { openExternalUrl } from "@/lib/openExternalUrl";
import {
  CanteenReportError,
  formatElapsedSince,
  formatReportingWindow,
  getCanteenReportingText,
  getQueueColor,
  getQueueLabel,
  QUEUE_LEVEL_COLORS,
  QUEUE_LEVEL_LABELS,
  QueueLevel,
  QueueStatus,
  recordCanteenQueueReport,
} from "@/lib/queueService";
import {
  sheetChrome,
  sheetPalette,
  sheetShadow,
} from "@/components/sheets/sheetTheme";
import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";

type Props = {
  visible: boolean;
  status: QueueStatus | null;
  onClose: () => void;
  onFocusMap: () => void;
  onReported: () => Promise<void>;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DEFAULT_LEVEL: QueueLevel = 3;
const LEVELS: QueueLevel[] = [1, 2, 3, 4, 5];

// Floor plan, seen from above: the canteen door is at the right screen edge and
// the queue runs out of it, around the corner and left past the stairs. How far
// each level reaches along that corridor, as a share of its full length.
const QUEUE_REACH: Record<QueueLevel, number> = {
  1: 0,
  2: 0.32,
  3: 0.55,
  4: 0.78,
  5: 1,
};
const MAP_HEIGHT = 196;
const CORRIDOR_Y = 112;
const STAIR_SEAMS = 7;
const QUEUE_STROKE = 14;
const CORNER_RADIUS = 30;
// Blocks are drawn past the map edge so the corners that fall outside are not
// rounded: only what stays on screen gets a radius.
const EDGE_BLEED = 24;
const COLOR_SHIFT_MS = 300;

// Worklet-friendly copies of the per-level scales.
const LEVEL_STOPS = LEVELS as number[];
const LEVEL_COLORS = LEVELS.map((level) => QUEUE_LEVEL_COLORS[level]);
const LEVEL_REACH = LEVELS.map((level) => QUEUE_REACH[level]);

type MapGeometry = {
  doorX: number;
  cornerX: number;
  stairs: { x: number; y: number; width: number; height: number };
  canteen: { x: number; y: number; width: number; height: number };
  seams: number[];
};

function buildMap(width: number): MapGeometry {
  const doorX = width - 26;
  const cornerX = doorX - CORNER_RADIUS;
  const stairsX = width * 0.17;
  const stairs = {
    x: stairsX,
    y: 10,
    width: Math.max(0, doorX - 44 - stairsX),
    height: 78,
  };
  const canteenX = width * 0.13;
  const step = stairs.width / STAIR_SEAMS;
  return {
    doorX,
    cornerX,
    stairs,
    // Overshoots the right edge; the Rect also overshoots the bottom, leaving
    // the top-left corner as the only rounded one on screen.
    canteen: { x: canteenX, y: 132, width: width - canteenX + EDGE_BLEED, height: 64 },
    seams: Array.from({ length: STAIR_SEAMS - 1 }, (_, i) => stairs.x + step * (i + 1)),
  };
}

// Runs in off the top of the map, turns the corner and heads left along the
// corridor. Shared with the worklet that animates it, hence the bare string.
function queuePath(map: MapGeometry, headX: number): string {
  "worklet";
  return (
    `M${map.doorX},${-QUEUE_STROKE} ` +
    `L${map.doorX},${CORRIDOR_Y - CORNER_RADIUS} ` +
    `Q${map.doorX},${CORRIDOR_Y} ${map.cornerX},${CORRIDOR_Y} ` +
    `L${headX},${CORRIDOR_Y}`
  );
}

function sourceText(status: QueueStatus): string {
  // The age and the warning live in the stale note right below this line.
  if (status.status_is_stale) {
    return status.status_source === "manual"
      ? "Henkilökunnan vahvistama arvio"
      : status.status_source === "community"
        ? "Käyttäjien raportti"
        : "Automaattinen liikehavainto";
  }
  if (status.status_source === "community") {
    return `${status.contributor_count} käyttäjän raportti tässä jaksossa`;
  }
  if (status.status_source === "manual") return "Henkilökunnan vahvistama arvio";
  if (status.status_source === "crowd") return "Automaattinen liikehavainto";
  if (status.report_count > 0) {
    return `Tarvitaan vähintään ${status.min_community_reports} raporttia tässä jaksossa (${status.report_count} annettu)`;
  }
  return `Tälle ${status.slot_minutes} minuutin jaksolle ei ole vielä raportteja`;
}

// get_queue_statuses falls back to the last known reading once every source has
// gone stale (migration 20260824120000), so the panel keeps showing a level from
// an earlier slot. Say so out loud rather than passing it off as current.
function staleNoteText(status: QueueStatus): string {
  const elapsed = formatElapsedSince(status.status_observed_at);
  const age = elapsed ? ` (${elapsed})` : "";
  return `Edellisen ${status.slot_minutes} minuutin jakson tieto${age}. Tilanne on voinut jo muuttua.`;
}

// The database tags every rejection with a stable marker, so the user-facing
// copy no longer depends on matching words inside the Postgres error text.
function reportErrorText(error: unknown, status: QueueStatus | null): string {
  if (error instanceof CanteenReportError) {
    switch (error.reason) {
      case "reporting_closed":
        return `Raportointi on avoinna ${formatReportingWindow(status, {
          withClock: true,
        })}.`;
      case "auth_required":
        return "Kirjaudu sisään raportoidaksesi jonotilanteen.";
      case "invalid_level":
        return "Valittu jonotaso ei kelpaa. Yritä uudelleen.";
      case "unknown_area":
        return "Ruokalinjaston raportointi ei ole juuri nyt käytössä.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Raportointi epäonnistui.";
}

export default function CanteenStatusModal({
  visible,
  status,
  onClose,
  onFocusMap,
  onReported,
}: Props) {
  const isDark = useColorScheme() === "dark";
  const sheetRef = useRef<BottomSheetModal>(null);
  const [menu, setMenu] = useState<CanteenDayMenu | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [reportingLevel, setReportingLevel] = useState<QueueLevel | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<QueueLevel>(DEFAULT_LEVEL);
  const [mapWidth, setMapWidth] = useState(0);

  const snapPoints = useMemo(() => ["70%", "94%"], []);

  // The caller still owns visibility as a plain boolean, so the sheet is driven
  // from it rather than through an imperative handle like the other sheets.
  //
  // `dismiss()` must never run before a `present()`: on a modal that has never
  // been presented there is no inner sheet to force-close, so gorhom's status
  // latches at DISMISSING and its portal render is skipped from then on — the
  // sheet would silently never open again.
  const presented = useRef(false);
  useEffect(() => {
    if (visible) {
      presented.current = true;
      sheetRef.current?.present();
    } else if (presented.current) {
      presented.current = false;
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setSelectedLevel(status?.status_level ?? DEFAULT_LEVEL);
    // Only on open: a refreshed status must not move the slider under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setMenuLoading(true);
    setMenuError(false);
    void fetchOtaniemiMenu()
      .then((nextMenu) => {
        if (!cancelled) setMenu(nextMenu);
      })
      .catch(() => {
        if (!cancelled) {
          setMenu(null);
          setMenuError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const submitLevel = async (level: QueueLevel) => {
    if (reportingLevel || !status?.reporting_open) return;
    setReportingLevel(level);
    try {
      await recordCanteenQueueReport(level, status);
      await onReported();
    } catch (error) {
      Alert.alert("Raporttia ei voitu tallentaa", reportErrorText(error, status));
    } finally {
      setReportingLevel(null);
    }
  };

  const statusLevel = status?.reporting_open ? status.status_level : null;
  const reportingOpen = !!status?.reporting_open;
  const map = useMemo(() => (mapWidth > 0 ? buildMap(mapWidth) : null), [mapWidth]);

  // The queue is one solid color at a time; only the move between two levels is
  // eased, so the color slides through the scale instead of snapping.
  const levelProgress = useSharedValue<number>(DEFAULT_LEVEL);
  useEffect(() => {
    levelProgress.value = withTiming(selectedLevel, { duration: COLOR_SHIFT_MS });
  }, [levelProgress, selectedLevel]);

  const queueProps = useAnimatedProps(() => {
    const reach = interpolate(levelProgress.value, LEVEL_STOPS, LEVEL_REACH);
    return {
      d: map ? queuePath(map, map.cornerX * (1 - reach)) : "",
      stroke: interpolateColor(levelProgress.value, LEVEL_STOPS, LEVEL_COLORS),
    };
  });

  const levelColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(levelProgress.value, LEVEL_STOPS, LEVEL_COLORS),
  }));

  const { card, text: primaryText, textSecondary: secondaryText, accent } =
    sheetPalette(isDark);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      // The queue slider is a native horizontal control inside the sheet. Without
      // these the sheet's content pan is omnidirectional and swallows the drag,
      // so the thumb never moves.
      activeOffsetY={[-10, 10]}
      failOffsetX={[-15, 15]}
      onDismiss={() => {
        presented.current = false;
        onClose();
      }}
      style={sheetShadow}
      {...sheetChrome(isDark)}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={[styles.eyebrow, { color: accent }]}>OTANIEMEN LUKIO</Text>
            <Text style={[styles.sheetTitle, { color: primaryText }]}>Ruokalinjasto</Text>
          </View>
          <Pressable
            accessibilityLabel="Sulje ruokalinjaston tiedot"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: card },
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="close" size={22} color={primaryText} />
          </Pressable>
        </View>

        <View style={[styles.heroCard, { backgroundColor: card }]}>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusIcon, { backgroundColor: getQueueColor(statusLevel) }]}
            >
              <MaterialIcons name="groups" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.statusText}>
              <Text style={[styles.statusLabel, { color: secondaryText }]}>
                Tämänhetkinen vilkkaus
              </Text>
              <Text style={[styles.statusValue, { color: primaryText }]}>
                {status?.reporting_open
                  ? getQueueLabel(status.status_level)
                  : "Ei näytetä juuri nyt"}
              </Text>
            </View>
          </View>
          <Text style={[styles.supportingText, { color: secondaryText }]}>
            {status?.reporting_open
              ? sourceText(status)
              : `Vilkkaus näytetään ja sitä voi raportoida ${formatReportingWindow(
                  status,
                  { withClock: true }
                )}.`}
          </Text>
          {status?.reporting_open && status.status_is_stale && status.status_level != null ? (
            <View
              style={[
                styles.staleNote,
                { backgroundColor: isDark ? "#3A3223" : "#FDF3DC" },
              ]}
            >
              <MaterialIcons name="history" size={17} color="#B07A16" />
              <Text
                style={[
                  styles.staleNoteText,
                  { color: isDark ? "#E6C878" : "#7A5A12" },
                ]}
              >
                {staleNoteText(status)}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => {
              onFocusMap();
              onClose();
            }}
            style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="map" size={19} color={accent} />
            <Text style={[styles.mapButtonText, { color: accent }]}>Näytä kartalla</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>
            Raportoi jonon pituus
          </Text>
          <Text style={[styles.sectionCaption, { color: secondaryText }]}>
            {getCanteenReportingText(status)}
          </Text>
        </View>

        <View style={styles.reportValueRow}>
          <Animated.View style={[styles.levelDot, levelColorStyle]} />
          <Text style={[styles.reportValue, { color: primaryText }]}>
            {QUEUE_LEVEL_LABELS[selectedLevel]}
          </Text>
        </View>

        <View
          style={styles.mapBleed}
          onLayout={(event) => setMapWidth(event.nativeEvent.layout.width)}
        >
          {map ? (
            <>
              <Svg width={mapWidth} height={MAP_HEIGHT}>
                <Rect
                  x={map.canteen.x}
                  y={map.canteen.y}
                  width={map.canteen.width}
                  height={map.canteen.height + EDGE_BLEED}
                  rx={16}
                  fill={isDark ? "#33363B" : "#DEE1E5"}
                />
                <Rect
                  x={map.stairs.x}
                  y={map.stairs.y}
                  width={map.stairs.width}
                  height={map.stairs.height}
                  rx={12}
                  fill={isDark ? "#6E4630" : "#E9C59D"}
                />
                {map.seams.map((seam) => (
                  <Line
                    key={seam}
                    x1={seam}
                    y1={map.stairs.y}
                    x2={seam}
                    y2={map.stairs.y + map.stairs.height}
                    stroke={isDark ? "#57361F" : "#D2A878"}
                    strokeWidth={2}
                  />
                ))}

                <Path
                  d={queuePath(map, 0)}
                  fill="none"
                  stroke={isDark ? "#31343A" : "#EDEFF2"}
                  strokeWidth={QUEUE_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <AnimatedPath
                  animatedProps={queueProps}
                  fill="none"
                  strokeWidth={QUEUE_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>

              <View
                pointerEvents="none"
                style={[
                  styles.mapLabelBox,
                  {
                    left: map.stairs.x,
                    top: map.stairs.y,
                    width: map.stairs.width,
                    height: map.stairs.height,
                  },
                ]}
              >
                <Text
                  style={[styles.mapLabel, { color: isDark ? "#E9C59D" : "#8A5A3B" }]}
                >
                  PORTAAT
                </Text>
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.mapLabelBox,
                  {
                    left: map.canteen.x,
                    top: map.canteen.y,
                    width: mapWidth - map.canteen.x,
                    height: map.canteen.height,
                  },
                ]}
              >
                <Text
                  style={[styles.mapLabel, { color: isDark ? "#A8AEB7" : "#8A9099" }]}
                >
                  PIAZZA
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.sliderZone}>
          <LinearGradient
            pointerEvents="none"
            colors={[
              QUEUE_LEVEL_COLORS[5],
              QUEUE_LEVEL_COLORS[4],
              QUEUE_LEVEL_COLORS[3],
              QUEUE_LEVEL_COLORS[2],
              QUEUE_LEVEL_COLORS[1],
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.sliderTrack, !reportingOpen && styles.disabled]}
          />
          <Slider
            accessibilityLabel="Jonon pituus"
            accessibilityValue={{
              min: 1,
              max: 5,
              now: selectedLevel,
              text: QUEUE_LEVEL_LABELS[selectedLevel],
            }}
            inverted
            disabled={!reportingOpen || reportingLevel !== null}
            minimumValue={1}
            maximumValue={5}
            step={1}
            value={selectedLevel}
            onValueChange={(value) => setSelectedLevel(Math.round(value) as QueueLevel)}
            minimumTrackTintColor="transparent"
            maximumTrackTintColor="transparent"
            thumbTintColor={QUEUE_LEVEL_COLORS[selectedLevel]}
            style={[styles.slider, !reportingOpen && styles.disabled]}
          />
        </View>
        <View style={styles.sliderScale}>
          <Text style={[styles.sliderScaleText, { color: secondaryText }]}>
            {QUEUE_LEVEL_LABELS[5]}
          </Text>
          <Text style={[styles.sliderScaleText, { color: secondaryText }]}>
            {QUEUE_LEVEL_LABELS[1]}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!reportingOpen || reportingLevel !== null}
          onPress={() => void submitLevel(selectedLevel)}
          style={({ pressed }) => [
            styles.submitButton,
            (!reportingOpen || reportingLevel !== null) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Animated.View style={[styles.submitFill, levelColorStyle]} />
          {reportingLevel !== null ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Lähetä raportti</Text>
          )}
        </Pressable>

        <View style={[styles.contributionCard, { backgroundColor: card }]}>
          <MaterialIcons name="volunteer-activism" size={24} color={accent} />
          <View style={styles.contributionText}>
            <Text style={[styles.contributionValue, { color: primaryText }]}>
              {status?.current_user_contributions ?? 0} raporttia
            </Text>
            <Text style={[styles.sectionCaption, { color: secondaryText }]}>
              Sinun panoksesi yhteensä. Raportit tallennetaan tilillesi, ja mitä enemmän raportoit, sitä enemmän raporttisi painaa yhteisön arviossa.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>
            Päivän ruokalista
          </Text>
          <Text style={[styles.sectionCaption, { color: secondaryText }]}>
            Compass Group · Espoon Tietokylä / Otaniemen lukio
          </Text>
        </View>

        {menuLoading ? (
          <View style={[styles.menuState, { backgroundColor: card }]}>
            <ActivityIndicator color={accent} />
            <Text style={[styles.sectionCaption, { color: secondaryText }]}>
              Haetaan tämän päivän ruokia…
            </Text>
          </View>
        ) : menu?.sections.length ? (
          <View style={styles.menuSections}>
            {menu.sections.map((section) => (
              <View key={section.title} style={[styles.menuCard, { backgroundColor: card }]}>
                <Text style={[styles.menuTitle, { color: primaryText }]}>
                  {section.title}
                </Text>
                {section.meals.map((meal, index) => (
                  <View key={`${meal.name}-${index}`} style={styles.mealRow}>
                    <View style={[styles.mealBullet, { backgroundColor: accent }]} />
                    <View style={styles.mealText}>
                      <Text style={[styles.mealName, { color: primaryText }]}>
                        {meal.name}
                      </Text>
                      {!!meal.diets.length && (
                        <Text style={[styles.diets, { color: secondaryText }]}>
                          {meal.diets.join(", ")}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.menuState, { backgroundColor: card }]}>
            <MaterialIcons name="restaurant-menu" size={24} color={secondaryText} />
            <Text style={[styles.sectionCaption, { color: secondaryText }]}>
              {menuError
                ? "Ruokalistaa ei saatu ladattua juuri nyt."
                : "Otaniemen lukion ruokalistaa ei ole julkaistu tälle päivälle."}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => void openExternalUrl(OTANIEMI_MENU_URL)}
          style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed]}
        >
          <Text style={[styles.sourceButtonText, { color: accent }]}>
            Avaa alkuperäinen ruokalista
          </Text>
          <MaterialIcons name="open-in-new" size={18} color={accent} />
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 56 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  eyebrow: { fontSize: 11, fontFamily: "Figtree-Bold", letterSpacing: 1.2, marginBottom: 2 },
  sheetTitle: { fontSize: 25, fontFamily: "Figtree-Bold", letterSpacing: -0.5 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 24, padding: 18 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  statusIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statusText: { flex: 1 },
  statusLabel: { fontFamily: "Figtree-Regular", fontSize: 13 },
  statusValue: { fontFamily: "Figtree-Bold", fontSize: 22, marginTop: 2 },
  supportingText: { fontFamily: "Figtree-Regular", fontSize: 14, lineHeight: 20, marginTop: 14 },
  staleNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 14, padding: 11, marginTop: 13 },
  staleNoteText: { flex: 1, fontFamily: "Figtree-Medium", fontSize: 13, lineHeight: 18 },
  mapButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, minHeight: 38 },
  mapButtonText: { fontFamily: "Figtree-SemiBold", fontSize: 14 },
  section: { marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Figtree-Bold" },
  sectionCaption: { fontFamily: "Figtree-Regular", fontSize: 13, lineHeight: 19, marginTop: 3 },
  reportValueRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  reportValue: { fontFamily: "Figtree-Bold", fontSize: 20 },
  levelDot: { width: 12, height: 12, borderRadius: 6 },
  // Pulled out of the scroll view's padding so the longest queue hits the edge.
  mapBleed: { marginHorizontal: -20, marginTop: 12, height: MAP_HEIGHT, overflow: "hidden" },
  mapLabelBox: { position: "absolute", alignItems: "center", justifyContent: "center" },
  mapLabel: { fontFamily: "Figtree-SemiBold", fontSize: 12, letterSpacing: 1.4 },
  sliderZone: { marginTop: 14, justifyContent: "center" },
  // Sits behind the slider, whose own tracks are transparent, so the scale reads
  // as one continuous shift from green at the canteen to red at the far end.
  sliderTrack: { position: "absolute", left: 2, right: 2, height: 6, borderRadius: 3 },
  slider: { width: "100%", height: 40 },
  sliderScale: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  sliderScaleText: { fontFamily: "Figtree-Regular", fontSize: 12 },
  submitButton: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 18, overflow: "hidden" },
  submitFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  submitButtonText: { color: "#FFFFFF", fontFamily: "Figtree-Bold", fontSize: 15 },
  contributionCard: { flexDirection: "row", gap: 12, borderRadius: 20, padding: 16, marginTop: 16 },
  contributionText: { flex: 1 },
  contributionValue: { fontFamily: "Figtree-Bold", fontSize: 16 },
  menuState: { minHeight: 90, borderRadius: 20, padding: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  menuSections: { gap: 12 },
  menuCard: { borderRadius: 20, padding: 16 },
  menuTitle: { fontFamily: "Figtree-Bold", fontSize: 16, marginBottom: 8 },
  mealRow: { flexDirection: "row", paddingVertical: 6, gap: 10 },
  mealBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  mealText: { flex: 1 },
  mealName: { fontFamily: "Figtree-Medium", fontSize: 14, lineHeight: 19 },
  diets: { fontFamily: "Figtree-Regular", fontSize: 12, marginTop: 2 },
  sourceButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 },
  sourceButtonText: { fontFamily: "Figtree-SemiBold", fontSize: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
