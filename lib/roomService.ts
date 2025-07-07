import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type Room = {
  id: string;
  room_number: string;
  title: string;
  description: string;
  seats: number;
  type: string;
  equipment: Object;
  wilma_id: string;
  bookable: boolean;
  image_url: string;
  created_at: string;
  schedule: Object;
  status: string;
  geometry?: {
    type: string;
    coordinates: any[];
  };
};

type RoomState = {
  rooms: Room[];
  lastFetched: number | null;
  loading: boolean;
  error: string | null;
  fetchRooms: (force?: boolean) => Promise<void>;
  clearRooms: () => void;
};

const CACHE_KEY = 'room_cache';
const TTL = 10 * 60 * 1000; 

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  lastFetched: null,
  loading: false,
  error: null,

  fetchRooms: async (force = false) => {
    const now = Date.now();
    const { lastFetched } = get();

    if (!force && lastFetched && now - lastFetched < TTL) return;

    set({ loading: true, error: null });

    try {
      if (!force) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (now - timestamp < TTL) {
            set({ rooms: data, lastFetched: timestamp, loading: false });
            return;
          }
        }
      }

      const { data, error } = await supabase.from('rooms').select('*');
      if (error) throw new Error(error.message);

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: now }));
      set({ rooms: data, lastFetched: now, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  clearRooms: async () => {
    await AsyncStorage.removeItem(CACHE_KEY);
    set({ rooms: [], lastFetched: null });
  },
}));