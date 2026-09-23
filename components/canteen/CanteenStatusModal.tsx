import {
  sheetChrome,
  sheetPalette,
  sheetShadow,
} from "@/components/sheets/sheetTheme";
import { fetchOtaniemiMenu, OTANIEMI_MENU_URL } from "@/lib/canteenMenu";
import type { CanteenDayMenu } from "@/lib/canteenMenuCore";
import { openExternalUrl } from "@/lib/openExternalUrl";
import {
  CanteenReportError,
  formatElapsedSince,
  formatReportingWindow,
  getCanteenReportingText,
  getQueueColor,
  QUEUE_LEVEL_COLORS,
  QUEUE_LEVEL_LABELS,
  QueueLevel,
  queueLevelFromValue,
  QueueStatus,
  recordCanteenQueueReport,
} from "@/lib/queueService";
import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Easing,
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
  onReported: () => Promise<void>;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Queue length runs from 0 (no queue) to 1 (longest); this is the middle. */
const DEFAULT_VALUE = 0.5;
const LEVELS: QueueLevel[] = [1, 2, 3, 4, 5];

// Floor plan, seen from above: the canteen door is at the right screen edge and
// the queue runs out of it, around the corner and left past the stairs. How far
// each named level reaches along that corridor, as a share of its full length;
// values in between are interpolated.
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
// The queue is an arrow pointing the way people move: in along the corridor,
// round the corner and up into the canteen door. The head is drawn as its own
// triangle at the top of the right-hand run, where the door is — the tip never
// moves, only the tail does.
const ARROW_TIP_Y = 6;
const ARROW_BASE_Y = 24;
const ARROW_HALF_WIDTH = 13;
// Blocks are drawn past the map edge so the corners that fall outside are not
// rounded: only what stays on screen gets a radius.
const EDGE_BLEED = 24;
// How long the queue takes to settle on a new reading: when the sheet opens,
// and when a refreshed status arrives while it is open.
const SETTLE_TIMING = {
  duration: 550,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// Worklet-friendly copies of the per-level scales, placed on the 0-1 value
// axis: level 1 sits at 0, level 5 at 1.
const LEVEL_STOPS = LEVELS.map((level) => (level - 1) / 4);
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
    canteen: {
      x: canteenX,
      y: 132,
      width: width - canteenX + EDGE_BLEED,
      height: 64,
    },
    seams: Array.from(
      { length: STAIR_SEAMS - 1 },
      (_, i) => stairs.x + step * (i + 1),
    ),
  };
}

// The arrow's shaft: down from under the head, round the corner and out left
// along the corridor. Shared with the worklet that animates it, hence the bare
// string. It stops at the head's base, whose triangle hides the round cap.
function queuePath(map: MapGeometry, headX: number): string {
  "worklet";
  return (
    `M${map.doorX},${ARROW_BASE_Y} ` +
    `L${map.doorX},${CORRIDOR_Y - CORNER_RADIUS} ` +
    `Q${map.doorX},${CORRIDOR_Y} ${map.cornerX},${CORRIDOR_Y} ` +
    `L${headX},${CORRIDOR_Y}`
  );
}

