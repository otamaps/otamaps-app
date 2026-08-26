import { replyToWilmaMessage } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReplyMessageScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const { messageId, subject, sender } = useLocalSearchParams<{ messageId: string; subject?: string; sender?: string }>();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const id = Number(messageId);
  const canSend = Number.isInteger(id) && id > 0 && body.trim().length > 0 && !sending;

  const send = () => {
    if (!canSend) return;
    Alert.alert("Lähetä vastaus?", sender ? `Vastaat lähettäjälle ${sender}.` : "Vastaus lähetetään Wilman vastaanottajalle.", [
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
            Alert.alert("Lähetys epäonnistui", caught instanceof Error ? caught.message : "Yritä myöhemmin uudelleen.");
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="close" size={25} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>Vastaa</Text>
          <Text style={[styles.subtitle, isDark && styles.mutedDark]} numberOfLines={1}>{subject ?? "Wilma-viesti"}</Text>
        </View>
        {sending ? <ActivityIndicator size="small" color="#4A89EE" /> : (
          <Pressable onPress={send} disabled={!canSend} hitSlop={8}>
            <MaterialIcons name="send" size={23} color={canSend ? (isDark ? "#51a2ff" : "#4A89EE") : "#aaa"} />
          </Pressable>
        )}
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.content}>
          {!!sender && <Text style={[styles.recipient, isDark && styles.mutedDark]}>Vastaanottaja: {sender}</Text>}
          <TextInput
            style={[styles.bodyInput, isDark && styles.bodyInputDark, isDark && styles.textLight]}
            value={body}
            onChangeText={setBody}
            maxLength={10000}
            placeholder="Kirjoita vastaus"
            placeholderTextColor={isDark ? "#777" : "#aaa"}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  containerDark: { backgroundColor: "#18191B" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  headerDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  subtitle: { marginTop: 1, fontFamily: "Figtree-Regular", fontSize: 12, color: "#888" },
  content: { flex: 1, padding: 16, gap: 10 },
  recipient: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#666" },
  bodyInput: { flex: 1, minHeight: 220, padding: 14, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", fontFamily: "Figtree-Regular", fontSize: 16, color: "#222" },
  bodyInputDark: { backgroundColor: "#2b2b2b", borderColor: "#444" },
  textLight: { color: "#fff" },
  mutedDark: { color: "#aaa" },
});
