import { AppText, Row, StateView, useNativeHeader, useTheme } from "@/components/ui";
import { fetchPastExams, WilmaPastExam } from "@/lib/wilma/graphqlClient";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

export default function WilmaPastExamsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<WilmaPastExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setItems(await fetchPastExams({ forceRefresh: refresh }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arvosanojen lataaminen epäonnistui.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = useNativeHeader({ title: "Arvosanat", background: "card" });

  return (
    <>
      <Stack.Screen options={header} />
      <FlatList
        data={loading || error ? [] : items}
        keyExtractor={(item, index) => `${item.date}-${item.examTitle}-${index}`}
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
            <StateView message="Ei arvioituja kokeita viimeisen vuoden ajalta." />
          )
        }
        renderItem={({ item }) => (
          <Row style={styles.row} chevron={false}>
            <View style={styles.titleText}>
              <AppText variant="rowTitle">{item.examTitle}</AppText>
              <AppText variant="meta" color="textMuted" style={styles.meta}>
                {[item.date, item.teacherName].filter(Boolean).join(" · ")}
              </AppText>
              {!!item.details && (
                <AppText variant="bodySmall" color="textSecondary" style={styles.details}>
                  {item.details}
                </AppText>
              )}
              {!!item.writtenAssessment && (
                <View style={[styles.assessment, { backgroundColor: theme.accentTint }]}>
                  <AppText variant="bodySmall">{item.writtenAssessment}</AppText>
                </View>
              )}
            </View>
            <View
              style={[
                styles.grade,
                { backgroundColor: item.grade ? theme.accentTint : theme.border },
              ]}
            >
              <AppText
                variant="title"
                color={item.grade ? "accent" : "textMuted"}
                style={styles.gradeText}
              >
                {item.grade || "–"}
              </AppText>
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
  titleText: { flex: 1 },
  meta: { marginTop: 3 },
  details: { marginTop: 8 },
  assessment: { borderRadius: 10, padding: 11, marginTop: 10 },
  grade: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  gradeText: { textAlign: "center" },
});
