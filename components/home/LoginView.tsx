import { PlatformSymbol } from "@/components/PlatformSymbol";
import { isNetworkError } from "@/lib/networkErrors";
import {
  getCredentials,
  loginMutation,
  LoginResult,
} from "@/lib/wilma/graphqlClient";
import {
  AppText,
  Button,
  Row,
  Screen,
  Surface,
  useTheme,
} from "@/components/ui";
import { typography } from "@/constants/typography";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";


/**
 * The Wilma tab before anyone has signed in, built as the Me tab's Wilma
 * account screen is: a heading, the two fields as rows of one group, a
 * footnote under it, and the app's one filled button.
 */
export default function LoginView({
  onLogin,
}: {
  onLogin: (result: LoginResult) => void;
}) {
  const theme = useTheme();
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
    <Screen background="page">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <PlatformSymbol
            ios="graduationcap.fill"
            android="school"
            size={48}
            tintColor={theme.accent}
          />
          <AppText variant="heading2" style={styles.title}>
            Wilma
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.subtitle}>
            Kirjaudu sisään nähdäksesi lukujärjestyksesi, viestisi ja
            merkintäsi.
          </AppText>
        </View>

        <Surface title="Kirjaudu sisään">
          <Row chevron={false} style={styles.fieldRow}>
            <View style={styles.field}>
              <AppText variant="meta" color="textMuted" style={styles.fieldLabel}>
                Käyttäjätunnus
              </AppText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="etunimi.sukunimi"
                placeholderTextColor={theme.placeholder}
                selectionColor={theme.accent}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                keyboardType="email-address"
                textContentType="username"
              />
            </View>
          </Row>
          <Row chevron={false} style={styles.fieldRow}>
            <View style={styles.field}>
              <AppText variant="meta" color="textMuted" style={styles.fieldLabel}>
                Salasana
              </AppText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Salasana"
                placeholderTextColor={theme.placeholder}
                selectionColor={theme.accent}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                secureTextEntry
                textContentType="password"
                onSubmitEditing={() => void handleLogin()}
              />
            </View>
          </Row>
        </Surface>

        {error ? (
          <AppText variant="meta" color="danger" style={styles.footnote}>
            {error}
          </AppText>
        ) : null}
        <AppText variant="meta" color="textMuted" style={styles.footnote}>
          Tunnuksesi tallennetaan vain laitteellesi. Sovellus käyttää niitä
          ainoastaan lukujärjestyksen, viestien ja merkintöjen hakemiseen.
        </AppText>

        <View style={styles.buttonWrap}>
          <Button
            title="Kirjaudu sisään"
            onPress={() => void handleLogin()}
            disabled={!username.trim() || !password}
            loading={loading}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: 32, paddingBottom: 40 },
  header: { alignItems: "center", marginHorizontal: 32, gap: 6 },
  title: { marginTop: 6 },
  subtitle: { textAlign: "center" },
  fieldRow: { alignItems: "flex-start" },
  field: { flex: 1 },
  fieldLabel: { marginBottom: 6 },
  // An explicit height from the scale's own line height, as the Wilma
  // account screen's fields have: left intrinsic, an empty field measures
  // shorter than a filled one and the row jumps on the first keystroke.
  input: { ...typography.input, height: typography.input.lineHeight, padding: 0 },
  footnote: { marginHorizontal: 20, marginTop: 10 },
  buttonWrap: { marginHorizontal: 16, marginTop: 24 },
});
