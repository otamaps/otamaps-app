import { LunchShiftImportPayload, validateLunchShiftImport } from "@/lib/lunchShiftCore";
import {
  getLunchShiftImportMeta,
  isCurrentUserAdmin,
  LunchShiftImportMeta,
  replaceLunchShifts,
} from "@/lib/lunchShiftService";
import * as Clipboard from "expo-clipboard";
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
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXTRACTION_PROMPT = `You are extracting structured data from a Finnish upper-secondary school's "ruokailuvuorot" (lunch shift) schedule. This document is a grid of weekday x time slot x lunch shift (vuoro), where each cell lists the Wilma course codes of the courses whose students eat lunch during that slot.

Extract every row that lists specific course codes, and output ONLY this JSON - no markdown fences, no explanation:
{ "periodLabel": string, "slots": [ { "weekday": 1-5, "startTime": "HH:MM", "endTime": "HH:MM", "shift": 1 | 2, "courseCodes": string[] } ] }

Rules:
1. weekday is always an integer 1-5 (1 = maanantai, 5 = perjantai), never a Finnish weekday name.
2. startTime/endTime are 24-hour HH:MM (e.g. 11:05), never 11.05, 11:05:00, or a range string.
3. courseCodes must be copied exactly as printed (case, dots, digits, e.g. AI01.02, KE01.01). Do not translate, reformat, or invent a code.
4. Skip entirely any row or column labeled "Yht.", "Yhteensa", or similar totals.
5. Skip entirely any row for "2. tunnin vapaatuntilaiset" (or similarly worded free-2nd-hour rows) that has no actual course codes listed. Do not invent a placeholder such as VAPAA, -, or N/A - if a cell has no real course code, omit that slot rather than guessing.
6. If a cell is empty or illegible, omit that slot rather than guessing.
7. If the document does not distinguish two lunch shifts, use "shift": 1 for every row.
8. Set periodLabel from any period/date-range heading in the document. If no such heading exists, use an empty string.`;

