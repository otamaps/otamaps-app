import { Stack } from "expo-router";
import type { ComponentProps } from "react";
import { BACKGROUND_KEY, useTheme, type Background } from "./theme";

type HeaderOptions = NonNullable<ComponentProps<typeof Stack.Screen>["options"]>;

type Args = {
  title: string;
  /** The page colour behind the content. Applied without adding a view. */
  background?: Background;
  /** Adds the system search bar beneath the large title. */
  search?: {
    placeholder: string;
    onChangeText: (text: string) => void;
  };
};

/**
 * The options a screen on the platform navigation bar spreads onto its own
 * `Stack.Screen`, so the iOS 26 details below are settled once rather than
 * rediscovered per screen.
 *
 * ⚠️ The screen's scroll view must be its ROOT element. UIKit attaches the
 * large title, the search bar and the scroll-edge effect to the first scroll
 * view it finds directly under the screen; wrap it in even a single
 * `<View style={{ flex: 1 }}>` and it finds nothing. The title then never
 * collapses, no glass appears, and the rows scroll under a floating title at
 * full opacity. That is why the background is set through `contentStyle`
 * here instead of by a wrapper — there is no wrapper to put it on.
 */
export function useNativeHeader({
  title,
  background = "page",
  search,
}: Args): HeaderOptions {
  const theme = useTheme();

  return {
    headerShown: true,
    title,
    headerLargeTitle: true,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: theme[BACKGROUND_KEY[background]] },

    // iOS 26 draws the bar over the scroll view rather than above it. `hard`
    // gives it a firm edge for the rows to stop against; `soft` fades them
    // out instead, if the content should dissolve under the glass.
    scrollEdgeEffects: { top: "hard" },

    // The system default of 34pt leaves a long Finnish title no margin at
    // all — "Tilojen lukujärjestykset" runs the full width.
    headerLargeTitleStyle: { fontSize: 30 },

    ...(search
      ? {
          headerSearchBarOptions: {
            // iOS 26 resolves `automatic` to `integrated`, folding the field
            // into the bar — which renders nothing whatsoever on a screen
            // with no other bar items.
            placement: "stacked" as const,
            placeholder: search.placeholder,
            onChangeText: (event: { nativeEvent: { text: string } }) =>
              search.onChangeText(event.nativeEvent.text),
            hideWhenScrolling: false,
            autoCapitalize: "none" as const,
          },
        }
      : {}),
  };
}
