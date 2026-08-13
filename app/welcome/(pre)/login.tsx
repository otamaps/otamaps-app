import {
  configureGoogleSignIn,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from "@/lib/googleAuth";
import { completePendingLegacyLink } from "@/lib/wilma/authBroker";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [googleSignInAvailable, setGoogleSignInAvailable] = useState(false);

  useEffect(() => {
    configureGoogleSignIn();
    void isGoogleSignInAvailable().then(setGoogleSignInAvailable);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const data = await signInWithGoogle();
      await completePendingLegacyLink(data.session?.access_token);
      router.replace("/" as never);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Yritä hetken kuluttua uudelleen.";
      alert(`Kirjautuminen epäonnistui: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={23} color="#344054" />
          <Text style={styles.backText}>Takaisin</Text>
        </Pressable>

        <View style={styles.content}>
          <Image
            source={require("@/assets/images/otamaps-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Muut kirjautumistavat</Text>
          <Text style={styles.subtitle}>
            Google toimii kaikilla sähköpostiosoitteilla. Voit myös käyttää
            vanhan OtaMaps-tilin sähköpostia ja salasanaa.
          </Text>

          {googleSignInAvailable ? (
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                pressed && styles.optionButtonPressed,
                loading && styles.disabled,
              ]}
              onPress={() => void handleGoogleSignIn()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#344054" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={19} color="#344054" />
                  <Text style={styles.optionButtonText}>Jatka Googlella</Text>
                </>
              )}
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.optionButton,
              pressed && styles.optionButtonPressed,
            ]}
            onPress={() => router.push("/welcome/emailLogin" as never)}
            disabled={loading}
          >
            <Ionicons name="mail-outline" size={20} color="#344054" />
            <Text style={styles.optionButtonText}>Sähköposti ja salasana</Text>
          </Pressable>
        </View>

        <Text style={styles.legal}>
          Kirjautumalla hyväksyt{" "}
          <Text
            style={styles.link}
            onPress={() => void openExternalUrl("https://otamaps.fi/terms")}
          >
            käyttöehdot
          </Text>{" "}
          ja{" "}
          <Text
            style={styles.link}
            onPress={() => void openExternalUrl("https://otamaps.fi/privacy")}
          >
            tietosuojakäytännön
          </Text>
          .
        </Text>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    flex: 1,
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
  content: {
    alignSelf: "center",
    justifyContent: "center",
    maxWidth: 500,
    width: "100%",
    flex: 1,
  },
  logo: { alignSelf: "center", height: 76, width: 220 },
  title: {
    color: "#101828",
    fontFamily: "Figtree-SemiBold",
    fontSize: 25,
    marginTop: 18,
    textAlign: "center",
  },
  subtitle: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
    marginTop: 8,
    textAlign: "center",
  },
  optionButton: {
    alignItems: "center",
    borderColor: "#D0D5DD",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 52,
  },
  optionButtonPressed: { backgroundColor: "#F9FAFB" },
  optionButtonText: {
    color: "#344054",
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
  },
  legal: {
    color: "#98A2B3",
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: 8,
    textAlign: "center",
  },
  link: { color: "#3478F5" },
  disabled: { opacity: 0.55 },
});
