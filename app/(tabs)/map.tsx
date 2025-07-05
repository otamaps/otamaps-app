import { geojson } from "@/assets/geos/map";
import { fmstyles } from "@/assets/styles/friendModalStyles";
import FriendItem, { formatLastSeen } from "@/components/friendItem";
import { getCachedGeoJSON } from "@/components/functions/geoJson";
import GlobalSearch from "@/components/globalSearch";
import RoomItem from "@/components/hRoomItem";
import MapBottomSheet, { BottomSheetMethods } from "@/components/mapBottomSheet";
import FriendModalSheet, { FriendModalSheetRef } from '@/components/sheets/friendModalSheet';
import RoomModalSheet, { RoomModalSheetMethods } from "@/components/sheets/roomModalSheet";
import { useRoomStore } from '@/lib/roomService';
import { MaterialIcons } from "@expo/vector-icons";
import { BottomSheetFlatList, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import { Camera, CustomLocationProvider, FillExtrusionLayer, FillLayer, MapView, RasterLayer, setAccessToken, ShapeSource, UserLocation } from '@rnmapbox/maps';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState, forwardRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";

type RoomItemData = {
  id: string;
  name: string;
  floor: string;
  capacity: number;
  isAvailable: boolean;
  isFavorite: boolean;
  room_number: string;
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

const geojson3D = geojson;

const eraser = {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          coordinates: [
            [
              [-74.00618, 40.71406],
              [-74.00703, 40.71307],
              [-74.00787, 40.71206],
              [-74.00766, 40.71176],
              [-74.00624, 40.71204],
              [-74.00487, 40.71252],
              [-74.00421, 40.71315],
              [-74.00618, 40.71406]
            ]
          ],
          type: 'Polygon'
        }
      }
    ]
  }
}

