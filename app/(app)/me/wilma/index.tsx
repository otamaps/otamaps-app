import { connectWilmaAccount } from "@/lib/wilma/authBroker";
import { supabase } from "@/lib/supabase";
import { getUserPreferences } from "@/lib/userPreferences";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

export default function WilmaSettings() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const isDark = useColorScheme() === "dark";

  const loadStatus = async () => {
    const preferences = await getUserPreferences({ forceRefresh: true });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Käyttäjä ei ole kirjautunut sisään.");
    const { data, error } = await supabase
      .from("users")
      .select("name,class")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    setConnected(preferences.profile_source === "wilma");
    setName(data?.name || "");
    setUserClass(data?.class || "");
  };

  useEffect(() => {
    void loadStatus()
      .catch((error) => Alert.alert("Wilma-tilaa ei voitu ladata", message(error)))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Puuttuvat tiedot", "Täytä Wilma-käyttäjätunnus ja salasana.");
      return;
    }
    const wasConnected = connected;
    setConnecting(true);
    try {
      await connectWilmaAccount(username, password);
      await loadStatus();
      setPassword("");
      Alert.alert(
        wasConnected ? "Wilma-yhteys päivitetty" : "Wilma-tili yhdistetty",
        "Wilma-tiedot ja istunto ovat nyt käytettävissä OtaMapsissa."
      );
    } catch (error) {
      Alert.alert("Wilma-tiliä ei voitu yhdistää", message(error));
    } finally {
      setConnecting(false);
    }
  };

  const background = isDark ? "#1E1E1E" : "#F5F7FA";
  const surface = isDark ? "#292929" : "#FFFFFF";
  const textColor = isDark ? "#FFFFFF" : "#101828";
  const mutedColor = isDark ? "#B3B3B3" : "#667085";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <Stack.Screen
        options={{
          title: "Wilma-tili",
          headerStyle: { backgroundColor: surface },
          headerTitleStyle: { color: textColor },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={textColor} />
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#3478F5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.statusCard, { backgroundColor: surface }]}>
            <View style={[styles.statusIcon, connected && styles.statusIconConnected]}>
              <Ionicons
                name={connected ? "checkmark" : "link-outline"}
                size={24}
                color={connected ? "#067647" : "#3478F5"}
              />
            </View>
            <View style={styles.statusText}>
              <Text style={[styles.statusTitle, { color: textColor }]}>
                {connected ? "Wilma on yhdistetty" : "Wilmaa ei ole yhdistetty"}
              </Text>
              <Text style={[styles.statusDescription, { color: mutedColor }]}>
                {connected
                  ? `${name}${userClass ? ` · ${userClass}` : ""}`
                  : "Yhdistä Wilma saadaksesi lukujärjestyksen, viestit ja vahvistetut profiilitiedot."}
              </Text>
            </View>
          </View>

          <Text style={[styles.heading, { color: textColor }]}>
            {connected ? "Päivitä Wilma-kirjautuminen" : "Yhdistä Wilma-tili"}
          </Text>
          <Text style={[styles.intro, { color: mutedColor }]}>
            Tunnukset lähetetään suojatusti Wilmalle ja tallennetaan vain tämän laitteen suojattuun tallennustilaan automaattista uudelleenkirjautumista varten.
          </Text>
          <Text style={[styles.label, { color: textColor }]}>Wilma-käyttäjätunnus</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!connecting}
          />
          <Text style={[styles.label, { color: textColor }]}>Salasana</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!connecting}
            onSubmitEditing={() => void connect()}
          />
          <Pressable
            style={[styles.button, connecting && styles.buttonDisabled]}
            onPress={() => void connect()}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {connected ? "Päivitä yhteys" : "Yhdistä Wilma"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function message(error: unknown): string {
  const code = (error as Error & { code?: string })?.code;
  if (code === "WILMA_AUTH_FAILED") return "Wilma-käyttäjätunnus tai salasana on väärä.";
  if (code === "WILMA_IDENTITY_CONFLICT") {
    return "Tämä Wilma-tili on jo yhdistetty toiseen OtaMaps-tiliin.";
  }
  return error instanceof Error ? error.message : "Yritä hetken kuluttua uudelleen.";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 40 },
  statusCard: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  statusIcon: {
    alignItems: "center",
    backgroundColor: "#EFF4FF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  statusIconConnected: { backgroundColor: "#ECFDF3" },
  statusText: { flex: 1 },
  statusTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17 },
  statusDescription: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  heading: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 22,
    marginTop: 30,
  },
  intro: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
    marginTop: 7,
  },
  label: {
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D0D5DD",
    borderRadius: 12,
    borderWidth: 1,
    color: "#101828",
    fontFamily: "Figtree-Regular",
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputDark: { backgroundColor: "#292929", borderColor: "#444", color: "#FFFFFF" },
  button: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontFamily: "Figtree-SemiBold", fontSize: 16 },
});
