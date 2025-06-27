import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocumentAsync } from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system';

const STORAGE_KEY = '@findoors:geojson';

export async function geoJsonPicker() {
  const result = await getDocumentAsync({
    type: 'application/geo+json',
    copyToCacheDirectory: true,
  });

  console.log('Document picker result:', JSON.stringify(result, null, 2));
  
  if (!result.canceled && result.assets && result.assets.length > 0) {
    return result.assets[0].uri;
  } else {
    throw new Error('Failed to pick GeoJSON file');
  }
}

export async function loadGeoJSON(uri: string) {
  // Read the file’s contents as text
  const text = await readAsStringAsync(uri);
  // Parse into a JS object
  const geojson = JSON.parse(text);
  return geojson;
}

export async function cacheGeoJSON(geojson: any) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(geojson));
}

export async function getCachedGeoJSON() {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : null;
}