/** The arrow's head, pointing up into the canteen door. */
function arrowHeadPath(map: MapGeometry): string {
  return (
    `M${map.doorX - ARROW_HALF_WIDTH},${ARROW_BASE_Y} ` +
    `L${map.doorX},${ARROW_TIP_Y} ` +
    `L${map.doorX + ARROW_HALF_WIDTH},${ARROW_BASE_Y} Z`
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
  if (status.status_source === "manual")
    return "Henkilökunnan vahvistama arvio";
  if (status.status_source === "crowd") return "Automaattinen liikehavainto";
  if (status.report_count > 0) {
    return `Tarvitaan vähintään ${status.min_community_reports} raporttia tässä jaksossa (${status.report_count} annettu)`;
  }
  return `Tälle ${status.slot_minutes} minuutin jaksolle ei ole vielä raportteja`;
}

// get_queue_statuses falls back to the most recent reading from earlier the
// same day once the current slot has none (migrations 20260824120000 and
// 20260918120000), so the panel keeps showing a level rather than going blank.
// Say so out loud rather than passing it off as current — and do not name it
// "the previous slot", because it can be several slots back; the elapsed time
// is what actually tells the reader how much to trust it.
function staleNoteText(status: QueueStatus): string {
  const elapsed = formatElapsedSince(status.status_observed_at);
  const age = elapsed ? ` (${elapsed})` : "";
  return `Päivän viimeisin tieto${age}. Tilanne on voinut jo muuttua.`;
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
  onReported,
}: Props) {
  const isDark = useColorScheme() === "dark";
  const sheetRef = useRef<BottomSheetModal>(null);
  const [menu, setMenu] = useState<CanteenDayMenu | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [reportingValue, setReportingValue] = useState<number | null>(null);
  /**
   * Where the slider sits, 0-1. A ref rather than state: dragging fires many
   * events a second, and re-rendering the whole sheet on each one is what makes
   * the queue on the map stutter. React only hears about it when the nearest
   * named level changes.
   */
  const selectedValue = useRef<number>(DEFAULT_VALUE);
  const [selectedLevel, setSelectedLevel] = useState<QueueLevel>(
    queueLevelFromValue(DEFAULT_VALUE),
  );
  /**
   * The slider's controlled value, only set when a reading is loaded into it.
   * Feeding every drag event back in as `value` would make the native thumb
   * fight the finger.
   */
  const [sliderStart, setSliderStart] = useState<number>(DEFAULT_VALUE);
  /**
   * Remounts the slider each time the sheet opens. If the thumb was dragged and
   * the sheet closed without a report, reopening onto the same reading leaves
   * `value` unchanged, and the native thumb would stay where it was left.
   */
  const [sliderMount, setSliderMount] = useState(0);
  // Drives the map and the level colours on the UI thread. It follows the
  // finger exactly while dragging and eases whenever a new reading arrives, so
  // the queue grows and shrinks instead of jumping.
  const queueProgress = useSharedValue<number>(DEFAULT_VALUE);
  /** Whether the slider has been moved since the sheet opened or last report. */
  const [adjusted, setAdjusted] = useState(false);
  /**
   * The value this device last reported, and for which slot. The status only
   * says *that* the viewer reported, not what, so without this the slider would
   * reopen on the community level instead of the user's own report.
   */
  const [ownReport, setOwnReport] = useState<{
    slot: string | null;
    value: number;
  } | null>(null);
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

  /** Loads a reading into the slider and eases the map onto it. */
  const settleOn = (value: number) => {
    selectedValue.current = value;
    setSelectedLevel(queueLevelFromValue(value));
    setSliderStart(value);
    queueProgress.value = withTiming(value, SETTLE_TIMING);
  };

  const ownValueThisSlot =
    status?.current_user_reported &&
    ownReport?.slot === status.current_slot_start
      ? ownReport.value
      : null;

  useEffect(() => {
    if (!visible) return;
    settleOn(ownValueThisSlot ?? status?.status_value ?? DEFAULT_VALUE);
    setSliderMount((mount) => mount + 1);
    setAdjusted(false);
    // Only on open; refreshes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A refreshed status moves the queue too, but only while the slider still
  // shows the community reading. Once the user has moved it, or it is showing
  // their own report, it is theirs and must not move under them.
  const statusValue = status?.status_value ?? null;
  useEffect(() => {
    if (!visible || adjusted || ownValueThisSlot != null) return;
    if (statusValue == null) return;
    if (Math.abs(statusValue - selectedValue.current) < 0.001) return;
    settleOn(statusValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusValue]);

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

  const submitValue = async (value: number) => {
    if (reportingValue !== null || !status?.reporting_open) return;
    setReportingValue(value);
    try {
      await recordCanteenQueueReport(value, status);
      setOwnReport({ slot: status.current_slot_start, value });
      await onReported();
      // The slider now shows the report itself, so there is nothing to send
      // until it moves again.
      setAdjusted(false);
    } catch (error) {
      Alert.alert(
        "Raporttia ei voitu tallentaa",
        reportErrorText(error, status),
      );
    } finally {
      setReportingValue(null);
    }
  };

  const reportingOpen = !!status?.reporting_open;
  /** The viewer already has a report in the slot that is open right now. */
  const reportedThisSlot = reportingOpen && !!status?.current_user_reported;
  /** The slider is sitting on the viewer's own report for this slot. */
  const showsOwnReport =
    reportedThisSlot && ownReport?.slot === status?.current_slot_start;
  /**
   * Whether the level on the map and in the row means anything. Until there is
   * a real reading — outside the reporting window, or inside it before anyone
   * has reported — `selectedValue` is only the slider's default, so drawing it
   * would invent a queue. It starts meaning something the moment the slider is
   * moved, because from then on it is the user's own report.
   */
  const showsLevel =
    adjusted ||
    showsOwnReport ||
    (reportingOpen && status?.status_value != null);
  const map = useMemo(
    () => (mapWidth > 0 ? buildMap(mapWidth) : null),
    [mapWidth],
  );
  /** The corridor with nobody in it — and the arrow when there is no reading. */
  const emptyCorridor = isDark ? "#31343A" : "#EDEFF2";

  const queueProps = useAnimatedProps(() => {
    const reach = interpolate(queueProgress.value, LEVEL_STOPS, LEVEL_REACH);
    return {
      d: map ? queuePath(map, map.cornerX * (1 - reach)) : "",
      stroke: interpolateColor(queueProgress.value, LEVEL_STOPS, LEVEL_COLORS),
    };
  });

  // The head's shape is fixed; only its colour rides the level.
  const arrowHeadProps = useAnimatedProps(() => ({
    fill: interpolateColor(queueProgress.value, LEVEL_STOPS, LEVEL_COLORS),
  }));

  const levelColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      queueProgress.value,
      LEVEL_STOPS,
      LEVEL_COLORS,
    ),
  }));

  const {
    card,
    text: primaryText,
    textSecondary: secondaryText,
    accent,
  } = sheetPalette(isDark);

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
          <View style={styles.topBarText}>
            <Text style={[styles.sheetTitle, { color: primaryText }]}>
              Ruokalinjasto
            </Text>
            <Text style={[styles.sheetSubtitle, { color: secondaryText }]}>
              {getCanteenReportingText(status)}
            </Text>
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

        <View style={styles.reportValueRow}>
          {showsLevel ? (
            <Animated.View style={[styles.levelDot, levelColorStyle]} />
          ) : (
            // `getQueueColor(null)` is the app's own colour for "no level",
            // so the row keeps its shape rather than shifting left.
            <View
              style={[
                styles.levelDot,
                { backgroundColor: getQueueColor(null) },
              ]}
            />
          )}
          <Text style={[styles.reportValue, { color: primaryText }]}>
            {showsLevel ? QUEUE_LEVEL_LABELS[selectedLevel] : "Ei tietoa"}
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
                  stroke={emptyCorridor}
                  strokeWidth={QUEUE_STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path d={arrowHeadPath(map)} fill={emptyCorridor} />
                {showsLevel ? (
                  <>
                    <AnimatedPath
                      animatedProps={queueProps}
                      fill="none"
                      strokeWidth={QUEUE_STROKE}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <AnimatedPath
                      animatedProps={arrowHeadProps}
                      d={arrowHeadPath(map)}
                    />
                  </>
                ) : null}
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
                  style={[
                    styles.mapLabel,
                    { color: isDark ? "#E9C59D" : "#8A5A3B" },
                  ]}
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
                  style={[
                    styles.mapLabel,
                    { color: isDark ? "#A8AEB7" : "#8A9099" },
                  ]}
                >
                  PIAZZA
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* <Text style={[styles.mapCaption, { color: secondaryText }]}>
          {status?.reporting_open
            ? sourceText(status)
            : `Vilkkaus näytetään ja sitä voi raportoida ${formatReportingWindow(
                status,
                { withClock: true }
              )}.`}
        </Text> */}
        {status?.reporting_open &&
        status.status_is_stale &&
        status.status_value != null ? (
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
            key={sliderMount}
            accessibilityLabel="Jonon pituus"
            accessibilityValue={{
              min: 1,
              max: 5,
              now: selectedLevel,
              text: QUEUE_LEVEL_LABELS[selectedLevel],
            }}
            inverted
            disabled={!reportingOpen || reportingValue !== null}
            minimumValue={0}
            maximumValue={1}
            step={0}
            value={sliderStart}
            onValueChange={(value) => {
              // Follows the finger directly; easing here would trail behind it.
              queueProgress.value = value;
              selectedValue.current = value;
              if (!adjusted) setAdjusted(true);
              const level = queueLevelFromValue(value);
              if (level !== selectedLevel) setSelectedLevel(level);
            }}
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

        {reportedThisSlot && !adjusted ? (
          // Already counted: a button here would read as "you still need to do
          // this". Moving the slider brings it back as an update.
          <View style={[styles.reportedNote, { backgroundColor: card }]}>
            <MaterialIcons
              name="check-circle"
              size={22}
              color={QUEUE_LEVEL_COLORS[1]}
            />
            <View style={styles.contributionText}>
              <Text style={[styles.reportedNoteTitle, { color: primaryText }]}>
                Raporttisi on mukana tässä jaksossa
              </Text>
              <Text style={[styles.sectionCaption, { color: secondaryText }]}>
                Siirrä liukusäädintä, jos jono muuttuu.
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!reportingOpen || reportingValue !== null}
            onPress={() => void submitValue(selectedValue.current)}
            style={({ pressed }) => [
              styles.submitButton,
              (!reportingOpen || reportingValue !== null) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Animated.View style={[styles.submitFill, levelColorStyle]} />
            {reportingValue !== null ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {reportedThisSlot ? "Päivitä raporttini" : "Lähetä raportti"}
              </Text>
            )}
          </Pressable>
        )}

        <View style={[styles.contributionCard, { backgroundColor: card }]}>
          <MaterialIcons name="volunteer-activism" size={24} color={accent} />
          <View style={styles.contributionText}>
            <Text style={[styles.contributionValue, { color: primaryText }]}>
              {status?.current_user_contributions ?? 0} raporttia
            </Text>
            <Text style={[styles.sectionCaption, { color: secondaryText }]}>
              Sinun panoksesi yhteensä. Raportit tallennetaan tilillesi, ja mitä
              enemmän raportoit, sitä enemmän raporttisi painaa yhteisön
              arviossa.
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
              <View
                key={section.title}
                style={[styles.menuCard, { backgroundColor: card }]}
              >
                <Text style={[styles.menuTitle, { color: primaryText }]}>
                  {section.title}
                </Text>
                {section.meals.map((meal, index) => (
                  <View key={`${meal.name}-${index}`} style={styles.mealRow}>
                    <View
                      style={[styles.mealBullet, { backgroundColor: accent }]}
                    />
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
            <MaterialIcons
              name="restaurant-menu"
              size={24}
              color={secondaryText}
            />
            <Text style={[styles.sectionCaption, { color: secondaryText }]}>
              {menuError
                ? "Ruokalistaa ei saatu ladattua juuri nyt."
                : "Otaniemen lukion ruokalistaa ei ole julkaistu tälle päivälle."}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => void openExternalUrl(OTANIEMI_MENU_URL)}
          style={({ pressed }) => [
            styles.sourceButton,
            pressed && styles.pressed,
          ]}
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 100 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  sheetTitle: { fontSize: 25, fontFamily: "Figtree-Bold", letterSpacing: -0.5 },
  topBarText: { flex: 1, paddingRight: 12 },
  sheetSubtitle: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  staleNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 11,
    marginTop: 11,
  },
  staleNoteText: {
    flex: 1,
    fontFamily: "Figtree-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  section: { marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Figtree-Bold" },
  sectionCaption: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  reportValueRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  reportValue: {
    fontFamily: "Figtree-Semibold",
    fontSize: 20,
    color: "#252525",
  },
  levelDot: { width: 12, height: 12, borderRadius: 6 },
  // Pulled out of the scroll view's padding so the longest queue hits the edge.
  mapBleed: {
    marginHorizontal: -20,
    marginTop: 12,
    height: MAP_HEIGHT,
    overflow: "hidden",
  },
  mapLabelBox: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  mapLabel: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 12,
    letterSpacing: 1.4,
  },
  /** Where the level drawn on the map above came from. */
  mapCaption: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  sliderZone: { marginTop: 14, justifyContent: "center" },
  // Sits behind the slider, whose own tracks are transparent, so the scale reads
  // as one continuous shift from green at the canteen to red at the far end.
  sliderTrack: {
    position: "absolute",
    left: 2,
    right: 2,
    height: 6,
    borderRadius: 3,
  },
  slider: { width: "100%", height: 40 },
  sliderScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sliderScaleText: { fontFamily: "Figtree-Regular", fontSize: 12 },
  submitButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    overflow: "hidden",
  },
  reportedNote: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reportedNoteTitle: {
    fontFamily: "Figtree-Bold",
    fontSize: 15,
  },
  submitFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  submitButtonText: {
    color: "#FFFFFF",
    fontFamily: "Figtree-Bold",
    fontSize: 15,
  },
  contributionCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
  },
  contributionText: { flex: 1 },
  contributionValue: {
    fontFamily: "Figtree-Semibold",
    fontSize: 16,
    color: "#000",
  },
  menuState: {
    minHeight: 90,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  menuSections: { gap: 12 },
  menuCard: { borderRadius: 20, padding: 16 },
  menuTitle: { fontFamily: "Figtree-Bold", fontSize: 16, marginBottom: 8 },
  mealRow: { flexDirection: "row", paddingVertical: 6, gap: 10 },
  mealBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  mealText: { flex: 1 },
  mealName: { fontFamily: "Figtree-Medium", fontSize: 14, lineHeight: 19 },
  diets: { fontFamily: "Figtree-Regular", fontSize: 12, marginTop: 2 },
  sourceButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },
  sourceButtonText: { fontFamily: "Figtree-SemiBold", fontSize: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
