import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { BACKGROUND_KEY, useTheme, type Background } from "./theme";

type HeaderOptions = NonNullable<ComponentProps<typeof Stack.Screen>["options"]>;

type Args = {
  title: string;
  /**
   * The page colour behind the content, applied without adding a view.
   *
   * At rest the bar is transparent and shows this through, so a full-bleed
   * list wants `card` — the colour of its own rows — rather than `flat`.
   * Anything else leaves a visibly darker band above the first row in dark
   * mode, which cannot be fixed from the bar's side (see below).
   */
  background?: Background;
  /**
   * The back chevron, on by default.
   *
   * A screen pushed across navigator boundaries — as rooms is, from the tabs
   * stack — mounts as the first route of its own stack, so the system's own
   * back button never appears however the screen was reached. Supplying one
   * covers both cases, and behaves identically to the system's where that
   * would have shown. A tab root passes `false`.
   */
  back?: boolean;
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
 * view directly under the screen; wrap it in even a single
 * `<View style={{ flex: 1 }}>` and it finds nothing. The title then never
 * collapses, no glass appears, and the rows scroll under a floating title at
 * full opacity. That is why the background is set through `contentStyle`
 * here instead of by a wrapper — there is no wrapper to put it on.
 *
 * ⚠️ The bar's own background cannot be set. `headerStyle.backgroundColor`,
 * `headerLargeStyle` and `headerTransparent` each make the large title
 * vanish at rest — the space stays reserved and the text does not draw.
 * Tested with explicit `headerLargeTitleStyle.color`, and with
 * `scrollEdgeEffects` removed, in case it was an interaction; it is not.
 * The bar therefore keeps the system's colour. Match it from the content
 * side instead: the bar shows `contentStyle` through, so a screen whose
 * rows are `card` passes `background: "card"` and the band disappears.
 */
export function useNativeHeader({
  title,
  background = "page",
  back = true,
  search,
}: Args): HeaderOptions {
  const theme = useTheme();
  const router = useRouter();

  return {
    headerShown: true,
    title,
    headerLargeTitle: true,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: theme[BACKGROUND_KEY[background]] },

    // Set explicitly rather than derived, so the title cannot pick up the
    // back button's tint and the two stay independently adjustable.
    headerTintColor: theme.accent,
    headerTitleStyle: { color: theme.text },

    // iOS 26 draws the bar over the scroll view rather than above it, and
    // this decides what happens where they meet. `hard` stops the rows dead
    // against the bar's edge; `soft` fades them out under the glass instead,
    // leaving them faintly legible through it.
    //
    // Under `hard` the simulator draws the stacked search field as a pale
    // capsule ignoring dark mode; on a device it is correct. Simulator only
    // — do not "fix" it, and do not switch to `soft` on account of it.
    scrollEdgeEffects: { top: "hard" },

    // The system default of 34pt leaves a long Finnish title no margin at
    // all — "Tilojen lukujärjestykset" runs the full width.
    headerLargeTitleStyle: { fontSize: 30, color: theme.text },

    ...(back
      ? {
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Takaisin"
            >
              <MaterialIcons name="chevron-left" size={28} color={theme.accent} />
            </Pressable>
          ),
        }
      : {}),

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
