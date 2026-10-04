import { fonts } from "@/constants/typography";
import DayScheduleSection, {
  type DayScheduleEntry,
} from "@/components/schedule/DayScheduleSection";
import { GlassSurface, HAS_LIQUID_GLASS } from "@/components/map/GlassSurface";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import {
  glassSheetChrome,
  nativeListColors,
  sheetPalette,
} from "@/components/sheets/sheetTheme";
import { colors } from "@/constants/theme";
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
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
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

type Glyph = {
  ios: React.ComponentProps<typeof PlatformSymbol>["ios"];
  android: React.ComponentProps<typeof PlatformSymbol>["android"];
};

const equipmentIcons: Record<string, Glyph> = {
  projector: { ios: "videoprojector", android: "videocam" },
  screen: { ios: "tv", android: "tv" },
  whiteboard: { ios: "rectangle.and.pencil.and.ellipsis", android: "dashboard" },
  computer: { ios: "desktopcomputer", android: "computer" },
  microphone: { ios: "mic", android: "mic" },
  speakers: { ios: "hifispeaker", android: "speaker" },
  document_camera: { ios: "web.camera", android: "photo_camera" },
  hearing_loop: { ios: "ear", android: "hearing" },
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
      const label =
        equipmentLabels[key.toLowerCase()] ?? key.replaceAll("_", " ");
      return typeof value === "string" && value.trim() && value !== "true"
        ? `${label}: ${value.trim()}`
        : label;
    });
}

function getFloor(room: Room): string {
  if (room.floor !== null && room.floor !== undefined)
    return String(room.floor);
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
  return type
    ? (labels[type.toLowerCase()] ?? type.replaceAll("_", " "))
    : "Tila";
}

function equipmentIcon(item: string): Glyph {
  const normalized = item.toLowerCase().replaceAll(" ", "_");
  return equipmentIcons[normalized] ?? { ios: "checkmark.circle", android: "check_circle" };
}

