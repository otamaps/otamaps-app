import DayScheduleSection, {
  type DayScheduleEntry,
} from "@/components/schedule/DayScheduleSection";
import { Room, useRoomStore } from "@/lib/roomService";
import {
  fetchWilmaRoomSchedule,
  getSession,
  type WilmaRoomSchedule,
} from "@/lib/wilma/graphqlClient";
import { lessonLabel } from "@/lib/wilma/lessonLabels";
import {
  formatFinnishDate,
  getActiveSchoolDay,
  getMondayOfWeek,
  schoolDayLabel,
} from "@/lib/wilma/scheduleDates";
import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

export interface RoomModalSheetMethods {
  open: (roomId: string) => void;
  close: () => void;
}

interface RoomModalSheetProps {
  onDismiss?: () => void;
}

const equipmentLabels: Record<string, string> = {
  projector: "Projektori",
  screen: "Näyttö",
  whiteboard: "Valkotaulu",
  computer: "Tietokone",
  microphone: "Mikrofoni",
  speakers: "Kaiuttimet",
  document_camera: "Dokumenttikamera",
  hearing_loop: "Induktiosilmukka",
};

const equipmentIcons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  projector: "videocam",
  screen: "tv",
  whiteboard: "dashboard",
  computer: "computer",
  microphone: "mic",
  speakers: "speaker",
  document_camera: "camera-alt",
  hearing_loop: "hearing",
};

function formatEquipment(equipment: Room["equipment"]): string[] {
  if (!equipment) return [];

  if (Array.isArray(equipment)) {
    return equipment
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return Object.entries(equipment)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      const label = equipmentLabels[key.toLowerCase()] ?? key.replaceAll("_", " ");
      return typeof value === "string" && value.trim() && value !== "true"
        ? `${label}: ${value.trim()}`
        : label;
    });
}

function getFloor(room: Room): string {
  if (room.floor !== null && room.floor !== undefined) return String(room.floor);
  const match = room.room_number?.match(/\d/);
  return match?.[0] ?? "–";
}

function getRoomType(type: string | null): string {
  const labels: Record<string, string> = {
    classroom: "Luokkahuone",
    meeting_room: "Neuvottelutila",
    auditorium: "Auditorio",
    lab: "Laboratorio",
  };
  return type ? labels[type.toLowerCase()] ?? type.replaceAll("_", " ") : "Tila";
}

function equipmentIcon(item: string): keyof typeof MaterialIcons.glyphMap {
  const normalized = item.toLowerCase().replaceAll(" ", "_");
  return equipmentIcons[normalized] ?? "check-circle";
}

