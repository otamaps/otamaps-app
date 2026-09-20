import { MaterialIcons } from "@expo/vector-icons";
import { radii } from "@/constants/theme";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "./theme";

type Props = {
  /** Shows a spinner and ignores every other prop. */
  loading?: boolean;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  message?: string;
  /** Renders a quiet accent button below the message. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * The block a screen shows instead of its content: loading, failed, or
 * empty. 38 screens draw a version of this, and the dark-mode retry button
 * was a common casualty — the accent *tint* was usually left at its light
 * value, leaving a pale blue button on a dark page. Resolving it through the
 * palette fixes that everywhere at once.
 */
export function StateView({ loading, icon, message, actionLabel, onAction }: Props) {
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      {icon ? <MaterialIcons name={icon} size={48} color={theme.textFaint} /> : null}
      {message ? (
        <AppText variant="bodySmall" color="textMuted" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.accentTint },
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="rowTitle" color="accent">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  message: { textAlign: "center" },
  action: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  pressed: { opacity: 0.6 },
});
