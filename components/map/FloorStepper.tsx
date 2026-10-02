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
/** How far a finger travels to move one floor while dragging. */
const DRAG_PER_FLOOR = 24;
/** Hold this long on the number before a drag takes over. */
const HOLD_MS = 200;
/** Near-critically damped and stiff: lands fast, with no visible bounce. */
const SNAP = { stiffness: 700, damping: 46, mass: 0.6 };
/**
 * How much of the in-between drag the strip shows. Mostly it sits on whole
 * floors and snaps from one to the next — the detent is the point — with
 * just enough give that it still reads as attached to the finger.
 */
const DRAG_GIVE = 0.2;

// Plain JS functions for the gesture to call back to. Handing the worklet the
// `Haptics` module itself would have it copy the whole module to the UI thread.
const hapticGrab = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hapticTick = () => void Haptics.selectionAsync();

/**
 * Which floor the map shows, on a floating glass capsule like the map
 * controls in Apple Maps: the current floor between an up and a down
 * button. Holding the number and dragging scrubs through floors, snapping
 * from one to the next with a tick as each lands, and the map follows the
 * drag rather than waiting for the finger to lift.
 */
export function FloorStepper({ value, onChange, min, max, visible = true }: Props) {
  const theme = useTheme();
  // The strip's position in floors. Fractional mid-drag and mid-spring.
  const position = useSharedValue(value);
  const dragging = useSharedValue(false);
  const dragStart = useSharedValue(value);
  const lastFloor = useSharedValue(value);

  // Follow a change made anywhere else — the buttons, opening a room on
  // another floor — unless a drag is setting the floor itself.
  useEffect(() => {
    if (dragging.value) return;
    lastFloor.value = value;
    position.value = withSpring(value, SNAP);
  }, [value, dragging, lastFloor, position]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      dragging.value = true;
      dragStart.value = lastFloor.value;
      scheduleOnRN(hapticGrab);
    })
    .onUpdate((event) => {
      // Up the screen is up the building.
      const raw = dragStart.value - event.translationY / DRAG_PER_FLOOR;
      const floor = Math.min(max, Math.max(min, Math.round(raw)));
      if (floor !== lastFloor.value) {
        lastFloor.value = floor;
        scheduleOnRN(onChange, floor);
        scheduleOnRN(hapticTick);
      }
      // Sit on the floor, offset by a fraction of how far the finger is
      // past it — so past either end it leans, then stops.
      const give = Math.max(-0.5, Math.min(0.5, raw - floor)) * DRAG_GIVE;
      position.value = withSpring(floor + give, SNAP);
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      position.value = withSpring(lastFloor.value, SNAP);
    });

  const stripStyle = useAnimatedStyle(() => ({
    // The strip lists floors top-down from `max`, so floor `max` sits in
    // the window at zero offset and each lower floor one row further up.
    transform: [{ translateY: -(max - position.value) * ROW }],
  }));
  // On the window, not the strip: two animated styles on one view would
  // each set `transform`, and the second would wipe out the first.
  const windowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(dragging.value ? 1.15 : 1, SNAP) }],
  }));

  const floors = Array.from({ length: max - min + 1 }, (_, i) => max - i);
  const atTop = value >= max;
  const atBottom = value <= min;

  return (
    <GlassSurface radius={WIDTH / 2} visible={visible} style={styles.surface}>
      <StepButton
        ios="chevron.up"
        android="keyboard_arrow_up"
        label="Kerros ylös"
        disabled={atTop}
        onPress={() => onChange(value + 1)}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.window, windowStyle]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Kerros"
          accessibilityValue={{ text: `${value}. kerros` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment" && !atTop) onChange(value + 1);
            if (event.nativeEvent.actionName === "decrement" && !atBottom) onChange(value - 1);
          }}
        >
          <Animated.View style={stripStyle}>
            {floors.map((floor) => (
              <View key={floor} style={styles.cell}>
                <Text style={[styles.number, { color: theme.text }]}>{floor}</Text>
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <StepButton
        ios="chevron.down"
        android="keyboard_arrow_down"
        label="Kerros alas"
        disabled={atBottom}
        onPress={() => onChange(value - 1)}
      />
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
