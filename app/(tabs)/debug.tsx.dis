import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Debug = () => {
  const router = useRouter();
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Debug Options</Text>
      <FlatList
        data={[
          {id: 1, name: 'BLE debugging', screenURL: '/debug/ble'}, 
          {id: 2, name: 'Import debug GeoJSON', screenURL: '/debug/geoJsonImport'}, 
          {id: 3, name: 'Language Options', screenURL: '/debug/lang'},
          {id: 4, name: 'Supabase Debug', screenURL: '/debug/supabase'},
          {id: 5, name: 'Welcome Flow', screenURL: '/welcome'},
        ]} // Example data
        renderItem={({ item }) => (
          <Pressable style={styles.option} onPress={() => router.push(item.screenURL as any)}>
            <Text style={styles.optionText}>{item.name}</Text>
          </Pressable>
        )}
        keyExtractor={(item, index) => index.toString()}
        style={{ width: '100%' }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
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
  option: {
    padding: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginVertical: 8,
    width: '100%',
  },
  optionText: {
    fontSize: 18,
    color: '#333',
  },
});

export default Debug;