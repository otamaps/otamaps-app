import {
  createWilmaAccount,
  completePendingLegacyLink,
  finishWilmaSupabaseExchange,
  savePendingLegacyLink,
  startWilmaAuthentication,
  WILMA_PRIMARY_AUTH_ENABLED,
} from "@/lib/wilma/authBroker";
import {
  configureGoogleSignIn,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from "@/lib/googleAuth";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
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

export default function WelcomeScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [wilmaLoading, setWilmaLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleSignInAvailable, setGoogleSignInAvailable] = useState(false);
  const [error, setError] = useState("");

  const anyLoading = wilmaLoading || googleLoading;

  useEffect(() => {
    configureGoogleSignIn();
    void isGoogleSignInAvailable().then(setGoogleSignInAvailable);
  }, []);

  const finishNewAccount = async (attemptToken: string) => {
    setWilmaLoading(true);
    setError("");
    try {
      const exchange = await createWilmaAccount(attemptToken);
      await finishWilmaSupabaseExchange(exchange, username.trim(), password);
      router.replace("/" as never);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "OtaMaps-tilin luominen epäonnistui."
      );
    } finally {
      setWilmaLoading(false);
    }
  };

  const handleWilmaLogin = async () => {
    if (!username.trim() || !password) {
      setError("Täytä Wilma-käyttäjätunnus ja salasana.");
      return;
    }

    setWilmaLoading(true);
    setError("");
    try {
      const result = await startWilmaAuthentication(username.trim(), password);
      if (result.kind === "session") {
        await finishWilmaSupabaseExchange(
          result,
          username.trim(),
          password
        );
        router.replace("/" as never);
        return;
      }

      Alert.alert(
        "Löysimme mahdollisen vanhan tilin",
        "Wilmassa vahvistettu nimi vastaa olemassa olevaa OtaMaps-tiliä. Voit kirjautua vanhalle tilille ja yhdistää Wilman siihen. Nimitieto yksin ei koskaan yhdistä tilejä.",
        [
          { text: "Peruuta", style: "cancel" },
          {
            text: "Luo uusi tili",
            onPress: () => void finishNewAccount(result.attemptToken),
          },
          {
            text: "Käytä vanhaa tiliä",
            onPress: () => {
              void savePendingLegacyLink(
                result.attemptToken,
                username.trim(),
                password
              )
                .then(() => router.push("/welcome/login" as never))
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Tilin yhdistämisen aloittaminen epäonnistui."
                  );
                });
            },
          },
        ]
      );
    } catch (cause) {
      const code = (cause as Error & { code?: string })?.code;
      setError(
        code === "WILMA_AUTH_FAILED"
          ? "Wilma-käyttäjätunnus tai salasana on väärä."
          : cause instanceof Error
            ? cause.message
            : "Kirjautuminen epäonnistui."
      );
    } finally {
      setWilmaLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const data = await signInWithGoogle();
      await completePendingLegacyLink(data.session?.access_token);
      router.replace("/" as never);
    } catch (cause) {
      Alert.alert(
        "Google-kirjautuminen epäonnistui",
        cause instanceof Error ? cause.message : "Yritä hetken kuluttua uudelleen."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ImageBackground
            source={require("@/assets/images/login-bg.png")}
            style={styles.hero}
            imageStyle={styles.heroImage}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.24)", "#FFFFFF"]}
              locations={[0, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.heroContent}>
              <Text style={styles.welcome}>Tervetuloa</Text>
              <Image
                source={require("@/assets/images/otamaps-logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </ImageBackground>

          <View style={styles.formSection}>
            <Text style={styles.title}>
              {WILMA_PRIMARY_AUTH_ENABLED
                ? "Kirjaudu Wilmalla"
                : "Kirjaudu OtaMapsiin"}
            </Text>
            <Text style={styles.subtitle}>
              {WILMA_PRIMARY_AUTH_ENABLED
                ? "Käytä tavallista Wilma-käyttäjätunnustasi."
                : "Valitse kirjautumistapa."}
            </Text>

            {WILMA_PRIMARY_AUTH_ENABLED ? (
              <>
                <Text style={styles.label}>Wilma-käyttäjätunnus</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="etunimi.sukunimi"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  editable={!anyLoading}
                />

                <Text style={styles.label}>Salasana</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Wilma-salasana"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType="password"
                  editable={!anyLoading}
                  onSubmitEditing={() => void handleWilmaLogin()}
                />

                {!!error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                    anyLoading && styles.buttonDisabled,
                  ]}
                  disabled={anyLoading}
                  onPress={() => void handleWilmaLogin()}
                >
                  {wilmaLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Jatka Wilmalla</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Muut kirjautumistavat</Text>
              <View style={styles.divider} />
            </View>

            {googleSignInAvailable ? (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                  anyLoading && styles.buttonDisabled,
                ]}
                disabled={anyLoading}
                onPress={() => void handleGoogleSignIn()}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#344054" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={19} color="#344054" />
                    <Text style={styles.secondaryButtonText}>Jatka Googlella</Text>
                  </>
                )}
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.emailButton,
                pressed && styles.emailButtonPressed,
              ]}
              disabled={anyLoading}
              onPress={() => router.push("/welcome/emailLogin" as never)}
            >
              <Text style={styles.emailButtonText}>
                Kirjaudu sähköpostilla ja salasanalla
              </Text>
            </Pressable>

            <Text style={styles.credentialNotice}>
              Wilma-tunnukset välitetään suojatusti Wilmalle. Ne säilytetään vain
              tämän laitteen suojatussa tallennustilassa automaattista
              uudelleenkirjautumista varten.
            </Text>

            <Text style={styles.legal}>
              Jatkamalla hyväksyt{" "}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flexGrow: 1, backgroundColor: "#FFFFFF" },
  hero: {
    minHeight: 240,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 18,
    overflow: "hidden",
  },
  heroImage: { resizeMode: "cover" },
  heroContent: { alignItems: "center" },
  welcome: {
    color: "#475467",
    fontFamily: "Figtree-Medium",
    fontSize: 18,
    letterSpacing: 0.2,
  },
  logo: { width: 230, height: 78, marginTop: 2 },
  formSection: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 28,
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
    marginTop: 5,
    marginBottom: 24,
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
  error: {
    color: "#B42318",
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 22,
  },
  divider: { backgroundColor: "#EAECF0", flex: 1, height: 1 },
  dividerText: {
    color: "#98A2B3",
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    marginHorizontal: 12,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D0D5DD",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 50,
  },
  secondaryButtonPressed: { backgroundColor: "#F9FAFB" },
  secondaryButtonText: {
    color: "#344054",
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
  },
  emailButton: { alignItems: "center", paddingVertical: 15 },
  emailButtonPressed: { opacity: 0.6 },
  emailButtonText: {
    color: "#3478F5",
    fontFamily: "Figtree-Medium",
    fontSize: 14,
  },
  credentialNotice: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
  legal: {
    color: "#98A2B3",
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center",
  },
  link: { color: "#3478F5" },
  buttonPressed: { opacity: 0.84 },
  buttonDisabled: { opacity: 0.55 },
});
