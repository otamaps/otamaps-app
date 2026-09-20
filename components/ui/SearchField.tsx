import { MaterialIcons } from "@expo/vector-icons";
import { typography } from "@/constants/typography";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { radii } from "@/constants/theme";
import { useTheme } from "./theme";

type Props = Omit<TextInputProps, "placeholderTextColor" | "style">;

/**
 * The filter field that sits under a header. It sits directly on the page
 * rather than on a card of its own — the border alone outlines it, which is
 * why it needs no elevation.
 */
export function SearchField(props: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: theme.bgFlat, borderColor: theme.border },
      ]}
    >
      <MaterialIcons name="search" size={20} color={theme.textMuted} />
      <TextInput
        {...props}
        style={[styles.input, { color: theme.text }]}
        placeholderTextColor={theme.placeholder}
        autoCorrect={props.autoCorrect ?? false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  input: { flex: 1, height: 44, ...typography.input },
});
