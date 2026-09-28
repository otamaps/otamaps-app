import { Stack, useRouter } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import type { ScrollEdgeEffect } from "react-native-screens";
import { useMemo, type ComponentProps } from "react";
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
  /**
   * Off for a screen with no scroll view of its own to collapse it against
   * — a WebView-hosted document, say. Without a tracked scroll view the
   * large title has nothing to observe and simply stays expanded, eating
   * space from content that is usually the entire point of the screen.
   */
  large?: boolean;
  /**
   * Adds the system search bar beneath the large title. Flat rather than a
   * nested object so that passing it inline cannot defeat the memoisation
   * below — an options object with a new identity each render makes
   * react-navigation reconfigure the native bar, and reinstall the search
   * controller, on every keystroke typed into it.
   */
  searchPlaceholder?: string;
  onSearch?: (text: string) => void;
  /**
   * A single trailing icon button — reply, send, compose. `disabled` dims
   * the icon rather than removing it, so the bar doesn't reflow the moment
   * the action becomes available.
   */
  action?: {
    icon: SFSymbol;
    onPress: () => void;
    accessibilityLabel: string;
    disabled?: boolean;
  };
  /**
   * The bar's material at the top edge once content is underneath it.
   * Unset (the system default) everywhere else — see the note below on why
   * `hard` was rejected. A screen can still opt into `soft`'s gentler fade.
   */
  edgeEffect?: ScrollEdgeEffect;
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
  large = true,
  searchPlaceholder,
  onSearch,
  action,
  edgeEffect,
}: Args): HeaderOptions {
  const theme = useTheme();
  const router = useRouter();

  return useMemo(
    () => ({
      headerShown: true,
      title,
      headerLargeTitle: large,
      headerBackButtonDisplayMode: "minimal" as const,
      contentStyle: { backgroundColor: theme[BACKGROUND_KEY[background]] },

      // Set explicitly rather than derived, so the title cannot pick up the
      // back button's tint and the two stay independently adjustable.
      headerTintColor: theme.accent,
      headerTitleStyle: { color: theme.text },

      // Unset by default rather than `hard`: `hard` draws its backdrop at the
      // top edge whether or not anything is under it, so at rest it read as a
      // grey bar across the width behind the back chevron, growing into the
      // whole bar on scroll. It was only ever reached for because the rows
      // were showing through the bar — which turned out to be the navigation
      // bar not tracking the scroll view at all (see above), not the edge
      // effect. With that fixed the system default is already right for most
      // screens: nothing at the top, its own material once content is
      // underneath. `edgeEffect` lets one opt into `soft` where that reads
      // better than the system's choice.
      ...(edgeEffect ? { scrollEdgeEffects: { top: edgeEffect } } : {}),

      // The system default of 34pt leaves a long Finnish title no margin at
      // all — "Tilojen lukujärjestykset" runs the full width.
      ...(large ? { headerLargeTitleStyle: { fontSize: 30, color: theme.text } } : {}),

      ...(back
        ? {
            // A real bar button item rather than a React `headerLeft`: iOS 26
            // wraps custom header views in the shared glass capsule, and
            // `hidesSharedBackground` — the only way off it — exists on the
            // native item alone. The chevron is then drawn by the system at
            // the size and weight it uses for its own back button.
            unstable_headerLeftItems: () => [
              {
                type: "button" as const,
                label: "",
                icon: { type: "sfSymbol" as const, name: "chevron.left" as const },
                onPress: () => router.back(),
                tintColor: theme.text,
                hidesSharedBackground: true,
              },
            ],
          }
        : {}),

      ...(searchPlaceholder && onSearch
        ? {
            headerSearchBarOptions: {
              // iOS 26 resolves `automatic` to `integrated`, folding the field
              // into the bar — which renders nothing whatsoever on a screen
              // that has no other bar items.
              placement: "stacked" as const,
              placeholder: searchPlaceholder,
              onChangeText: (event: { nativeEvent: { text: string } }) =>
                onSearch(event.nativeEvent.text),
              hideWhenScrolling: false,
              autoCapitalize: "none" as const,
            },
          }
        : {}),

      ...(action
        ? {
            unstable_headerRightItems: () => [
              {
                type: "button" as const,
                label: "",
                icon: { type: "sfSymbol" as const, name: action.icon },
                onPress: action.onPress,
                tintColor: action.disabled ? theme.textFaint : theme.accent,
                disabled: action.disabled,
                accessibilityLabel: action.accessibilityLabel,
                hidesSharedBackground: true,
              },
            ],
          }
        : {}),
    }),
    [title, background, back, large, searchPlaceholder, onSearch, action, edgeEffect, theme, router],
  );
}
