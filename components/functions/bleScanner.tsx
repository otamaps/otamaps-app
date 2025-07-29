import { useEffect, useRef } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";

const manager = new BleManager();

export default function useBLEScanner() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
    });

    startBLE();

    return () => {
      sub.remove();
      manager.stopDeviceScan();
    };
  }, []);

  async function requestPermissions() {
    if (Platform.OS === "android") {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      ]);
    }
  }

  async function startBLE() {
    await requestPermissions();

    manager.startDeviceScan(
      null,
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          console.error("Scan error:", error);
          return;
        }

        if (device?.name || device?.localName) {
          // console.log("Found:", device.name || device.localName, device.id);
        }
      }
    );
  }
}
