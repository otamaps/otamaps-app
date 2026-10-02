import { PlatformSymbol } from "@/components/PlatformSymbol";
import { fonts } from "@/constants/typography";
import { StyleSheet, Text, View } from "react-native";

/** iOS's systemYellow, light and dark. */
const LUNCH = {
  fill: "rgba(255,204,0,0.22)",
  fillDark: "rgba(255,214,10,0.2)",
  text: "#8A6100",
  textDark: "#FFD60A",
};

/**
 * "Lounas 11:00–11:30" under a lesson whose span holds the lunch break —
 * the same capsule wherever a timetable shows one: the Wilma tab's day card,
 * the schedule, a friend's day. systemYellow as a translucent fill, with a
 * deeper shade for the text so it stays legible in light mode.
 */
export function LunchPill({
  start,
  end,
  isDark,
}: {
  start: string;
  end: string;
  isDark: boolean;
}) {
  const color = isDark ? LUNCH.textDark : LUNCH.text;
  return (
    <View style={[styles.pill, { backgroundColor: isDark ? LUNCH.fillDark : LUNCH.fill }]}>
      <PlatformSymbol ios="fork.knife" android="restaurant" size={10} tintColor={color} />
      <Text style={[styles.text, { color }]}>
        Lounas {start}–{end}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  text: { ...fonts.medium, fontSize: 12 },
});
