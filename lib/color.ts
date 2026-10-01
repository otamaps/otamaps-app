function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function toHex(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

// WCAG relative luminance.
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  );
}

// WCAG contrast ratio between two colors, from 1 (no contrast) to 21.
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - amount;
  return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
}

// Text color for a label sitting on `backgroundHex`: white when that gives
// enough contrast (e.g. blue, red, purple), otherwise a darker shade of the
// background itself (e.g. yellow, mint) instead of an unrelated color.
export function getReadableLabelColor(
  backgroundHex: string,
  minContrast = 3,
): string {
  if (contrastRatio(backgroundHex, "#ffffff") >= minContrast) {
    return "#ffffff";
  }
  return darken(backgroundHex, 0.7);
}
