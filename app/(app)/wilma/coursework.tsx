import {
  AppText,
  Row,
  SegmentedControl,
  StateView,
  Surface,
  useNativeHeader,
  useTheme,
  useSelectorSwipe,
} from "@/components/ui";
import { GestureDetector } from "react-native-gesture-handler";
import { radii } from "@/constants/theme";
import { fetchCoursework, WilmaCourse } from "@/lib/wilma/graphqlClient";
import { formatLocalISO, weekdayLabel } from "@/lib/wilma/scheduleDates";
import { scopeBarIn, SearchScopeBar } from "@/modules/search-scope-bar";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

type CourseworkTab = "HOMEWORK" | "DIARY" | "EXAMS";

type Entry = {
  key: string;
  /** Local `YYYY-MM-DD`, or "" when Wilma gave no usable date. */
  day: string;
  courseCode: string;
  title: string;
  body: string;
  teacher: string;
};

type Section = { key: string; title: string; entries: Entry[]; past?: boolean };

const TABS = [
  ["HOMEWORK", "Tehtävät"],
  ["DIARY", "Päiväkirja"],
  ["EXAMS", "Kokeet"],
] as const;

const EMPTY: Record<CourseworkTab, string> = {
  HOMEWORK: "Ei kotitehtäviä.",
  DIARY: "Ei tuntipäiväkirjan merkintöjä.",
  EXAMS: "Ei kokeita.",
};

/** Wilma sends `YYYY-MM-DD` here, but `D.M.YYYY` elsewhere; accept both. */
function toDay(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const [day, month, year] = value.split(".").map(Number);
  if (!day || !month || !year) return "";
  return formatLocalISO(new Date(year, month - 1, day));
}

/** "Torstai 2.10." — a group's heading; the year only when it isn't this one. */
function dayHeading(day: string): string {
  if (!day) return "Ei päivämäärää";
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year, month - 1, date);
  const label = `${date}.${month}.${year === new Date().getFullYear() ? "" : year}`;
  return `${weekdayLabel(parsed)} ${label}`;
}

/** The course as its code — never its title, as every timetable shows it. */
function codeOf(course: WilmaCourse): string {
  return (
    course.courseCode || course.name || course.caption || course.courseName
  );
}

function entriesFor(courses: WilmaCourse[], tab: CourseworkTab): Entry[] {
  return courses.flatMap((course) => {
    const teacher = course.teachers
      .map((item) => item.teacherName)
      .filter(Boolean)
      .join(", ");
    const courseCode = codeOf(course);
    if (tab === "HOMEWORK") {
      return course.homework.map((item) => ({
        key: `h-${course.id}-${item.rowNumber}`,
        day: toDay(item.date),
        courseCode,
        title: "Kotitehtävä",
        body: item.homework,
        teacher,
      }));
    }
    if (tab === "DIARY") {
      return course.diary.map((item) => ({
        key: `d-${course.id}-${item.rowNumber}`,
        day: toDay(item.date),
        courseCode,
        title: item.lesson ? `${item.lesson}. tunti` : "Tunti",
        body: item.note,
        teacher: item.teacherName || teacher,
      }));
    }
    return course.exams.map((item) => ({
      key: `e-${course.id}-${item.id}`,
      day: toDay(item.date),
      courseCode,
      title: item.name || item.caption || "Koe",
      body: [item.topic, item.info].filter(Boolean).join("\n"),
      teacher,
    }));
  });
}

/** Entries grouped by day, in the order given. */
function byDay(entries: Entry[]): Section[] {
  const sections: Section[] = [];
  for (const entry of entries) {
    const last = sections[sections.length - 1];
    if (last?.key === entry.day) last.entries.push(entry);
    else
      sections.push({
        key: entry.day,
        title: dayHeading(entry.day),
        entries: [entry],
      });
  }
  return sections;
}

/**
 * Homework and the lesson diary read newest first: what was set or covered
 * last is what matters now (see GitHub issue #3). Exams split instead —
 * upcoming soonest first, then past ones newest first, dimmed — since an
 * exam's date is a deadline rather than a record.
 */
function sectionsFor(courses: WilmaCourse[], tab: CourseworkTab): Section[] {
  const entries = entriesFor(courses, tab);
  const newestFirst = (a: Entry, b: Entry) => b.day.localeCompare(a.day);
  if (tab !== "EXAMS") return byDay(entries.sort(newestFirst));

  const today = formatLocalISO(new Date());
  const upcoming = entries
    .filter((entry) => !entry.day || entry.day >= today)
    .sort((a, b) => (a.day || "9").localeCompare(b.day || "9"));
  const past = entries
    .filter((entry) => entry.day && entry.day < today)
    .sort(newestFirst);
  return [
    ...byDay(upcoming),
    ...byDay(past).map((section) => ({
      ...section,
      key: `past-${section.key}`,
      past: true,
    })),
  ];
}

