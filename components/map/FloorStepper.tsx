import { PlatformSymbol } from "@/components/PlatformSymbol";
import { useTheme } from "@/components/ui";
import { fonts } from "@/constants/typography";
import * as Haptics from "expo-haptics";
import { useEffect, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GlassSurface } from "./GlassSurface";

type Props = {
  value: number;
  onChange: (floor: number) => void;
  min: number;
  max: number;
  /** Hides it the glass-safe way; see `GlassSurface`. */
  visible?: boolean;
};

const WIDTH = 48;
/** Height of the number window, and of each number in the strip. */
const ROW = 40;
/**
 * How far a finger moves, vertically, before a touch on the capsule counts
 * as a swipe rather than a tap — and the swipe has then moved one floor.
 */
const SWIPE_DISTANCE = 16;
/** Near-critically damped and stiff: lands fast, with no visible bounce. */
const SNAP = { stiffness: 700, damping: 46, mass: 0.6 };
// Plain JS functions for the gesture to call back to. Handing the worklet the
// `Haptics` module itself would have it copy the whole module to the UI thread.
const hapticTick = () => void Haptics.selectionAsync();

/**
 * Which floor the map shows, on a floating glass capsule like the map
 * controls in Apple Maps: the current floor between an up and a down
 * button. Swiping up or down anywhere on the capsule moves one floor, the
 * way the number would move under your finger — the
 * map changes as soon as the swipe is recognised, with a tick, rather than
 * waiting for the finger to lift. A tap on an arrow also steps one floor.
 */
export function FloorStepper({
  value,
  onChange,
  min,
  max,
  visible = true,
}: Props) {
  const theme = useTheme();
  // The strip's position in floors, mid-spring between one floor and the next.
  const position = useSharedValue(value);
  // The floor as the gesture sees it, on the UI thread. Updated at once when a
  // swipe fires, so a second swipe cannot start from a stale floor.
  const current = useSharedValue(value);
  const swiped = useSharedValue(false);

  // Follow a change made anywhere else — the buttons, opening a room on
  // another floor — as well as our own swipes.
  useEffect(() => {
    current.value = value;
    position.value = withSpring(value, SNAP);
  }, [value, current, position]);

  const pan = Gesture.Pan()
    .activeOffsetY([-SWIPE_DISTANCE, SWIPE_DISTANCE])
    .onStart(() => {
      swiped.value = false;
    })
    .onUpdate((event) => {
      if (swiped.value) return;
      swiped.value = true;
      // The strip follows the finger, as scrolling does: higher floors sit
      // above the number, so dragging down brings the next one up into view.
      const next = current.value + (event.translationY > 0 ? 1 : -1);
      if (next < min || next > max) return;
      current.value = next;
      scheduleOnRN(onChange, next);
      scheduleOnRN(hapticTick);
    });

  const stripStyle = useAnimatedStyle(() => ({
    // The strip lists floors top-down from `max`, so floor `max` sits in
    // the window at zero offset and each lower floor one row further up.
    transform: [{ translateY: -(max - position.value) * ROW }],
  }));
  const floors = Array.from({ length: max - min + 1 }, (_, i) => max - i);
  const atTop = value >= max;
  const atBottom = value <= min;

  return (
    <GlassSurface radius={WIDTH / 2} visible={visible} style={styles.surface}>
      {/* The detector is on a view of its own around the whole capsule, so a
          swipe works from the arrows as well as the number. */}
      <GestureDetector gesture={pan}>
        <Animated.View collapsable={false} style={styles.swipeArea}>
          <StepButton
            ios="chevron.up"
            android="keyboard_arrow_up"
            label="Kerros ylös"
            disabled={atTop}
            onPress={() => onChange(value + 1)}
          />
          <Animated.View
            style={styles.window}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Kerros"
            accessibilityValue={{ text: `${value}. kerros` }}
            accessibilityActions={[
              { name: "increment" },
              { name: "decrement" },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "increment" && !atTop)
                onChange(value + 1);
              if (event.nativeEvent.actionName === "decrement" && !atBottom)
                onChange(value - 1);
            }}
          >
            <Animated.View style={stripStyle}>
              {floors.map((floor) => (
                <View key={floor} style={styles.cell}>
                  <Text style={[styles.number, { color: theme.text }]}>
                    {floor}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </Animated.View>
          <StepButton
            ios="chevron.down"
            android="keyboard_arrow_down"
            label="Kerros alas"
            disabled={atBottom}
            onPress={() => onChange(value - 1)}
          />
        </Animated.View>
      </GestureDetector>
    </GlassSurface>
  );
}

function StepButton({
  ios,
  android,
  label,
  disabled,
  onPress,
}: {
  ios: ComponentProps<typeof PlatformSymbol>["ios"];
  android: ComponentProps<typeof PlatformSymbol>["android"];
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <PlatformSymbol
        ios={ios}
        android={android}
        size={15}
        weight="semibold"
        tintColor={disabled ? theme.textFaint : theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: { width: WIDTH, alignItems: "center" },
  swipeArea: { width: "100%", alignItems: "center" },
  step: {
    width: "100%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.4 },
  // Clips the strip to one number; the rest slide past out of sight.
  window: { height: ROW, width: "100%", overflow: "hidden" },
  cell: { height: ROW, alignItems: "center", justifyContent: "center" },
  // The system font, as the native map controls use, with figures of equal
  // width so the number doesn't shift sideways as it changes.
  number: { ...fonts.semiBold, fontSize: 19, fontVariant: ["tabular-nums"] },
});
