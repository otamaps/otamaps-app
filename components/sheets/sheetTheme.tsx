import { HAS_LIQUID_GLASS } from "@/components/map/GlassSurface";
import { colors, sheet } from "@/constants/theme";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";
import { GlassView } from "expo-glass-effect";
import React, { useId, useState } from "react";
import {
  StyleSheet,
  useColorScheme,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

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
  backgroundComponent: React.FC<BottomSheetBackgroundProps>;
  handleStyle: ViewStyle;
  handleIndicatorStyle: ViewStyle;
};

const EDGE_WIDTH = 1;

/**
 * Where the corner arc passes 45°, measured down from the top as a fraction of
 * the radius: `r - r·sin45° ≈ 0.293r`. The edge is solid down to there and
 * fades to nothing over the remainder of the curve, so it never turns into a
 * hairline running down the sheet's sides.
 */
const ARC_MIDPOINT = 1 - Math.SQRT1_2;

/**
 * A border cannot follow a rounded corner and fade at the same time — React
 * Native strokes each side flat, and stops at the arc. So the edge is drawn as
 * a stroked path instead, with a vertical gradient doing the fade.
 */
function makeSheetBackground(isDark: boolean): React.FC<BottomSheetBackgroundProps> {
  const surface = isDark ? sheet.surfaceDark : sheet.surface;
  const radius = sheet.radius;

  function SheetBackground({ style, pointerEvents }: BottomSheetBackgroundProps) {
    const [width, setWidth] = useState(0);
    // `useId` returns delimiters (`:r0:`, `«r0»`) that are not valid in an XML
    // id, and so break the `url(#…)` reference on some renderers.
    const gradientId = `sheet-edge-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    const onLayout = (event: LayoutChangeEvent) =>
      setWidth(event.nativeEvent.layout.width);

    // Half the stroke, so the line sits inside the view rather than clipped.
    const inset = EDGE_WIDTH / 2;
    const r = radius - inset;
    const edgePath =
      `M ${inset} ${radius}` +
      ` A ${r} ${r} 0 0 1 ${radius} ${inset}` +
      ` L ${width - radius} ${inset}` +
      ` A ${r} ${r} 0 0 1 ${width - inset} ${radius}`;

    return (
      <View
        pointerEvents={pointerEvents}
        onLayout={onLayout}
        style={[
          style,
          {
            backgroundColor: surface,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          },
        ]}
      >
        {isDark && width > radius * 2 ? (
          <Svg
            pointerEvents="none"
            width={width}
            height={radius + EDGE_WIDTH}
            style={styles.edge}
          >
            <Defs>
              <LinearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={0}
                x2={0}
                y2={radius}
              >
                <Stop offset={0} stopColor={sheet.edgeDark} stopOpacity={1} />
                <Stop
                  offset={ARC_MIDPOINT}
                  stopColor={sheet.edgeDark}
                  stopOpacity={1}
                />
                <Stop offset={1} stopColor={sheet.edgeDark} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path
              d={edgePath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={EDGE_WIDTH}
            />
          </Svg>
        ) : null}
      </View>
    );
  }

  return SheetBackground;
}

// Built once per theme: `sheetChrome` is called inline while rendering, and a
// fresh component identity there would remount the background on every pass.
const SHEET_BACKGROUND_LIGHT = makeSheetBackground(false);
const SHEET_BACKGROUND_DARK = makeSheetBackground(true);

const styles = StyleSheet.create({
  edge: { position: "absolute", top: 0, left: 0 },
});

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
    backgroundComponent: isDark ? SHEET_BACKGROUND_DARK : SHEET_BACKGROUND_LIGHT,
    // Transparent so the handle does not paint over the edge it sits on.
    handleStyle: {
      backgroundColor: "transparent",
      ...corners,
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

/**
 * UIKit's own list colours, for content laid out as a native list — the map
 * sheet's friends list. Translucent on purpose: they are what iOS draws on
 * top of materials, so they hold up on glass as well as on a solid sheet.
 */
export function nativeListColors(isDark: boolean) {
  return {
    /** `tertiarySystemFill` — a search field, a filled cell. */
    fill: isDark ? "rgba(118,118,128,0.24)" : "rgba(118,118,128,0.12)",
    /** A row while pressed — `systemFill`, a step stronger than `fill`. */
    highlight: isDark ? "rgba(120,120,128,0.36)" : "rgba(120,120,128,0.2)",
    /** `separator`. */
    separator: isDark ? "rgba(84,84,88,0.6)" : "rgba(60,60,67,0.29)",
    /** `label`, `secondaryLabel`, `tertiaryLabel`. */
    label: isDark ? "#FFFFFF" : "#000000",
    secondaryLabel: isDark ? "rgba(235,235,245,0.6)" : "rgba(60,60,67,0.6)",
    tertiaryLabel: isDark ? "rgba(235,235,245,0.3)" : "rgba(60,60,67,0.3)",
  };
}

/** iOS 26's sheet corner: a sheet resting part-way up is rounded all round. */
const GLASS_SHEET_RADIUS = 34;

/**
 * How solid the glass is: the sheet's own surface colour, tinted into the
 * material at this opacity. Plain glass let too much of the map through
 * behind a list of names; a tint keeps the glass's edges and refraction,
 * where a solid layer painted on top would cover them.
 */
const SHEET_TINT_ALPHA = 0.6;

function GlassSheetBackground({ style }: BottomSheetBackgroundProps) {
  const isDark = useColorScheme() === "dark";
  const surface = isDark ? sheet.surfaceDark : sheet.surface;
  return (
    <GlassView
      pointerEvents="none"
      glassEffectStyle="regular"
      colorScheme={isDark ? "dark" : "light"}
      tintColor={withAlpha(surface, SHEET_TINT_ALPHA)}
      style={[style, glassStyles.glass]}
    />
  );
}

/** `#RRGGBB` plus an opacity, as `#RRGGBBAA`. */
function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `${hex}${byte}`;
}

/**
 * A sheet as iOS 26 draws its own over Maps: Liquid Glass, with the system
 * grabber — the map's own sheet and the friend profile over it. Where
 * Liquid Glass is unavailable it falls back to the app's solid `sheetChrome`.
 * Spread `chrome` onto the sheet and compose `style` into its own; a sheet's
 * content must be transparent (`HAS_LIQUID_GLASS`) for the glass to show.
 */
export function glassSheetChrome(isDark: boolean) {
  if (!HAS_LIQUID_GLASS) {
    return { chrome: sheetChrome(isDark), style: sheetShadow };
  }
  return {
    chrome: {
      backgroundComponent: GlassSheetBackground,
      handleStyle: { backgroundColor: "transparent" },
      // UIKit's grabber: 36 by 5, in the tertiary label colour.
      handleIndicatorStyle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: nativeListColors(isDark).tertiaryLabel,
      },
    },
    // Glass casts its own shadow; a second one would muddy its edge.
    style: undefined,
  };
}


const glassStyles = StyleSheet.create({
  glass: {
    borderRadius: GLASS_SHEET_RADIUS,
    borderCurve: "continuous",
  },
});
