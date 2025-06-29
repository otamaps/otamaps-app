import notifee, { AndroidImportance } from '@notifee/react-native';
import { Buffer } from 'buffer';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

// Your BLE Service UUID
const SERVICE_UUID = 'f47fcfd9-0634-49de-8e99-80d05ae8fcef';

export default function BLEScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const bleManager = new BleManager();

  useEffect(() => {
    requestPermissions().then(() => startScan());

    return () => {
      stopScan();
      bleManager.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE,
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

  const startScan = async () => {
    if (Platform.OS === 'android') {
      await startForegroundService();
    }

    setIsScanning(true);
    setDevices([]);

    bleManager.startDeviceScan([], { allowDuplicates: true }, (error, device) => {
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
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    notifee.stopForegroundService();
  };

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
    <View style={styles.container}>
      <Text style={styles.title}>BLE Debug</Text>
      <Text style={styles.description}>Bluetooth Low Energy debugging interface</Text>
      
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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