import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import { Platform } from "react-native";

type NativeProps = {
  titles: string[];
  selectedIndex: number;
  onScopeChange: (event: { nativeEvent: { index: number } }) => void;
};

const NativeView: ComponentType<NativeProps> | null =
  Platform.OS === "ios" && requireOptionalNativeModule("SearchScopeBar")
    ? requireNativeView<NativeProps>("SearchScopeBar")
    : null;

/**
 * Whether this build can put a selector in the navigation bar's search
 * field, as its scope bar. When it can't — Android, or an iOS build made
 * before this module existed — show the selector in the page instead.
 */
export const SEARCH_SCOPE_BAR = NativeView !== null;

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
};

/**
 * The selector as the scope bar of the screen's own search field: a
 * segmented control inside the navigation bar, beneath the field, always
 * shown. The screen must have a search field (`searchPlaceholder` on
 * `useNativeHeader`). Renders nothing in the page itself; check
 * `SEARCH_SCOPE_BAR` before relying on it.
 */
export function SearchScopeBar<T extends string>({ value, onChange, options }: Props<T>) {
  if (!NativeView) return null;
  return (
    <NativeView
      titles={options.map(([, label]) => label)}
      selectedIndex={Math.max(0, options.findIndex(([option]) => option === value))}
      onScopeChange={(event) => {
        const option = options[event.nativeEvent.index];
        if (option) onChange(option[0]);
      }}
    />
  );
}

/**
 * Whether a screen's selector can go in its bar: this build has the scope
 * bar, and the header given to `Stack.Screen` has a search field to carry it.
 * When false, render the selector in the page instead.
 */
export function scopeBarIn(header: unknown): boolean {
  return (
    SEARCH_SCOPE_BAR &&
    typeof header === "object" &&
    header !== null &&
    "headerSearchBarOptions" in header &&
    !!(header as { headerSearchBarOptions?: unknown }).headerSearchBarOptions
  );
}
