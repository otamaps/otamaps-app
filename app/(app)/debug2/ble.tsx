import * as BackgroundFetch from "expo-background-fetch";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  PermissionsAndroid,
  Platform,
  Text,
  View,
} from "react-native";
import { BleManager, State as BleState } from "react-native-ble-plx";

// Define types for our beacon data
interface BeaconDevice {
  id: string;
  name: string;
  rssi: number | null;
  mtu: number | null;
  serviceData: Record<string, any>;
  manufacturerData: string | null;
  txPowerLevel: number | null;
  isConnectable: boolean;
  overflowServiceUUIDs: string[] | null;
  solicitedServiceUUIDs: string[] | null;
  serviceUUIDs: string[] | null;
  timestamp: string;
}

// Disable console.log in production
const log = () => {};

// Background task name
const BACKGROUND_SCAN_TASK = "background-beacon-scan";

// Last notification timestamp for each device
const lastNotificationTime: Record<string, number> = {};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Register background task
TaskManager.defineTask(
  BACKGROUND_SCAN_TASK,
  async ({ data, error }: { data: any; error: any }) => {
    if (error) {
      console.error("Background task error:", error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (data?.devices) {
      handleDevicesInBackground(data.devices);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  }
);

// Function to show notification
const showDeviceNotification = async (device: any, isNew: boolean) => {
  const now = Date.now();
  const lastTime = lastNotificationTime[device.id] || 0;

  // Only show notification if it's a new device or it's been more than 10 seconds
  if (!isNew && now - lastTime < 10000) {
    return;
  }

  lastNotificationTime[device.id] = now;

  // await Notifications.scheduleNotificationAsync({
  //   content: {
  //     title: isNew ? 'New Device Found' : 'Device Nearby',
  //     body: `${device.name || 'Unknown Device'} (${device.id})`,
  //     data: { device },
  //   },
  //   trigger: null, // Send immediately
  // });
};

// Process devices in background
const handleDevicesInBackground = (devices: any[]) => {
  devices.forEach((device) => {
    if (device?.serviceData) {
      const isNew = !lastNotificationTime[device.id];
      showDeviceNotification(device, isNew);
    }
  });
};

const BLEBeaconScanner = () => {
  const [manager, setManager] = useState<BleManager | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [beacons, setBeacons] = useState<BeaconDevice[]>([]);
  const [bleState, setBleState] = useState<BleState | null>(null);

  useEffect(() => {
    log("Initializing BLE Manager...");

    const bleManager = new BleManager({
      restoreStateIdentifier: "BleInTheBackground",
      restoreStateFunction: (restoredState) => {
        log("BLE Manager state restored", {
          hasRestoredState: !!restoredState,
        });
      },
    });

    // Monitor BLE state changes
    const subscription = bleManager.onStateChange((state) => {
      log("BLE State changed", { state: BleState[state] });
      setBleState(state);

      if (state === BleState.PoweredOff) {
        log("Bluetooth is powered off");
      } else if (state === BleState.PoweredOn) {
        log("Bluetooth is powered on and ready");
      } else if (state === BleState.Unauthorized) {
        log("Bluetooth usage is not authorized");
      }
    }, true);

    setManager(bleManager);
    log("BLE Manager initialized");

    return () => {
      log("Cleaning up BLE Manager...");
      subscription.remove();
      bleManager
        .destroy()
        .then(() => log("BLE Manager destroyed"))
        .catch((error) => log("Error destroying BLE Manager", error));
    };
  }, []);

  useEffect(() => {
    if (!manager) return;

    // Track notified devices
    const notifiedDevices = new Set<string>();

    // Function to process discovered devices
    const processDevices = (devices: any[]) => {
      const devicesWithServiceData = devices.filter((d) => d?.serviceData);

      // Update UI state
      setBeacons((prevBeacons) => {
        const updatedBeacons = [...prevBeacons];
        const now = Date.now();

        devicesWithServiceData.forEach((device) => {
          const existingIndex = updatedBeacons.findIndex(
            (b) => b.id === device.id
          );
          const deviceInfo: BeaconDevice = {
            id: device.id,
            name: device.name || "Unknown",
            rssi: device.rssi,
            mtu: device.mtu,
            serviceData: device.serviceData,
            manufacturerData: device.manufacturerData || null,
            txPowerLevel: device.txPowerLevel,
            isConnectable: device.isConnectable,
            overflowServiceUUIDs: device.overflowServiceUUIDs || null,
            solicitedServiceUUIDs: device.solicitedServiceUUIDs || null,
            serviceUUIDs: device.serviceUUIDs || null,
            timestamp: new Date().toISOString(),
          };

          if (existingIndex >= 0) {
            updatedBeacons[existingIndex] = deviceInfo;
          } else {
            updatedBeacons.push(deviceInfo);
          }

          // Show notification for new devices or every 10 seconds
          const isNew = !notifiedDevices.has(device.id);
          if (isNew) {
            notifiedDevices.add(device.id);
          }

          // Show notification for new devices or if it's been more than 10 seconds
          const lastTime = lastNotificationTime[device.id] || 0;
          // if (isNew || now - lastTime >= 10000) {
          //   lastNotificationTime[device.id] = now;
          //   Notifications.scheduleNotificationAsync({
          //     content: {
          //       title: isNew ? "New Device Found" : "Device Nearby",
          //       body: `${device.name || "Unknown Device"} (${device.id})`,
          //       data: { device: deviceInfo },
          //     },
          //     trigger: null, // Send immediately
          //   });
          // }
        });

        // Keep only the 10 most recent devices
        return updatedBeacons.slice(-10);
      });
    };

    // Set up device discovery
    const discoverySubscription = manager.onStateChange((state) => {
      if (state === "PoweredOn") {
        manager.startDeviceScan(
          null,
          { allowDuplicates: true },
          (error, device) => {
            if (error) {
              console.error("BLE Scan Error:", error);
              return;
            }
            if (device) {
              processDevices([device]);
            }
          }
        );
      }
    }, true);

    return () => {
      discoverySubscription.remove();
    };
  }, [manager, isScanning]);

  const requestPermissions = async () => {
    log("Requesting BLE and location permissions...");

    if (Platform.OS === "android") {
      const apiLevel = parseInt(Platform.Version.toString(), 10);
      log("Android API Level detected", { apiLevel });

      try {
        // First, check if location is enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();
        if (!locationEnabled) {
          log("Location services are disabled, requesting to enable...");
          const enabled = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Location Required",
              "Bluetooth scanning requires location services to be enabled. Would you like to enable it now?",
              [
                {
                  text: "Cancel",
                  onPress: () => resolve(false),
                  style: "cancel",
                },
                {
                  text: "Enable",
                  onPress: async () => {
                    try {
                      // This will open location settings
                      await Location.enableNetworkProviderAsync();
                      resolve(true);
                    } catch (error) {
                      log("Error enabling location services", error);
                      resolve(false);
                    }
                  },
                },
              ],
              { cancelable: false }
            );
          });

          if (!enabled) {
            log("User declined to enable location services");
            Alert.alert(
              "Location Required",
              "Bluetooth scanning requires location services to be enabled."
            );
            return false;
          }
        }

        // Now request the actual permissions
        if (apiLevel >= 31) {
          log("Android 12+ detected, requesting runtime permissions");
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];

          // Only request background location if needed
          if (apiLevel >= 29) {
            // Android 10+
            permissions.push(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
            );
          }

          log("Requesting permissions", { permissions });
          const result = await PermissionsAndroid.requestMultiple(permissions);
          log("Permission request result", result);

          // For Android 12+, we only need BLUETOOTH_SCAN and BLUETOOTH_CONNECT
          const requiredPermissions =
            apiLevel >= 31
              ? [
                  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]
              : [
                  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                  ...(apiLevel >= 29
                    ? [
                        PermissionsAndroid.PERMISSIONS
                          .ACCESS_BACKGROUND_LOCATION,
                      ]
                    : []),
                ];

          const allGranted = requiredPermissions.every(
            (permission) =>
              result[permission] === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!allGranted) {
            log("Not all required permissions were granted", {
              result,
              requiredPermissions,
            });
            Alert.alert(
              "Permissions Required",
              "Please grant all required permissions in app settings to use Bluetooth scanning.",
              [{ text: "OK" }]
            );
          } else {
            log("All required permissions granted");
          }

          return allGranted;
        } else {
          // For Android < 12, we only need location permission
          log("Android <12 detected, requesting location permission");
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: "Location Permission",
              message:
                "This app needs access to your location for Bluetooth scanning.",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK",
            }
          );

          const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
          log(`Location permission ${isGranted ? "granted" : "denied"}`);

          if (!isGranted) {
            Alert.alert(
              "Location Permission Required",
              "Bluetooth scanning requires location permission to work properly.",
              [{ text: "OK" }]
            );
          }

          return isGranted;
        }
      } catch (error) {
        log("Error requesting permissions", error);
        Alert.alert("Error", "Failed to request required permissions");
        return false;
      }
    }

    // For iOS, we'll rely on the system prompt
    log("iOS platform detected, using system permission prompt");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      if (!granted) {
        Alert.alert(
          "Location Permission Required",
          "Please enable location permissions in Settings to use Bluetooth scanning."
        );
      }
      return granted;
    } catch (error) {
      log("Error requesting iOS location permission", error);
      return false;
    }
  };

  const startScan = async (): Promise<boolean> => {
    log("Starting BLE scan...");

    if (!manager) {
      log("BLE Manager not initialized");
      Alert.alert("Error", "Bluetooth not available");
      return false;
    }

    try {
      // Request notification permissions if not already granted
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        log("Notification permission not granted");
        Alert.alert(
          "Notifications Disabled",
          "You will not receive alerts for nearby beacons."
        );
      }

      const permissionsGranted = await requestPermissions();
      if (!permissionsGranted) {
        const errorMsg = "Required permissions not granted";
        log(errorMsg);
        Alert.alert(
          "Permission Required",
          "Bluetooth and Location permissions are required to scan for beacons."
        );
        return false;
      }

      // Check if Bluetooth is on
      const state = await manager.state();
      if (state !== "PoweredOn") {
        const errorMsg = `Bluetooth is not on. Current state: ${state}`;
        log(errorMsg);
        Alert.alert(
          "Bluetooth Off",
          "Please enable Bluetooth to scan for beacons."
        );
        return false;
      }

      // Start scanning for devices
      manager.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            console.error("BLE Scan Error:", error);
            return;
          }
          if (device?.serviceData) {
            const isNew = !beacons.some((b) => b.id === device.id);
            const now = Date.now();
            const lastTime = lastNotificationTime[device.id] || 0;

            if (isNew || now - lastTime >= 10000) {
              lastNotificationTime[device.id] = now;
              // Notifications.scheduleNotificationAsync({
              //   content: {
              //     title: isNew ? 'New Device Found' : 'Device Nearby',
              //     body: `${device.name || 'Unknown Device'} (${device.id})`,
              //     data: { device },
              //   },
              //   trigger: null,
              // });
            }

            setBeacons((prevBeacons) => {
              const existingIndex = prevBeacons.findIndex(
                (b) => b.id === device.id
              );
              const deviceInfo: BeaconDevice = {
                id: device.id,
                name: device.name || "Unknown",
                rssi: device.rssi || null,
                mtu: device.mtu || null,
                serviceData: device.serviceData || {},
                manufacturerData: device.manufacturerData || null,
                txPowerLevel: device.txPowerLevel || null,
                isConnectable: device.isConnectable || false,
                overflowServiceUUIDs: device.overflowServiceUUIDs || null,
                solicitedServiceUUIDs: device.solicitedServiceUUIDs || null,
                serviceUUIDs: device.serviceUUIDs || null,
                timestamp: new Date().toISOString(),
              };

              if (existingIndex >= 0) {
                const updated = [...prevBeacons];
                updated[existingIndex] = deviceInfo;
                return updated;
              }

              return [...prevBeacons, deviceInfo].slice(-10);
            });
          }
        }
      );

      log("BLE scan started");
      return true;
    } catch (error) {
      console.error("Failed to start scan:", error);
      Alert.alert("Error", "Failed to start BLE scanning");
      return false;
    }
  };

  const stopScan = async (): Promise<void> => {
    log("Stopping BLE scan...");

    if (manager) {
      try {
        manager.stopDeviceScan();
        log("BLE scan stopped");
      } catch (error) {
        console.error("Error stopping scan:", error);
      }
      log("Cannot stop scan: BLE Manager not initialized");
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20, fontWeight: "bold" }}>
        BLE Beacon Scanner
      </Text>

      <View style={{ marginBottom: 20 }}>
        <Button
          title={isScanning ? "Stop Scanning" : "Start Scanning"}
          onPress={() => setIsScanning(!isScanning)}
          color="#4A89EE"
        />
      </View>

      <View
        style={{
          marginBottom: 10,
          padding: 10,
          backgroundColor: "#f5f5f5",
          borderRadius: 5,
        }}
      >
        <Text style={{ fontWeight: "bold" }}>
          Status: {isScanning ? "Scanning..." : "Idle"}
        </Text>
        <Text>Beacons with service data: {beacons.length}</Text>
      </View>

      <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "bold" }}>
        Beacons with Service Data:
      </Text>
      {beacons.length === 0 ? (
        <Text style={{ marginTop: 10, fontStyle: "italic", color: "#666" }}>
          No beacons with service data found yet. Start scanning to discover
          devices.
        </Text>
      ) : (
        [...beacons]
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .map((beacon, index) => (
            <View
              key={`${beacon.id}-${index}`}
              style={{
                marginTop: 10,
                padding: 10,
                backgroundColor: index % 2 === 0 ? "#f9f9f9" : "#fff",
                borderRadius: 5,
                borderLeftWidth: 3,
                borderLeftColor:
                  beacon.rssi > -70
                    ? "#4CAF50"
                    : beacon.rssi > -85
                    ? "#FFC107"
                    : "#F44336",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {beacon.name || "Unknown Device"}
                </Text>
                <Text style={{ color: "#666" }}>
                  {new Date(beacon.timestamp).toLocaleTimeString()}
                </Text>
              </View>

              <Text>RSSI: {beacon.rssi} dBm</Text>

              {beacon.serviceData && (
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "#f0f0f0",
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontWeight: "600", marginBottom: 4 }}>
                    Service Data:
                  </Text>
                  {Object.entries(beacon.serviceData).map(([key, value]) => (
                    <Text
                      key={key}
                      style={{ fontSize: 12, fontFamily: "monospace" }}
                    >
                      {key}: {JSON.stringify(value)}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                {beacon.id}
              </Text>
            </View>
          ))
      )}
    </View>
  );
};

export default BLEBeaconScanner;
