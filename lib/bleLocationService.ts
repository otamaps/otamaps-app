import { getUser } from "@/lib/getUserHandle";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

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

export interface BeaconInfo {
  id: string;
  rssi: number;
  timestamp: number;
  coordinates?: [number, number];
  distance?: number;
}

export interface Beacon {
  ble_id: string;
  x: number;
  y: number;
  floor: string | null;
}

function calculateDistanceFromRSSI(rssi: number): number {
  if (rssi === 0) return -1.0;
  const measuredPower = -59;
  const pathLossExponent = 2.5;
  const ratio = (measuredPower - rssi) / (10 * pathLossExponent);
  return Math.pow(10, ratio);
}

function calculateLocationRadius(beacons: BeaconInfo[]): number {
  if (beacons.length === 0) return 50;
  const distances = beacons.map((beacon) => beacon.distance || 50);
  const minDistance = Math.min(...distances);
  const uncertainty = beacons.length > 1 ? 5 : 15;
  return Math.max(5, minDistance + uncertainty);
}

const BEACONS_CACHE_KEY = "beacons";
const BEACONS_CACHE_TIMESTAMP_KEY = "beacons_cache_timestamp";

const getBeaconsFromSupabase = async (): Promise<Beacon[] | null> => {
  try {
    const { data, error } = await supabase
      .from("beacons")
      .select("ble_id, x, y, floor");
    if (error) {
      console.error(
        "Error fetching beacons from Supabase:",
        error.message,
        error.details
      );
      return null;
    }
    if (!data || data.length === 0) {
      console.warn("No beacons found in database");
      return [];
    }
    console.log("Fetched beacons from Supabase:", data);
    return data as Beacon[];
  } catch (error) {
    console.error("Error in getBeaconsFromSupabase:", error);
    return null;
  }
};

const getCachedBeacons = async () => {
  try {
    const raw = await AsyncStorage.getItem(BEACONS_CACHE_KEY);
    const timestampRaw = await AsyncStorage.getItem(
      BEACONS_CACHE_TIMESTAMP_KEY
    );
    const beacons = raw ? JSON.parse(raw) : null;
    const timestamp = timestampRaw ? parseInt(timestampRaw, 10) : null;
    console.log("Cached beacons:", beacons, "Timestamp:", timestamp);
    return beacons && timestamp ? { beacons, timestamp } : null;
  } catch (err) {
    console.warn("Failed to load cached beacons", err);
    return null;
  }
};

const setCachedBeacons = async (beacons: Beacon[] | null) => {
  try {
    console.log("Storing beacons in cache:", beacons);
    if (beacons) {
      // Ensure ble_id is stored as a string
      const normalizedBeacons = beacons.map((beacon) => ({
        ...beacon,
        ble_id: String(beacon.ble_id),
      }));
      await AsyncStorage.setItem(
        BEACONS_CACHE_KEY,
        JSON.stringify(normalizedBeacons)
      );
      await AsyncStorage.setItem(
        BEACONS_CACHE_TIMESTAMP_KEY,
        Date.now().toString()
      );
    } else {
      await AsyncStorage.removeItem(BEACONS_CACHE_KEY);
      await AsyncStorage.removeItem(BEACONS_CACHE_TIMESTAMP_KEY);
    }
  } catch (err) {
    console.warn("Failed to update cached beacons", err);
  }
};

export const clearBeaconsCache = async () => {
  try {
    await AsyncStorage.removeItem(BEACONS_CACHE_KEY);
    await AsyncStorage.removeItem(BEACONS_CACHE_TIMESTAMP_KEY);
    console.log("Beacons cache cleared");
  } catch (err) {
    console.warn("Failed to clear cached beacons", err);
  }
};

export const getBeacons = async ({ forceRefresh = false } = {}): Promise<
  Beacon[] | null
