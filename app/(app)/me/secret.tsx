import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Button,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const Settings = () => {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    AsyncStorage.getItem("isDebugMode").then((value) => {
      if (value !== null) setIsDebugMode(value === "true");
    });
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDark && { backgroundColor: "#1e1e1e" },
        { padding: 0 },
      ]}
    >
      <Stack.Screen
        options={{
          title: "Secret",
          headerStyle: {
            backgroundColor: isDark ? "#1e1e1e" : "#fff",
          },
          headerTitleStyle: {
            color: isDark ? "#fff" : "#000",
          },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#4A89EE" />
            </Pressable>
          ),
        }}
      />
      <View
        style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      >
        <StatusBar style={isDark ? "light" : "dark"} />

        <View
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <Text
            style={{
              color: isDark ? "#fff" : "#000",
              fontSize: 18,
              marginBottom: 16,
            }}
          >
            Moi
          </Text>
          {isDebugMode && (
            <Text
              style={{
                color: isDark ? "#fff" : "#000",
                fontSize: 18,
                marginBottom: 16,
              }}
            >
              Debug mode is enabled!
            </Text>
          )}

          <Button
            onPress={() => Linking.openURL("https://manual.avolites.com/")}
            title="Tap me"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Figtree-Bold",
    color: "#333",
    paddingVertical: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    color: "#333",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: "Figtree-Regular",
    color: "#666",
  },
  permissionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionGranted: {
    backgroundColor: "#e8f0fe",
  },
  permissionDenied: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  permissionButtonText: {
    fontSize: 14,
    fontFamily: "Figtree-SemiBold",
  },
  optionContainer: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionContainerPressed: {
    opacity: 0.7,
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 4,
  },
});

export default Settings;
