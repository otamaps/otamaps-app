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

/**
 * Service for managing user location data in Supabase
 */
export class BLELocationService {
  /**
   * Upload user location data to Supabase
   */
  static async uploadLocation(locationData: UserLocationData): Promise<boolean> {
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
   * Get the current user's latest location
   */
  static async getCurrentLocation(): Promise<LocationHistoryItem | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('latest_user_locations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching current location:', error);
        return null;
      }

      return data as LocationHistoryItem;
    } catch (error) {
      console.error('Error in getCurrentLocation:', error);
      return null;
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

  /**
   * Subscribe to real-time location updates for a specific user
   */
  static subscribeToLocationUpdates(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('user_locations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_locations',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to real-time location updates for a specific room
   */
  static subscribeToRoomUpdates(
    roomId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('room_locations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_locations',
          filter: `room_id=eq.${roomId}`
        },
        callback
      )
      .subscribe();
  }
}

export default BLELocationService;