export default function HomeScreen() {
  const styleUrlKey = process.env.EXPO_PUBLIC_MAPTILER_KEY as string

  setAccessToken("sk.eyJ1Ijoib25yZWMiLCJhIjoiY21jYmJ3ZTQwMGNzNjJvcG9yNW9zY3MzMyJ9.KUC568EU0LR_Cq1XkEWtQ")

  const [geoData, setGeoData] = useState(null);
  const friendModalRef = useRef<FriendModalSheetRef>(null);
  const mapBottomSheetRef = useRef<BottomSheetMethods>(null);
  const roomModalRef = useRef<RoomModalSheetMethods>(null); 
  const [friends, setFriends] = useState([
    { 
      name: 'Faru Yusupov', 
      id: '1', 
      status: 'at school' as const, 
      lastSeen: new Date().toISOString() // Now (will show as 'Just now' if within 30s)
    }, 
    { 
      name: 'Toivo Kallio',
      id: '2', 
      status: 'at school' as const, 
      lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    }, 
    { 
      name: 'Wilmer von Harpe', 
      id: '3', 
      status: 'at school' as const, 
      lastSeen: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
    }, 
    { 
      name: 'Maximilian Bergström', 
      id: '4', 
      status: 'at school' as const, 
      lastSeen: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() 
    }
  ]);
  const [selectedTab, setSelectedTab] = useState('people'); 
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { rooms, loading, error, fetchRooms } = useRoomStore();
  const [roomData, setRoomData] = useState<Array<RoomItemData & { id: string; isFavorite: boolean }>>([]);
  const fetchRoomsRef = useRef(fetchRooms);
  const [friendId, setFriendId] = useState('');
  
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
      setRoomData(rooms);
    } else {
      setRoomData([]);
    }
  }, [rooms]);

  const handleAddFriend = () => {
    console.log('[HomeScreen] modal ref is', friendModalRef.current);
    friendModalRef.current?.present();
  };

  const handleDismiss = () => {
    console.log('[HomeScreen] Dismissing modal');
    friendModalRef.current?.dismiss();
  };

  // On mount: try loading from cache
  useEffect(() => {
    (async () => {
      const cached = await getCachedGeoJSON();
      if (cached) setGeoData(cached);
    })();
  }, []);

  const handleRoomPress = useCallback((roomId: string) => {
    roomModalRef.current?.open(roomId);
    mapBottomSheetRef.current?.snapToMin();
  }, []);

  const handleFriendOpen = (friendId: string) => {
    setFriendId(friendId);
    friendModalRef.current?.present();
    mapBottomSheetRef.current?.snapToMin();
  };

  const handlePress = (e: any) => {
    console.log('Pressed', e.features);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
    <BottomSheetModalProvider>
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <MapView
        style={styles.map}
        styleURL={`https://api.maptiler.com/maps/openstreetmap/style.json?key=XSJRg4GXeLgDiZ98hfVp`}
        compassViewMargins={{ x: 10, y: 40 }}
        pitchEnabled={true}
      >
        <Camera
          centerCoordinate={[24.818510511790645, 60.18394233125424]}
          zoomLevel={16}
          animationDuration={1000}
          pitch={5}
          maxBounds={{
            ne: [24.620221246474574, 59.98446920858392],
            sw: [25.016749575387433, 60.28339638856884]
          }}
          minZoomLevel={9}
        />
        <ShapeSource id="buildingSource" shape={geojson3D} onPress={handlePress}>
          <FillExtrusionLayer
            id="3d-buildings"
            sourceLayerID="building"
            minZoomLevel={14}
            maxZoomLevel={24}
            style={{
              fillExtrusionHeight: 5,
              fillExtrusionBase: 0,
              fillExtrusionColor: '#ccc',
              fillExtrusionOpacity: 0.8,
            }}
          />
          <FillExtrusionLayer
            id="3d-doors"
            sourceLayerID="door"
            minZoomLevel={14}
            maxZoomLevel={24}
            style={{
              fillExtrusionHeight: 1,
              fillExtrusionBase: 4,
              fillExtrusionColor: '#ccc',
              fillExtrusionOpacity: 0.8,
            }}
          />
          <FillExtrusionLayer
            id="3d-furniture"
            sourceLayerID="furniture"
            minZoomLevel={14}
            maxZoomLevel={24}
            style={{
              fillExtrusionHeight: 2,
              fillExtrusionBase: 0.5,
              fillExtrusionColor: '#ccc',
              fillExtrusionOpacity: 0.8,
            }}
          />
          <FillLayer
            id="fill"
            style={{
              fillColor: '#444444',
              fillOpacity: 0.5,
            }}
          />
        </ShapeSource>

        <CustomLocationProvider
          coordinate={[24.18510511790645, 60.18394233125424]}
          heading={0}
        />
        <UserLocation/>
      
        <RasterLayer
          id="buildingImageLayer"
          sourceID="buildingImage"
          style={{
            rasterOpacity: 0,
          }}
        />
      </MapView>

      <GlobalSearch roomModalRef={roomModalRef} />

      <RoomModalSheet
        ref={roomModalRef}
        onDismiss={() => {
          // Any cleanup when modal is dismissed
        }}
      />

      <FriendModalSheet
        ref={friendModalRef}
        onDismiss={() => {
          // Any cleanup when modal is dismisseds
        }}
        initialSnap="mid"
      >
        <View style={fmstyles.headerContainer}>
          <View style={fmstyles.headerLeft}>
            <Text style={fmstyles.name}>{friends.find(f => f.id === friendId)?.name}</Text>
            <Text style={fmstyles.status}>{friends.find(f => f.id === friendId)?.status.charAt(0).toUpperCase() + friends.find(f => f.id === friendId)?.status.slice(1)} • {formatLastSeen(friends.find(f => f.id === friendId)?.lastSeen)}</Text>
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
          <MaterialIcons name="edit" size={20} color="black" />
          <Text style={fmstyles.buttonText}>Muokkaa nimeä</Text>
        </Pressable>

        <View style={{ height: 8 }}/>

        <Pressable style={fmstyles.redButton}>
          <Text style={fmstyles.redButtonText}>Lopeta oman sijainnin jako</Text>
        </Pressable>
        <Pressable style={fmstyles.redButton}>
          <Text style={fmstyles.redButtonText}>Estä {friends.find(f => f.id === friendId)?.name}</Text>
        </Pressable>
        <Pressable style={fmstyles.redButton}>
          <Text style={fmstyles.redButtonText}>Ilmianna {friends.find(f => f.id === friendId)?.name}</Text>
        </Pressable>
      </FriendModalSheet>
      
      <MapBottomSheet
        ref={mapBottomSheetRef}
        initialSnap="mid"
      >
        {({ currentSnapIndex }) => (
        <BottomSheetView style={{ flex: 1, backgroundColor: 'white', height: '100%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={() => handleTabPress('people')} style={{ padding: 8, width: '50%', alignItems: 'center', borderBottomWidth: selectedTab === 'people' ? 2 : 0, borderBottomColor: '#4A89EE', flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16, color: selectedTab === 'people' ? '#4A89EE' : '#333' }}>People</Text>
              {showFavoritesOnly && selectedTab === 'people' && (
                <MaterialIcons name="star" size={16} color="#4A89EE" style={{ marginLeft: 8 }}/>
              )}
            </Pressable>
            <Pressable onPress={() => handleTabPress('rooms')} style={{ padding: 8, width: '50%', alignItems: 'center', borderBottomWidth: selectedTab === 'rooms' ? 2 : 0, borderBottomColor: '#4A89EE', flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16, color: selectedTab === 'rooms' ? '#4A89EE' : '#333' }}>Rooms</Text>
              {showFavoritesOnly && selectedTab === 'rooms' && (
                <MaterialIcons name="star" size={16} color="#4A89EE" style={{ marginLeft: 8 }} />
              )}
            </Pressable>
          </View>
          {selectedTab === 'people' && (
            <BottomSheetFlatList 
              data={[
                { 
                  name: 'Faru Yusupov', 
                  id: '1', 
                  status: 'at school' as const, 
                  lastSeen: new Date().toISOString() // Now (will show as 'Just now' if within 30s)
                }, 
                { 
                  name: 'Toivo Kallio',
                  id: '2', 
                  status: 'at school' as const, 
                  lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
                }, 
                { 
                  name: 'Wilmer von Harpe', 
                  id: '3', 
                  status: 'at school' as const, 
                  lastSeen: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
                }, 
                { 
                  name: 'Maximilian Bergström', 
                  id: '4', 
                  status: 'at school' as const, 
                  lastSeen: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() 
                }
              ]}
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
                height: currentSnapIndex === 2 ? '100%' : 'auto'
              }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text>No {showFavoritesOnly ? 'favorite ' : ''}people found</Text>
                </View>
              }
            /> 
          )}
          {selectedTab === 'rooms' && !showFavoritesOnly && (
            <FlatList 
              data={roomData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const roomWithFavorite = {
                  ...item,
                  isFavorite: item.isFavorite || false,
                  onFavoritePress: () => {
                    setRoomData(prev => 
                      prev.map(room => 
                        room.id === item.id 
                          ? { ...room, isFavorite: !room.isFavorite } 
                          : room
                      )
                    );
                  }
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
                height: currentSnapIndex === 2 ? '100%' : 'auto'
              }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text>No rooms available</Text>
                </View>
              }
            />
          )}
          {selectedTab === 'rooms' && showFavoritesOnly && (
            loading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4A89EE" />
              </View>
            ) : error ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: 'red', textAlign: 'center' }}>Error loading rooms: {error}</Text>
                <Pressable 
                  onPress={() => fetchRoomsRef.current(true)}
                  style={{ marginTop: 10, padding: 10, backgroundColor: '#4A89EE', borderRadius: 5 }}
                >
                  <Text style={{ color: 'white' }}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={roomData.filter(room => room.isFavorite)}
                scrollEnabled={currentSnapIndex === 2}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <RoomItem
                    room={item}
                    onPress={() => console.log('Selected room:', item.id)}
                  />
                )}
                contentContainerStyle={{ 
                  paddingTop: 8, 
                  paddingBottom: 20,
                  flex: currentSnapIndex === 2 ? 1 : 0,
                  height: currentSnapIndex === 2 ? '100%' : 'auto'
                }}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text>No rooms available</Text>
                  </View>
                }
              />
            )
          )}
        </BottomSheetView>
        )}
      </MapBottomSheet>
    </View>
    </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    backgroundColor: '#007AFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  fabText: {
    color: 'white',
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
    fontWeight: 'bold',
    marginBottom: 20,
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: 'white',
    zIndex: 1000,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 24,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  bottomSheetButton: {
    backgroundColor: '#4A89EE',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bottomSheetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
