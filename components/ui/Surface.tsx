import { radii } from "@/constants/theme";
import { Children, Fragment, createContext, useContext, type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { useTheme, type Palette } from "./theme";

/**
 * Whether a row is inside a `Surface`, which draws the separators between its
 * own children. A row reads this instead of taking a prop, so a screen cannot
 * end up with two separators stacked on one edge by forgetting to say where
 * the row is.
 */
const InSurface = createContext(false);

export function useInSurface() {
  return useContext(InSurface);
}

type Props = {
  children: ReactNode;
  /** A heading above the group, as iOS sets over each section of Settings. */
  title?: string;
  /** The heading's colour. `danger` marks a group that undoes something. */
  titleColor?: keyof Palette;
  style?: ViewStyle;
};

/**
 * An inset group of rows — the shape iOS uses wherever settings, an account
 * or a short menu are presented, and the surface a material change lands on
 * for every screen that is not a full-bleed list.
 *
 * Separators sit between children and never after the last, inset to start
 * where the content does. `Children.toArray` drops the nulls a conditional
 * row leaves behind, so `{isAdmin && <Row/>}` does not leave a separator
 * hanging over nothing.
 */
export function Surface({ children, title, titleColor = "textMuted", style }: Props) {
  const theme = useTheme();
  const rows = Children.toArray(children);

  return (
    <View style={styles.group}>
      {title ? (
        <AppText variant="micro" color={titleColor} style={styles.title}>
          {title.toLocaleUpperCase("fi-FI")}
        </AppText>
      ) : null}
      <InSurface.Provider value>
        <View style={[styles.card, { backgroundColor: theme.card }, style]}>
          {rows.map((row, index) => (
            <Fragment key={index}>
              {row}
              {index < rows.length - 1 ? (
                <View
                  style={[styles.separator, { backgroundColor: theme.border }]}
                />
              ) : null}
            </Fragment>
          ))}
        </View>
      </InSurface.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginHorizontal: 16, marginTop: 24 },
  title: { marginLeft: 4, marginBottom: 6 },
  // `hidden` so the rows' own press highlight cannot square off the corners.
  card: { borderRadius: radii.lg, overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
