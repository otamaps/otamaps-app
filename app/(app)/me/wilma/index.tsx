import {
  AppText,
  Button,
  Row,
  RowIcon,
  Surface,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import { formatClassLabel } from "@/lib/classLabel";
import { supabase } from "@/lib/supabase";
import { getUserPreferences } from "@/lib/userPreferences";
import { connectWilmaAccount } from "@/lib/wilma/authBroker";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

export default function WilmaSettings() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

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
    setUserClass(formatClassLabel(data?.class));
  };

  useEffect(() => {
    void loadStatus()
      .catch((error) => Alert.alert("Wilma-tilaa ei voitu ladata", message(error)))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    if (!username.trim() || !password) return;
    const wasConnected = connected;
    setConnecting(true);
    try {
      await connectWilmaAccount(username, password);
      await loadStatus();
      setUsername("");
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

  const header = useNativeHeader({ title: "Wilma-tili", background: "page" });

  if (loading) {
    return (
      <>
        <Stack.Screen options={header} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Surface>
          <Row chevron={false}>
            <RowIcon
              ios={connected ? "checkmark" : "link"}
              android={connected ? "check" : "link"}
              color={theme.accent}
            />
            <View style={styles.identity}>
              <AppText variant="rowTitle">
                {connected ? "Wilma on yhdistetty" : "Wilmaa ei ole yhdistetty"}
              </AppText>
              <AppText variant="meta" color="textMuted" style={styles.identityBody}>
                {connected
                  ? `${name}${userClass ? ` · ${userClass}` : ""}`
                  : "Yhdistä Wilma saadaksesi lukujärjestyksen, viestit ja vahvistetut profiilitiedot."}
              </AppText>
            </View>
          </Row>
        </Surface>

        <Surface title={connected ? "Päivitä kirjautuminen" : "Yhdistä tili"}>
          <Row chevron={false} style={styles.fieldRow}>
            <View style={styles.field}>
              <AppText variant="meta" color="textMuted" style={styles.fieldLabel}>
                Käyttäjätunnus
              </AppText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!connecting}
                placeholder="Wilma-käyttäjätunnus"
                placeholderTextColor={theme.placeholder}
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
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!connecting}
                placeholder="Salasana"
                placeholderTextColor={theme.placeholder}
                onSubmitEditing={() => void connect()}
              />
            </View>
          </Row>
        </Surface>

        <AppText variant="meta" color="textMuted" style={styles.footnote}>
          Tunnukset lähetetään suojatusti Wilmalle ja tallennetaan vain tämän
          laitteen suojattuun tallennustilaan automaattista
          uudelleenkirjautumista varten.
        </AppText>

        <View style={styles.buttonWrap}>
          <Button
            title={connected ? "Päivitä yhteys" : "Yhdistä Wilma"}
            onPress={() => void connect()}
            disabled={!username.trim() || !password}
            loading={connecting}
          />
        </View>
      </ScrollView>
    </>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, paddingBottom: 40 },
  identity: { flex: 1 },
  identityBody: { marginTop: 3 },
  fieldRow: { alignItems: "flex-start" },
  field: { flex: 1 },
  fieldLabel: { marginBottom: 6 },
  input: { fontFamily: "Figtree-Regular", fontSize: 16, padding: 0 },
  footnote: { marginHorizontal: 20, marginTop: 10 },
  buttonWrap: { marginHorizontal: 16, marginTop: 24 },
});
