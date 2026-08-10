/**
 * Native background entry points. This module must be imported before the app
 * renders so Notifee can register its one foreground-service runner and iOS can
 * restore an opted-in Core Bluetooth central as early as possible.
 */
import notifee from "@notifee/react-native";
import { Platform } from "react-native";
import {
  initializeIOSStateRestoration,
  startTrackingRuntime,
  stopAllTracking,
} from "./bleTrackingRuntime";
import { reportHandledError, reportHandledMessage } from "./sentry";

export const BLE_BG_NOTIFICATION_ID = "ble_location_service";
export const BLE_BG_CHANNEL_ID = "ble_location_channel";

let androidRunnerResolve: (() => void) | null = null;

if (Platform.OS === "android") {
  notifee.registerForegroundService(() => {
    if (androidRunnerResolve) androidRunnerResolve();
    return new Promise<void>((resolve) => {
      androidRunnerResolve = resolve;
      void startTrackingRuntime("android-background")
        .then(async (result) => {
          // Keep the foreground service alive while Bluetooth is temporarily
          // off; the shared manager is subscribed to state changes and resumes
          // scanning as soon as the radio returns to PoweredOn.
          if (!result.success && result.reason !== "bluetooth_off") {
            if (result.reason === "service_error") {
              reportHandledMessage("Android BLE background service failed to start", {
                area: "ble.background",
                operation: "start_android_service",
              });
            }
            androidRunnerResolve = null;
            resolve();
            await stopAllTracking(result.reason === "signed_out");
            await notifee.stopForegroundService();
          }
        })
        .catch((error) => {
          reportHandledError(error, {
            area: "ble.background",
            operation: "android_foreground_runner",
          });
          androidRunnerResolve = null;
          resolve();
        });
    });
  });
}

// Notifee supports one background event handler for the whole application.
notifee.onBackgroundEvent(async () => {});

if (Platform.OS === "ios") {
  void initializeIOSStateRestoration().catch((error) => {
    reportHandledError(error, {
      area: "ble.background",
      operation: "ios_state_restoration",
    });
  });
}

export async function stopAndroidBackgroundRunner(): Promise<void> {
  if (Platform.OS !== "android") return;
  await stopAllTracking(false);
  androidRunnerResolve?.();
  androidRunnerResolve = null;
}

// Compatibility exports for existing callers while all ownership remains in
// the shared tracking runtime.
export const triggerBgCleanup = stopAndroidBackgroundRunner;

export async function startIOSBackgroundScan(): Promise<void> {
  if (Platform.OS === "ios") await startTrackingRuntime("ios-background");
}

export async function stopIOSBackgroundScan(): Promise<void> {
  if (Platform.OS === "ios") await stopAllTracking(false);
}
