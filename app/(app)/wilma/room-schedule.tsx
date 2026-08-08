import { fetchWilmaRoomSchedule, WilmaRoomSchedule } from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DAYS = ["", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai", "Sunnuntai"];

export default function WilmaRoomScheduleScreen() {
  const router = useRouter();
  const { roomId, code, name } = useLocalSearchParams<{ roomId: string; code?: string; name?: string }>();
  const isDark = useColorScheme() === "dark";
  const [schedule, setSchedule] = useState<WilmaRoomSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(roomId);
    if (!Number.isInteger(id) || id <= 0) { setError("Virheellinen tilan tunniste."); return; }
    fetchWilmaRoomSchedule(id).then(setSchedule).catch((cause) => setError(cause instanceof Error ? cause.message : "Lukujärjestyksen lataaminen epäonnistui."));
  }, [roomId]);

  const lessonsByDay = schedule?.lessons.reduce<Record<number, WilmaRoomSchedule["lessons"]>>((result, lesson) => {
    (result[lesson.day] ??= []).push(lesson); return result;
  }, {}) ?? {};

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, isDark && styles.borderDark]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><MaterialIcons name="arrow-back" size={24} color={isDark ? "#51a2ff" : "#4A89EE"} /></Pressable>
        <View style={{ flex: 1 }}><Text style={[styles.headerTitle, isDark && styles.textLight]}>{schedule?.room.code ?? code ?? "Tila"}</Text><Text style={styles.headerSubtitle}>{schedule?.room.name ?? name ?? ""}</Text></View>
      </View>
      {!schedule && !error ? <View style={styles.centered}><ActivityIndicator size="large" color="#4A89EE" /></View>
      : error ? <View style={styles.centered}><Text style={styles.empty}>{error}</Text></View>
      : <ScrollView contentContainerStyle={styles.content}>
          {Object.keys(lessonsByDay).length ? Object.entries(lessonsByDay).map(([day, lessons]) => (
            <View key={day} style={styles.daySection}>
              <Text style={[styles.dayTitle, isDark && styles.textLight]}>{DAYS[Number(day)]}</Text>
              {lessons.sort((a, b) => a.start.localeCompare(b.start)).map((lesson, index) => (
                <View key={`${day}-${lesson.start}-${index}`} style={[styles.card, isDark && styles.cardDark]}>
                  <Text style={styles.time}>{lesson.start}–{lesson.end}</Text>
                  {lesson.groups.map((group) => <View key={`${group.code}-${group.name}`}><Text style={[styles.groupCode, isDark && styles.textLight]}>{group.code}</Text><Text style={styles.groupName}>{group.name}</Text>{!!group.teachers.length && <Text style={styles.teacher}>{group.teachers.map((teacher) => teacher.name || teacher.code).join(", ")}</Text>}</View>)}
                </View>
              ))}
            </View>
          )) : <Text style={styles.empty}>Tilassa ei ole oppitunteja tällä viikolla.</Text>}
        </ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" }, containerDark: { backgroundColor: "#1e1e1e" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" }, borderDark: { borderBottomColor: "#333" },
  headerTitle: { fontFamily: "Figtree-SemiBold", fontSize: 18, color: "#222" }, headerSubtitle: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }, content: { padding: 16, gap: 18 }, daySection: { gap: 8 }, dayTitle: { fontFamily: "Figtree-SemiBold", fontSize: 16, color: "#202939" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14 }, cardDark: { backgroundColor: "#292929" }, time: { fontFamily: "Figtree-SemiBold", fontSize: 13, color: "#4A89EE", marginBottom: 7 },
  groupCode: { fontFamily: "Figtree-SemiBold", fontSize: 15, color: "#202939" }, groupName: { fontFamily: "Figtree-Regular", fontSize: 13, color: "#667085", marginTop: 2 }, teacher: { fontFamily: "Figtree-Regular", fontSize: 12, color: "#8a94a6", marginTop: 6 },
  empty: { fontFamily: "Figtree-Regular", fontSize: 14, color: "#777", textAlign: "center" }, textLight: { color: "#fff" },
});
