import { fmstyles } from "@/assets/styles/friendModalStyles";
import { CustomUserLocation } from "@/components/customUserLocation";
import useBLEScanner, {
  LocalUserLocation,
} from "@/components/functions/bleScanner";
import GlobalSearch from "@/components/globalSearch";
import RoomItem from "@/components/hRoomItem";
import MapBottomSheet, {
  BottomSheetMethods,
} from "@/components/mapBottomSheet";
import FriendModalSheet, {
  FriendModalSheetRef,
} from "@/components/sheets/friendModalSheet";
import RoomModalSheet, {
  RoomModalSheetMethods,
} from "@/components/sheets/roomModalSheet";
import { BLELocationService } from "@/lib/bleLocationService";
import {
  Friend,
  getFriends,
  getRequests,
  handleRemoveFriend,
} from "@/lib/friendsHandler";
import { Room, useFeatureStore, useRoomStore } from "@/lib/roomService";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import {
  BottomSheetFlatList,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Camera,
  CircleLayer,
  CustomLocationProvider,
  FillExtrusionLayer,
  FillLayer,
  Images,
  MapView,
  RasterLayer,
  setAccessToken,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";
import { OnPressEvent } from "@rnmapbox/maps/lib/typescript/src/types/OnPressEvent";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MultiPolygon, Polygon } from "geojson";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";
import FriendItem, { formatLastSeen } from "../../components/friendItem";

