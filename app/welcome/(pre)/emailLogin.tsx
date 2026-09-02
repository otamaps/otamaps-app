import { supabase } from "@/lib/supabase";
import { completePendingLegacyLink } from "@/lib/wilma/authBroker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EmailLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Puuttuvat tiedot", "Täytä sähköposti ja salasana.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await completePendingLegacyLink(data.session?.access_token);
      router.replace("/" as never);
    } catch (cause) {
      Alert.alert(
        "Kirjautuminen epäonnistui",
        cause instanceof Error ? cause.message : "Yritä hetken kuluttua uudelleen."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Always light-themed (no dark styling on this screen), so the
          status bar stays dark-content even in system dark mode — otherwise
          the global reactive one would put white icons over this screen's
          white background. */}
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={23} color="#344054" />
            <Text style={styles.backText}>Takaisin</Text>
          </Pressable>

          <View style={styles.form}>
            <Text style={styles.title}>Kirjaudu sähköpostilla</Text>
            <Text style={styles.subtitle}>
              Tämä vaihtoehto on vanhaa OtaMaps-tiliä varten.
            </Text>

            <Text style={styles.label}>Sähköposti</Text>
            <TextInput
              style={styles.input}
              placeholder="nimi@esimerkki.fi"
              placeholderTextColor="#98A2B3"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />

            <Text style={styles.label}>Salasana</Text>
            <TextInput
              style={styles.input}
              placeholder="Salasana"
              placeholderTextColor="#98A2B3"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              textContentType="password"
              autoCorrect={false}
              onSubmitEditing={() => void handleAuth()}
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={() => void handleAuth()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Kirjaudu sisään</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: "#FFFFFF", flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: 44,
  },
  backText: {
    color: "#344054",
    fontFamily: "Figtree-Medium",
    fontSize: 14,
  },
  form: {
    alignSelf: "center",
    justifyContent: "center",
    maxWidth: 500,
    width: "100%",
    flex: 1,
  },
  title: {
    color: "#101828",
    fontFamily: "Figtree-SemiBold",
    fontSize: 25,
    textAlign: "center",
  },
  subtitle: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
    marginTop: 7,
    textAlign: "center",
  },
  label: {
    color: "#344054",
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E4E7EC",
    borderRadius: 12,
    borderWidth: 1,
    color: "#101828",
    fontFamily: "Figtree-Regular",
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 2,
    minHeight: 50,
  },
  buttonPressed: { opacity: 0.84 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
});
