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
import { scopeBarIn, SearchScopeBar } from "@/modules/search-scope-bar";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

type Tab = "COURSES" | "MATRICULATION";

const TABS = [
  ["COURSES", "Suoritukset"],
  ["MATRICULATION", "Yo-tulokset"],
] as const;

/**
 * A subject's base code — "S2" for courses "S201", "S202" — taken from its
 * courses' codes with the two-digit course number dropped. Empty when the
 * courses don't share one.
 */
function baseCode(courses: { code: string }[]): string {
  const bases = new Set(
    courses
      .map(
        (course) =>
          course.code
            .trim()
            .split(".")[0]
            .match(/^(.+)\d{2}$/)?.[1] ?? "",
      )
      .filter(Boolean),
  );
  return bases.size === 1 ? [...bases][0] : "";
}

export default function WilmaGradesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("COURSES");
  const [gradebook, setGradebook] = useState<WilmaGradebook | null>(null);
  const [matriculation, setMatriculation] = useState<
    WilmaMatriculationResult[]
  >([]);
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
      setError(
        cause instanceof Error
          ? cause.message
          : "Arvosanojen lataaminen epäonnistui.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("fi-FI");
  const matches = (...fields: (string | null | undefined)[]) =>
    !needle ||
    fields.some((field) => field?.toLocaleLowerCase("fi-FI").includes(needle));

  // A subject stays whole when its own name matches; otherwise only its
  // matching courses do, and it drops out when none are left.
  const subjects = useMemo(
    () =>
      (gradebook?.subjects ?? [])
        .map((subject) =>
          matches(subject.name)
            ? subject
            : {
                ...subject,
                courses: subject.courses.filter((course) =>
                  matches(course.code, course.name),
                ),
              },
        )
        .filter((subject) => matches(subject.name) || subject.courses.length),
    // `matches` closes over `needle`, which is the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradebook, needle],
  );
  const results = matriculation.filter((item) => matches(item.subject));

  // A large title with the list as the screen's root, the search field under
  // it, and the selector in the bar as its scope bar — as the teachers page.
  const header = useNativeHeader({
    title: "Arvosanat",
    background: "page",
    searchPlaceholder: "Hae oppiaineella tai kurssilla",
    onSearch: setQuery,
    action: {
      icon: "checklist",
      androidIcon: "checklist",
      accessibilityLabel: "Näytä arvioidut kokeet",
      onPress: () => router.push("/wilma/past-exams" as never),
    },
  });

  const scopeInBar = scopeBarIn(header);

  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
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
        {scopeInBar ? null : (
          <SegmentedControl value={tab} onChange={setTab} options={TABS} />
        )}
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
          <>
            {tab === "COURSES" ? (
              <>
                {!needle && !!gradebook?.summary.length && (
                  <Surface>
                    {gradebook.summary.map((item) => (
                      <View key={item.label} style={styles.summaryRow}>
                        <AppText
                          variant="bodySmall"
                          color="textMuted"
                          style={styles.summaryLabel}
                        >
                          {item.label}
                        </AppText>
                        <AppText variant="rowTitle">{item.value}</AppText>
                      </View>
                    ))}
                  </Surface>
                )}

                {needle && !subjects.length ? (
                  <StateView
                    icon="search-off"
                    message={`Ei tuloksia haulle ”${query.trim()}”.`}
                  />
                ) : null}
                {subjects.map((subject) => (
                  // The base code heads the card; the subject's name leads it,
                  // beside the overall grade.
                  <Surface
                    key={subject.name}
                    title={baseCode(subject.courses) || undefined}
                  >
                    <View style={styles.subjectRow}>
                      <AppText variant="rowTitle" style={styles.flex1}>
                        {subject.name}
                      </AppText>
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
                        <View
                          style={[
                            styles.codeChip,
                            { backgroundColor: theme.accentTint },
                          ]}
                        >
                          <AppText variant="micro" color="accent">
                            {course.code}
                          </AppText>
                        </View>
                        <View style={styles.flex1}>
                          <AppText variant="bodySmall">
                            {course.name || course.code}
                          </AppText>
                          <AppText
                            variant="caption"
                            color="textFaint"
                            style={styles.meta}
                          >
                            {[course.completedOn, course.teacher]
                              .filter(Boolean)
                              .join(" · ")}
                          </AppText>
                        </View>
                        {/* Secondary: the subject's overall grade, above, is
                            the one that stands out. */}
                        {!!course.grade && (
                          <AppText variant="rowTitle" color="textMuted">
                            {course.grade}
                          </AppText>
                        )}
                      </View>
                    ))}
                    {subject.credits ? (
                      <View style={styles.summaryRow}>
                        <AppText
                          variant="bodySmall"
                          color="textMuted"
                          style={styles.summaryLabel}
                        >
                          Yhteensä
                        </AppText>
                        <AppText variant="rowTitle">
                          {subject.credits} ECTS
                        </AppText>
                      </View>
                    ) : null}
                  </Surface>
                ))}
              </>
            ) : results.length ? (
              results.map((item) => (
                <Surface
                  key={`${item.subject}-${item.completedOn}`}
                  title={item.subject}
                >
                  <View style={styles.subjectRow}>
                    <View style={styles.flex1}>
                      <AppText variant="meta" color="textMuted">
                        {[item.completedOn, item.compulsory]
                          .filter(Boolean)
                          .join(" · ")}
                      </AppText>
                      {!!item.points && (
                        <AppText
                          variant="caption"
                          color="textFaint"
                          style={styles.meta}
                        >
                          Pisteet: {item.points}
                        </AppText>
                      )}
                      {!!item.rejectedReason && (
                        <AppText
                          variant="caption"
                          color="danger"
                          style={styles.meta}
                        >
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
              <StateView
                message={
                  needle
                    ? `Ei tuloksia haulle ”${query.trim()}”.`
                    : "Ei yo-tuloksia."
                }
              />
            )}
          </>
        )}
      </ScrollView>
      {/* After the list, not before: UIKit attaches the large title, search
          field and scroll-edge effect to the first scroll view in the
          screen, and this view draws nothing but would be first. */}
      {scopeInBar ? (
        <SearchScopeBar value={tab} onChange={setTab} options={TABS} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
