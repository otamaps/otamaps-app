import { supabase } from './supabase';

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

// New interface for the updated locations table
export interface LocationData {
  id?: string;
  user_id: string;
  floor: string | null;
  x: number; // latitude of closest beacon
  y: number; // longitude of closest beacon
  radius: number; // calculated from RSSI
  beacons: BeaconInfo[]; // JSONB array of detected beacons
  updated_at?: string;
  shared_to: string[]; // array of user IDs who can see this location
}

export interface BeaconInfo {
  id: string;
  rssi: number;
  timestamp: number;
  coordinates?: [number, number]; // beacon's coordinates from database
  distance?: number; // calculated distance based on RSSI
}

/**
 * Calculate approximate distance from RSSI value
 * Formula: distance = 10^((Measured Power - RSSI) / (10 * N))
 * where Measured Power is typically -59 dBm at 1 meter, N is path loss exponent (2-4)
 */
function calculateDistanceFromRSSI(rssi: number): number {
  if (rssi === 0) return -1.0;
  
  const measuredPower = -59; // dBm at 1 meter
  const pathLossExponent = 2.5; // typical value for indoor environments
  
  if (rssi < measuredPower) {
    const ratio = (measuredPower - rssi) / (10 * pathLossExponent);
    return Math.pow(10, ratio);
  } else {
    const ratio = (measuredPower - rssi) / (10 * pathLossExponent);
    return Math.pow(10, ratio);
  }
}

/**
 * Calculate location radius based on beacon distances
 * Uses the closest beacon distance as base radius with some uncertainty
 */
function calculateLocationRadius(beacons: BeaconInfo[]): number {
  if (beacons.length === 0) return 50; // default radius in meters
  
  const distances = beacons.map(beacon => beacon.distance || 50);
  const minDistance = Math.min(...distances);
  
  // Add uncertainty based on number of beacons and signal strength
  const uncertainty = beacons.length > 1 ? 5 : 15; // meters
  return Math.max(5, minDistance + uncertainty); // minimum 5m radius
}

/**
 * Service for managing user location data in the new locations table
 */
export class BLELocationService {
  /**
   * Get beacon coordinates from database
   */
  static async getBeaconCoordinates(beaconId: string): Promise<[number, number] | null> {
    try {
      const { data, error } = await supabase
        .from('beacons')
        .select('x, y')
        .eq('ble_id', beaconId)
        .single();

      if (error || !data) {
        console.warn(`No coordinates found for beacon ${beaconId}`);
        return null;
      }

      return [data.x, data.y];
    } catch (error) {
      console.error('Error fetching beacon coordinates:', error);
      return null;
    }
  }

  /**
   * Get user's friend list for shared_to field
   */
  static async getFriendIds(): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get accepted friends from the relations table
      const { data, error } = await supabase
        .from('relations')
        .select('subject, object')
        .eq('status', 'accepted')
        .or(`subject.eq.${user.id},object.eq.${user.id}`);

      if (error) {
        console.error('Error fetching friends:', error);
        return [];
      }

      // Extract friend IDs (the other person in each relation)
      const friendIds = data.map(relation => 
        relation.subject === user.id ? relation.object : relation.subject
      ).filter(id => id !== user.id); // Just to be safe

