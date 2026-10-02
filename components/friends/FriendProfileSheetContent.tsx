import { fonts } from "@/constants/typography";
import { GlassSurface, HAS_LIQUID_GLASS } from "@/components/map/GlassSurface";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import DayScheduleSection, {
  type DayScheduleEntry,
} from "@/components/schedule/DayScheduleSection";
import { nativeListColors } from "@/components/sheets/sheetTheme";
import { colors } from "@/constants/theme";
import { formatClassLabel } from "@/lib/classLabel";
import { getReadableLabelColor } from "@/lib/color";
import { friendLocationSentence } from "@/lib/friendPresentation";
import type { Friend } from "@/lib/friendsHandler";
import {
  addMinutesClock,
  clockValue,
  lunchSplit,
  matchLunchShift,
  splitLessonGap,
  type LunchMatch,
} from "@/lib/lunchShiftCore";
import { getLunchShiftsForWeekday } from "@/lib/lunchShiftService";
import {
  fetchFriendSharedSchedule,
  fetchFriendStaleDaySchedule,
  type SharedScheduleLesson,
} from "@/lib/sharedSchedule";
import {
  formatLocalISO,
  getActiveSchoolDay,
  getMondayOfWeek,
  getNextSchoolDay,
  isoWeekdayOf,
  parseLocalISO,
  schoolDayLabel,
} from "@/lib/wilma/scheduleDates";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { formatLastSeen } from "../friendItem";

type Props = {
  friend: Friend | null;
  onClose: () => void;
  onRemove: (friendId: string) => Promise<void>;
  onBlock: (friendId: string) => Promise<void>;
  onReport: (friendId: string, reason: string) => Promise<void>;
};

function dayLabel(date: string): string {
  const parsed = parseLocalISO(date);
  return parsed ? schoolDayLabel(parsed) : date;
}

function nestedLunchFor(
  start: string,
  end: string,
  lunch: LunchMatch | null,
): { start: string; end: string } | undefined {
  const split = lunch ? lunchSplit(start, end, lunch) : null;
  return split && lunch
    ? { start: clockValue(lunch.startTime), end: clockValue(lunch.endTime) }
    : undefined;
}

type ScheduleSlot =
  | { kind: "lesson"; lesson: SharedScheduleLesson; start: string; end: string }
  | { kind: "freeslot"; id: string; start: string; end: string }
  | { kind: "lunch"; id: string; start: string; end: string };

