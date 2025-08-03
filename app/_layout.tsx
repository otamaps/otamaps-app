import { UserProvider } from "@/context/UserContext";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { InstantSearch } from "react-instantsearch-core";
import { useColorScheme, View } from "react-native";
import "react-native-reanimated";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const searchClient = algoliasearch(
  "MNY63FWK0H",
  "ffb5602ea099a9093f94ecd815ebb42f"
);

// Load the Figtree font
function useLoadedAssets() {
  const [fontsLoaded] = useFonts({
    "Figtree-Regular": require("../assets/fonts/Figtree-Regular.ttf"),
    "Figtree-Medium": require("../assets/fonts/Figtree-Medium.ttf"),
    "Figtree-SemiBold": require("../assets/fonts/Figtree-SemiBold.ttf"),
    "Figtree-Bold": require("../assets/fonts/Figtree-Bold.ttf"),
  });

  return fontsLoaded;
}

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const fontsLoaded = useLoadedAssets();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <UserProvider>
      <Stack
        screenOptions={{
          headerShown: false, // this disables the default header everywhere
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)/me" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </UserProvider>
  );
}

export default function RootLayout() {
  const isDark = useColorScheme() === "dark";
  return (
    <View
      style={{ flex: 1, backgroundColor: isDark ? "#1e1e1e" : "transparent" }}
    >
      <InstantSearch searchClient={searchClient} indexName="rooms_rows">
        <RootLayoutNav />
      </InstantSearch>
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}
