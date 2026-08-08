import { AuthProvider } from "@/context/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, useColorScheme } from "react-native";

const FABLAB_ENABLED_STORAGE_KEY = "fablabEnabled";

export default function TabLayout() {
  const isDark = useColorScheme() === "dark";
  const [isFablabEnabled, setIsFablabEnabled] = useState(false);
  const segments = useSegments();
  useEffect(() => {
    const loadFablabFlag = async () => {
      try {
        const value = await AsyncStorage.getItem(FABLAB_ENABLED_STORAGE_KEY);
        setIsFablabEnabled(value === "true");
      } catch (error) {
        console.error("Failed to read Fablab flag:", error);
      }
    };

    loadFablabFlag();
  }, [segments]);

  return (
    <AuthProvider>
      <Tabs
        initialRouteName="home"
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
          name="home"
          options={{
            title: "Wilma",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="school" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="fablab"
          options={{
            title: "FabLab",
            href: isFablabEnabled ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons
                name="precision-manufacturing"
                size={size}
                color={color}
              />
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
