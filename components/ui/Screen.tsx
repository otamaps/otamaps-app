import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./theme";

/**
 * `page` sits behind cards; `flat` is for a screen whose rows run edge to
 * edge; `card` is the row/header colour itself, for a screen that is one
 * continuous surface.
 */
type Background = "page" | "flat" | "card";

type Props = {
  children: ReactNode;
  background?: Background;
  /**
   * The status-bar inset is painted separately because it should match the
   * *header* rather than the body — otherwise the bar sits on a visibly
   * different colour to the nav bar directly beneath it. Defaults to
   * `background`, which is right whenever the header is the same colour as
   * the page.
   */
  insetBackground?: Background;
  /**
   * Screens using `AppHeader` draw their own, so the native one is hidden by
   * default. Set false to keep expo-router's header.
   */
  hideNativeHeader?: boolean;
};

const KEY = { page: "bg", flat: "bgFlat", card: "card" } as const;

export function Screen({
  children,
  background = "page",
  insetBackground,
  hideNativeHeader = true,
}: Props) {
  const theme = useTheme();
  const inset = theme[KEY[insetBackground ?? background]];

  return (
    <SafeAreaView style={[styles.inset, { backgroundColor: inset }]} edges={["top"]}>
      {hideNativeHeader ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <View style={[styles.body, { backgroundColor: theme[KEY[background]] }]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inset: { flex: 1 },
  body: { flex: 1 },
});
