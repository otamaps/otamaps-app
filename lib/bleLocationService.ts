import { getUser } from "@/lib/getUserHandle";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import {
  BeaconCatalogCache,
  BeaconCatalogRemote,
  BeaconCatalogStorage,
} from "./bleBeaconCatalog";
import {
  estimatePosition,
  resolveBeaconObservations,
} from "./blePositionEstimator";
import { supabase } from "./supabase";
import {
  BeaconCatalogEntry,
  BeaconObservation,
  LocationFix,
  LocationUpdateResult,
  PositionEstimate,
} from "./bleTrackingTypes";
import { getTrackingConsentChoices } from "./userPreferences";

const BLE_DEBUG = process.env.EXPO_PUBLIC_DEBUG_BLE === "true";
const bleLog = BLE_DEBUG ? console.log.bind(console) : () => {};

export interface UserLocationData {
  user_id: string;
  room_id: string | null;
  beacon_id: string | null;
  rssi: number | null;
  timestamp: string;
  coordinates?: [number, number] | null;
}

export interface LocationHistoryItem {
  id: string;
  user_id: string;
  room_id: string | null;
  beacon_id: string | null;
  rssi: number | null;
  timestamp: string;
  coordinates: [number, number] | null;
  created_at: string;
}

export interface BeaconInfo {
  id: string;
  rssi: number;
  timestamp: number;
  coordinates?: [number, number];
  distance?: number;
}

export interface LocationData {
  id?: string;
  user_id: string;
  floor: string | null;
  x: number;
  y: number;
  radius: number;
  beacons: BeaconInfo[];
  updated_at?: string;
  shared_to?: string[];
}

export type Beacon = BeaconCatalogEntry;

const BEACONS_CACHE_KEY = "ble_beacon_catalog_v2";
const BEACONS_CACHE_TIMESTAMP_KEY = "ble_beacon_catalog_timestamp_v2";
const BEACON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BEACON_CACHE_MISS_REFRESH_MS = 5 * 60 * 1000;

function sanitizeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  if (typeof error === "string") return error.slice(0, 240);
  return "Unknown location update error";
}

const catalogStorage: BeaconCatalogStorage = {
  async read() {
    try {
      const [raw, timestampRaw] = await Promise.all([
        AsyncStorage.getItem(BEACONS_CACHE_KEY),
        AsyncStorage.getItem(BEACONS_CACHE_TIMESTAMP_KEY),
      ]);
      if (!raw || !timestampRaw) return null;
      const parsed = JSON.parse(raw) as Beacon[];
      const timestamp = Number.parseInt(timestampRaw, 10);
      if (!Array.isArray(parsed) || !Number.isFinite(timestamp)) return null;
      return { beacons: parsed, timestamp };
    } catch (error) {
      console.warn("Failed to read BLE beacon catalog", error);
      return null;
    }
  },
  async write(snapshot) {
    try {
      await Promise.all([
        AsyncStorage.setItem(
          BEACONS_CACHE_KEY,
          JSON.stringify(snapshot.beacons)
        ),
        AsyncStorage.setItem(
          BEACONS_CACHE_TIMESTAMP_KEY,
          snapshot.timestamp.toString()
        ),
      ]);
    } catch (error) {
      console.warn("Failed to persist BLE beacon catalog", error);
    }
  },
  async clear() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(BEACONS_CACHE_KEY),
        AsyncStorage.removeItem(BEACONS_CACHE_TIMESTAMP_KEY),
      ]);
    } catch (error) {
      console.warn("Failed to clear BLE beacon catalog", error);
    }
  },
};

const catalogRemote: BeaconCatalogRemote = {
  async fetchAll() {
    const { data, error } = await supabase
      .from("beacons")
      .select("ble_id, x, y, floor, room_id");
    if (error) {
      console.error("Error fetching BLE beacon catalog:", error.message);
      return null;
    }
    return (data ?? []) as Beacon[];
  },
  async fetchByIds(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("beacons")
      .select("ble_id, x, y, floor, room_id")
      .in("ble_id", ids);
    if (error) {
      console.warn("Beacon batch lookup failed:", error.message);
      return null;
    }
    return (data ?? []) as Beacon[];
  },
};

