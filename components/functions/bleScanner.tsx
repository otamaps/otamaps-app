import { BLELocationService } from "@/lib/bleLocationService";
import { getUser } from "@/lib/getUserHandle";
import { getRoomIdFromBleId } from "@/lib/idTranslation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device } from "react-native-ble-plx";

const manager = new BleManager();

interface BeaconData {
  id: string;
  rssi: number;
  timestamp: number;
  roomId?: string;
}

// OtaMaps specific service UUID from ESP32 firmware
export const OTAMAPS_SERVICE_UUID = "f47fcfd9-0634-49de-8e99-80d05ae8fcef";

let bleServiceInstance: BLEScannerService | null = null;

class BLEScannerService {
  private scannedBeacons: Map<string, BeaconData> = new Map();
  private currentRoom: string | null = null;
  private lastUploadTime: number = 0;
  private readonly UPLOAD_INTERVAL = 30000; // Upload every 30 seconds
  private readonly BEACON_TIMEOUT = 10000; // Consider beacon lost after 10 seconds
  private readonly RSSI_THRESHOLD = -80; // Minimum signal strength to consider

  // Long-lasting cache for beacon-to-room mappings (30 days)
  private roomIdCache: Map<string, string | null> = new Map();
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  private cacheTimestamps: Map<string, number> = new Map();

  constructor() {
    this.loadCacheFromStorage();
    this.startContinuousScanning();
    this.startPeriodicUpload();
  }

  // Load cached beacon-to-room mappings from persistent storage
  private async loadCacheFromStorage() {
    try {
      const cacheData = await AsyncStorage.getItem("beacon_room_cache");
      const timestampData = await AsyncStorage.getItem(
        "beacon_cache_timestamps"
      );

      if (cacheData && timestampData) {
        const cache = JSON.parse(cacheData);
        const timestamps = JSON.parse(timestampData);

        // Only load non-expired cache entries
        const now = Date.now();
        for (const [beaconId, roomId] of Object.entries(cache)) {
          const timestamp = timestamps[beaconId];
          if (timestamp && now - timestamp < this.CACHE_DURATION) {
            this.roomIdCache.set(beaconId, roomId as string | null);
            this.cacheTimestamps.set(beaconId, timestamp);
          }
        }

        console.log(
          `📱 Loaded ${this.roomIdCache.size} beacon mappings from cache`
        );
      }
    } catch (error) {
      console.warn("Error loading beacon cache from storage:", error);
    }
  }

  // Save cache to persistent storage
  private async saveCacheToStorage() {
    try {
      const cacheObj: Record<string, string | null> = {};
      const timestampObj: Record<string, number> = {};

      for (const [beaconId, roomId] of this.roomIdCache.entries()) {
        cacheObj[beaconId] = roomId;
      }

      for (const [beaconId, timestamp] of this.cacheTimestamps.entries()) {
        timestampObj[beaconId] = timestamp;
      }

      await AsyncStorage.setItem("beacon_room_cache", JSON.stringify(cacheObj));
      await AsyncStorage.setItem(
        "beacon_cache_timestamps",
        JSON.stringify(timestampObj)
      );
    } catch (error) {
      console.warn("Error saving beacon cache to storage:", error);
    }
  }

  // Get room ID with long-lasting cache
  private async getCachedRoomId(beaconId: string): Promise<string | null> {
    const now = Date.now();
    const cacheTime = this.cacheTimestamps.get(beaconId);

    // Check if we have a valid cached result (30 days cache)
    if (
      cacheTime &&
      now - cacheTime < this.CACHE_DURATION &&
      this.roomIdCache.has(beaconId)
    ) {
      console.log(
        `🎯 Using cached room ID for beacon ${beaconId} (age: ${Math.round(
          (now - cacheTime) / (1000 * 60 * 60 * 24)
        )} days)`
      );
      return this.roomIdCache.get(beaconId) || null;
    }

    // Cache miss or expired - fetch from database
    console.log(`🔄 Cache miss for beacon ${beaconId}, fetching from database`);
    const roomLookupStart = Date.now();
    const roomId = await getRoomIdFromBleId(beaconId);
    const roomLookupTime = Date.now() - roomLookupStart;

    // Store in cache
    this.roomIdCache.set(beaconId, roomId || null);
    this.cacheTimestamps.set(beaconId, now);

    // Save to persistent storage (async, don't wait)
    this.saveCacheToStorage().catch((err) =>
      console.warn("Failed to save cache:", err)
    );

    if (roomId) {
      console.log(
        `🏠 Beacon ${beaconId} mapped to room: ${roomId} (lookup took ${roomLookupTime}ms, cached for 30 days)`
      );
    } else {
      console.warn(
        `⚠️  Beacon ${beaconId} has no room mapping (lookup took ${roomLookupTime}ms)`
      );
    }

    return roomId || null;
  }

