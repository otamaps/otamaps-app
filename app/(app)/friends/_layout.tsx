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
        <Stack.Screen name="add" options={{ title: "Lisää kaveri" }} />
        <Stack.Screen name="requests" options={{ title: "Kaveripyynnöt" }} />
      </Stack>
    </>
  );
}