const beaconCatalog = new BeaconCatalogCache(catalogStorage, catalogRemote, {
  ttlMs: BEACON_CACHE_TTL_MS,
  cacheMissRefreshMs: BEACON_CACHE_MISS_REFRESH_MS,
});

const warmBeaconCatalog = async (): Promise<void> => {
  await beaconCatalog.prepare();
};

export const clearBeaconsCache = async (): Promise<void> => {
  await beaconCatalog.clear();
};

export const getBeacons = async ({
  forceRefresh = false,
}: {
  forceRefresh?: boolean;
} = {}): Promise<Beacon[] | null> => {
  return beaconCatalog.getAll(forceRefresh);
};

async function getBeacon(beaconId: string): Promise<Beacon | null> {
  const normalizedId = String(beaconId).trim();
  const catalog = await beaconCatalog.resolve([normalizedId]);
  return catalog.get(normalizedId) ?? null;
}

async function getRoomNumber(beacon: Beacon): Promise<string | null> {
  if (beacon.room_number) return beacon.room_number;
  if (!beacon.room_id) return null;
  const { data, error } = await supabase
    .from("rooms")
    .select("room_number")
    .eq("id", beacon.room_id)
    .maybeSingle();
  if (error || !data?.room_number) return null;
  const roomNumber = String(data.room_number);
  await beaconCatalog.merge([{ ...beacon, room_number: roomNumber }]);
  return roomNumber;
}

async function getBackgroundSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  const expiresAtMs = (data.session.expires_at ?? 0) * 1000;
  if (expiresAtMs > Date.now() + 60_000) return data.session;

  const refreshed = await supabase.auth.refreshSession(data.session);
  if (refreshed.error) {
    console.warn("BLE session refresh failed:", refreshed.error.message);
    return null;
  }
  return refreshed.data.session;
}

async function resolveBeaconInfos(
  observations: BeaconObservation[]
): Promise<{
  infos: BeaconInfo[];
  catalog: ReadonlyMap<string, Beacon>;
}> {
  const catalog = await beaconCatalog.resolve(
    observations.map((observation) => observation.id)
  );
  const infos = resolveBeaconObservations(observations, catalog).map(
    (observation) => ({
      id: observation.id,
      rssi: observation.rssi,
      timestamp: observation.seenAt,
      coordinates: observation.coordinates,
      distance: observation.distance,
    })
  );
  return { infos, catalog };
}

export class BLELocationService {
  static estimateLocationFixLocally(fix: LocationFix): PositionEstimate | null {
    return estimatePosition(
      fix.selectedBeaconId,
      fix.observations,
      beaconCatalog.peek()
    );
  }

  static async prepareBeaconCatalog(): Promise<void> {
    await warmBeaconCatalog();
  }

