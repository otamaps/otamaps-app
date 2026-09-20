import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "./theme";

type Props = {
  title: string;
  /**
   * Matches `Screen`'s own `background` — the header and the page beneath it
   * read as one surface, separated only by the bottom hairline. `card` is for
   * a header that should lift off a `page` background.
   */
  background?: "page" | "flat" | "card";
  /** Defaults to `router.back()`. Pass `null` for a header with no back arrow. */
  onBack?: (() => void) | null;
  /** Trailing content — an action button, a count, a menu. */
  right?: ReactNode;
};

/**
 * The in-body navigation header, as opposed to expo-router's native one.
 * Roughly 19 screens draw their own version of this; they differed mainly in
 * which grey they picked for the bottom border.
 */
const KEY = { page: "bg", flat: "bgFlat", card: "card" } as const;

export function AppHeader({ title, background = "flat", onBack, right }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const back = onBack === undefined ? () => router.back() : onBack;

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme[KEY[background]], borderBottomColor: theme.border },
      ]}
    >
      {back ? (
        <Pressable
          onPress={back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Takaisin"
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.accent} />
        </Pressable>
      ) : null}
      <AppText variant="navTitle" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { flexShrink: 1 },
});
