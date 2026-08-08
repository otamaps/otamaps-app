import * as Location from "expo-location";
import {
  AppState,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { StartTrackingResult } from "./bleTrackingTypes";

function androidApiLevel(): number {
  return typeof Platform.Version === "number"
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10);
}

export async function getBlePermissionSnapshot(): Promise<
  Record<string, string | number | boolean>
> {
  if (Platform.OS === "android") {
    const apiLevel = androidApiLevel();
    const fineLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    const bluetoothScan =
      apiLevel < 31 ||
      (await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      ));
    const bluetoothConnect =
      apiLevel < 31 ||
      (await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      ));
    const backgroundLocation =
      apiLevel < 29 ||
      apiLevel > 30 ||
      (await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      ));

    return {
      apiLevel,
      fineLocation,
      bluetoothScan,
      bluetoothConnect,
      backgroundLocation,
    };
  }

  if (Platform.OS === "ios") {
    const foregroundLocation = await Location.getForegroundPermissionsAsync();
    return {
      foregroundLocation: foregroundLocation.status,
      bluetooth: "managed_by_ios",
    };
  }

  return { supported: false };
}

export async function hasBleTrackingPermissions(
  background: boolean
): Promise<boolean> {
  const snapshot = await getBlePermissionSnapshot();
  if (Platform.OS === "android") {
    return (
      snapshot.fineLocation === true &&
      snapshot.bluetoothScan === true &&
      snapshot.bluetoothConnect === true &&
      (!background || snapshot.backgroundLocation === true)
    );
  }
  return Platform.OS === "ios";
}

export async function requestBleTrackingPermissions(
  background: boolean
): Promise<StartTrackingResult> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return { success: false, reason: "service_error" };
  }

  if (AppState.currentState !== "active") {
    return { success: false, reason: "permission_denied" };
  }

  if (Platform.OS === "ios") {
    // Core Bluetooth presents its own system permission prompt when the manager
    // is first used. GPS background permission is not a prerequisite for BLE.
    return { success: true };
  }

  const apiLevel = androidApiLevel();
  const foregroundPermissions = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ...(apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : []),
  ];
  const foregroundResults = await PermissionsAndroid.requestMultiple(
    foregroundPermissions
  );
  const foregroundGranted = foregroundPermissions.every(
    (permission) =>
      foregroundResults[permission] === PermissionsAndroid.RESULTS.GRANTED
  );

  if (!foregroundGranted) {
    return { success: false, reason: "permission_denied" };
  }

  // Android 10 and 11 require background location for BLE discovery after the
  // app leaves the foreground. Android 12+ uses the Nearby Devices permission.
  if (background && apiLevel >= 29 && apiLevel <= 30) {
    const backgroundResult = await Location.requestBackgroundPermissionsAsync();
    if (backgroundResult.status !== "granted") {
      return { success: false, reason: "permission_denied" };
    }
  }

  return { success: true };
}
