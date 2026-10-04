import { PlatformSymbol } from "@/components/PlatformSymbol";
import { AppText, useTheme } from "@/components/ui";
import { getISOWeekNumber, weekMonthLabel } from "@/lib/wilma/scheduleDates";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  monday: Date;
  onStep: (delta: -1 | 1) => void;
  /** Makes the week label tappable — the personal schedule opens a calendar. */
  onPressLabel?: () => void;
};

/**
 * The week stepper every timetable keeps at the bottom edge: it is the one
 * control on those screens, and the bottom is where a thumb reaches it
 * one-handed. Sits outside the screen's loading and error states so a week
 * that failed to load can still be stepped away from.
 */
export function WeekNav({ monday, onStep, onPressLabel }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return (
    <View style={[styles.bar, { paddingBottom: 10 + insets.bottom, backgroundColor: theme.bg }]}>
      <Pressable
        onPress={() => onStep(-1)}
        style={styles.step}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Edellinen viikko"
      >
        <PlatformSymbol ios="chevron.left" android="chevron_left" size={22} tintColor={theme.accent} />
      </Pressable>
      <Pressable
        style={styles.label}
        onPress={onPressLabel}
        disabled={!onPressLabel}
        hitSlop={8}
      >
        <AppText variant="rowTitle">Viikko {getISOWeekNumber(monday)}</AppText>
        <AppText variant="meta" color="textMuted" style={styles.sub}>
          {weekMonthLabel(monday, friday)}
        </AppText>
      </Pressable>
      <Pressable
        onPress={() => onStep(1)}
        style={styles.step}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Seuraava viikko"
      >
        <PlatformSymbol ios="chevron.right" android="chevron_right" size={22} tintColor={theme.accent} />
      </Pressable>
    </View>
  );
}

/**
 * Fades the scrolling content out just above the week bar, so it reads as
 * sliding underneath it rather than stopping abruptly. Place it as the last
 * child of a `position: relative` wrapper around the scroll view.
 */
export function WeekNavFade() {
  const { bg } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`${bg}00`, `${bg}1A`, `${bg}4D`, `${bg}99`, bg]}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      style={styles.fade}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  step: { paddingVertical: 4, paddingHorizontal: 12 },
  label: { alignItems: "center" },
  sub: { marginTop: 1, textTransform: "capitalize" },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
  },
});
