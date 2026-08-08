import { fetchMessage, MessageDetail } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
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

function buildHtml(htmlBody: string | null, isDark: boolean): string {
  const bg = isDark ? "#1e1e1e" : "#ffffff";
  const fg = isDark ? "#d4d4d4" : "#222222";
  const linkColor = isDark ? "#51a2ff" : "#4A89EE";
  const body = htmlBody ?? "<p style=\"color:#888\">Viestillä ei ole tekstisisältöä.</p>";

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.65;
      color: ${fg};
      background-color: ${bg};
      padding: 20px 18px 40px;
      margin: 0;
      word-wrap: break-word;
    }
    a { color: ${linkColor}; word-break: break-all; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    p { margin: 0 0 14px; }
    ul, ol { padding-left: 22px; margin: 0 0 14px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    td, th { padding: 8px; border: 1px solid ${isDark ? "#444" : "#ddd"}; }
    blockquote {
      border-left: 3px solid ${linkColor};
      margin: 0 0 14px 0;
      padding: 4px 14px;
      color: ${isDark ? "#aaa" : "#666"};
    }
    hr { border: none; border-top: 1px solid ${isDark ? "#444" : "#eee"}; margin: 16px 0; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

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

  useEffect(() => {
    if (!id) return;
    fetchMessage(parseInt(id, 10))
      .then(setDetail)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Lataus epäonnistui"))
      .finally(() => setLoading(false));
  }, [id]);

  const headerTitle = detail?.subject ?? subject ?? "Viesti";
  const headerSubtitle = sender ?? "";

  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <View style={[styles.header, isDark && { backgroundColor: "#1e1e1e", borderBottomColor: "#333" }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <View style={styles.headerText}>
          <Text
            style={[styles.headerTitle, isDark && { color: "#fff" }]}
            numberOfLines={1}
          >
            {headerTitle}
          </Text>
          {!!headerSubtitle && (
            <Text
              style={[styles.headerSender, isDark && { color: "#aaa" }]}
              numberOfLines={1}
            >
              {headerSubtitle}
            </Text>
          )}
        </View>
        {!loading && !error && !!id && (
          <Pressable
            style={styles.replyButton}
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: "/wilma/reply" as never,
                params: {
                  messageId: id,
                  subject: headerTitle,
                  sender: headerSubtitle,
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
          <Text style={[styles.errorText, isDark && { color: "#888" }]}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <WebView
          source={{ html: buildHtml(detail?.htmlBody ?? null, isDark) }}
          style={{ flex: 1, backgroundColor: isDark ? "#1e1e1e" : "#fff" }}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(req) => {
            // Allow initial blank/data load
            if (req.url === "about:blank" || req.url.startsWith("data:")) return true;
            // Open all real links in the system browser
            if (req.url.startsWith("http://") || req.url.startsWith("https://")) {
              Linking.openURL(req.url);
            }
            return false;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    gap: 12,
  },
  backBtn: { padding: 2 },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    color: "#222",
  },
  headerSender: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  replyButton: { padding: 4 },
  errorText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
