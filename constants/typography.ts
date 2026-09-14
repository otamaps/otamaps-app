import { StyleSheet } from "react-native";

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
    fontFamily: "Figtree-Bold",
    fontSize: 32,
    lineHeight: 40,
  },
  heading2: {
    fontFamily: "Figtree-Bold",
    fontSize: 28,
    lineHeight: 36,
  },
  heading3: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 24,
    lineHeight: 32,
  },
  /** A screen's own title, printed in the body rather than the nav bar. */
  title: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 20,
    lineHeight: 26,
  },
  /** The title inside a back-navigation header. */
  navTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
    lineHeight: 22,
  },
  /** A section heading within a scrolling screen. */
  sectionTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    lineHeight: 21,
  },
  /** The leading line of a list row or card. */
  rowTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  bodyLarge: {
    fontFamily: "Figtree-Regular",
    fontSize: 18,
    lineHeight: 28,
  },
  body: {
    fontFamily: "Figtree-Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  /** The supporting line under a row title — room, teacher, timestamp. */
  meta: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  /** Pills and badges: the smallest size that still reads at a glance. */
  micro: {
    fontFamily: "Figtree-Medium",
    fontSize: 11,
    lineHeight: 14,
  },
  button: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    fontFamily: "Figtree-Regular",
    fontSize: 16,
    lineHeight: 24,
  },
});

/**
 * Figtree ships as four separate faces. Always name the face — a numeric
 * `fontWeight` makes the platform synthesize a weight from the regular face,
 * which renders visibly differently from the real one.
 */
export const FONT_FAMILY = {
  regular: "Figtree-Regular",
  medium: "Figtree-Medium",
  semiBold: "Figtree-SemiBold",
  bold: "Figtree-Bold",
} as const;
