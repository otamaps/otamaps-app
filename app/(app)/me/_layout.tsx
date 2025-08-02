import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

export default function Layout() {
  const isDark = useColorScheme() === "dark";

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
      // screenOptions={{
      //   headerShown: false, this disables our custom header in me branch
      // }}
      >
        <Stack.Screen name="about" options={{ title: "Tietoja" }} />
        <Stack.Screen name="settings" options={{ title: "Asetukset" }} />
        <Stack.Screen
          name="wilma/index"
          options={{ title: "Yhdistetään Wilma-tili" }}
        />
      </Stack>
    </>
  );
}