/**
 * Keeps the entries whose course code, title, text or teacher contain the
 * query, dropping days left empty — the header's search, on the current tab.
 */
function filterSections(sections: Section[], query: string): Section[] {
  const needle = query.trim().toLocaleLowerCase("fi-FI");
  if (!needle) return sections;
  return sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter((entry) =>
        [entry.courseCode, entry.title, entry.body, entry.teacher].some(
          (field) => field.toLocaleLowerCase("fi-FI").includes(needle),
        ),
      ),
    }))
    .filter((section) => section.entries.length);
}

/**
 * Homework, the lesson diary and exams across every course. Headed as the
 * teachers and rooms pages are — a large title that collapses on scroll — with
 * the glass selector the friends page uses, grouped by day as Merkinnät is.
 */
export default function WilmaCourseworkScreen() {
  const theme = useTheme();
  const [courses, setCourses] = useState<WilmaCourse[]>([]);
  const [tab, setTab] = useState<CourseworkTab>("HOMEWORK");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setCourses(await fetchCoursework(undefined, { forceRefresh: refresh }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Kurssitietojen lataaminen epäonnistui.",
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
  const sections = useMemo(
    () => filterSections(sectionsFor(courses, tab), query),
    [courses, tab, query],
  );
  const firstPast = sections.findIndex((section) => section.past);

  // A large title, as the teachers and rooms pages have: it collapses into
  // the bar on scroll, and the bar draws the soft scroll edge those pages
  // show. A compact bar keeps the hard edge even when asked for `soft`.
  const header = useNativeHeader({
    // Back by swiping only from the first option; elsewhere a sideways swipe
    // changes the option.
    swipeBack: tab === TABS[0][0],
    title: "Kurssit ja tehtävät",
    background: "page",
    // searchPlaceholder: "Hae kurssikoodilla tai tekstillä",
    // onSearch: setQuery,
  });

  // The scope bar belongs to the search field, so it is only there when
  // the header has one; otherwise the selector stays in the page.
  const scopeInBar = scopeBarIn(header);
  const swipe = useSelectorSwipe(TABS, tab, setTab);

  return (
    <>
      <Stack.Screen options={header} />
      {/* The selector lives in the navigation bar, as its search field's
          scope bar — beneath the field, as the teachers page's bar is shaped,
          so the bar's soft scroll edge runs under it. Where that isn't
          available it is the list's first item instead. */}
      <GestureDetector gesture={swipe}>
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
        ) : !sections.length ? (
          <StateView
            icon={query.trim() ? "search-off" : "inbox"}
            message={
              query.trim()
                ? `Ei tuloksia haulle ”${query.trim()}”.`
                : EMPTY[tab]
            }
          />
        ) : (
          sections.map((section, index) => (
            <View key={section.key} style={section.past && styles.past}>
              {index === firstPast ? (
                <AppText variant="sectionTitle" style={styles.divider}>
                  Menneet kokeet
                </AppText>
              ) : null}
              <Surface title={section.title} style={styles.group}>
                {section.entries.map((entry) => (
                  <Row key={entry.key} chevron={false} style={styles.row}>
                    <View style={styles.text}>
                      <View style={styles.titleLine}>
                        <View
                          style={[
                            styles.code,
                            { backgroundColor: theme.accentTint },
                          ]}
                        >
                          <AppText variant="micro" color="accent">
                            {entry.courseCode}
                          </AppText>
                        </View>
                        <AppText
                          variant="rowTitle"
                          style={styles.title}
                          numberOfLines={1}
                        >
                          {entry.title}
                        </AppText>
                      </View>
                      {entry.body ? (
                        <AppText variant="bodySmall" style={styles.body}>
                          {entry.body}
                        </AppText>
                      ) : null}
                      {entry.teacher ? (
                        <AppText
                          variant="meta"
                          color="textMuted"
                          style={styles.teacher}
                        >
                          {entry.teacher}
                        </AppText>
                      ) : null}
                    </View>
                  </Row>
                ))}
              </Surface>
            </View>
          ))
        )}
      </ScrollView>
      </GestureDetector>
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
  group: { borderRadius: radii.xl },
  // Exams already sat; legible, but stepped back from what is still ahead.
  past: { opacity: 0.6 },
  divider: { marginHorizontal: 20, marginTop: 32 },
  row: { alignItems: "flex-start", paddingVertical: 12 },
  text: { flex: 1 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  code: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  title: { flexShrink: 1 },
  body: { marginTop: 6 },
  teacher: { marginTop: 6 },
});
