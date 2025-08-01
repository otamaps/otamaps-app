import { fmstyles } from "@/assets/styles/friendModalStyles";
import { CustomUserLocation } from "@/components/customUserLocation";
import useBLEScanner from "@/components/functions/bleScanner";
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
import { Friend, getFriends, getRequests } from "@/lib/friendsHandler";
import { Room, useRoomStore } from "@/lib/roomService";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import {
  BottomSheetFlatList,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
  Camera,
  CircleLayer,
  CustomLocationProvider,
  FillLayer,
  MapView,
  OnPressEvent,
  RasterLayer,
  setAccessToken,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";
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

type RoomFeature = MapboxFeature & {
  id: string;
  properties: RoomFeatureProperties;
};

type myFeature = {
  id?: string;
  properties?: {
    id?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type CustomMapPressEvent = MapPressEvent & {
  features?: myFeature[];
};

type RoomItemData = {
  id: string;
  name: string;
  floor: string;
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
  const { currentRoom, getScannedBeacons } = useBLEScanner();
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

  // Fetch friend locations when friends change or component mounts
  useEffect(() => {
    if (friends.length > 0) {
      fetchFriendLocations();
    }
  }, [friends, fetchFriendLocations]);
  const { rooms, loading, error, fetchRooms } = useRoomStore();
  const [roomData, setRoomData] = useState<
    (RoomItemData & { id: string; isFavorite: boolean })[]
  >([]);

  // Filter rooms by selected floor
  const filteredRoomData = useMemo(() => {
    const filtered = roomData.filter((room) => {
      // For now, we'll extract floor from room number if floorId isn't available
      // Assuming room numbers like "D101" where first digit after letter is floor
      const floorMatch = room.room_number?.match(/[A-Z]?(\d)/);
      const roomFloor = floorMatch ? parseInt(floorMatch[1]) : 1;
      return roomFloor === selectedFloor;
    });
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

  useEffect(() => {
    fetchRoomsRef.current();
  }, []);

  useEffect(() => {
    if (rooms.length > 0) {
      // Transform Room[] to RoomItemData[]
      const transformedRooms = rooms.map((room) => {
        // Extract floor from room_number (e.g., "D101" -> floor 1)
        const floorMatch = room.room_number?.match(/[A-Z]?(\d)/);
        const floor = floorMatch ? floorMatch[1] : "1";

        return {
          id: room.id,
          name: room.title || room.room_number,
          floor: floor,
          capacity: room.seats || 0,
          isAvailable: room.status !== "occupied",
          isFavorite: false, // Default to false, this will be managed by local state
          room_number: room.room_number,
        };
      });
      setRoomData(transformedRooms);
    } else {
      setRoomData([]);
    }
  }, [rooms]);

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

  const handleDismiss = () => {
    console.log("[HomeScreen] Dismissing modal");
    friendModalRef.current?.dismiss();
  };

  // On mount: try loading from cache
  useEffect(() => {
    (async () => {
      const cached = await getCachedGeoJSON();
      if (cached) setGeoData(cached);
    })();
  }, []);

  const handleRoomPress = useCallback(
    (roomId: string) => {
      setSelectedRoomId(roomId);
      mapBottomSheetRef.current?.snapToMin();
      roomModalRef.current?.open(roomId);

      // Center the map on the selected room
      const room = rooms.find((r) => r.id === roomId);
      if (room?.geometry) {
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

        // Animate camera to the centroid
        mapRef.current?.setCamera({
          centerCoordinate: [centroid[0], centroid[1]],
          zoomLevel: 18,
          animationDuration: 1000,
        });
      }
    },
    [rooms]
  );

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
      // Extract floor from room number (e.g., "D101" -> floor 1)
      const floorMatch = room.room_number?.match(/[A-Z]?(\d)/);
      const roomFloor = floorMatch ? parseInt(floorMatch[1]) : 1;
      return roomFloor === selectedFloor;
    });
  }, [roomsWithGeometry, selectedFloor]);

  const roomsGeoJSON = useMemo(() => {
    const features = filteredRoomsWithGeometry.map((room) => {
      const roomColor = getValidColor(room.color);
      const [r, g, b] = [
        parseInt(roomColor.slice(1, 3), 16),
        parseInt(roomColor.slice(3, 5), 16),
        parseInt(roomColor.slice(5, 7), 16),
      ];

      return {
        type: "Feature",
        geometry: room.geometry,
        properties: {
          id: room.id,
          roomNumber: room.room_number,
          title: room.title || "Untitled Room",
          isSelected: selectedRoomId === room.id,
          color: roomColor,
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

  // Create GeoJSON for friend locations
  const friendsGeoJSON = useMemo(() => {
    console.log("🔍 Friend filtering debug:", {
      selectedFloor,
      selectedFloorType: typeof selectedFloor,
      selectedFloorAsString: selectedFloor.toString(),
    });

    const friendsToShow = friendsWithLocations.filter((friend) => {
      const hasLocation = !!friend.location;
      // Convert both to numbers for comparison since floor might be stored as number or string
      const friendFloor = Number(friend.locationData?.floor);
      const selectedFloorNum = Number(selectedFloor);
      const floorMatch = friendFloor === selectedFloorNum;

      console.log(`🧑 Filtering ${friend.name}:`, {
        hasLocation,
        friendFloor: friend.locationData?.floor,
        friendFloorType: typeof friend.locationData?.floor,
        friendFloorAsNumber: friendFloor,
        selectedFloor: selectedFloor,
        selectedFloorAsNumber: selectedFloorNum,
        floorMatch,
        willShow: hasLocation && floorMatch,
      });

      return hasLocation && floorMatch;
    });

    console.log("🗺️ Creating friends GeoJSON:", {
      selectedFloor,
      totalFriendsWithLocations: friendsWithLocations.length,
      friendsToShow: friendsToShow.length,
      friendsToShowSample: friendsToShow[0],
    });

    // Log all friends with their coordinates
    console.log("👥 All friends with locations:");
    friendsWithLocations.forEach((friend, index) => {
      console.log(`  ${index + 1}. ${friend.name}:`, {
        id: friend.id,
        status: friend.status,
        hasLocation: !!friend.location,
        coordinates: friend.location,
        floor: friend.locationData?.floor,
        selectedFloor: selectedFloor.toString(),
        matchesFloor: friend.locationData?.floor === selectedFloor.toString(),
        willBeDisplayed:
          friend.location &&
          friend.locationData?.floor === selectedFloor.toString(),
      });
    });

    // Log friends that will be displayed on map
    console.log("🎯 Friends to be displayed on map:");
    friendsToShow.forEach((friend, index) => {
      console.log(`  ${index + 1}. ${friend.name}:`, {
        id: friend.id,
        coordinates: friend.location,
        status: friend.status,
        floor: friend.locationData?.floor,
      });
    });

    const features = friendsToShow.map((friend) => ({
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
    }));

    console.log("📍 GeoJSON features created:", features.length);
    console.log("📍 Individual features:");
    features.forEach((feature, index) => {
      console.log(`  Feature ${index + 1}:`, {
        coordinates: feature.geometry.coordinates,
        properties: feature.properties,
        geometryType: feature.geometry.type,
      });
    });

    const finalGeoJSON = {
      type: "FeatureCollection",
      features,
    };

    console.log("📍 Final GeoJSON object:", finalGeoJSON);
    console.log("📍 Will render ShapeSource:", features.length > 0);

    // Additional coordinate debugging
    if (features.length > 0) {
      const firstFeature = features[0];
      const [lng, lat] = firstFeature.geometry.coordinates;
      console.log("🌍 Coordinate analysis:", {
        originalCoords: firstFeature.geometry.coordinates,
        longitude: lng,
        latitude: lat,
        isInFinland: lat >= 59.8 && lat <= 70.1 && lng >= 19.1 && lng <= 31.6,
        isNearOtaniemi:
          Math.abs(lat - 60.184) < 0.01 && Math.abs(lng - 24.818) < 0.01,
        mapCenter: [24.818510511790645, 60.18394233125424],
        distanceFromCenter: Math.sqrt(
          Math.pow(lng - 24.818510511790645, 2) +
            Math.pow(lat - 60.18394233125424, 2)
        ),
      });
    }

    return finalGeoJSON as any;
  }, [friendsWithLocations, selectedFloor]);

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
          >
            <Camera
              centerCoordinate={[24.818510511790645, 60.18394233125424]}
              zoomLevel={16}
              animationDuration={1000}
              pitch={5}
              maxBounds={{
                ne: [24.797450838759808, 60.1724484493661],
                sw: [24.837734917168515, 60.193210548540286],
              }}
              minZoomLevel={15}
            />
            {/* Room Geometries */}
            {roomsGeoJSON.features.length > 0 && (
              <ShapeSource
                id="roomsSource"
                shape={roomsGeoJSON}
                onPress={handleRoomFeaturePress}
              >
                <FillLayer
                  id="room-fill"
                  style={{
                    fillColor: [
                      "case",
                      ["==", ["get", "isSelected"], true],
                      ["get", "color"],
                      ["get", "rgba"],
                    ],
                    fillOpacity: 0.8,
                    fillOutlineColor: "#fff",
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
              >
                {/* 
                  Text will NOT work here. 
                  Mapbox layers (like ShapeSource, CircleLayer) do not render React Native <Text> elements on the map.
                  To show text labels on the map, use a SymbolLayer with the 'textField' property.
                */}
                <CircleLayer
                  id="friend-circles"
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
                    // circleColor: isDark ? "#1e1e1e" : "#fff",
                    // circleStrokeColor: [
                    //   "case",
                    //   ["==", ["get", "status"], "at school"],
                    //   "#4CAF50",
                    //   ["==", ["get", "status"], "busy"],
                    //   "#FF9800",
                    //   ["==", ["get", "status"], "away"],
                    //   "#9E9E9E",
                    //   "#2196F3",
                    // ],
                    circleStrokeColor: isDark ? "#171717" : "#fff",
                    circleColor: ["get", "color"],
                    circleStrokeWidth: 2,
                    circleOpacity: 1,
                  }}
                />

                <SymbolLayer
                  id="friend-labels"
                  style={{
                    textField: ["get", "initial"], // or use initials logic
                    textSize: 15,
                    textColor: "white",
                    textAnchor: "center",
                    textOffset: [0, 0],
                    textHaloColor: ["get", "color"],
                    textHaloWidth: 1,
                    textFont: ["Open Sans Bold", "Arial Unicode MS Bold"],
                    // textWeight: "bold",
                    // textAllowOverlap: true,
                  }}
                />
              </ShapeSource>
            )}
          </MapView>

          <GlobalSearch
            roomModalRef={roomModalRef}
            onFocus={() => mapBottomSheetRef.current?.snapToMin()}
            onBlur={() => mapBottomSheetRef.current?.snapToMid()}
            selectedFloor={selectedFloor}
            onFloorChange={setSelectedFloor}
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
            <View style={fmstyles.navigateButton}>
              <Text style={fmstyles.navigateButtonText}>Reittiohjeet</Text>
              <MaterialIcons name="directions" size={24} color="white" />
            </View>

            <Pressable style={fmstyles.button}>
              <MaterialIcons
                name="edit"
                size={20}
                color={isDark ? "#e5e5e5" : "black"}
              />
              <Text
                style={[fmstyles.buttonText, isDark && { color: "#e5e5e5" }]}
              >
                Muokkaa nimeä
              </Text>
            </Pressable>

            <View style={{ height: 8 }} />

            <Pressable style={fmstyles.redButton}>
              <Text style={fmstyles.redButtonText}>
                Lopeta oman sijainnin jako
              </Text>
            </Pressable>
            <Pressable style={fmstyles.redButton}>
              <Text style={fmstyles.redButtonText}>
                Estä {friends.find((f) => f.id === friendId)?.name}
              </Text>
            </Pressable>
            <Pressable style={fmstyles.redButton}>
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
                {/* BLE Location Status */}
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
                        isInAnyRoom() ? styles.bleActive : styles.bleInactive,
                        isDark && { backgroundColor: "#4A89EE" },
                      ]}
                    />
                    <Text
                      style={[
                        styles.bleStatusText,
                        isDark && { color: "white" },
                      ]}
                    >
                      {currentRoom
                        ? `Sijainti: ${currentRoom}`
                        : "Sijaintia ei havaittu"}
                    </Text>
                    {scannedBeacons.length > 0 && (
                      <Text style={styles.bleBeaconCount}>
                        {scannedBeacons.length} beacon
                        {scannedBeacons.length !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                </View>

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
                            // open the sheet
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
                        {/* <Pressable
                          onPress={() => router.push("/friends/add")}
                          style={{
                            marginLeft: 12,
                            backgroundColor: isDark ? "#1e1e1e" : "#f5f5f5",
                            padding: 8,
                            borderRadius: 8,
                          }}
                        >
                          <MaterialIcons
                            name="person-add"
                            size={22}
                            color="#737373"
                          />
                        </Pressable> */}
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
                    // data={[
                    //   {
                    //     name: "Faru Yusupov",
                    //     id: "1",
                    //     status: "at school" as const,
                    //     lastSeen: new Date().toISOString(), // Now (will show as 'Just now' if within 30s)
                    //   },
                    //   {
                    //     name: "Toivo Kallio",
                    //     id: "2",
                    //     status: "at school" as const,
                    //     lastSeen: new Date(
                    //       Date.now() - 2 * 60 * 60 * 1000
                    //     ).toISOString(), // 2 hours ago
                    //   },
                    //   {
                    //     name: "Wilmer von Harpe",
                    //     id: "3",
                    //     status: "at school" as const,
                    //     lastSeen: new Date(
                    //       Date.now() - 4 * 60 * 60 * 1000
                    //     ).toISOString(), // 4 hours ago
                    //   },
                    //   {
                    //     name: "Maximilian Bergström",
                    //     id: "4",
                    //     status: "at school" as const,
                    //     lastSeen: new Date(
                    //       Date.now() - 6 * 60 * 60 * 1000
                    //     ).toISOString(),
                    //   },
                    // ]}
                    data={filteredFriends}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <FriendItem
                        friend={item}
                        onPress={() => handleFriendOpen(item.id)}
                      />
                    )}
                    scrollEnabled={currentSnapIndex === 2}
                    contentContainerStyle={{
                      paddingBottom: 20,
                      flex: currentSnapIndex === 2 ? 1 : 0,
                      height: currentSnapIndex === 2 ? "100%" : "auto",
                    }}
                    ListEmptyComponent={
                      <View style={{ padding: 20, alignItems: "center" }}>
                        <Text style={isDark && { color: "#e5e5e5" }}>
                          No {showFavoritesOnly ? "favorite " : ""}people found
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
                          // Handle add friend action
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
  // BLE Status styles
  bleStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    // borderBottomWidth: 1,
    // borderBottomColor: "#E5E5E5",
    // backgroundColor: "#F8F9FA",
  },
});
