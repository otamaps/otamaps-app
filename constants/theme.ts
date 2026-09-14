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
  /** Labels, metadata, timestamps. */
  textMuted: "#888",
  /** Text that is present but not meant to compete. */
  textFaint: "#AAA",
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
  /** A card, row, or header sitting on `bg`. */
  card: "#fff",
  cardDark: "#232427",

  border: "#eee",
  borderDark: "#333",

  /** Destructive actions — removing, blocking, reporting. */
  danger: "#D92D20",
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
