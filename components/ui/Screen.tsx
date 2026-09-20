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
   * `native` leaves the platform navigation bar in place and lets it own the
   * top inset — the direction the app is moving, and what gives a screen the
   * system's own large title, back gesture and glass.
   *
   * `custom` hides it for a screen still drawing its own `AppHeader`, and
   * takes over the safe-area inset itself.
   */
  header?: "native" | "custom";
  /**
   * `custom` only. The inset above the header is painted separately because
   * it should match the *header* rather than the body — otherwise the status
   * bar sits on a visibly different colour to the bar beneath it.
   */
  insetBackground?: Background;
};

const KEY = { page: "bg", flat: "bgFlat", card: "card" } as const;

export function Screen({
  children,
  background = "page",
  header = "native",
  insetBackground,
}: Props) {
  const theme = useTheme();
  const body = { backgroundColor: theme[KEY[background]] };

  // The navigation bar already covers the status bar, so a SafeAreaView here
  // would inset the content a second time and leave a band below the header.
  if (header === "native") {
    return <View style={[styles.body, body]}>{children}</View>;
  }

  const inset = theme[KEY[insetBackground ?? background]];

  return (
    <SafeAreaView style={[styles.inset, { backgroundColor: inset }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.body, body]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inset: { flex: 1 },
  body: { flex: 1 },
});