function scheduleEntries(
  lessons: SharedScheduleLesson[],
  lunch: LunchMatch | null,
): DayScheduleEntry[] {
  const sortedLessons = [...lessons].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  // Lessons and the gap(s) after each — a real gap is either genuine free
  // time or, between two three-hour blocks, the day's lunch break; see
  // `splitLessonGap`. Short passing-period breaks produce nothing.
  const slots: ScheduleSlot[] = [];
  sortedLessons.forEach((lesson, i) => {
    slots.push({
      kind: "lesson",
      lesson,
      start: clockValue(lesson.start),
      end: clockValue(lesson.end),
    });
    const nextLesson = sortedLessons[i + 1];
    if (!nextLesson) return;
    splitLessonGap(lesson, nextLesson).forEach((piece, pieceIndex) => {
      const id = `gap:${lesson.id}:${piece.start}:${pieceIndex}`;
      slots.push(
        piece.kind === "lunch"
          ? { kind: "lunch", id, start: piece.start, end: piece.end }
          : { kind: "freeslot", id, start: piece.start, end: piece.end },
      );
    });
  });

  // A lunch spanning the short boundary between two adjacent slots (a lesson
  // ending right where the next one starts, or a lesson and its free slot)
  // would otherwise get nested — and shown — in both. Keep it only on the
  // last slot of each run that overlaps it.
  const rawLunch = slots.map((slot) =>
    nestedLunchFor(slot.start, slot.end, lunch),
  );
  const dedupedLunch = rawLunch.map((entry, i) =>
    rawLunch[i + 1] ? undefined : entry,
  );

  // Lunch sits inside the long midday block, so rather than splitting the
  // lesson into a "before"/"after" pair of entries, the lesson stays a
  // single entry that renders taller and shows the lunch window nested
  // inside it.
  const entries: DayScheduleEntry[] = slots.map((slot, i) => {
    if (slot.kind === "lesson") {
      return {
        id: slot.lesson.id,
        start: slot.start,
        end: slot.end,
        // The course code alone, never the course's title: it is what a
        // classmate recognises and how lessons are named on the timetable
        // board. The subject only stands in for a lesson without a code.
        title: slot.lesson.code || slot.lesson.subject,
        subtitle: slot.lesson.room || undefined,
        lunch: dedupedLunch[i],
      };
    }
    if (slot.kind === "lunch") {
      return { id: slot.id, start: slot.start, end: slot.end, title: "Lounas" };
    }
    return {
      id: slot.id,
      start: slot.start,
      end: slot.end,
      title: "Hyppytunti",
      isFreeSlot: true,
      lunch: dedupedLunch[i],
    };
  });

  // A lunch that falls outside every shared lesson and every free slot
  // still belongs on the day.
  if (lunch && !dedupedLunch.some(Boolean)) {
    entries.push({
      id: "lunch",
      start: clockValue(lunch.startTime),
      end: clockValue(lunch.endTime),
      title: "Lounas",
    });
  }

  const sortedEntries = entries.sort((a, b) => a.start.localeCompare(b.start));

  // A free slot only makes sense after a lesson has already happened —
  // drop one that would otherwise open the list. A chain of several split
  // free slots (see `splitLessonGap`) is fine; only a leading one is dropped.
  return sortedEntries.filter((entry, i) => !entry.isFreeSlot || i > 0);
}