  private async startContinuousScanning() {
    await this.requestPermissions();

    // Scan specifically for OtaMaps service UUID
    manager.startDeviceScan(
      [OTAMAPS_SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          console.error("BLE Scan error:", error);
          return;
        }

        if (device && this.isOtaMapsBeacon(device)) {
          // Wrap async call since BLE callback doesn't support async directly
          this.processBeacon(device).catch((err) =>
            console.error("Error in processBeacon:", err)
          );
        }
      }
    );
  }

  private async requestPermissions() {
    if (Platform.OS === "android") {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      ]);
    }
  }

  private isOtaMapsBeacon(device: Device): boolean {
    // Check if device name matches OtaMaps beacon pattern
    const isCorrectName = device.name === "Room" || device.localName === "Room";

    // Check if device advertises the OtaMaps service UUID
    const hasOtaMapsService =
      device.serviceUUIDs?.some(
        (uuid) => uuid.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()
      ) || false;

    // Check if device has service data for OtaMaps UUID
    const hasOtaMapsServiceData =
      device.serviceData &&
      Object.keys(device.serviceData).some(
        (uuid) => uuid.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()
      );

    // Check RSSI threshold
    const hasValidSignal =
      device.rssi !== null && device.rssi >= this.RSSI_THRESHOLD;

    // Must have either the service UUID or service data, good signal strength, and preferably correct name
    return (
      (hasOtaMapsService || !!hasOtaMapsServiceData) &&
      hasValidSignal &&
      isCorrectName
    );
  }

  private async processBeacon(device: Device) {
    if (!device.rssi || device.rssi < this.RSSI_THRESHOLD) return;

    const beaconId = this.extractBeaconId(device);
    if (!beaconId) {
      console.warn(`Failed to extract beacon ID from device: ${device.id}`);
      return;
    }

    console.log(
      `🔍 Processing OtaMaps beacon - ID: ${beaconId}, RSSI: ${device.rssi} dBm`
    );

    // ✅ Use cached room lookup instead of direct database call
    const roomId = await this.getCachedRoomId(beaconId);

    const beaconData: BeaconData = {
      id: beaconId,
      rssi: device.rssi,
      timestamp: Date.now(),
      roomId: roomId || undefined, // convert null to undefined for type compatibility
    };

    // Check if this is a new beacon or signal strength changed significantly
    const existingBeacon = this.scannedBeacons.get(beaconId);
    if (existingBeacon) {
      const rssiDelta = Math.abs(existingBeacon.rssi - device.rssi);
      if (rssiDelta > 5) {
        // Only log if significant change
        console.log(
          `📶 Beacon ${beaconId} RSSI changed: ${existingBeacon.rssi} -> ${device.rssi} dBm (Δ${rssiDelta})`
        );
      }
    } else {
      console.log(`🆕 New beacon detected: ${beaconId} at ${device.rssi} dBm`);
    }

    this.scannedBeacons.set(beaconId, beaconData);
    this.updateCurrentRoom();
  }

  private extractBeaconId(device: Device): string | null {
    // First try to extract room ID from service data (primary method)
    if (device.serviceData) {
      try {
        // Look for our specific service UUID
        const otaMapsServiceData =
          device.serviceData[OTAMAPS_SERVICE_UUID] ||
          device.serviceData[OTAMAPS_SERVICE_UUID.toLowerCase()] ||
          device.serviceData[OTAMAPS_SERVICE_UUID.toUpperCase()];

        if (otaMapsServiceData) {
          // The service data contains the ROOM_ID as a string
          const roomId = Buffer.from(otaMapsServiceData, "base64").toString(
            "utf8"
          );
          if (roomId && roomId !== "none" && roomId.length > 0) {
            console.log(`Extracted room ID from service data: ${roomId}`);
            return roomId;
          }
        }
      } catch (error) {
        console.warn("Error parsing service data:", error);
      }
    }

    // Fallback: try to extract from manufacturer data (secondary method)
    if (device.manufacturerData) {
      try {
        // The manufacturer data also contains the ROOM_ID
        const roomId = Buffer.from(device.manufacturerData, "base64").toString(
          "utf8"
        );
        if (roomId && roomId !== "none" && roomId.length > 0) {
          console.log(`Extracted room ID from manufacturer data: ${roomId}`);
          return roomId;
        }
      } catch (error) {
        console.warn("Error parsing manufacturer data:", error);
      }
    }

    // If we can't extract the room ID, this beacon is not valid for our purposes
    console.warn(`Could not extract room ID from OtaMaps beacon: ${device.id}`);
    return null;
  }

  private updateCurrentRoom() {
    // Clean up old beacons
    const now = Date.now();
    const beforeCleanup = this.scannedBeacons.size;
    for (const [beaconId, beacon] of this.scannedBeacons.entries()) {
      if (now - beacon.timestamp > this.BEACON_TIMEOUT) {
        console.log(
          `Removing expired beacon: ${beaconId} (age: ${
            now - beacon.timestamp
          }ms)`
        );
        this.scannedBeacons.delete(beaconId);
      }
    }

    if (beforeCleanup !== this.scannedBeacons.size) {
      console.log(
        `Beacon cleanup: ${beforeCleanup} -> ${this.scannedBeacons.size} beacons`
      );
    }

    // Find the strongest beacon signal that has a room mapping
    let strongestBeacon: BeaconData | null = null;
    const availableBeacons = Array.from(this.scannedBeacons.values());
    console.log(
      `Evaluating ${availableBeacons.length} active beacons for room detection:`
    );

    for (const beacon of availableBeacons) {
      console.log(
        `  - Beacon ${beacon.id}: RSSI ${beacon.rssi}dBm, Room: ${
          beacon.roomId || "unmapped"
        }`
      );
      if (
        beacon.roomId &&
        (!strongestBeacon || beacon.rssi > strongestBeacon.rssi)
      ) {
        strongestBeacon = beacon;
      }
    }

    const newRoom = strongestBeacon?.roomId || null;
    if (newRoom !== this.currentRoom) {
      console.log(`🚪 Room changed: "${this.currentRoom}" -> "${newRoom}"`);
      if (strongestBeacon) {
        console.log(
          `   └─ Strongest beacon: ${strongestBeacon.id} (${strongestBeacon.rssi}dBm)`
        );
      }
      this.currentRoom = newRoom;
    } else if (strongestBeacon) {
      console.log(
        `📍 Staying in room "${newRoom}" via beacon ${strongestBeacon.id} (${strongestBeacon.rssi}dBm)`
      );
    } else {
      console.log(`❌ No room detected - no valid beacons with room mapping`);
    }
  }

  private startPeriodicUpload() {
    console.log(
      `⏰ Starting periodic location uploads every ${
        this.UPLOAD_INTERVAL / 1000
      }s`
    );
    setInterval(() => {
      const timeSinceLastUpload = Date.now() - this.lastUploadTime;
      console.log(
        `⏰ Periodic upload triggered (${Math.round(
          timeSinceLastUpload / 1000
        )}s since last upload)`
      );
      this.uploadLocationToSupabase();
    }, this.UPLOAD_INTERVAL);
  }

  private async uploadLocationToSupabase() {
    console.log(
      `📤 Starting location upload - ${this.scannedBeacons.size} beacons detected`
    );

    try {
      const user = await getUser();

      console.log(
        `👤 Authenticated user: ${user?.id || "None"} in bleScanner.tsx`
      );

      if (!user) {
        console.warn(`❌ Upload failed: No authenticated user`);
        return;
      }

      console.log(`👤 Uploading location for user: ${user.id}`);
      console.log(`📊 Current room: ${this.currentRoom || "None"}`);

      // Log beacon details before upload
      if (this.scannedBeacons.size > 0) {
        console.log(`📡 Active beacons:`);
        for (const [beaconId, beacon] of this.scannedBeacons.entries()) {
          const age = Date.now() - beacon.timestamp;
          console.log(
            `   - ${beaconId}: ${beacon.rssi}dBm, room: ${
              beacon.roomId || "unmapped"
            }, age: ${age}ms`
          );
        }
      } else {
        console.log(`📡 No active beacons to upload`);
      }

      // Use the new location updating system
      const startTime = Date.now();
      const success = await BLELocationService.updateLocation(
        this.scannedBeacons
      );
      const uploadTime = Date.now() - startTime;

      if (!success) {
        console.error(
          `❌ Failed to update location data (took ${uploadTime}ms)`
        );
      } else {
        console.log(
          `✅ Location successfully updated in new locations table (took ${uploadTime}ms)`
        );
        this.lastUploadTime = Date.now();
      }
    } catch (error) {
      console.error("💥 Error in uploadLocationToSupabase:", error);
    }
  }

  private getStrongestBeacon(): BeaconData | null {
    let strongest: BeaconData | null = null;
    for (const beacon of this.scannedBeacons.values()) {
      if (!strongest || beacon.rssi > strongest.rssi) {
        strongest = beacon;
      }
    }
    return strongest;
  }

  // Public methods
  getCurrentRoom(): string | null {
    return this.currentRoom;
  }

  getScannedBeacons(): BeaconData[] {
    return Array.from(this.scannedBeacons.values());
  }

  isInAnyRoom(): boolean {
    return this.currentRoom !== null;
  }

  async forceUploadLocation(): Promise<void> {
    console.log(`🚀 Force upload requested by user`);
    await this.uploadLocationToSupabase();
  }

  // Get cache statistics for debugging
  getCacheStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const timestamps = Array.from(this.cacheTimestamps.values());
    return {
      size: this.roomIdCache.size,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  // Clear cache (useful for debugging or when beacon mappings change)
  async clearCache(): Promise<void> {
    this.roomIdCache.clear();
    this.cacheTimestamps.clear();

    try {
      await AsyncStorage.removeItem("beacon_room_cache");
      await AsyncStorage.removeItem("beacon_cache_timestamps");
      console.log("🧹 Beacon cache cleared from memory and storage");
    } catch (error) {
      console.warn("Error clearing cache from storage:", error);
    }
  }

  destroy() {
    manager.stopDeviceScan();
    // Save cache before destroying
    this.saveCacheToStorage().catch((err) =>
      console.warn("Failed to save cache during destroy:", err)
    );
    console.log("🛑 BLE Scanner service destroyed");
  }
}

