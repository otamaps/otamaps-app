import { typography } from "@/constants/typography";
import { Text, type TextProps } from "react-native";
import { useTheme, type Palette } from "./theme";

type Props = TextProps & {
  /** An entry from the type scale. Carries the `lineHeight` inline styles miss. */
  variant?: keyof typeof typography;
  /** A role from the palette, already resolved for the current scheme. */
  color?: keyof Palette;
};

/**
 * Type and colour, bound together.
 *
 * `typography` deliberately omits colour so one screen can print `rowTitle`
 * dark and another light — which left every call site pairing a variant with
 * an `isDark &&` colour override by hand. This does that pairing once.
 */
export function AppText({ variant = "body", color = "text", style, ...rest }: Props) {
  const theme = useTheme();
  return <Text style={[typography[variant], { color: theme[color] }, style]} {...rest} />;
}
