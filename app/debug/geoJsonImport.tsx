import { cacheGeoJSON, geoJsonPicker, getCachedGeoJSON, loadGeoJSON } from "@/components/functions/geoJson";
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const GeoJsonImport = () => {
  const [parsedGeoJSON, setParsedGeoJSON] = useState(null);

  const handleImport = async () => {
    try {
      const uri = await geoJsonPicker();
      const geojson = await loadGeoJSON(uri);
      await cacheGeoJSON(geojson);
      console.log('GeoJSON imported and cached successfully:', geojson);
    } catch (error) {
      console.error('Error importing GeoJSON:', error);
    }
  };
  
  const handleCachedList = async () => {
    try {
      const cachedGeoJSON = await getCachedGeoJSON();
      console.log('Cached GeoJSON:', cachedGeoJSON);
      setParsedGeoJSON(cachedGeoJSON);
    } catch (error) {
      console.error('Error fetching cached GeoJSON:', error);
    }
  };

  return(
    <View style={{ flex: 1, alignItems: 'center', padding: 20 }}>
      <Text style={styles.title}>
        Import GeoJSON files for map overlay.
      </Text>
      <Pressable onPress={handleImport} style={{ padding: 16, backgroundColor: '#e0e0e0', borderRadius: 8, marginVertical: 8, width: '100%' }}>
        <Text style={{ fontSize: 18, color: '#333' }}>
          Import GeoJSON
        </Text>
      </Pressable>
      <Pressable onPress={handleCachedList} style={{ padding: 16, backgroundColor: '#e0e0e0', borderRadius: 8, marginVertical: 8, width: '100%' }}>
        <Text style={{ fontSize: 18, color: '#333' }}>
          t(See Cached GeoJSON)
        </Text>
      </Pressable>
      <ScrollView>
      { parsedGeoJSON && (
        <Text style={styles.description}>
          {JSON.stringify(parsedGeoJSON)}
        </Text>
      )}
      </ScrollView>
    </View>
  )
}

export default GeoJsonImport;

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
});