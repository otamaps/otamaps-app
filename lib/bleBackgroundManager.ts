/**
 * Android-only helpers for managing the BLE background location service.
 *
 * The "service" is an Android foreground service backed by a persistent
 * notification.  Showing the notification starts the service; cancelling it
 * stops the service (and the underlying BLE scanning task).
 *
 * Usage:
 *   - Call startBLEBackgroundService() after the user logs in.
 *   - Call stopBLEBackgroundService() on logout.
 *   - Use setBLEBackgroundEnabled(false) from a settings toggle to let the
 *     user opt out without logging out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';
import { Platform } from 'react-native';
import { BLE_BG_CHANNEL_ID, BLE_BG_ENABLED_KEY, BLE_BG_NOTIFICATION_ID, triggerBgCleanup } from './bleBackgroundTask';

export type StartServiceResult =
  | { success: true }
  | { success: false; reason: 'permission_denied' | 'error' };

// ─── Internal helpers ────────────────────────────────────────────────────────

async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: BLE_BG_CHANNEL_ID,
    name: 'Location Service',
    description: 'OtaMaps background BLE location tracking',
    importance: AndroidImportance.LOW,
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the Android foreground service. Displays the persistent notification
 * that keeps the BLE scanning task alive even after the app is killed from
 * the recents list.
 *
 * Safe to call multiple times — notifee will update the existing notification
 * rather than creating a duplicate.
 */
export async function startBLEBackgroundService(): Promise<StartServiceResult> {
  if (Platform.OS !== 'android') return { success: false, reason: 'error' };
  console.log('[BLE BG] startBLEBackgroundService called');

  // Android 13+ requires POST_NOTIFICATIONS permission. On older versions this
  // always returns AUTHORIZED immediately without showing a dialog.
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    console.warn('[BLE BG] Notification permission denied — cannot start foreground service');
    await AsyncStorage.setItem(BLE_BG_ENABLED_KEY, 'false');
    return { success: false, reason: 'permission_denied' };
  }

  const channelId = await ensureChannel();
  console.log('[BLE BG] Channel ready:', channelId);
  try {
    await notifee.displayNotification({
      id: BLE_BG_NOTIFICATION_ID,
      title: 'OtaMaps Location Service',
      body: 'Scanning for nearby beacons…',
      android: {
        channelId,
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default' },
      },
    });
    console.log('[BLE BG] Foreground notification displayed — service running');
    await AsyncStorage.setItem(BLE_BG_ENABLED_KEY, 'true');
    return { success: true };
  } catch (e) {
    console.error('[BLE BG] Failed to display foreground notification:', e);
    return { success: false, reason: 'error' };
  }
}

/**
 * Stop the Android foreground service by cancelling the persistent
 * notification. The BLE scanning task resolves (or is killed) as a result.
 */
export async function stopBLEBackgroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  console.log('[BLE BG] stopBLEBackgroundService called');
  triggerBgCleanup();
  await notifee.cancelNotification(BLE_BG_NOTIFICATION_ID);
  console.log('[BLE BG] Foreground notification cancelled — service stopped');
  await AsyncStorage.setItem(BLE_BG_ENABLED_KEY, 'false');
}

/**
 * Returns true when the user has not explicitly disabled the service.
 * Defaults to enabled (returns true if no preference has been saved).
 */
export async function isBLEBackgroundEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const val = await AsyncStorage.getItem(BLE_BG_ENABLED_KEY);
  return val !== 'false';
}

/**
 * Enable or disable the service and persist the preference.
 * Calling with true starts the service; false stops it.
 */
export async function setBLEBackgroundEnabled(enabled: boolean): Promise<StartServiceResult | void> {
  if (enabled) {
    return startBLEBackgroundService();
  } else {
    return stopBLEBackgroundService();
  }
}
