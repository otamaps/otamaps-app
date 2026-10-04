import { PlatformSymbol } from "@/components/PlatformSymbol";
import { colors, radii } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

type Props = {
  ios: React.ComponentProps<typeof PlatformSymbol>["ios"];
  android: React.ComponentProps<typeof PlatformSymbol>["android"];
  /** The tile's fill. The glyph on it is always white. */
  color: string;
};

/**
 * The filled, rounded glyph iOS sets at the head of a settings row. White on
 * a colour, so it reads as a badge for the row rather than an icon floating
 * beside the label.
 */
export function RowIcon({ ios, android, color }: Props) {
  return (
    <View style={[styles.tile, { backgroundColor: color }]}>
      <PlatformSymbol
        ios={ios}
        android={android}
        size={17}
        tintColor={colors.textOnDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 29,
    height: 29,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
