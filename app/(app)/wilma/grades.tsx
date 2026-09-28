import {
  AppText,
  SegmentedControl,
  StateView,
  Surface,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import {
  fetchGradebook,
  fetchMatriculationResults,
  WilmaGradebook,
  WilmaMatriculationResult,
} from "@/lib/wilma/graphqlClient";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

type Tab = "COURSES" | "MATRICULATION";

const TABS = [
  ["COURSES", "Suoritukset"],
  ["MATRICULATION", "Yo-tulokset"],
] as const;

export default function WilmaGradesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("COURSES");
  const [gradebook, setGradebook] = useState<WilmaGradebook | null>(null);
  const [matriculation, setMatriculation] = useState<WilmaMatriculationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const [nextGradebook, nextMatriculation] = await Promise.all([
        fetchGradebook({ forceRefresh: refresh }),
        fetchMatriculationResults({ forceRefresh: refresh }),
      ]);
      setGradebook(nextGradebook);
      setMatriculation(nextMatriculation);
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

  // Compact, not large: the tabs sit directly under the bar, which puts a
  // ScrollView — not this screen — as the root a large title would need to
  // collapse against.
  const header = useNativeHeader({
    title: "Arvosanat",
    background: "page",
    large: false,
    action: {
      icon: "checklist",
      accessibilityLabel: "Näytä arvioidut kokeet",
      onPress: () => router.push("/wilma/past-exams" as never),
    },
  });

  return (
    <>
      <Stack.Screen options={header} />
      <View style={styles.body}>
        <SegmentedControl value={tab} onChange={setTab} options={TABS} />

        {loading ? (
          <StateView loading />
        ) : error ? (
          <StateView
            icon="error-outline"
            message={error}
            actionLabel="Yritä uudelleen"
            onAction={() => void load()}
          />
        ) : (
          <ScrollView
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
          >
            {tab === "COURSES" ? (
              <>
                {!!gradebook?.summary.length && (
                  <Surface>
                    {gradebook.summary.map((item) => (
                      <View key={item.label} style={styles.summaryRow}>
                        <AppText variant="bodySmall" color="textMuted" style={styles.summaryLabel}>
                          {item.label}
                        </AppText>
                        <AppText variant="rowTitle">{item.value}</AppText>
                      </View>
                    ))}
                  </Surface>
                )}

                {gradebook?.subjects.map((subject) => (
                  <Surface key={subject.name} title={subject.name}>
                    <View style={styles.subjectRow}>
                      <View style={styles.flex1}>
                        {!!subject.credits && (
                          <AppText variant="meta" color="textMuted">
                            {subject.credits} ECTS
                          </AppText>
                        )}
                      </View>
                      {!!subject.grade && (
                        <AppText variant="heading3" color="accent">
                          {subject.grade}
                        </AppText>
                      )}
                    </View>
                    {subject.courses.map((course) => (
                      <View
                        key={`${subject.name}-${course.code}-${course.completedOn}`}
                        style={styles.courseRow}
                      >
                        <View style={[styles.codeChip, { backgroundColor: theme.accentTint }]}>
                          <AppText variant="micro" color="accent">
                            {course.code}
                          </AppText>
                        </View>
                        <View style={styles.flex1}>
                          <AppText variant="bodySmall">{course.name || course.code}</AppText>
                          <AppText variant="caption" color="textFaint" style={styles.meta}>
                            {[course.completedOn, course.teacher].filter(Boolean).join(" · ")}
                          </AppText>
                        </View>
                        {!!course.grade && (
                          <AppText variant="title" color="accent">
                            {course.grade}
                          </AppText>
                        )}
                      </View>
                    ))}
                  </Surface>
                ))}
              </>
            ) : matriculation.length ? (
              matriculation.map((item) => (
                <Surface key={`${item.subject}-${item.completedOn}`} title={item.subject}>
                  <View style={styles.subjectRow}>
                    <View style={styles.flex1}>
                      <AppText variant="meta" color="textMuted">
                        {[item.completedOn, item.compulsory].filter(Boolean).join(" · ")}
                      </AppText>
                      {!!item.points && (
                        <AppText variant="caption" color="textFaint" style={styles.meta}>
                          Pisteet: {item.points}
                        </AppText>
                      )}
                      {!!item.rejectedReason && (
                        <AppText variant="caption" color="danger" style={styles.meta}>
                          {item.rejectedReason}
                        </AppText>
                      )}
                    </View>
                    {!!item.grade && (
                      <AppText variant="heading3" color="accent">
                        {item.grade}
                      </AppText>
                    )}
                  </View>
                </Surface>
              ))
            ) : (
              <StateView message="Ei yo-tuloksia." />
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 40 },
  flex1: { flex: 1 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  summaryLabel: { flex: 1 },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  codeChip: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  meta: { marginTop: 2 },
});
