// Must be the first import so notifee.registerForegroundService() runs before
// any notification with asForegroundService:true is displayed.
import "@/lib/bleBackgroundTask";

import { UserProvider } from "@/context/UserContext";
import {
  isBLEBackgroundEnabled,
  startBLEBackgroundService,
  stopBLEBackgroundService,
} from "@/lib/bleBackgroundManager";
import { supabase } from "@/lib/supabase";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { InstantSearch } from "react-instantsearch-core";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SumUpProvider } from "sumup-react-native-alpha";

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
    <SumUpProvider publicKey={process.env.EXPO_PUBLIC_SUMUP_API_KEY || ''}>
      <UserProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
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
        </GestureHandlerRootView>
      </UserProvider>
    </SumUpProvider>
  );
}

export default function RootLayout() {
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    // Start the service if the user is already signed in on launch
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && (await isBLEBackgroundEnabled())) {
        const result = await startBLEBackgroundService();
        if (!result.success && result.reason === "permission_denied") {
          console.log("[BLE BG] Auto-start skipped: notification permission denied");
        }
      }
    });

    // Start / stop as the user signs in or out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" && (await isBLEBackgroundEnabled())) {
        const result = await startBLEBackgroundService();
        if (!result.success && result.reason === "permission_denied") {
          console.log("[BLE BG] Sign-in auto-start skipped: notification permission denied");
        }
      } else if (event === "SIGNED_OUT") {
        await stopBLEBackgroundService();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
