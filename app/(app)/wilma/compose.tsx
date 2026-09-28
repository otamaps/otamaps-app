import { AppText, useNativeHeader, useTheme } from "@/components/ui";
import { typography } from "@/constants/typography";
import { sendWilmaMessage } from "@/lib/wilma/graphqlClient";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

export default function ComposeMessageScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    recipientId: string;
    schoolId: string;
    name?: string;
    code?: string;
  }>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const recipientId = Number(params.recipientId);
  const schoolId = Number(params.schoolId);
  const valid =
    Number.isInteger(recipientId) && recipientId > 0 && Number.isInteger(schoolId) && schoolId > 0;
  const canSend = valid && subject.trim().length > 0 && body.trim().length > 0 && !sending;

  const send = () => {
    if (!canSend) return;
    Alert.alert("Lähetä viesti?", `Vastaanottaja: ${params.name ?? "valittu vastaanottaja"}`, [
      { text: "Peruuta", style: "cancel" },
      {
        text: "Lähetä",
        onPress: async () => {
          setSending(true);
          try {
            await sendWilmaMessage({
              recipientId,
              schoolId,
              subject: subject.trim(),
              body: body.trim(),
            });
            Alert.alert("Viesti lähetetty", "Wilma vahvisti viestin lähetyksen.", [
              { text: "OK", onPress: () => router.replace("/wilma/messages" as never) },
            ]);
          } catch (caught: unknown) {
            Alert.alert(
              "Lähetys epäonnistui",
              caught instanceof Error ? caught.message : "Yritä myöhemmin uudelleen.",
            );
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  const header = useNativeHeader({
    title: "Uusi viesti",
    background: "flat",
    large: false,
    action: {
      icon: "paperplane",
      accessibilityLabel: "Lähetä viesti",
      onPress: send,
      disabled: !canSend,
    },
  });

  return (
    <>
      <Stack.Screen options={header} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="meta" color="textMuted" style={styles.label}>
            Vastaanottaja
          </AppText>
          <View style={[styles.recipientCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <PlatformSymbol ios="person" android="person" size={18} tintColor={theme.accent} />
            <AppText variant="rowTitle" style={styles.recipient} numberOfLines={1}>
              {params.name ?? "Tuntematon vastaanottaja"}
              {params.code ? ` (${params.code})` : ""}
            </AppText>
          </View>

          <AppText variant="meta" color="textMuted" style={styles.label}>
            Aihe
          </AppText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
            placeholder="Viestin aihe"
            placeholderTextColor={theme.placeholder}
          />

          <AppText variant="meta" color="textMuted" style={styles.label}>
            Viesti
          </AppText>
          <TextInput
            style={[
              styles.input,
              styles.bodyInput,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
            ]}
            value={body}
            onChangeText={setBody}
            maxLength={10000}
            placeholder="Kirjoita viesti"
            placeholderTextColor={theme.placeholder}
            multiline
            textAlignVertical="top"
          />

          {!valid && (
            <AppText variant="bodySmall" color="danger" style={styles.error}>
              Vastaanottajan tiedot puuttuvat. Palaa vastaanottajalistaasi.
            </AppText>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 8 },
  label: { marginTop: 8 },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recipient: { flex: 1 },
  input: {
    padding: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    ...typography.input,
  },
  bodyInput: { minHeight: 220 },
  error: { marginTop: 8 },
});
