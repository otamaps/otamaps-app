import React from "react";
import {
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Fablab = () => {
  const isDark = useColorScheme() === "dark";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? "#1e1e1e" : "transparent", flexDirection: "column", padding: 16 }}
    >
      <View style={styles.item}>
        <Text>

        </Text>
      </View>
      <View style={styles.itemContainer}>
        <View style={styles.item}>
          
        </View>
        <View style={styles.item}>

        </View>
      </View>
    </SafeAreaView>
  );
};

export default Fablab;

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#f0f0f0",
    height: 100,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",

  }
});
