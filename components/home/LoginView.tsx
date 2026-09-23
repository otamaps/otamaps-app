import { PlatformSymbol } from "@/components/PlatformSymbol";
import { isNetworkError } from "@/lib/networkErrors";
import {
  getCredentials,
  loginMutation,
  LoginResult,
} from "@/lib/wilma/graphqlClient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


export default function LoginView({
  isDark,
  onLogin,
}: {
  isDark: boolean;
  onLogin: (result: LoginResult) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill from SecureStore if credentials were previously saved
  useEffect(() => {
    getCredentials().then((creds) => {
      if (creds) {
        setUsername(creds.username);
        setPassword(creds.password);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Täytä kaikki kentät");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await loginMutation(username.trim(), password);
      onLogin(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kirjautuminen epäonnistui";
      if (isNetworkError(msg)) {
        setError(
          "Ei yhteyttä palvelimeen. Tarkista, että GraphQL-palvelin on käynnissä.",
        );
      } else if (msg.includes("UNAUTHORIZED") || msg.includes("Unauthorized")) {
        setError("Väärä käyttäjätunnus tai salasana.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.loginContent,
          isDark && { backgroundColor: "#18191B" },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginHeader}>
          <PlatformSymbol
            ios="graduationcap.fill"
            android="school"
            size={52}
            tintColor={isDark ? "#51a2ff" : "#3478F5"}
          />
          <Text style={[styles.loginTitle, isDark && { color: "#fff" }]}>
            Wilma
          </Text>
          <Text style={[styles.loginSubtitle, isDark && { color: "#aaa" }]}>
            Kirjaudu sisään nähdäksesi lukujärjestyksesi, viestisi ja
            merkintäsi.
          </Text>
        </View>

        <View style={[styles.card, isDark && { backgroundColor: "#232427" }]}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: "#d4d4d4" }]}>
              Käyttäjätunnus
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && {
                  backgroundColor: "#404040",
                  color: "#fff",
                  borderColor: "#555",
                },
              ]}
              placeholder="etunimi.sukunimi"
              placeholderTextColor={isDark ? "#777" : "#aaa"}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: "#d4d4d4" }]}>
              Salasana
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && {
                  backgroundColor: "#404040",
                  color: "#fff",
                  borderColor: "#555",
                },
              ]}
              placeholder="Salasana"
              placeholderTextColor={isDark ? "#777" : "#aaa"}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
            />
          </View>
          {!!error && (
            <View style={styles.errorBox}>
              <PlatformSymbol
                ios="exclamationmark.circle"
                android="error"
                size={16}
                tintColor="#ff4444"
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <Pressable
            style={[styles.loginBtn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loginBtnText}>Kirjaudutaan...</Text>
              </View>
            ) : (
              <Text style={styles.loginBtnText}>Kirjaudu sisään</Text>
            )}
          </Pressable>
        </View>

        <View
          style={[styles.noteRow, isDark && { backgroundColor: "#232427" }]}
        >
          <PlatformSymbol
            ios="info.circle"
            android="info"
            size={18}
            tintColor={isDark ? "#888" : "#777"}
          />
          <Text style={[styles.noteText, isDark && { color: "#888" }]}>
            Tunnuksesi tallennetaan vain laitteellesi. Sovellus käyttää niitä
            ainoastaan lukujärjestyksen, viestien ja merkintöjen hakemiseen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fff0f0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#cc2222",
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontFamily: "Figtree-Regular",
    backgroundColor: "#fff",
    color: "#222",
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  loginBtn: {
    backgroundColor: "#3478F5",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  loginContent: { padding: 20, paddingTop: 40, flexGrow: 1 },
  loginHeader: { alignItems: "center", marginBottom: 28 },
  loginSubtitle: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  loginTitle: {
    fontFamily: "Figtree-Bold",
    fontSize: 32,
    color: "#222",
    marginTop: 12,
  },
  noteRow: {
    flexDirection: "row",
    backgroundColor: "#f0f7ff",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    gap: 8,
    alignItems: "flex-start",
  },
  noteText: {
    flex: 1,
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
});
