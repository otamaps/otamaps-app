import { useTheme } from "@/components/ui";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: ReactNode;
  /** Corner radius. Half the height makes a capsule, as the map's controls are. */
  radius: number;
  /** Ripples and lifts under a touch, as system glass does on a control. */
  interactive?: boolean;
  /**
   * Shows or hides the control. Use this — never an animated `opacity` on
   * something around it — to make glass come and go; see below.
   */
  visible?: boolean;
  /** Size and inner layout of the content. */
  style?: StyleProp<ViewStyle>;
};

// Decided once: the answer cannot change while the app is running.
const LIQUID_GLASS = isLiquidGlassAvailable();

const SHOW_MS = 250;
const HIDE_MS = 150;

/**
 * The material every control floating over the map is made of. On iOS 26
 * it is the system's own Liquid Glass (`UIGlassEffect`); on Android and
 * older iOS, the thick material blur those controls used before.
 *
 * ⚠️ Glass must not be faded from outside. A native effect view whose
 * ancestor's opacity is animated through zero stops drawing its effect, and
 * stays blank — a bare label floating over the map — until it is attached
 * afresh, as switching tabs and back does. So `visible` hides the glass the
 * way UIKit means it to be hidden: the effect itself animates to `none`
 * and back, dematerialising and materialising, while only the content
 * inside it fades.
 */
export function GlassSurface({
  children,
  radius,
  interactive,
  visible = true,
  style,
}: Props) {
  const theme = useTheme();
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, {
      duration: visible ? SHOW_MS : HIDE_MS,
    });
  }, [visible, shown]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle={{
          style: visible ? "regular" : "none",
          animate: true,
          animationDuration: (visible ? SHOW_MS : HIDE_MS) / 1000,
        }}
        isInteractive={interactive}
        colorScheme={theme.isDark ? "dark" : "light"}
        style={{ borderRadius: radius, borderCurve: "continuous" }}
      >
        {/* The content carries the layout, so the glass sizes to it. */}
        <Animated.View style={[style, contentStyle]}>{children}</Animated.View>
      </GlassView>
    );
  }

  return (
    // The blur is a layer behind the content rather than its container, so
    // the shadow on this outer view sits outside the blur's clipping.
    <Animated.View style={[styles.shadow, { borderRadius: radius }, style, contentStyle]}>
      <BlurView
        intensity={theme.isDark ? 60 : 80}
        tint={theme.isDark ? "systemThickMaterialDark" : "systemThickMaterialLight"}
        // Android has no live blur by default; without this it renders a
        // flat translucent view. SDK 31+ only, older falls back.
        blurMethod="dimezisBlurViewSdk31Plus"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      />
      {children}
    </Animated.View>
  );
}

/** Whether `GlassSurface` is real glass, which gives its own touch response. */
export const HAS_LIQUID_GLASS = LIQUID_GLASS;

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
});
