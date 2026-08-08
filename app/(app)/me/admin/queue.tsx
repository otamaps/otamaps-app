import {
  getAdminQueueActivity,
  getQueueColor,
  getQueueLabel,
  getQueueObservationHistory,
  getQueueStatuses,
  isCurrentUserAdmin,
  QUEUE_LEVEL_LABELS,
  QueueActivity,
  QueueLevel,
  QueueObservation,
  QueueStatus,
  recordQueueObservation,
} from "@/lib/queueService";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LEVELS: QueueLevel[] = [1, 2, 3, 4, 5];

const formatTime = (value: string | null): string => {
  if (!value) return "Ei havaintoja";
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function QueueAdminScreen() {
  const isDark = useColorScheme() === "dark";
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [activity, setActivity] = useState<QueueActivity | null>(null);
  const [history, setHistory] = useState<QueueObservation[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<QueueLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const isAdmin = await isCurrentUserAdmin();
      setAuthorized(isAdmin);
      if (!isAdmin) return;

      const statuses = await getQueueStatuses();
      const ruokalinjasto = statuses.find(
        (item) => item.slug === "ruokalinjasto"
      );
      if (!ruokalinjasto) {
        throw new Error("Ruokalinjaston jonoaluetta ei löytynyt.");
      }

      const [activityRows, observations] = await Promise.all([
        getAdminQueueActivity(),
        getQueueObservationHistory(ruokalinjasto.area_id),
      ]);
      setStatus(ruokalinjasto);
      setActivity(
        activityRows.find((item) => item.area_id === ruokalinjasto.area_id) ??
          null
      );
      setHistory(observations);
    } catch (error) {
      console.error("Queue admin data failed:", error);
      Alert.alert(
        "Tietojen lataus epäonnistui",
        error instanceof Error ? error.message : "Yritä hetken kuluttua uudelleen."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submit = async () => {
    if (!status || selectedLevel == null || submitting) return;
    setSubmitting(true);
    try {
      await recordQueueObservation(status.area_id, selectedLevel);
      setSelectedLevel(null);
      await loadData(false);
      Alert.alert("Tallennettu", "Ruokalinjaston jonotilanne päivitettiin.");
    } catch (error) {
      console.error("Queue observation failed:", error);
      Alert.alert(
        "Tallennus epäonnistui",
        error instanceof Error ? error.message : "Yritä hetken kuluttua uudelleen."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const background = isDark ? "#171717" : "#F4F6F8";
  const card = isDark ? "#252525" : "#FFFFFF";
  const text = isDark ? "#F8F8F8" : "#20242A";
  const muted = isDark ? "#ACB3BD" : "#68717D";

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: background }]}>
        <Stack.Screen options={{ title: "Jonotilanteen hallinta" }} />
        <ActivityIndicator size="large" color="#4A89EE" />
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: background }]}>
        <Stack.Screen options={{ title: "Jonotilanteen hallinta" }} />
        <Text style={[styles.title, { color: text }]}>Ei käyttöoikeutta</Text>
        <Text style={[styles.centeredText, { color: muted }]}>
          Tämä näkymä on vain tietokannassa määritetyille ylläpitäjille.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <Stack.Screen options={{ title: "Jonotilanteen hallinta" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadData(false);
            }}
          />
        }
      >
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.eyebrow, { color: muted }]}>RUOKALINJASTO</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getQueueColor(status?.status_level ?? null) },
              ]}
            />
            <Text style={[styles.statusText, { color: text }]}>
              {getQueueLabel(status?.status_level ?? null)}
            </Text>
          </View>
          <Text style={[styles.meta, { color: muted }]}>
            {status?.status_source === "manual"
              ? "Ylläpitäjän arvio"
              : status?.status_source === "crowd"
              ? "Automaattinen vilkkausarvio"
              : "Ei tuoretta arviota"}
            {status?.status_observed_at
              ? ` · ${formatTime(status.status_observed_at)}`
              : ""}
          </Text>
          <View style={[styles.activityBox, { borderColor: isDark ? "#3B3B3B" : "#E3E7EC" }]}>
            <Text style={[styles.activityValue, { color: text }]}>
              {activity?.sample_count_10m ?? 0}
            </Text>
            <Text style={[styles.activityLabel, { color: muted }]}>
              anonyymiä sijaintinäytettä 10 minuutissa — ei henkilömäärä
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.title, { color: text }]}>Kirjaa jonotilanne</Text>
          <Text style={[styles.description, { color: muted }]}>
            Valitse tämänhetkinen arvio. Merkintä saa palvelimen aikaleiman ja
            pysyy historiassa.
          </Text>
          <View style={styles.levelList}>
            {LEVELS.map((level) => {
              const selected = selectedLevel === level;
              const color = getQueueColor(level);
              return (
                <Pressable
                  key={level}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSelectedLevel(level)}
                  style={({ pressed }) => [
                    styles.levelButton,
                    {
                      borderColor: selected ? color : isDark ? "#444" : "#DDE2E8",
                      backgroundColor: selected
                        ? `${color}20`
                        : isDark
                        ? "#2D2D2D"
                        : "#FAFBFC",
                    },
                    pressed && { opacity: 0.72 },
                  ]}
                >
                  <View style={[styles.levelDot, { backgroundColor: color }]} />
                  <Text style={[styles.levelNumber, { color: muted }]}>{level}</Text>
                  <Text style={[styles.levelText, { color: text }]}>
                    {QUEUE_LEVEL_LABELS[level]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            disabled={selectedLevel == null || submitting}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.submitButton,
              (selectedLevel == null || submitting) && styles.disabled,
              pressed && { opacity: 0.78 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Tallenna arvio</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.title, { color: text }]}>Viimeisimmät arviot</Text>
          {history.length === 0 ? (
            <Text style={[styles.description, { color: muted }]}>
              Ei vielä manuaalisia arvioita.
            </Text>
          ) : (
            history.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.historyRow,
                  { borderTopColor: isDark ? "#393939" : "#EBEEF2" },
                ]}
              >
                <View style={styles.historyMain}>
                  <View
                    style={[
                      styles.levelDot,
                      { backgroundColor: getQueueColor(item.level) },
                    ]}
                  />
                  <View>
                    <Text style={[styles.historyLabel, { color: text }]}>
                      {QUEUE_LEVEL_LABELS[item.level]}
                    </Text>
                    <Text style={[styles.meta, { color: muted }]}>
                      {formatTime(item.observed_at)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sampleCount, { color: muted }]}>
                  {item.crowd_sample_count} näytettä
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  centeredText: { marginTop: 10, textAlign: "center", fontSize: 15, lineHeight: 22 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  card: { borderRadius: 14, padding: 18 },
  eyebrow: { fontSize: 12, fontFamily: "Figtree-SemiBold", letterSpacing: 1.1 },
  title: { fontSize: 20, fontFamily: "Figtree-SemiBold" },
  description: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  statusDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  statusText: { fontSize: 24, fontFamily: "Figtree-SemiBold" },
  meta: { marginTop: 3, fontSize: 13 },
  activityBox: { marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  activityValue: { fontSize: 26, fontFamily: "Figtree-SemiBold" },
  activityLabel: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  levelList: { marginTop: 14, gap: 8 },
  levelButton: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, flexDirection: "row", alignItems: "center" },
  levelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  levelNumber: { width: 22, fontSize: 14 },
  levelText: { fontSize: 16, fontFamily: "Figtree-Medium" },
  submitButton: { height: 50, marginTop: 14, borderRadius: 10, backgroundColor: "#276CE5", alignItems: "center", justifyContent: "center" },
  submitText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Figtree-SemiBold" },
  disabled: { opacity: 0.4 },
  historyRow: { borderTopWidth: 1, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyMain: { flexDirection: "row", alignItems: "center" },
  historyLabel: { fontSize: 15, fontFamily: "Figtree-Medium" },
  sampleCount: { fontSize: 12 },
});
