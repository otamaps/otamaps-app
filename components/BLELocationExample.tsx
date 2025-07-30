import useBLEScanner from '@/components/functions/bleScanner';
import { BLELocationService, type LocationHistoryItem } from '@/lib/bleLocationService';
import React, { useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';

interface BeaconData {
  id: string;
  rssi: number;
  timestamp: number;
  roomId?: string;
}

/**
 * Example component showing how to use the enhanced BLE scanner
 */
const BLELocationExample = () => {
  const { 
    currentRoom, 
    getCurrentRoom, 
    isInAnyRoom, 
    getScannedBeacons, 
    forceUploadLocation 
  } = useBLEScanner();

  const [locationHistory, setLocationHistory] = useState<LocationHistoryItem[]>([]);
  const [scannedBeacons, setScannedBeacons] = useState<BeaconData[]>([]);

  useEffect(() => {
    // Update scanned beacons every 2 seconds
    const interval = setInterval(() => {
      setScannedBeacons(getScannedBeacons());
    }, 2000);

    return () => clearInterval(interval);
  }, [getScannedBeacons]);

  const loadLocationHistory = async () => {
    const history = await BLELocationService.getLocationHistory(24); // Last 24 hours
    setLocationHistory(history);
  };

  const handleForceUpload = async () => {
    await forceUploadLocation();
    console.log('Force upload completed');
  };

  const renderBeacon = ({ item }: { item: BeaconData }) => (
    <View style={styles.beaconItem}>
      <Text style={styles.beaconId}>Beacon ID: {item.id}</Text>
      <Text style={styles.beaconRssi}>RSSI: {item.rssi} dBm</Text>
      <Text style={styles.beaconRoom}>
        Room: {item.roomId || 'Unknown'}
      </Text>
      <Text style={styles.beaconTime}>
        Last seen: {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );

  const renderLocationHistory = ({ item }: { item: LocationHistoryItem }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyRoom}>
        Room: {item.room_id || 'Outside'}
      </Text>
      <Text style={styles.historyBeacon}>
        Beacon: {item.beacon_id || 'None'}
      </Text>
      <Text style={styles.historyRssi}>
        RSSI: {item.rssi ? `${item.rssi} dBm` : 'N/A'}
      </Text>
      <Text style={styles.historyTime}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BLE Location Tracker</Text>
        <Text style={styles.currentRoom}>
          Current Room: {currentRoom || 'Not in any room'}
        </Text>
        <Text style={styles.status}>
          Status: {isInAnyRoom() ? 'Inside' : 'Outside'}
        </Text>
      </View>

      <View style={styles.controls}>
        <Button 
          title="Force Upload Location" 
          onPress={handleForceUpload}
        />
        <Button 
          title="Load Location History" 
          onPress={loadLocationHistory}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Scanned Beacons ({scannedBeacons.length})
        </Text>
        <FlatList
          data={scannedBeacons}
          renderItem={renderBeacon}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Location History ({locationHistory.length})
        </Text>
        <FlatList
          data={locationHistory}
          renderItem={renderLocationHistory}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  currentRoom: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  section: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  beaconItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  beaconId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  beaconRssi: {
    fontSize: 12,
    color: '#666',
  },
  beaconRoom: {
    fontSize: 12,
    color: '#4A89EE',
  },
  beaconTime: {
    fontSize: 11,
    color: '#999',
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  historyRoom: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyBeacon: {
    fontSize: 12,
    color: '#666',
  },
  historyRssi: {
    fontSize: 12,
    color: '#666',
  },
  historyTime: {
    fontSize: 11,
    color: '#999',
  },
});

export default BLELocationExample;
