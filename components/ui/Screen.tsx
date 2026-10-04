import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BACKGROUND_KEY, useTheme, type Background } from "./theme";

type Props = {
  children: ReactNode;
  background?: Background;
  /**
   * The inset above the header is painted separately because it should match
   * the *header* rather than the body — otherwise the status bar sits on a
   * visibly different colour to the bar beneath it.
   */
  insetBackground?: Background;
};

/**
 * The shell for a screen that draws its own `AppHeader` in the body, which
 * is every screen not yet moved onto the platform navigation bar.
 *
 * A screen on the native bar does NOT use this. It renders its scroll view
 * as its own root element and takes its background from `useNativeHeader`,
 * because a wrapper view here would stop UIKit finding the scroll view to
 * attach the large title to.
 */
export function Screen({ children, background = "page", insetBackground }: Props) {
  const theme = useTheme();
  const inset = theme[BACKGROUND_KEY[insetBackground ?? background]];

  return (
    <SafeAreaView style={[styles.inset, { backgroundColor: inset }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[styles.body, { backgroundColor: theme[BACKGROUND_KEY[background]] }]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inset: { flex: 1 },
  body: { flex: 1 },
});
