import { AppText, StateView, useNativeHeader, useTheme } from "@/components/ui";
import { fetchMessage, MessageDetail } from "@/lib/wilma/graphqlClient";
import { buildMessageThreadHtml, messageReplyCountLabel } from "@/lib/wilma/messageThread";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export default function MessageScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id, subject, sender } = useLocalSearchParams<{
    id: string;
    subject?: string;
    sender?: string;
  }>();

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
        .then((nextDetail) => {
          if (active) setDetail(nextDetail);
        })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : "Lataus epäonnistui");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [id]),
  );

  const headerTitle = detail?.subject ?? subject ?? "Viesti";
  const threadSender = detail?.sender || sender || "";
  const replyLabel = detail ? messageReplyCountLabel(detail.replies.length) : "";
  const headerSubtitle = [threadSender, replyLabel].filter(Boolean).join(" · ");

  const header = useNativeHeader({
    title: headerTitle,
    background: "flat",
    large: false,
    action:
      !loading && !error && id
        ? {
            icon: "arrowshape.turn.up.left",
            accessibilityLabel: "Vastaa viestiketjuun",
            onPress: () =>
              router.push({
                pathname: "/wilma/reply" as never,
                params: { messageId: id, subject: headerTitle, sender: threadSender },
              }),
          }
        : undefined,
  });

  return (
    <>
      <Stack.Screen options={header} />
      <View style={styles.body}>
        {loading ? (
          <StateView loading />
        ) : error ? (
          <StateView icon="error-outline" message={error} />
        ) : detail ? (
          <>
            {!!headerSubtitle && (
              // The native bar has room for one line, and the subject already
              // takes it — the sender and reply count move down here instead
              // of being dropped.
              <View
                style={[
                  styles.subtitle,
                  { backgroundColor: theme.card, borderBottomColor: theme.border },
                ]}
              >
                <AppText variant="meta" color="textMuted" numberOfLines={1}>
                  {headerSubtitle}
                </AppText>
              </View>
            )}
            <WebView
              source={{ html: buildMessageThreadHtml(detail, theme.isDark, sender ?? "") }}
              javaScriptEnabled={false}
              domStorageEnabled={false}
              style={[styles.web, { backgroundColor: theme.bgFlat }]}
              scrollEnabled
              showsVerticalScrollIndicator={false}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={(request) => {
                if (request.url === "about:blank" || request.url.startsWith("data:")) return true;
                if (request.url.startsWith("http://") || request.url.startsWith("https://")) {
                  void openExternalUrl(request.url);
                }
                return false;
              }}
            />
          </>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  subtitle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  web: { flex: 1 },
});
