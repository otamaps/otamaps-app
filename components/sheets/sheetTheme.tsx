import { colors, sheet } from "@/constants/theme";
import { StyleSheet, type ViewStyle } from "react-native";

/**
 * The colours a sheet's *contents* are drawn from. Kept next to `sheetChrome`
 * so a sheet cannot pick up the shared shell and then paint its own cards in
 * some near-duplicate hex.
 */
export type SheetPalette = {
  /** The sheet's background — also the colour any full-bleed content must use. */
  surface: string;
  /** A card or row sitting on `surface`. */
  card: string;
  text: string;
  textSecondary: string;
  accent: string;
};

export function sheetPalette(isDark: boolean): SheetPalette {
  return {
    surface: isDark ? sheet.surfaceDark : sheet.surface,
    card: isDark ? sheet.cardDark : sheet.card,
    text: isDark ? sheet.textDark : sheet.text,
    textSecondary: isDark ? sheet.textSecondaryDark : sheet.textSecondary,
    accent: colors.accent,
  };
}

type SheetChrome = {
  backgroundStyle: ViewStyle;
  handleStyle: ViewStyle;
  handleIndicatorStyle: ViewStyle;
};

/**
 * The shell props every `BottomSheet` / `BottomSheetModal` in the app spreads
 * onto itself, so the surface, corner radius and grab handle are identical
 * wherever a sheet comes up.
 */
export function sheetChrome(isDark: boolean): SheetChrome {
  const surface = isDark ? sheet.surfaceDark : sheet.surface;
  const corners = {
    borderTopLeftRadius: sheet.radius,
    borderTopRightRadius: sheet.radius,
  };
  return {
    backgroundStyle: { backgroundColor: surface, ...corners },
    handleStyle: {
      backgroundColor: surface,
      ...corners,
      ...(isDark ? { borderTopWidth: 1, borderTopColor: sheet.edgeDark } : null),
    },
    handleIndicatorStyle: {
      width: 40,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: isDark ? sheet.handleDark : sheet.handle,
    },
  };
}

/**
 * The lift every sheet sits on. Compose it into the sheet's `style` prop —
 * it is separate from `sheetChrome` because a sheet may have its own
 * container style (z-index, padding) to merge it with.
 */
export const sheetShadow = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 24,
  },
}).shadow;
