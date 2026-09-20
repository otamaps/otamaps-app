import { Stack } from "expo-router";
import type { ComponentProps } from "react";

type HeaderOptions = NonNullable<ComponentProps<typeof Stack.Screen>["options"]>;

type Args = {
  title: string;
  /** Adds the system search bar beneath the large title. */
  search?: {
    placeholder: string;
    onChangeText: (text: string) => void;
  };
};

/**
 * The options every screen on the platform navigation bar spreads, so the
 * three iOS 26 details below are fixed once rather than rediscovered per
 * screen. Pass the result straight to `Stack.Screen`.
 */
export function nativeHeader({ title, search }: Args): HeaderOptions {
  return {
    headerShown: true,
    title,
    headerLargeTitle: true,
    headerBackButtonDisplayMode: "minimal",

    // iOS 26 draws the bar over the scroll view rather than above it, so at
    // the default the rows stay fully legible straight through the title.
    // `hard` gives the bar a firm edge to cut them off at; `soft` fades them
    // out instead, if the content should dissolve under the glass rather
    // than stop against it.
    scrollEdgeEffects: { top: "hard" },

    // The system default is 34pt, which a long Finnish title fills edge to
    // edge — "Tilojen lukujärjestykset" leaves no margin at all.
    headerLargeTitleStyle: { fontSize: 30 },

    ...(search
      ? {
          headerSearchBarOptions: {
            // iOS 26 resolves `automatic` to `integrated`, folding the field
            // into the bar — which renders nothing whatsoever on a screen
            // that has no other bar items.
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
