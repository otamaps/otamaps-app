// Must be the first import so notifee.registerForegroundService() runs before
// any notification with asForegroundService:true is displayed.
import "@/lib/bleBackgroundTask";

import { UserProvider } from "@/context/UserContext";
import {
  isBLEBackgroundEnabled,
  startBLEBackgroundService,
  stopBLEBackgroundService,
  stopBLETrackingForSignOut,
} from "@/lib/bleBackgroundManager";
import {
  startForegroundTracking,
  stopForegroundTracking,
} from "@/lib/bleTrackingRuntime";
import { supabase } from "@/lib/supabase";
import { getTrackingConsentChoices } from "@/lib/userPreferences";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { InstantSearch } from "react-instantsearch-core";
import { AppState, useColorScheme, View } from "react-native";
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
  const fontsLoaded = useLoadedAssets();
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <SumUpProvider publicKey={process.env.EXPO_PUBLIC_SUMUP_API_KEY || ""}>
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
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    let disposed = false;

    const syncAuthenticatedTracking = async () => {
      const [backgroundEnabled, consent] = await Promise.all([
        isBLEBackgroundEnabled(),
        getTrackingConsentChoices(),
      ]);
      if (disposed) return;
      const trackingPurposeEnabled =
        consent.friend_location_enabled || consent.anonymous_analytics_enabled;
      if (!trackingPurposeEnabled) {
        if (backgroundEnabled) await stopBLEBackgroundService();
        else await stopForegroundTracking();
        return;
      }
      if (AppState.currentState === "active") {
        if (backgroundEnabled && consent.background_tracking_enabled) {
          await startBLEBackgroundService();
        } else {
          await startForegroundTracking();
        }
      } else if (!backgroundEnabled) {
        await stopForegroundTracking();
      }
    };

    const syncTracking = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (!session) {
        await stopForegroundTracking();
        return;
      }
      try {
        await syncAuthenticatedTracking();
      } catch (error) {
        console.warn("Unable to load tracking consent; tracking stays off", error);
        await stopForegroundTracking();
      }
    };

    void syncTracking();

    const appStateSubscription = AppState.addEventListener("change", () => {
      void syncTracking();
    });

    // Start / stop as the user signs in or out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void syncAuthenticatedTracking().catch(async (error) => {
          console.warn("Unable to load tracking consent; tracking stays off", error);
          await stopForegroundTracking();
        });
      } else if (event === "SIGNED_OUT") {
        void stopBLETrackingForSignOut();
      }
    });

    return () => {
      disposed = true;
      appStateSubscription.remove();
      subscription.unsubscribe();
    };
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
