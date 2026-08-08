import { supabase } from "@/lib/supabase";
import { isOnboardingComplete } from "@/lib/userPreferences";
import { Session } from "@supabase/supabase-js";
import { Buffer } from "buffer";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import SplashScreen from "./welcome/splash";

const runtimeGlobal = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
};

if (typeof runtimeGlobal.Buffer === "undefined") {
  runtimeGlobal.Buffer = Buffer;
}

export default function Index() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Show splash screen for 1 second
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only handle navigation after splash screen is hidden and auth check is complete
    let cancelled = false;
    if (!isLoading && !showSplash) {
      if (session) {
        void isOnboardingComplete()
          .then((complete) => {
            if (!cancelled) {
              router.replace(
                complete ? "/home" : "/welcome/(post)/permissions"
              );
            }
          })
          .catch((error) => {
            console.warn("Unable to load onboarding state", error);
            if (!cancelled) router.replace("/welcome/(post)/permissions");
          });
      } else {
        // No user is signed in, redirect to welcome
        router.replace("/welcome");
      }
    }
    return () => {
      cancelled = true;
    };
  }, [session, isLoading, showSplash, router]);

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen />;
  }

  // Show loading indicator while checking auth state
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: isDark ? "#1e1e1e" : "transparent",
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={isDark ? "#fff" : "#4A89EE"} />
    </View>
  );
}
