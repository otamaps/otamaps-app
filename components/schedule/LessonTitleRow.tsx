import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";

type Props = {
  title: string;
  code?: string;
  isDark?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/**
 * A lesson's course name with its Wilma code beside it, so `Maailma
 * muutoksessa` always reads as `Maailma muutoksessa  GE01.23`. Shared by every
 * schedule surface so the code badge looks the same wherever a lesson appears.
 */
export default function LessonTitleRow({
  title,
  code,
  isDark,
  titleStyle,
  numberOfLines,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, titleStyle]} numberOfLines={numberOfLines}>
        {title}
      </Text>
      {!!code && (
        <Text style={[styles.code, isDark && styles.codeDark]} numberOfLines={1}>
          {code}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flexShrink: 1 },
  code: {
    flexShrink: 0,
    fontFamily: "Figtree-Medium",
    fontSize: 11,
    color: "#68717D",
    backgroundColor: "#EEF1F5",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    // iOS clips a Text background to its border radius only when it may clip.
    overflow: "hidden",
  },
  codeDark: { color: "#C2C9D2", backgroundColor: "#3A4048" },
});