/** Rooms without a Wilma id (library, offices) have no bookable lessons. */
function wilmaRoomId(room: Room | null): number | null {
  const id = Number(room?.wilma_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dayScheduleEntries(
  schedule: WilmaRoomSchedule | null,
  weekday: number,
): DayScheduleEntry[] {
  return (schedule?.lessons ?? [])
    .filter((lesson) => lesson.day === weekday)
    .sort((first, second) => first.start.localeCompare(second.start))
    .flatMap((lesson, lessonIndex) => {
      const key = `${lesson.day}-${lesson.start}-${lessonIndex}`;
      if (!lesson.groups.length) {
        return [
          { id: key, start: lesson.start, end: lesson.end, title: "Varattu" },
        ];
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
          // The course code alone, as the friend profile's schedule shows it;
          // the course's title only stands in when there is no code.
          title: code || title || "Varattu",
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
    const [scheduleEntries, setScheduleEntries] = useState<DayScheduleEntry[]>(
      [],
    );
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
          const cachedRoom = useRoomStore
            .getState()
            .rooms.find((item) => item.id === id);
          if (cachedRoom) {
            if (requestId === activeRequestRef.current) setRoom(cachedRoom);
            return;
          }

          await fetchRooms(true);
          const fetchedRoom = useRoomStore
            .getState()
            .rooms.find((item) => item.id === id);
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
      [fetchRooms],
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
          setScheduleError(
            "Kirjaudu Wilmaan nähdäksesi tilan lukujärjestyksen.",
          );
          return;
        }

        const weekMonday = getMondayOfWeek(0, activeDay);
        const schedule = await fetchWilmaRoomSchedule(
          wilmaId,
          formatFinnishDate(weekMonday),
        );
        if (requestId !== scheduleRequestRef.current) return;
        setScheduleEntries(dayScheduleEntries(schedule, activeDay.getDay()));
      } catch (error) {
        if (requestId !== scheduleRequestRef.current) return;
        console.warn("Room schedule could not be loaded", error);
        setScheduleError(
          (error as Error)?.name === "WilmaAuthenticationError"
            ? "Kirjaudu Wilmaan nähdäksesi tilan lukujärjestyksen."
            : "Lukujärjestystä ei voitu ladata. Napauta ja yritä uudelleen.",
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
        setRoom(
          useRoomStore.getState().rooms.find((item) => item.id === id) ?? null,
        );
        setError(null);
        sheetRef.current?.present();
        sheetRef.current?.snapToIndex(1);
        void fetchRoomDetails(id);
      },
      [fetchRoomDetails],
    );

    const close = useCallback(() => {
      sheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(ref, () => ({ open, close }), [close, open]);

    const equipment = useMemo(
      () => formatEquipment(room?.equipment ?? null),
      [room?.equipment],
    );
    const list = nativeListColors(isDark);
    const accent = isDark ? colors.accentDark : colors.accent;
    const sheetLook = glassSheetChrome(isDark);
    const hasImage = Boolean(room?.image_url) && !imageFailed;
    const subtitle = room
      ? [
          room.title && room.title !== room.room_number ? room.title : null,
          getRoomType(room.type),
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    // The room's facts as Settings shows values: label left, value right.
    const facts = room
      ? [
          { label: "Kerros", value: getFloor(room) },
          { label: "Paikkoja", value: room.seats != null ? String(room.seats) : "–" },
          { label: "Varaus", value: room.bookable ? "Varattavissa" : "Ei varattavissa" },
        ]
      : [];

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
        style={sheetLook.style}
        {...sheetLook.chrome}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: list.label }]} numberOfLines={2}>
                {room ? room.room_number || room.title || "Tila" : "Tila"}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: list.secondaryLabel }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {/* iOS 26's close control in a sheet: a glass circle with an ✕. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sulje"
              hitSlop={8}
              onPress={close}
              style={({ pressed }) => [!HAS_LIQUID_GLASS && pressed && styles.pressed]}
            >
              <GlassSurface
            radius={18}
            interactive
            solid={sheetPalette(isDark).card}
            style={styles.closeButton}
          >
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

          {loading && !room ? (
            <View style={styles.state}>
              <ActivityIndicator color={accent} />
              <Text style={[styles.stateText, { color: list.secondaryLabel }]}>
                Ladataan tilaa…
              </Text>
            </View>
          ) : error && !room ? (
            <View style={styles.state}>
              <Text style={[styles.stateTitle, { color: list.label }]}>
                Tietojen lataus epäonnistui
              </Text>
              <Text style={[styles.stateText, { color: list.secondaryLabel }]}>
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => roomId && void fetchRoomDetails(roomId)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={[styles.retryText, { color: accent }]}>Yritä uudelleen</Text>
              </Pressable>
            </View>
          ) : room ? (
            <>
              {/* The frame is always there: a quiet placeholder when the room
                  has no photo, and underneath a real one while it loads. */}
              <View style={[styles.photo, { backgroundColor: list.fill }]}>
                {!hasImage || !imageLoaded ? (
                  <View style={styles.photoPlaceholder}>
                    <PlatformSymbol
                      ios="photo"
                      android="image"
                      size={34}
                      tintColor={list.tertiaryLabel}
                    />
                    {!hasImage ? (
                      <Text style={[styles.photoCaption, { color: list.secondaryLabel }]}>
                        Ei kuvaa
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {hasImage ? (
                  <Image
                    source={{ uri: room.image_url! }}
                    style={[styles.photoImage, !imageLoaded && styles.hidden]}
                    resizeMode="cover"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageLoaded(false);
                      setImageFailed(true);
                    }}
                  />
                ) : null}
              </View>

              <View style={[styles.group, { backgroundColor: list.fill }]}>
                {facts.map((fact, index) => (
                  <React.Fragment key={fact.label}>
                    {index > 0 && (
                      <View style={[styles.separator, { backgroundColor: list.separator }]} />
                    )}
                    <View style={styles.factRow}>
                      <Text style={[styles.cellText, { color: list.label }]}>{fact.label}</Text>
                      <Text style={[styles.cellText, { color: list.secondaryLabel }]}>
                        {fact.value}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {room.description?.trim() ? (
                <>
                  <SectionHeader color={list.secondaryLabel}>Tietoja tilasta</SectionHeader>
                  <View style={[styles.group, styles.textCell, { backgroundColor: list.fill }]}>
                    <Text style={[styles.description, { color: list.label }]}>
                      {room.description.trim()}
                    </Text>
                  </View>
                </>
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

              <SectionHeader color={list.secondaryLabel}>Varustelu</SectionHeader>
              {equipment.length ? (
                <View style={[styles.group, { backgroundColor: list.fill }]}>
                  {equipment.map((item, index) => {
                    const glyph = equipmentIcon(item);
                    return (
                      <React.Fragment key={item}>
                        {index > 0 && (
                          <View
                            style={[
                              styles.separator,
                              styles.separatorPastIcon,
                              { backgroundColor: list.separator },
                            ]}
                          />
                        )}
                        <View style={styles.equipmentRow}>
                          <PlatformSymbol
                            ios={glyph.ios}
                            android={glyph.android}
                            size={18}
                            tintColor={accent}
                            style={styles.equipmentIcon}
                          />
                          <Text style={[styles.cellText, styles.flex, { color: list.label }]}>
                            {item}
                          </Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.footerText, { color: list.secondaryLabel }]}>
                  Varustelutietoja ei ole saatavilla.
                </Text>
              )}
            </>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

/** UIKit's grouped section header: small, uppercase, secondary. */
function SectionHeader({ children, color }: { children: string; color: string }) {
  return (
    <Text accessibilityRole="header" style={[styles.sectionHeader, { color }]}>
      {children.toLocaleUpperCase("fi-FI")}
    </Text>
  );
}

// The system font and UIKit's own colours throughout, as the friend profile
// and the map's sheet: no fontFamily anywhere below.
const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  headerText: { flex: 1 },
  // UIKit's title2.
  title: { ...fonts.bold, fontSize: 22 },
  subtitle: { ...fonts.regular, fontSize: 15, marginTop: 2 },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
  state: { minHeight: 200, alignItems: "center", justifyContent: "center", gap: 8 },
  stateTitle: { ...fonts.semiBold, fontSize: 17, textAlign: "center" },
  stateText: { ...fonts.regular, fontSize: 15, textAlign: "center" },
  retryText: { ...fonts.regular, fontSize: 17, marginTop: 6 },
  photo: { height: 200, borderRadius: 14, borderCurve: "continuous", overflow: "hidden", marginBottom: 20 },
  photoImage: { ...StyleSheet.absoluteFill },
  photoPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoCaption: { ...fonts.regular, fontSize: 13 },
  hidden: { opacity: 0 },
  // An inset grouped section, as in Settings.
  group: { borderRadius: 14, borderCurve: "continuous", overflow: "hidden" },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  cellText: { ...fonts.regular, fontSize: 17 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  // Past the glyph, under the text.
  separatorPastIcon: { marginLeft: 16 + 26 + 12 },
  textCell: { paddingHorizontal: 16, paddingVertical: 12 },
  description: { ...fonts.regular, fontSize: 15, lineHeight: 21 },
  sectionHeader: { ...fonts.regular, fontSize: 13, marginTop: 28, marginBottom: 6, paddingHorizontal: 16 },
  equipmentRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 16 },
  equipmentIcon: { width: 26 },
  footerText: { ...fonts.regular, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
});

RoomModalSheet.displayName = "RoomModalSheet";

export default RoomModalSheet;
