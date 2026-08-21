import { PlatformSymbol } from "@/components/PlatformSymbol";
import DayScheduleSection, {
  type DayScheduleEntry,
} from "@/components/schedule/DayScheduleSection";
import { friendLocationSentence } from "@/lib/friendPresentation";
import type { Friend } from "@/lib/friendsHandler";
import {
  fetchFriendSharedSchedule,
  type SharedScheduleLesson,
} from "@/lib/sharedSchedule";
import {
  formatLocalISO,
  getActiveSchoolDay,
  parseLocalISO,
  schoolDayLabel,
} from "@/lib/wilma/scheduleDates";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

function scheduleEntries(lessons: SharedScheduleLesson[]): DayScheduleEntry[] {
  return lessons.map((lesson) => ({
    id: lesson.id,
    start: lesson.start,
    end: lesson.end,
    title: lesson.subject,
    code: lesson.code || undefined,
    subtitle: lesson.room || undefined,
  }));
}

export default function FriendProfileSheetContent({
  friend,
  onClose,
  onRemove,
  onBlock,
  onReport,
}: Props) {
  const isDark = useColorScheme() === "dark";
  const [lessons, setLessons] = useState<SharedScheduleLesson[]>([]);
  const [scheduleDay, setScheduleDay] = useState(() =>
    formatLocalISO(getActiveSchoolDay())
  );
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
    setScheduleDay(activeDayISO);
    setScheduleLoading(true);
    setScheduleError(false);
    try {
      const schedule = await fetchFriendSharedSchedule(friend.id, activeDay);
      setLessons(
        (schedule?.lessons ?? []).filter((lesson) => lesson.date === activeDayISO)
      );
    } catch (error) {
      console.warn("Friend schedule could not be loaded", error);
      setLessons([]);
      setScheduleError(true);
    } finally {
      setScheduleLoading(false);
    }
  }, [friend]);

  useEffect(() => {
    setLessons([]);
    setReportReason("");
    setReportVisible(false);
    void loadSchedule();
  }, [loadSchedule]);

  const scheduleEntryList = useMemo(() => scheduleEntries(lessons), [lessons]);

  if (!friend) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, isDark && styles.textMutedDark]}>
          Kaverin tietoja ei löytynyt.
        </Text>
      </View>
    );
  }

  const runDestructiveAction = (
    title: string,
    message: string,
    action: () => Promise<void>
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

  return (
    <>
      <View style={styles.header}>
        <View
          style={[styles.avatar, { backgroundColor: friend.color || "#276CE5" }]}
        >
          <Text style={styles.avatarText}>{friend.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, isDark && styles.textPrimaryDark]}>
            {friend.name}
          </Text>
          {!!friend.class && (
            <Text style={[styles.className, isDark && styles.textMutedDark]}>
              {friend.class}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sulje kaverin tiedot"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <PlatformSymbol
            ios="xmark"
            android="close"
            size={22}
            tintColor={isDark ? "#D2D7DF" : "#56606D"}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.locationCard,
          isDark && styles.surfaceDark,
          isDark && styles.borderDark,
        ]}
      >
        <PlatformSymbol
          ios="location.fill"
          android="location_on"
          size={22}
          tintColor={locationText === "Ei sijaintia vielä" ? "#8C939E" : "#276CE5"}
        />
        <View style={styles.locationText}>
          <Text style={[styles.locationTitle, isDark && styles.textPrimaryDark]}>
            {locationText}
          </Text>
          {!!lastSeenText && (
            <Text style={[styles.locationUpdated, isDark && styles.textMutedDark]}>
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
        errorText={
          scheduleError
            ? "Lukujärjestystä ei voitu ladata. Napauta ja yritä uudelleen."
            : null
        }
        emptyText="Ei jaettuja oppitunteja tälle päivälle."
        onRetry={() => void loadSchedule()}
        isDark={isDark}
      />

      <View style={[styles.divider, isDark && styles.dividerDark]} />
      <View style={styles.actions}>
        <Pressable
          disabled={actionPending}
          onPress={() =>
            runDestructiveAction(
              `Poista ${friend.name}`,
              "Haluatko varmasti poistaa tämän kaverin?",
              () => onRemove(friend.id)
            )
          }
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Poista kaveri</Text>
        </Pressable>
        <Pressable
          disabled={actionPending}
          onPress={() =>
            runDestructiveAction(
              `Estä ${friend.name}`,
              "Estetty käyttäjä ei enää näe sijaintiasi tai jakamaasi lukujärjestystä.",
              () => onBlock(friend.id)
            )
          }
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Estä käyttäjä</Text>
        </Pressable>
        <Pressable
          disabled={actionPending}
          onPress={() => setReportVisible(true)}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Ilmoita käyttäjästä</Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={reportVisible}
        onRequestClose={() => !actionPending && setReportVisible(false)}
      >
        <View style={styles.reportBackdrop}>
          <View style={[styles.reportDialog, isDark && styles.dialogDark]}>
            <Text style={[styles.reportTitle, isDark && styles.textPrimaryDark]}>
              Ilmoita käyttäjästä
            </Text>
            <Text style={[styles.reportDescription, isDark && styles.textMutedDark]}>
              Kerro lyhyesti, miksi ilmoitat käyttäjästä {friend.name}.
            </Text>
            <TextInput
              autoFocus
              editable={!actionPending}
              multiline
              maxLength={500}
              onChangeText={setReportReason}
              placeholder="Ilmoituksen syy"
              placeholderTextColor={isDark ? "#7E8794" : "#8A929D"}
              style={[
                styles.reportInput,
                isDark && styles.reportInputDark,
                isDark && styles.textPrimaryDark,
              ]}
              value={reportReason}
            />
            <View style={styles.reportActions}>
              <Pressable
                disabled={actionPending}
                onPress={() => setReportVisible(false)}
                style={styles.dialogButton}
              >
                <Text style={[styles.cancelText, isDark && styles.textPrimaryDark]}>
                  Peruuta
                </Text>
              </Pressable>
              <Pressable
                disabled={!reportReason.trim() || actionPending}
                onPress={() => void submitReport()}
                style={[
                  styles.submitButton,
                  (!reportReason.trim() || actionPending) && styles.submitDisabled,
                ]}
              >
                {actionPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Lähetä</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  avatar: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontFamily: "Figtree-SemiBold", fontSize: 22 },
  headerText: { flex: 1 },
  name: { color: "#18202A", fontFamily: "Figtree-SemiBold", fontSize: 22 },
  className: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 14, marginTop: 2 },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  locationCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F5F7FA", borderColor: "#E1E6ED", borderWidth: 1, borderRadius: 16, padding: 14 },
  locationText: { flex: 1 },
  locationTitle: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 16 },
  locationUpdated: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 13, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#DEE3E9", marginVertical: 22 },
  dividerDark: { backgroundColor: "#3A4048" },
  actions: { gap: 4 },
  actionButton: { minHeight: 46, justifyContent: "center", borderRadius: 12, paddingHorizontal: 12 },
  actionText: { color: "#D92D20", fontFamily: "Figtree-SemiBold", fontSize: 15 },
  pressed: { opacity: 0.65 },
  emptyContainer: { minHeight: 160, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 15 },
  textPrimaryDark: { color: "#F5F7FA" },
  textMutedDark: { color: "#ABB3BE" },
  surfaceDark: { backgroundColor: "#292D33" },
  borderDark: { borderColor: "#3C424A" },
  reportBackdrop: { flex: 1, backgroundColor: "#00000080", justifyContent: "center", padding: 24 },
  reportDialog: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 20 },
  dialogDark: { backgroundColor: "#23262B" },
  reportTitle: { color: "#18202A", fontFamily: "Figtree-SemiBold", fontSize: 20 },
  reportDescription: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 14, lineHeight: 20, marginTop: 6 },
  reportInput: { minHeight: 110, marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: "#D9DEE5", padding: 12, color: "#18202A", fontFamily: "Figtree-Regular", fontSize: 15, textAlignVertical: "top" },
  reportInputDark: { backgroundColor: "#2B2F35", borderColor: "#444A53" },
  reportActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  dialogButton: { minWidth: 84, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  cancelText: { color: "#3E4854", fontFamily: "Figtree-SemiBold", fontSize: 15 },
  submitButton: { minWidth: 96, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#276CE5" },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: "#FFFFFF", fontFamily: "Figtree-SemiBold", fontSize: 15 },
});