// Define the shape of our room feature properties
type RoomFeatureProperties = {
  id: string;
  roomNumber: string;
  title: string;
  isSelected: boolean;
  color: string;
  rgba: string;
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

type FriendLocation = {
  id: string;
  user_id: string;
  floor: string | number | null; // Can be string or number
  x: number; // longitude
  y: number; // latitude
  radius: number;
  updated_at?: string;
};

type FriendWithLocation = Friend & {
  location: [number, number] | null; // [longitude, latitude]
  locationData?: FriendLocation;
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

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";
  const styleUrlKey = process.env.EXPO_PUBLIC_MAPTILER_KEY as string;
  const accessToken =
    "sk.eyJ1Ijoib25yZWMiLCJhIjoiY21jYmJ3ZTQwMGNzNjJvcG9yNW9zY3MzMyJ9.KUC568EU0LR_Cq1XkEWtQ";

  useEffect(() => {
    setAccessToken(accessToken);
  }, []);

  const [geoData, setGeoData] = useState(null);
  const friendModalRef = useRef<FriendModalSheetRef>(null);
  const mapBottomSheetRef = useRef<BottomSheetMethods>(null);
  const roomModalRef = useRef<RoomModalSheetMethods>(null);
  const customUserLocationRef = useRef<CustomUserLocation>(null);

  // BLE Scanner for location tracking
  const { currentRoom, getScannedBeacons, getCurrentLocation } =
    useBLEScanner();
  const scannedBeacons = getScannedBeacons();
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
    return friends.filter((friend) =>
      friend.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);
  const [selectedTab, setSelectedTab] = useState("people");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [friendsWithLocations, setFriendsWithLocations] = useState<
    FriendWithLocation[]
  >([]);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [localUserLocation, setLocalUserLocation] =
    useState<LocalUserLocation | null>(null);

  // Camera state for dynamic positioning
  const [cameraConfig, setCameraConfig] = useState({
    centerCoordinate: [24.818510511790645, 60.18394233125424] as [
      number,
      number
    ],
    zoomLevel: 16,
    animationDuration: 1000,
  });

  const currentLocation = useMemo(() => {
    return BLELocationService.getCurrentLocation();
  }, []);

  // Fetch friend locations from Supabase
  const fetchFriendLocations = useCallback(async () => {
    try {
      const { data: locations, error } = await supabase
        .from("locations")
        .select("*");

      if (error) {
        console.error("Error fetching friend locations:", error);
        return;
      }

      // Combine friends with their locations
      const friendsWithLocs: FriendWithLocation[] = friends.map((friend) => {
        const friendLocation = locations?.find(
          (loc) => loc.user_id === friend.id
        );

        return {
          ...friend,
          location: friendLocation
            ? [friendLocation.x, friendLocation.y]
            : null, // Fixed: x=longitude, y=latitude
          locationData: friendLocation,
        };
      });

      setFriendsWithLocations(friendsWithLocs);
      console.log("🧑‍🤝‍🧑 Friend locations updated:", {
        totalFriends: friends.length,
        friendsWithLocations: friendsWithLocs.length,
        friendsWithValidLocations: friendsWithLocs.filter((f) => f.location)
          .length,
        locationsData: locations?.length || 0,
        sampleFriend: friendsWithLocs[0],
      });
    } catch (error) {
      console.error("Error in fetchFriendLocations:", error);
    }
  }, [friends]);

  // Fetch local user location from BLE scanner
  const fetchLocalUserLocation = useCallback(async () => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        setLocalUserLocation(location);
        console.log("📍 Local user location updated:", location);
      } else {
        setLocalUserLocation(null);
      }
    } catch (error) {
      console.error("Error fetching local user location:", error);
    }
  }, [getCurrentLocation]);

  const handleReportFriend = async (friendId: string) => {
    Alert.prompt(
      "Ilmoita käyttäjästä",
      "Miksi haluat ilmoittaa tästä käyttäjästä?",
      [
        {
          text: "Peruuta",
          style: "cancel",
        },
        {
          text: "Ilmoita",
          onPress: async (reason) => {
            if (reason) {
              try {
                const { error } = await supabase
                  .from("reports")
                  .insert([{ user_id: friendId, reason }]);
                if (error) throw error;
                Alert.alert("Ilmoitus lähetetty", "Kiitos ilmoituksesta!");
              } catch (err) {
                console.error("Error reporting friend:", err);
                Alert.alert("Virhe", "Ilmoituksen lähettäminen epäonnistui.");
              }
            }
          },
        },
      ],
      "plain-text"
    );
  };

  // Fetch friend locations when friends change or component mounts
  useEffect(() => {
    if (friends.length > 0) {
      fetchFriendLocations();
    }
  }, [friends, fetchFriendLocations]);
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFriendLocations();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [fetchFriendLocations]);

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
        filtered.slice(0, 3).map((r) => `${r.room_number} (floor ${r.floor})`)
      );
    }

    return filtered;
  }, [roomData, selectedFloor]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const fetchRoomsRef = useRef(fetchRooms);
  const [friendId, setFriendId] = useState("");

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
          `  ${room.room_number} -> floor ${room.floor} (from database)`
        );
      });

      const floorCounts = transformedRooms.reduce((acc, room) => {
        acc[room.floor] = (acc[room.floor] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
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
          `  ${feature.id} -> floor ${feature.floor}, type: ${feature.type}`
        );
      });

      const featureTypeCounts = features.reduce((acc, feature) => {
        acc[feature.type] = (acc[feature.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log("Features by type:", featureTypeCounts);

      const floorCounts = features.reduce((acc, feature) => {
        acc[feature.floor] = (acc[feature.floor] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      console.log("Features per floor:", floorCounts);
    }
  }, [features]);

  useFocusEffect(
    useCallback(() => {
      const loadFriends = async () => {
        const data = await getFriends(true); // Force refresh
        setFriends(data);
        console.log("[HomeScreen] Friends refreshed on focus:", data);
      };
      const loadRequests = async () => {
        const data = await getRequests();
        setRequests(data);
        console.log("[HomeScreen] Requests refreshed on focus:", data);
      };
      loadFriends();
      loadRequests();
    }, [])
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
          `🏢 Switching from floor ${selectedFloor} to floor ${room.floor} for room ${room.room_number}`
        );
        setSelectedFloor(room.floor);
      }

      // Only update selection state if it's different
      if (selectedRoomId !== roomId) {
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
          centroid
        );
      }
    },
    [rooms, selectedRoomId, selectedFloor]
  );

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
    if (!color) return "#4A89EE";
    // Check if it's a valid hex color
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return color;
    }
    return "#4A89EE"; // Default color if invalid
  };

  // Create GeoJSON features from rooms with geometry
  const roomsWithGeometry = useMemo(
    () =>
      rooms.filter((room): room is RoomWithGeometry => Boolean(room?.geometry)),
    [rooms]
  );

  // Filter rooms with geometry by selected floor
  const filteredRoomsWithGeometry = useMemo(() => {
    return roomsWithGeometry.filter((room) => {
      // Use the actual floor field from the database
      return room.floor === selectedFloor;
    });
  }, [roomsWithGeometry, selectedFloor]);

  // Helper function to determine WC type from room name
  const getWCType = (roomName: string): "wc" | "men" | "women" | null => {
    const name = roomName.toLowerCase();
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

      const isWC = getWCType(room.title || room.room_number) !== null;

      return {
        type: "Feature",
        geometry: room.geometry,
        properties: {
          id: room.id,
          roomNumber: room.room_number,
          title: room.title || "Untitled Room",
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
            feature.geometry
          );
          return false;
        }
        // Check if coordinates are properly formatted
        if (!Array.isArray(feature.geometry.coordinates)) {
          console.warn(
            "🏗️ Feature geometry coordinates not an array:",
            feature.id
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
      const friendFloor = Number(friend.locationData?.floor);
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
      !localUserLocation.floor ||
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
    [handleRoomPress]
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
    [handleFriendOpen]
  );

  useEffect(() => {
    customUserLocationRef.current?.setCustomLocation(24.81851, 60.18394);
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style={isDark ? "light" : "dark"} />
          <MapView
            ref={mapRef}
            style={styles.map}
            styleURL={
              isDark
                ? "https://api.maptiler.com/maps/basic-v2-dark/style.json?key=K3AliW1jaTRyXigzRrBU"
                : "https://api.maptiler.com/maps/01985d1f-e0d1-76c5-a7f0-a6cc81ebeb06/style.json?key=K3AliW1jaTRyXigzRrBU"
            }
            compassViewMargins={{ x: 10, y: 40 }}
            pitchEnabled={true}
            scaleBarEnabled={false}
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
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
                ne: [24.837734917168515, 60.193210548540286],
                sw: [24.797450838759808, 60.1724484493661],
              }}
              minZoomLevel={14}
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
                  minZoomLevel={19}
                  style={{
                    textField: ["get", "roomNumber"],
                    textSize: 18,
                    textAnchor: "center",
                    textAllowOverlap: true,
                    textIgnorePlacement: true,
                    textOpacity: 0.9,
                    textColor: isDark ? "#ffffffff" : "#424853ff",
                    textHaloColor: "white",
                    textHaloWidth: 0,
                    textTranslate: [0, -10],
                  }}
                />
                <SymbolLayer
                  id="room-symbols"
                  minZoomLevel={19}
                  style={{
                    textField: ["get", "title"],
                    textSize: 12,
                    textAnchor: "center",
                    textAllowOverlap: true,
                    textIgnorePlacement: true,
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
                    textColor: "#8A919C",
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

            <CustomLocationProvider
              coordinate={[24.81851, 60.18394]}
              heading={0}
            />

            <CustomUserLocation ref={customUserLocationRef} />

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
                clusterMaxZoom={16}
              >
                {/* Clustered friend markers: show gray circle with count, else show friend circle/initial */}
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
                  filter={["!has", "point_count"]}
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
                  filter={["!has", "point_count"]}
                  style={{
                    textField: ["get", "initial"],
                    textSize: 15,
                    textColor: "white",
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
                    circleColor: "#4A89EE",
                    circleOpacity: 0.15, // Increased for testing
                    circleStrokeColor: "#4A89EE",
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
                    circleColor: "#4A89EE",
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
                    circleColor: "#4A89EE",
                    circleOpacity: 0.3,
                    circleStrokeColor: "#4A89EE",
                    circleStrokeWidth: 1,
                    circleStrokeOpacity: 0.6,
                  }}
                /> */}
              </ShapeSource>
            )}
          </MapView>

          <GlobalSearch
            roomModalRef={
              roomModalRef as React.MutableRefObject<RoomModalSheetMethods>
            }
            onFocus={() => mapBottomSheetRef.current?.snapToMin()}
            onBlur={() => mapBottomSheetRef.current?.snapToMid()}
            selectedFloor={selectedFloor}
            onFloorChange={setSelectedFloor}
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
            onDismiss={() => {
              // Any cleanup when modal is dismissed
            }}
            initialSnap="mid"
          >
            <View
              style={[
                fmstyles.headerContainer,
                isDark && { backgroundColor: "#1e1e1e" },
                {
                  borderBottomColor: isDark ? "#333" : "#e5e5e5",
                  borderBottomWidth: 1,
                  paddingBottom: 24,
                },
              ]}
            >
              <View style={fmstyles.headerLeft}>
                <Text style={[fmstyles.name, isDark && { color: "white" }]}>
                  {friends.find((f) => f.id === friendId)?.name}
                </Text>
                <Text style={fmstyles.status}>
                  {"Luokassa "}
                  {friends.find((f) => f.id === friendId)
                    ?.user_friendly_location || "Unknown location"}{" "}
                  •{" "}
                  {formatLastSeen(
                    friends.find((f) => f.id === friendId)?.lastSeen || ""
                  )}
                </Text>
              </View>
              <Pressable onPress={() => friendModalRef.current?.close()}>
                <MaterialIcons name="close" size={24} color="#666" />
              </Pressable>
            </View>
            {/* <View style={[fmstyles.navigateButton, { opacity: 0.5 }]}>
              <Text style={fmstyles.navigateButtonText}>Reittiohjeet</Text>
              <MaterialIcons name="directions" size={24} color="white" />
            </View> */}

            {/* <Pressable style={[fmstyles.button, { opacity: 0.3 }]}>
              <MaterialIcons
                name="edit"
                size={20}
                color={isDark ? "#e5e5e5" : "black"}
              />
              <Text
                style={[fmstyles.buttonText, isDark && { color: "#e5e5e5" }]}
              >
                Muokkaa nimeä (Tulossa pian....)
              </Text>
            </Pressable> */}

            <View style={{ height: 8 }} />

            {/* <Pressable
              style={fmstyles.redButton}
              onPress={() => {
                handleStopSharing(friendId);
                friendModalRef.current?.close();
              }}
            >
              <Text style={fmstyles.redButtonText}>
                Lopeta oman sijainnin jako
              </Text>
            </Pressable> */}
            <Pressable
              style={fmstyles.redButton}
              onPress={() => {
                Alert.alert(
                  `Poista ${friends.find((f) => f.id === friendId)?.name}`,
                  "Haluatko varmasti poistaa kaverin?",
                  [
                    {
                      text: "Kumoa",
                      onPress: () => console.log("Cancel Pressed"),
                      style: "cancel",
                    },
                    {
                      text: "Kyllä",
                      style: "destructive",
                      onPress: () => {
                        handleRemoveFriend(friendId);
                        getFriends(true);
                        friendModalRef.current?.close();
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={fmstyles.redButtonText}>Poista kaveri</Text>
            </Pressable>
            <Pressable
              style={fmstyles.redButton}
              onPress={() => {
                Alert.alert(
                  `Estä ${friends.find((f) => f.id === friendId)?.name}`,
                  "Haluatko varmasti estää kaverin?",
                  [
                    {
                      text: "Kumoa",
                      onPress: () => console.log("Cancel Pressed"),
                      style: "cancel",
                    },
                    {
                      text: "Kyllä",
                      style: "destructive",
                      onPress: () => {
                        handleRemoveFriend(friendId);
                        getFriends(true);
                        friendModalRef.current?.close();
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={fmstyles.redButtonText}>
                Estä {friends.find((f) => f.id === friendId)?.name}
              </Text>
            </Pressable>
            <Pressable
              style={fmstyles.redButton}
              onPress={() => {
                handleReportFriend(friendId);
              }}
            >
              <Text style={fmstyles.redButtonText}>
                Ilmianna {friends.find((f) => f.id === friendId)?.name}
              </Text>
            </Pressable>
          </FriendModalSheet>

          <MapBottomSheet ref={mapBottomSheetRef} initialSnap="mid">
            {({ currentSnapIndex }) => (
              <BottomSheetView
                style={{
                  flex: 1,
                  backgroundColor: isDark ? "#1e1e1e" : "white",
                  height: "100%",
                }}
              >
                {/* Enhanced BLE Location Status with local coordinates */}
                {isDebugMode && (
                  <View
                    style={[
                      styles.bleStatusContainer,
                      isDark && {
                        backgroundColor: "#1e1e1e",
                        borderBottomColor: "#1e1e1e",
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
                          isDark && { backgroundColor: "#4A89EE" },
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
                          isDark && { color: "#B5B5B5" },
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
                    ListHeaderComponent={
                      <View
                        style={{
                          paddingHorizontal: 16,
                          paddingTop: 4,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 12,
                        }}
                      >
                        <TextInput
                          placeholder="Hae kavereita..."
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          placeholderTextColor={isDark ? "#B5B5B5" : "#a1a1a1"}
                          onFocus={() => {
                            mapBottomSheetRef.current?.snapToMax();
                          }}
                          style={{
                            backgroundColor: isDark ? "#404040" : "#f5f5f5",
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 16,
                            flex: 1,
                            color: isDark ? "white" : "black",
                          }}
                        />
                        <Pressable
                          onPress={() => router.push("/friends/requests")}
                          style={{
                            marginLeft: 6,
                            backgroundColor: isDark ? "#404040" : "#f5f5f5",
                            padding: 8,
                            borderRadius: 8,
                          }}
                        >
                          {requests.length > 0 && (
                            <View
                              style={{
                                backgroundColor: "red",
                                width: 15,
                                height: 15,
                                borderRadius: 20,
                                alignItems: "center",
                                justifyContent: "center",
                                display: "flex",
                                flexDirection: "row",
                                position: "absolute",
                                top: -3,
                                right: -3,
                              }}
                            >
                              <Text style={{ color: "white", fontSize: 12 }}>
                                {requests.length}
                              </Text>
                            </View>
                          )}
                          <MaterialIcons
                            name="notifications"
                            size={22}
                            color={isDark ? "#e5e5e5" : "#737373"}
                          />
                        </Pressable>
                      </View>
                    }
                    data={filteredFriends}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <FriendItem
                        friend={
                          item as {
                            id: string;
                            name: string;
                            status?: "ei sijaintia" | "busy" | string;
                            lastSeen?: string | number;
                            isFavorite?: boolean;
                            color?: string;
                          }
                        }
                        onPress={() => {
                          handleFriendOpen(item.id);
                          if (
                            item.location &&
                            Array.isArray(item.location) &&
                            item.location.length === 2
                          ) {
                            // setSelectedFloor(3);
                            setSelectedFloor(parseInt(item.status[0], 10));
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
                    scrollEnabled={currentSnapIndex === 2} // Always enable scrolling
                    contentContainerStyle={{
                      paddingBottom: 80,
                      // Remove restrictive height and flex settings
                    }}
                    ListEmptyComponent={
                      <View style={{ padding: 20, alignItems: "center" }}>
                        <Text style={isDark && { color: "#e5e5e5" }}>
                          Kavereita ei löytynyt
                        </Text>
                      </View>
                    }
                    ListFooterComponent={
                      <Pressable
                        style={({ pressed }) => [
                          styles.addFriendButton,
                          pressed && styles.addFriendButtonPressed,
                          isDark && {
                            backgroundColor: "#2b7fff50",
                            borderColor: "#8ec5ff50",
                          },
                        ]}
                        onPress={() => {
                          console.log("Add friend pressed");
                          router.push("/friends/add");
                        }}
                      >
                        <MaterialIcons
                          name="person-add"
                          size={20}
                          color={isDark ? "#8ec5ff" : "#4A89EE"}
                        />
                        <Text
                          style={[
                            styles.addFriendText,
                            isDark && { color: "#8ec5ff" },
                          ]}
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
                                : room
                            )
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
                      <ActivityIndicator size="large" color="#4A89EE" />
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
                          backgroundColor: "#4A89EE",
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  addFriendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F5FF",
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#D6E3FF",
    borderStyle: "dashed",
  },
  addFriendButtonPressed: {
    opacity: 0.7,
  },
  addFriendText: {
    color: "#4A89EE",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
  },
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    backgroundColor: "#007AFF",
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
    fontWeight: "bold",
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
    fontWeight: "bold",
    marginBottom: 24,
  },
  bottomSheetButton: {
    backgroundColor: "#4A89EE",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  bottomSheetButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
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
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  bleBeaconCount: {
    fontSize: 12,
    color: "#666",
    fontWeight: "400",
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
