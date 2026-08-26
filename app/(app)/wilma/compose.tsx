import { sendWilmaMessage } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ComposeMessageScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const params = useLocalSearchParams<{ recipientId: string; schoolId: string; name?: string; code?: string }>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const recipientId = Number(params.recipientId);
  const schoolId = Number(params.schoolId);
  const valid = Number.isInteger(recipientId) && recipientId > 0 && Number.isInteger(schoolId) && schoolId > 0;
  const canSend = valid && subject.trim().length > 0 && body.trim().length > 0 && !sending;

  const send = () => {
    if (!canSend) return;
    Alert.alert(
      "Lähetä viesti?",
      `Vastaanottaja: ${params.name ?? "valittu vastaanottaja"}`,
      [
        { text: "Peruuta", style: "cancel" },
        {
          text: "Lähetä",
          onPress: async () => {
            setSending(true);
            try {
              await sendWilmaMessage({ recipientId, schoolId, subject: subject.trim(), body: body.trim() });
              Alert.alert("Viesti lähetetty", "Wilma vahvisti viestin lähetyksen.", [
                { text: "OK", onPress: () => router.replace("/wilma/messages" as never) },
              ]);
            } catch (caught: unknown) {
              Alert.alert("Lähetys epäonnistui", caught instanceof Error ? caught.message : "Yritä myöhemmin uudelleen.");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="close" size={25} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Uusi viesti</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={send} disabled={!canSend} hitSlop={8}>
          {sending ? <ActivityIndicator size="small" color="#4A89EE" /> : <MaterialIcons name="send" size={23} color={canSend ? (isDark ? "#51a2ff" : "#4A89EE") : "#aaa"} />}
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, isDark && styles.mutedDark]}>Vastaanottaja</Text>
          <View style={[styles.recipientCard, isDark && styles.fieldDark]}>
            <MaterialIcons name="person-outline" size={20} color={isDark ? "#51a2ff" : "#4A89EE"} />
            <Text style={[styles.recipient, isDark && styles.textLight]}>{params.name ?? "Tuntematon vastaanottaja"}{params.code ? ` (${params.code})` : ""}</Text>
          </View>
          <Text style={[styles.label, isDark && styles.mutedDark]}>Aihe</Text>
          <TextInput style={[styles.input, isDark && styles.fieldDark, isDark && styles.textLight]} value={subject} onChangeText={setSubject} maxLength={200} placeholder="Viestin aihe" placeholderTextColor={isDark ? "#777" : "#aaa"} />
          <Text style={[styles.label, isDark && styles.mutedDark]}>Viesti</Text>
          <TextInput style={[styles.input, styles.bodyInput, isDark && styles.fieldDark, isDark && styles.textLight]} value={body} onChangeText={setBody} maxLength={10000} placeholder="Kirjoita viesti" placeholderTextColor={isDark ? "#777" : "#aaa"} multiline textAlignVertical="top" />
          {!valid && <Text style={styles.error}>Vastaanottajan tiedot puuttuvat. Palaa vastaanottajalistaasi.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  containerDark: { backgroundColor: "#18191B" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  headerDark: { backgroundColor: "#18191B", borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  content: { padding: 16, gap: 8 },
  label: { marginTop: 8, fontFamily: "Figtree-Medium", fontSize: 13, color: "#666" },
  recipientCard: { flexDirection: "row", alignItems: "center", gap: 9, padding: 13, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  recipient: { flex: 1, fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#222" },
  input: { paddingHorizontal: 13, paddingVertical: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", fontFamily: "Figtree-Regular", fontSize: 16, color: "#222" },
  bodyInput: { minHeight: 220 },
  fieldDark: { backgroundColor: "#2b2b2b", borderColor: "#444" },
  textLight: { color: "#fff" },
  mutedDark: { color: "#aaa" },
  error: { marginTop: 8, fontFamily: "Figtree-Regular", fontSize: 13, color: "#d33" },
});