export default function FriendProfileSheetContent({
  friend,
  onClose,
  onRemove,
  onBlock,
  onReport,
}: Props) {
  const isDark = useColorScheme() === "dark";
  const list = nativeListColors(isDark);
  const accent = isDark ? colors.accentDark : colors.accent;
  const [lessons, setLessons] = useState<SharedScheduleLesson[]>([]);
  const [lunch, setLunch] = useState<LunchMatch | null>(null);
  const [scheduleDay, setScheduleDay] = useState(() =>
    formatLocalISO(getActiveSchoolDay()),
  );
  const [scheduleIsToday, setScheduleIsToday] = useState(true);
  const [scheduleIsStale, setScheduleIsStale] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const loadSchedule = useCallback(async () => {
    if (!friend) return;
    // Resolve the day per open so a sheet left mounted overnight, or opened on
    // a weekend, still asks for the school day it is about to render.
    const activeDay = getActiveSchoolDay();
    const activeDayISO = formatLocalISO(activeDay);
    setScheduleLoading(true);
    setScheduleError(false);
    try {
      const schedule = await fetchFriendSharedSchedule(friend.id, activeDay);
      const todaysLessons = (schedule?.lessons ?? []).filter(
        (lesson) => lesson.date === activeDayISO,
      );

      // Once the friend's day is over (30 min past their last shared
      // lesson's end), show their next school day instead of an empty card.
      const lastLessonEnd = todaysLessons.reduce(
        (latest, lesson) =>
          clockValue(lesson.end) > latest ? clockValue(lesson.end) : latest,
        "",
      );
      const nowClockValue = clockValue(new Date().toTimeString());
      const showNextDay =
        !!lastLessonEnd && nowClockValue >= addMinutesClock(lastLessonEnd, 30);

      let targetDay = activeDay;
      let targetDayISO = activeDayISO;
      let dayLessons = todaysLessons;
      let weekMissing = !schedule;

      if (showNextDay) {
        targetDay = getNextSchoolDay(activeDay);
        targetDayISO = formatLocalISO(targetDay);

        const sameWeek =
          formatLocalISO(getMondayOfWeek(0, targetDay)) ===
          formatLocalISO(getMondayOfWeek(0, activeDay));

        if (sameWeek) {
          dayLessons = (schedule?.lessons ?? []).filter(
            (lesson) => lesson.date === targetDayISO,
          );
        } else {
          const nextWeekSchedule = await fetchFriendSharedSchedule(
            friend.id,
            targetDay,
          );
          weekMissing = !nextWeekSchedule;
          dayLessons = (nextWeekSchedule?.lessons ?? []).filter(
            (lesson) => lesson.date === targetDayISO,
          );
        }
      }

      // A snapshot only lands once the friend opens their own schedule, so a
      // week they have not looked at yet would read as "no lessons at all".
      // Stand in with the same weekday from their most recent shared week and
      // let the section say it may be outdated. A week they *have* shared with
      // nothing on this day is a real free day, so it keeps the empty state.
      let isStale = false;
      if (weekMissing) {
        const stale = await fetchFriendStaleDaySchedule(friend.id, targetDay);
        if (stale) {
          dayLessons = stale.lessons;
          isStale = true;
        }
      }

      setScheduleDay(targetDayISO);
      setScheduleIsToday(!showNextDay);
      setScheduleIsStale(isStale);
      setLessons(dayLessons);

      // Their lunch window comes from the same course-code lookup the own
      // dashboard uses. Nothing is shown unless they shared their schedule at
      // all, so the sharing consent that gates `dayLessons` gates this too.
      // Kept in its own try/catch so a lunch-shift failure never blocks the
      // schedule the sheet is really about.
      const codes = dayLessons.map((lesson) => lesson.code).filter(Boolean);
      if (!codes.length) {
        setLunch(null);
      } else {
        try {
          const rows = await getLunchShiftsForWeekday(isoWeekdayOf(targetDay));
          setLunch(matchLunchShift(codes, rows));
        } catch (error) {
          console.warn("Friend lunch shift could not be resolved", error);
          setLunch(null);
        }
      }
    } catch (error) {
      console.warn("Friend schedule could not be loaded", error);
      setLessons([]);
      setLunch(null);
      setScheduleIsStale(false);
      setScheduleError(true);
    } finally {
      setScheduleLoading(false);
    }
  }, [friend]);

  useEffect(() => {
    setLessons([]);
    setLunch(null);
    setScheduleIsStale(false);
    setReportReason("");
    setReportVisible(false);
    void loadSchedule();
  }, [loadSchedule]);

  const scheduleEntryList = useMemo(
    () => scheduleEntries(lessons, lunch),
    [lessons, lunch],
  );

  if (!friend) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: list.secondaryLabel }]}>
          Kaverin tietoja ei löytynyt.
        </Text>
      </View>
    );
  }

  const runDestructiveAction = (
    title: string,
    message: string,
    action: () => Promise<void>,
  ) => {
    Alert.alert(title, message, [
      { text: "Peruuta", style: "cancel" },
      {
        text: "Kyllä",
        style: "destructive",
        onPress: async () => {
          setActionPending(true);
          try {
            await action();
            onClose();
          } catch (error) {
            console.error("Friend action failed", error);
            Alert.alert("Virhe", "Toiminto epäonnistui. Yritä uudelleen.");
          } finally {
            setActionPending(false);
          }
        },
      },
    ]);
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    if (!reason) return;
    setActionPending(true);
    try {
      await onReport(friend.id, reason);
      setReportVisible(false);
      setReportReason("");
      Alert.alert("Ilmoitus lähetetty", "Kiitos ilmoituksesta.");
    } catch (error) {
      console.error("Friend report failed", error);
      Alert.alert("Virhe", "Ilmoituksen lähettäminen epäonnistui.");
    } finally {
      setActionPending(false);
    }
  };

  const locationText = friendLocationSentence(friend.user_friendly_location);
  const lastSeenText = formatLastSeen(friend.lastSeen ?? undefined);

  const hasLocation = locationText !== "Ei sijaintia vielä";
  const avatarColor = friend.color || "#3478F5";

  // The three ways out of a friendship, as the destructive section that
  // closes an iOS contact card: one inset group of red rows.
  const destructiveActions = [
    {
      label: "Poista kaveri",
      onPress: () =>
        runDestructiveAction(
          `Poista ${friend.name}`,
          "Haluatko varmasti poistaa tämän kaverin?",
          () => onRemove(friend.id),
        ),
    },
    {
      label: "Estä käyttäjä",
      onPress: () =>
        runDestructiveAction(
          `Estä ${friend.name}`,
          "Estetty käyttäjä ei enää näe sijaintiasi tai jakamaasi lukujärjestystä.",
          () => onBlock(friend.id),
        ),
    },
    { label: "Ilmoita käyttäjästä", onPress: () => setReportVisible(true) },
  ];

  return (
    <>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text
            style={[
              styles.avatarText,
              { color: getReadableLabelColor(avatarColor) },
            ]}
          >
            {friend.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: list.label }]} numberOfLines={2}>
            {friend.name}
          </Text>
          {!!friend.class && (
            <Text style={[styles.className, { color: list.secondaryLabel }]}>
              {formatClassLabel(friend.class)}
            </Text>
          )}
        </View>
        {/* iOS 26's close control in a sheet: a glass circle with an ✕. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sulje kaverin tiedot"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [
            !HAS_LIQUID_GLASS && pressed && styles.pressed,
          ]}
        >
          <GlassSurface radius={18} interactive style={styles.closeButton}>
            <PlatformSymbol
              ios="xmark"
              android="close"
              size={14}
              weight="semibold"
              tintColor={list.secondaryLabel}
            />
          </GlassSurface>
        </Pressable>
      </View>

      <View
        style={[
          styles.group,
          styles.locationCell,
          { backgroundColor: list.fill },
        ]}
      >
        <PlatformSymbol
          ios={hasLocation ? "location.fill" : "location.slash"}
          android={hasLocation ? "near_me" : "location_disabled"}
          size={18}
          tintColor={hasLocation ? accent : list.secondaryLabel}
        />
        <View style={styles.locationText}>
          <Text style={[styles.cellTitle, { color: list.label }]}>
            {locationText}
          </Text>
          {!!lastSeenText && (
            <Text style={[styles.cellSubtitle, { color: list.secondaryLabel }]}>
              Päivitetty {lastSeenText.toLowerCase()}
            </Text>
          )}
        </View>
      </View>

      <DayScheduleSection
        title="Päivän lukujärjestys"
        caption="Vain kaverin jakamat oppitunnit"
        dayLabel={dayLabel(scheduleDay)}
        entries={scheduleEntryList}
        loading={scheduleLoading}
        isToday={scheduleIsToday}
        errorText={
          scheduleError
            ? "Lukujärjestystä ei voitu ladata. Napauta ja yritä uudelleen."
            : null
        }
        emptyText="Ei jaettuja oppitunteja tälle päivälle."
        onRetry={() => void loadSchedule()}
        isDark={isDark}
      />

      {/* Said as iOS says it, in a section footer: small grey text under
          the schedule, not a coloured banner competing with it. */}
      {scheduleIsStale && (
        <View style={styles.footer}>
          <PlatformSymbol
            ios="clock.arrow.circlepath"
            android="history"
            size={13}
            tintColor={list.secondaryLabel}
          />
          <Text style={[styles.footerText, { color: list.secondaryLabel }]}>
            Tämän viikon lukujärjestys ei ole saatavilla, joten yllä oleva voi
            olla vanhentunut.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.group,
          styles.actionsGroup,
          // A step lighter than the system fill in light mode, where the
          // full fill read heavy under three red labels. Dark keeps it.
          { backgroundColor: isDark ? list.fill : "rgba(118,118,128,0.07)" },
        ]}
      >
        {destructiveActions.map((action, index) => (
          <React.Fragment key={action.label}>
            {index > 0 && (
              <View
                style={[styles.separator, { backgroundColor: list.separator }]}
              />
            )}
            <Pressable
              accessibilityRole="button"
              disabled={actionPending}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { backgroundColor: list.highlight },
              ]}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={reportVisible}
        onRequestClose={() => !actionPending && setReportVisible(false)}
      >
        <View style={styles.reportBackdrop}>
          <View
            style={[
              styles.reportDialog,
              { backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF" },
            ]}
          >
            <Text style={[styles.reportTitle, { color: list.label }]}>
              Ilmoita käyttäjästä
            </Text>
            <Text
              style={[styles.reportDescription, { color: list.secondaryLabel }]}
            >
              Kerro lyhyesti, miksi ilmoitat käyttäjästä {friend.name}.
            </Text>
            <TextInput
              autoFocus
              editable={!actionPending}
              multiline
              maxLength={500}
              onChangeText={setReportReason}
              placeholder="Ilmoituksen syy"
              placeholderTextColor={list.tertiaryLabel}
              selectionColor={accent}
              style={[
                styles.reportInput,
                { backgroundColor: list.fill, color: list.label },
              ]}
              value={reportReason}
            />
            <View style={styles.reportActions}>
              <Pressable
                disabled={actionPending}
                onPress={() => setReportVisible(false)}
                style={({ pressed }) => [
                  styles.dialogButton,
                  { backgroundColor: list.fill },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dialogButtonText, { color: list.label }]}>
                  Peruuta
                </Text>
              </Pressable>
              <Pressable
                disabled={!reportReason.trim() || actionPending}
                onPress={() => void submitReport()}
                style={({ pressed }) => [
                  styles.dialogButton,
                  { backgroundColor: accent },
                  (!reportReason.trim() || actionPending) &&
                    styles.submitDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {actionPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.dialogButtonText, styles.submitText]}>
                    Lähetä
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// The system font and UIKit's own colours throughout, as the map's sheet
// and controls: no fontFamily anywhere below.
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...fonts.semiBold, fontSize: 24 },
  headerText: { flex: 1 },
  // UIKit's title2.
  name: { ...fonts.bold, fontSize: 22 },
  className: { ...fonts.regular, fontSize: 15, marginTop: 2 },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  // An inset grouped section, as in Settings or a contact card.
  group: { borderRadius: 14, borderCurve: "continuous", overflow: "hidden" },
  locationCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  locationText: { flex: 1 },
  cellTitle: { ...fonts.regular, fontSize: 17 },
  cellSubtitle: { ...fonts.regular, fontSize: 14, marginTop: 2 },
  // Well below the fold, so removing, blocking or reporting a friend takes
  // a deliberate scroll rather than sitting under a thumb on open.
  actionsGroup: {
    marginTop: Math.round(Dimensions.get("window").height * 0.45),
    // Room after the last row, so it clears the home indicator and the
    // sheet's bottom edge comfortably instead of ending flush with them.
    marginBottom: 67,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  footerText: { ...fonts.regular, flex: 1, fontSize: 13, lineHeight: 18 },
  actionRow: { minHeight: 46, justifyContent: "center", paddingHorizontal: 16 },
  // systemRed: the destructive role's own colour.
  actionText: { ...fonts.regular, color: "#FF3B30", fontSize: 17 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  pressed: { opacity: 0.6 },
  emptyContainer: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { ...fonts.regular, fontSize: 15 },
  reportBackdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "center",
    padding: 24,
  },
  reportDialog: { borderRadius: 26, borderCurve: "continuous", padding: 20 },
  reportTitle: { ...fonts.semiBold, fontSize: 17, textAlign: "center" },
  reportDescription: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
  reportInput: {
    ...fonts.regular,
    minHeight: 100,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
    fontSize: 17,
    textAlignVertical: "top",
  },
  reportActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  // Equal-width capsules, as iOS 26 sets an alert's two actions.
  dialogButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogButtonText: { ...fonts.semiBold, fontSize: 17 },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: "#FFFFFF" },
});