      return friendIds;
    } catch (error) {
      console.error('Error in getFriendIds:', error);
      return [];
    }
  }

  /**
   * Update user location based on detected beacons
   */
  static async updateLocation(detectedBeacons: Map<string, any>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      if (detectedBeacons.size === 0) {
        console.log('No beacons detected, skipping location update');
        return false;
      }

      // Convert beacon data and fetch coordinates
      const beaconInfos: BeaconInfo[] = [];
      let closestBeacon: BeaconInfo | null = null;
      let strongestRSSI = -999;

      for (const [beaconId, beaconData] of detectedBeacons) {
        const coordinates = await this.getBeaconCoordinates(beaconId);
        const distance = calculateDistanceFromRSSI(beaconData.rssi);
        
        const beaconInfo: BeaconInfo = {
          id: beaconId,
          rssi: beaconData.rssi,
          timestamp: beaconData.timestamp,
          coordinates: coordinates || undefined,
          distance
        };

        beaconInfos.push(beaconInfo);

        // Track closest beacon (strongest RSSI)
        if (beaconData.rssi > strongestRSSI && coordinates) {
          strongestRSSI = beaconData.rssi;
          closestBeacon = beaconInfo;
        }
      }

      if (!closestBeacon || !closestBeacon.coordinates) {
        console.warn('No valid beacon coordinates found');
        return false;
      }

      // Get shared_to list (friends)
      const sharedTo = await this.getFriendIds();

      // Calculate location data
      const radius = calculateLocationRadius(beaconInfos);
      const [x, y] = closestBeacon.coordinates;

      // Determine floor from beacon location (you might need to add floor info to beacons table)
      const floor = await this.getFloorFromBeacon(closestBeacon.id);

      const locationData: LocationData = {
        user_id: user.id,
        floor,
        x, // latitude of closest beacon
        y, // longitude of closest beacon
        radius,
        beacons: beaconInfos,
        shared_to: sharedTo
      };

      // Upsert location data
      const { error } = await supabase
        .from('locations')
        .upsert(locationData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating location:', error);
        return false;
      }

      console.log(`Location updated - Position: (${x.toFixed(6)}, ${y.toFixed(6)}), Radius: ${radius.toFixed(1)}m, Beacons: ${beaconInfos.length}`);
      return true;
    } catch (error) {
      console.error('Error in updateLocation:', error);
      return false;
    }
  }

  /**
   * Get floor information from beacon (you may need to add this to your beacons table)
   */
  static async getFloorFromBeacon(beaconId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('beacons')
        .select('floor')
        .eq('ble_id', beaconId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.floor;
    } catch (error) {
      console.error('Error fetching floor from beacon:', error);
      return null;
    }
  }

  /**
   * Get current user location
   */
  static async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching current location:', error);
        return null;
      }

      return data as LocationData;
    } catch (error) {
      console.error('Error in getCurrentLocation:', error);
      return null;
    }
  }

  /**
   * Get locations of friends
   */
  static async getFriendsLocations(): Promise<LocationData[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get friend IDs
      const friendIds = await this.getFriendIds();
      if (friendIds.length === 0) return [];

      // Get locations for friends
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .in('user_id', friendIds);

      if (error) {
        console.error('Error fetching friends locations:', error);
        return [];
      }

      return data as LocationData[];
    } catch (error) {
      console.error('Error in getFriendsLocations:', error);
      return [];
    }
  }

  /**
   * Subscribe to real-time location updates
   */
  static subscribeToLocationUpdates(callback: (payload: any) => void) {
    return supabase
      .channel('location_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations'
        },
        callback
      )
      .subscribe();
  }

  // ============ LEGACY METHODS FOR BACKWARD COMPATIBILITY ============
  
  /**
   * @deprecated Use updateLocation instead
   * Upload user location data to Supabase (legacy method)
   */
  static async uploadLocation(locationData: UserLocationData): Promise<boolean> {
    console.warn('uploadLocation is deprecated, use updateLocation instead');
    try {
      const { error } = await supabase
        .from('user_locations')
        .insert(locationData);

      if (error) {
        console.error('Error uploading location:', error);
        return false;
      }

      console.log('Location uploaded successfully');
      return true;
    } catch (error) {
      console.error('Error in uploadLocation:', error);
      return false;
    }
  }

  /**
   * Get user's location history for a specific time period
   */
  static async getLocationHistory(
    hours: number = 24
  ): Promise<LocationHistoryItem[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching location history:', error);
        return [];
      }

      return data as LocationHistoryItem[];
    } catch (error) {
      console.error('Error in getLocationHistory:', error);
      return [];
    }
  }

  /**
   * Get all users currently in a specific room
   */
  static async getUsersInRoom(roomId: string): Promise<LocationHistoryItem[]> {
    try {
      const { data, error } = await supabase
        .from('latest_user_locations')
        .select('*')
        .eq('room_id', roomId)
        .not('user_id', 'is', null);

      if (error) {
        console.error('Error fetching users in room:', error);
        return [];
      }

      return data as LocationHistoryItem[];
    } catch (error) {
      console.error('Error in getUsersInRoom:', error);
      return [];
    }
  }

  /**
   * Clean up old location data for the current user
   */
  static async cleanupOldLocations(daysBefore: number = 7): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('user_id', user.id)
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        console.error('Error cleaning up old locations:', error);
        return false;
      }

      console.log(`Cleaned up location data older than ${daysBefore} days`);
      return true;
    } catch (error) {
      console.error('Error in cleanupOldLocations:', error);
      return false;
    }
  }
}

export default BLELocationService;