> => {
  if (!forceRefresh) {
    const cached = await getCachedBeacons();
    if (cached) {
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (now - cached.timestamp < ONE_DAY) {
        console.log("Returning cached beacons:", cached.beacons);
        return cached.beacons;
      }
      console.log("Cache is stale, fetching from Supabase");
    } else {
      console.log("No cache found, fetching from Supabase");
    }
  }
  const beacons = await getBeaconsFromSupabase();
  await setCachedBeacons(beacons);
  return beacons;
};

export class BLELocationService {
  static async getBeaconCoordinates(
    beaconId: string
  ): Promise<[number, number] | null> {
    try {
      // Normalize beaconId to avoid mismatches
      const normalizedBeaconId = beaconId.toString().trim();
      console.log(`Fetching coordinates for beacon: ${normalizedBeaconId}`);

      const beacons = await getBeacons();
      if (!beacons || beacons.length === 0) {
        console.warn("No beacons available from getBeacons");
        // Fallback to direct Supabase query
        const { data, error } = await supabase
          .from("beacons")
          .select("x, y")
          .eq("ble_id", normalizedBeaconId)
          .single();
        if (error || !data || data.x == null || data.y == null) {
          console.warn(
            `No coordinates found for beacon ${normalizedBeaconId} in Supabase`
          );
          return null;
        }
        console.log(
          `Fetched coordinates from Supabase for beacon ${normalizedBeaconId}: [${data.x}, ${data.y}]`
        );
        // Update cache with new beacon
        await setCachedBeacons([
          { ble_id: normalizedBeaconId, x: data.x, y: data.y, floor: null },
        ]);
        return [data.x, data.y];
      }

      // Log all ble_id values for debugging
      console.log(
        "Available beacon IDs:",
        beacons.map((b) => b.ble_id)
      );
      const beacon = beacons.find(
        (b) => String(b.ble_id) === normalizedBeaconId
      );
      console.log(
        `Fetching coordinates for beacon ${normalizedBeaconId}:`,
        beacon ? `(${beacon.x}, ${beacon.y})` : "Not found",
        beacons
      );

      if (beacon && beacon.x != null && beacon.y != null) {
        console.log(
          `Found coordinates in cache for beacon ${normalizedBeaconId}: [${beacon.x}, ${beacon.y}]`
        );
        return [beacon.x, beacon.y];
      }

      console.warn(
        `No coordinates found for beacon ${normalizedBeaconId} in cache, trying Supabase`
      );
      const { data, error } = await supabase
        .from("beacons")
        .select("x, y")
        .eq("ble_id", normalizedBeaconId)
        .single();
      if (error || !data || data.x == null || data.y == null) {
        console.warn(
          `No coordinates found for beacon ${normalizedBeaconId} in Supabase`
        );
        return null;
      }
      console.log(
        `Fetched coordinates from Supabase for beacon ${normalizedBeaconId}: [${data.x}, ${data.y}]`
      );
      // Update cache with new beacon
      const updatedBeacons = [
        ...beacons,
        { ble_id: normalizedBeaconId, x: data.x, y: data.y, floor: null },
      ];
      await setCachedBeacons(updatedBeacons);
      return [data.x, data.y];
    } catch (error) {
      console.error(
        `Error fetching beacon coordinates for ${beaconId}:`,
        error
      );
      return null;
    }
  }

  static async getFriendIds(): Promise<string[]> {
    try {
      const user = await getUser();
      if (!user) return [];
      console.log(
        `👤 Authenticated user: ${
          user?.id || "None"
        } in bleLocationService.ts in getFriendIds`
      );

      const { data, error } = await supabase
        .from("relations")
        .select("subject, object")
        .eq("status", "accepted")
        .or(`subject.eq.${user.id},object.eq.${user.id}`);

      if (error) {
        console.error("Error fetching friends:", error);
        return [];
      }

      const friendIds = data
        .map((relation) =>
          relation.subject === user.id ? relation.object : relation.subject
        )
        .filter((id) => id !== user.id);
      return friendIds;
    } catch (error) {
      console.error("Error in getFriendIds:", error);
      return [];
    }
  }

