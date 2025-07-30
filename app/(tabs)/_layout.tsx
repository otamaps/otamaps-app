import useBLEScanner from "@/components/functions/bleScanner";
import { AuthProvider } from "@/context/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function TabLayout() {
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
            },
            default: {},
          }),
        }}
      >
        <Tabs.Screen
          name="debug"
          options={{
            title: "Debug",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="bug-report" size={size} color={color} />
            ),
          }}
        />
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
