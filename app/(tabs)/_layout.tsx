import useBLEScanner from "@/components/functions/bleScanner";
import { AuthProvider } from "@/context/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, useColorScheme } from "react-native";

export default function TabLayout() {
  const isDark = useColorScheme() === "dark";
  useBLEScanner();

  return (
    <AuthProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: "absolute",
              backgroundColor: isDark ? "#171717" : "white",
              borderTopColor: isDark ? "transparent" : "",
            },
            default: {
              backgroundColor: isDark ? "#171717" : "white",
            },
          }),
          tabBarActiveTintColor: isDark ? "#51a2ff" : "#2b7fff",
          tabBarInactiveTintColor: isDark ? "gray" : "gray",
        }}
      >
        <Tabs.Screen
          name="map"
          options={{
            title: "Kartta",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="map" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: "Minä",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </AuthProvider>
  );
}
