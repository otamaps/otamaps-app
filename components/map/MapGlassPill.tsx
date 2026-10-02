import { radii } from "@/constants/theme";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { GlassSurface, HAS_LIQUID_GLASS } from "./GlassSurface";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  /** Hides it the glass-safe way; see `GlassSurface`. */
  visible?: boolean;
};

/**
 * A small floating label over the map — where you are, how long the
 * canteen queue is — on `GlassSurface`, interactive when tappable so it
 * answers a touch the way system glass does.
 */
export function MapGlassPill({
  children,
  onPress,
  accessibilityLabel,
  style,
  visible = true,
}: Props) {
  const surface = (
    <GlassSurface
      radius={radii.pill}
      interactive={Boolean(onPress)}
      visible={visible}
      style={styles.content}
    >
      {children}
    </GlassSurface>
  );

  if (!onPress) {
    return (
      <View style={style} accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
        {surface}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={!visible}
      hitSlop={6}
      // Liquid Glass gives its own touch response; the fallback needs one.
      style={({ pressed }) => [style, !HAS_LIQUID_GLASS && pressed && styles.pressed]}
    >
      {surface}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  pressed: { opacity: 0.75 },
});
