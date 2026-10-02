import { fonts } from "@/constants/typography";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { nativeListColors } from "@/components/sheets/sheetTheme";
import { getReadableLabelColor } from "@/lib/color";
import {
  friendLocationListLabel,
  knownFriendLocation,
} from "@/lib/friendPresentation";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

interface FriendItemProps {
  friend: {
    id: string;
    name: string;
    status?: "ei sijaintia" | "busy" | string;
    lastSeen?: string | number | null; // Can be ISO string or timestamp
    isFavorite?: boolean;
    color?: string; // Optional color for the icon background
  };
  onPress?: () => void;
}

/** Finnish month names in the partitive, as a date is written: "17. syyskuuta". */
const MONTHS_PARTITIVE = [
  "tammikuuta",
  "helmikuuta",
  "maaliskuuta",
  "huhtikuuta",
  "toukokuuta",
  "kesäkuuta",
  "heinäkuuta",
  "elokuuta",
  "syyskuuta",
  "lokakuuta",
  "marraskuuta",
  "joulukuuta",
];

/**
 * When a friend was last seen. Older than a week, the friends list wants
 * the date as Finnish writes it in prose — "17. syyskuuta", with the year
 * only when it is not this one — while the profile sheet keeps its full
 * numeric date and time. Spelled out here rather than left to
 * `toLocaleDateString`, whose month names vary with the device's Intl data.
 */
export const formatLastSeen = (
  lastSeen?: string | number | null,
  { longDate = false }: { longDate?: boolean } = {}
): string => {
  if (!lastSeen) return "";

  let date: Date;

  if (typeof lastSeen === "string") {
    date = new Date(lastSeen);
  } else {
    date = new Date(lastSeen * 1000); // Convert seconds to milliseconds if needed
  }

  if (isNaN(date.getTime())) return "Ei tietoa";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) return "Nyt";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? "minuutti" : "minuuttia"} sitten`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? "tunti" : "tuntia"} sitten`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  if (days < 7) {
    return `${days} ${days === 1 ? "päivä" : "päivää"} sitten`;
  }

  // For older dates, show the actual date
  if (longDate) {
    const dayMonth = `${date.getDate()}. ${MONTHS_PARTITIVE[date.getMonth()]}`;
    return date.getFullYear() === now.getFullYear()
      ? dayMonth
      : `${dayMonth} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString("fi-FI", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * One friend in the map sheet's list, laid out as a native list row: a round
 * avatar, the name in the system font, where they are and when in secondary
 * text beneath, and the system chevron. Separators come from the list.
 */
const FriendItem: React.FC<FriendItemProps> = ({ friend, onPress }) => {
  const isDark = useColorScheme() === "dark";
  const list = nativeListColors(isDark);
  const statusLabel = friendLocationListLabel(friend.status);
  const lastSeen = friend.lastSeen
    ? formatLastSeen(friend.lastSeen, { longDate: true })
    : "";
  const avatar = friend.color || "#2b7fff";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[friend.name, statusLabel, lastSeen].filter(Boolean).join(", ")}
      style={({ pressed }) => [
        styles.row,
        // A UIKit cell highlights by filling, not by fading.
        pressed && { backgroundColor: list.highlight },
      ]}
      onPress={onPress}
    >
      <View style={[styles.avatar, { backgroundColor: avatar }]}>
        <Text style={[styles.initial, { color: getReadableLabelColor(avatar) }]}>
          {friend.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: list.label }]} numberOfLines={1}>
          {friend.name}
        </Text>
        <View style={styles.subtitleLine}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: getStatusColor(
                  // The raw value, not the label: the label of an unknown
                  // location is "Ei sijaintia vielä", which reads as known.
                  friend.status,
                  friend.lastSeen
                ),
              },
            ]}
          />
          <Text
            style={[styles.subtitle, { color: list.secondaryLabel }]}
            numberOfLines={1}
          >
            {lastSeen ? `${statusLabel} · ${lastSeen}` : statusLabel}
          </Text>
        </View>
      </View>
      <PlatformSymbol
        ios="chevron.right"
        android="chevron_right"
        size={13}
        weight="semibold"
        tintColor={list.tertiaryLabel}
      />
    </Pressable>
  );
};

/** Where a row's separator starts: past the avatar, under the text. */
export const FRIEND_ROW_SEPARATOR_INSET = 16 + 40 + 12;

const getStatusColor = (
  status?: string,
  lastSeen?: string | number | null
) => {
  if (!knownFriendLocation(status)) return "#9E9E9E";
  if (!lastSeen) return "#4CAF50";

  let date: Date;
  if (typeof lastSeen === "string") {
    date = new Date(lastSeen);
  } else {
    date = new Date(lastSeen * 1000);
  }

  if (isNaN(date.getTime())) return "#4CAF50";

  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  // Full color for less than 30 minutes
  if (diffInHours < 0.5) return "#4CAF50";

  // Fade from green to gray between 30 minutes and 6 hours
  if (diffInHours < 6) {
    const fadeFactor = (6 - diffInHours) / 5.5; // Goes from 1 to ~0.09
    const r = Math.round(76 + (158 - 76) * (1 - fadeFactor));
    const g = Math.round(175 + (158 - 175) * (1 - fadeFactor));
    const b = Math.round(80 + (158 - 80) * (1 - fadeFactor));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // After 6 hours, return gray
  return "#9E9E9E";
};

// Type set through `fonts`, so it follows `IOS_TYPEFACE` with the rest of the app.
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  initial: { ...fonts.semiBold, fontSize: 17 },
  text: { flex: 1 },
  name: { ...fonts.regular, fontSize: 17 },
  subtitleLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  subtitle: { ...fonts.regular, fontSize: 13, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});

export default FriendItem;
