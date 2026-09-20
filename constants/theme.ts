/**
 * Shared visual tokens.
 *
 * Screens are being migrated onto these as they are touched, so a literal
 * colour still sitting in a StyleSheet is simply one that has not been moved
 * yet — not a deliberate exception. Prefer adding a token here over inventing
 * another near-duplicate hex.
 */

export const colors = {
  /** The one accent. Anything tappable, selected, or in progress uses it. */
  accent: "#3478F5",
  /** The same accent on a dark surface, where the light one goes muddy. */
  accentDark: "#51A2FF",
  /** Fill behind an accent icon or a quiet accent button. */
  accentTint: "#EEF4FF",
  accentTintDark: "#51A2FF1F",

  /** Titles and anything the eye should land on first. */
  text: "#222",
  /** Supporting copy that still needs to be read. */
  textSecondary: "#666",
  /**
   * The same role on a dark surface. Not the light value, which disappears
   * against `bgDark`; this is the one `sheet.textSecondaryDark` already uses.
   */
  textSecondaryDark: "#AEB4BE",
  /** Labels, metadata, timestamps. */
  textMuted: "#888",
  /** Text that is present but not meant to compete. */
  textFaint: "#AAA",
  /**
   * Faint on a dark surface goes *darker*, not lighter — the same inversion
   * `placeholderDark` documents. A lighter grey here would outrank the
   * secondary text it is meant to sit beneath.
   */
  textFaintDark: "#666",
  textOnDark: "#fff",

  /**
   * Input placeholders. Not simply `textFaint` in both themes: on a dark
   * field the faint grey reads as filled-in text, so the dark variant goes
   * *darker* rather than lighter.
   */
  placeholder: "#AAA",
  placeholderDark: "#777",

  /** Page background behind the cards. */
  bg: "#f5f5f5",
  bgDark: "#18191B",
  /**
   * The page background for a full-bleed screen — one whose rows run edge to
   * edge instead of sitting on cards. Light mode goes white so the rows have
   * nothing to sit against; dark mode stays `bgDark`, which the rows are
   * already lighter than. 15 screens use this pairing.
   */
  bgFlat: "#fff",
  /** A card, row, or header sitting on `bg`. */
  card: "#fff",
  cardDark: "#232427",

  border: "#eee",
  borderDark: "#333",

  /** Destructive actions — removing, blocking, reporting. */
  danger: "#D92D20",
} as const;

/**
 * Bottom sheets.
 *
 * Every sheet in the app — the map sheet, room, friend, day picker and the
 * canteen queue — is built from these, so they read as one component rather
 * than five that happen to slide up from the bottom. Pair with
 * `sheetChrome`/`sheetPalette` in `components/sheets/sheetTheme`.
 */
export const sheet = {
  /** The sheet's own surface. Cards sit on it; flat lists sit directly on it. */
  surface: "#F7F8FA",
  surfaceDark: "#16181C",
  /** A card, row or state block sitting on `surface`. */
  card: "#FFFFFF",
  cardDark: "#202226",
  /** The grab handle. */
  handle: "#C6CBD3",
  handleDark: "#626874",
  /**
   * A hairline along the sheet's top edge, dark mode only: the surface is
   * close enough to the dimmed page behind it that the two otherwise blend.
   */
  edgeDark: "#3A3D42",
  text: "#14171C",
  textDark: "#F5F7FA",
  textSecondary: "#657080",
  textSecondaryDark: "#AEB4BE",
  /** Corner radius of the sheet itself, not of the cards inside it. */
  radius: 16,
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

/**
 * The default colour for a person who has not picked one. Deliberately not
 * `accent`: it identifies a user, and reusing the accent would make every
 * default avatar read as a piece of app chrome.
 */
export const DEFAULT_USER_COLOR = "#2b7fff";
