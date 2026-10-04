import { nativeListColors } from "@/components/sheets/sheetTheme";
import { useTheme } from "@/components/ui";
import { fonts } from "@/constants/typography";
import { getReadableLabelColor } from "@/lib/color";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  /** Your own name — only its first letter is shown, on the avatar. */
  name: string;
  color: string;
  /** "A123 · 2. krs", or null when no beacon has been heard recently. */
  location: string | null;
  /** Takes the map to you. Absent when there is no position to go to. */
  onPress?: () => void;
};

/**
 * You, heading the friends list as "Minä" — the way Find My leads its list
 * with "Me". Built exactly like the friend rows below it — same avatar, type
 * sizes, padding and status dot — because a native list sets a row apart
 * with sections, not with a style of its own: the friends follow under their
 * own heading. Only the semibold title and the missing chevron differ, since
 * a tap here opens nothing; it takes the map to you, as the recenter button
 * beside the map search does.
 */
export function MeRow({ name, color, location, onPress }: Props) {
  const theme = useTheme();
  const list = nativeListColors(theme.isDark);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Minä, ${location ?? "ei sijaintia"}`}
      accessibilityHint={onPress ? "Keskittää kartan sijaintiisi" : undefined}
      style={({ pressed }) => [
        styles.row,
        // A UIKit cell highlights by filling, not by fading.
        pressed && { backgroundColor: list.highlight },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={[styles.initial, { color: getReadableLabelColor(color) }]}>
          {(name.trim()[0] ?? "?").toLocaleUpperCase("fi-FI")}
        </Text>
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: list.label }]}>Minä</Text>
        <View style={styles.subtitleLine}>
          {/* The same dot the friend rows carry: green where you are known
              to be, grey where you are not. */}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: location ? "#4CAF50" : "#9E9E9E" },
            ]}
          />
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: list.secondaryLabel }]}
          >
            {location ?? "Ei sijaintia"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The heading over the friends that follow the "Minä" row, in UIKit's plain
 * list section-header style: small, uppercase, secondary.
 */
export function FriendsSectionHeader() {
  const theme = useTheme();
  const list = nativeListColors(theme.isDark);
  return (
    <Text
      accessibilityRole="header"
      style={[styles.sectionHeader, { color: list.secondaryLabel }]}
    >
      KAVERIT
    </Text>
  );
}

// Type set through `fonts`, so it follows `IOS_TYPEFACE` with the rest of the app.
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { ...fonts.semiBold, fontSize: 17 },
  text: { flex: 1 },
  title: { ...fonts.semiBold, fontSize: 17 },
  subtitleLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  subtitle: { ...fonts.regular, fontSize: 13, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sectionHeader: {
    ...fonts.regular,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
});
