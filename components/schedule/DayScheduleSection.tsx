import { PlatformSymbol } from "@/components/PlatformSymbol";
import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export type DayScheduleEntry = {
  id: string;
  start: string;
  end: string;
  title: string;
  /** Wilma course code shown beside the title, for example `GE01.23`. */
  code?: string;
  subtitle?: string;
  detail?: string;
};

type Props = {
  title: string;
  caption?: string;
  dayLabel: string;
  entries: DayScheduleEntry[];
  loading: boolean;
  errorText?: string | null;
  emptyText: string;
  onRetry?: () => void;
  isDark: boolean;
};

/**
 * One school day of lessons, shared by the friend profile sheet and the room
 * modal so a person's day and a room's day read the same way on the map.
 */
export default function DayScheduleSection({
  title,
  caption,
  dayLabel,
  entries,
  loading,
  errorText,
  emptyText,
  onRetry,
  isDark,
}: Props) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textPrimaryDark]}>{title}</Text>
        {!!caption && (
          <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>{caption}</Text>
        )}
      </View>

      {loading ? (
        <View style={[styles.state, isDark && styles.surfaceDark]}>
          <ActivityIndicator color="#276CE5" />
          <Text style={[styles.stateText, isDark && styles.textMutedDark]}>
            Ladataan lukujärjestystä…
          </Text>
        </View>
      ) : errorText ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yritä ladata lukujärjestys uudelleen"
          disabled={!onRetry}
          onPress={onRetry}
          style={[styles.state, isDark && styles.surfaceDark]}
        >
          <Text style={[styles.stateText, isDark && styles.textMutedDark]}>{errorText}</Text>
        </Pressable>
      ) : (
        <View style={[styles.dayCard, isDark && styles.surfaceDark, isDark && styles.borderDark]}>
          <Text style={[styles.dayTitle, isDark && styles.textPrimaryDark]}>{dayLabel}</Text>
          {entries.length ? (
            entries.map((entry) => (
              <View key={entry.id} style={styles.lessonRow}>
                <Text style={[styles.lessonTime, isDark && styles.textMutedDark]}>
                  {entry.start}–{entry.end}
                </Text>
                <View style={styles.lessonDetails}>
                  <LessonTitleRow
                    title={entry.title}
                    code={entry.code}
                    isDark={isDark}
                    numberOfLines={2}
                    titleStyle={[styles.lessonTitle, isDark && styles.textPrimaryDark]}
                  />
                  {!!entry.subtitle && (
                    <Text style={[styles.lessonSubtitle, isDark && styles.textMutedDark]}>
                      {entry.subtitle}
                    </Text>
                  )}
                  {!!entry.detail && (
                    <Text style={[styles.lessonDetail, isDark && styles.textMutedDark]}>
                      {entry.detail}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyRow}>
              <PlatformSymbol
                ios="calendar"
                android="calendar_month"
                size={20}
                tintColor={isDark ? "#949CA8" : "#77818E"}
              />
              <Text style={[styles.stateText, isDark && styles.textMutedDark]}>{emptyText}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 17 },
  sectionCaption: { color: "#77818E", fontFamily: "Figtree-Regular", fontSize: 13, marginTop: 2 },
  state: { minHeight: 78, borderRadius: 16, backgroundColor: "#F5F7FA", padding: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { flexShrink: 1, color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 14, textAlign: "center" },
  dayCard: { borderRadius: 16, borderWidth: 1, borderColor: "#E4E8ED", padding: 14 },
  dayTitle: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 15, marginBottom: 8 },
  lessonRow: { flexDirection: "row", paddingVertical: 7 },
  lessonTime: { width: 92, color: "#68717D", fontFamily: "Figtree-Medium", fontSize: 13 },
  lessonDetails: { flex: 1 },
  lessonTitle: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 14 },
  lessonSubtitle: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 13, marginTop: 1 },
  lessonDetail: { color: "#8A929D", fontFamily: "Figtree-Regular", fontSize: 12, marginTop: 3 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  textPrimaryDark: { color: "#F5F7FA" },
  textMutedDark: { color: "#ABB3BE" },
  surfaceDark: { backgroundColor: "#292D33" },
  borderDark: { borderColor: "#3C424A" },
});
