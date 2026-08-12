import { fetchMessage, MessageDetail } from "@/lib/wilma/graphqlClient";
import { buildMessageThreadHtml, messageReplyCountLabel } from "@/lib/wilma/messageThread";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export default function MessageScreen() {
  const router = useRouter();
  const { id, subject, sender } = useLocalSearchParams<{
    id: string;
    subject?: string;
    sender?: string;
  }>();
  const isDark = useColorScheme() === "dark";

  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const messageId = Number(id);
      if (!Number.isInteger(messageId) || messageId <= 0) {
        setError("Virheellinen viestin tunniste");
        setLoading(false);
        return undefined;
      }
      let active = true;
      setLoading(true);
      setError(null);
      fetchMessage(messageId)
        .then((nextDetail) => { if (active) setDetail(nextDetail); })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : "Lataus epäonnistui");
        })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [id])
  );

  const headerTitle = detail?.subject ?? subject ?? "Viesti";
  const threadSender = detail?.sender || sender || "";
  const replyLabel = detail ? messageReplyCountLabel(detail.replies.length) : "";
  const headerSubtitle = [threadSender, replyLabel].filter(Boolean).join(" · ");

  return (
    <SafeAreaView
      style={[styles.container, isDark && styles.containerDark]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
            {headerTitle}
          </Text>
          {!!headerSubtitle && (
            <Text style={[styles.headerSender, isDark && styles.mutedDark]} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          )}
        </View>
        {!loading && !error && !!id && (
          <Pressable
            style={styles.replyButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Vastaa viestiketjuun"
            onPress={() =>
              router.push({
                pathname: "/wilma/reply" as never,
                params: {
                  messageId: id,
                  subject: headerTitle,
                  sender: threadSender,
                },
              })
            }
          >
            <MaterialIcons name="reply" size={22} color={isDark ? "#51a2ff" : "#4A89EE"} />
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={isDark ? "#888" : "#ccc"} />
          <Text style={[styles.errorText, isDark && styles.mutedDark]}>{error}</Text>
        </View>
      )}

      {!loading && !error && detail && (
        <WebView
          source={{ html: buildMessageThreadHtml(detail, isDark, sender ?? "") }}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          style={{ flex: 1, backgroundColor: isDark ? "#1e1e1e" : "#f5f7fb" }}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === "about:blank" || request.url.startsWith("data:")) return true;
            if (request.url.startsWith("http://") || request.url.startsWith("https://")) {
              void Linking.openURL(request.url);
            }
            return false;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  containerDark: { backgroundColor: "#1e1e1e" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", backgroundColor: "#fff", gap: 12 },
  headerDark: { backgroundColor: "#1e1e1e", borderBottomColor: "#333" },
  backBtn: { padding: 2 },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 16, color: "#222" },
  headerSender: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#888", marginTop: 2 },
  replyButton: { padding: 4 },
  errorText: { fontFamily: "Figtree-Regular", fontSize: 15, color: "#aaa", textAlign: "center", paddingHorizontal: 32 },
  textLight: { color: "#fff" },
  mutedDark: { color: "#aaa" },
});
