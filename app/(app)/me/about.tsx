import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const About = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#1e1e1e" : "#fff";
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "Tietoja",
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
        style={{
          backgroundColor: "white",
          paddingHorizontal: 16,
          borderRadius: 16,
          marginBottom: 16,
        }}
      >
        <Image
          source={require("@/assets/images/otamaps-logo.png")}
          style={{
            resizeMode: "contain",
            width: 200,
            height: 100,
          }}
        />
      </View>

      <Text
        style={{
          marginBottom: 3,
          ...(isDark ? { color: "white" } : { color: "black" }),
          fontSize: 16,
        }}
      >
        Versio {Constants.expoConfig?.version || "0.0.1"} (
        {Constants.expoConfig?.android?.versionCode || ""})
      </Text>
      <Text
        style={{
          marginBottom: 50,
          ...(isDark ? { color: "white" } : { color: "black" }),
          fontSize: 16,
        }}
      >
        Copyright © 2025 Otamaps
      </Text>
      <Text
        style={{
          marginBottom: 20,
          ...(isDark ? { color: "#ffffff70" } : { color: "black" }),
          fontSize: 18,
        }}
      >
        Sponsorit
      </Text>
      <Image
        source={require("@/assets/images/Hallitus_Logo.png")}
        style={{ width: 100, height: 100 }}
        tintColor="gray"
        resizeMode="contain"
      />
      <Text
        style={{
          fontSize: 14,
          marginBottom: 8,
          marginTop: 8,
          fontWeight: "medium",
          ...(isDark ? { color: "#ffffff40" } : { color: "black" }),
        }}
      >
        Otaniemen lukion opiskelijakunnan hallitus
      </Text>
      <View
        style={{
          height: 1,
          backgroundColor: "#eeeeee15",
          marginVertical: 8,
          width: "100%",
          marginBottom: 20,
        }}
      />

      <Image
        source={require("@/assets/images/streetsmarts.png")}
        style={{ width: 100, height: 100 }}
        tintColor="gray"
        resizeMode="contain"
      />
      <Text
        style={{
          fontSize: 14,
          marginBottom: 8,
          marginTop: 8,
          fontWeight: "medium",
          ...(isDark ? { color: "#ffffff40" } : { color: "black" }),
        }}
      >
        Streetsmarts Autokoulu
      </Text>
      <View
        style={{
          height: 1,
          backgroundColor: "#eeeeee15",
          marginVertical: 8,
          width: "100%",
          marginBottom: 20,
        }}
      />
      <Text
        style={{
          fontSize: 16,
          marginBottom: 8,
          fontWeight: "bold",
          ...(isDark ? { color: "#ffffff70" } : { color: "black" }),
        }}
      >
        Otaniemen lukion vanhempainyhdistys
      </Text>
    </View>
  );
};

export default About;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
});
