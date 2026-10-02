import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { glassEffect, padding, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { SegmentedControl } from "./SegmentedControl";
import { useTheme } from "./theme";

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  /** Where the capsule sits. It floats, so the caller positions it. */
  style?: ViewStyle;
};

/**
 * The system segmented control, full width, floating on a Liquid Glass
 * capsule the way iOS 26 sets view switchers over content. SwiftUI's own
 * `Picker`, so segment sizing, the selection thumb, haptics and VoiceOver
 * are all the system's. Its label font is set app-wide by the
 * `withIosSegmentedControlFont` config plugin, since the control ignores
 * SwiftUI font modifiers.
 *
 * Android keeps the underline tabs: the redesign is iOS-only, and the glass
 * has no Android equivalent to fall back to.
 */
export function GlassSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  style,
}: Props<T>) {
  const theme = useTheme();

  if (Platform.OS !== "ios") {
    return <SegmentedControl value={value} onChange={onChange} options={options} />;
  }

  return (
    <View style={[styles.wrap, style]} pointerEvents="box-none">
      <Host matchContents={{ vertical: true }} colorScheme={theme.isDark ? "dark" : "light"}>
        <Picker
          selection={value}
          onSelectionChange={(next) => onChange(next as T)}
          modifiers={[
            pickerStyle("segmented"),
            padding({ all: 4 }),
            glassEffect({ glass: { variant: "regular", interactive: true }, shape: "capsule" }),
          ]}
        >
          {options.map(([optionValue, label]) => (
            <Text key={optionValue} modifiers={[tag(optionValue)]}>
              {label}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
});
