import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /** The trailing disclosure arrow. On by default when the row is tappable. */
  chevron?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/**
 * One line in a full-bleed list. The separator is a hairline on the row
 * itself rather than a `ItemSeparatorComponent`, so a row keeps its own
 * bottom edge wherever it is used — including as the last row above an
 * empty stretch of page.
 *
 * This is also the surface a list screen is mostly made of, which makes it
 * the place a material change lands.
 */
export function Row({ children, onPress, chevron, accessibilityLabel, style }: Props) {
  const theme = useTheme();
  const showChevron = chevron ?? Boolean(onPress);

  const content = (
    <>
      {children}
      {showChevron ? (
        <MaterialIcons name="chevron-right" size={22} color={theme.textFaint} />
      ) : null}
    </>
  );

  const base: ViewStyle = {
    backgroundColor: theme.card,
    borderBottomColor: theme.border,
  };

  if (!onPress) {
    return <View style={[styles.row, base, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, base, style, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
});