  static async updateLocation(
    detectedBeacons: Map<string, any>
  ): Promise<boolean> {
    try {
      const user = await getUser();
      if (!user) return false;
      console.log(
        `👤 Authenticated user: ${
          user?.id || "None"
        } in bleLocationService.ts in updateLocation`
      );
      console.log("Detected beacons:", Array.from(detectedBeacons.entries()));

      if (detectedBeacons.size === 0) {
        console.log("No beacons detected, skipping location update");
        return false;
      }

      const beaconInfos: BeaconInfo[] = [];
      let closestBeacon: BeaconInfo | null = null;
      let strongestRSSI = -999;

      for (const [beaconId, beaconData] of detectedBeacons) {
        const coordinates = await this.getBeaconCoordinates(beaconId);
        if (!coordinates) {
          console.warn(
            `Skipping beacon ${beaconId} due to missing coordinates`
          );
          continue;
        }
        const distance = calculateDistanceFromRSSI(beaconData.rssi);

        const beaconInfo: BeaconInfo = {
          id: beaconId,
          rssi: beaconData.rssi,
          timestamp: beaconData.timestamp,
          coordinates,
          distance,
        };

        beaconInfos.push(beaconInfo);

        if (beaconData.rssi > strongestRSSI) {
          strongestRSSI = beaconData.rssi;
          closestBeacon = beaconInfo;
        }
      }

      if (!closestBeacon || !closestBeacon.coordinates) {
        console.warn(
          "No valid beacon coordinates found for any detected beacons"
        );
        return false;
      }

      // const sharedTo = await this.getFriendIds();
      const radius = calculateLocationRadius(beaconInfos);
      const [x, y] = closestBeacon.coordinates;
      const floor = await this.getFloorFromBeacon(closestBeacon.id);

      const locationData: LocationData = {
        user_id: user.id,
        floor: floor,
        x: x,
        y: y,
        radius: radius,
        beacons: beaconInfos,
        // shared_to: [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("locations").upsert(locationData, {
        onConflict: "user_id",
      });

      if (error) {
        console.error("Error updating location:", error, locationData);
        return false;
      }
      console.log(
        `Location updated - Position: (${x.toFixed(6)}, ${y.toFixed(
          6
        )}), Radius: ${radius.toFixed(1)}m, Beacons: ${beaconInfos.length}`,
        locationData
      );
      return true;
    } catch (error) {
      console.error("Error in updateLocation:", error);
      return false;
    }
  }

  static async getFloorFromBeacon(beaconId: string): Promise<string | null> {
    try {
      const normalizedBeaconId = beaconId.toString().trim();
      const beacons = await getBeacons();
      if (!beacons || beacons.length === 0) {
        console.warn("No beacons available from getBeacons for floor lookup");
        const { data, error } = await supabase
          .from("beacons")
          .select("floor")
          .eq("ble_id", normalizedBeaconId)
          .single();
        if (error || !data || !data.floor) {
          console.warn(
            `No floor found for beacon ${normalizedBeaconId} in Supabase`
          );
          return null;
        }
        await setCachedBeacons([
          { ble_id: normalizedBeaconId, x: 0, y: 0, floor: data.floor },
        ]);
        return data.floor;
      }

      const beacon = beacons.find(
        (b) => String(b.ble_id) === normalizedBeaconId
      );
      if (beacon && beacon.floor != null) {
        return beacon.floor;
      }

      console.warn(
        `No floor found for beacon ${normalizedBeaconId} in cache, trying Supabase`
      );
      const { data, error } = await supabase
        .from("beacons")
        .select("floor")
        .eq("ble_id", normalizedBeaconId)
        .single();
      if (error || !data || !data.floor) {
        console.warn(
          `No floor found for beacon ${normalizedBeaconId} in Supabase`
        );
        return null;
      }
      const updatedBeacons = [
        ...beacons,
        { ble_id: normalizedBeaconId, x: 0, y: 0, floor: data.floor },
      ];
      await setCachedBeacons(updatedBeacons);
      return data.floor;
    } catch (error) {
      console.error(`Error fetching floor for beacon ${beaconId}:`, error);
      return null;
    }
  }

  static async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const user = await getUser();
      console.log(
        `👤 Authenticated user: ${
          user?.id || "None"
        } in bleLocationService.ts in getCurrentLocation`
      );
      if (!user) return null;

      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching current location:", error);
        return null;
      }

      return data as LocationData;
    } catch (error) {
      console.error("Error in getCurrentLocation:", error);
      return null;
    }
  }

  static async getFriendsLocations(): Promise<LocationData[]> {
    try {
      const user = await getUser();
      console.log(
        `👤 Authenticated user: ${
          user?.id || "None"
        } in bleLocationService.ts in getFriendLocations`
      );
      if (!user) return [];

      const friendIds = await this.getFriendIds();
      if (friendIds.length === 0) return [];

      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .in("user_id", friendIds);

      if (error) {
        console.error("Error fetching friends locations:", error);
        return [];
      }

      return data as LocationData[];
    } catch (error) {
      console.error("Error in getFriendsLocations:", error);
      return [];
    }
  }

  static subscribeToLocationUpdates(callback: (payload: any) => void) {
    return supabase
      .channel("location_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "locations",
        },
        callback
      )
      .subscribe();
  }

  static async uploadLocation(
    locationData: UserLocationData
  ): Promise<boolean> {
    console.warn("uploadLocation is deprecated, use updateLocation instead");
    try {
      const { error } = await supabase
        .from("user_locations")
        .insert(locationData);

      if (error) {
        console.error("Error uploading location:", error);
        return false;
      }

      console.log("Location uploaded successfully");
      return true;
    } catch (error) {
      console.error("Error in uploadLocation:", error);
      return false;
    }
  }

  static async getLocationHistory(
    hours: number = 24
  ): Promise<LocationHistoryItem[]> {
    try {
      const user = await getUser();
      console.log(
        `👤 Authenticated user: ${
          user?.id || "None"
        } in bleLocationService.ts in getLocationHistory`
      );
      if (!user) return [];

      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await supabase
        .from("user_locations")
        .select("*")
        .eq("user_id", user.id)
        .gte("timestamp", since.toISOString())
        .order("timestamp", { ascending: false });

      if (error) {
        console.error("Error fetching location history:", error);
        return [];
      }

      return data as LocationHistoryItem[];
    } catch (error) {
      console.error("Error in getLocationHistory:", error);
      return [];
    }
  }

  static async getUsersInRoom(roomId: string): Promise<LocationHistoryItem[]> {
    try {
      const { data, error } = await supabase
        .from("latest_user_locations")
        .select("*")
        .eq("room_id", roomId)
        .not("user_id", "is", null);

      if (error) {
        console.error("Error fetching users in room:", error);
        return [];
      }

      return data as LocationHistoryItem[];
    } catch (error) {
      console.error("Error in getUsersInRoom:", error);
      return [];
    }
  }

  static async cleanupOldLocations(daysBefore: number = 7): Promise<boolean> {
    try {
      const user = await getUser();
      console.log(
        `👤 Authenticated user: ${
          user?.id || "None"
        } in bleLocationService.ts in cleanupOldLocations`
      );
      if (!user) return false;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

      const { error } = await supabase
        .from("user_locations")
        .delete()
        .eq("user_id", user.id)
        .lt("timestamp", cutoffDate.toISOString());

      if (error) {
        console.error("Error cleaning up old locations:", error);
        return false;
      }

      console.log(`Cleaned up location data older than ${daysBefore} days`);
      return true;
    } catch (error) {
      console.error("Error in cleanupOldLocations:", error);
      return false;
    }
  }
}

export default BLELocationService;
