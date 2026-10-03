import { fonts } from "@/constants/typography";
import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  /** Spacing around the control, where it sits. */
  style?: ViewStyle;
};

/**
 * The selector between a screen's views — folders, result tabs, a
 * gradebook's two views, a friend list's add and requests.
 *
 * iOS: the system segmented control, full width — SwiftUI's own `Picker`,
 * so its sizing, thumb, haptics and VoiceOver are the system's, and its
 * label font comes from the `withIosSegmentedControlFont` config plugin.
 * No glass: it sits in the page with the content, so the bar's scroll-edge
 * blur passes over it like any row (glass would stay sharp beneath it).
 *
 * Android: the underline tab bar, as the redesign is iOS-only.
 */
export function SegmentedControl<T extends string>(props: Props<T>) {
  return Platform.OS === "ios" ? <NativeSegments {...props} /> : <UnderlineTabs {...props} />;
}

function NativeSegments<T extends string>({ value, onChange, options, style }: Props<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.native, style]}>
      <Host matchContents={{ vertical: true }} colorScheme={theme.isDark ? "dark" : "light"}>
        <Picker
          selection={value}
          onSelectionChange={(next) => onChange(next as T)}
          modifiers={[pickerStyle("segmented")]}
        >
          {options.map(([optionValue, label]) => (
            <SwiftText key={optionValue} modifiers={[tag(optionValue)]}>
              {label}
            </SwiftText>
          ))}
        </Picker>
      </Host>
    </View>
  );
}

/**
 * Four screens had grown their own copy of this, with the same three style
 * rules (equal width, 2pt underline, accent on the active label) spelled
 * out by hand each time.
 */
function UnderlineTabs<T extends string>({ value, onChange, options, style }: Props<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }, style]}>
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
  native: { paddingHorizontal: 16, paddingVertical: 8 },
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
  label: { ...fonts.medium, fontSize: 13 },
});
