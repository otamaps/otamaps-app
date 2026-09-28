import { radii } from "@/constants/theme";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "./theme";

type Props = {
  title: string;
  onPress: () => void;
  /** Nothing to submit — a genuinely inert control, not just a dimmed one. */
  disabled?: boolean;
  loading?: boolean;
};

/**
 * The one filled, full-width call to action — a form's save, a Wilma
 * connect. `disabled` mutes the fill itself rather than lowering opacity, so
 * "nothing changed yet" reads differently from "working on it".
 */
export function Button({ title, onPress, disabled, loading }: Props) {
  const theme = useTheme();
  const inactive = Boolean(disabled) || Boolean(loading);
  const muted = Boolean(disabled) && !loading;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: muted ? theme.border : theme.accent },
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <AppText
          variant="button"
          style={[styles.label, muted && { color: theme.textFaint }]}
        >
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    minHeight: 52,
  },
  label: { color: "#fff" },
  pressed: { opacity: 0.75 },
});
