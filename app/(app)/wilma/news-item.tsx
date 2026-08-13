import { fetchNewsItem, WilmaNewsDetail } from "@/lib/wilma/graphqlClient";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

function documentHtml(body: string, isDark: boolean): string {
  const background = isDark ? "#1e1e1e" : "#fff";
  const foreground = isDark ? "#d4d4d4" : "#222";
  const border = isDark ? "#444" : "#ddd";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    *{box-sizing:border-box} body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.65;color:${foreground};background:${background};padding:20px 18px 40px;margin:0;overflow-wrap:anywhere}
    a{color:#4A89EE} img{max-width:100%;height:auto} table{width:100%;border-collapse:collapse} td,th{padding:8px;border:1px solid ${border}}
    button,.noprint,nav,header,footer{display:none!important}
  </style></head><body>${body}</body></html>`;
}

export default function WilmaNewsItemScreen() {
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const isDark = useColorScheme() === "dark";
  const [detail, setDetail] = useState<WilmaNewsDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setError("Virheellinen tiedotteen tunniste.");
      return;
    }
    fetchNewsItem(numericId)
      .then(setDetail)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Tiedotteen lataaminen epäonnistui."));
  }, [id]);

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={2}>
          {detail?.title ?? title ?? "Tiedote"}
        </Text>
      </View>
      {!detail && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={46} color="#aaa" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <WebView
          source={{ html: documentHtml(detail?.htmlBody ?? "", isDark) }}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          style={{ flex: 1, backgroundColor: isDark ? "#1e1e1e" : "#fff" }}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === "about:blank" || request.url.startsWith("data:")) return true;
            if (request.url.startsWith("http://") || request.url.startsWith("https://")) {
              void openExternalUrl(request.url);
            }
            return false;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  containerDark: { backgroundColor: "#1e1e1e" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  headerDark: { borderBottomColor: "#333" },
  headerTitle: { flex: 1, fontFamily: "Figtree-SemiBold", fontSize: 17, color: "#222" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  errorText: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" },
  textLight: { color: "#fff" },
});
