import { StateView, useNativeHeader, useTheme } from "@/components/ui";
import { fetchNewsItem, WilmaNewsDetail } from "@/lib/wilma/graphqlClient";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

function documentHtml(body: string, isDark: boolean): string {
  const background = isDark ? "#18191B" : "#fff";
  const foreground = isDark ? "#d4d4d4" : "#222";
  const border = isDark ? "#444" : "#ddd";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    *{box-sizing:border-box} body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.65;color:${foreground};background:${background};padding:20px 18px 40px;margin:0;overflow-wrap:anywhere}
    a{color:#4A89EE} img{max-width:100%;height:auto} table{width:100%;border-collapse:collapse} td,th{padding:8px;border:1px solid ${border}}
    button,.noprint,nav,header,footer{display:none!important}
  </style></head><body>${body}</body></html>`;
}

export default function WilmaNewsItemScreen() {
  const theme = useTheme();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
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
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Tiedotteen lataaminen epäonnistui.",
        ),
      );
  }, [id]);

  const header = useNativeHeader({
    title: detail?.title ?? title ?? "Tiedote",
    background: "flat",
    large: false,
  });

  return (
    <>
      <Stack.Screen options={header} />
      <View style={styles.body}>
        {!detail && !error ? (
          <StateView loading />
        ) : error ? (
          <StateView icon="error-outline" message={error} />
        ) : (
          <WebView
            source={{ html: documentHtml(detail?.htmlBody ?? "", theme.isDark) }}
            javaScriptEnabled={false}
            domStorageEnabled={false}
            style={[styles.web, { backgroundColor: theme.bgFlat }]}
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  web: { flex: 1 },
});
