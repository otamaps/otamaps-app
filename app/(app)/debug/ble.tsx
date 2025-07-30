import useBLEScanner from '@/components/functions/bleScanner';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Buffer } from 'buffer';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, FlatList, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BleError, BleManager, Device } from 'react-native-ble-plx';

// Your BLE Service UUID
const SERVICE_UUID = 'f47fcfd9-0634-49de-8e99-80d05ae8fcef';

export default function BLEScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // Use useMemo to prevent bleManager from changing on every render
  const bleManager = useMemo(() => new BleManager(), []);

  // Use the continuous BLE scanner
  const { 
    currentRoom, 
    isInAnyRoom, 
    getScannedBeacons, 
    forceUploadLocation 
  } = useBLEScanner();

  const scannedBeacons = getScannedBeacons();

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }
  };

  const startForegroundService = async () => {
    const channelId = await notifee.createChannel({
      id: 'ble-scan',
      name: 'BLE Scanning',
      importance: AndroidImportance.HIGH,
    });

    await notifee.displayNotification({
      title: 'Room Scanner Active',
      body: 'Scanning for room devices in the background.',
      android: {
        channelId,
        asForegroundService: true,
        pressAction: {
          id: 'default',
        },
      },
    });
  };

  const startScan = useCallback(async () => {
    if (Platform.OS === 'android') {
      await startForegroundService();
    }

    setIsScanning(true);
    setDevices([]);

    bleManager.startDeviceScan([], { allowDuplicates: true }, (error: BleError | null, device: Device | null) => {
      if (error) {
        Alert.alert('Scan Error', error.message);
        setIsScanning(false);
        return;
      }

      if (device && isTargetDevice(device)) {
        setDevices(prevDevices => {
          const exists = prevDevices.some(d => d.id === device.id);
          return exists
            ? prevDevices.map(d => (d.id === device.id ? device : d))
            : [...prevDevices, device];
        });
      }
    });
  }, [bleManager]);

  const stopScan = useCallback(() => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    notifee.stopForegroundService();
  }, [bleManager]);

  useEffect(() => {
    requestPermissions().then(() => startScan());

    return () => {
      stopScan();
      bleManager.destroy();
    };
  }, [startScan, stopScan, bleManager]);

  const isTargetDevice = (device: Device): boolean => {
    if (device.serviceUUIDs?.some(uuid => uuid.includes(SERVICE_UUID))) return true;

    if (device.serviceData) {
      return Object.keys(device.serviceData).some(key => key.includes(SERVICE_UUID));
    }

    if (device.manufacturerData) {
      try {
        const decoded = Buffer.from(device.manufacturerData, 'base64').toString();
        return /^\d{3,5}$/.test(decoded);
      } catch {}
    }

    return false;
  };

  const extractRoomNumber = (device: Device): string => {
    if (device.serviceData) {
      for (const data of Object.values(device.serviceData)) {
        try {
          return Buffer.from(data, 'base64').toString();
        } catch {}
      }
    }

    if (device.manufacturerData) {
      try {
        return Buffer.from(device.manufacturerData, 'base64').toString();
      } catch {}
    }

    return 'Unknown';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>BLE Debug</Text>
      <Text style={styles.description}>Bluetooth Low Energy debugging interface</Text>
      
      {/* Continuous Scanner Status */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>🔄 Continuous Scanner Status</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Current Room: {currentRoom || 'Not in any room'}
          </Text>
          <Text style={styles.statusText}>
            In Room: {isInAnyRoom() ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.statusText}>
            Active Beacons: {scannedBeacons.length}
          </Text>
        </View>
        
        <Button
          title="Force Upload Location"
          onPress={forceUploadLocation}
          color="#4A89EE"
        />
      </View>

      {/* Active Beacons List */}
      {scannedBeacons.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>📡 Active OtaMaps Beacons</Text>
          {scannedBeacons.map((beacon, index) => (
            <View key={beacon.id} style={styles.beaconContainer}>
              <Text style={styles.beaconTitle}>Beacon ID: {beacon.id}</Text>
              <Text style={styles.beaconDetail}>RSSI: {beacon.rssi} dBm</Text>
              <Text style={styles.beaconDetail}>
                Room ID: {beacon.roomId || 'Not mapped'}
              </Text>
              <Text style={styles.beaconDetail}>
                Last Seen: {new Date(beacon.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Original Debug Scanner */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>🔍 Manual Scanner</Text>
        <Button
          title={isScanning ? "Stop Scanning" : "Start Scanning"}
          onPress={isScanning ? stopScan : startScan}
          color={isScanning ? '#f44336' : '#4caf50'}
        />

        <FlatList
          data={devices.slice().sort((a, b) => {
            // Sort by RSSI strength (higher values = stronger signal)
            const rssiA = a.rssi ?? -999;
            const rssiB = b.rssi ?? -999;
            return rssiB - rssiA;
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.deviceContainer}>
              <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
              <Text style={styles.deviceId}>{item.id}</Text>
              <Text style={styles.deviceId}>RSSI: {item.rssi}</Text>
              <Text style={styles.deviceRoom}>Room Number: {extractRoomNumber(item) || 'N/A'}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.noDevices}>No devices found</Text>}
          scrollEnabled={false}
          style={styles.deviceList}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  sectionContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statusContainer: {
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 4,
    color: '#555',
  },
  beaconContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4A89EE',
  },
  beaconTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  beaconDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  deviceList: {
    marginTop: 12,
    maxHeight: 300,
  },
  deviceContainer: {
    padding: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#fff',
    width: '100%',
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  deviceId: {
    fontSize: 14,
    color: '#888',
  },
  deviceRoom: {
    fontSize: 16,
    color: '#333',
  },
  noDevices: {
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
});