import { FONT_FAMILY } from "@/constants/typography";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./theme";

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
};

/**
 * The underline tab bar under a screen's header — folders, result tabs,
 * a gradebook's two views. Four screens had grown their own copy of this
 * with the same three style rules (equal width, 2pt underline, accent on
 * the active label) spelled out by hand each time.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: Props<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      {options.map(([optionValue, label]) => {
        const active = optionValue === value;
        return (
          <Pressable
            key={optionValue}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { borderBottomColor: theme.accent }]}
            onPress={() => onChange(optionValue)}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.accent : theme.textMuted },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  label: { fontFamily: FONT_FAMILY.medium, fontSize: 13 },
});
