import CanteenStatusModal from "@/components/canteen/CanteenStatusModal";
import FriendProfileSheetContent from "@/components/friends/FriendProfileSheetContent";
import { FriendsSectionHeader, MeRow } from "@/components/friends/MeRow";
import useBLEScanner, {
  LocalUserLocation,
} from "@/components/functions/bleScanner";
import GlobalSearch, { SEARCH_HEIGHT } from "@/components/globalSearch";
import RoomItem from "@/components/hRoomItem";
import { FloorStepper } from "@/components/map/FloorStepper";
import {
  GlassSurface,
  HAS_LIQUID_GLASS,
  MapBlurProvider,
  MapBlurTarget,
} from "@/components/map/GlassSurface";
import { MapGlassPill } from "@/components/map/MapGlassPill";
import MapBottomSheet, {
  BottomSheetMethods,
} from "@/components/mapBottomSheet";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import FriendModalSheet, {
  FriendModalSheetRef,
} from "@/components/sheets/friendModalSheet";
import RoomModalSheet, {
  RoomModalSheetMethods,
} from "@/components/sheets/roomModalSheet";
import { nativeListColors, sheetPalette } from "@/components/sheets/sheetTheme";
import { colors, DEFAULT_USER_COLOR } from "@/constants/theme";
import { BLELocationService } from "@/lib/bleLocationService";
import { getReadableLabelColor } from "@/lib/color";
import {
  Friend,
  getFriends,
  getRequests,
  handleBlockFriend,
  handleRemoveFriend,
} from "@/lib/friendsHandler";
import { getUser } from "@/lib/getUserHandle";
import {
  formatElapsedSince,
  formatReportingWindow,
  getQueueColor,
  getQueueLabel,
  getQueueStatuses,
  QueueStatus,
} from "@/lib/queueService";
import { Room, useFeatureStore, useRoomStore } from "@/lib/roomService";
import { supabase } from "@/lib/supabase";
import {
  BottomSheetFlatList,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Camera,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  Images,
  MapView,
  RasterLayer,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import FriendItem, {
  FRIEND_ROW_SEPARATOR_INSET,
} from "../../components/friendItem";
import FriendListSkeleton from "../../components/FriendItemSkeleton";
import { fonts } from "@/constants/typography";

// Define the shape of our room feature properties
type RoomFeatureProperties = {
  id: string;
  roomNumber: string;
  title: string;
  isSelected: boolean;
  color: string;
  rgba: string;
};

type OnPressEvent = {
  features: Feature[];
  coordinates: { latitude: number; longitude: number };
  point: { x: number; y: number };
};

// type RoomFeature = MapboxFeature & {
//   id: string;
//   properties: RoomFeatureProperties;
// };

type myFeature = {
  id?: string;
  properties?: {
    id?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

// type CustomMapPressEvent = MapPressEvent & {
//   features?: myFeature[];
// };

type RoomItemData = {
  id: string;
  name: string;
  floor: number; // Change from string to number to match the database
  capacity: number;
  isAvailable: boolean;
  isFavorite: boolean;
  room_number: string;
};

type FriendWithLocation = Friend & {
  location: [number, number] | null; // [longitude, latitude]
};

type RoomWithEquipment = {
  id: string;
  room_number: string;
  title: string;
  seats: number;
  status: string;
  equipment?: {
    floor?: string;
  };
};

const emptyGeoJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Loose match key for a room name/number coming from free text (e.g. Wilma). */
function normalizeRoomText(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

const ROOM_LABEL_REFERENCE_ZOOM = 21;
const MAX_ROOM_LABEL_TEXT_SIZE = 18;
const MIN_ROOM_LABEL_TEXT_SIZE = 1;

function collectGeometryCoordinates(
  value: unknown,
  coordinates: [number, number][] = [],
): [number, number][] {
  if (!Array.isArray(value)) return coordinates;

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    coordinates.push([value[0], value[1]]);
    return coordinates;
  }

  value.forEach((child) => collectGeometryCoordinates(child, coordinates));
  return coordinates;
}

function getRoomNumberMaxTextSize(
  geometry: Polygon | MultiPolygon,
  roomNumber: unknown,
): number {
  const coordinates = collectGeometryCoordinates(geometry.coordinates);
  if (coordinates.length < 3) return MAX_ROOM_LABEL_TEXT_SIZE;

  const normalizedRoomNumber =
    roomNumber == null ? "" : String(roomNumber).trim();

  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const averageLatitude =
    latitudes.reduce((sum, latitude) => sum + latitude, 0) / latitudes.length;
  const latitudeRadians = (averageLatitude * Math.PI) / 180;
  const widthMeters =
    (Math.max(...longitudes) - Math.min(...longitudes)) *
    111_320 *
    Math.cos(latitudeRadians);
  const heightMeters =
    (Math.max(...latitudes) - Math.min(...latitudes)) * 110_574;
  const metersPerPixel =
    (156_543.03392 * Math.cos(latitudeRadians)) /
    2 ** ROOM_LABEL_REFERENCE_ZOOM;
  const widthPixels = widthMeters / metersPerPixel;
  const heightPixels = heightMeters / metersPerPixel;
  const characterCount = Math.max(Array.from(normalizedRoomNumber).length, 1);

  // Keep a little padding inside each room and account for average glyph width.
  const widthLimitedSize = (widthPixels * 0.82) / (characterCount * 0.62);
  const heightLimitedSize = heightPixels * 0.68;

  return Math.max(
    MIN_ROOM_LABEL_TEXT_SIZE,
    Math.min(MAX_ROOM_LABEL_TEXT_SIZE, widthLimitedSize, heightLimitedSize),
  );
}

/** How long the map must be still before the queue pill returns. */
const PILLS_REAPPEAR_MS = 250;

/** How close the camera must rest to your marker to count as on you. */
const CENTERED_WITHIN_M = 5;

/** Ground distance between two [lng, lat] points; flat-earth is plenty at this scale. */
function metersBetween(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const x = (b[0] - a[0]) * toRad * Math.cos(((a[1] + b[1]) / 2) * toRad);
  const y = (b[1] - a[1]) * toRad;
  return Math.hypot(x, y) * 6_371_000;
}

/** How long after the last beacon was heard the "Minä" row still names a room. */
const BEACON_RECENT_MS = 5 * 60_000;

/**
 * The queue pill's whole text: the level while reporting is open — "Jono ·
 * Lyhyt" — and the reporting hours when it is not, since there is no queue
 * to report on then.
 */
function queuePillLabel(status: QueueStatus): string {
  if (!status.reporting_open)
    return `Linjasto ${formatReportingWindow(status)}`;
  return status.status_level == null
    ? "Jono · ei tietoa"
    : `Jono · ${getQueueLabel(status.status_level)}`;
}

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";
  const sheetColors = sheetPalette(isDark);
  const listColors = nativeListColors(isDark);
  const accentColor = isDark ? colors.accentDark : colors.accent;
  const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY?.trim();

  // MapTiler's hosted styles ship POI labels (shops, schools, etc.) turned on.
  // Fetch the style JSON and switch those layers off client-side instead of
  // editing the hosted style, since "place" (city/town) labels should stay.
  const [mapStyleJSON, setMapStyleJSON] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!mapTilerKey) {
      setMapStyleJSON(undefined);
      return;
    }

    let cancelled = false;
    const styleUrl = `https://api.maptiler.com/maps/${
      isDark ? "basic-v2-dark" : "basic-v2"
    }/style.json?key=${encodeURIComponent(mapTilerKey)}`;

    fetch(styleUrl)
      .then((res) => {
        if (!res.ok)
          throw new Error(`MapTiler style request failed: ${res.status}`);
        return res.json();
      })
      .then((style) => {
        if (cancelled) return;
        style.layers = (style.layers ?? []).map((layer: any) =>
          layer["source-layer"] === "poi"
            ? { ...layer, layout: { ...layer.layout, visibility: "none" } }
            : layer,
        );
        setMapStyleJSON(JSON.stringify(style));
      })
      .catch((error) => {
        console.error("Failed to load MapTiler style:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isDark, mapTilerKey]);

  const [geoData, setGeoData] = useState(null);
  const friendModalRef = useRef<FriendModalSheetRef>(null);
  const mapBottomSheetRef = useRef<BottomSheetMethods>(null);
  const roomModalRef = useRef<RoomModalSheetMethods>(null);

  // BLE Scanner for location tracking
  const { currentRoom, getScannedBeacons, getCurrentLocation } =
    useBLEScanner();
  const scannedBeacons = getScannedBeacons();
  if (process.env.EXPO_PUBLIC_DEBUG_BLE === "true")
    console.log("Scanned beacons:", scannedBeacons);

  // Helper function to check if user is in any room
  const isInAnyRoom = () => {
    return currentRoom !== null && currentRoom !== undefined;
  };

  const [searchQuery, setSearchQuery] = useState("");
  // const [friends, setFriends] = useState([
  //   {
  //     name: "Faru Yusupov",
  //     id: "1",
  //     status: "at school" as const,
  //     lastSeen: new Date().toISOString(), // Now (will show as 'Just now' if within 30s)
  //     location: [24.81851, 60.18394] as [number, number],
  //   },
  //   {
  //     name: "Toivo Kallio",
  //     id: "2",
  //     status: "at school" as const,
  //     lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  //     location: [24.81856, 60.18399] as [number, number],
  //   },
  //   {
  //     name: "Wilmer von Harpe",
  //     id: "3",
  //     status: "at school" as const,
  //     lastSeen: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
  //     location: [24.81847, 60.18389] as [number, number],
  //   },
  //   {
  //     name: "Maximilian Bergström",
  //     id: "4",
  //     status: "at school" as const,
  //     lastSeen: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  //     location: [24.81844, 60.18384] as [number, number],
  //   },
  // ]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const filteredFriends = useMemo(() => {
    return friends
      .filter((friend) =>
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => {
        if (!a.lastSeen && !b.lastSeen) return 0;
        if (!a.lastSeen) return 1;
        if (!b.lastSeen) return -1;
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      });
  }, [friends, searchQuery]);
  const [selectedTab, setSelectedTab] = useState("people");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const friendsWithLocations = friends as FriendWithLocation[];
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [localUserLocation, setLocalUserLocation] =
    useState<LocalUserLocation | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);

  // The pill row — queue on the left, your location on the right — rides
  // just above the sheet's top edge, so it tracks the sheet continuously
  // rather than only at its resting height, and fades out as the sheet
  // approaches full height where there is no room left for it.
  const sheetPosition = useSharedValue(0);
  const sheetIndex = useSharedValue(1);
  const pillRowHeight = useSharedValue(30);
  const pillRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetPosition.value - pillRowHeight.value - 12 }],
  }));
  // Past this point the row has no room left, so its controls hide — through
  // `visible`, never an animated opacity on the row: that would stop their
  // glass drawing (see `GlassSurface`). Hidden, they take no taps either.
  const [pillsTappable, setPillsTappable] = useState(true);
  useAnimatedReaction(
    () => sheetIndex.value < 1.6,
    (tappable, previous) => {
      if (tappable !== previous) scheduleOnRN(setPillsTappable, tappable);
    },
  );
  const [canteenVisible, setCanteenVisible] = useState(false);

  // Camera state for dynamic positioning
  const [cameraConfig, setCameraConfig] = useState({
    centerCoordinate: [24.818510511790645, 60.18394233125424] as [
      number,
      number,
    ],
    zoomLevel: 16,
    animationDuration: 1000,
  });

  const currentLocation = useMemo(() => {
    return BLELocationService.getCurrentLocation();
  }, []);

  // When a beacon was last heard, and whether that was recent enough for the
  // "Minä" row to name a room. The tracker itself keeps its last position
  // indefinitely — across restarts too — and only remembers beacons for 15s,
  // so neither says how long it has really been since anything was heard.
  const lastBeaconSeenAt = useRef(0);
  const [beaconsRecent, setBeaconsRecent] = useState(false);
  const recentLocation = beaconsRecent ? localUserLocation : null;

  // Your own name and colour for the "Minä" row heading the friends list.
  // Read straight from the database, as the Me tab does: UserContext is only
  // filled in once the profile has been edited, so it is empty on most launches.
  const [me, setMe] = useState<{ name: string; color: string } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const user = await getUser();
        if (!user) return;
        const { data } = await supabase
          .from("users")
          .select("name, color")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        setMe({
          name: data?.name || user.user_metadata?.full_name || "?",
          color: data?.color || user.user_metadata?.color || DEFAULT_USER_COLOR,
        });
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // Fetch local user location from BLE scanner
  const fetchLocalUserLocation = useCallback(async () => {
    try {
      const location = await getCurrentLocation();
      const now = Date.now();
      if (location?.beacons.length) lastBeaconSeenAt.current = now;
      setBeaconsRecent(now - lastBeaconSeenAt.current <= BEACON_RECENT_MS);
      if (location) {
        setLocalUserLocation(location);
        if (process.env.EXPO_PUBLIC_DEBUG_BLE === "true")
          console.log("📍 Local user location updated:", location);
      } else {
        setLocalUserLocation(null);
      }
    } catch (error) {
      console.error("Error fetching local user location:", error);
    }
  }, [getCurrentLocation]);

  const handleReportFriend = async (friendId: string, reason: string) => {
    const { error } = await supabase
      .from("reports")
      .insert([{ user_id: friendId, reason }]);
    if (error) throw error;
  };

  // Update local user location periodically
  useEffect(() => {
    // Initial fetch
    fetchLocalUserLocation();

    // Update every 2 seconds (more frequent than Supabase uploads)
    const locationUpdateInterval = setInterval(fetchLocalUserLocation, 2000);

    return () => {
      clearInterval(locationUpdateInterval);
    };
  }, [fetchLocalUserLocation]);

  // Auto-select the floor the user is detected on when the map is opened.
  // Only runs once (on first location fix) so it doesn't override manual floor changes later.
  const hasAutoSelectedFloorRef = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedFloorRef.current) return;
    if (localUserLocation?.floor == null) return;
    hasAutoSelectedFloorRef.current = true;
    setSelectedFloor(localUserLocation.floor);
  }, [localUserLocation]);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const statuses = await getQueueStatuses();
      setQueueStatus(
        statuses.find((status) => status.slug === "ruokalinjasto") ?? null,
      );
    } catch (queueError) {
      console.warn("Unable to refresh queue status:", queueError);
    }
  }, []);

  useEffect(() => {
    void fetchQueueStatus();
    const queueRefreshInterval = setInterval(fetchQueueStatus, 30_000);
    return () => clearInterval(queueRefreshInterval);
  }, [fetchQueueStatus]);

  useFocusEffect(
    useCallback(() => {
      void fetchQueueStatus();
    }, [fetchQueueStatus]),
  );
  const { rooms, loading, error, fetchRooms } = useRoomStore();
  const {
    features,
    loading: featuresLoading,
    error: featuresError,
    fetchFeatures,
  } = useFeatureStore();
  const [roomData, setRoomData] = useState<
    (RoomItemData & { id: string; isFavorite: boolean })[]
  >([]);

  // Filter rooms by selected floor
  const filteredRoomData = useMemo(() => {
    const filtered = roomData.filter((room) => {
      // Use the actual floor field from the database instead of parsing room number
      return room.floor === selectedFloor;
    });

    // Debug logging
    console.log(`🔍 Filtering rooms for floor ${selectedFloor}:`);
    console.log(`  Total rooms: ${roomData.length}`);
    console.log(`  Filtered rooms: ${filtered.length}`);
    if (filtered.length > 0) {
      console.log(
        `  Sample filtered rooms:`,
        filtered.slice(0, 3).map((r) => `${r.room_number} (floor ${r.floor})`),
      );
    }

    return filtered;
  }, [roomData, selectedFloor]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const fetchRoomsRef = useRef(fetchRooms);
  const [friendId, setFriendId] = useState("");
  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === friendId) ?? null,
    [friendId, friends],
  );

  const [friendsLoading, setFriendsLoading] = useState(true);

  const refreshFriends = useCallback(async () => {
    const refreshedFriends = await getFriends(true);
    setFriends(refreshedFriends);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshFriends();
    }, 30_000);

    return () => clearInterval(interval);
  }, [refreshFriends]);

  const handleTabPress = (tab: string) => {
    if (selectedTab === tab) {
      setShowFavoritesOnly(!showFavoritesOnly);
    } else {
      setSelectedTab(tab);
      setShowFavoritesOnly(false);
    }
  };

  useEffect(() => {
    fetchRoomsRef.current = fetchRooms;
  }, [fetchRooms]);

  const fetchFeaturesRef = useRef(fetchFeatures);

  useEffect(() => {
    fetchFeaturesRef.current = fetchFeatures;
  }, [fetchFeatures]);

  useEffect(() => {
    fetchRoomsRef.current();
    fetchFeaturesRef.current();
  }, []);

  // Load debug mode from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem("isDebugMode").then((value) => {
      if (value !== null) setIsDebugMode(value === "true");
    });
  }, []);

  useEffect(() => {
    if (rooms.length > 0) {
      // Transform Room[] to RoomItemData[]
      const transformedRooms = rooms.map((room) => {
        return {
          id: room.id,
          name: room.title || room.room_number,
          floor: room.floor, // Use the actual floor field
          capacity: room.seats || 0,
          isAvailable: room.status !== "occupied",
          isFavorite: false, // Default to false, this will be managed by local state
          room_number: room.room_number,
        };
      });
      setRoomData(transformedRooms);

      // Debug logging to verify floor data
      console.log("🏢 Room floor debug:");
      console.log("Total rooms:", rooms.length);
      console.log("Sample rooms with floors:");
      rooms.slice(0, 5).forEach((room) => {
        console.log(
          `  ${room.room_number} -> floor ${room.floor} (from database)`,
        );
      });

      const floorCounts = transformedRooms.reduce(
        (acc, room) => {
          acc[room.floor] = (acc[room.floor] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );
      console.log("Rooms per floor:", floorCounts);
    } else {
      setRoomData([]);
    }
  }, [rooms]);

  useEffect(() => {
    if (features.length > 0) {
      console.log("🏗️ Features debug:");
      console.log("Total features:", features.length);
      console.log("Sample features with types:");
      features.slice(0, 5).forEach((feature) => {
        console.log(
          `  ${feature.id} -> floor ${feature.floor}, type: ${feature.type}`,
        );
      });

      const featureTypeCounts = features.reduce(
        (acc, feature) => {
          acc[feature.type] = (acc[feature.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      console.log("Features by type:", featureTypeCounts);

      const floorCounts = features.reduce(
        (acc, feature) => {
          acc[feature.floor] = (acc[feature.floor] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );
      console.log("Features per floor:", floorCounts);
    }
  }, [features]);

  useFocusEffect(
    useCallback(() => {
      const loadFriends = async () => {
        try {
          const data = await getFriends(true); // Force refresh
          setFriends(data);
          console.log("[HomeScreen] Friends refreshed on focus:", data);
        } finally {
          // Only the very first fetch needs a loading state; later focuses
          // just refresh the already-visible list in place.
          setFriendsLoading(false);
        }
      };
      const loadRequests = async () => {
        const data = await getRequests();
        setRequests(data);
        console.log("[HomeScreen] Requests refreshed on focus:", data);
      };
      loadFriends();
      loadRequests();
    }, []),
  );

  const handleAddFriend = () => {
    console.log("[HomeScreen] modal ref is", friendModalRef.current);
    friendModalRef.current?.present();
  };

  // const handleDismiss = () => {
  //   console.log("[HomeScreen] Dismissing modal");
  //   friendModalRef.current?.dismiss();
  // };

  // On mount: try loading from cache
  // useEffect(() => {
  //   (async () => {
  //     const cached = await getCachedGeoJSON();
  //     if (cached) setGeoData(cached);
  //   })();
  // }, []);

  const handleRoomPress = useCallback(
    (roomId: string, options?: { focusMap?: boolean }) => {
      // Find the room to get its floor information
      const room = rooms.find((r) => r.id === roomId);

      // Switch to the room's floor if it's different from current
      if (room && room.floor !== selectedFloor) {
        console.log(
          `🏢 Switching from floor ${selectedFloor} to floor ${room.floor} for room ${room.room_number}`,
        );
        setSelectedFloor(room.floor);
      }

      // Ruokalinjasto is a queue rather than a room: what someone wants on
      // tapping it is how long the line is and what is being served, not the
      // generic room card. Falls through to the room sheet if the queue
      // status has not loaded, so the tap is never a dead end.
      if (queueStatus && roomId === queueStatus.room_id) {
        roomModalRef.current?.close();
        setSelectedRoomId(null);
        setCanteenVisible(true);
      } else if (selectedRoomId !== roomId) {
        // Only update selection state if it's different
        setSelectedRoomId(roomId);
        // Don't open modal immediately, let useEffect handle it
      } else {
        // If already selected, open modal immediately
        mapBottomSheetRef.current?.snapToMin();
        roomModalRef.current?.open(roomId);
      }

      // Center the map on the selected room if requested or if room has geometry
      if (room?.geometry && options?.focusMap !== false) {
        // Calculate centroid of the polygon
        const coordinates = room.geometry.coordinates[0];
        type Coordinate = [number, number];

        // Safely calculate the centroid of the polygon
        let sumLng = 0;
        let sumLat = 0;
        let validPoints = 0;

        for (const coord of coordinates) {
          if (Array.isArray(coord) && coord.length >= 2) {
            const [lng, lat] = coord;
            if (typeof lng === "number" && typeof lat === "number") {
              sumLng += lng;
              sumLat += lat;
              validPoints++;
            }
          }
        }

        const centroid: Coordinate =
          validPoints > 0
            ? [sumLng / validPoints, sumLat / validPoints]
            : [0, 0]; // Fallback to [0,0] if no valid points

        // Update camera to focus on the room
        setCameraConfig({
          centerCoordinate: [centroid[0], centroid[1]],
          zoomLevel: 18,
          animationDuration: 1000,
        });

        console.log(
          `🎯 Focusing map on room ${room.room_number} at coordinates:`,
          centroid,
        );
      }
    },
    [rooms, selectedRoomId, selectedFloor, queueStatus],
  );

  // A lesson tapped on the Wilma tab hands off its room as free text (Wilma
  // doesn't share a room id with the map's own room records), so it's
  // resolved to a room here once the room list is loaded.
  const { roomQuery } = useLocalSearchParams<{ roomQuery?: string }>();
  useEffect(() => {
    if (!roomQuery || !rooms.length) return;
    const query = normalizeRoomText(roomQuery);
    if (!query) return;

    const match =
      rooms.find((r) => normalizeRoomText(r.room_number) === query) ||
      rooms.find((r) => normalizeRoomText(r.title) === query) ||
      rooms.find((r) => {
        const num = normalizeRoomText(r.room_number);
        return num.length > 0 && (query.includes(num) || num.includes(query));
      });

    if (match) handleRoomPress(match.id, { focusMap: true });
    router.setParams({ roomQuery: "" });
  }, [roomQuery, rooms, handleRoomPress]);

  // Handle opening modal when room selection changes
  useEffect(() => {
    if (selectedRoomId) {
      mapBottomSheetRef.current?.snapToMin();
      roomModalRef.current?.open(selectedRoomId);
    }
  }, [selectedRoomId]);

  const handleFriendOpen = useCallback((friendId: string) => {
    setFriendId(friendId);
    friendModalRef.current?.present();
    mapBottomSheetRef.current?.snapToMin();
  }, []);

  // Re-pressing the already-focused "Kartta" tab normally does nothing here,
  // so it's repurposed as a one-tap way to step back: collapse the friend
  // sheet from its tall snap point, then close it back to the friends list,
  // and otherwise reset the main sheet to its default height.
  const navigation = useNavigation();
  useEffect(() => {
    // expo-router's native tabs emit this purely as a notification — the tab
    // switch (a no-op here, since this tab is already selected) has already
    // been dispatched, and the event carries no working `preventDefault`.
    const unsubscribe = navigation.addListener("tabPress" as never, () => {
      if (!navigation.isFocused()) return;

      const friendSheetIndex =
        friendModalRef.current?.getCurrentSnapIndex() ?? -1;
      if (friendSheetIndex >= 0) {
        if (friendSheetIndex === 2) {
          friendModalRef.current?.snapToMid();
        } else {
          friendModalRef.current?.close();
          mapBottomSheetRef.current?.snapToMid();
        }
        return;
      }

      const mainSheetIndex =
        mapBottomSheetRef.current?.getCurrentSnapIndex() ?? 1;
      if (mainSheetIndex !== 1) {
        mapBottomSheetRef.current?.snapToMid();
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handlePress = (e: { point: { x: number; y: number } }) => {
    console.log("Map pressed", e.point);
  };

  // Create a ref for the map
  const mapRef = useRef<MapView>(null);

  // Define a type for our room with geometry
  type RoomWithGeometry = Room & {
    geometry: Polygon | MultiPolygon;
    color?: string; // Add color property to room type
  };

  // Room properties type for GeoJSON features
  type RoomProperties = {
    id: string;
    roomNumber: string;
    title: string;
    isSelected: boolean;
    color: string;
    rgba: string;
  };

  // Helper function to ensure valid hex color
  const getValidColor = (color?: string): string => {
    if (!color) return "#3478F5";
    // Check if it's a valid hex color
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return color;
    }
    return "#3478F5"; // Default color if invalid
  };

  // Create GeoJSON features from rooms with geometry
  const roomsWithGeometry = useMemo(
    () =>
      rooms.filter((room): room is RoomWithGeometry => Boolean(room?.geometry)),
    [rooms],
  );

  // Filter rooms with geometry by selected floor
  const filteredRoomsWithGeometry = useMemo(() => {
    return roomsWithGeometry.filter((room) => {
      // Use the actual floor field from the database
      return room.floor === selectedFloor;
    });
  }, [roomsWithGeometry, selectedFloor]);

  // Helper function to determine WC type from room name
  const getWCType = (roomName: unknown): "wc" | "men" | "women" | null => {
    const name = roomName == null ? "" : String(roomName).toLowerCase();
    if (name.includes("wc")) {
      if (name.includes("miehet")) return "men";
      if (name.includes("naiset")) return "women";
      return "wc";
    }
    return null;
  };

  const roomsGeoJSON = useMemo(() => {
    const features = filteredRoomsWithGeometry.map((room) => {
      const roomColor = getValidColor(room.color);
      const [r, g, b] = [
        parseInt(roomColor.slice(1, 3), 16),
        parseInt(roomColor.slice(3, 5), 16),
        parseInt(roomColor.slice(5, 7), 16),
      ];

      const roomNumber =
        room.room_number == null ? "" : String(room.room_number).trim();
      const roomTitle = room.title == null ? "" : String(room.title).trim();
      const isWC = getWCType(roomTitle || roomNumber) !== null;

      return {
        type: "Feature",
        geometry: room.geometry,
        properties: {
          id: room.id,
          roomNumber,
          roomNumberMaxTextSize: getRoomNumberMaxTextSize(
            room.geometry,
            roomNumber,
          ),
          title: roomTitle || "Untitled Room",
          isSelected: selectedRoomId === room.id,
          color: roomColor,
          isWC: isWC,
          // Pre-calculate RGBA values for unselected state
          rgba: `rgba(${r}, ${g}, ${b}, 0.5)`,
        },
      };
    });

    return {
      type: "FeatureCollection",
      features,
    } as any; // Type assertion to fix the TypeScript error with rnmapbox/maps
  }, [filteredRoomsWithGeometry, selectedRoomId]);

  const queueGeoJSON = useMemo(() => {
    if (
      !queueStatus ||
      !queueStatus.reporting_open ||
      queueStatus.floor !== selectedFloor
    ) {
      return emptyGeoJSON;
    }
    const room = roomsWithGeometry.find(
      (candidate) => candidate.id === queueStatus.room_id,
    );
    if (!room) return emptyGeoJSON;

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: room.geometry,
          properties: {
            id: queueStatus.area_id,
            color: getQueueColor(queueStatus.status_level),
            label: `Vilkkaus · ${getQueueLabel(queueStatus.status_level)}${
              queueStatus.status_is_stale
                ? ` · ${formatElapsedSince(queueStatus.status_observed_at)}`
                : ""
            }`,
          },
        },
      ],
    } as any;
  }, [queueStatus, roomsWithGeometry, selectedFloor]);

  // Create GeoJSON for WC room symbols
  const wcRoomsGeoJSON = useMemo(() => {
    const wcFeatures = filteredRoomsWithGeometry
      .filter((room) => getWCType(room.title || room.room_number))
      .map((room) => {
        const wcType = getWCType(room.title || room.room_number);

        return {
          type: "Feature",
          geometry: room.geometry,
          properties: {
            id: room.id,
            wcType: wcType,
          },
        };
      });

    return {
      type: "FeatureCollection",
      features: wcFeatures,
    } as any;
  }, [filteredRoomsWithGeometry]);

  // Filter features by selected floor
  const filteredFeatures = useMemo(() => {
    const filtered = features.filter((feature) => {
      // Add safety checks for feature structure
      if (!feature || typeof feature.floor !== "number") {
        console.warn("🏗️ Invalid feature found:", feature);
        return false;
      }
      return feature.floor === selectedFloor;
    });

    console.log(`🏗️ Filtering features for floor ${selectedFloor}:`, {
      totalFeatures: features.length,
      filteredFeatures: filtered.length,
      invalidFeatures:
        features.length -
        features.filter((f) => f && typeof f.floor === "number").length,
    });

    return filtered;
  }, [features, selectedFloor]);

  // Create GeoJSON for features with extrusion heights
  const featuresGeoJSON = useMemo(() => {
    const geoFeatures = filteredFeatures
      .filter((feature) => {
        // Safety checks for geometry
        if (!feature.geometry) {
          console.warn("🏗️ Feature missing geometry:", feature.id);
          return false;
        }
        if (!feature.geometry.type || !feature.geometry.coordinates) {
          console.warn(
            "🏗️ Feature has invalid geometry structure:",
            feature.id,
            feature.geometry,
          );
          return false;
        }
        // Check if coordinates are properly formatted
        if (!Array.isArray(feature.geometry.coordinates)) {
          console.warn(
            "🏗️ Feature geometry coordinates not an array:",
            feature.id,
          );
          return false;
        }
        return true;
      })
      .map((feature) => {
        // Set height based on feature type
        const height = feature.type === "wall" ? 5 : 2; // 5m for walls, 2m for other features

        return {
          type: "Feature",
          geometry: feature.geometry,
          properties: {
            id: feature.id,
            type: feature.type,
            floor: feature.floor,
            height: height,
            ...feature.properties,
          },
        };
      });

    console.log(`🏗️ Features GeoJSON for floor ${selectedFloor}:`, {
      totalFiltered: filteredFeatures.length,
      validFeatures: geoFeatures.length,
      invalidFeatures: filteredFeatures.length - geoFeatures.length,
      wallFeatures: geoFeatures.filter((f) => f.properties.type === "wall")
        .length,
    });

    return {
      type: "FeatureCollection",
      features: geoFeatures,
    } as any;
  }, [filteredFeatures, selectedFloor]);

  // Create GeoJSON for friend locations
  // Spiderfy logic: spread friends at the same coordinates in a circle
  const friendsGeoJSON = useMemo(() => {
    // Filter friends to show on the selected floor and with valid location
    const friendsToShow = friendsWithLocations.filter((friend) => {
      const hasLocation = !!friend.location;
      const friendFloor = Number(friend.floor);
      const selectedFloorNum = Number(selectedFloor);
      return hasLocation && friendFloor === selectedFloorNum;
    });

    // Group friends by their coordinates (rounded to 5 decimals)
    const coordKey = (loc: [number, number]) =>
      loc[0].toFixed(5) + "," + loc[1].toFixed(5);
    const groups: Record<string, FriendWithLocation[]> = {};
    friendsToShow.forEach((friend) => {
      if (!friend.location) return;
      const key = coordKey(friend.location);
      if (!groups[key]) groups[key] = [];
      groups[key].push(friend);
    });

    // For each group, if more than one friend, offset their positions in a circle
    const features: any[] = [];
    const offsetMeters = 2; // how far to offset (meters)
    const metersToDegrees = (meters: number, lat: number) => {
      // Approximate conversion for small distances
      const earthRadius = 6378137;
      const dLat = (meters / earthRadius) * (180 / Math.PI);
      const dLng =
        (meters / (earthRadius * Math.cos((Math.PI * lat) / 180))) *
        (180 / Math.PI);
      return { dLat, dLng };
    };

    Object.entries(groups).forEach(([key, group]) => {
      if (group.length === 1) {
        const friend = group[0];
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: friend.location!,
          },
          properties: {
            id: friend.id,
            name: friend.name,
            status: friend.status || "at school",
            color: friend.color,
            initial: friend.name.charAt(0).toUpperCase(),
            textColor: getReadableLabelColor(friend.color || "#2b7fff"),
          },
        });
      } else {
        // Spread friends in a circle
        const [lng, lat] = group[0].location!;
        const { dLat, dLng } = metersToDegrees(offsetMeters, lat);
        const angleStep = (2 * Math.PI) / group.length;
        group.forEach((friend, idx) => {
          const angle = idx * angleStep;
          const offsetLng = lng + Math.cos(angle) * dLng;
          const offsetLat = lat + Math.sin(angle) * dLat;
          features.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [offsetLng, offsetLat],
            },
            properties: {
              id: friend.id,
              name: friend.name,
              status: friend.status || "at school",
              color: friend.color,
              initial: friend.name.charAt(0).toUpperCase(),
              textColor: getReadableLabelColor(friend.color || "#2b7fff"),
            },
          });
        });
      }
    });

    return {
      type: "FeatureCollection",
      features,
    } as any;
  }, [friendsWithLocations, selectedFloor]);

  // Create GeoJSON for local user location
  const localUserLocationGeoJSON = useMemo(() => {
    if (
      !localUserLocation ||
      !localUserLocation.coordinates ||
      localUserLocation.floor == null ||
      localUserLocation.floor !== selectedFloor
    ) {
      return emptyGeoJSON;
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: localUserLocation.coordinates,
          },
          properties: {
            id: "local-user",
            name: "You",
            isUser: true,
            radius: localUserLocation.radius,
            floor: localUserLocation.floor,
            currentRoom: localUserLocation.currentRoom,
            beaconCount: localUserLocation.beacons.length,
          },
        },
      ],
    } as any;
  }, [localUserLocation, selectedFloor]);

  // Handle room press on the map
  const handleRoomFeaturePress = useCallback(
    (e: OnPressEvent) => {
      const feature = e.features?.[0];
      if (feature) {
        const roomId = (feature.properties as RoomFeatureProperties)?.id;
        if (roomId) {
          handleRoomPress(roomId);
        }
      }
    },
    [handleRoomPress],
  );

  // Handle friend press on the map
  const handleFriendFeaturePress = useCallback(
    (e: OnPressEvent) => {
      const feature = e.features?.[0];
      if (feature && feature.properties) {
        const friendId = feature.properties.id;
        if (friendId) {
          handleFriendOpen(String(friendId));
        }
      }
    },
    [handleFriendOpen],
  );

  const recenterOnUser = useCallback(() => {
    if (!localUserLocation?.coordinates) return;
    if (localUserLocation.floor != null) {
      setSelectedFloor(localUserLocation.floor);
    }
    setCameraConfig({
      centerCoordinate: localUserLocation.coordinates,
      zoomLevel: 20,
      animationDuration: 700,
    });
  }, [localUserLocation]);

  // The queue pill steps aside while the map is being moved, and comes
  // back once it has been still for a moment.
  const [pillsResting, setPillsResting] = useState(true);
  const mapMoving = useRef(false);
  const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMapGesture = useCallback(() => {
    if (restTimer.current) clearTimeout(restTimer.current);
    restTimer.current = null;
    if (mapMoving.current) return;
    mapMoving.current = true;
    setPillsResting(false);
  }, []);

  // Idle comes after any glide that follows the finger lifting, so the
  // wait starts once the map has truly stopped.
  const onMapRest = useCallback(() => {
    if (!mapMoving.current) return;
    if (restTimer.current) clearTimeout(restTimer.current);
    restTimer.current = setTimeout(() => {
      restTimer.current = null;
      mapMoving.current = false;
      setPillsResting(true);
    }, PILLS_REAPPEAR_MS);
  }, []);

  useEffect(
    () => () => {
      if (restTimer.current) clearTimeout(restTimer.current);
    },
    [],
  );

  // Whether the camera is resting on your marker. Measured where the map
  // settles rather than flagged by `recenterOnUser`, so anything else that
  // moves it — a pan, opening a room — clears it without being told to.
  const [cameraCenter, setCameraCenter] = useState<[number, number] | null>(
    null,
  );
  const userCoordinates = localUserLocation?.coordinates ?? null;
  const isCentered =
    !!cameraCenter &&
    !!userCoordinates &&
    metersBetween(cameraCenter, userCoordinates) < CENTERED_WITHIN_M;

  // A function of whether the search shows it, so its glass can hide itself.
  const recenterButton = (visible: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Keskitä kartta omaan sijaintiin"
      accessibilityState={{ disabled: !userCoordinates, selected: isCentered }}
      disabled={!userCoordinates || !visible}
      onPress={recenterOnUser}
      // Real glass answers a touch itself; the blur fallback needs a cue.
      style={({ pressed }) => [
        !HAS_LIQUID_GLASS && pressed && { opacity: 0.6 },
      ]}
    >
      <GlassSurface
        radius={SEARCH_HEIGHT / 2}
        interactive
        visible={visible}
        style={styles.recenterButton}
      >
        {/* Filled while the map is on you, an outline once it isn't — the
          same cue Apple Maps gives with its own location button. */}
        <PlatformSymbol
          ios={isCentered ? "location.fill" : "location"}
          android={isCentered ? "my_location" : "location_searching"}
          size={20}
          tintColor={
            isCentered
              ? isDark
                ? colors.accentDark
                : colors.accent
              : userCoordinates
                ? colors.textMuted
                : colors.textFaint
          }
        />
      </GlassSurface>
    </Pressable>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapBlurProvider>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style={isDark ? "light" : "dark"} />
          <MapBlurTarget style={styles.map}>
          <MapView
            ref={mapRef}
            style={styles.map}
            // A SurfaceView, the default, cannot be captured for the glass's
            // blur on Android; a TextureView can. Ignored on iOS.
            surfaceView={false}
            onMapIdle={(state) => {
              const [lng, lat] = state.properties.center;
              setCameraCenter([lng, lat]);
              onMapRest();
            }}
            onCameraChanged={(state) => {
              if (!state.gestures.isGestureActive) return;
              onMapGesture();
              // Drop the filled state as soon as a pan starts, not once it ends.
              if (cameraCenter) setCameraCenter(null);
            }}
            styleJSON={mapStyleJSON}
            compassViewMargins={{ x: 10, y: 40 }}
            pitchEnabled={true}
            scaleBarEnabled={false}
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
            requestDisallowInterceptTouchEvent={true}
            gestureSettings={{
              doubleTouchToZoomOutEnabled: true,
              pinchPanEnabled: true,
              pinchZoomEnabled: true,
              simultaneousRotateAndPinchZoomEnabled: true,
            }}
          >
            {/* Map image assets */}
            <Images
              images={{ stairsIcon: require("../../assets/icons/stairs.png") }}
            />
            <Camera
              centerCoordinate={cameraConfig.centerCoordinate}
              zoomLevel={cameraConfig.zoomLevel}
              animationDuration={cameraConfig.animationDuration}
              pitch={5}
              maxBounds={{
                ne: [24.858, 60.205],
                sw: [24.777, 60.161],
              }}
              heading={180}
              minZoomLevel={13.5}
              maxZoomLevel={21}
              allowUpdates={true}
              followUserLocation={false}
            />
            {/* Room Geometries */}
            {roomsGeoJSON.features.length > 0 && (
              <ShapeSource
                id="roomsSource"
                shape={roomsGeoJSON}
                onPress={handleRoomFeaturePress}
              >
                <SymbolLayer
                  id="room-numbers"
                  style={{
                    textField: ["get", "roomNumber"],
                    textSize: [
                      "interpolate",
                      ["exponential", 2],
                      ["zoom"],
                      13.5,
                      [
                        "max",
                        MIN_ROOM_LABEL_TEXT_SIZE,
                        ["*", ["get", "roomNumberMaxTextSize"], 0.005524],
                      ],
                      ROOM_LABEL_REFERENCE_ZOOM,
                      [
                        "max",
                        MIN_ROOM_LABEL_TEXT_SIZE,
                        ["get", "roomNumberMaxTextSize"],
                      ],
                    ],
                    textAnchor: "center",
                    textAllowOverlap: true,
                    textIgnorePlacement: true,
                    textOpacity: 0.9,
                    textColor: isDark ? "#ffffffff" : "#424853ff",
                    textHaloColor: isDark ? "#20242A" : "#FFFFFF",
                    textHaloWidth: 0.75,
                  }}
                />
                <SymbolLayer
                  id="room-symbols"
                  minZoomLevel={20}
                  style={{
                    textField: ["get", "title"],
                    textSize: 12,
                    textAnchor: "center",
                    textAllowOverlap: false,
                    textIgnorePlacement: false,
                    textOpacity: 1,
                    textColor: isDark ? "#ffffffff" : "#606875",
                    textHaloColor: "white",
                    textHaloWidth: 0,
                    textTranslate: [0, 10],
                  }}
                />
                <FillLayer
                  id="room-fill"
                  style={{
                    fillColor: [
                      "case",
                      ["==", ["get", "isSelected"], true],
                      ["get", "color"],
                      ["get", "isWC"],
                      "#E7F0FF", // Blue color for WC rooms
                      ["get", "rgba"],
                    ],
                    fillOpacity: 0.8,
                    fillOutlineColor: "#fff",
                  }}
                />
              </ShapeSource>
            )}

            {queueGeoJSON.features.length > 0 && (
              <ShapeSource id="queueStatusSource" shape={queueGeoJSON}>
                <FillLayer
                  id="queue-status-fill"
                  style={{
                    fillColor: ["get", "color"],
                    fillOpacity: 0.34,
                    fillOutlineColor: ["get", "color"],
                  }}
                />
                <SymbolLayer
                  id="queue-status-label"
                  minZoomLevel={16}
                  style={{
                    textField: ["get", "label"],
                    textSize: 13,
                    textAnchor: "center",
                    textAllowOverlap: false,
                    textIgnorePlacement: false,
                    textColor: isDark ? "#FFFFFF" : "#20242A",
                    textHaloColor: isDark ? "#20242A" : "#FFFFFF",
                    textHaloWidth: 1.5,
                  }}
                />
              </ShapeSource>
            )}

            {/* WC Room Symbols */}
            {wcRoomsGeoJSON.features.length > 0 && (
              <ShapeSource id="wcRoomsSource" shape={wcRoomsGeoJSON}>
                <SymbolLayer
                  id="wc-symbols"
                  minZoomLevel={18}
                  maxZoomLevel={22}
                  style={{
                    textField: [
                      "case",
                      ["==", ["get", "wcType"], "men"],
                      "♂",
                      ["==", ["get", "wcType"], "women"],
                      "♀",
                      "WC",
                    ],
                    textSize: [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      18,
                      16,
                      19,
                      20,
                      22,
                      26,
                    ],
                    textAnchor: "center",
                    textAllowOverlap: true,
                    textIgnorePlacement: true,
                    textOpacity: 0.9,
                    textColor: "#888",
                    textHaloColor: "white",
                    textHaloWidth: 1,
                    textTranslate: [0, -10],
                  }}
                />
              </ShapeSource>
            )}

            {/* Building Features (walls, etc.) */}
            {featuresGeoJSON.features.length > 0 && (
              <ShapeSource id="featuresSource" shape={featuresGeoJSON}>
                <FillExtrusionLayer
                  id="features-extrusion"
                  minZoomLevel={10}
                  maxZoomLevel={22}
                  style={{
                    fillExtrusionColor: [
                      "case",
                      ["==", ["get", "type"], "wall"],
                      isDark ? "#666666" : "#EFF2F7", // Brown color for walls
                      "#B0C9F2", // Gray for other features
                    ],
                    fillExtrusionHeight: ["get", "height"],
                    fillExtrusionBase: 0,
                    fillExtrusionOpacity: 0.9,
                  }}
                />
                {/* Stair Icons for stairs features */}
                <SymbolLayer
                  id="stairs-icons"
                  filter={["==", ["get", "type"], "stairs"]}
                  minZoomLevel={16}
                  maxZoomLevel={22}
                  style={{
                    iconImage: "stairsIcon",
                    iconSize: [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      16,
                      0.5,
                      18,
                      0.75,
                      22,
                      1.1,
                    ],
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconAnchor: "center",
                  }}
                />
              </ShapeSource>
            )}

            <RasterLayer
              id="buildingImageLayer"
              sourceID="buildingImage"
              style={{
                rasterOpacity: 0,
              }}
            />

            {/*            <CustomUserLocation ref={customUserLocationRef} />
          </ShapeSource>

          {/* Friend Location Markers */}
            {friendsGeoJSON.features.length > 0 && (
              <ShapeSource
                id="friendsSource"
                shape={friendsGeoJSON}
                onPress={handleFriendFeaturePress}
                cluster={true}
                clusterRadius={40}
                clusterMaxZoomLevel={16}
              >
                <CircleLayer
                  id="friend-cluster-circles"
                  filter={["has", "point_count"]}
                  style={{
                    circleColor: "#888",
                    circleRadius: [
                      "step",
                      ["get", "point_count"],
                      16,
                      5,
                      20,
                      10,
                      24,
                      25,
                      28,
                    ],
                    circleOpacity: 0.8,
                  }}
                />
                <SymbolLayer
                  id="friend-cluster-count"
                  filter={["has", "point_count"]}
                  style={{
                    textField: ["get", "point_count"],
                    textSize: 15,
                    textColor: "white",
                    textFont: ["Open Sans Bold", "Arial Unicode MS Bold"],
                    textAnchor: "center",
                    textOffset: [0, 0],
                  }}
                />
                <CircleLayer
                  id="friend-circles"
                  filter={["!", ["has", "point_count"]]}
                  style={{
                    circleRadius: [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10,
                      4,
                      18,
                      16,
                    ],
                    circleStrokeColor: isDark ? "#171717" : "#fff",
                    circleColor: ["get", "color"],
                    circleStrokeWidth: 2,
                    circleOpacity: 1,
                  }}
                />
                <SymbolLayer
                  id="friend-labels"
                  filter={["!", ["has", "point_count"]]}
                  style={{
                    textField: ["get", "initial"],
                    textSize: 15,
                    textColor: ["get", "textColor"],
                    textAnchor: "center",
                    textHaloColor: ["get", "color"],
                    textHaloWidth: 1,
                  }}
                />
              </ShapeSource>
            )}

            {/* Local User Location - Add this after friend locations */}
            {localUserLocationGeoJSON.features.length > 0 && (
              <ShapeSource
                id="localUserLocationSource"
                shape={localUserLocationGeoJSON}
              >
                {/* User accuracy circle */}
                <CircleLayer
                  id="local-user-accuracy-circle"
                  style={{
                    circleRadius: [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10,
                      ["*", ["get", "radius"], 0.0132], // Meters to pixels at zoom 10
                      12,
                      ["*", ["get", "radius"], 0.0527], // Meters to pixels at zoom 12
                      15,
                      ["*", ["get", "radius"], 0.4219], // Meters to pixels at zoom 15
                      17,
                      ["*", ["get", "radius"], 1.6892], // Meters to pixels at zoom 17
                      19,
                      ["*", ["get", "radius"], 6.7568], // Meters to pixels at zoom 19
                      20,
                      ["*", ["get", "radius"], 13.5135], // Meters to pixels at zoom 20
                      21,
                      ["*", ["get", "radius"], 27.027], // Meters to pixels at zoom 21
                    ],
                    circleColor: "#3478F5",
                    circleOpacity: 0.15, // Increased for testing
                    circleStrokeColor: "#3478F5",
                    circleStrokeWidth: 2,
                    circleStrokeOpacity: 0.4,
                  }}
                />
                {/* User location dot */}
                <CircleLayer
                  id="local-user-location-dot"
                  style={{
                    circleRadius: [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      3,
                      5,
                      8,
                      10,
                    ],
                    // circleRadius: 10,
                    circleColor: "#3478F5",
                    circleStrokeColor: isDark ? "#171717" : "#fff",
                    circleStrokeWidth: 4,
                    circleOpacity: 1,
                  }}
                />
                {/* User indicator pulse effect */}
                {/* <CircleLayer
                  id="local-user-pulse"
                  style={{
                    circleRadius: [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      10,
                      12,
                      18,
                      28,
                    ],
                    // circleRadius: 12,
                    circleColor: "#3478F5",
                    circleOpacity: 0.3,
                    circleStrokeColor: "#3478F5",
                    circleStrokeWidth: 1,
                    circleStrokeOpacity: 0.6,
                  }}
                /> */}
              </ShapeSource>
            )}
          </MapView>
          </MapBlurTarget>

          {!canteenVisible && (
            <Animated.View
              pointerEvents={pillsTappable ? "box-none" : "none"}
              onLayout={(event) => {
                pillRowHeight.value = event.nativeEvent.layout.height;
              }}
              style={[styles.pillRow, pillRowStyle]}
            >
              {queueStatus ? (
                <View
                  style={styles.pillShrink}
                  pointerEvents={pillsResting ? "auto" : "none"}
                >
                  <MapGlassPill
                    visible={pillsTappable && pillsResting}
                    onPress={() => setCanteenVisible(true)}
                    accessibilityLabel={`Ruokalinjasto: ${queuePillLabel(queueStatus)}. Avaa vilkkaus ja ruokalista.`}
                    style={styles.pillShrink}
                  >
                    {/* Dressed as a button rather than a label: a filled badge
                        leading, a semibold title, a chevron trailing. */}
                    <View
                      style={[
                        styles.queueBadge,
                        {
                          backgroundColor: queueStatus.reporting_open
                            ? getQueueColor(queueStatus.status_level)
                            : colors.textMuted,
                        },
                      ]}
                    >
                      <PlatformSymbol
                        ios="fork.knife"
                        android="restaurant"
                        size={11}
                        tintColor="#fff"
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.pillLabel,
                        styles.queuePillLabel,
                        { color: isDark ? colors.textOnDark : colors.text },
                        // A stale or closed reading is shown, but quieter.
                        (!queueStatus.reporting_open ||
                          queueStatus.status_is_stale) && {
                          color: colors.textMuted,
                        },
                      ]}
                    >
                      {queuePillLabel(queueStatus)}
                    </Text>
                    <PlatformSymbol
                      ios="chevron.right"
                      android="chevron_right"
                      size={11}
                      weight="semibold"
                      tintColor={colors.textMuted}
                    />
                  </MapGlassPill>
                </View>
              ) : (
                <View />
              )}

              <View style={styles.pillRowEnd} pointerEvents="box-none">
                <FloorStepper
                  visible={pillsTappable}
                  value={selectedFloor}
                  onChange={setSelectedFloor}
                  min={0}
                  max={4}
                />
              </View>
            </Animated.View>
          )}

          <GlobalSearch
            roomModalRef={
              roomModalRef as React.MutableRefObject<RoomModalSheetMethods>
            }
            onFocus={() => mapBottomSheetRef.current?.snapToMin()}
            onBlur={() => mapBottomSheetRef.current?.snapToMid()}
            selectedFloor={selectedFloor}
            onFloorChange={setSelectedFloor}
            accessory={recenterButton}
            onRoomSelect={(roomId: string) =>
              handleRoomPress(roomId, { focusMap: true })
            }
          />

          <RoomModalSheet
            ref={roomModalRef}
            onDismiss={() => {
              setSelectedRoomId(null);
            }}
          />

          <FriendModalSheet
            ref={friendModalRef}
            onDismiss={() => setFriendId("")}
            initialSnap="mid"
          >
            <FriendProfileSheetContent
              friend={selectedFriend}
              onClose={() => friendModalRef.current?.close()}
              onRemove={async (id) => {
                await handleRemoveFriend(id);
                await refreshFriends();
              }}
              onBlock={async (id) => {
                await handleBlockFriend(id);
                await refreshFriends();
              }}
              onReport={handleReportFriend}
            />
          </FriendModalSheet>

          <CanteenStatusModal
            visible={canteenVisible}
            status={queueStatus}
            onClose={() => setCanteenVisible(false)}
            onReported={fetchQueueStatus}
          />

          <MapBottomSheet
            ref={mapBottomSheetRef}
            initialSnap="mid"
            hidden={canteenVisible}
            animatedPosition={sheetPosition}
            animatedIndex={sheetIndex}
          >
            {({ currentSnapIndex }) => (
              <BottomSheetView
                style={{
                  flex: 1,
                  // Clear over glass, so the sheet's material shows through.
                  backgroundColor: HAS_LIQUID_GLASS
                    ? "transparent"
                    : sheetColors.surface,
                  height: "100%",
                }}
              >
                {/* Enhanced BLE Location Status with local coordinates */}
                {isDebugMode && (
                  <View
                    style={[
                      styles.bleStatusContainer,
                      isDark && {
                        backgroundColor: sheetColors.surface,
                        borderBottomColor: sheetColors.surface,
                      },
                    ]}
                  >
                    <View style={styles.bleStatusRow}>
                      <View
                        style={[
                          styles.bleIndicator,
                          localUserLocation
                            ? styles.bleActive
                            : styles.bleInactive,
                          isDark && { backgroundColor: "#3478F5" },
                        ]}
                      />
                      <Text
                        style={[
                          styles.bleStatusText,
                          isDark && { color: "white" },
                        ]}
                      >
                        {localUserLocation
                          ? `Room: ${
                              localUserLocation.currentRoom || "Unknown"
                            } | Floor: ${
                              localUserLocation.floor
                            } | ±${Math.round(localUserLocation.radius)}m`
                          : "No location detected"}
                      </Text>
                      {localUserLocation && (
                        <Text style={styles.bleBeaconCount}>
                          {localUserLocation.beacons.length} beacon
                          {localUserLocation.beacons.length !== 1 ? "s" : ""}
                        </Text>
                      )}
                    </View>
                    {localUserLocation?.coordinates && (
                      <Text
                        style={[
                          styles.bleCoordinates,
                          isDark && { color: "#AAA" },
                        ]}
                      >
                        📍 {localUserLocation.coordinates[1].toFixed(6)},{" "}
                        {localUserLocation.coordinates[0].toFixed(6)}
                      </Text>
                    )}
                  </View>
                )}

                {selectedTab === "people" && (
                  <BottomSheetFlatList
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={
                      <>
                        {/* A native search field — system fill, magnifying
                            glass, clear button — with adding a friend as a
                            plain accent glyph beside it, as iOS sets an add
                            action next to a list's search. */}
                        <View style={styles.friendsListHeader}>
                          <View
                            style={[
                              styles.friendSearchField,
                              { backgroundColor: listColors.fill },
                            ]}
                          >
                            <PlatformSymbol
                              ios="magnifyingglass"
                              android="search"
                              size={16}
                              weight="medium"
                              tintColor={listColors.secondaryLabel}
                            />
                            <TextInput
                              placeholder="Hae kavereita"
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              placeholderTextColor={listColors.secondaryLabel}
                              selectionColor={accentColor}
                              returnKeyType="search"
                              onFocus={() => {
                                mapBottomSheetRef.current?.snapToMax();
                              }}
                              style={[
                                styles.friendSearchInput,
                                { color: listColors.label },
                              ]}
                            />
                            {!!searchQuery && (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Tyhjennä haku"
                                hitSlop={10}
                                onPress={() => setSearchQuery("")}
                              >
                                <PlatformSymbol
                                  ios="xmark.circle.fill"
                                  android="cancel"
                                  size={16}
                                  tintColor={listColors.tertiaryLabel}
                                />
                              </Pressable>
                            )}
                          </View>
                          <Pressable
                            onPress={() => router.push("/friends/add")}
                            accessibilityRole="button"
                            accessibilityLabel={
                              requests.length > 0
                                ? `Lisää kaveri, ${requests.length} kaveripyyntöä`
                                : "Lisää kaveri"
                            }
                            hitSlop={8}
                            style={({ pressed }) => [
                              styles.addFriendIconButton,
                              pressed && { opacity: 0.4 },
                            ]}
                          >
                            <PlatformSymbol
                              ios="person.badge.plus"
                              android="person_add"
                              size={22}
                              tintColor={accentColor}
                            />
                            {requests.length > 0 && (
                              <View style={styles.friendRequestBadge}>
                                <Text style={styles.friendRequestBadgeText}>
                                  {requests.length}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        </View>
                        {/* You, first — as Find My leads its list with "Me".
                            Tapping takes the map to you. Out of the way while
                            searching, where it would only ever be noise. */}
                        {me && !searchQuery && (
                          <MeRow
                            name={me.name}
                            color={me.color}
                            location={
                              recentLocation
                                ? [
                                    recentLocation.currentRoom ??
                                      "Tuntematon tila",
                                    recentLocation.floor != null
                                      ? `${recentLocation.floor}. krs`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")
                                : null
                            }
                            onPress={
                              userCoordinates ? recenterOnUser : undefined
                            }
                          />
                        )}
                        {me && !searchQuery && <FriendsSectionHeader />}
                      </>
                    }
                    data={filteredFriends}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <FriendItem
                        friend={item}
                        onPress={() => {
                          handleFriendOpen(item.id);
                          if (
                            item.location &&
                            Array.isArray(item.location) &&
                            item.location.length === 2
                          ) {
                            if (
                              typeof item.floor === "number" &&
                              Number.isFinite(item.floor)
                            ) {
                              setSelectedFloor(item.floor);
                            }
                            setCameraConfig({
                              centerCoordinate: [
                                item.location[0],
                                item.location[1],
                              ],
                              zoomLevel: 20,
                              animationDuration: 1000,
                            });
                          }
                        }}
                      />
                    )}
                    // Hairlines between rows, inset to start under the
                    // name as UIKit's are, and never after the last.
                    ItemSeparatorComponent={() => (
                      <View
                        style={[
                          styles.friendSeparator,
                          { backgroundColor: listColors.separator },
                        ]}
                      />
                    )}
                    scrollEnabled={currentSnapIndex === 2}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                      friendsLoading ? (
                        <FriendListSkeleton />
                      ) : (
                        <Text
                          style={[
                            styles.friendsEmpty,
                            { color: listColors.secondaryLabel },
                          ]}
                        >
                          Kavereita ei löytynyt
                        </Text>
                      )
                    }
                    ListFooterComponent={
                      // A plain accent row, as iOS ends a list with its
                      // "Add…" action, rather than a boxed button.
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.addFriendRow,
                          pressed && { backgroundColor: listColors.highlight },
                        ]}
                        onPress={() => router.push("/friends/add")}
                      >
                        <PlatformSymbol
                          ios="person.badge.plus"
                          android="person_add"
                          size={20}
                          tintColor={accentColor}
                        />
                        <Text
                          style={[styles.addFriendText, { color: accentColor }]}
                        >
                          Lisää kaveri
                        </Text>
                      </Pressable>
                    }
                  />
                )}
                {selectedTab === "rooms" && !showFavoritesOnly && (
                  <FlatList
                    data={filteredRoomData}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => {
                      const roomWithFavorite = {
                        ...item,
                        title: item.name, // Map name to title for RoomItem component
                        seats: item.capacity, // Map capacity to seats for RoomItem component
                        floor: item.floor.toString(), // Convert number to string for RoomItem component
                        isFavorite: item.isFavorite || false,
                        onFavoritePress: () => {
                          setRoomData((prev) =>
                            prev.map((room) =>
                              room.id === item.id
                                ? { ...room, isFavorite: !room.isFavorite }
                                : room,
                            ),
                          );
                        },
                      };
                      return (
                        <RoomItem
                          room={roomWithFavorite}
                          onPress={() => handleRoomPress(item.id)}
                        />
                      );
                    }}
                    scrollEnabled={currentSnapIndex === 2}
                    contentContainerStyle={{
                      paddingTop: 8,
                      paddingBottom: 20,
                      flex: currentSnapIndex === 2 ? 1 : 0,
                      height: currentSnapIndex === 2 ? "100%" : "auto",
                    }}
                    ListEmptyComponent={
                      <View style={{ padding: 20, alignItems: "center" }}>
                        <Text>No rooms available on floor {selectedFloor}</Text>
                      </View>
                    }
                  />
                )}
                {selectedTab === "rooms" &&
                  showFavoritesOnly &&
                  (loading ? (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <ActivityIndicator size="large" color="#3478F5" />
                    </View>
                  ) : error ? (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "red", textAlign: "center" }}>
                        Error loading rooms: {error}
                      </Text>
                      <Pressable
                        onPress={() => fetchRoomsRef.current(true)}
                        style={{
                          marginTop: 10,
                          padding: 10,
                          backgroundColor: "#3478F5",
                          borderRadius: 5,
                        }}
                      >
                        <Text style={{ color: "white" }}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <FlatList
                      data={filteredRoomData.filter((room) => room.isFavorite)}
                      scrollEnabled={currentSnapIndex === 2}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => {
                        const roomWithTitle = {
                          ...item,
                          title: item.name, // Map name to title for RoomItem component
                          seats: item.capacity, // Map capacity to seats for RoomItem component
                          floor: item.floor.toString(), // Convert number to string for RoomItem component
                        };
                        return (
                          <RoomItem
                            room={roomWithTitle}
                            onPress={() =>
                              console.log("Selected room:", item.id)
                            }
                          />
                        );
                      }}
                      contentContainerStyle={{
                        paddingTop: 8,
                        paddingBottom: 20,
                        flex: currentSnapIndex === 2 ? 1 : 0,
                        height: currentSnapIndex === 2 ? "100%" : "auto",
                      }}
                      ListEmptyComponent={
                        <View style={{ padding: 20, alignItems: "center" }}>
                          <Text>
                            No favorite rooms on floor {selectedFloor}
                          </Text>
                        </View>
                      }
                    />
                  ))}
              </BottomSheetView>
            )}
          </MapBottomSheet>
        </View>
      </BottomSheetModalProvider>
      </MapBlurProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // The friends list, laid out as a native iOS list: system font, system
  // fills and separators, sizes from UIKit's own search field and rows.
  friendsListHeader: {
    flexDirection: "row",
    alignItems: "center",
    // Small, because the button's box already pads its glyph by 9pt.
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  // A capsule, as iOS 26 shapes a search field inside a glass sheet, so it
  // echoes the sheet's own rounded corners instead of iOS 18's rectangle.
  friendSearchField: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  friendSearchInput: { ...fonts.regular, flex: 1, fontSize: 17, paddingVertical: 0 },
  // The search field's own height, with the glyph centred in it, so the
  // two share a centre line rather than the glyph riding on its padding.
  addFriendIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  // iOS's own badge: systemRed, a capsule that grows with the count.
  // Placed against the 22pt glyph centred in the 40pt button.
  friendRequestBadge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  friendRequestBadgeText: { ...fonts.semiBold, color: "#fff", fontSize: 12 },
  friendSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: FRIEND_ROW_SEPARATOR_INSET,
  },
  friendsEmpty: { ...fonts.regular, fontSize: 15, textAlign: "center", padding: 20 },
  addFriendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  addFriendText: { ...fonts.regular, fontSize: 17 },
  map: {
    flex: 1,
  },
  // A glass circle the height of the search field, as its twin.
  recenterButton: {
    width: SEARCH_HEIGHT,
    height: SEARCH_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  pillRow: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    // Bottoms aligned: the floor stepper is taller than the pills, and
    // everything in the row should sit the same distance above the sheet.
    alignItems: "flex-end",
    gap: 10,
  },
  pillRowEnd: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    flexShrink: 1,
  },
  // Either pill gives way rather than pushing the other off screen.
  pillShrink: { flexShrink: 1 },
  pillLabel: {
    ...fonts.medium,
    fontSize: 13,
    flexShrink: 1,
  },
  queuePillLabel: { ...fonts.medium, fontSize: 14 },
  queueBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    // Pulls the badge toward the pill's rounded end, as a leading glyph on
    // a capsule button sits.
    marginLeft: -4,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    backgroundColor: "#3478F5",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  fabText: {
    ...fonts.regular,
    color: "white",
    fontSize: 24,
    lineHeight: 28,
  },
  // Modal content styles
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    ...fonts.bold,
    marginBottom: 20,
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: "white",
    zIndex: 1000,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 24,
  },
  bottomSheetTitle: {
    fontSize: 20,
    ...fonts.bold,
    marginBottom: 24,
  },
  bottomSheetButton: {
    backgroundColor: "#3478F5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  bottomSheetButtonText: {
    color: "white",
    fontSize: 16,
    ...fonts.bold,
  },
  bleStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bleActive: {
    backgroundColor: "#4CAF50",
  },
  bleInactive: {
    backgroundColor: "#9E9E9E",
  },
  bleStatusText: {
    fontSize: 14,
    ...fonts.medium,
    color: "#333",
    flex: 1,
  },
  bleBeaconCount: {
    fontSize: 12,
    color: "#666",
    ...fonts.regular,
  },
  bleCoordinates: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
    fontFamily: "monospace",
  },
  // BLE Status styles
  bleStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    // borderBottomWidth: 1,
    // borderBottomColor: "#E5E5E5",
    // backgroundColor: "#F8F9FA",
  },
});
