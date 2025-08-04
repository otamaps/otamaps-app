// friendsHandler.ts

import { getUser } from "@/lib/getUserHandle";
import { getRoomIdFromBleId } from "@/lib/idTranslation";
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
  user_friendly_location?: string;
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

  //console.log("Locations:", locations);
  const combined: Friend[] = await Promise.all(
    users.map(async (user) => {
      const location = locations.find((loc) => loc.user_id === user.id);

      // Get the beacon with the strongest signal (lowest distance)
      const strongestBeacon = location?.beacons?.reduce(
        (prev: any, current: any) =>
          prev.distance < current.distance ? prev : current
      );
      const beaconId = strongestBeacon?.id || "";

      return {
        ...user,
        lastSeen: location?.updated_at || null,
        location: location ? [location.x, location.y] : null,
        status: "koulussa",
        user_friendly_location: await getRoomIdFromBleId(beaconId),
      };
    })
  );

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
  const user = await getUser();
  console.log(
    `👤 Authenticated user: ${
      user?.id || "None"
    } in friendsHandler.ts in getRequests`
  );
  if (!user?.id) {
    console.log("Error fetching user");
    return [];
  }

  const { data: requests, error: requestsError } = await supabase
    .from("relations")
    .select("*")
    .eq("status", "request")
    .eq("object", user.id);

  if (requestsError) {
    console.log("Error fetching requests:", requestsError);
    return [];
  }

  console.log("Requests fetched", requests);
  return requests;
};

// export const handleStopSharing = async (friendId: string) => {
//   const user = await getUser();
//   const { data: location, error: locationError } = await supabase
//     .from("locations")
//     .select("shared_to")
//     .eq("user_id", user.id)
//     .single();

//   if (locationError) {
//     console.log("Error fetching locations:", locationError);
//     return;
//   }

//   const sharedTo = location?.shared_to || [];
//   const updatedSharedTo = sharedTo.filter((id: any) => id !== friendId);

//   const { error: stopSharingError } = await supabase
//     .from("locations")
//     .update({ shared_to: updatedSharedTo })
//     .eq("user_id", user.id);

//   if (stopSharingError) {
//     console.log("Error updating shared_to:", stopSharingError);
//   }
// };

export const handleBlockFriend = async (friendId: string) => {
  const user = await getUser();
  if (!user) {
    console.log("No authenticated user found");
    return;
  }

  const { error: removeError } = await supabase
    .from("relations")
    .delete()
    .or(
      `and(subject.eq.${friendId},object.eq.${user.id}),and(subject.eq.${user.id},object.eq.${friendId})`
    );

  if (removeError) {
    console.log("Error removing friend relation:", removeError);
    return;
  }

  const { error: blockError } = await supabase.from("relations").insert({
    subject: user.id,
    object: friendId,
    status: "blocked",
  });

  if (blockError) {
    console.log("Error blocking friend:", blockError);
  }
};

export const handleRemoveFriend = async (friendId: string) => {
  const user = await getUser();
  if (!user) {
    console.log("No authenticated user found");
    return;
  }

  const { error: removeError } = await supabase
    .from("relations")
    .delete()
    .eq("status", "friends")
    .or(
      `and(subject.eq.${friendId},object.eq.${user.id}),and(subject.eq.${user.id},object.eq.${friendId})`
    );

  if (removeError) {
    console.log("Error removing friend relation:", removeError);
  }
};