  static async updateLocationFix(fix: LocationFix): Promise<LocationUpdateResult> {
    try {
      const session = await getBackgroundSession();
      if (!session) return { success: false, error: "signed_out" };
      const consent = await getTrackingConsentChoices();

      const { infos, catalog } = await resolveBeaconInfos(fix.observations);
      const selected = catalog.get(fix.selectedBeaconId);
      if (!selected || selected.x == null || selected.y == null) {
        return { success: false, error: "selected_beacon_not_found" };
      }

      const estimate = estimatePosition(
        fix.selectedBeaconId,
        fix.observations,
        catalog
      );
      if (!estimate) {
        return { success: false, error: "location_estimate_unavailable" };
      }

      const writes: PromiseLike<{ error: { message: string } | null }>[] = [];
      if (consent.friend_location_enabled) {
        const locationData: LocationData = {
          user_id: session.user.id,
          floor: selected.floor,
          x: estimate.coordinates[0],
          y: estimate.coordinates[1],
          radius: estimate.radius,
          beacons: infos,
          updated_at: new Date(fix.observedAt).toISOString(),
        };
        writes.push(
          supabase.from("locations").upsert(locationData, {
            onConflict: "user_id",
          })
        );
      }
      if (consent.anonymous_analytics_enabled) {
        const floorNumber =
          selected.floor == null ? null : Number(selected.floor);
        writes.push(
          supabase.from("anonymous_crowd_samples").insert({
            room_id: selected.room_id ?? null,
            floor:
              floorNumber !== null && Number.isFinite(floorNumber)
                ? floorNumber
                : null,
            observed_at: new Date(fix.observedAt).toISOString(),
          })
        );
      }
      const results = await Promise.all(writes);
      const writeError = results.find((result) => result.error)?.error;
      if (writeError) return { success: false, error: writeError.message };

      const currentRoom = await getRoomNumber(selected);
      bleLog("BLE location updated", {
        beaconId: fix.selectedBeaconId,
        observedAt: fix.observedAt,
        beaconCount: infos.length,
        estimationMethod: estimate.method,
        contributorCount: estimate.contributorIds.length,
      });
      return {
        success: true,
        currentRoom,
        coordinates: estimate.coordinates,
        floor: selected.floor,
        radius: estimate.radius,
        estimate,
      };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  }

  static async updateLocation(
    detectedBeacons: Map<string, { rssi: number; timestamp?: number; seenAt?: number }>
  ): Promise<boolean> {
    const observations = Array.from(detectedBeacons.entries()).map(
      ([id, beacon]) => ({
        id,
        rssi: beacon.rssi,
        seenAt: beacon.seenAt ?? beacon.timestamp ?? Date.now(),
      })
    );
    const selected = [...observations].sort((a, b) => b.rssi - a.rssi)[0];
    if (!selected) return false;
    const result = await this.updateLocationFix({
      selectedBeaconId: selected.id,
      observations,
      observedAt: Date.now(),
    });
    return result.success;
  }

  static async getBeaconCoordinates(
    beaconId: string
  ): Promise<[number, number] | null> {
    const beacon = await getBeacon(beaconId);
    return beacon && beacon.x != null && beacon.y != null
      ? [beacon.x, beacon.y]
      : null;
  }

  static async getFloorFromBeacon(beaconId: string): Promise<string | null> {
    return (await getBeacon(beaconId))?.floor ?? null;
  }

  static async getFriendIds(): Promise<string[]> {
    const user = await getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("relations")
      .select("subject, object")
      .eq("status", "friends")
      .or(`subject.eq.${user.id},object.eq.${user.id}`);
    if (error) return [];
    return data
      .map((relation) =>
        relation.subject === user.id ? relation.object : relation.subject
      )
      .filter((id) => id !== user.id);
  }

  static async getCurrentLocation(): Promise<LocationData | null> {
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("locations")
      .select("user_id,floor,x,y,radius,beacons,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return error || !data ? null : (data as LocationData);
  }

  static async getFriendsLocations(): Promise<LocationData[]> {
    const friendIds = await this.getFriendIds();
    if (friendIds.length === 0) return [];
    const { data, error } = await supabase
      .from("locations")
      .select("user_id,floor,x,y,radius,beacons,updated_at")
      .in("user_id", friendIds);
    return error ? [] : (data as LocationData[]);
  }

  static subscribeToLocationUpdates(callback: (payload: unknown) => void) {
    return supabase
      .channel("location_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        callback
      )
      .subscribe();
  }

  static async uploadLocation(locationData: UserLocationData): Promise<boolean> {
    console.warn("uploadLocation is deprecated, use updateLocationFix instead");
    const { error } = await supabase
      .from("user_locations")
      .insert(locationData);
    return !error;
  }

  static async getLocationHistory(
    hours = 24
  ): Promise<LocationHistoryItem[]> {
    const user = await getUser();
    if (!user) return [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from("user_locations")
      .select("*")
      .eq("user_id", user.id)
      .gte("timestamp", since.toISOString())
      .order("timestamp", { ascending: false });
    return error ? [] : (data as LocationHistoryItem[]);
  }

  static async getUsersInRoom(
    roomId: string
  ): Promise<LocationHistoryItem[]> {
    const { data, error } = await supabase
      .from("latest_user_locations")
      .select("*")
      .eq("room_id", roomId)
      .not("user_id", "is", null);
    return error ? [] : (data as LocationHistoryItem[]);
  }

  static async cleanupOldLocations(daysBefore = 7): Promise<boolean> {
    const user = await getUser();
    if (!user) return false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);
    const { error } = await supabase
      .from("user_locations")
      .delete()
      .eq("user_id", user.id)
      .lt("timestamp", cutoffDate.toISOString());
    return !error;
  }
}

export default BLELocationService;