/** Rooms without a Wilma id (library, offices) have no bookable lessons. */
function wilmaRoomId(room: Room | null): number | null {
  const id = Number(room?.wilma_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dayScheduleEntries(
  schedule: WilmaRoomSchedule | null,
  weekday: number
): DayScheduleEntry[] {
  return (schedule?.lessons ?? [])
    .filter((lesson) => lesson.day === weekday)
    .sort((first, second) => first.start.localeCompare(second.start))
    .flatMap((lesson, lessonIndex) => {
      const key = `${lesson.day}-${lesson.start}-${lessonIndex}`;
      if (!lesson.groups.length) {
        return [{ id: key, start: lesson.start, end: lesson.end, title: "Varattu" }];
      }
      return lesson.groups.map((group, groupIndex) => {
        const teachers = group.teachers
          .map((teacher) => teacher.name || teacher.code)
          .filter(Boolean)
          .join(", ");
        const { code, title } = lessonLabel(group.code, group.name);
        return {
          id: `${key}-${groupIndex}`,
          start: lesson.start,
          end: lesson.end,
          title: title || "Varattu",
          code: code || undefined,
          detail: teachers || undefined,
        };
      });
    });
}

const RoomModalSheet = forwardRef<RoomModalSheetMethods, RoomModalSheetProps>(
  ({ onDismiss }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const activeRequestRef = useRef(0);
    const [room, setRoom] = useState<Room | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageFailed, setImageFailed] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const scheduleRequestRef = useRef(0);
    const [scheduleEntries, setScheduleEntries] = useState<DayScheduleEntry[]>([]);
    const [scheduleDay, setScheduleDay] = useState(() => getActiveSchoolDay());
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const { fetchRooms } = useRoomStore();
    const isDark = useColorScheme() === "dark";
    const snapPoints = useMemo(() => ["45%", "70%", "94%"], []);

    useEffect(() => {
      setImageFailed(false);
      setImageLoaded(false);
    }, [room?.id, room?.image_url]);

    const fetchRoomDetails = useCallback(
      async (id: string) => {
        const requestId = ++activeRequestRef.current;
        setLoading(true);
        setError(null);

        try {
          const cachedRoom = useRoomStore.getState().rooms.find((item) => item.id === id);
          if (cachedRoom) {
            if (requestId === activeRequestRef.current) setRoom(cachedRoom);
            return;
          }

          await fetchRooms(true);
          const fetchedRoom = useRoomStore.getState().rooms.find((item) => item.id === id);
          if (!fetchedRoom) throw new Error("Room not found");
          if (requestId === activeRequestRef.current) setRoom(fetchedRoom);
        } catch (fetchError) {
          console.error("Error fetching room details:", fetchError);
          if (requestId === activeRequestRef.current) {
            setError("Tilan tietoja ei voitu ladata. Yritä uudelleen.");
          }
        } finally {
          if (requestId === activeRequestRef.current) setLoading(false);
        }
      },
      [fetchRooms]
    );

    const loadSchedule = useCallback(async (wilmaId: number) => {
      const requestId = ++scheduleRequestRef.current;
      // Resolve the day per open so a sheet left mounted overnight, or opened
      // on a weekend, still asks for the school day it is about to render.
      const activeDay = getActiveSchoolDay();
      setScheduleDay(activeDay);
      setScheduleEntries([]);
      setScheduleError(null);
      setScheduleLoading(true);

      try {
        const session = await getSession().catch(() => null);
        if (requestId !== scheduleRequestRef.current) return;
        if (!session) {
          setScheduleError("Kirjaudu Wilmaan nähdäksesi tilan lukujärjestyksen.");
          return;
        }

        const weekMonday = getMondayOfWeek(0, activeDay);
        const schedule = await fetchWilmaRoomSchedule(
          wilmaId,
          formatFinnishDate(weekMonday)
        );
        if (requestId !== scheduleRequestRef.current) return;
        setScheduleEntries(dayScheduleEntries(schedule, activeDay.getDay()));
      } catch (error) {
        if (requestId !== scheduleRequestRef.current) return;
        console.warn("Room schedule could not be loaded", error);
        setScheduleError(
          (error as Error)?.name === "WilmaAuthenticationError"
            ? "Kirjaudu Wilmaan nähdäksesi tilan lukujärjestyksen."
            : "Lukujärjestystä ei voitu ladata. Napauta ja yritä uudelleen."
        );
      } finally {
        if (requestId === scheduleRequestRef.current) setScheduleLoading(false);
      }
    }, []);

    const wilmaId = wilmaRoomId(room);

    useEffect(() => {
      if (!roomId || wilmaId === null) {
        scheduleRequestRef.current += 1;
        setScheduleEntries([]);
        setScheduleError(null);
        setScheduleLoading(false);
        return;
      }
      void loadSchedule(wilmaId);
    }, [loadSchedule, roomId, wilmaId]);

    const open = useCallback(
      (id: string) => {
        setRoomId(id);
        setRoom(useRoomStore.getState().rooms.find((item) => item.id === id) ?? null);
        setError(null);
        sheetRef.current?.present();
        sheetRef.current?.snapToIndex(1);
        void fetchRoomDetails(id);
      },
      [fetchRoomDetails]
    );

    const close = useCallback(() => {
      sheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(ref, () => ({ open, close }), [close, open]);

    const equipment = useMemo(() => formatEquipment(room?.equipment ?? null), [room?.equipment]);
    const background = isDark ? "#16181C" : "#F7F8FA";
    const card = isDark ? "#23262C" : "#FFFFFF";
    const primaryText = isDark ? "#F5F7FA" : "#14171C";
    const secondaryText = isDark ? "#AEB4BE" : "#657080";
    const accent = "#397BE8";
    const hasImage = Boolean(room?.image_url) && !imageFailed;

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={() => {
          activeRequestRef.current += 1;
          setRoomId(null);
          setLoading(false);
          onDismiss?.();
        }}
        backgroundStyle={{ backgroundColor: background }}
        handleStyle={{ backgroundColor: background }}
        handleIndicatorStyle={{ backgroundColor: isDark ? "#626874" : "#C6CBD3" }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.topBar}>
            <View>
              <Text style={[styles.eyebrow, { color: accent }]}>OTANIEMEN LUKIO</Text>
              <Text style={[styles.sheetTitle, { color: primaryText }]}>Tilan tiedot</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sulje"
              hitSlop={10}
              onPress={close}
              style={[styles.closeButton, { backgroundColor: card }]}
            >
              <MaterialIcons name="close" size={22} color={primaryText} />
            </Pressable>
          </View>

          {loading && !room ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={[styles.stateTitle, { color: primaryText }]}>Ladataan tilaa…</Text>
            </View>
          ) : error && !room ? (
            <View style={[styles.stateCard, { backgroundColor: card }]}>
              <View style={styles.errorIcon}>
                <MaterialIcons name="error-outline" size={28} color="#D84C4C" />
              </View>
              <Text style={[styles.stateTitle, { color: primaryText }]}>Tietojen lataus epäonnistui</Text>
              <Text style={[styles.stateBody, { color: secondaryText }]}>{error}</Text>
              <Pressable
                style={[styles.retryButton, { backgroundColor: accent }]}
                onPress={() => roomId && void fetchRoomDetails(roomId)}
              >
                <Text style={styles.retryText}>Yritä uudelleen</Text>
              </Pressable>
            </View>
          ) : room ? (
            <>
              <View style={[styles.hero, { backgroundColor: isDark ? "#202B3D" : "#DFEAFB" }]}>
                <LinearGradient
                  colors={isDark ? ["#253552", "#172034"] : ["#EDF4FF", "#C8DBF8"]}
                  style={styles.fill}
                />
                <View style={styles.heroFallback}>
                  <View style={[styles.roomIcon, { backgroundColor: isDark ? "#334766" : "#FFFFFFB8" }]}>
                    <MaterialIcons name="meeting-room" size={44} color={accent} />
                  </View>
                </View>
                {hasImage ? (
                  <Image
                    source={{ uri: room.image_url! }}
                    style={[styles.roomImage, !imageLoaded && styles.hiddenImage]}
                    resizeMode="cover"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageLoaded(false);
                      setImageFailed(true);
                    }}
                  />
                ) : null}
                {hasImage && imageLoaded ? (
                  <LinearGradient
                    colors={["transparent", "rgba(7, 15, 28, 0.5)"]}
                    style={styles.fill}
                  />
                ) : null}
                {!hasImage ? (
                  <View style={[styles.photoStatus, { backgroundColor: isDark ? "#111722CC" : "#FFFFFFD9" }]}>
                    <MaterialIcons name="image-not-supported" size={15} color={secondaryText} />
                    <Text style={[styles.photoStatusText, { color: secondaryText }]}>Kuva ei saatavilla</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.identityRow}>
                <View style={styles.identityText}>
                  <Text style={[styles.roomNumber, { color: primaryText }]}>{room.room_number || room.title || "Tila"}</Text>
                  {room.title && room.title !== room.room_number ? (
                    <Text style={[styles.roomName, { color: secondaryText }]}>{room.title}</Text>
                  ) : null}
                </View>
                <View style={[styles.typeBadge, { backgroundColor: isDark ? "#263958" : "#E8F0FD" }]}>
                  <Text style={[styles.typeText, { color: accent }]}>{getRoomType(room.type)}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={[styles.infoCard, { backgroundColor: card }]}>
                  <View style={[styles.infoIcon, { backgroundColor: isDark ? "#263958" : "#E8F0FD" }]}>
                    <MaterialIcons name="layers" size={22} color={accent} />
                  </View>
                  <Text style={[styles.infoLabel, { color: secondaryText }]}>Kerros</Text>
                  <Text style={[styles.infoValue, { color: primaryText }]}>{getFloor(room)}</Text>
                </View>
                <View style={[styles.infoCard, { backgroundColor: card }]}>
                  <View style={[styles.infoIcon, { backgroundColor: isDark ? "#263958" : "#E8F0FD" }]}>
                    <MaterialIcons name="people-outline" size={22} color={accent} />
                  </View>
                  <Text style={[styles.infoLabel, { color: secondaryText }]}>Paikkoja</Text>
                  <Text style={[styles.infoValue, { color: primaryText }]}>{room.seats ?? "–"}</Text>
                </View>
                <View style={[styles.infoCard, { backgroundColor: card }]}>
                  <View style={[styles.infoIcon, { backgroundColor: isDark ? "#263958" : "#E8F0FD" }]}>
                    <MaterialIcons name="event-available" size={22} color={accent} />
                  </View>
                  <Text style={[styles.infoLabel, { color: secondaryText }]}>Varaus</Text>
                  <Text style={[styles.infoValue, styles.compactValue, { color: primaryText }]}>
                    {room.bookable ? "Varattavissa" : "Ei varattavissa"}
                  </Text>
                </View>
              </View>

              {room.description?.trim() ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: primaryText }]}>Tietoja tilasta</Text>
                  <Text style={[styles.description, { color: secondaryText }]}>{room.description.trim()}</Text>
                </View>
              ) : null}

              {wilmaId !== null ? (
                <DayScheduleSection
                  title="Päivän lukujärjestys"
                  caption="Wilman varaukset tälle tilalle"
                  dayLabel={schoolDayLabel(scheduleDay)}
                  entries={scheduleEntries}
                  loading={scheduleLoading}
                  errorText={scheduleError}
                  emptyText="Ei varauksia tälle päivälle."
                  onRetry={() => void loadSchedule(wilmaId)}
                  isDark={isDark}
                />
              ) : null}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: primaryText }]}>Varustelu</Text>
                {equipment.length ? (
                  <View style={styles.chips}>
                    {equipment.map((item) => (
                      <View key={item} style={[styles.chip, { backgroundColor: card }]}>
                        <MaterialIcons name={equipmentIcon(item)} size={18} color={accent} />
                        <Text style={[styles.chipText, { color: primaryText }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.emptyEquipment, { backgroundColor: card }]}>
                    <MaterialIcons name="info-outline" size={20} color={secondaryText} />
                    <Text style={[styles.emptyEquipmentText, { color: secondaryText }]}>Varustelutietoja ei ole saatavilla.</Text>
                  </View>
                )}
              </View>
            </>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 56 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 2 },
  sheetTitle: { fontSize: 25, fontWeight: "800", letterSpacing: -0.5 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  stateContainer: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 14 },
  stateCard: { minHeight: 260, borderRadius: 24, padding: 28, alignItems: "center", justifyContent: "center" },
  errorIcon: { marginBottom: 12 },
  stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  stateBody: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 6 },
  retryButton: { borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, marginTop: 18 },
  retryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  hero: { height: 220, borderRadius: 26, overflow: "hidden", position: "relative" },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  heroFallback: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  roomIcon: { width: 86, height: 86, borderRadius: 43, alignItems: "center", justifyContent: "center" },
  roomImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  hiddenImage: { opacity: 0 },
  photoStatus: { position: "absolute", right: 12, bottom: 12, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 },
  photoStatusText: { fontSize: 12, fontWeight: "600" },
  identityRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 20, gap: 12 },
  identityText: { flex: 1 },
  roomNumber: { fontSize: 29, lineHeight: 34, fontWeight: "800", letterSpacing: -0.7 },
  roomName: { fontSize: 15, lineHeight: 21, marginTop: 3 },
  typeBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, maxWidth: "42%" },
  typeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  infoGrid: { flexDirection: "row", gap: 10, marginTop: 20 },
  infoCard: { flex: 1, minHeight: 124, borderRadius: 20, padding: 13 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 11 },
  infoLabel: { fontSize: 11, fontWeight: "600", marginBottom: 3 },
  infoValue: { fontSize: 20, fontWeight: "800" },
  compactValue: { fontSize: 13, lineHeight: 17 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: "600" },
  emptyEquipment: { flexDirection: "row", alignItems: "center", gap: 10, padding: 15, borderRadius: 17 },
  emptyEquipmentText: { flex: 1, fontSize: 14, lineHeight: 20 },
});

RoomModalSheet.displayName = "RoomModalSheet";

export default RoomModalSheet;
