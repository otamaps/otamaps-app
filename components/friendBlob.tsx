import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface FriendBlobProps {
  onClick: (friendId: string) => void;
  friendId: string;
  name: string;
  color?: string;
}

const FriendBlob: React.FC<FriendBlobProps> = ({
  onClick,
  friendId,
  name,
  color,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: color || "#2b7fff" }]}
      onPress={() => onClick(friendId)}
      activeOpacity={0.7}
    >
      <View style={styles.circle}>
        {/* <Image
          source={{
            uri: `https://api.dicebear.com/9.x/initials/webp?seed=${encodeURIComponent(
              name
            )}&scale=80`,
          }}
          style={styles.profilePicture}
          resizeMode="cover"
        /> */}
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontFamily: "Figtree-SemiBold",
          }}
        >
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    overflow: "visible",
  },
  circle: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "white",
  },
  profilePicture: {
    width: "100%",
    height: "100%",
  },
});

export default FriendBlob;
