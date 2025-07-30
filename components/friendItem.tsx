import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
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
    status?: "away" | "busy" | "at school";
    lastSeen?: string | number; // Can be ISO string or timestamp
    isFavorite?: boolean;
  };
  onPress?: () => void;
}

export const formatLastSeen = (lastSeen?: string | number): string => {
  if (!lastSeen) return "";

  let date: Date;

  if (typeof lastSeen === "string") {
    date = new Date(lastSeen);
  } else {
    date = new Date(lastSeen * 1000); // Convert seconds to milliseconds if needed
  }

  if (isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) return "Just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  // For older dates, show the actual date
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const FriendItem: React.FC<FriendItemProps> = ({ friend, onPress }) => {
  const isDark = useColorScheme() === "dark";
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        isDark && pressed && { backgroundColor: "#2b7fff10" },
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Image
          source={{
            uri: `https://api.dicebear.com/9.x/initials/webp?seed=${encodeURIComponent(
              friend.name
            )}&scale=90`,
          }}
          style={[styles.profilePicture]}
        />
      </View>
      <View style={styles.detailsContainer}>
        <Text
          style={[styles.friendName, isDark && { color: "#fff" }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {friend.name}
        </Text>
        <View style={styles.metaContainer}>
          {friend.status && (
            <View style={styles.metaItem}>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor: getStatusColor(
                      friend.status,
                      friend.lastSeen
                    ),
                  },
                ]}
              />
              <Text style={[styles.metaText, isDark && { color: "#d4d4d4" }]}>
                {friend.status.charAt(0).toUpperCase() + friend.status.slice(1)}
              </Text>
            </View>
          )}
          {friend.lastSeen && (
            <View style={styles.metaItem}>
              <MaterialIcons
                name="schedule"
                size={14}
                color={isDark ? "#d4d4d4" : "#666"}
              />
              <Text style={[styles.metaText, isDark && { color: "#d4d4d4" }]}>
                {formatLastSeen(friend.lastSeen)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={24}
        color={isDark ? "#B5B5B5" : "#B5B5B5"}
      />
    </Pressable>
  );
};

const getStatusColor = (status?: string, lastSeen?: string | number) => {
  // For non-'at school' statuses, return their respective colors
  if (status !== "at school") {
    switch (status) {
      case "busy":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  }

  // For 'at school' status, calculate fade based on lastSeen
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

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 16,
    marginVertical: 6,
    marginHorizontal: 16,
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: "#f8f8f8",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EFF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  detailsContainer: {
    flex: 1,
    marginRight: 8,
  },
  friendName: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    color: "#333",
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
    fontFamily: "Figtree-Regular",
  },
  profilePicture: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 6,
    marginRight: 4,
  },
});

export default FriendItem;
