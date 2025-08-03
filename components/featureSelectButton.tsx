import { Entypo, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

const FeatureSelectButton = ({
  feature,
  onPress,
  icon,
  title,
  selected,
}: any) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.7 : 1 },
        styles.container,
        selected
          ? { backgroundColor: "#d1e7dd" }
          : { backgroundColor: "#f0f0f0" },
      ]}
    >
      {icon === "blackboard" ? (
        <Entypo name={icon} size={26} color="black" />
      ) : (
        <MaterialIcons name={icon} size={28} color="black" />
      )}
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
};

export default FeatureSelectButton;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    flexDirection: "row",
    width: "33%",
    margin: 4,
  },
  text: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    paddingLeft: 8,
  },
});
