import Slider from "@react-native-community/slider";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

// Matches iOS system-color vibrancy (e.g. systemBlue #007AFF, systemRed
// #FF3B30) rather than a muted pastel tint.
const SATURATION = 0.82;
const VALUE = 0.96;

export function hueToHex(
  h: number,
  s: number = SATURATION,
  v: number = VALUE,
): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => hueToHex(h));

function hexToHue(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let h = 0;
  if (max === r) h = 60 * (((g - b) / delta) % 6);
  else if (max === g) h = 60 * ((b - r) / delta + 2);
  else h = 60 * ((r - g) / delta + 4);
  if (h < 0) h += 360;

  return h;
}

type HueSliderProps = {
  color: string;
  onChange: (hex: string) => void;
  trackHeight?: number;
  borderColor?: string;
};

const HueSlider = ({
  color,
  onChange,
  trackHeight = 12,
  borderColor = "#00000010",
}: HueSliderProps) => {
  const hue = hexToHue(color);

  return (
    <View style={{ justifyContent: "center" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          height: trackHeight,
          borderRadius: trackHeight / 2,
          overflow: "hidden",
          borderWidth: 1,
          borderColor,
        }}
      >
        <Svg width="100%" height={trackHeight}>
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              {HUE_STOPS.map((stopColor, i) => (
                <Stop
                  key={i}
                  offset={i / (HUE_STOPS.length - 1)}
                  stopColor={stopColor}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={trackHeight} fill="url(#hue)" />
        </Svg>
      </View>
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={0}
        maximumValue={359}
        value={hue}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor={color}
        onValueChange={(value) => onChange(hueToHex(value))}
      />
    </View>
  );
};

export default HueSlider;
