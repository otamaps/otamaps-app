import {
  forceUploadCurrentLocation,
  getTrackingSnapshot,
  hydrateTrackingSnapshot,
  subscribeToTrackingSnapshot,
} from "@/lib/bleTrackingRuntime";
import {
  BleTrackingSnapshot,
  OTAMAPS_SERVICE_UUID,
} from "@/lib/bleTrackingTypes";
import { useCallback, useEffect, useState } from "react";

export { OTAMAPS_SERVICE_UUID };

interface BeaconData {
  id: string;
  rssi: number;
  timestamp: number;
}

export interface LocalUserLocation {
  coordinates: [number, number] | null;
  floor: number | null;
  radius: number;
  currentRoom: string | null;
  beacons: {
    id: string;
    rssi: number;
    coordinates?: [number, number];
    distance?: number;
  }[];
  lastUpdated: number;
}

function toLocalLocation(
  value: BleTrackingSnapshot
): LocalUserLocation | null {
  if (!value.coordinates) return null;
  return {
    coordinates: value.coordinates,
    floor: value.floor,
    radius: value.radius,
    currentRoom: value.currentRoom,
    beacons: value.beacons.map((beacon) => ({
      id: beacon.id,
      rssi: beacon.rssi,
    })),
    lastUpdated: value.lastUpdated,
  };
}

/**
 * Read-only React adapter for the process-wide BLE tracking runtime. Mounting
 * or unmounting this hook never creates or destroys a BleManager.
 */
export default function useBLEScanner() {
  const [trackingSnapshot, setTrackingSnapshot] =
    useState<BleTrackingSnapshot>(getTrackingSnapshot());

  useEffect(() => {
    const unsubscribe = subscribeToTrackingSnapshot(setTrackingSnapshot);
    void hydrateTrackingSnapshot().then(setTrackingSnapshot);
    return unsubscribe;
  }, []);

  const getCurrentRoom = useCallback(
    (): string | null => getTrackingSnapshot().currentRoom,
    []
  );

  const isInAnyRoom = useCallback(
    (): boolean => getTrackingSnapshot().currentRoom !== null,
    []
  );

  const getScannedBeacons = useCallback((): BeaconData[] => {
    return getTrackingSnapshot().beacons.map((beacon) => ({
      id: beacon.id,
      rssi: beacon.rssi,
      timestamp: beacon.seenAt,
    }));
  }, []);

  const forceUploadLocation = useCallback(async (): Promise<void> => {
    await forceUploadCurrentLocation();
  }, []);

  const getCurrentLocation = useCallback(
    async (): Promise<LocalUserLocation | null> =>
      toLocalLocation(getTrackingSnapshot()),
    []
  );

  return {
    currentRoom: trackingSnapshot.currentRoom,
    status: trackingSnapshot.diagnostics.status,
    diagnostics: trackingSnapshot.diagnostics,
    getCurrentRoom,
    getCurrentLocation,
    isInAnyRoom,
    getScannedBeacons,
    forceUploadLocation,
  };
}
