import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const getUserFromSupabase = async () => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("Error fetching user:", userError);
    return null;
  }
  return userData?.user || null;
};

const CACHE_KEY = "user";
const CACHE_TIMESTAMP_KEY = "user_cache_timestamp";

const getCachedUser = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const timestampRaw = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    const user = raw ? JSON.parse(raw) : null;
    const timestamp = timestampRaw ? parseInt(timestampRaw, 10) : null;
    return user && timestamp ? { user, timestamp } : null;
  } catch (err) {
    console.warn("Failed to load cached user", err);
    return null;
  }
};

const setCachedUser = async (user: any) => {
  try {
    if (user) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(user));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } else {
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }
  } catch (err) {
    console.warn("Failed to update cached user", err);
  }
};

/**
 * Clear the cached user (for logout)
 */
export const clearUserCache = async () => {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
  } catch (err) {
    console.warn("Failed to clear cached user", err);
  }
};

/**
 * Get the current user, using cache if available unless forceRefresh is true.
 * @param {Object} options
 * @param {boolean} options.forceRefresh - If true, always fetch from Supabase.
 */
export const getUser = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = await getCachedUser();
    if (cached) {
      const ONE_HOUR = 60 * 60 * 1000;
      const now = Date.now();
      if (now - cached.timestamp < ONE_HOUR) {
        return cached.user;
      }
      // else, cache is too old, fetch fresh
    }
  }
  const user = await getUserFromSupabase();
  await setCachedUser(user);
  return user;
};

export { getCachedUser, getUserFromSupabase, setCachedUser };
