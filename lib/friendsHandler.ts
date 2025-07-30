// friendsHandler.ts

import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "cached_friends";

export type Friend = {
  id: string;
  name: string;
  class: string;
  code: string;
  color: string;
  lastSeen: string | null;
  location: [number, number] | null;
  status: string;
};

// fetch and combine from Supabase
const fetchFriendsFromSupabase = async (): Promise<Friend[]> => {
  const { data: users, error: userError } = await supabase
    .from("users_ff")
    .select("*");
  if (userError) throw userError;

  const { data: locations, error: locationError } = await supabase
    .from("locations")
    .select("*");

  if (locationError) throw locationError;

  //   console.log("Locations:", locations);
  const combined: Friend[] = users.map((user) => {
    const location = locations.find((loc) => loc.user_id === user.id);

    return {
      ...user,
      lastSeen: location?.updated_at || null,
      location: location ? [location.x, location.y] : null,
      status: "at school",
    };
  });

  return combined;
};

// Save to AsyncStorage
const cacheFriends = async (friends: Friend[]) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(friends));
  } catch (err) {
    console.warn("Failed to cache friends", err);
  }
};

// Get from AsyncStorage
const getCachedFriends = async (): Promise<Friend[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to load cached friends", err);
    return null;
  }
};

// Public method
export const getFriends = async (forceRefresh = false): Promise<Friend[]> => {
  if (!forceRefresh) {
    const cached = await getCachedFriends();
    if (cached) return cached;
  }

  console.log("Fetching fresh friends");
  const fresh = await fetchFriendsFromSupabase();
  console.log("Friends fetched", fresh);
  await cacheFriends(fresh);
  return fresh;
};

export const getRequests = async () => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    console.log("Error fetching user", userError);
    return [];
  }

  const { data: requests, error: requestsError } = await supabase
    .from("relations")
    .select("*")
    .eq("status", "request")
    .eq("object", userData.user.id);

  if (requestsError) {
    console.log("Error fetching requests:", requestsError);
    return [];
  }

  console.log("Requests fetched", requests);
  return requests;
};
