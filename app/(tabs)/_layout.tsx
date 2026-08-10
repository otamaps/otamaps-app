import { AuthProvider } from "@/context/AuthContext";
import { FABLAB_VISIBLE } from "@/constants/features";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform, useColorScheme } from "react-native";

export default function TabLayout() {
  const isDark = useColorScheme() === "dark";

  return (
    <AuthProvider>
      <NativeTabs
        backBehavior="initialRoute"
        minimizeBehavior="onScrollDown"
        tintColor={isDark ? "#51A2FF" : "#276CE5"}
        iconColor={{
          default: isDark ? "#A1A1AA" : "#6B7280",
          selected: isDark ? "#51A2FF" : "#276CE5",
        }}
        labelStyle={{
          default: { color: isDark ? "#A1A1AA" : "#6B7280" },
          selected: { color: isDark ? "#51A2FF" : "#276CE5" },
        }}
        backgroundColor={
          Platform.OS === "android"
            ? isDark
              ? "#171717"
              : "#FFFFFF"
            : undefined
        }
        indicatorColor={
          Platform.OS === "android"
            ? isDark
              ? "#1E3A5F"
              : "#DCEAFF"
            : undefined
        }
        tabBarRespectsIMEInsets
      >
        <NativeTabs.Trigger
          name="home"
          disableTransparentOnScrollEdge
        >
          <NativeTabs.Trigger.Label>Wilma</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "graduationcap", selected: "graduationcap.fill" }}
            md={{ default: "school", selected: "school" }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="fablab"
          hidden={!FABLAB_VISIBLE}
          disableTransparentOnScrollEdge
        >
          <NativeTabs.Trigger.Label>FabLab</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "printer", selected: "printer.fill" }}
            md={{
              default: "precision_manufacturing",
              selected: "precision_manufacturing",
            }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="map"
          disableTransparentOnScrollEdge
        >
          <NativeTabs.Trigger.Label>Kartta</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "map", selected: "map.fill" }}
            md={{ default: "map", selected: "map" }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="me"
          disableTransparentOnScrollEdge
        >
          <NativeTabs.Trigger.Label>Minä</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "person", selected: "person.fill" }}
            md={{ default: "person", selected: "person" }}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </AuthProvider>
  );
}
