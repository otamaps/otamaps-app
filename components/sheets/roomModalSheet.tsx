import { isFeatureEnabled } from "@/lib/featureFlagService";
import { useRoomStore } from "@/lib/roomService";
import { MaterialIcons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
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

interface Room {
  id: string;
  title: string;
  description: string;
  seats: number;
  size: number;
  type: "classroom" | "meeting_room" | "auditorium" | "lab";
  floor: string;
  room_number: string;
  building: string;
  equipment: string[];
  image_url: string;
  is_accessible: boolean;
}

export interface RoomModalSheetMethods {
  open: (roomId: string) => void;
  close: () => void;
}

interface RoomModalSheetProps {
  onDismiss?: () => void;
}

const RoomModalSheet = forwardRef<RoomModalSheetMethods, RoomModalSheetProps>(
  ({ onDismiss }, ref) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isBookingEnabled, setIsBookingEnabled] = useState(false);

    const [roomId, setRoomId] = useState<string | null>(null);

    const { rooms, fetchRooms } = useRoomStore();

    const isDark = useColorScheme() === "dark";

    useEffect(() => {
      const checkBookingFeature = async () => {
        const enabled = await isFeatureEnabled("booking");
        setIsBookingEnabled(enabled);
      };
      checkBookingFeature();
    }, []);

    const fetchRoomDetails = async (id: string) => {
      try {
        setLoading(true);
        setError(null);

        // First, check if the room is already in the store
        const existingRoom = rooms.find((room) => room.id === id);

        if (existingRoom) {
          setRoom(existingRoom as any);
          bottomSheetModalRef.current?.present();
          return;
        }

        // If not in the store, fetch all rooms and try again
        await fetchRooms();
        const updatedRoom = useRoomStore
          .getState()
          .rooms.find((room) => room.id === id);

        if (updatedRoom) {
          setRoom(updatedRoom as any);
          bottomSheetModalRef.current?.present();
        } else {
          throw new Error("Room not found");
        }
      } catch (err) {
        console.error("Error fetching room details:", err);
        setError("Failed to load room details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const open = (id: string) => {
      setRoomId(id);
      fetchRoomDetails(id);
    };

    const close = () => {
      bottomSheetModalRef.current?.dismiss();
      onDismiss?.();
    };

    useImperativeHandle(ref, () => ({
      open,
      close,
    }));

    const getFloor = (room: Room) => {
      if (room.floor) return room.floor;
      const match = room.room_number?.match(/\d/);
      return match ? match[0] : "?";
    };

    const renderStars = (rating: number) => {
      return Array(5)
        .fill(0)
        .map((_, i) => {
          const iconName: "star" | "star-outline" =
            i < Math.floor(rating) ? "star" : "star-outline";
          return (
            <MaterialIcons key={i} name={iconName} size={16} color="#FFD700" />
          );
        });
    };

    const renderAmenityIcon = (amenity: string) => {
      // Map amenities to MaterialIcons names
      const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
        wifi: "wifi",
        tv: "tv",
        ac: "ac-unit",
        minibar: "local-bar",
        safe: "security",
        shower: "shower",
      };

      const iconName = iconMap[amenity.toLowerCase()] || "check";

      return (
        <View key={amenity} style={styles.amenityItem}>
          <MaterialIcons name={iconName} size={20} color="#4A89EE" />
          <Text style={styles.amenityText}>{amenity}</Text>
        </View>
      );
    };

    if (loading) {
      return (
        <BottomSheetModal
          ref={bottomSheetModalRef}
          style={[styles.background, isDark && { backgroundColor: "#1e1e1e" }]}
          snapPoints={[500, "100%"]}
          enablePanDownToClose={true}
        >
          <View
            style={[
              styles.loadingContainer,
              isDark && { backgroundColor: "#1e1e1e" },
            ]}
          >
            <ActivityIndicator size="large" color="#4A89EE" />
            <Text style={[styles.loadingText, isDark && { color: "#fff" }]}>
              Loading room details...
            </Text>
          </View>
        </BottomSheetModal>
      );
    }

    if (error) {
      return (
        <BottomSheetModal
          ref={bottomSheetModalRef}
          style={[styles.background, isDark && { backgroundColor: "#1e1e1e" }]}
          snapPoints={[300, "100%"]}
          enablePanDownToClose={true}
        >
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => roomId && fetchRoomDetails(roomId)}
            >
              <Text
                style={[styles.retryButtonText, isDark && { color: "#fff" }]}
              >
                Try Again
              </Text>
            </Pressable>
          </View>
        </BottomSheetModal>
      );
    }

    if (!room) return null;

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        style={[styles.background, isDark && { backgroundColor: "#1e1e1e" }]}
        snapPoints={["43%", "60%", "80%"]}
        enablePanDownToClose={true}
        onDismiss={onDismiss}
        handleStyle={{
          backgroundColor: isDark ? "#1e1e1e" : "#fff",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? "#666666" : "#cccccc",
        }}
      >
        <BottomSheetView
          style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
        >
          <BottomSheetScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Room Image */}
            <View style={styles.imageContainer}>
              {room.image_url ? (
                <Image
                  source={{ uri: room.image_url }}
                  style={styles.roomImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.roomImage, styles.imagePlaceholder, isDark && styles.imagePlaceholderDark]}>
                  <MaterialIcons
                    name="image-not-supported"
                    size={50}
                    color={isDark ? "#666" : "#ccc"}
                  />
                </View>
              )}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)"]}
                style={styles.imageGradient}
              />
              <Pressable style={styles.closeButton} onPress={close}>
                <MaterialIcons name="close" size={24} color="white" />
              </Pressable>
            </View>

            {/* Room Details */}
            <View style={styles.detailsContainer}>
              <View style={styles.headerRow}>
                <View style={styles.roomTitleContainer}>
                  <Text style={[styles.roomName, isDark && { color: "#fff" }]}>
                    {room.room_number} {room.title}
                  </Text>
                  <Text
                    style={[
                      styles.roomLocation,
                      isDark && { color: "#ffffff80" },
                    ]}
                  >
                    Floor {getFloor(room)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.roomTypeBadge,
                    isDark && { backgroundColor: "#2c2c2c" },
                  ]}
                >
                  <Text
                    style={[
                      styles.roomTypeText,
                      isDark && { color: "#4A89EE" },
                    ]}
                  >
                    {(room.type || "room")
                      .split("_")
                      .map(
                        (word) => word.charAt(0).toUpperCase() + word.slice(1)
                      )
                      .join(" ")}
                  </Text>
                </View>
              </View>
              {/* Action Buttons */}
              {/* <View style={styles.footerActions}>
                <Pressable
                  style={[styles.actionButton, styles.directionsButton]}
                >
                  <MaterialIcons name="directions" size={20} color="#4A89EE" />
                  <Text style={[styles.actionButtonText, { color: "#4A89EE" }]}>
                    Directions
                  </Text>
                </Pressable>
                {isBookingEnabled && (
                  <Pressable style={[styles.actionButton, styles.bookButton]}>
                    <Text style={styles.actionButtonText}>
                      Check Availability
                    </Text>
                  </Pressable>
                )}
              </View> */}
              <View
                style={[styles.roomInfo, isDark && { borderColor: "#444" }]}
              >
                <View style={styles.infoItem}>
                  <MaterialIcons name="people" size={20} color="#666" />
                  <Text style={[styles.infoText, isDark && { color: "#fff" }]}>
                    Up to {room.seats} people
                  </Text>
                </View>
                {room.size && room.size > 0 && (
                  <View style={styles.infoItem}>
                    <MaterialIcons name="straighten" size={20} color="#666" />
                    <Text style={[styles.infoText, isDark && { color: "#fff" }]}>
                      {room.size} m²
                    </Text>
                  </View>
                )}
                {room.is_accessible && (
                  <View style={styles.infoItem}>
                    <MaterialIcons name="accessible" size={20} color="#666" />
                    <Text
                      style={[styles.infoText, isDark && { color: "#fff" }]}
                    >
                      Wheelchair accessible
                    </Text>
                  </View>
                )}
              </View>

              {room.description && room.description.trim() && (
                <>
                  <Text style={[styles.sectionTitle, isDark && { color: "#fff" }]}>
                    About This Room
                  </Text>
                  <Text style={[styles.description, isDark && { color: "#fff" }]}>
                    {room.description}
                  </Text>
                </>
              )}

              {room.equipment && room.equipment.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, isDark && { color: "#fff" }]}>
                    Equipment
                  </Text>
                  <View style={styles.amenitiesContainer}>
                    {room.equipment.map((item) => renderAmenityIcon(item))}
                  </View>
                </>
              )}
            </View>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    zIndex: 1000,
  },
  content: {
    flex: 1,
    paddingBottom: 100, // Space for the fixed button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#4A89EE",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
  },
  imageContainer: {
    height: 250,
    width: "100%",
    position: "relative",
  },
  roomImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderDark: {
    backgroundColor: "#2c2c2c",
  },
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    padding: 24,
    paddingTop: 12,
    paddingBottom: 120, // Extra padding for the fixed button
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roomTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  roomName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  roomLocation: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  roomTypeBadge: {
    backgroundColor: "#EFF4FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  roomTypeText: {
    color: "#4A89EE",
    fontSize: 12,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: 8,
  },
  ratingText: {
    color: "#666",
    fontSize: 14,
  },
  roomInfo: {
    flexDirection: "row",
    marginVertical: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  infoText: {
    marginLeft: 8,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444",
  },
  amenitiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#444",
  },
  footerActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  directionsButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#4A89EE",
  },
  bookButton: {
    backgroundColor: "#4A89EE",
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  background: {
    zIndex: 1000,
  },
});

RoomModalSheet.displayName = "RoomModalSheet";

export default RoomModalSheet;
