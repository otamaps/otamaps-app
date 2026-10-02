import { Platform, StyleSheet, type TextStyle } from "react-native";

/**
 * A weight of the app's typeface, to spread into a text style:
 * `{ ...fonts.semiBold, fontSize: 15 }`.
 *
 * iOS sets type in the system font, SF Pro, as the platform's own screens
 * and the native navigation bar already do — so a screen no longer mixes
 * SF Pro in its bar with Figtree beneath it. Android keeps Figtree, whose
 * four faces must each be named outright: a numeric `fontWeight` there
 * makes the platform synthesize the weight from the regular face, which
 * renders visibly differently from the real one. On iOS a numeric weight
 * is exactly right, since SF Pro is variable.
 */
/**
 * The typeface iOS sets the app in: `"system"` for SF Pro, `"figtree"` for
 * the brand face. One switch for the whole app, kept while the two are
 * compared side by side. Android is Figtree either way.
 */
export const IOS_TYPEFACE: "system" | "figtree" = "figtree";

function face(weight: TextStyle["fontWeight"], figtree: string): TextStyle {
  return Platform.OS === "ios" && IOS_TYPEFACE === "system"
    ? { fontWeight: weight }
    : { fontFamily: figtree };
}

export const fonts = {
  regular: face("400", "Figtree-Regular"),
  medium: face("500", "Figtree-Medium"),
  semiBold: face("600", "Figtree-SemiBold"),
  bold: face("700", "Figtree-Bold"),
} as const;

/**
 * The app's type scale.
 *
 * The sizes are the ones the screens already use rather than a tidy
 * theoretical ramp — 13/14/15/16 carry most of the UI, so those have names
 * instead of being spelled out inline. Every entry carries a `lineHeight`,
 * which most inline styles were missing; that is the main thing adopting an
 * entry buys you.
 *
 * Colour is deliberately absent: pair these with `colors` from
 * `constants/theme`, so one screen can render `rowTitle` in
 * `colors.text` and another in `colors.textOnDark`.
 */
export const typography = StyleSheet.create({
  heading1: {
    ...fonts.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  heading2: {
    ...fonts.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  heading3: {
    ...fonts.semiBold,
    fontSize: 24,
    lineHeight: 32,
  },
  /** A screen's own title, printed in the body rather than the nav bar. */
  title: {
    ...fonts.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  /** The title inside a back-navigation header. */
  navTitle: {
    ...fonts.semiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  /** A section heading within a scrolling screen. */
  sectionTitle: {
    ...fonts.semiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  /** The leading line of a list row or card. */
  rowTitle: {
    ...fonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  bodyLarge: {
    ...fonts.regular,
    fontSize: 18,
    lineHeight: 28,
  },
  body: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  /** The supporting line under a row title — room, teacher, timestamp. */
  meta: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    ...fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Pills and badges: the smallest size that still reads at a glance. */
  micro: {
    ...fonts.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  /** A filled button's label — the same size UIKit sets its own at. */
  button: {
    ...fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  input: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
});

