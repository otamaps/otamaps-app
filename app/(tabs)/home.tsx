import Dashboard from "@/components/home/Dashboard";
import LoginView from "@/components/home/LoginView";
import {
  getSession,
  reauthenticate,
} from "@/lib/wilma/graphqlClient";
import React, { useEffect, useState } from "react";
import { Screen, StateView } from "@/components/ui";
import { useColorScheme } from "react-native";


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
      <Screen background="page">
        <StateView loading />
      </Screen>
    );
  }

  if (sessionState === "loggedOut") {
    return (
      <LoginView onLogin={() => setSessionState("loggedIn")} />
    );
  }

  return (
    <Dashboard isDark={isDark} onLogout={() => setSessionState("loggedOut")} />
  );
}