const formatTime = (value: string | null): string => {
  if (!value) return "Ei tuontia";
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function LunchShiftAdminScreen() {
  const isDark = useColorScheme() === "dark";
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [meta, setMeta] = useState<LunchShiftImportMeta | null>(null);
  const [pasted, setPasted] = useState("");
  const [pendingPayload, setPendingPayload] =
    useState<LunchShiftImportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const isAdmin = await isCurrentUserAdmin();
      setAuthorized(isAdmin);
      if (!isAdmin) return;

      setMeta(await getLunchShiftImportMeta());
    } catch (error) {
      console.error("Lunch shift admin data failed:", error);
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

  const copyPrompt = async () => {
    await Clipboard.setStringAsync(EXTRACTION_PROMPT);
    Alert.alert("Kopioitu", "Kehote kopioitiin leikepöydälle.");
  };

  const preview = () => {
    const result = validateLunchShiftImport(pasted);
    if (!result.ok) {
      Alert.alert("Virheellinen JSON", result.errors.join("\n"));
      return;
    }
    if (result.warnings.length > 0) {
      Alert.alert(
        "Tarkista ennen tallennusta",
        `${result.warnings.join("\n")}\n\nJatketaanko tallennukseen?`,
        [
          { text: "Peruuta", style: "cancel" },
          {
            text: "Jatka",
            onPress: () => setPendingPayload(result.payload),
          },
        ]
      );
      return;
    }
    setPendingPayload(result.payload);
  };

  const submit = async () => {
    if (!pendingPayload || submitting) return;
    setSubmitting(true);
    try {
      await replaceLunchShifts(pendingPayload.periodLabel, pendingPayload.slots);
      setPendingPayload(null);
      setPasted("");
      await loadData(false);
      Alert.alert("Tallennettu", "Ruokailuvuorot päivitettiin.");
    } catch (error) {
      console.error("Lunch shift import failed:", error);
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
        <Stack.Screen options={{ title: "Ruokailuvuorojen hallinta" }} />
        <ActivityIndicator size="large" color="#4A89EE" />
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: background }]}>
        <Stack.Screen options={{ title: "Ruokailuvuorojen hallinta" }} />
        <Text style={[styles.title, { color: text }]}>Ei käyttöoikeutta</Text>
        <Text style={[styles.centeredText, { color: muted }]}>
          Tämä näkymä on vain tietokannassa määritetyille ylläpitäjille.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <Stack.Screen options={{ title: "Ruokailuvuorojen hallinta" }} />
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
          <Text style={[styles.eyebrow, { color: muted }]}>NYKYINEN TUONTI</Text>
          <Text style={[styles.statusText, { color: text }]}>
            {meta?.periodLabel || "Ei jaksomerkintää"}
          </Text>
          <Text style={[styles.meta, { color: muted }]}>
            {meta
              ? `${meta.slotCount} riviä · tuotu ${formatTime(meta.importedAt)}`
              : "Ruokailuvuoroja ei ole vielä tuotu."}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.title, { color: text }]}>1. Kopioi kehote</Text>
          <Text style={[styles.description, { color: muted }]}>
            Liitä kehote ja jakson ruokailuvuorot-PDF Claude.ai-keskusteluun,
            ja liitä sen palauttama JSON alle.
          </Text>
          <Text style={[styles.description, { color: muted, marginTop: 8 }]}>
            Käytä vähintään Claude Sonnet 5 -mallia pidennetyllä pohdinnalla
            (tai parempaa, esim. Opus 5). Kevyemmät tai ilmaiset mallit
            tekevät usein virheitä kurssikoodeissa (esim. Ä luetaan väärin
            muotoon ”A1”, tai ”D1” muotoon ”01”) — tarkista rivit huolella
            ennen tallennusta.
          </Text>
          <Pressable
            onPress={() => void copyPrompt()}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: isDark ? "#2D2D2D" : "#EDF2FB" },
              pressed && { opacity: 0.78 },
            ]}
          >
            <Text style={[styles.submitText, { color: isDark ? "#AFC8FF" : "#276CE5" }]}>
              Kopioi kehote
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.title, { color: text }]}>2. Liitä JSON</Text>
          <TextInput
            value={pasted}
            onChangeText={(value) => {
              setPasted(value);
              setPendingPayload(null);
            }}
            multiline
            placeholder='{"periodLabel": "...", "slots": [...] }'
            placeholderTextColor={muted}
            style={[
              styles.jsonInput,
              {
                color: text,
                borderColor: isDark ? "#3B3B3B" : "#E3E7EC",
                backgroundColor: isDark ? "#1E1E1E" : "#FAFBFC",
              },
            ]}
          />
          <Pressable
            disabled={!pasted.trim()}
            onPress={preview}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: isDark ? "#2D2D2D" : "#EDF2FB" },
              !pasted.trim() && styles.disabled,
              pressed && { opacity: 0.78 },
            ]}
          >
            <Text style={[styles.submitText, { color: isDark ? "#AFC8FF" : "#276CE5" }]}>
              Tarkista
            </Text>
          </Pressable>

          {pendingPayload && (
            <View
              style={[
                styles.activityBox,
                { borderColor: isDark ? "#3B3B3B" : "#E3E7EC" },
              ]}
            >
              <Text style={[styles.activityLabel, { color: text }]}>
                {pendingPayload.periodLabel || "(ei jaksomerkintää)"} ·{" "}
                {pendingPayload.slots.length} riviä valmiina tallennettavaksi.
              </Text>
              <Pressable
                disabled={submitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  submitting && styles.disabled,
                  pressed && { opacity: 0.78 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>
                    Tallenna ja korvaa nykyiset vuorot
                  </Text>
                )}
              </Pressable>
            </View>
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
  statusText: { marginTop: 10, fontSize: 22, fontFamily: "Figtree-SemiBold" },
  meta: { marginTop: 3, fontSize: 13 },
  jsonInput: {
    marginTop: 12,
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: "Menlo",
    textAlignVertical: "top",
  },
  activityBox: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, gap: 10 },
  activityLabel: { fontSize: 14, lineHeight: 20 },
  submitButton: {
    height: 50,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: "#276CE5",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Figtree-SemiBold" },
  disabled: { opacity: 0.4 },
});