export default function useBLEScanner() {
  const appState = useRef(AppState.currentState);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
    });

    // Initialize BLE service
    if (!bleServiceInstance) {
      bleServiceInstance = new BLEScannerService();
    }

    // Update current room state periodically
    const roomUpdateInterval = setInterval(() => {
      if (bleServiceInstance) {
        setCurrentRoom(bleServiceInstance.getCurrentRoom());
      }
    }, 1000);

    return () => {
      sub.remove();
      clearInterval(roomUpdateInterval);
      if (bleServiceInstance) {
        bleServiceInstance.destroy();
        bleServiceInstance = null;
      }
    };
  }, []);

  const getCurrentRoom = useCallback((): string | null => {
    return bleServiceInstance?.getCurrentRoom() || null;
  }, []);

  const isInAnyRoom = useCallback((): boolean => {
    return bleServiceInstance?.isInAnyRoom() || false;
  }, []);

  const getScannedBeacons = useCallback((): BeaconData[] => {
    return bleServiceInstance?.getScannedBeacons() || [];
  }, []);

  const forceUploadLocation = useCallback(async (): Promise<void> => {
    if (bleServiceInstance) {
      await bleServiceInstance.forceUploadLocation();
    }
  }, []);

  return {
    currentRoom,
    getCurrentRoom,
    isInAnyRoom,
    getScannedBeacons,
    forceUploadLocation,
  };
}
