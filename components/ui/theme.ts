import { colors } from "@/constants/theme";
import { useColorScheme } from "react-native";

/**
 * A colour scheme with the light/dark choice already made.
 *
 * Screens were resolving that choice themselves, once per styled element —
 * `styles.header` paired with `styles.headerDark`, selected by an
 * `isDark &&`. That is where most of the app's near-duplicate hexes came
 * from: every screen that needed a border picked its own grey, because there
 * was nowhere to look one up that already knew which mode it was in.
 *
 * Generalised from `sheetPalette` in `components/sheets/sheetTheme`, which
 * has done exactly this for sheets for a while.
 */
export type Palette = {
  /** Page background for a screen whose content sits on cards. */
  bg: string;
  /** Page background for a full-bleed screen whose rows run edge to edge. */
  bgFlat: string;
  /** A card or row sitting on either background. */
  card: string;

  /** Titles and anything the eye should land on first. */
  text: string;
  /** Supporting copy that still needs to be read. */
  textSecondary: string;
  /** Labels, metadata, timestamps. */
  textMuted: string;
  /** Present, but not meant to compete — chevrons, empty-state icons. */
  textFaint: string;

  border: string;
  /** Anything tappable, selected, or in progress. */
  accent: string;
  /** Fill behind an accent icon or a quiet accent button. */
  accentTint: string;
  placeholder: string;
  /** Destructive actions — removing, blocking, reporting. */
  danger: string;
};

const LIGHT: Palette = {
  bg: colors.bg,
  bgFlat: colors.bgFlat,
  card: colors.card,
  text: colors.text,
  textSecondary: colors.textSecondary,
  textMuted: colors.textMuted,
  textFaint: colors.textFaint,
  border: colors.border,
  accent: colors.accent,
  accentTint: colors.accentTint,
  placeholder: colors.placeholder,
  danger: colors.danger,
};

const DARK: Palette = {
  bg: colors.bgDark,
  // A full-bleed screen has no lighter page colour to fall back to in dark
  // mode — the rows are what stand out, and they are already lighter.
  bgFlat: colors.bgDark,
  card: colors.cardDark,
  text: colors.textOnDark,
  textSecondary: colors.textSecondaryDark,
  // Muted is the one role that does not invert: #888 reads the same against
  // both backgrounds, and every screen already used it unchanged in dark.
  textMuted: colors.textMuted,
  textFaint: colors.textFaintDark,
  border: colors.borderDark,
  accent: colors.accentDark,
  accentTint: colors.accentTintDark,
  placeholder: colors.placeholderDark,
  danger: colors.danger,
};

export type Theme = Palette & { isDark: boolean };

/**
 * Built once per scheme rather than per render. A fresh object each time
 * would give every `useTheme` consumer a new dependency identity, defeating
 * the `useMemo`s and `StyleSheet` arrays the screens build from it.
 */
const LIGHT_THEME: Theme = { ...LIGHT, isDark: false };
const DARK_THEME: Theme = { ...DARK, isDark: true };

export function palette(isDark: boolean): Palette {
  return isDark ? DARK : LIGHT;
}

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK_THEME : LIGHT_THEME;
}
