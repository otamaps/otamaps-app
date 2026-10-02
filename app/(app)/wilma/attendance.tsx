import {
  AppText,
  Row,
  StateView,
  Surface,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import { radii } from "@/constants/theme";
import {
  attendanceType,
  formatMarkDate,
  markISO,
  sortMarks,
} from "@/lib/wilma/attendance";
import { AttendanceEntry, fetchAttendance } from "@/lib/wilma/graphqlClient";
import { parseLocalISO, weekdayLabel } from "@/lib/wilma/scheduleDates";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

/** "Maanantai 29.9." — the heading over one day's marks. */
function dayHeading(date: string): string {
  const parsed = parseLocalISO(markISO(date));
  const label = formatMarkDate(date);
  return parsed ? `${weekdayLabel(parsed)} ${label}` : label;
}

/**
 * Every attendance mark Wilma returns — the last four weeks — where the
 * Wilma tab's card shows only the last seven days. Grouped by day as the Me
 * tab groups its rows: a heading per date, its marks as rows beneath.
 */
export default function AttendanceScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      // The same window the dashboard asks for, so a mark on the card is
      // always somewhere on this page too.
      setEntries(sortMarks(await fetchAttendance(0, { forceRefresh: isRefresh })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Merkintöjen lataus epäonnistui");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    const byDay = new Map<string, AttendanceEntry[]>();
    for (const entry of entries) {
      const key = markISO(entry.date);
      byDay.set(key, [...(byDay.get(key) ?? []), entry]);
    }
    return [...byDay.values()];
  }, [entries]);

  const header = useNativeHeader({ title: "Merkinnät", background: "page" });

  // The ScrollView is the root, and stays mounted through loading and
  // errors, so UIKit finds it to collapse the large title against.
  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          loading ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={theme.accent}
            />
          )
        }
      >
        {loading ? (
          <StateView loading />
        ) : error ? (
          <StateView
            icon="error-outline"
            message={error}
            actionLabel="Yritä uudelleen"
            onAction={() => void load()}
          />
        ) : !days.length ? (
          <StateView icon="event-available" message="Ei merkintöjä viimeisen neljän viikon ajalta." />
        ) : (
          <>
            {days.map((marks) => (
              <Surface
                key={markISO(marks[0].date)}
                title={dayHeading(marks[0].date)}
                style={styles.group}
              >
                {marks.map((mark, index) => {
                  const type = attendanceType(mark);
                  return (
                    <Row key={`${mark.course}-${index}`} chevron={false}>
                      <View style={styles.text}>
                        <AppText variant="body" numberOfLines={1}>
                          {mark.course}
                        </AppText>
                        {mark.teacher ? (
                          <AppText
                            variant="meta"
                            color="textMuted"
                            numberOfLines={1}
                            style={styles.teacher}
                          >
                            {mark.teacher}
                          </AppText>
                        ) : null}
                      </View>
                      <View style={styles.trailing}>
                        <View style={[styles.chip, { backgroundColor: type.color + "28" }]}>
                          <AppText variant="micro" style={{ color: type.color }}>
                            {type.label}
                          </AppText>
                        </View>
                        {mark.excused ? (
                          <AppText variant="caption" color="textMuted">
                            Selvitetty
                          </AppText>
                        ) : null}
                      </View>
                    </Row>
                  );
                })}
              </Surface>
            ))}
            <AppText variant="meta" color="textMuted" style={styles.footnote}>
              Wilma näyttää merkinnät viimeisen neljän viikon ajalta.
            </AppText>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 40 },
  group: { borderRadius: radii.xl },
  text: { flex: 1 },
  teacher: { marginTop: 2 },
  trailing: { alignItems: "flex-end", gap: 4 },
  chip: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  footnote: { marginHorizontal: 20, marginTop: 10 },
});
