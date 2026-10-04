import { AppText, Row, StateView, useNativeHeader, useTheme } from "@/components/ui";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { fetchNews, WilmaNewsItem } from "@/lib/wilma/graphqlClient";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

export default function WilmaNewsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [items, setItems] = useState<WilmaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setItems(await fetchNews({ forceRefresh: refresh }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tiedotteiden lataaminen epäonnistui.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = useNativeHeader({ title: "Tiedotteet", background: "card" });

  return (
    <>
      <Stack.Screen options={header} />
      <FlatList
        data={loading || error ? [] : items}
        keyExtractor={(item) => String(item.id)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          loading ? (
            <StateView loading />
          ) : error ? (
            <StateView
              icon="error-outline"
              message={error}
              actionLabel="Yritä uudelleen"
              onAction={() => void load()}
            />
          ) : (
            <StateView message="Ei tiedotteita." />
          )
        }
        renderItem={({ item }) => (
          <Row
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/wilma/news-item" as never,
                params: { id: String(item.id), title: item.title },
              })
            }
          >
            <View style={styles.text}>
              <View style={styles.metaLine}>
                <AppText variant="meta" color="textMuted">
                  {item.date}
                </AppText>
                {item.isPermanent ? (
                  <View style={[styles.pinChip, { backgroundColor: theme.accentTint }]}>
                    <PlatformSymbol ios="pin.fill" android="push_pin" size={11} tintColor={theme.accent} />
                    <AppText variant="micro" color="accent">
                      Pysyvä
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="rowTitle" style={styles.title}>
                {item.title}
              </AppText>
              {!!item.excerpt && (
                <AppText variant="bodySmall" color="textSecondary" style={styles.excerpt} numberOfLines={2}>
                  {item.excerpt}
                </AppText>
              )}
              {!!item.teacherName && (
                <AppText variant="caption" color="textFaint" style={styles.author}>
                  {item.teacherName}
                </AppText>
              )}
            </View>
          </Row>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  row: { alignItems: "flex-start", paddingVertical: 14 },
  text: { flex: 1 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  pinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  title: { marginTop: 4 },
  excerpt: { marginTop: 4 },
  author: { marginTop: 8 },
});
