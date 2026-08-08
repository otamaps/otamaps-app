import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
} from "@notifee/react-native";
import { AppState, Platform } from "react-native";
import {
  hasBleTrackingPermissions,
  requestBleTrackingPermissions,
} from "./blePermissions";
import {
  BLE_BG_CHANNEL_ID,
  BLE_BG_NOTIFICATION_ID,
  stopAndroidBackgroundRunner,
} from "./bleBackgroundTask";
import {
  getBackgroundTrackingConsent,
  setBackgroundTrackingConsent,
  startForegroundTracking,
  startTrackingRuntime,
  stopAllTracking,
} from "./bleTrackingRuntime";
import { StartTrackingResult } from "./bleTrackingTypes";

export type StartServiceResult = StartTrackingResult;

async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: BLE_BG_CHANNEL_ID,
    name: "Location Service",
    description: "OtaMaps background BLE location tracking",
    importance: AndroidImportance.LOW,
  });
}

export async function startBLEBackgroundService(): Promise<StartServiceResult> {
  if (!Platform.select({ android: true, ios: true, default: false })) {
    return { success: false, reason: "service_error" };
  }
  if (!(await getBackgroundTrackingConsent())) {
    return { success: false, reason: "consent_required" };
  }
  if (!(await hasBleTrackingPermissions(true))) {
    return { success: false, reason: "permission_denied" };
  }

  if (Platform.OS === "ios") {
    return startTrackingRuntime("ios-background");
  }

  // Modern Android forbids ordinary foreground-service launches while the app
  // is already backgrounded. Automatic resume is therefore attempted only
  // from a visible app launch/sign-in.
  if (AppState.currentState !== "active") {
    return { success: false, reason: "service_error" };
  }

  try {
    const channelId = await ensureChannel();
    await notifee.displayNotification({
      id: BLE_BG_NOTIFICATION_ID,
      title: "OtaMaps Location Service",
      body: "Scanning for nearby room beacons",
      android: {
        channelId,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
        ],
        ongoing: true,
        autoCancel: false,
        smallIcon: "ic_launcher",
        pressAction: { id: "default" },
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to start BLE foreground service", error);
    return { success: false, reason: "service_error" };
  }
}

export async function stopBLEBackgroundService(): Promise<void> {
  if (Platform.OS === "android") {
    await stopAndroidBackgroundRunner();
    await notifee.stopForegroundService();
    await notifee.cancelNotification(BLE_BG_NOTIFICATION_ID);
    await stopAllTracking(true);
  } else {
    await stopAllTracking(true);
  }
  await setBackgroundTrackingConsent(false);
}

export async function stopBLETrackingForSignOut(): Promise<void> {
  if (Platform.OS === "android") {
    await stopAndroidBackgroundRunner();
    await notifee.stopForegroundService();
    await stopAllTracking(true);
  } else {
    await stopAllTracking(true);
  }
  await setBackgroundTrackingConsent(false);
}

export async function isBLEBackgroundEnabled(): Promise<boolean> {
  return getBackgroundTrackingConsent();
}

export async function setBLEBackgroundEnabled(
  enabled: boolean
): Promise<StartServiceResult | void> {
  if (!enabled) {
    await stopBLEBackgroundService();
    if (AppState.currentState === "active") {
      return startForegroundTracking();
    }
    return;
  }

  const permissionResult = await requestBleTrackingPermissions(true);
  if (!permissionResult.success) {
    await setBackgroundTrackingConsent(false);
    return permissionResult;
  }
  await setBackgroundTrackingConsent(true);
  const result = await startBLEBackgroundService();
  if (!result.success && result.reason !== "bluetooth_off") {
    await setBackgroundTrackingConsent(false);
  }
  return result;
}

export const setBackgroundTrackingEnabled = setBLEBackgroundEnabled;
