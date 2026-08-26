import { PlatformSymbol } from "@/components/PlatformSymbol";
import LessonTitleRow from "@/components/schedule/LessonTitleRow";
import {
  addMinutesClock,
  clockMinutes,
  freeSlotHeight,
} from "@/lib/lunchShiftCore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type DayScheduleEntry = {
  id: string;
  start: string;
  end: string;
  title: string;
  /** Wilma course code shown beside the title, for example `GE01.23`. */
  code?: string;
  subtitle?: string;
  detail?: string;
  /** A lunch window nested inside this entry's time span, rendered as a chip. */
  lunch?: { start: string; end: string };
  /** A gap with no lesson ("Hyppytunti"), styled distinctly from a real lesson. */
  isFreeSlot?: boolean;
};

function currentClock(): string {
  return new Date().toTimeString().slice(0, 5);
}

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
  /** Set to false when `entries` belong to a future day, so nothing is marked past/current. */
  isToday?: boolean;
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
  isToday = true,
}: Props) {
  const [now, setNow] = useState(currentClock);
  useEffect(() => {
    const id = setInterval(() => setNow(currentClock()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textPrimaryDark]}>
          {title}
        </Text>
        {!!caption && (
          <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>
            {caption}
          </Text>
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
          <Text style={[styles.stateText, isDark && styles.textMutedDark]}>
            {errorText}
          </Text>
        </Pressable>
      ) : (
        <View
          style={[
            styles.dayCard,
            isDark && styles.surfaceDark,
            isDark && styles.borderDark,
          ]}
        >
          <Text style={[styles.dayTitle, isDark && styles.textPrimaryDark]}>
            {dayLabel}
          </Text>
          {entries.length ? (
            entries.map((entry, i) => {
              const isPast = isToday && entry.end <= now;
              const isCurrent =
                isToday && entry.start <= now && now < entry.end;
              // The gap's real end always lands exactly on the next lesson's
              // start, so trim the label a few minutes early rather than
              // showing the same time on two consecutive rows.
              const displayEnd = entry.isFreeSlot
                ? addMinutesClock(entry.end, -5)
                : entry.end;
              const tallHeight = entry.isFreeSlot
                ? freeSlotHeight(
                    clockMinutes(entry.end) - clockMinutes(entry.start),
                  )
                : undefined;
              // A free slot has no divider of its own, so it needs a little
              // breathing room from the lesson that just ended above it.
              const prev = entries[i - 1];
              const spaceAbove =
                entry.isFreeSlot &&
                !!prev &&
                !prev.isFreeSlot &&
                prev.id !== "lunch";
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.lessonRow,
                    !!entry.lunch && styles.lessonRowWithLunch,
                    entry.isFreeSlot && styles.freeSlotRow,
                    entry.isFreeSlot && isDark && styles.freeSlotRowDark,
                    isPast && styles.pastOpacity,
                    spaceAbove && styles.freeSlotSpaceAbove,
                    !!tallHeight && {
                      minHeight: tallHeight,
                      alignItems: "center",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.lessonTime,
                      isDark && styles.textMutedDark,
                      isCurrent && styles.lessonTimeCurrent,
                    ]}
                  >
                    {entry.start}–{displayEnd}
                  </Text>
                  <View style={styles.lessonDetails}>
                    <LessonTitleRow
                      title={entry.title}
                      code={entry.code}
                      isDark={isDark}
                      numberOfLines={2}
                      titleStyle={[
                        entry.isFreeSlot && !isCurrent
                          ? styles.freeSlotTitle
                          : styles.lessonTitle,
                        isDark &&
                          (entry.isFreeSlot && !isCurrent
                            ? styles.freeSlotTitleDark
                            : styles.textPrimaryDark),
                      ]}
                    />
                    {!!entry.subtitle && (
                      <Text
                        style={[
                          styles.lessonSubtitle,
                          isDark && styles.textMutedDark,
                        ]}
                      >
                        {entry.subtitle}
                      </Text>
                    )}
                    {!!entry.detail && (
                      <Text
                        style={[
                          styles.lessonDetail,
                          isDark && styles.textMutedDark,
                        ]}
                      >
                        {entry.detail}
                      </Text>
                    )}
                    {!!entry.lunch && (
                      <View
                        style={[
                          styles.lunchChip,
                          isDark && styles.lunchChipDark,
                        ]}
                      >
                        <PlatformSymbol
                          ios="fork.knife"
                          android="restaurant"
                          size={11}
                          tintColor={isDark ? "#FBBF24" : "#B45309"}
                        />
                        <Text
                          style={[
                            styles.lunchChipText,
                            isDark && styles.lunchChipTextDark,
                          ]}
                        >
                          Lounas {entry.lunch.start}–{entry.lunch.end}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyRow}>
              <PlatformSymbol
                ios="calendar"
                android="calendar_month"
                size={20}
                tintColor={isDark ? "#949CA8" : "#77818E"}
              />
              <Text style={[styles.stateText, isDark && styles.textMutedDark]}>
                {emptyText}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: {
    color: "#202833",
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
  },
  sectionCaption: {
    color: "#77818E",
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    marginTop: 2,
  },
  state: {
    minHeight: 78,
    borderRadius: 16,
    backgroundColor: "#F5F7FA",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    flexShrink: 1,
    color: "#68717D",
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    textAlign: "center",
  },
  dayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E8ED",
    padding: 14,
  },
  dayTitle: {
    color: "#202833",
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    marginBottom: 8,
  },
  lessonRow: { flexDirection: "row", paddingVertical: 7 },
  lessonRowWithLunch: { paddingVertical: 9 },
  freeSlotRow: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D9DEE5",
    borderRadius: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  freeSlotRowDark: { borderColor: "#4A5058" },
  freeSlotSpaceAbove: { marginVertical: 8 },
  lessonTime: {
    width: 92,
    color: "#68717D",
    fontFamily: "Figtree-Medium",
    fontSize: 13,
  },
  lessonTimeCurrent: { color: "#276CE5", fontFamily: "Figtree-SemiBold" },
  lessonDetails: { flex: 1 },
  lessonTitle: {
    color: "#202833",
    fontFamily: "Figtree-SemiBold",
    fontSize: 14,
  },
  freeSlotTitle: {
    color: "#8A929D",
    fontFamily: "Figtree-SemiBold",
    fontStyle: "italic",
    fontSize: 14,
  },
  freeSlotTitleDark: { color: "#9CA3AF" },
  pastOpacity: { opacity: 0.5 },
  lessonSubtitle: {
    color: "#68717D",
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    marginTop: 1,
  },
  lessonDetail: {
    color: "#8A929D",
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    marginTop: 3,
  },
  lunchChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "#FEF3C7",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 5,
  },
  lunchChipDark: { backgroundColor: "#78350F55" },
  lunchChipText: {
    color: "#B45309",
    fontFamily: "Figtree-SemiBold",
    fontSize: 12,
  },
  lunchChipTextDark: { color: "#FBBF24" },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  textPrimaryDark: { color: "#F5F7FA" },
  textMutedDark: { color: "#ABB3BE" },
  surfaceDark: { backgroundColor: "#232427" },
  borderDark: { borderColor: "#3A3D42" },
});
