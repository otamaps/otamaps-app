import { geojson } from "@/assets/geos/map";
import FriendItem from "@/components/friendItem";
import { getCachedGeoJSON } from "@/components/functions/geoJson";
import GlobalSearch from "@/components/globalSearch";
import MapBottomSheet from "@/components/mapBottomSheet";
import { FriendModalSheetRef } from '@/components/sheets/friendModalSheet';
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Camera, CustomLocationProvider, FillExtrusionLayer, FillLayer, MapView, RasterLayer, setAccessToken, ShapeSource, UserLocation } from '@rnmapbox/maps';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from "react-native-gesture-handler";

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

  setAccessToken("sk.eyJ1Ijoib25yZWMiLCJhIjoiY21jYmJ3ZTQwMGNzNjJvcG9yNW9zY3MzMyJ9.KUC5868EU0LR_Cq1XkEWtQ")

  const [geoData, setGeoData] = useState(null);
  const friendModalRef = useRef<FriendModalSheetRef>(null);
  const [friends, setFriends] = useState([
    { name: 'Faru Yusupov', id: '1', lat: 60.18394233125424, lon: 24.818510511790645 },
    { name: 'Toivo Kallio', id: '2', lat: 60.18394233125424, lon: 24.818510511790645 },
    { name: 'Wilmer von Harpe', id: '3', lat: 60.18394233125424, lon: 24.818510511790645 },
    { name: 'Maximilian Bergström', id: '4', lat: 60.18394233125424, lon: 24.818510511790645 },
  ]);
  const [selectedTab, setSelectedTab] = useState('people');

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

  return (
    <GestureHandlerRootView style={styles.container}>
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
        <ShapeSource id="buildingSource" shape={geojson3D}>
          <FillExtrusionLayer
            id="extrusionLayer"
            style={{
              fillExtrusionHeight: 10,
              fillExtrusionBase: 0,
              fillExtrusionColor: '#444444', 
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

      <GlobalSearch/>
      
      <MapBottomSheet
        initialSnap="mid"
      >
        <View style={{ flex: 12, backgroundColor: 'white' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={() => setSelectedTab('people')} style={{ padding: 8, width: '50%', alignItems: 'center', borderBottomWidth: selectedTab === 'people' ? 2 : 0, borderBottomColor: '#4A89EE' }}>
              <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16, color: selectedTab === 'people' ? '#4A89EE' : '#333' }}>People</Text>
            </Pressable>
            <Pressable onPress={() => setSelectedTab('rooms')} style={{ padding: 8, width: '50%', alignItems: 'center', borderBottomWidth: selectedTab === 'rooms' ? 2 : 0, borderBottomColor: '#4A89EE' }}>
              <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16, color: selectedTab === 'rooms' ? '#4A89EE' : '#333' }}>Rooms</Text>
            </Pressable>
          </View>
          {selectedTab === 'people' && (
            <BottomSheetFlatList 
              data={[{ name: 'Faru Yusupov', id: '1' }, { name: 'Toivo Kallio', id: '2' }, { name: 'Wilmer von Harpe', id: '3' }, { name: 'Maximilian Bergström', id: '4' }]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FriendItem {...item}/>
              )}
              contentContainerStyle={{ paddingBottom: 20, flex: 1, height: '100%' }}
            />
          )}
          {selectedTab === 'rooms' && (
            <BottomSheetFlatList 
              data={[{ name: 'Room 101', id: '101' }, { name: 'Room 102', id: '102' }, { name: 'Room 103', id: '103' }, { name: 'Room 104', id: '104' }]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FriendItem {...item}/>
              )}
              contentContainerStyle={{ paddingBottom: 20, flex: 1, height: '100%' }}
            />
          )}
        </View>
      </MapBottomSheet>
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
});
