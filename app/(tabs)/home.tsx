import Dashboard from "@/components/home/Dashboard";
import LoginView from "@/components/home/LoginView";
import {
  getSession,
  reauthenticate,
} from "@/lib/wilma/graphqlClient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


type SessionState = "checking" | "loggedOut" | "loggedIn";

const STARTUP_TIMEOUT_MS = 8_000;

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  useEffect(() => {
    async function init() {
      // If we already have a live token, go straight to the dashboard.
      // The dashboard will handle expired tokens itself via gqlFetch re-auth.
      const token = await getSession();
      if (token) {
        setSessionState("loggedIn");
        return;
      }

      // No active token – try a silent re-auth with a hard deadline so we
      // never block the login form for more than STARTUP_TIMEOUT_MS.
      const timeout = new Promise<false>((resolve) =>
        setTimeout(() => resolve(false), STARTUP_TIMEOUT_MS),
      );
      const ok = await Promise.race([reauthenticate(), timeout]);
      setSessionState(ok ? "loggedIn" : "loggedOut");
    }
    init();
  }, []);

  if (sessionState === "checking") {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={isDark ? "#51a2ff" : "#3478F5"}
          />
          <Text style={[styles.loadingLabel, isDark && { color: "#888" }]}>
            Tarkistetaan kirjautumista...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionState === "loggedOut") {
    return (
      <LoginView isDark={isDark} onLogin={() => setSessionState("loggedIn")} />
    );
  }

  return (
    <Dashboard isDark={isDark} onLogout={() => setSessionState("loggedOut")} />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────


const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  loadingLabel: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
});
