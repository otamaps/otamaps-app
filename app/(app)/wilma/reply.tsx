import { AppText, useNativeHeader, useTheme } from "@/components/ui";
import { typography } from "@/constants/typography";
import { replyToWilmaMessage } from "@/lib/wilma/graphqlClient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

export default function ReplyMessageScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { messageId, subject, sender } = useLocalSearchParams<{
    messageId: string;
    subject?: string;
    sender?: string;
  }>();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const id = Number(messageId);
  const canSend = Number.isInteger(id) && id > 0 && body.trim().length > 0 && !sending;

  const send = () => {
    if (!canSend) return;
    Alert.alert(
      "Lähetä vastaus?",
      sender ? `Vastaat lähettäjälle ${sender}.` : "Vastaus lähetetään Wilman vastaanottajalle.",
      [
        { text: "Peruuta", style: "cancel" },
        {
          text: "Lähetä",
          onPress: async () => {
            setSending(true);
            try {
              await replyToWilmaMessage(id, body.trim());
              Alert.alert("Vastaus lähetetty", "Wilma vahvisti vastauksen lähetyksen.", [
                { text: "OK", onPress: () => router.back() },
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
      ],
    );
  };

  const header = useNativeHeader({
    title: "Vastaa",
    background: "flat",
    large: false,
    action: {
      icon: "paperplane",
      accessibilityLabel: "Lähetä vastaus",
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
        <View style={styles.content}>
          {!!subject && (
            <AppText variant="meta" color="textMuted" numberOfLines={1}>
              {subject}
            </AppText>
          )}
          {!!sender && (
            <AppText variant="meta" color="textMuted" style={styles.recipient}>
              Vastaanottaja: {sender}
            </AppText>
          )}
          <TextInput
            style={[styles.bodyInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={body}
            onChangeText={setBody}
            maxLength={10000}
            placeholder="Kirjoita vastaus"
            placeholderTextColor={theme.placeholder}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 6 },
  recipient: { marginBottom: 4 },
  bodyInput: {
    flex: 1,
    minHeight: 220,
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    ...typography.input,
  },
});
