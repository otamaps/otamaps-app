/**
 * Android-only BLE foreground service task.
 *
 * This file MUST be imported at the app root (app/_layout.tsx) at module level,
 * before any notification with asForegroundService:true is displayed.
 * notifee.registerForegroundService() must run before the notification fires —
 * that is its only module-level side effect.
 *
 * When the app is killed from recents, Android restarts the sticky foreground
 * service. React Native reloads the JS bundle in headless mode, which re-runs
 * this registration, and the task callback is invoked again — resuming BLE
 * scanning without any user interaction.
 */

import { Buffer } from 'buffer';
import notifee from '@notifee/react-native';
import { Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { BLELocationService } from './bleLocationService';
import { getRoomIdFromBleId } from './idTranslation';

export const BLE_BG_NOTIFICATION_ID = 'ble_location_service';
export const BLE_BG_CHANNEL_ID = 'ble_location_channel';
export const BLE_BG_ENABLED_KEY = 'ble_bg_service_enabled';

const OTAMAPS_SERVICE_UUID = 'f47fcfd9-0634-49de-8e99-80d05ae8fcef';
const RSSI_THRESHOLD = -80;
const UPLOAD_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BEACON_TIMEOUT_MS = 10_000;

type BeaconEntry = { id: string; rssi: number; timestamp: number; roomId?: string };

// Only register on Android — iOS background BLE works differently and is handled by the hook.
if (Platform.OS === 'android') {
  console.log('[BLE BG] Registering foreground service handler');
  notifee.registerForegroundService(() => {
    return new Promise<void>(async () => {
      console.log('[BLE BG] Foreground service task started');

      const manager = new BleManager();
      const beacons = new Map<string, BeaconEntry>();

      const isOtaMapsDevice = (name: string | null, localName: string | null, serviceUUIDs: string[] | null | undefined, serviceData: Record<string, string> | null | undefined, rssi: number | null): boolean => {
        const nameOk = name === 'Room' || localName === 'Room';
        const signalOk = rssi !== null && rssi >= RSSI_THRESHOLD;
        const hasService =
          serviceUUIDs?.some((u) => u.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()) ||
          (serviceData != null && Object.keys(serviceData).some((u) => u.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()));
        return nameOk && signalOk && !!hasService;
      };

      const extractBeaconId = (serviceData: Record<string, string> | null | undefined, manufacturerData: string | null | undefined): string | null => {
        try {
          if (serviceData) {
            const raw =
              serviceData[OTAMAPS_SERVICE_UUID] ||
              serviceData[OTAMAPS_SERVICE_UUID.toLowerCase()] ||
              serviceData[OTAMAPS_SERVICE_UUID.toUpperCase()];
            if (raw) {
              const id = Buffer.from(raw, 'base64').toString('utf8');
              if (id && id !== 'none' && id.length > 0) return id;
            }
          }
          if (manufacturerData) {
            const id = Buffer.from(manufacturerData, 'base64').toString('utf8');
            if (id && id !== 'none' && id.length > 0) return id;
          }
        } catch {}
        return null;
      };

      const pruneExpired = () => {
        const now = Date.now();
        for (const [id, b] of beacons) {
          if (now - b.timestamp > BEACON_TIMEOUT_MS) beacons.delete(id);
        }
      };

      console.log('[BLE BG] Starting BLE device scan');
      manager.startDeviceScan(null, { allowDuplicates: true }, async (err, device) => {
        if (err) {
          console.error('[BLE BG] Scan error:', err.message);
          return;
        }
        if (!device) return;
        if (!isOtaMapsDevice(device.name, device.localName, device.serviceUUIDs, device.serviceData, device.rssi)) return;

        const beaconId = extractBeaconId(device.serviceData, device.manufacturerData);
        if (!beaconId || !device.rssi) return;

        console.log(`[BLE BG] OtaMaps beacon detected: ${beaconId} (RSSI ${device.rssi})`);

        const existing = beacons.get(beaconId);
        let roomId = existing?.roomId;
        if (!roomId) {
          try {
            roomId = (await getRoomIdFromBleId(beaconId)) || undefined;
            console.log(`[BLE BG] Room lookup for ${beaconId}: ${roomId ?? 'none'}`);
          } catch (e) {
            console.warn(`[BLE BG] Room lookup failed for ${beaconId}:`, e);
          }
        }

        beacons.set(beaconId, { id: beaconId, rssi: device.rssi, timestamp: Date.now(), roomId });
        pruneExpired();
      });

      // Upload location to Supabase every 30 seconds
      const uploadTimer = setInterval(async () => {
        pruneExpired();
        console.log(`[BLE BG] Upload tick — ${beacons.size} active beacon(s)`);
        if (beacons.size === 0) return;
        try {
          const ok = await BLELocationService.updateLocation(beacons as any);
          console.log(`[BLE BG] Location upload ${ok ? 'succeeded' : 'failed'}`);
          // Update notification body with current beacon count
          await notifee.displayNotification({
            id: BLE_BG_NOTIFICATION_ID,
            title: 'OtaMaps Location Service',
            body: `Tracking location · ${beacons.size} beacon${beacons.size !== 1 ? 's' : ''} nearby`,
            android: {
              channelId: BLE_BG_CHANNEL_ID,
              asForegroundService: true,
              ongoing: true,
              autoCancel: false,
              smallIcon: 'ic_launcher',
              pressAction: { id: 'default' },
            },
          });
        } catch (e) {
          console.warn('[BLE BG] Upload error:', e);
        }
      }, UPLOAD_INTERVAL_MS);

      (globalThis as any).__bleBgCleanup = () => {
        console.log('[BLE BG] Cleanup called — stopping scan and timers');
        clearInterval(uploadTimer);
        manager.stopDeviceScan();
        manager.destroy();
      };

      console.log('[BLE BG] Service running — waiting for beacons');
    });
  });
}

// Required by notifee — without this it logs a warning every time a background
// notification event fires. Our ongoing service notification has no interactive
// actions so nothing needs to be handled here.
notifee.onBackgroundEvent(async () => {});

// Expose a way for stopBLEBackgroundService to clean up the JS side before
// the service is killed (best-effort — not guaranteed in headless restart).
export function triggerBgCleanup() {
  try {
    const cleanup = (globalThis as any).__bleBgCleanup;
    if (typeof cleanup === 'function') cleanup();
  } catch {}
}
